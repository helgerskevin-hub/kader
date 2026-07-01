# Kader — Huisstijl & Design System

> Persoonlijke crypto copy-trading app. Structuur in crypto. Geen hype, gewoon data.

---

## 1. Merknaam & Identiteit

### Naam: Kader

Gekozen op basis van merkanalyse (juni 2026). Kader wint op alle criteria:

| Criterium | Toelichting |
|-----------|-------------|
| **Betekenis** | Een kader biedt houvast, grenzen en structuur — exact wat de app doet in een chaotische cryptomarkt. Entry, stop-loss en take-profit zijn de harde kaders. |
| **Syllabe-regel** | Twee lettergrepen: compact en sterk op een app-icoon. |
| **Geen beschrijvende woorden** | Geen "Crypto", "Trade", "Coin" of "Bot" in de naam — dat straalt wantrouwen uit. |
| **Harde medeklinkers** | K en D (Bouba/Kiki-effect): psychologisch daadkrachtig en betrouwbaar. |
| **Visueel** | Prachtig in een strak lettertype zoals Inter of IBM Plex Sans. |

### Slogans / Pay-offs

- **Kader — Structuur in crypto.**
- **Kader — Grip op de markt.**
- **Geen hype, gewoon data.**

### Alternatieven (runners-up)

| Naam | Kern van de betekenis |
|------|----------------------|
| Kern | Essentie, geen ruis, puur data |
| Borg | Borgen/veiligstellen — risk/reward focus |
| Ratio | Risk/reward ratio, wiskundig en koud |
| Spiegel | Letterlijke vertaling van copy-trading |
| Vizier | Precisie, scherpe entry en stop-loss |

---

## 2. Merkpersoonlijkheid & Tone of Voice

- **Nuchter** — geen "to the moon"-taal, geen hype, geen beloftes
- **Technisch intelligent** — onderbouwde signalen, altijd met reden
- **Betrouwbaar** — helder, direct, consistent
- **Behulpzaam** — signalen ter ondersteuning van eigen onderzoek, geen financieel advies

**Voorbeeldtoon in de UI:**
- ✓ "Koers nadert je doel met sterk momentum — overweeg take-profit te verhogen."
- ✗ "🚀 Naar de maan! Nu kopen!"
- Altijd: "Geen financieel advies — check altijd de live koers op eToro."

---

## 3. Kleurpalet

Stijl: **Swiss Modernism** · Licht thema (default) · Gedeeld dark token systeem.

Regel: **kleur nooit als enige signaal** — altijd gecombineerd met label of icoon (WCAG AA).

### Licht thema (default)

#### Oppervlak & Tekst

| Token | Waarde | Gebruik |
|-------|--------|---------|
| Achtergrond | `#F8FAFC` | App-achtergrond |
| Kaart | `#FFFFFF` | Kaartoppervlak |
| Verhoogd / muted | `#EEF2F7` | Subtiele achtergronden, input-fields |
| Rand / divider | `#E2E8F0` | Randen, scheidingslijnen |
| Tekst primair | `#0F172A` | Hoofdtekst |
| Tekst gedimd | `#64748B` | Labels, captions, secundaire info |

#### Merk & Semantiek

| Token | Waarde | Gebruik |
|-------|--------|---------|
| Primair / brand | `#1E3A8A` | Merk, accentkleur, logo |
| CTA / interactief | `#2563EB` | Knoppen, links, actieve staat |
| Winst / koop | `#16A34A` | Positief resultaat, koopsignaal |
| Verlies / stop | `#DC2626` | Negatief resultaat, stop-loss |
| Let op | `#D97706` | Waarschuwing, "overweeg" |
| Premium / goud | `#A16207` | Score-indicatoren, speciaal accent |

### Donker thema (optioneel, gedeelde tokens)

Eén systeem — de toggle wisselt alleen de waarden. Layout, spacing en componenten blijven identiek.

#### Oppervlak & Tekst

| Token | Waarde |
|-------|--------|
| Achtergrond | `#0E1117` |
| Kaart | `#161B22` |
| Verhoogd / muted | `#1C2230` |
| Rand / divider | `#2A3140` |
| Tekst primair | `#E6EDF3` |
| Tekst gedimd | `#8B949E` |

#### Merk & Semantiek

| Token | Waarde |
|-------|--------|
| Primair / brand | `#3B82F6` |
| CTA / interactief | `#2563EB` |
| Winst / koop | `#22C55E` |
| Verlies / stop | `#EF4444` |
| Let op | `#F59E0B` |
| Premium / goud | `#D4A24E` |

