# Bugrapport — Kader Crypto Copy-Trading App
**Datum:** 2026-06-28  
**Branch:** feat/analyse-uitleg-ui  
**Bestanden onderzocht:** `src/app.py`, `src/app_ui.py`, `src/crypto_analyzer.py`, `src/etoro_auditor.py`, `src/coin_info.py`, `src/daily_report.py`, `requirements.txt`

---

## 🔴 Kritiek

### BUG-01 — Race condition / bestandscorruptie bij gelijktijdige verzoeken
**Bestand:** `src/app.py` — `_laad()` en `_bewaar()` (regels 52–63)  
**Beschrijving:** De `ThreadingHTTPServer` verwerkt elk HTTP-verzoek in een aparte thread. De hulpfuncties `_laad()` en `_bewaar()` lezen en schrijven `traders.json` en `portfolio.json` zonder enige thread-vergrendeling (mutex/lock). Als twee verzoeken tegelijkertijd binnenkomen (bijv. twee "Trade toevoegen"-klikken), kunnen ze elkaars schrijfopdracht overlappen en het JSON-bestand corrupt achterlaten. Na corruptie start de app niet meer correct op totdat het bestand handmatig hersteld wordt.

**Reproduceerbaar:** Twee browser-tabs tegelijk een trade laten toevoegen.

**Oplossing:** Voeg een `threading.Lock()` toe die `_laad()` en `_bewaar()` serialiseert:
```python
_bestand_lock = threading.Lock()

def _laad(pad, standaard):
    with _bestand_lock:
        try:
            with open(pad, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return standaard

def _bewaar(pad, data):
    with _bestand_lock:
        tmp = pad + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, pad)  # atomaire overschrijving
```

---

## 🟠 Hoog

### BUG-02 — Risk/Reward-filter werkt nooit
**Bestand:** `src/crypto_analyzer.py` — `analyseer_coin()` (regel 284)  
**Beschrijving:** De code filtert trades waarbij de R/R kleiner is dan `MIN_RISK_REWARD` (2.0):
```python
if rr < MIN_RISK_REWARD - 1e-9:
    return None
```
Maar de R/R-ratio is altijd wiskundig exact 2.0:
- `risk = ATR_STOP_MULTIPLIER * atr` = 1.5 × ATR
- `reward = REWARD_MULTIPLIER * atr` = 3.0 × ATR  
- `rr = reward / risk` = 3.0 / 1.5 = **2.0 altijd**

Het filter is dus dode code — het filtert nooit iets weg. Als iemand de constanten aanpast zodat R/R < 2 wordt (bijv. `REWARD_MULTIPLIER = 2.5`), zouden er toch trades doorheen glippen.

**Oplossing:** Ofwel het filter verwijderen (het doet niks), of de instelling dynamisch berekenen:
```python
MIN_RISK_REWARD = REWARD_MULTIPLIER / ATR_STOP_MULTIPLIER  # altijd 2.0
```
Dan is duidelijk dat de constanten de R/R bepalen, niet de filter.

---

### BUG-03 — `ta`-pakket geïnstalleerd maar nergens gebruikt
**Bestand:** `requirements.txt` (regel 3)  
**Beschrijving:** `ta>=0.11.0` staat in de requirements, maar de `ta`-bibliotheek wordt nergens geïmporteerd of gebruikt in `src/`. De `CLAUDE.md` bevestigt dat alle indicatoren handmatig in pandas zijn geïmplementeerd. Dit voegt ~3 seconden toe aan de installatietijd en kan versieconflicten veroorzaken.

**Oplossing:**
```diff
- ta>=0.11.0
```
Verwijder de regel uit `requirements.txt`.

---

### BUG-04 — Verkeerd veld `kleur` in `api_traders_lijst()`
**Bestand:** `src/app.py` — `api_traders_lijst()` (regel 343)  
**Beschrijving:**
```python
"kleur": b["oordeel"],   # ← fout: geeft "GROEN"/"GEEL"/"ROOD" terug
```
Had moeten zijn:
```python
"kleur": b["kleur"],     # ← juist: geeft "green"/"yellow"/"red" terug
```
Het `kleur`-veld in de API-respons bevat de Nederlandse naam ("GROEN") in plaats van de CSS-kleur ("green"). Het werkt nu alleen omdat de frontend `b.oordeel` (de Nederlandse naam) gebruikt voor de badge-opzoektabel — het `kleur`-veld wordt nooit gelezen. Als dat ooit verandert, is de styling kapot.

**Oplossing:**
```python
"kleur": b["kleur"],
```

---

## 🟡 Middel

### BUG-05 — Score-simulator: wederzijds uitsluitende signalen stapelbaar
**Bestand:** `src/app_ui.py` — score-simulator (regels 288–292)  
**Beschrijving:** In de Python-engine zijn RSI-opties en volume-opties `elif`-branches — slechts één geldt per keer. Maar in de simulator kunnen ze tegelijk worden aangevinkt:

| Simulator | Python-code | Probleem |
|-----------|-------------|---------|
| RSI 45–68 (+20 pts) **én** RSI <35 (+10 pts) | `elif` — nooit tegelijk | Simulator geeft +30 in plaats van max +20 |
| Volume spike ≥1,5× (+15 pts) **én** Volume 1,2–1,5× (+8 pts) | `elif` — nooit tegelijk | Simulator geeft +23 in plaats van max +15 |

