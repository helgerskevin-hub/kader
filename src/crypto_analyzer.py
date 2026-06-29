#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
crypto_analyzer.py
==================
Haalt GRATIS publieke crypto-marktdata op (Binance public API + CoinGecko),
berekent technische indicatoren (RSI, EMA 20/50, MACD, ATR, volume spikes) en
levert een gerangschikte lijst van 5-10 trade-kansen.

Belangrijke eigenschappen:
- Geen API-keys nodig (alleen gratis publieke endpoints).
- ATR-gebaseerde DYNAMISCHE stop loss (geen vaste percentages).
- Elke trade heeft een Risk/Reward van minimaal 1:2.
- Uitzonderlijke kansen worden gemarkeerd als "HIGH CONVICTION".
- Robuuste fallback als een API tijdelijk onbereikbaar is.
- Alle uitvoer in het Nederlands.

Gebruik:
    python crypto_analyzer.py            # print tabel naar scherm
    from crypto_analyzer import analyseer_markt
    trades = analyseer_markt()           # geeft lijst van dicts terug
"""

from __future__ import annotations

import sys
import time
import math
from datetime import datetime, timezone

import requests
import pandas as pd

try:
    from rich.console import Console
    from rich.table import Table
    _console = Console()
except Exception:  # rich is optioneel voor pure import
    _console = None


# ---------------------------------------------------------------------------
# CONFIGURATIE
# ---------------------------------------------------------------------------

# Liquide crypto's die we standaard analyseren (Binance USDT-paren).
# Je kunt deze lijst gerust uitbreiden of inkorten.
STANDAARD_UNIVERSUM = [
    "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE",
    "LINK", "DOT", "MATIC", "LTC", "ATOM", "NEAR", "ARB", "OP",
    "INJ", "SUI", "APT", "TIA", "RNDR", "FET", "SEI", "AAVE",
]

# Binance publieke endpoints (meerdere voor fallback / geo-redundantie).
BINANCE_BASES = [
    "https://api.binance.com",
    "https://data-api.binance.vision",  # publieke data-mirror, geen geo-block
    "https://api1.binance.com",
    "https://api.binance.us",
]

COINGECKO_BASE = "https://api.coingecko.com/api/v3"

# Mapping van symbool -> CoinGecko id (voor fallback-prijzen).
COINGECKO_IDS = {
    "BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana", "BNB": "binancecoin",
    "XRP": "ripple", "ADA": "cardano", "AVAX": "avalanche-2", "DOGE": "dogecoin",
    "LINK": "chainlink", "DOT": "polkadot", "MATIC": "matic-network",
    "LTC": "litecoin", "ATOM": "cosmos", "NEAR": "near", "ARB": "arbitrum",
    "OP": "optimism", "INJ": "injective-protocol", "SUI": "sui",
    "APT": "aptos", "TIA": "celestia", "RNDR": "render-token",
    "FET": "fetch-ai", "SEI": "sei-network", "AAVE": "aave",
}

# Indicator-instellingen.
RSI_PERIODE = 14
EMA_KORT = 20
EMA_LANG = 50
ATR_PERIODE = 14
VOLUME_GEMIDDELDE_PERIODE = 20

# Risk/Reward-instellingen.
ATR_STOP_MULTIPLIER = 1.5      # stop loss = entry - 1.5 * ATR
REWARD_MULTIPLIER = 3.0        # take profit = entry + 3 * ATR
# R/R wordt volledig bepaald door de twee multipliers hierboven (3.0 / 1.5 = 2.0).
# MIN_RISK_REWARD is hier puur documentatie; de berekening garandeert altijd exact deze waarde.
MIN_RISK_REWARD = REWARD_MULTIPLIER / ATR_STOP_MULTIPLIER

HIGH_CONVICTION_SCORE = 75     # drempel voor "HIGH CONVICTION"
KOOP_SCORE = 55                # drempel waarboven het signaal "KOOP" wordt (anders "WATCH")
HTTP_TIMEOUT = 15
HEADERS = {"User-Agent": "crypto-copy-trading-analyzer/1.0"}


# ---------------------------------------------------------------------------
# DATA OPHALEN
# ---------------------------------------------------------------------------

def _http_get(url: str, params: dict | None = None, timeout: int = HTTP_TIMEOUT):
    """GET met nette foutafhandeling. Geeft JSON of None terug."""
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
        if r.status_code == 200:
            return r.json()
    except Exception:
        return None
    return None


def haal_binance_klines(symbool: str, interval: str = "1d", limit: int = 200) -> pd.DataFrame | None:
    """
    Haalt dagelijkse candlesticks op van Binance (probeert meerdere bases).
    Geeft een DataFrame met kolommen: open, high, low, close, volume (float).
    """
    pair = f"{symbool}USDT"
    for base in BINANCE_BASES:
        data = _http_get(
            f"{base}/api/v3/klines",
            params={"symbol": pair, "interval": interval, "limit": limit},
        )
        if isinstance(data, list) and len(data) > EMA_LANG:
            df = pd.DataFrame(data, columns=[
                "open_time", "open", "high", "low", "close", "volume",
                "close_time", "qav", "trades", "tbav", "tqav", "ignore",
            ])
            for col in ["open", "high", "low", "close", "volume"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            df = df.dropna(subset=["open", "high", "low", "close"])
            df["bron"] = base
            return df[["open", "high", "low", "close", "volume"]].reset_index(drop=True)
    return None


def haal_coingecko_ohlc(symbool: str, days: int = 30) -> pd.DataFrame | None:
    """
    FALLBACK: haalt OHLC op van CoinGecko als Binance onbereikbaar is.
    Bij days=30 levert CoinGecko ~180 4-uurs candles (genoeg voor de indicatoren).
    CoinGecko levert geen volume bij OHLC, dus volume wordt op 0 gezet
    (volume-spike-signaal valt dan weg, maar de trade blijft bruikbaar).
    """
    cg_id = COINGECKO_IDS.get(symbool)
    if not cg_id:
        return None
    data = _http_get(
        f"{COINGECKO_BASE}/coins/{cg_id}/ohlc",
        params={"vs_currency": "usd", "days": days},
    )
    if isinstance(data, list) and len(data) > EMA_LANG:
        df = pd.DataFrame(data, columns=["time", "open", "high", "low", "close"])
        df["volume"] = 0.0
        return df[["open", "high", "low", "close", "volume"]].reset_index(drop=True)
    return None


def haal_data(symbool: str) -> tuple[pd.DataFrame | None, str]:
    """Probeer Binance, val terug op CoinGecko. Geeft (df, bronnaam)."""
    df = haal_binance_klines(symbool)
    if df is not None and len(df) > EMA_LANG:
        return df, "Binance"
    df = haal_coingecko_ohlc(symbool)
    if df is not None and len(df) > EMA_LANG:
        return df, "CoinGecko (fallback)"
    return None, "geen"


# ---------------------------------------------------------------------------
# INDICATOREN (zelf berekend in pandas -> geen externe afhankelijkheid nodig)
# ---------------------------------------------------------------------------

def bereken_rsi(close: pd.Series, periode: int = RSI_PERIODE) -> pd.Series:
    delta = close.diff()
    winst = delta.clip(lower=0)
    verlies = -delta.clip(upper=0)
    avg_winst = winst.ewm(alpha=1 / periode, min_periods=periode, adjust=False).mean()
    avg_verlies = verlies.ewm(alpha=1 / periode, min_periods=periode, adjust=False).mean()
    rs = avg_winst / avg_verlies.replace(0, pd.NA)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)


def bereken_ema(close: pd.Series, periode: int) -> pd.Series:
    return close.ewm(span=periode, adjust=False).mean()


def bereken_macd(close: pd.Series, snel: int = 12, traag: int = 26, signaal: int = 9):
    ema_snel = close.ewm(span=snel, adjust=False).mean()
    ema_traag = close.ewm(span=traag, adjust=False).mean()
    macd_lijn = ema_snel - ema_traag
    signaal_lijn = macd_lijn.ewm(span=signaal, adjust=False).mean()
    histogram = macd_lijn - signaal_lijn
    return macd_lijn, signaal_lijn, histogram


def bereken_atr(df: pd.DataFrame, periode: int = ATR_PERIODE) -> pd.Series:
    hoog, laag, slot = df["high"], df["low"], df["close"]
    vorige_slot = slot.shift(1)
    tr = pd.concat([
        (hoog - laag),
        (hoog - vorige_slot).abs(),
        (laag - vorige_slot).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / periode, min_periods=periode, adjust=False).mean()


# ---------------------------------------------------------------------------
# ANALYSE PER COIN
# ---------------------------------------------------------------------------

def analyseer_coin(symbool: str) -> dict | None:
    """Analyseert één coin en geeft een trade-dict terug (of None)."""
    df, bron = haal_data(symbool)
    if df is None or len(df) < EMA_LANG + 5:
        return None

    close = df["close"]
    prijs = float(close.iloc[-1])

    rsi = bereken_rsi(close)
    ema20 = bereken_ema(close, EMA_KORT)
    ema50 = bereken_ema(close, EMA_LANG)
    macd_lijn, signaal_lijn, hist = bereken_macd(close)
    atr = bereken_atr(df)

    rsi_nu = float(rsi.iloc[-1])
    ema20_nu = float(ema20.iloc[-1])
    ema50_nu = float(ema50.iloc[-1])
    macd_nu = float(macd_lijn.iloc[-1])
    signaal_nu = float(signaal_lijn.iloc[-1])
    hist_nu = float(hist.iloc[-1])
    atr_nu = float(atr.iloc[-1]) if not math.isnan(atr.iloc[-1]) else prijs * 0.03

    # Volume spike: huidige volume t.o.v. 20-daags gemiddelde.
    if df["volume"].sum() > 0:
        vol_gem = float(df["volume"].tail(VOLUME_GEMIDDELDE_PERIODE).mean())
        vol_nu = float(df["volume"].iloc[-1])
        volume_ratio = (vol_nu / vol_gem) if vol_gem > 0 else 1.0
    else:
        volume_ratio = 1.0  # CoinGecko-fallback heeft geen volume

    # ---- Signaal-scoring (0-100) -------------------------------------------
    score = 0
    redenen = []

    # 1. Trend: EMA20 boven EMA50 (bullish kruising / opwaartse trend)
    if ema20_nu > ema50_nu:
        score += 25
        redenen.append("opwaartse trend (EMA20>EMA50)")
    # 2. Prijs boven EMA20 (momentum bevestigd)
    if prijs > ema20_nu:
        score += 15
        redenen.append("prijs boven EMA20")
    # 3. RSI in gezonde zone (niet overbought, wel opwaarts)
    if 45 <= rsi_nu <= 68:
        score += 20
        redenen.append(f"RSI gezond ({rsi_nu:.0f})")
    elif rsi_nu < 35:
        score += 10
        redenen.append(f"RSI oversold ({rsi_nu:.0f}) - mogelijke bounce")
    # 4. MACD bullish (MACD-lijn boven signaallijn, histogram positief)
    if macd_nu > signaal_nu:
        score += 20
        redenen.append("MACD bullish")
        if hist_nu > 0:
            score += 5
    # 5. Volume spike (institutionele interesse)
    if volume_ratio >= 1.5:
        score += 15
        redenen.append(f"volume spike ({volume_ratio:.1f}x)")
    elif volume_ratio >= 1.2:
        score += 8
        redenen.append(f"verhoogd volume ({volume_ratio:.1f}x)")

    score = min(score, 100)

    # ---- Trade-niveaus (ATR-gebaseerd, dynamisch) --------------------------
    entry = prijs
    risk = ATR_STOP_MULTIPLIER * atr_nu
    stop_loss = entry - risk
    take_profit = entry + REWARD_MULTIPLIER * atr_nu
    reward = take_profit - entry
    rr = reward / risk if risk > 0 else 0.0

    # Entry-zone: smalle band rond de huidige prijs (0.4 * ATR breed).
    entry_laag = entry - 0.2 * atr_nu
    entry_hoog = entry + 0.2 * atr_nu

    signaal_tekst = "KOOP" if score >= KOOP_SCORE else "WATCH"
    high_conviction = (
        score >= HIGH_CONVICTION_SCORE
        and ema20_nu > ema50_nu
        and macd_nu > signaal_nu
        and volume_ratio >= 1.3
    )

    return {
        "symbool": symbool,
        "bron": bron,
        "prijs": prijs,
        "entry": entry,
        "entry_laag": entry_laag,
        "entry_hoog": entry_hoog,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "rr": rr,
        "atr": atr_nu,
        "rsi": rsi_nu,
        "ema20": ema20_nu,
        "ema50": ema50_nu,
        "macd_bullish": macd_nu > signaal_nu,
        "volume_ratio": volume_ratio,
        "score": score,
        "redenen": redenen,
        "signaal": signaal_tekst,
        "high_conviction": high_conviction,
    }


def analyseer_markt(universum: list[str] | None = None, top_n: int = 10,
                    verbose: bool = True) -> list[dict]:
    """
    Analyseert het hele universum en geeft de best gerangschikte trades terug.
    Geeft tussen de 5 en 10 trades (afhankelijk van hoeveel aan de R/R-eis voldoen).
    """
    universum = universum or STANDAARD_UNIVERSUM
    resultaten: list[dict] = []

    for i, sym in enumerate(universum, 1):
        if verbose and _console:
            _console.print(f"[dim]({i}/{len(universum)}) {sym} analyseren...[/dim]")
        elif verbose:
            print(f"({i}/{len(universum)}) {sym} analyseren...")
        try:
            res = analyseer_coin(sym)
            if res:
                resultaten.append(res)
        except Exception as e:
            if verbose:
                print(f"   ! {sym} overgeslagen: {e}")
        time.sleep(0.25)  # vriendelijk voor de gratis API's

    # Sorteer: HIGH CONVICTION eerst, daarna op score, daarna op R/R.
    resultaten.sort(key=lambda x: (x["high_conviction"], x["score"], x["rr"]), reverse=True)

    # Geef minimaal 5 (indien beschikbaar) en maximaal top_n terug.
    return resultaten[:max(5, top_n)] if len(resultaten) >= 5 else resultaten


# ---------------------------------------------------------------------------
# GROTE-KANSEN-SCANNER (zoekt buiten het vaste universum naar hoog opwaarts potentieel)
# ---------------------------------------------------------------------------

# Stablecoins / wrapped tokens die we nooit als "kans" willen tonen.
_UITSLUITEN = {
    "USDT", "USDC", "DAI", "TUSD", "FDUSD", "USDE", "PYUSD", "USDD", "BUSD",
    "GUSD", "FRAX", "LUSD", "USDS", "USD0", "WBTC", "WETH", "STETH", "WSTETH",
    "WEETH", "WBETH", "RETH", "CBETH", "BSC-USD", "SOLVBTC", "LBTC",
}

# Cryptos die verhandelbaar zijn op eToro (NL/EU). Controleer etoro.com voor updates.
_ETORO_TRADABLE = {
    "BTC", "ETH", "XRP", "LTC", "BCH", "ETC",
    "ADA", "SOL", "DOT", "AVAX", "ATOM", "BNB", "TRX", "XLM",
    "ALGO", "VET", "HBAR", "XTZ", "NEAR", "FTM", "ICP", "FLOW",
    "APT", "SUI", "TON", "INJ", "SEI",
    "MATIC", "OP", "ARB",
    "LINK", "UNI", "AAVE", "COMP", "MKR", "SNX", "YFI", "CRV", "SUSHI",
    "1INCH", "ZRX", "GRT", "ENJ", "MANA", "SAND",
    "AXS", "CHZ", "GALA", "IMX",
    "DOGE", "SHIB", "PEPE",
    "FET", "RNDR",
    "FIL", "THETA", "BAT",
}


def haal_coingecko_markten(per_page: int = 250) -> list[dict]:
    """Eén CoinGecko-call met markt- en momentumdata voor de top-coins."""
    data = _http_get(
        f"{COINGECKO_BASE}/coins/markets",
        params={"vs_currency": "usd", "order": "market_cap_desc",
                "per_page": per_page, "page": 1,
                "price_change_percentage": "24h,7d,30d"},
    )
    return data if isinstance(data, list) else []


def _kans_score(c: dict) -> float:
    """Heuristische 'opwaarts potentieel'-score voor een coin uit de marktdata."""
    p7 = c.get("price_change_percentage_7d_in_currency") or 0
    p30 = c.get("price_change_percentage_30d_in_currency") or 0
    p24 = c.get("price_change_percentage_24h_in_currency") or 0
    vol = c.get("total_volume") or 0
    mcap = c.get("market_cap") or 1
    rank = c.get("market_cap_rank") or 999
    ath_chg = c.get("ath_change_percentage") or 0   # negatief = onder ATH

    score = 0.0
    score += max(min(p7, 40), -20) * 1.2          # momentum 7d (sterkste gewicht)
    score += max(min(p30, 80), -30) * 0.5         # trend 30d
    volratio = (vol / mcap) if mcap else 0
    score += min(volratio * 100, 25)              # handelsactiviteit
    if ath_chg < 0:
        score += min(abs(ath_chg) * 0.15, 20)     # herstelruimte t.o.v. ATH
    if rank > 50:
        score += 10                               # kleinere cap = meer ruimte
    if rank > 120:
        score += 5
    if p24 > 35:
        score -= 25                               # al hard gepompt vandaag
    elif p24 > 20:
        score -= 10
    return score


def _waarom_kans(c: dict) -> list[str]:
    """Bouwt de uitleg 'waarom potentiële grote winst'."""
    p7 = c.get("price_change_percentage_7d_in_currency") or 0
    p30 = c.get("price_change_percentage_30d_in_currency") or 0
    vol = c.get("total_volume") or 0
    mcap = c.get("market_cap") or 1
    rank = c.get("market_cap_rank") or 999
    ath_chg = c.get("ath_change_percentage") or 0
    r = []
    if p7 >= 12:
        r.append(f"sterk momentum: +{p7:.0f}% in 7 dagen")
    elif p7 >= 4:
        r.append(f"opwaarts: +{p7:.0f}% in 7 dagen")
    if p30 >= 25:
        r.append(f"+{p30:.0f}% over 30 dagen — trend intact")
    if mcap and vol / mcap >= 0.12:
        r.append("hoge handelsactiviteit t.o.v. marktcap (groeiende interesse)")
    if ath_chg <= -55:
        r.append(f"{abs(ath_chg):.0f}% onder all-time high — veel herstelruimte")
    if rank >= 60:
        r.append(f"kleinere marktcap (#{rank}) — meer ruimte om te groeien")
    if not r:
        r.append("solide combinatie van momentum, liquiditeit en marktpositie")
    return r


def _kans_niveaus(symbool: str, prijs_fallback: float) -> dict:
    """
    Probeert ATR-gebaseerde stop/take-profit via candle-data; valt anders terug
    op een percentage-richtlijn. Geeft ook technische bevestiging mee indien mogelijk.
    """
    df, _ = haal_data(symbool)
    if df is not None and len(df) > ATR_PERIODE + 2:
        close = df["close"]
        prijs = float(close.iloc[-1])
        atr = float(bereken_atr(df).iloc[-1])
        if math.isnan(atr) or atr <= 0:
            atr = prijs * 0.04
        ema20 = float(bereken_ema(close, EMA_KORT).iloc[-1])
        ema50 = float(bereken_ema(close, EMA_LANG).iloc[-1])
        macd_l, sig_l, _ = bereken_macd(close)
        stop = prijs - ATR_STOP_MULTIPLIER * atr
        tp = prijs + REWARD_MULTIPLIER * atr
        return {
            "prijs": prijs, "entry": prijs, "stop_loss": stop, "take_profit": tp,
            "rr": round((tp - prijs) / (prijs - stop), 1) if prijs > stop else 2.0,
            "rsi": round(float(bereken_rsi(close).iloc[-1])),
            "trend_op": ema20 > ema50,
            "macd_bullish": float(macd_l.iloc[-1]) > float(sig_l.iloc[-1]),
            "methode": "ATR (candle-data)", "heeft_technisch": True,
        }
    # Fallback: geen candle-data -> percentage-richtlijn (R/R ~1:2).
    prijs = float(prijs_fallback or 0)
    return {
        "prijs": prijs, "entry": prijs,
        "stop_loss": prijs * 0.875, "take_profit": prijs * 1.25, "rr": 2.0,
        "rsi": None, "trend_op": None, "macd_bullish": None,
        "methode": "richtlijn (−12,5% / +25%)", "heeft_technisch": False,
    }


def zoek_kansen(top_n: int = 10, verbose: bool = False, alleen_etoro: bool = True) -> list[dict]:
    """Scant de bredere markt (CoinGecko) op coins met groot winstpotentieel.

    alleen_etoro=True (standaard) toont uitsluitend coins die op eToro verhandelbaar
    zijn, zodat je altijd direct kunt handelen op wat de scanner aanbeveelt.
    """
    markten = haal_coingecko_markten()
    kandidaten = []
    for c in markten:
        sym = (c.get("symbol") or "").upper()
        rank = c.get("market_cap_rank") or 999
        vol = c.get("total_volume") or 0
        if not sym or sym in _UITSLUITEN:
            continue
        if alleen_etoro and sym not in _ETORO_TRADABLE:
            continue
        if rank < 12 or rank > 260:        # geen mega-caps, geen illiquide staart
            continue
        if vol < 15_000_000:               # minimale liquiditeit
            continue
        c["_score"] = _kans_score(c)
        kandidaten.append(c)

    kandidaten.sort(key=lambda x: x["_score"], reverse=True)

    resultaten = []
    for c in kandidaten:
        if len(resultaten) >= top_n:
            break
        sym = (c.get("symbol") or "").upper()
        niveaus = _kans_niveaus(sym, c.get("current_price"))
        resultaten.append({
            "symbool": sym,
            "naam": c.get("name", sym),
            "rang": c.get("market_cap_rank"),
            "marktcap": c.get("market_cap"),
            "p24": round(c.get("price_change_percentage_24h_in_currency") or 0, 1),
            "p7": round(c.get("price_change_percentage_7d_in_currency") or 0, 1),
            "p30": round(c.get("price_change_percentage_30d_in_currency") or 0, 1),
            "redenen": _waarom_kans(c),
            **niveaus,
        })
        time.sleep(0.2)
    return resultaten


# ---------------------------------------------------------------------------
# WEERGAVE
# ---------------------------------------------------------------------------

def _fmt(p: float) -> str:
    """Prijs netjes formatteren afhankelijk van grootte."""
    if p >= 100:
        return f"${p:,.2f}"
    if p >= 1:
        return f"${p:,.3f}"
    return f"${p:,.5f}"


def score_uitleg() -> str:
    """Korte Nederlandse uitleg van wat de score (0-100) betekent."""
    return (
        "Wat betekent de score (0-100)?\n"
        "De score telt bullish signalen bij elkaar op, hoe hoger, hoe sterker de opzet:\n"
        "  * +25  opwaartse trend (EMA20 boven EMA50)\n"
        "  * +15  prijs boven EMA20 (momentum bevestigd)\n"
        "  * +20  RSI in gezonde zone (45-68)  /  +10  RSI oversold (<35, mogelijke bounce)\n"
        "  * +20  MACD bullish (+5 extra als het histogram positief is)\n"
        "  * +15  volume spike (>=1.5x)  /  +8  verhoogd volume (>=1.2x)\n"
        f"Drempels: score >= {KOOP_SCORE} geeft signaal 'KOOP' (anders 'WATCH'); "
        f"score >= {HIGH_CONVICTION_SCORE} met trend + MACD + volume geeft 'HIGH CONVICTION'.\n"
        "Let op: dit is een technisch signaal, geen financieel advies. "
        "Controleer altijd de live prijs op eToro."
    )


def print_tabel(trades: list[dict]) -> None:
    """Print een nette tabel met de trades."""
    if not trades:
        print("Geen trades gevonden die aan de criteria voldoen (R/R >= 1:2).")
        return

    if _console:
        tabel = Table(title="Crypto Trade-kansen (gerangschikt)", show_lines=False)
        tabel.add_column("Asset", style="bold cyan")
        tabel.add_column("Entry Zone", justify="right")
        tabel.add_column("Stop Loss", justify="right", style="red")
        tabel.add_column("Take Profit", justify="right", style="green")
        tabel.add_column("R/R", justify="right")
        tabel.add_column("Score", justify="right")
        tabel.add_column("Signaal")
        for t in trades:
            sig = t["signaal"]
            if t["high_conviction"]:
                sig = "🚀 HIGH CONVICTION"
            tabel.add_row(
                t["symbool"],
                f"{_fmt(t['entry_laag'])}–{_fmt(t['entry_hoog'])}",
                _fmt(t["stop_loss"]),
                _fmt(t["take_profit"]),
                f"1:{t['rr']:.1f}",
                f"{t['score']}",
                sig,
            )
        _console.print(tabel)
        _console.print(f"\n[dim]{score_uitleg()}[/dim]")
    else:
        print(f"{'Asset':<8}{'Entry':<14}{'Stop':<12}{'TP':<12}{'R/R':<7}{'Score':<7}Signaal")
        for t in trades:
            sig = "HIGH CONVICTION" if t["high_conviction"] else t["signaal"]
            print(f"{t['symbool']:<8}{_fmt(t['entry']):<14}{_fmt(t['stop_loss']):<12}"
                  f"{_fmt(t['take_profit']):<12}1:{t['rr']:<5.1f}{t['score']:<7}{sig}")
        print(f"\n{score_uitleg()}")


def main():
    nu = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    if _console:
        _console.print(f"\n[bold]Crypto Analyzer[/bold] — {nu}\n")
    else:
        print(f"\nCrypto Analyzer — {nu}\n")

    trades = analyseer_markt(verbose=True)
    print()
    print_tabel(trades)

    hc = [t for t in trades if t["high_conviction"]]
    if hc:
        print()
        for t in hc:
            print(f"🚀 HIGH CONVICTION: {t['symbool']} (score {t['score']}) — "
                  f"{', '.join(t['redenen'])}")
    return trades


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAfgebroken door gebruiker.")
        sys.exit(1)