**Beide thema's halen WCAG AA** — winst/verlies blijft groen/rood mét label, nooit kleur alleen.

---

## 4. Typografie

Twee lettertypen, elk een vaste rol:

| Lettertype | Gebruik |
|------------|---------|
| **IBM Plex Sans** | Alle UI-tekst, koppen, labels, body |
| **IBM Plex Mono** | Alle cijfers: prijs, %, R/R, score (`tabular-nums`) |

### Schaal

| Stijl | Grootte / Gewicht | Toepassing |
|-------|-------------------|------------|
| Display | 28px / 700 | Grote titels, welkomstscherm |
| Titel | 21px / 600 | Schermtitels, kaartkoppen |
| Sectiekop | 16px / 600 | Sectiescheidingen |
| Body | 15px / 400 | Broodtekst, beschrijvingen |
| Caption / label | 12.5px / 500 | Labels onder iconen, meta-info |
| Overline | 11px / 600, 0.8 tracking | Categorielabels boven content |

**Regelhoogte:** 1.5–1.6 voor comfortabel lezen.

### Cijfers (IBM Plex Mono)

| Type | Voorbeeld |
|------|-----------|
| Prijs | `$64.213` |
| Winst/verlies | `+4,82%` |
| Risk/reward | `1 : 2,4` |
| Score | `78` |

Altijd met expliciet `+`/`−` teken, duizendtallen gescheiden, geen springende cijfers bij live updates.

---

## 5. Spacing & Vorm

**8px-basis** — rust door witruimte, niet door randen.

### Spacing-schaal

`4 · 8 · 12 · 16 · 24 · 32`

### Border radii

| Component | Radius |
|-----------|--------|
| Invoerveld | 8px |
| Knop | 12px |
| Kaart | 16px |
| Pill / badge | pill (volledig rond) |

### Elevatie

| Niveau | Toepassing |
|--------|------------|
| Rust | Achtergrond, app-oppervlak |
| Kaart | Trade-kaarten, samenvatting |
| Modal | Overlays, bottom sheets |

---

## 6. Iconografie

**Lucide Icons** — 1.75px stroke, 24px raster, `currentColor`, ronde uiteinden.

Geen emoji als structureel icoon. Een icon-only knop krijgt altijd een `aria-label`.

### Icoonset

| Icoon | Betekenis |
|-------|-----------|
| `activity` | Markt |
| `zap` | Kansen |
| `wallet` | Portfolio |
| `users` | Traders |
| `trending-up` | Winst |
| `trending-down` | Verlies |
| `target` | Take-profit |
| `octagon` | Stop-loss |
| `bell` | Melding |
| `candlestick` | Grafiek |
| `search` | Zoeken |
| `refresh` | Vernieuwen |
| `check-circle` | Getrade/bevestigd |
| `alert-triangle` | Risico |
| `copy` | Copy-trade |
| `info` | Over coin |

---

## 7. Componenten

### Trade-kaart (hero)

De centrale UI-eenheid. Bevat:
- Coin-naam + symbool + handelspaarnaam
- Huidige koers (IBM Plex Mono)
- Adviesbadge (NEEM WINST / VERKOOP NU / etc.)
- Entry, stop en target niveaus met voortgangsbalk (entry → doel)
- Resultaat: `+12,4% · +€148`
- Knoppen: **Gesloten markeren** · **Detail**

Adviesrand: gekleurde linkerrand op basis van adviesbadge.

### Knoppen

Raakdoel minimaal **44px**. Varianten:
- **Primair** — gevuld, `#2563EB` — "Start analyse"
- **Secundair** — omlijnd
- **Subtiel** — geen rand
- **Koop / Getrade** — groen accent
- **Verwijderen** — rood, destructief

Invoervelden: `inputmode="decimal"` voor cijfers, label altijd zichtbaar (niet als placeholder vervangen).

### Adviesbadges (in Mijn Trades)

| Badge | Kleur |
|-------|-------|
| VERKOOP NU | Rood (`#DC2626`) |
| NEEM WINST | Groen (`#16A34A`) |
| OVERWEEG WINST | Amber (`#D97706`) |
| HOUD VAST | Grijs neutraal |
| LET OP | Amber (`#D97706`) |

### eToro-oordeel (in Traders)

`Kopieer` · `Volg` · `Vermijd`

