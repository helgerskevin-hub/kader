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

---

# UX/UI-rapport — lichte, heldere & intuïtieve crypto-app

> Bron: dit rapport is opgesteld met de **UI UX Pro Max**-skill
> (`nextlevelbuilder/ui-ux-pro-max-skill`, geïnstalleerd in
> `.claude/skills/ui-ux-pro-max/`). De keuzes hieronder komen uit de
> reasoning-databases van de skill (styles · colors · typography · charts ·
> ux-guidelines), bijgesteld op de expliciete eis: **een licht, rustig en
> overzichtelijk thema** in plaats van de standaard "dark crypto"-look.

De skill koos voor een crypto/fintech-app standaard een **donker** thema (style
*"Modern Dark / Cinema Mobile"*). Omdat we juist een **lichte, heldere** app
willen, is op de domeinen `style` en `color` gericht doorgezocht naar
licht-volledige, hoog-contrast opties. De onderstaande aanbeveling combineert die
resultaten.

## 1. Gekozen richting (skill-onderbouwd)

| Laag | Keuze uit de skill | Waarom |
|------|--------------------|--------|
| **Pattern** | *Minimal Single Column* | Veel witruimte, één duidelijke CTA per scherm, mobile-first — precies "rustig & intuïtief". |
| **Stijl (basis)** | *Swiss Modernism 2.0* | Licht-volledig, **WCAG AAA**, strak 12-koloms grid, wiskundige 8px-spacing, één accentkleur. De helderste, meest leesbare optie. |
| **Stijl (data)** | *Executive Dashboard* | Grote KPI-kaarten, stoplicht-indicatoren (groen/geel/rood), trend-sparklines, "at-a-glance" — ideaal voor trade- en samenvattingskaarten. |
| **Kleur** | *Banking/Traditional Finance* (light) | Het enige licht-achtergrond fintech-palet: witte kaarten op `#F8FAFC`, trust-navy primair, contrast op orde. |
| **Typografie** | *Inter* (300–700) | Door de skill aanbevolen voor fintech/trading: technisch, helder, premium. |

> Anti-patterns die de skill expliciet noemt voor fintech en die we vermijden:
> **speelse vormgeving**, **onduidelijke kosten/fees**, en **paars/roze
> AI-gradiënten**.

## 2. Lichte kleurtokens

Skill-palet *Banking/Traditional Finance* (licht), aangevuld met de
winst/verlies-semantiek van de *Executive Dashboard*-stijl. Naast elke rol staat
het huidige donkere token, zodat een **light/dark-toggle** beide sets kan delen.

| Rol | Licht (nieuw) | (huidig donker) |
|-----|---------------|-----------------|
| Achtergrond (app) | `#F8FAFC` | `#0e1117` |
| Kaart/paneel | `#FFFFFF` | `#161b22` |
| Verhoogd paneel / muted | `#E8ECF1` | `#1c2230` |
| Lijnen/randen | `#E2E8F0` | `#2a3140` |
| Tekst (primair) | `#020617` | `#e6edf3` |
| Gedimde tekst | `#64748B` | `#8b949e` |
| Primair (trust-navy) | `#0F172A` | — |
| Accent / CTA | `#1E3A8A` | `#3b82f6` |
| Premium-accent (goud) | `#A16207` | `#f59e0b` |
| Groen (winst/koop) | `#16A34A` | `#22c55e` |
| Geel (let op) | `#F59E0B` | `#f59e0b` |
| Rood (verlies/stop) | `#DC2626` | `#ef4444` |

**Contrast-eisen van de skill (light mode, onafhankelijk testen):** primaire
tekst ≥ **4.5:1**, secundaire tekst ≥ **3:1**, randen/dividers zichtbaar. De
verzadigde groen/rood/geel zijn bewust iets donkerder dan in dark mode om op
witte kaarten te halen. **Kleur nooit als enige betekenisdrager** — altijd met
label of vorm-icoon (kleurenblindheid).

