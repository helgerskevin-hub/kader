#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
app.py
======
Gebruiksvriendelijke webapp (lokaal) bovenop de bestaande analyse-modules.

Functies:
  1. eToro traders toevoegen via een formulier -> automatisch GROEN/GEEL/ROOD
     oordeel + aanbevolen Copy Stop Loss.
  2. EEN knop "Start Analyse" -> haalt verse marktdata op en toont een lijst
     met concrete trades incl. Entry / Stop Loss / Take Profit.
  3. "Mijn Trades": voeg met een paar klikken je eigen trades toe; de app houdt
     ze bij met live prijzen en geeft per trade een VERKOOP / HOUD / WINST-tip.

Geen extra installatie nodig: gebruikt alleen de Python-standaardbibliotheek
plus de pakketten die al voor de analyzer geinstalleerd zijn (requests, pandas).

Starten:
    python app.py
Daarna opent automatisch http://localhost:8765 in je browser.
"""

from __future__ import annotations

import json
import os
import threading
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import crypto_analyzer as ca
import etoro_auditor as ea
import coin_info as ci

HIER = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(HIER)          # src/ -> projectmap
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
TRADERS_FILE = os.path.join(DATA_DIR, "traders.json")
PORTFOLIO_FILE = os.path.join(DATA_DIR, "portfolio.json")
POORT = 8765

os.makedirs(DATA_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Opslag (simpele JSON-bestanden)
# ---------------------------------------------------------------------------

def _laad(pad: str, standaard):
    try:
        with open(pad, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return standaard


def _bewaar(pad: str, data) -> None:
    with open(pad, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Hulpfuncties
# ---------------------------------------------------------------------------

def _parse_getallenlijst(tekst: str) -> list[float]:
    """'3.1, -1.2, 5.4' -> [3.1, -1.2, 5.4]."""
    if isinstance(tekst, list):
        return [float(x) for x in tekst]
    out = []
    for stuk in str(tekst).replace(";", ",").split(","):
        stuk = stuk.strip().replace("%", "")
        if not stuk:
            continue
        try:
            out.append(float(stuk))
        except ValueError:
            pass
    return out


def _parse_portfolio(tekst) -> dict:
    """'BTC:40, ETH:30, Cash:30' -> {'BTC':40,...}."""
    if isinstance(tekst, dict):
        return {k: float(v) for k, v in tekst.items()}
    out = {}
    for stuk in str(tekst).replace(";", ",").split(","):
        if ":" not in stuk:
            continue
        sym, pct = stuk.split(":", 1)
        sym = sym.strip().upper()
        try:
            out[sym] = float(pct.strip().replace("%", ""))
        except ValueError:
            pass
    return out


def _live_indicatoren(symbool: str) -> dict | None:
    """
    Haalt verse data voor EEN symbool en berekent de huidige prijs + indicatoren.
    Werkt ook voor coins die niet aan de R/R-eis voldoen (anders dan analyseer_coin).
    """
    df, bron = ca.haal_data(symbool)
    if df is None or len(df) < ca.EMA_LANG + 5:
        return None
    close = df["close"]
    prijs = float(close.iloc[-1])
    rsi = ca.bereken_rsi(close)
    ema20 = ca.bereken_ema(close, ca.EMA_KORT)
    ema50 = ca.bereken_ema(close, ca.EMA_LANG)
    macd_lijn, signaal_lijn, hist = ca.bereken_macd(close)
    atr = ca.bereken_atr(df)
    return {
        "prijs": prijs,
        "bron": bron,
        "rsi": float(rsi.iloc[-1]),
        "ema20": float(ema20.iloc[-1]),
        "ema50": float(ema50.iloc[-1]),
        "macd_bullish": float(macd_lijn.iloc[-1]) > float(signaal_lijn.iloc[-1]),
        "atr": float(atr.iloc[-1]) if atr.iloc[-1] == atr.iloc[-1] else prijs * 0.03,
    }


def _advies_voor_trade(trade: dict) -> dict:
    """Geeft een VERKOOP / HOUD / WINST-advies voor een open trade."""
    sym = trade["symbool"].upper()
    entry = float(trade["entry"])
    stop = float(trade["stop_loss"])
    target = float(trade["take_profit"])
    aantal = float(trade.get("aantal", 0) or 0)

    ind = _live_indicatoren(sym)
    if ind is None:
        return {
            **trade,
            "prijs": None,
            "pnl_pct": None,
            "pnl_waarde": None,
            "advies": "ONBEKEND",
            "advies_kleur": "grijs",
            "uitleg": f"Geen marktdata gevonden voor {sym}. Controleer het symbool.",
        }

    prijs = ind["prijs"]
    pnl_pct = (prijs - entry) / entry * 100 if entry else 0.0
    pnl_waarde = (prijs - entry) * aantal if aantal else None

    risico = entry - stop
    naar_target = target - entry
    # Hoeveel van de weg naar het doel is afgelegd (0-1+).
    voortgang = (prijs - entry) / naar_target if naar_target > 0 else 0.0

    redenen = []
    advies, kleur = "HOUD", "blauw"

    if prijs <= stop:
        advies, kleur = "VERKOOP NU", "rood"
        redenen.append(f"Stop loss geraakt (prijs {ca._fmt(prijs)} ≤ stop {ca._fmt(stop)}).")
    elif prijs >= target:
        advies, kleur = "NEEM WINST", "groen"
        redenen.append(f"Take profit bereikt (prijs {ca._fmt(prijs)} ≥ doel {ca._fmt(target)}).")
    else:
        # Tussenliggende tips.
        trend_kapot = ind["ema20"] < ind["ema50"]
        if voortgang >= 0.7:
            advies, kleur = "OVERWEEG WINST", "groen"
            redenen.append(f"Bijna bij je doel ({voortgang*100:.0f}% van de weg). "
                           "Overweeg (deel)winst of trail je stop omhoog.")
        elif ind["rsi"] >= 75:
            advies, kleur = "OVERWEEG WINST", "groen"
            redenen.append(f"RSI overbought ({ind['rsi']:.0f}) — winst kan keren; "
                           "overweeg (deel)winst.")
        elif trend_kapot and prijs < entry:
            advies, kleur = "LET OP / ZWAKTE", "oranje"
            redenen.append("Trend is gedraaid (EMA20 < EMA50) én je staat op verlies. "
                           "Overweeg eerder uit te stappen dan de stop.")
        elif not ind["macd_bullish"] and pnl_pct > 0:
            advies, kleur = "HOUD (let op)", "oranje"
            redenen.append("Momentum zwakt af (MACD bearish), maar je staat op winst. "
                           "Houd je stop strak.")
        else:
            advies, kleur = "HOUD VAST", "blauw"
            redenen.append("Trade ontwikkelt zich normaal binnen plan. Niets doen.")

        # Trailing-stop suggestie zodra >1R winst.
        if risico > 0 and (prijs - entry) >= risico and prijs > stop:
            nieuwe_stop = max(stop, entry)
            if nieuwe_stop > stop:
                redenen.append(f"💡 Tip: verschuif je stop naar break-even "
                               f"({ca._fmt(entry)}) — winst is nu groter dan je risico.")

    return {
        **trade,
        "prijs": prijs,
        "rsi": round(ind["rsi"]),
        "macd_bullish": ind["macd_bullish"],
        "ema20": ind["ema20"],
        "ema50": ind["ema50"],
        "bron": ind["bron"],
        "pnl_pct": round(pnl_pct, 2),
        "pnl_waarde": round(pnl_waarde, 2) if pnl_waarde is not None else None,
        "voortgang_pct": round(max(0, min(voortgang, 1.2)) * 100),
        "advies": advies,
        "advies_kleur": kleur,
        "uitleg": " ".join(redenen),
    }


# ---------------------------------------------------------------------------
# API-logica
# ---------------------------------------------------------------------------

def api_analyse() -> dict:
    trades = ca.analyseer_markt(verbose=False)
    schoon = []
    for t in trades:
        oordeel = ci.genereer_koopadvies(
            score=t["score"], rsi=t["rsi"],
            trend_op=t["ema20"] > t["ema50"], macd_bullish=t["macd_bullish"],
            volume_ratio=t.get("volume_ratio", 1.0),
            high_conviction=t["high_conviction"])
        schoon.append({
            "symbool": t["symbool"],
            "prijs": t["prijs"],
            "entry": t["entry"],
            "entry_laag": t["entry_laag"],
            "entry_hoog": t["entry_hoog"],
            "stop_loss": t["stop_loss"],
            "take_profit": t["take_profit"],
            "rr": round(t["rr"], 1),
            "score": t["score"],
            "rsi": round(t["rsi"]),
            "signaal": t["signaal"],
            "high_conviction": t["high_conviction"],
            "redenen": t["redenen"],
            "bron": t["bron"],
            "info": ci.info_voor(t["symbool"]),
            "oordeel": oordeel,
        })
    return {"trades": schoon,
            "tijd": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}


def api_kansen() -> dict:
    """Tab 3: scant de bredere markt op coins met groot winstpotentieel."""
    kansen = ca.zoek_kansen(top_n=10)
    uit = []
    for k in kansen:
        if k.get("heeft_technisch"):
            oordeel = ci.genereer_koopadvies(
                rsi=k.get("rsi") or 50, trend_op=bool(k.get("trend_op")),
                macd_bullish=bool(k.get("macd_bullish")))
        else:
            oordeel = {"label": "Speculatief", "kleur": "oranje",
                       "uitleg": "Geen candle-data — niveaus zijn een richtlijn. Hoog risico."}
        uit.append({**k, "info": ci.info_voor(k["symbool"]), "oordeel": oordeel})
    return {"kansen": uit,
            "tijd": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}


def _niveaus_voor_symbool(sym: str) -> dict | None:
    """Berekent voor een willekeurig symbool live entry/stop/take-profit (ATR-gebaseerd)."""
    ind = _live_indicatoren(sym)
    if ind is None:
        return None
    entry = ind["prijs"]
    atr = ind["atr"]
    risk = ca.ATR_STOP_MULTIPLIER * atr
    stop = entry - risk
    tp = entry + ca.REWARD_MULTIPLIER * atr
    rr = (tp - entry) / risk if risk > 0 else 0.0
    return {
        "prijs": entry,
        "entry": entry,
        "stop_loss": stop,
        "take_profit": tp,
        "rr": round(rr, 1),
        "rsi": round(ind["rsi"]),
        "trend_op": ind["ema20"] > ind["ema50"],
        "bron": ind["bron"],
    }


def api_copytrades() -> dict:
    """Per opgeslagen trader: hun posities mét live entry/stop/take-profit om te kopiëren."""
    traders = _laad(TRADERS_FILE, [])
    uit = []
    for tr in traders:
        try:
            b = ea.beoordeel_trader({
                "naam": tr["naam"],
                "maandrendementen": tr.get("maandrendementen", []),
                "max_drawdown": tr.get("max_drawdown", 0),
                "jaarrendement": tr.get("jaarrendement"),
                "risk_score": tr.get("risk_score", 4),
                "portfolio": tr.get("portfolio", {}),
            })
            oordeel, csl, score = b["oordeel"], b["csl"], b["totaalscore"]
        except Exception:
            oordeel, csl, score = "?", 0, 0

        holdings = []
        for sym, pct in (tr.get("portfolio", {}) or {}).items():
            symu = sym.upper()
            if symu in ("CASH", "USD", "USDT", "USDC"):
                holdings.append({"symbool": symu, "allocatie": pct, "cash": True,
                                 "info": ci.info_voor(symu)})
                continue
            niv = _niveaus_voor_symbool(symu)
            holdings.append({"symbool": symu, "allocatie": pct, "cash": False,
                             "info": ci.info_voor(symu),
                             **(niv or {"prijs": None})})
        holdings.sort(key=lambda h: h.get("allocatie", 0), reverse=True)

        uit.append({"id": tr.get("id"), "naam": tr.get("naam", "?"),
                    "oordeel": oordeel, "csl": csl, "score": score,
                    "holdings": holdings})
    return {"traders": uit,
            "tijd": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}


def api_traders_lijst() -> dict:
    traders = _laad(TRADERS_FILE, [])
    audits = []
    for tr in traders:
        try:
            b = ea.beoordeel_trader({
                "naam": tr["naam"],
                "maandrendementen": tr.get("maandrendementen", []),
                "max_drawdown": tr.get("max_drawdown", 0),
                "jaarrendement": tr.get("jaarrendement"),
                "risk_score": tr.get("risk_score", 4),
                "portfolio": tr.get("portfolio", {}),
            })
            audits.append({
                "id": tr["id"],
                "naam": b["naam"],
                "oordeel": b["oordeel"],
                "kleur": b["oordeel"],
                "score": b["totaalscore"],
                "csl": b["csl"],
                "consistentie": b["consistentie"],
                "risico": b["risico"],
                "portfolio": b["portfolio"],
                "invoer": tr,
            })
        except Exception as e:
            audits.append({"id": tr.get("id"), "naam": tr.get("naam", "?"),
                           "oordeel": "FOUT", "kleur": "FOUT", "score": 0,
                           "csl": 0, "uitleg": str(e)})
    return {"traders": audits}


def api_trader_toevoegen(body: dict) -> dict:
    traders = _laad(TRADERS_FILE, [])
    nieuw = {
        "id": str(int(datetime.now().timestamp() * 1000)),
        "naam": body.get("naam", "Naamloos").strip() or "Naamloos",
        "maandrendementen": _parse_getallenlijst(body.get("maandrendementen", "")),
        "max_drawdown": float(body.get("max_drawdown", 0) or 0),
        "risk_score": int(float(body.get("risk_score", 4) or 4)),
        "jaarrendement": (float(body["jaarrendement"])
                          if body.get("jaarrendement") not in (None, "",) else None),
        "portfolio": _parse_portfolio(body.get("portfolio", "")),
    }
    traders.append(nieuw)
    _bewaar(TRADERS_FILE, traders)
    return api_traders_lijst()


def api_trader_verwijderen(tid: str) -> dict:
    traders = [t for t in _laad(TRADERS_FILE, []) if t.get("id") != tid]
    _bewaar(TRADERS_FILE, traders)
    return api_traders_lijst()


def _portfolio_samenvatting(beoordeeld: list[dict]) -> dict:
    """Totalen over alle open posities: inleg, huidige waarde, winst/verlies."""
    inleg = waarde_nu = 0.0
    met_waarde = 0          # posities met een aantal (tellen mee voor €-totalen)
    actie_nodig = 0         # posities die een VERKOOP/WINST/LET OP-tip hebben
    for t in beoordeeld:
        aantal = float(t.get("aantal") or 0)
        prijs = t.get("prijs")
        entry = float(t.get("entry") or 0)
        if aantal > 0 and prijs is not None and entry > 0:
            inleg += entry * aantal
            waarde_nu += prijs * aantal
            met_waarde += 1
        advies = (t.get("advies") or "")
        if any(k in advies for k in ("VERKOOP", "WINST", "LET OP", "ZWAKTE")):
            actie_nodig += 1
    pnl = waarde_nu - inleg
    pnl_pct = (pnl / inleg * 100) if inleg > 0 else None
    return {
        "open_posities": len(beoordeeld),
        "posities_met_aantal": met_waarde,
        "actie_nodig": actie_nodig,
        "inleg": round(inleg, 2),
        "waarde_nu": round(waarde_nu, 2),
        "pnl": round(pnl, 2),
        "pnl_pct": round(pnl_pct, 2) if pnl_pct is not None else None,
    }


def api_portfolio_lijst() -> dict:
    trades = _laad(PORTFOLIO_FILE, [])
    open_trades = [t for t in trades if t.get("status", "open") == "open"]
    gesloten = [t for t in trades if t.get("status") == "gesloten"]
    beoordeeld = [_advies_voor_trade(t) for t in open_trades]
    return {"open": beoordeeld, "gesloten": gesloten,
            "samenvatting": _portfolio_samenvatting(beoordeeld),
            "tijd": datetime.now(timezone.utc).strftime("%H:%M UTC")}


def api_trade_toevoegen(body: dict) -> dict:
    trades = _laad(PORTFOLIO_FILE, [])
    nieuw = {
        "id": str(int(datetime.now().timestamp() * 1000)),
        "symbool": body.get("symbool", "").strip().upper(),
        "entry": float(body.get("entry", 0) or 0),
        "stop_loss": float(body.get("stop_loss", 0) or 0),
        "take_profit": float(body.get("take_profit", 0) or 0),
        "aantal": float(body.get("aantal", 0) or 0),
        "datum": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "status": "open",
    }
    trades.append(nieuw)
    _bewaar(PORTFOLIO_FILE, trades)
    return api_portfolio_lijst()


def api_trade_sluiten(tid: str) -> dict:
    trades = _laad(PORTFOLIO_FILE, [])
    for t in trades:
        if t.get("id") == tid:
            t["status"] = "gesloten"
            t["gesloten_op"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    _bewaar(PORTFOLIO_FILE, trades)
    return api_portfolio_lijst()


def api_trade_verwijderen(tid: str) -> dict:
    trades = [t for t in _laad(PORTFOLIO_FILE, []) if t.get("id") != tid]
    _bewaar(PORTFOLIO_FILE, trades)
    return api_portfolio_lijst()


# ---------------------------------------------------------------------------
# HTTP-handler
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # stiller in de terminal
        pass

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self):
        body = HTML.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        lengte = int(self.headers.get("Content-Length", 0) or 0)
        if not lengte:
            return {}
        try:
            return json.loads(self.rfile.read(lengte).decode("utf-8"))
        except Exception:
            return {}

    def do_GET(self):
        pad = urlparse(self.path).path
        try:
            if pad in ("/", "/index.html"):
                return self._html()
            if pad == "/api/traders":
                return self._json(api_traders_lijst())
            if pad == "/api/trades":
                return self._json(api_portfolio_lijst())
            self._json({"fout": "onbekend pad"}, 404)
        except Exception as e:
            self._json({"fout": str(e)}, 500)

    def do_POST(self):
        pad = urlparse(self.path).path
        try:
            body = self._body()
            if pad == "/api/analyse":
                return self._json(api_analyse())
            if pad == "/api/kansen":
                return self._json(api_kansen())
            if pad == "/api/copytrades":
                return self._json(api_copytrades())
            if pad == "/api/traders":
                return self._json(api_trader_toevoegen(body))
            if pad == "/api/traders/delete":
                return self._json(api_trader_verwijderen(body.get("id", "")))
            if pad == "/api/trades":
                return self._json(api_trade_toevoegen(body))
            if pad == "/api/trades/close":
                return self._json(api_trade_sluiten(body.get("id", "")))
            if pad == "/api/trades/delete":
                return self._json(api_trade_verwijderen(body.get("id", "")))
            self._json({"fout": "onbekend pad"}, 404)
        except Exception as e:
            self._json({"fout": str(e)}, 500)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", POORT), Handler)
    url = f"http://localhost:{POORT}"
    print("=" * 60)
    print("  📊 Crypto Copy-Trading App draait!")
    print(f"  Open in je browser:  {url}")
    print("  Stoppen: druk Ctrl+C in dit venster.")
    print("=" * 60)
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nApp gestopt.")
        server.shutdown()


# HTML wordt onderaan gedefinieerd (in app_ui.py geladen) -------------------
from app_ui import HTML  # noqa: E402

if __name__ == "__main__":
    main()