### Signaalscore-meter (0–100)

| Score | Label | Kleur |
|-------|-------|-------|
| 70–100 | STERK | Groen |
| 40–69 | GEMENGD | Amber |
| 0–39 | ZWAK | Rood |

### KPI-samenvatting (max 5 vakjes)

`Open` · `Ingelegd` · `Waarde` · `Totaal W/V` · `Actie`

### Onderbalk (tabnavigatie)

Max 5 items: icoon + label. Tabs:
- **Markt** (`activity`)
- **Kansen** (`zap`)
- **Portfolio** (`wallet`)
- **Traders** (`users`)

### Sparkline & Candlestick

- Sparkline 24u: enkelvoudige lijn met `+%` label
- Candlestick grafiek met niveaulijnen: STOP · ENTRY · DOEL

---

## 8. Schermen & States

Elk scherm heeft 4 vaste states:

| State | Beschrijving |
|-------|-------------|
| ● Gevuld | Data geladen, normale werking |
| ○ Leeg | Nog geen data of trades |
| ◐ Laden | Actief ophalen / scannen |
| ⚠ Fout | Netwerk/timeout fout met retry-optie |

### Schermoverzicht

#### Markt (Marktanalyse)
- 12 coins geanalyseerd · tijdstempel
- Sorteermogelijkheid
- Trade-kaarten per coin: score, stop, entry, doel, R/R, RSI, koopzone-badge
- "Over deze coin" uitklapbaar

#### Kansen (Grote kansen)
- Risicowaarschuwing: speculatief, hoog risico, kleine marktcap
- Kandidaten: naam, koers, market cap, 7d%, momentum-label, tot ATH%, volume-ratio, uitleg

#### Portfolio (Mijn Trades)
- Trade Waarde, Totaal W/V, Actie nodig (KPI-bar)
- Pushmeldingen-kaart: aan/uit, controle elke 10 min, testknop, tijdstempel
- Open posities als trade-kaarten
- Gesloten posities als tabel

#### Traders (eToro)
- Beoordelingsformulier: naam, Risk Score 1–7, maandrendementen, drawdown, jaarrendement, allocatie
- Score /100 met kleurcodes (consistentie, risico, spreiding)
- Aanbevolen Copy Stop Loss %
- Copy-trading in 3 stappen: Bedrag kiezen · Stop-loss instellen · Op eToro bevestigen

---

## 9. Onboarding (5 stappen vóór hoofdnavigatie)

1. **Welkom** — "Nuchtere technische signalen die jóuw onderzoek ondersteunen — geen hype, geen beloftes."
2. **Hoe het werkt** — Markt analyseren · eToro-traders volgen · Op tijd gewaarschuwd
3. **Disclaimer (akkoord vereist)** — "Deze app levert technische signalen. Geen beleggingsadvies, geen garantie op rendement. Crypto is volatiel."
4. **Meldingen** — Controle elke 10 min, alleen melding bij actie nodig
5. **Klaar** — "Naar Markt"

---

## 10. Pushmeldingen

Twee triggers:
1. **Take-profit verhogen** — koers nadert doel met sterk momentum (MACD bullish, RSI niet extreem)
   - *"SOL — verhoog je take-profit · Naar $182,40 — koers nadert je doel met sterk momentum (trend op, MACD bullish, RSI 64). De winst kan doorlopen."*
2. **Stap eerder uit** — winst aanwezig maar momentum vlakt af (RSI overbought, MACD bearish)
   - *"BTC — stap eerder uit · Trek je stop-loss op naar $63.900 (was $61.000). RSI overbought (79), MACD draait bearish — winst vastzetten."*

Altijd voettekst: "Geen financieel advies · check de live koers op eToro"

---

## 11. Thema-toggle (Instellingen)

- Licht (standaard)
- Donker (optioneel)
- Volg systeeminstelling

Eén component- en layoutsysteem, twee waardesets. De toggle wisselt alleen de kleurwaarden.

---

## 12. Platform & Technologie

| | |
|-|-|
| Platform | Android (React Native + Expo) |
| Interface-taal | Nederlands |
| Data | Binance API + CoinGecko (publiek, gratis) |
| Verwerking | On-device — geen server |
| Opslag | Lokaal (AsyncStorage) |
| Meldingen | Native push (Expo Notifications) |
| Marktcheck-interval | Elke 10 minuten |

**App-id:** `com.kader.app`

---

*Kader — Structuur in crypto.*