## 3. Typografie & getallen

- **Inter** als enige familie (heading + body). Import:
  `https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap`.
- **Body ≥ 16px**, regelhoogte **1.5–1.75**, regellengte 65–75 tekens.
- **Heading Clarity (ux-rule):** koppen duidelijk groter + zwaarder dan body —
  nooit zelfde grootte als de tekst.
- **Number Formatting (ux-rule):** duizendtalscheiding of afkorting (`1.234` /
  `1,2K`), nooit lange ongeformatteerde getallen (`1234567`). W/V altijd met
  expliciet teken (`+2,4%` / `−1,1%`).
- **`tabular-nums`** op alle prijzen/percentages, zodat live updates niet
  "springen".
- **Mobile Keyboards (ux-rule):** `inputmode="numeric"`/`decimal` op de
  trade-formuliervelden (entry, stop, take-profit, bedrag).

## 4. Spacing, layout & motion

- **8px-spacingsysteem** (Swiss Modernism) — 4/8/16/24/32. Rust ontstaat door
  ritme en witruimte, niet door randen.
- **12-koloms grid** op breder scherm; **mobile-first** met breekpunten
  **375 / 768 / 1024 / 1440px**; geen horizontale scroll.
- **Kaart-grid** (auto-fill, min ~320px) met ruime binnenmarge (~16–20px).
- **Motion:** micro-interacties **150–300ms**, alleen `transform`/`opacity`,
  exit-animaties ~60–70% sneller dan entry, en **`prefers-reduced-motion`
  respecteren**. KPI-cijfers mogen "count-up", trendpijl-richting animeren.
- **Safe areas** voor notch/statusbar; sticky header + onderbalk, content nooit
  achter de balken verborgen.

## 5. Iconografie — let op (afwijking van de huidige app)

De skill is hier expliciet: **geen emoji als structurele iconen** — gebruik een
consistente SVG-set (**Lucide** of **Heroicons**) en geef icon-only knoppen een
`aria-label`. De huidige app gebruikt bewust emoji (📊 🎯 🛑 🔔) als lichte,
vriendelijke iconen.

Advies: migreer de **functionele/structurele** iconen (tab-bar, knoppen,
stop/doel-markers) naar Lucide voor scherpte, schaalbaarheid en toegankelijkheid;
emoji mogen blijven als **incidenteel sfeer-accent** in koppen/microcopy, passend
bij de nuchtere toon. Eén icon-familie per rol, consistent doorvoeren.

## 6. Sleutelcomponenten

**Trade-kaart (hero) — Executive-Dashboard-aanpak:**
- Grote live prijs + gekleurd W/V; **stoplicht-indicator** (groen/geel/rood) als
  border-left of statuspil voor de advies-badge (VERKOOP NU / NEEM WINST /
  OVERWEEG WINST / HOUD VAST / LET OP).
- Horizontale **voortgangsbalk** met drie ankers: 🛑/■ stop (rood) — ■ entry
  (grijs) — 🎯/■ doel (groen), plus een marker voor de huidige koers.
- **Sparkline** (zie §7) voor de recente koers; één primaire knop, "verwijderen"
  als rustige tekst-link.

**Analyse-kans-kaart:** entry-zone, stop, doel, R/R en signaalscore. Toon de
score als compacte ring/staaf (KPI-stijl) i.p.v. kaal getal. Indicatoren
(RSI/MACD) en "Over deze coin" achter een rustige uitklap (progressieve
onthulling).

**eToro-resultaatkaart:** 🟢/🟡/🔴-oordeel groot, totaalscore als ring,
aanbevolen Copy Stop Loss % in een apart vak, onderbouwing als drie korte regels.

**Samenvattingskaart:** 4–6 KPI-vakjes (Executive Dashboard adviseert max 4–6),
grote cijfers (24–48px), stoplicht-kleuren voor "Actie nodig".

