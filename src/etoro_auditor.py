#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
etoro_auditor.py
================
Beoordeelt een eToro "Popular Investor" (copy-trade kandidaat) op basis van
stats die je HANDMATIG van hun profiel plakt. Analyseert:

  - Consistentie  (hoeveel maanden positief, spreiding van rendementen)
  - Drawdown/return-ratio  (risico vs. beloning)
  - Portfolio-concentratie & correlatie  (te veel in samenhangende altcoins?)

Geeft een GROEN / GEEL / ROOD oordeel + een aanbevolen Copy Stop Loss (CSL) %.

------------------------------------------------------------------------------
HOE GEBRUIK JE DIT (max ~2 min werk):
------------------------------------------------------------------------------
1. Open op eToro het profiel van de trader -> tabblad "Stats".
2. Vul hieronder het blok TRADER in (of draai interactief: zie onderaan).
3. Draai:   python etoro_auditor.py
------------------------------------------------------------------------------

Je kunt MEERDERE traders in de lijst TRADERS zetten; ze worden allemaal beoordeeld.
"""

from __future__ import annotations

import statistics
import sys

try:
    from rich.console import Console
    from rich.table import Table
    _console = Console()
except Exception:
    _console = None


# ===========================================================================
#  >>>>>>>>>>>>>>>>  PLAK HIER JE ETORO TRADER-DATA  <<<<<<<<<<<<<<<<
# ===========================================================================
# Vul per trader in. Maandelijkse rendementen als percentages (bv. 4.2 = +4.2%).
# 'max_drawdown' en de allocatie-percentages haal je van de Stats/Portfolio tab.
# 'risk_score' = de eToro Risk Score (1-7). 'gem_holdtijd_dagen' = gemiddelde
# houdperiode in dagen (optioneel, mag None).

TRADERS = [
    {
        "naam": "Voorbeeld Trader",
        "maandrendementen": [3.1, -1.2, 5.4, 2.2, -0.8, 4.0, 1.5, 6.2,
                              -2.1, 3.3, 0.9, 2.7],          # laatste 12 maanden
        "max_drawdown": 18.0,                                 # % (positief getal)
        "jaarrendement": None,        # optioneel; None = automatisch berekenen
        "risk_score": 4,             # eToro Risk Score 1-7
        "gem_holdtijd_dagen": 21,
        "portfolio": {               # huidige crypto-allocatie in %
            "BTC": 35, "ETH": 25, "SOL": 15, "AVAX": 10, "NEAR": 8, "Cash": 7,
        },
    },
    # Voeg gerust meer traders toe als losse dicts...
]
# ===========================================================================


# Groepen sterk gecorreleerde / vergelijkbare assets (voor concentratierisico).
CORRELATIE_GROEPEN = {
    "Large-cap": {"BTC", "ETH"},
    "Layer-1 alts": {"SOL", "AVAX", "NEAR", "ADA", "DOT", "ATOM", "SUI", "APT", "SEI", "TIA"},
    "Layer-2": {"ARB", "OP", "MATIC"},
    "DeFi": {"AAVE", "LINK", "INJ", "UNI"},
    "Meme": {"DOGE", "SHIB", "PEPE"},
    "AI": {"FET", "RNDR", "TAO"},
}


def _classificeer_asset(sym: str) -> str:
    sym = sym.upper()
    for groep, leden in CORRELATIE_GROEPEN.items():
        if sym in leden:
            return groep
    if sym in ("CASH", "USD", "USDT", "USDC"):
        return "Cash"
    return "Overig"


# ---------------------------------------------------------------------------
# DEELANALYSES
# ---------------------------------------------------------------------------

def analyse_consistentie(maandrendementen: list[float]) -> dict:
    """Beoordeelt hoe stabiel de rendementen zijn."""
    if not maandrendementen:
        return {"score": 0, "positief_pct": 0, "stdev": 0,
                "opmerking": "Geen maanddata aangeleverd."}

    positief = sum(1 for r in maandrendementen if r > 0)
    positief_pct = 100 * positief / len(maandrendementen)
    stdev = statistics.pstdev(maandrendementen) if len(maandrendementen) > 1 else 0.0
    gem = statistics.mean(maandrendementen)
    slechtste = min(maandrendementen)

    # Scoring 0-100
    score = 0
    score += min(50, positief_pct * 0.5)            # tot 50 pt voor % positieve maanden
    # Lage spreiding t.o.v. gemiddelde = consistent
    if stdev > 0:
        sharpe_achtig = gem / stdev
        score += max(0, min(30, sharpe_achtig * 15)) # tot 30 pt
    else:
        score += 20
    if slechtste > -10:
        score += 20                                  # geen enkele rampmaand
    elif slechtste > -20:
        score += 10

    if positief_pct >= 65 and stdev < 8:
        opm = "Zeer consistent: stabiele maand-op-maand winst."
    elif positief_pct >= 50:
        opm = "Redelijk consistent, maar met enige schommeling."
    else:
        opm = "Inconsistent: rendement lijkt afhankelijk van enkele uitschieters."

    return {
        "score": round(min(score, 100)),
        "positief_pct": round(positief_pct),
        "stdev": round(stdev, 1),
        "gem_maand": round(gem, 2),
        "slechtste_maand": round(slechtste, 1),
        "opmerking": opm,
    }


def analyse_risico(maandrendementen: list[float], max_drawdown: float,
                   jaarrendement: float | None, risk_score: int) -> dict:
    """Beoordeelt drawdown/return-ratio en eToro risk score."""
    if jaarrendement is None and maandrendementen:
        # Samengesteld jaarrendement uit maanddata.
        factor = 1.0
        for r in maandrendementen:
            factor *= (1 + r / 100)
        jaarrendement = (factor - 1) * 100

    jaarrendement = jaarrendement or 0.0
    dd = max(max_drawdown, 0.1)
    ratio = jaarrendement / dd  # return per eenheid drawdown (Calmar-achtig)

    score = 0
    if ratio >= 2:
        score += 50
        opm = "Uitstekend: rendement rechtvaardigt het risico ruimschoots."
    elif ratio >= 1:
        score += 35
        opm = "Gezond: rendement weegt op tegen de drawdown."
    elif ratio >= 0.5:
        score += 20
        opm = "Matig: er wordt veel risico genomen voor het rendement."
    else:
        score += 5
        opm = "Zwak: drawdown te hoog t.o.v. rendement."

    # eToro Risk Score (1-7): lager = rustiger
    if risk_score <= 3:
        score += 30
    elif risk_score <= 5:
        score += 20
    else:
        score += 5

    # Absolute drawdown-grens
    if dd <= 25:
        score += 20
    elif dd <= 40:
        score += 10

    return {
        "score": round(min(score, 100)),
        "jaarrendement": round(jaarrendement, 1),
        "max_drawdown": round(dd, 1),
        "ratio": round(ratio, 2),
        "risk_score": risk_score,
        "opmerking": opm,
    }


def analyse_portfolio(portfolio: dict) -> dict:
    """Beoordeelt concentratie en correlatie van de portefeuille."""
    if not portfolio:
        return {"score": 50, "opmerking": "Geen portfolio-data aangeleverd.",
                "grootste_positie": 0, "groep_concentratie": {}}

    totaal = sum(portfolio.values()) or 100
    genormaliseerd = {k: 100 * v / totaal for k, v in portfolio.items()}
    cash = sum(v for k, v in genormaliseerd.items() if _classificeer_asset(k) == "Cash")

    # Concentratie per correlatiegroep (cash niet meegerekend als risico).
    groep_conc: dict[str, float] = {}
    for sym, pct in genormaliseerd.items():
        groep = _classificeer_asset(sym)
        if groep == "Cash":
            continue
        groep_conc[groep] = groep_conc.get(groep, 0) + pct

    grootste_positie = max(
        (v for k, v in genormaliseerd.items() if _classificeer_asset(k) != "Cash"),
        default=0,
    )
    grootste_groep = max(groep_conc.values(), default=0)
    n_groepen = len(groep_conc)

    score = 100
    opmerkingen = []

    # Te grote enkele positie?
    if grootste_positie > 50:
        score -= 30
        opmerkingen.append(f"zeer geconcentreerd in één asset ({grootste_positie:.0f}%)")
    elif grootste_positie > 35:
        score -= 15
        opmerkingen.append(f"flinke enkele positie ({grootste_positie:.0f}%)")

    # Te veel in één correlatiegroep (alles crasht samen)?
    if grootste_groep > 60:
        score -= 25
        opmerkingen.append(f"sterk gecorreleerd cluster ({grootste_groep:.0f}% in één groep)")
    elif grootste_groep > 45:
        score -= 12
        opmerkingen.append(f"matige correlatie-concentratie ({grootste_groep:.0f}%)")

    # Spreiding over groepen
    if n_groepen >= 3:
        score += 5
    elif n_groepen <= 1:
        score -= 10
        opmerkingen.append("nauwelijks spreiding over categorieën")

    # Cash-buffer is positief
    if cash >= 10:
        opmerkingen.append(f"gezonde cash-buffer ({cash:.0f}%)")

    score = max(0, min(score, 100))
    if not opmerkingen:
        opmerkingen.append("goed gespreide portefeuille")

    return {
        "score": round(score),
        "grootste_positie": round(grootste_positie),
        "grootste_groep": round(grootste_groep),
        "cash": round(cash),
        "groep_concentratie": {k: round(v) for k, v in groep_conc.items()},
        "opmerking": "; ".join(opmerkingen),
    }


# ---------------------------------------------------------------------------
# EINDOORDEEL
# ---------------------------------------------------------------------------

def beoordeel_trader(trader: dict) -> dict:
    cons = analyse_consistentie(trader.get("maandrendementen", []))
    risk = analyse_risico(
        trader.get("maandrendementen", []),
        trader.get("max_drawdown", 0),
        trader.get("jaarrendement"),
        trader.get("risk_score", 4),
    )
    port = analyse_portfolio(trader.get("portfolio", {}))

    # Gewogen totaalscore.
    totaal = round(0.35 * cons["score"] + 0.40 * risk["score"] + 0.25 * port["score"])

    if totaal >= 70:
        oordeel, kleur = "GROEN", "green"
    elif totaal >= 50:
        oordeel, kleur = "GEEL", "yellow"
    else:
        oordeel, kleur = "ROOD", "red"

    # Aanbevolen Copy Stop Loss (CSL):
    # Basis op max drawdown, aangescherpt op kwaliteit. CSL moet je beschermen
    # tegen een slechte periode, maar niet te strak (anders stop je te vroeg uit).
    dd = risk["max_drawdown"]
    if oordeel == "GROEN":
        csl = min(40, max(20, round(dd * 1.2 / 5) * 5))   # ruimte geven aan goede trader
    elif oordeel == "GEEL":
        csl = min(30, max(15, round(dd * 1.0 / 5) * 5))
    else:
        csl = min(20, max(10, round(dd * 0.6 / 5) * 5))   # strak: weinig vertrouwen

    return {
        "naam": trader.get("naam", "Onbekend"),
        "consistentie": cons,
        "risico": risk,
        "portfolio": port,
        "totaalscore": totaal,
        "oordeel": oordeel,
        "kleur": kleur,
        "csl": csl,
    }


def print_rapport(beoordeling: dict) -> None:
    b = beoordeling
    if _console:
        kleur = b["kleur"]
        _console.print(f"\n[bold]eToro Trader Audit — {b['naam']}[/bold]")
        _console.print(f"Eindoordeel: [bold {kleur}]{b['oordeel']}[/bold {kleur}]  "
                       f"(totaalscore {b['totaalscore']}/100)")
        _console.print(f"Aanbevolen Copy Stop Loss: [bold]{b['csl']}%[/bold]\n")

        t = Table(show_header=True, header_style="bold")
        t.add_column("Onderdeel")
        t.add_column("Score", justify="right")
        t.add_column("Bevinding")
        t.add_row("Consistentie", f"{b['consistentie']['score']}/100",
                  f"{b['consistentie']['positief_pct']}% pos. maanden — {b['consistentie']['opmerking']}")
        t.add_row("Risico/Return", f"{b['risico']['score']}/100",
                  f"jaar {b['risico']['jaarrendement']}% / DD {b['risico']['max_drawdown']}% "
                  f"(ratio {b['risico']['ratio']}) — {b['risico']['opmerking']}")
        t.add_row("Portfolio", f"{b['portfolio']['score']}/100", b['portfolio']['opmerking'])
        _console.print(t)
    else:
        print(f"\n=== eToro Trader Audit — {b['naam']} ===")
        print(f"Eindoordeel: {b['oordeel']} (score {b['totaalscore']}/100)")
        print(f"Aanbevolen Copy Stop Loss: {b['csl']}%")
        print(f"- Consistentie  {b['consistentie']['score']}/100: {b['consistentie']['opmerking']}")
        print(f"- Risico/Return {b['risico']['score']}/100: {b['risico']['opmerking']}")
        print(f"- Portfolio     {b['portfolio']['score']}/100: {b['portfolio']['opmerking']}")


def audit_alle(traders: list[dict] | None = None) -> list[dict]:
    traders = traders if traders is not None else TRADERS
    return [beoordeel_trader(t) for t in traders]


def main():
    beoordelingen = audit_alle()
    if not beoordelingen:
        print("Geen traders ingevuld. Bewerk de lijst TRADERS bovenin dit bestand.")
        return []
    for b in beoordelingen:
        print_rapport(b)
    return beoordelingen


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nAfgebroken door gebruiker.")
        sys.exit(1)