Een gebruiker die beide RSI-vakjes aanvinkt krijgt een score van ~110 (gecapt op 100), maar ziet dan "HIGH CONVICTION" terwijl de echte engine misschien 70 punten berekent.

**Oplossing:** Maak de opties wederzijds uitsluitend via JavaScript:
```javascript
// Koppel sim3 en sim3b: als één wordt aangevinkt, vink de ander uit
document.getElementById('sim3').addEventListener('change', function(){
    if(this.checked) document.getElementById('sim3b').checked = false;
    bereken();
});
document.getElementById('sim3b').addEventListener('change', function(){
    if(this.checked) document.getElementById('sim3').checked = false;
    bereken();
});
// Zelfde voor sim5 en sim5b
```

---

### BUG-06 — Niet-atomaire bestandsschrijfacties
**Bestand:** `src/app.py` — `_bewaar()` (regels 61–63)  
**Beschrijving:** `_bewaar()` schrijft direct naar het doelbestand. Als het proces wordt onderbroken terwijl het bestand halfvol is (Ctrl+C, crash, stroomuitval), blijft een corrupt JSON-bestand achter. Dit treft `traders.json` en `portfolio.json` — de opgeslagen traders en posities gaan dan verloren.

**Oplossing:** Schrijf eerst naar een tijdelijk bestand, dan atomair hernoemen (zie ook BUG-01-oplossing):
```python
import tempfile
def _bewaar(pad, data):
    dir_ = os.path.dirname(pad)
    with tempfile.NamedTemporaryFile("w", dir=dir_, delete=False,
                                     suffix=".tmp", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        tmp = f.name
    os.replace(tmp, pad)
```

---

## 🔵 Laag

### BUG-07 — NaN-detectie inconsistent
**Bestand:** `src/app.py` — `_live_indicatoren()` (regel 124)  
**Beschrijving:**
```python
"atr": float(atr.iloc[-1]) if atr.iloc[-1] == atr.iloc[-1] else prijs * 0.03,
```
Dit gebruikt de float-zelf-vergelijkingstruc (`NaN != NaN`) voor NaN-detectie. De rest van de codebase (`crypto_analyzer.py`, regel 227) gebruikt `math.isnan()`. De truc werkt, maar is onleesbaar.

**Oplossing:**
```python
import math
"atr": float(atr.iloc[-1]) if not math.isnan(atr.iloc[-1]) else prijs * 0.03,
```

---

### BUG-08 — `_fmt()`-functie gedupliceerd
**Bestanden:** `src/crypto_analyzer.py` (regels 504–510) en `src/daily_report.py` (regels 41–46)  
**Beschrijving:** Dezelfde prijsformatteringsfunctie staat in twee bestanden. Als de logica ooit verandert, moet je het op twee plekken aanpassen.

**Oplossing:** `daily_report.py` importeert al `crypto_analyzer as ca`, dus vervang de lokale definitie door:
```python
# verwijder de lokale _fmt() uit daily_report.py
# gebruik ca._fmt() waar nodig
```

---

### BUG-09 — Geen beschrijving hoe `mobile/www/` te (her)genereren
**Bestand:** `mobile/README.md`, `CLAUDE.md`  
**Beschrijving:** De `CLAUDE.md` vermeldt dat `mobile/www/` gitignored is en mogelijk afwezig is na een fresh checkout — maar geeft geen instructies hoe het te regenereren. De Capacitor-aanpak is inmiddels vervangen door de Expo-app (`app/`), maar de `mobile/`-map blijft staan zonder duidelijke status.

**Aanbeveling:** Voeg een opmerking toe in `mobile/README.md` dat deze map deprecated is ten gunste van `app/` (React Native + Expo), en dat `mobile/www/` niet meer gegenereerd hoeft te worden.

---

## Samenvatting

| # | Ernst | Bestand | Beschrijving |
|---|-------|---------|-------------|
| BUG-01 | 🔴 Kritiek | `app.py` | Race condition bij gelijktijdige bestandsschrijfacties |
| BUG-02 | 🟠 Hoog | `crypto_analyzer.py` | R/R-filter is dode code (filtert nooit) |
| BUG-03 | 🟠 Hoog | `requirements.txt` | `ta`-pakket nooit gebruikt |
| BUG-04 | 🟠 Hoog | `app.py` | `kleur`-veld bevat oordeel-string i.p.v. CSS-kleur |
| BUG-05 | 🟡 Middel | `app_ui.py` | Score-simulator: RSI/volume-opties stapelbaar terwijl ze wederzijds uitsluitend zijn |
| BUG-06 | 🟡 Middel | `app.py` | Niet-atomaire JSON-schrijfacties |
| BUG-07 | 🔵 Laag | `app.py` | NaN-detectie inconsistent met rest van codebase |
| BUG-08 | 🔵 Laag | `daily_report.py` | `_fmt()` gedupliceerd t.o.v. `crypto_analyzer.py` |
| BUG-09 | 🔵 Laag | `mobile/` | Geen duidelijke deprecated-status voor de Capacitor-map |
