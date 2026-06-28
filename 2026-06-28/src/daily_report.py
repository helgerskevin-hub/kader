#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
daily_report.py
===============
Combineert de marktanalyse (crypto_analyzer) met de eToro trader-audit
(etoro_auditor) en schrijft een dagrapport: daily_trades_JJJJ-MM-DD.md

Het rapport bevat:
  - Een tabel met concrete trades:
        Asset | Entry Zone | Stop Loss | Take Profit | R/R Ratio | Signaal
  - HIGH CONVICTION-markeringen.
  - De eToro trader-audits (GROEN/GEEL/ROOD + aanbevolen Copy Stop Loss).
  - Uitleg en disclaimer.

Gebruik:
    python daily_report.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

import crypto_analyzer as ca
import etoro_auditor as ea

# Rapporten worden in de map reports/ naast src/ geschreven.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORTS_DIR = os.path.join(PROJECT_ROOT, "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

try:
    from rich.console import Console
    _console = Console()
except Exception:
    _console = None

_fmt = ca._fmt


def bouw_markdown(trades: list[dict], audits: list[dict], datum: str, tijd: str) -> str:
    r: list[str] = []
    r.append(f"# 📊 Dagelijks Crypto Copy-Trading Rapport — {datum}")
    r.append("")
    r.append(f"*Gegenereerd: {tijd} • Data: Binance + CoinGecko (gratis publieke API's)*")
    r.append("")
    r.append("> ⚠️ **Disclaimer:** Dit is geen financieel advies. Alle trades zijn "
             "technische signalen ter ondersteuning van je eigen onderzoek. "
             "Handel nooit met geld dat je niet kunt missen. **Stop loss en take "
             "profit zijn altijd verplicht.**")
    r.append("")

    # --- HIGH CONVICTION sectie -------------------------------------------
    hc = [t for t in trades if t.get("high_conviction")]
    if hc:
        r.append("## 🚀 HIGH CONVICTION kansen")
        r.append("")
        for t in hc:
            r.append(f"- **{t['symbool']}** (score {t['score']}/100) — "
                     f"{', '.join(t['redenen'])}")
        r.append("")

    # --- Trade-tabel ------------------------------------------------------
    r.append("## 🎯 Trade-kansen van vandaag")
    r.append("")
    if trades:
        r.append("| Asset | Entry Zone | Stop Loss | Take Profit | R/R Ratio | Signaal |")
        r.append("|-------|-----------|-----------|-------------|-----------|---------|")
        for t in trades:
            signaal = "🚀 HIGH CONVICTION" if t.get("high_conviction") else t["signaal"]
            entry_zone = f"{_fmt(t['entry_laag'])} – {_fmt(t['entry_hoog'])}"
            r.append(
                f"| **{t['symbool']}** | {entry_zone} | {_fmt(t['stop_loss'])} | "
                f"{_fmt(t['take_profit'])} | 1:{t['rr']:.1f} | {signaal} |"
            )
        r.append("")

        # Detail per trade
        r.append("### 🔍 Detail per trade")
        r.append("")
        for t in trades:
            r.append(f"**{t['symbool']}** — score {t['score']}/100 "
                     f"({'🚀 HIGH CONVICTION' if t.get('high_conviction') else t['signaal']})")
            r.append(f"- Huidige prijs: {_fmt(t['prijs'])} • Databron: {t['bron']}")
            r.append(f"- RSI: {t['rsi']:.0f} • EMA20: {_fmt(t['ema20'])} • "
                     f"EMA50: {_fmt(t['ema50'])} • MACD: "
                     f"{'bullish' if t['macd_bullish'] else 'bearish'} • "
                     f"Volume: {t['volume_ratio']:.1f}x gemiddeld")
            risico_pct = 100 * (t['entry'] - t['stop_loss']) / t['entry']
            winst_pct = 100 * (t['take_profit'] - t['entry']) / t['entry']
            r.append(f"- **Stop Loss:** {_fmt(t['stop_loss'])} (−{risico_pct:.1f}%, "
                     f"ATR-gebaseerd) • **Take Profit:** {_fmt(t['take_profit'])} "
                     f"(+{winst_pct:.1f}%)")
            r.append(f"- Signalen: {', '.join(t['redenen'])}")
            r.append("")
    else:
        r.append("_Geen trades voldeden vandaag aan de criteria (min. R/R 1:2). "
                 "Markt mogelijk richtingloos — geduld is ook een positie._")
        r.append("")

    # --- eToro audits -----------------------------------------------------
    r.append("## 👥 eToro Trader Audits")
    r.append("")
    if audits:
        r.append("| Trader | Oordeel | Score | Aanbevolen Copy Stop Loss |")
        r.append("|--------|---------|-------|---------------------------|")
        kleur_emoji = {"GROEN": "🟢", "GEEL": "🟡", "ROOD": "🔴"}
        for b in audits:
            r.append(f"| {b['naam']} | {kleur_emoji.get(b['oordeel'], '')} "
                     f"{b['oordeel']} | {b['totaalscore']}/100 | **{b['csl']}%** |")
        r.append("")
        for b in audits:
            r.append(f"### {kleur_emoji.get(b['oordeel'], '')} {b['naam']} — "
                     f"{b['oordeel']} ({b['totaalscore']}/100)")
            r.append(f"- **Consistentie** ({b['consistentie']['score']}/100): "
                     f"{b['consistentie']['opmerking']}")
            r.append(f"- **Risico/Return** ({b['risico']['score']}/100): "
                     f"jaarrendement {b['risico']['jaarrendement']}% vs. drawdown "
                     f"{b['risico']['max_drawdown']}% — {b['risico']['opmerking']}")
            r.append(f"- **Portfolio** ({b['portfolio']['score']}/100): "
                     f"{b['portfolio']['opmerking']}")
            r.append(f"- ➡️ **Aanbevolen Copy Stop Loss: {b['csl']}%**")
            r.append("")
    else:
        r.append("_Geen eToro traders ingevuld. Bewerk de lijst `TRADERS` in "
                 "`etoro_auditor.py` en draai opnieuw._")
        r.append("")

    # --- Uitleg -----------------------------------------------------------
    r.append("## 📖 Hoe lees je dit rapport?")
    r.append("")
    r.append("- **Entry Zone** — het prijsgebied waarin instappen technisch zinvol is.")
    r.append("- **Stop Loss** — automatisch verkooppunt om verlies te beperken. "
             "Dynamisch berekend met de ATR (volatiliteit), niet met een vast %. "
             "Volatiele coins krijgen dus meer ruimte, rustige coins een strakkere stop.")
    r.append("- **Take Profit** — doelprijs om winst te nemen. Altijd minstens "
             "2× de afstand van je stop loss (R/R 1:2), zodat één winnaar twee "
             "verliezers compenseert.")
    r.append("- **R/R Ratio** — Risk/Reward. 1:2 betekent: €1 risico voor €2 winstpotentieel.")
    r.append("- **Copy Stop Loss (CSL)** — op eToro stel je dit in bij het kopiëren "
             "van een trader; het beschermt je inleg als die trader een slechte periode heeft.")
    r.append("")
    r.append("---")
    r.append("*Gebouwd voor persoonlijk gebruik. Controleer altijd zelf de live "
             "koersen op eToro voordat je een order plaatst.*")
    r.append("")
    return "\n".join(r)


