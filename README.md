# 📊 Crypto Copy-Trading Analyse Systeem

Een dagelijks bruikbaar systeem dat **gratis** crypto-marktdata analyseert en je
elke dag een lijst met **concrete trades** geeft — inclusief **stop loss** en
**take profit** — plus een hulpmiddel om eToro "Popular Investors" te beoordelen
voordat je ze kopieert.

> ⚠️ **Geen financieel advies.** Dit is een persoonlijk analyse-hulpmiddel.
> Trades zijn technische signalen ter ondersteuning van je eigen onderzoek.
> Handel nooit met geld dat je niet kunt missen.

---

## 🖥️ De App (aanbevolen — gebruiksvriendelijke interface)

Wil je geen bestanden bewerken? Gebruik de **app met knoppen** in je browser:

### macOS
Dubbelklik op **`start_app.command`**. (De eerste keer: rechtsklik → *Openen* om
Gatekeeper toe te staan.) Je browser opent vanzelf op `http://localhost:8765`.

### macOS / Linux via terminal
```bash
./venv/bin/python src/app.py     # of: python src/app.py  binnen je venv
```

De app heeft drie tabbladen:

| Tab | Wat je doet |
|-----|-------------|
| **🎯 Analyse** | Bevat drie sub-tabs: **📊 Marktanalyse** (knop → trades met entry/stop/take-profit uit het vaste universum), **👥 Traders kopiëren** (de posities van je opgeslagen traders mét live niveaus om te kopiëren), en **🚀 Grote kansen** (scant honderden coins op hoog winstpotentieel + uitleg waarom). Elke coin heeft een uitklapbaar *ℹ️ Over deze coin* met uitleg én een technisch koopadvies. |
| **📈 Mijn Trades** | Voeg je eigen trades toe (symbool, entry, stop, doel, aantal). Bovenaan een **totaal-W/V-overzicht**; per positie een **VERKOOP / HOUD / WINST**-tip + trailing-stop suggestie. Live prijzen, met optioneel auto-vernieuwen (1 min). |
| **👥 eToro Traders** | Vul de stats van een trader in → direct 🟢/🟡/🔴-oordeel + aanbevolen **Copy Stop Loss**. Vul ook hun **portfolio-allocatie** in zodat *Traders kopiëren* hun posities kan tonen. Alles wordt bewaard (`data/`). |

> De app gebruikt dezelfde analyse-engine als de CLI hieronder — alleen nu met
> klikbare knoppen i.p.v. Python-bestanden bewerken. Je gegevens staan lokaal in
> `data/traders.json` en `data/portfolio.json`.

---

## 🚀 Snelstart CLI (dagelijks rapport — max 5 min)

### macOS / Linux
```bash
./run_daily.sh
```

### Windows
Dubbelklik op **`run_daily.bat`** (of draai het vanaf de command prompt).

Dat is alles. Het script:
1. Maakt automatisch een virtuele omgeving aan (alleen de eerste keer).
2. Installeert de benodigde pakketten (alleen de eerste keer).
3. Haalt verse marktdata op en genereert het rapport
   **`daily_trades_JJJJ-MM-DD.md`**.

Open daarna dat `.md`-bestand en je hebt je tradelijst voor vandaag. 🎉

---

## 🗓️ Je dagelijkse routine (≈5 minuten)

1. **Draai het script** (`run_daily.sh` / `run_daily.bat`) → ~1-2 min.
2. **Open** `daily_trades_<datum>.md` en bekijk de tabel met trades.
3. **(Optioneel, eenmalig per nieuwe trader)** Plak eToro-traderstats in
   `src/etoro_auditor.py` voor een GROEN/GEEL/ROOD oordeel + aanbevolen Copy Stop Loss.
4. **Plaats je orders** op eToro met de getoonde **Entry / Stop Loss / Take Profit**.

> 💡 Het enige handwerk is stap 3, en alleen wanneer je een nieuwe eToro-trader
> wilt beoordelen. De marktanalyse is volledig automatisch.

---

## 📁 Mappenstructuur

```
Claude access/
├── start_app.command        ← dubbelklik: start de app (browser)
├── run_daily.sh / .bat      ← dubbelklik/CLI: genereer dagrapport
├── requirements.txt
├── README.md
├── src/                     ← alle programmacode
│   ├── app.py               ← webserver van de app
│   ├── app_ui.py            ← de interface (HTML/CSS/JS)
│   ├── crypto_analyzer.py   ← marktanalyse + grote-kansen-scanner
│   ├── coin_info.py         ← coin-beschrijvingen + koopadvies-logica
│   ├── etoro_auditor.py     ← eToro trader-beoordeling
│   └── daily_report.py      ← CLI dagrapport
├── data/                    ← jouw opgeslagen traders & trades (JSON)
├── reports/                 ← gegenereerde daily_trades_<datum>.md
├── docs/                    ← plan & notities
└── skills/                  ← gekloonde claude-trading-skills
```

## 📦 Wat doet elk onderdeel?

