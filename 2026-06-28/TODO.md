# TODO

Onze gezamenlijke takenlijst voor de Crypto Copy-Trading app.
We kunnen hier dingen aan toevoegen en afvinken terwijl we werken.

## Hoe werkt dit? (voor noobs 👍)

Dit is gewoon een tekstbestand. Elke taak is een regel die begint met `- [ ]`.

- `- [ ]` = nog te doen (leeg vakje)
- `- [x]` = klaar (afgevinkt)

Afvinken doe je door de spatie tussen de blokhaken te vervangen door een `x`.
Op GitHub en in veel editors zie je dan een echt aanvinkbaar vakje. ✅

Voeg gerust nieuwe taken toe onderaan de juiste sectie. Geen verkeerde manier — typ
gewoon een nieuwe regel die begint met `- [ ]`.

---

## 🔥 Nu mee bezig

_(Verplaats hier de taak waar we op dit moment aan werken, zodat we het overzicht houden.)_

- [ ] **Analyse-engine porten:** `engine.js` overzetten naar de Expo-app (`app/`) in TypeScript.
  Python `src/` blijft de referentie/"bron van waarheid" voor de berekeningen.

## 🎨 Huisstijl & Branding

- [x] EM-dashes verwijderd uit alle app-teksten (`App.tsx`, `README.md`)
- [x] App hernoemd naar **Kader** in alle bestanden (naam, slug, package-id `com.kevinhelgers.kader`)
- [x] Teksten en naamgeving aangepast op basis van `docs/huisstijl-kader.md` — slogan, tone of voice
- [x] Kader-logo gegenereerd en in `app/assets/` geplaatst (icon.png 1024×1024, splash-icon.png, adaptive icons, favicon)

## 💡 Ideeën / wensen

_(Dingen die je leuk of handig zou vinden, nog niet ingepland.)_

- [ ] Inloggen? Zo ja, database?
- [ ] Wens: portfolio uit eToro kunnen halen zodat je je trades niet zelf hoeft in te vullen

## 🛠️ Te doen

### Migratie naar native app (React Native + Expo)
- [x] Kale Expo-app opzetten + lokaal een installeerbare APK bouwen (bewijs dat de gratis bouw-/sideload-loop werkt). JDK 17 bleek niet nodig — Android Studio's JBR (OpenJDK 21) volstaat. Project staat in `app/`, gebouwd vanuit `D:\dev\crypto-market`.
- [ ] Analyse-engine porten: `engine.js` overzetten naar de Expo-app (TypeScript). Python `src/` blijft de referentie/"bron van waarheid" voor de berekeningen.
- [ ] Schermen (her)bouwen op basis van Kevin's UX/UI-keuzes: Marktanalyse, Grote kansen, Mijn Trades, eToro-traders, onboarding.
- [ ] Pushmeldingen + lokale opslag aansluiten (`expo-notifications`, `expo-sqlite`).
- [ ] Desktop-versie (Python web-UI: `app.py` + `app_ui.py`) uitfaseren/verwijderen zodra de native app de functies overneemt.

### Functioneel / inhoud
- [ ] eToro API integratie en mogelijkheden uitwerken.
- [x] Grote Kansen laat nu ook niet tradable coins zien bij eToro. Wellicht mogelijk met API de scan te filteren op enkel tradable coins
- [ ] Copy trading uitwerken, makkelijkere stappen
- [ ] User Onboarding in de app
- [ ] Volledig app design maken (Kevin — UX/UI; zie pointers in `docs/native-app-techniekkeuze.md`)
- [ ] Account? Vrienden?

## 🐛 Bugs / dingen die kapot zijn

_(Werkt iets niet zoals verwacht? Schrijf het hier op, ook al weet je nog niet waarom.)_

- [ ] _(nog niks)_

## ✅ Klaar

_(Afgevinkte taken mogen hierheen verhuizen, zodat we kunnen terugzien wat we al gedaan hebben.)_

- [x] TODO-lijst aangemaakt 🎉
- [x] Techniekkeuze native app onderzocht → **React Native + Expo** ([`docs/native-app-techniekkeuze.md`](docs/native-app-techniekkeuze.md))
- [x] Kale Expo-app gebouwd en via ADB geverifieerd op emulator ("Hallo wereld — Crypto Markt — app werkt!"). Project verplaatst naar `D:\dev\crypto-market` (lokaal, geen netwerkdrive).
- [x] **Analyse-uitleg voor de gebruiker** (`feat/analyse-uitleg-ui`) — "📖 Hoe werkt dit?" subtab in `src/app_ui.py` met scorekaart, interactieve score-simulator, ATR-rekenmachine en visuele scorebalk + signaal-badges op elke analysekaart.