def genereer_rapport(verbose: bool = True) -> str:
    nu_dt = datetime.now(timezone.utc)
    datum = nu_dt.strftime("%Y-%m-%d")
    tijd = nu_dt.strftime("%Y-%m-%d %H:%M UTC")

    if _console:
        _console.print(f"\n[bold]📊 Dagrapport genereren — {datum}[/bold]\n")
    else:
        print(f"\nDagrapport genereren — {datum}\n")

    # 1. Marktanalyse
    if _console:
        _console.print("[cyan]Stap 1/3:[/cyan] Marktdata ophalen & analyseren...")
    trades = ca.analyseer_markt(verbose=verbose)

    # 2. eToro audits
    if _console:
        _console.print("[cyan]Stap 2/3:[/cyan] eToro trader-audits uitvoeren...")
    try:
        audits = ea.audit_alle()
    except Exception as e:
        print(f"  ! eToro audit overgeslagen: {e}")
        audits = []

    # 3. Rapport schrijven
    if _console:
        _console.print("[cyan]Stap 3/3:[/cyan] Markdown-rapport schrijven...")
    md = bouw_markdown(trades, audits, datum, tijd)

    bestandsnaam = os.path.join(REPORTS_DIR, f"daily_trades_{datum}.md")
    with open(bestandsnaam, "w", encoding="utf-8") as f:
        f.write(md)

    # Toon ook in terminal
    print()
    ca.print_tabel(trades)
    print()
    if _console:
        _console.print(f"[bold green]✓ Rapport opgeslagen:[/bold green] {bestandsnaam}")
    else:
        print(f"Rapport opgeslagen: {bestandsnaam}")
    return bestandsnaam


if __name__ == "__main__":
    try:
        genereer_rapport()
    except KeyboardInterrupt:
        print("\nAfgebroken door gebruiker.")
        sys.exit(1)
