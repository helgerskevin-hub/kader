# Crypto Copy-Trading — app-beschrijving (context voor Claude Design)

Dit document beschrijft de app **Crypto Copy-Trading** zodat het als context kan
dienen voor een design-opdracht (bijv. een nieuw, mooier UI-ontwerp, een
app-icoon, screenshots voor een store-pagina, of een herontwerp van losse
schermen). Het bevat: wat de app doet, de schermen/tabbladen, de visuele stijl,
en de nieuwe meldingen-functie.

> ⚠️ De app geeft **geen financieel advies** — het zijn technische signalen ter
> ondersteuning van eigen onderzoek. Dat tone-of-voice mag in het design
> terugkomen (nuchter, behulpzaam, niet "to the moon"-achtig).

---

## 1. Wat is de app?

Een **persoonlijke Android-app** (Capacitor/WebView, sideloaded — niet in de Play
Store) die een crypto-belegger helpt om:

1. **de markt te analyseren** en kansrijke trades te genereren met een vooraf
   berekende entry, stop-loss en take-profit (minimaal 1:2 risk/reward);
2. **eToro-traders te beoordelen** (Popular Investors) en te zien wat ze nu in
   portefeuille hebben, zodat je hun posities kunt overnemen ("copy trading");
3. **de eigen open posities te volgen** met een live VERKOOP / HOUD / WINST-tip;
4. **automatisch gewaarschuwd te worden** (pushmeldingen) wanneer een take-profit
   verhoogd kan worden of je beter eerder kunt uitstappen.

De volledige analyse draait **op het toestel zelf** (geen server). Alleen verse
marktdata wordt live opgehaald van gratis publieke bronnen (Binance + CoinGecko).
Traders en trades worden lokaal opgeslagen (localStorage).

- **Taal van de interface:** Nederlands.
- **Platform:** Android (Capacitor 6, WebView). Eén HTML/CSS/JS-frontend.
- **App-id / naam:** `com.kevinhelgers.cryptocopytrading` — "Crypto Copy-Trading".

---

## 2. Schermen / navigatie

De app heeft een **header** met titel "📊 Crypto Copy-Trading" en een live klokje,
daaronder een **hoofd-tabbalk** met 3 tabs:

### Tab 1 — 🎯 Analyse
Bevat 3 sub-tabbladen:
- **📊 Marktanalyse** — knop "🚀 Start Analyse". Haalt verse data op en toont per
  kans een kaart met: huidige prijs, entry-zone, 🛑 stop-loss, 🎯 take-profit,
  risk/reward, signaalscore + RSI, een koopadvies-badge en een uitklapbaar
  "ℹ️ Over deze coin"-blok. Knoppen per kaart: "✅ Getrade" en "✏️ Aanpassen".
- **👥 Traders kopiëren** — toont per opgeslagen trader hun huidige posities met
  live entry/stop/take-profit in een tabel; per rij een "✅ Getrade"-knop.
- **🚀 Grote kansen** — scant honderden coins op momentum/kleine marktcap/
  herstelruimte. Speculatieve kandidaten met uitleg "waarom potentiële grote
  winst". Duidelijke risico-waarschuwing.

### Tab 2 — 📈 Mijn Trades
- Formulier om een trade toe te voegen: Symbool, Aantal (optioneel), Entry-prijs,
  Stop-loss, Take-profit.
- **🔔 Pushmeldingen-kaart** (nieuw): aan/uit-schakelaar "controle elke 10 min" +
  testknop, met uitleg en een tijdstempel van de laatste controle.
- **Samenvattingskaart** (5 vakjes): Open posities · Ingelegd · Huidige waarde ·
  Totaal W/V · Actie nodig.
- Optie "Auto-vernieuwen (1 min)" + knop "🔄 Prijzen vernieuwen".
- **Open posities** als kaarten: live prijs, jouw entry, resultaat (W/V % en €),
  🛑 stop / 🎯 doel, een voortgangsbalk (entry → take-profit), en een tip-tekst
  met een advies-badge (VERKOOP NU / NEEM WINST / OVERWEEG WINST / HOUD VAST /
  LET OP). Knoppen: "✓ Gesloten markeren" en "verwijderen".
- **Gesloten** posities in een tabel.

### Tab 3 — 👥 eToro Traders
- Formulier om een trader te beoordelen: naam, eToro Risk Score (1–7),
  maandrendementen, max. drawdown, jaarrendement, portfolio-allocatie.