| Bestand | Functie |
|---------|---------|
| **`src/app.py` + `src/app_ui.py`** | De gebruiksvriendelijke app met knoppen (zie boven). |
| **`src/crypto_analyzer.py`** | Haalt gratis marktdata op (Binance + CoinGecko), berekent RSI, EMA 20/50, MACD, ATR en volume-spikes. Levert een gerangschikte lijst van 5–10 trades met R/R ≥ 1:2. Bevat ook de **grote-kansen-scanner** die de bredere markt afzoekt op momentum/herstelruimte. |
| **`src/coin_info.py`** | Korte uitleg per coin ("wat is het?") + een technisch **koopadvies** (Sterke koop / Koopwaardig / Neutraal / Zwak) op basis van de live indicatoren. |
| **`src/etoro_auditor.py`** | Beoordeelt eToro-traderstats: consistentie, drawdown/return-ratio en portfolio-concentratie → GROEN/GEEL/ROOD + aanbevolen Copy Stop Loss %. |
| **`src/daily_report.py`** | Combineert beide en schrijft `reports/daily_trades_<datum>.md`. |
| **`run_daily.sh` / `run_daily.bat`** | One-click dagelijkse run. |
| **`requirements.txt`** | Dependencies (requests, pandas, ta, rich). |
| **`skills/`** | Gekloonde [tradermonty/claude-trading-skills](https://github.com/tradermonty/claude-trading-skills) voor verdere analyse in Claude. |

---

## ⚙️ Handmatige installatie (als de one-click niet werkt)

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python src/app.py               # de app, of:
python src/daily_report.py      # het CLI-dagrapport
```

---

## 🛡️ Uitleg: Stop Loss & Take Profit logica

Het hart van het systeem is **risicobeheersing**. Daarom is elke trade voorzien
van een verplichte stop loss en take profit — nooit optioneel.

### ATR-gebaseerde dynamische stop loss
We gebruiken **geen vast percentage** (zoals "altijd −10%"). In plaats daarvan
gebruiken we de **ATR (Average True Range)** — een maat voor de gemiddelde
dagelijkse volatiliteit van de coin.

```
Stop Loss   = Entry − (1.5 × ATR)
Take Profit = Entry + (3.0 × ATR)
```

**Waarom?**
- Een **volatiele** coin (grote ATR) krijgt een **ruimere** stop, zodat je niet
  bij de eerste normale schommeling wordt uitgestopt.
- Een **rustige** coin (kleine ATR) krijgt een **strakkere** stop.
- De stop past zich dus automatisch aan het karakter van de coin aan.

### Risk/Reward minimaal 1:2
Doordat de take profit op `3 × ATR` ligt en de stop op `1.5 × ATR`, is de
beloning altijd **minstens twee keer** het risico (R/R = 1:2). Coins die hier
niet aan voldoen worden weggefilterd. Eén winnende trade compenseert zo twee
verliezers — je kunt vaker fout zitten dan goed en tóch winstgevend zijn.

### Signaal-score (0–100)
Elke coin krijgt punten voor: opwaartse trend (EMA20 > EMA50), prijs boven EMA20,
gezonde RSI, bullish MACD en volume-spikes. Hoe hoger de score, hoe sterker het
technische signaal. Vanaf score 75 mét trend, momentum én volume wordt een trade
gemarkeerd als 🚀 **HIGH CONVICTION**.

---

## 👥 eToro trader beoordelen

1. Open op eToro het profiel van de trader → tabblad **Stats**.
2. Open **`src/etoro_auditor.py`** en vul het blok `TRADERS` in:
   - `maandrendementen` — de laatste ~12 maandrendementen in % (bv. `4.2`).
   - `max_drawdown` — de maximale drawdown in % (positief getal).
   - `risk_score` — de eToro Risk Score (1–7).
   - `portfolio` — huidige allocatie, bv. `{"BTC": 40, "ETH": 30, "SOL": 20, "Cash": 10}`.
3. Draai `python src/etoro_auditor.py` (of het verschijnt automatisch in het dagrapport).

Je krijgt een **GROEN/GEEL/ROOD** oordeel plus een **aanbevolen Copy Stop Loss (CSL)**
die je op eToro instelt bij het kopiëren. De CSL beschermt je inleg als de trader
een slechte periode heeft.

---

## 🔌 Technische details

- **Alleen gratis publieke API's** — geen keys nodig.
  - Primair: **Binance** publieke klines (meerdere endpoints voor redundantie).
  - **Fallback: CoinGecko** als Binance tijdelijk onbereikbaar is.
- **Robuuste foutafhandeling** — een coin die faalt wordt overgeslagen, niet de hele run.
- **Indicatoren** worden zelf in pandas berekend, dus het systeem blijft werken
  ook als externe indicatorbibliotheken wijzigen.
- Alle uitvoer is in het **Nederlands**.

### Universum aanpassen
Wil je andere coins volgen? Pas de lijst `STANDAARD_UNIVERSUM` bovenin
`src/crypto_analyzer.py` aan.

### Risico-instellingen aanpassen
In `src/crypto_analyzer.py` kun je o.a. deze waarden wijzigen:
`ATR_STOP_MULTIPLIER` (stop-afstand), `REWARD_MULTIPLIER` (winstdoel),
`MIN_RISK_REWARD` (minimale R/R) en `HIGH_CONVICTION_SCORE`.

---

## ❓ Problemen oplossen

| Probleem | Oplossing |
|----------|-----------|
| `command not found: python3` | Installeer Python 3 via [python.org](https://www.python.org/downloads/). |
| Geen trades in het rapport | Markt is mogelijk richtingloos; geen enkele coin haalde R/R 1:2. Normaal — geduld is ook een positie. |
| Binance onbereikbaar | Het systeem valt automatisch terug op CoinGecko (zonder volume-signaal). |
| `pip install` faalt | Draai de handmatige installatie hierboven en lees de foutmelding. |

---

*Gebouwd als persoonlijk analyse-hulpmiddel. Controleer altijd de live koersen op
eToro voordat je een order plaatst.*