**Data-tabellen (Gesloten posities, Traders kopiëren):** waarde-labels zichtbaar,
horizontale scroll op mobiel; overweeg multi-select/bulk-acties (ux-rule) als de
lijst groeit.

## 7. Grafieken (skill chart-database)

| Use-case | Type | Kleur / a11y |
|----------|------|--------------|
| Koersverloop in trade-kaart | **Line / Area** (sparkline) | lijn-primair, vulling 20%; <4 punten → toon een stat-card i.p.v. grafiek |
| Detail koers (optioneel) | **Candlestick** (OHLC) | bullish `#26A69A` / bearish `#EF5350`; **gevuld vs hol** als kleurenblind-alternatief; voeg OHLC-tabel toe |
| Vergelijken (bijv. traders/coins) | **Bar** (gesorteerd, aflopend) | waarde-labels altijd zichtbaar (AAA) |
| Trader-profiel (consistentie/risico/portfolio) | **Radar** (2–3 sets, 5–8 assen) | altijd ook een grouped-bar/tabel als alternatief |

A11y-rode draad: onderscheid series met **lijnstijl/patroon**, niet met kleur
alleen; bied een tabel-fallback met tijdstempels en waarden.

## 8. UX-prioriteiten & toegankelijkheid (skill-rules)

- **Accessibility (hoog):** `aria-label` op icon-only knoppen; betekenisvolle
  iconen/afbeeldingen krijgen tekstalternatief; zichtbare focus-ringen voor
  toetsenbordnavigatie.
- **Touch:** raakdoelen ≥ **44×44px**, ≥ 8px tussenruimte, duidelijke
  pressed-feedback (opacity/ripple) binnen 80–150ms zonder layout-verschuiving.
- **Forms & Feedback:** zichtbare labels (geen placeholder-only), inline-validatie
  on-blur, foutmelding náást het veld, hulptekst bij complexe opties.
- **Navigatie:** onderbalk **≤ 5 items** met icoon + label; scrollpositie bewaren
  bij terug; consistente plaatsing.
- **Disclaimer:** vaste, gedimde regel ("Geen financieel advies — check de live
  koers op eToro"), niet als terugkerende pop-up.

## 9. Pre-delivery checklist (uit de skill)

- [ ] Geen emoji als **structurele** iconen (SVG: Lucide/Heroicons)
- [ ] Light mode: primaire tekst ≥ 4.5:1, secundair ≥ 3:1 — onafhankelijk getest
- [ ] Randen/dividers zichtbaar in light mode
- [ ] Raakdoelen ≥ 44×44px, duidelijke pressed-feedback zonder layout-shift
- [ ] Micro-interacties 150–300ms, `prefers-reduced-motion` gerespecteerd
- [ ] Responsief geverifieerd op 375 / 768 / 1024 / 1440px, geen horizontale scroll
- [ ] Getallen geformatteerd (`tabular-nums` + scheidingstekens), `inputmode` op
      numerieke velden
- [ ] Kleur niet de enige betekenisdrager (label/vorm erbij)
- [ ] Safe areas gerespecteerd; content niet achter header/onderbalk

## 10. Eerste stap

Begin bij de **trade-kaart** als hero-component in het lichte thema (tokens §2,
Executive-Dashboard-opzet §6): die ene component zet hiërarchie, kleurgebruik en
rust neer en is direct herbruikbaar in Analyse én Mijn Trades. Daarna de twee
andere hoofdschermen in dezelfde *Swiss Modernism + Executive Dashboard*-stijl,
en als laatste een light/dark-toggle die beide token-sets deelt.

> De skill is lokaal geïnstalleerd; nieuwe of verdiepende zoekopdrachten kunnen
> met:
> `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <style|color|typography|chart|ux> -n <n>`
> of een volledige systeem-generatie met `--design-system -f markdown`.