- Resultaatkaarten met 🟢/🟡/🔴-oordeel, totaalscore/100, aanbevolen **Copy Stop
  Loss (%)** en een toelichting (consistentie, risico, portfolio).

---

## 3. Nieuwe functie — pushmeldingen (elke 10 minuten)

De app controleert om de **10 minuten** automatisch alle open trades in "Mijn
Trades" en stuurt een **pushmelding** (native Android-melding via
`@capacitor/local-notifications`) in twee gevallen:

1. **🎯 Take-profit verhogen** — de koers nadert (of overschrijdt) de ingestelde
   take-profit terwijl het momentum nog sterk is (opwaartse trend, MACD bullish,
   RSI nog niet extreem). De melding bevat de **voorgestelde hogere take-profit**
   plus een korte uitleg waarom (de winst kan verder doorlopen).
   *Voorbeeld:* "🎯 SOL: verhoog je take-profit naar $182,40 — koers nadert je
   doel met sterk momentum (trend opwaarts, MACD bullish, RSI 64). De winst kan
   verder doorlopen."

2. **🛑 Stop-loss verhogen / "stap eerder uit"** — je staat op winst maar het
   momentum vlakt af of draait (RSI overbought, MACD bearish of trend gebroken).
   De melding bevat de **voorgestelde hogere stop-loss** met de boodschap
   *"Stap eerder uit"* en de reden.
   *Voorbeeld:* "🛑 BTC: stap eerder uit — trek je stop-loss op naar $63.900
   (was $61.000). Reden: RSI overbought (79), MACD draait bearish. Veel hoger
   gaat het waarschijnlijk niet — winst vastzetten."

Details voor het design: de meldingen-kaart in Mijn Trades heeft een
checkbox-schakelaar, een korte uitlegtekst, een statuspil ("trades gecontroleerd
· HH:MM UTC") en een "🔔 Testmelding"-knop. Om herhaalde spam te voorkomen wordt
dezelfde melding hoogstens eens per ~6 uur herhaald (tenzij het voorgestelde
niveau >2% verandert).

---

## 4. Visuele stijl (huidig)

Donker, strak "fintech/dashboard"-thema. Designvoorstellen mogen hierop
voortbouwen of er een mooiere versie van maken — dit zijn de huidige tokens:

| Rol | Kleur |
|-----|-------|
| Achtergrond | `#0e1117` |
| Panelen/kaarten | `#161b22` / `#1c2230` |
| Lijnen/randen | `#2a3140` |
| Tekst | `#e6edf3` |
| Gedimde tekst | `#8b949e` |
| Accent (blauw) | `#3b82f6` / `#2563eb` |
| Groen (winst/koop) | `#22c55e` |
| Rood (verlies/stop) | `#ef4444` |
| Oranje (let op) | `#f59e0b` |

Verdere stijlkenmerken:
- **Typografie:** systeem-sans (-apple-system / Segoe UI / Roboto), ~15px basis,
  tabular-nums voor getallen/prijzen.
- **Vormtaal:** afgeronde hoeken (kaarten ~13px, knoppen ~9px), zachte 1px-randen,
  subtiele gradiënten op header en samenvattingskaart.
- **Badges/pills:** gekleurde status-labels (groen/geel/rood/blauw/oranje/grijs)
  met bijpassende donkere achtergrond + rand.
- **Iconografie:** emoji als lichte iconen (📊 🎯 📈 👥 🚀 🛑 🔔 ✅).
- **Componenten:** kaarten-grid (auto-fill, min 300px), data-tabellen met
  horizontale scroll op mobiel, voortgangsbalk, toast-meldingen onderaan.
- **Mobiel-first:** veilige-zone-padding (notch), sticky header + tabbalk.

---

## 5. Tone of voice

Nuchter, behulpzaam, Nederlandstalig, niet hypend. Altijd de disclaimer dat het
**geen financieel advies** is en dat de gebruiker de live koers op eToro moet
checken voordat hij een order plaatst.

---

## 6. Mogelijke design-opdrachten (suggesties)

- Een **modern herontwerp** van de drie hoofdschermen (Analyse, Mijn Trades,
  eToro Traders) met dezelfde donkere fintech-stijl, maar verfijnder.
- Een **app-icoon** ("Crypto Copy-Trading") en splash screen.
- Een mooi ontwerp voor de **pushmelding-kaart** en de meldingen zelf.
- **Trade-kaart**-component (live prijs, voortgangsbalk entry→take-profit,
  advies-badge) als hero-component.
- Een set **store-/promo-screenshots**.
