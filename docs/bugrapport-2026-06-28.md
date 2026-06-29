# Bugrapport — Kader Crypto Copy-Trading App
**Datum:** 2026-06-28  
**Branch:** feat/analyse-uitleg-ui  
**Status:** ✅ Alle bugs opgelost (commit `01b1369`)  
**Bestanden onderzocht:** `src/app.py`, `src/app_ui.py`, `src/crypto_analyzer.py`, `src/etoro_auditor.py`, `src/coin_info.py`, `src/daily_report.py`, `requirements.txt`

---

## Samenvatting

| # | Ernst | Bestand | Beschrijving | Status |
|---|-------|---------|-------------|--------|
| BUG-01 | 🔴 Kritiek | `app.py` | Race condition bij gelijktijdige bestandsschrijfacties | ✅ Opgelost |
| BUG-02 | 🟠 Hoog | `crypto_analyzer.py` | R/R-filter is dode code (filtert nooit) | ✅ Opgelost |
| BUG-03 | 🟠 Hoog | `requirements.txt` | `ta`-pakket nooit gebruikt | ✅ Opgelost |
| BUG-04 | 🟠 Hoog | `app.py` | `kleur`-veld bevat oordeel-string i.p.v. CSS-kleur | ✅ Opgelost |
| BUG-05 | 🟡 Middel | `app_ui.py` | Score-simulator: RSI/volume-opties stapelbaar terwijl ze wederzijds uitsluitend zijn | ✅ Opgelost |
| BUG-06 | 🟡 Middel | `app.py` | Niet-atomaire JSON-schrijfacties | ✅ Opgelost |
| BUG-07 | 🔵 Laag | `app.py` | NaN-detectie inconsistent met rest van codebase | ✅ Opgelost |
| BUG-08 | 🔵 Laag | `daily_report.py` | `_fmt()` gedupliceerd t.o.v. `crypto_analyzer.py` | ✅ Opgelost |
| BUG-09 | 🔵 Laag | `mobile/` | Geen duidelijke deprecated-status voor de Capacitor-map | ✅ Opgelost |

---

## 🔴 Kritiek

### BUG-01 — Race condition / bestandscorruptie bij gelijktijdige verzoeken ✅
**Bestand:** `src/app.py`  
**Oplossing:** `threading.Lock()` toegevoegd als module-level `_bestand_lock`. Zowel `_laad()` als `_bewaar()` houden de lock vast tijdens hun volledige lees- of schrijfoperatie, waardoor gelijktijdige verzoeken geserialiseerd worden. Gecombineerd met BUG-06 (atomaire schrijfacties).

---

## 🟠 Hoog

### BUG-02 — Risk/Reward-filter werkt nooit ✅
**Bestand:** `src/crypto_analyzer.py`  
**Oplossing:** De zinloze `if rr < MIN_RISK_REWARD - 1e-9: return None`-regel is verwijderd. `MIN_RISK_REWARD` is nu afgeleid van de twee multipliers die de daadwerkelijke R/R bepalen:
```python
MIN_RISK_REWARD = REWARD_MULTIPLIER / ATR_STOP_MULTIPLIER  # = 3.0 / 1.5 = 2.0
```
Zo is direct zichtbaar dat de constanten samen de R/R bepalen en niet een losstaande variabele.

---

### BUG-03 — `ta`-pakket geïnstalleerd maar nergens gebruikt ✅
**Bestand:** `requirements.txt`  
**Oplossing:** `ta>=0.11.0` verwijderd. Alle indicatoren (RSI, EMA, MACD, ATR) zijn al handmatig in pandas geïmplementeerd.

---

### BUG-04 — Verkeerd veld `kleur` in `api_traders_lijst()` ✅
**Bestand:** `src/app.py`  
**Oplossing:**
```python
# Was:
"kleur": b["oordeel"],   # gaf "GROEN"/"GEEL"/"ROOD"
# Is nu:
"kleur": b["kleur"],     # geeft "green"/"yellow"/"red"
```

---

## 🟡 Middel

### BUG-05 — Score-simulator: wederzijds uitsluitende signalen stapelbaar ✅
**Bestand:** `src/app_ui.py`  
**Oplossing:** JavaScript-functie `maakExclusief(idA, idB)` toegevoegd. De RSI-opties (`sim3`/`sim3b`) en volume-opties (`sim5`/`sim5b`) zijn geregistreerd als exclusieve paren: als één wordt aangevinkt, wordt de ander automatisch uitgevinkt. Dit spiegelt het `elif`-gedrag van de Python-engine.

---

### BUG-06 — Niet-atomaire bestandsschrijfacties ✅
**Bestand:** `src/app.py`  
**Oplossing:** `_bewaar()` schrijft nu via een tijdelijk bestand en hernoemt dat atomair:
```python
with tempfile.NamedTemporaryFile("w", dir=dir_, delete=False, suffix=".tmp", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    tmp = f.name
os.replace(tmp, pad)
```
`os.replace()` is atomair op POSIX-systemen — het doelbestand is nooit half geschreven.

---

## 🔵 Laag

### BUG-07 — NaN-detectie inconsistent ✅
**Bestand:** `src/app.py`  
**Oplossing:**
```python
# Was:
"atr": float(atr.iloc[-1]) if atr.iloc[-1] == atr.iloc[-1] else prijs * 0.03,
# Is nu:
"atr": float(atr.iloc[-1]) if not math.isnan(atr.iloc[-1]) else prijs * 0.03,
```

---

### BUG-08 — `_fmt()` gedupliceerd ✅
**Bestand:** `src/daily_report.py`  
**Oplossing:** Lokale `_fmt()`-definitie verwijderd. Vervangen door een alias naar de bestaande functie in `crypto_analyzer`:
```python
_fmt = ca._fmt
```

---

### BUG-09 — Geen duidelijke deprecated-status voor `mobile/` ✅
**Bestand:** `mobile/README.md`  
**Oplossing:** Bestand begint nu met een duidelijke waarschuwing:
```
# 📱 Crypto Copy-Trading — Android-app (Capacitor — DEPRECATED)

> ⚠️ **Deze map is vervangen door `../app/` (React Native + Expo).**
```
