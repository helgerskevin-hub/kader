# App-vergrendeling: ontwerp en gemaakte keuzes

Kader kan echte eToro-orders plaatsen en laat portfolio en saldo zien. Wie een ontgrendelde telefoon
oppakt, kon de app tot nu toe zonder drempel openen. Dit document beschrijft het slot zoals het
gebouwd is: een pincode van zes cijfers plus toestelbiometrie. Het is opt-in, en verplicht zodra
eToro gekoppeld is. Echte orders vragen daarbovenop een bevestiging.

De bron voor de code is het contract `app/src/state/vergrendelTypes.ts`. Dit document legt het
ontwerp, de copy en de keuzes vast, zodat een latere wijziging niet per ongeluk een besluit
terugdraait.

## Beslissingen (vast)

1. De hele app zit achter het slot: een overlay, de tabs blijven gemount.
2. Opnieuw vergrendelen na Direct / 30 s / 1 min (standaard) / 5 min / 15 min op de achtergrond. Een
   koude start is altijd vergrendeld.
3. Zes cijfers, ontgrendelt bij het zesde cijfer zonder bevestigknop. Zwak en dus geweigerd: zes
   gelijke cijfers en strikt oplopende of aflopende reeksen (012345, 123456, 987654). Een reeks die
   om de tien heen loopt (890123, 901234) is niet zwak.
4. Alle toestelbiometrie mag (vingerafdruk, gezicht; `biometricsSecurityLevel: 'weak'`). De pincode
   blijft altijd de terugval.
5. Opt-in vanuit de onboarding, Instellingen > Beveiliging en "Nieuw in Kader". Verplicht bij een
   eToro-koppeling.
6. Pincode vergeten: herstel via het Android-schermslot (alleen pincode, patroon of wachtwoord van
   het toestel, geen biometrie). De data blijft staan.
7. Instellen kan alleen met een schermslot op de telefoon. Is dat later weg, dan zegt "Pincode
   vergeten?" dat het eerst terug moet. Geen doodlopende route.
8. Na 5 foute pogingen een wachttijd: 30 s, 1 min, 5 min, daarna steeds 15 min. Een goede pincode zet
   de teller terug. De app wist nooit iets. Biometrie en herstel werken tijdens de wachttijd.
9. Een echte order vraagt na het vasthouden van de knop om biometrie, met de pincode als terugval.
   Demo blijft zoals het was.
10. Bestaande gebruikers met een eToro-koppeling stellen bij de eerste start na de update een pincode
    in. De enige uitweg is "Koppeling verwijderen".
11. In Recente apps is de inhoud afgedekt zolang het slot aan staat. Screenshots blijven werken, geen
    `FLAG_SECURE`.

## Variant Hoekhaken

Gekozen uit drie varianten (Rustig, Hoekhaken, Merkvlak). De zes stippen staan tussen vier hoekhaken,
afgeleid van `HOEKEN` in `KaderLogo.tsx` (via `haakVorm()`), zodat het slot hetzelfde kader tekent als
het logo.

- Haken zijn vier losse SVG-hoeken van 16 x 16 dp, kleur `tekstGedimd`. Los, zodat ze apart naar
  binnen kunnen schuiven.
- Fout: haken en stippen kleuren `verlies` en schudden mee. De rode stippen blijven 450 ms staan,
  daarna is de invoer leeg; de melding blijft tot het volgende cijfer.
- Succes: de haken schuiven 8 dp naar binnen, het kader sluit. Daarna vervaagt het slot met schaal
  naar 1,04.

### Indeling, van boven naar onder

1. Logo: 56 dp vanaf een schermhoogte van 740, 40 dp van 620 tot 739, daaronder geen logo.
2. Titel.
3. Statusregel met een vaste hoogte van 48 dp (melding, of na 150 ms een bezig-indicator met label
   "Pincode wordt gecontroleerd" zolang de controle loopt).
4. Stippen: 14 dp, 16 dp tussenruimte, leeg is een ring van 1,5 dp in `tekstGedimd`, gevuld is vlak
   in `tekstPrimair`. Een gevulde stip ploft van 0,6 naar 1 met `veer.speels`.
5. `Pincode vergeten?` (minimaal 44 dp hoog).
6. Toetsenbord 3 x 4, onderste rij [biometrie] [0] [wissen].

Alleen de kop (logo, titel, status) scrolt bij een grote lettergrootte; stippen en toetsenbord staan
vast. Het slot vult zijn eigen achtergrond en houdt rekening met de veilige zones (de Modal is
edge-to-edge).

### Toetsen

- 72, 60 of 52 dp (dezelfde schermhoogtegrenzen als het logo), tussenruimte 24, 20 of 16 dp. De
  mockup kent alleen 72/24, de kleinere maten zijn geschaald. `hitSlop` 6.
- Kleur `colors.verhoogd`, ingedrukt `colors.rand`, via `Drukbaar` (schaal 0,94; onder Minder
  beweging dimt hij in plaats van te schalen).
- Cijfers in `Fonts.monoMedium` 28, tabulair, `maxFontSizeMultiplier` 1,3.
- Eigen toetsenbord, geen `TextInput`.
- Tijdens een wachttijd zijn de cijfertoetsen gedimd (0,4) en uitgeschakeld; de biometrie-toets blijft
  actief. Wissen is ook gedimd als er niets te wissen is. Tijdens een controle is de biometrie-toets
  uitgeschakeld.

### Kleur

- `letOp` alleen als icoon, nooit als tekst (contrast).
- De link is `cta` in licht en `primair` in donker.
- Tekst op een primaire knop is `#FFFFFF` (constante `OP_KNOP`, er is geen token voor).
- De ECHT-badge in de orderkop is `#B91C1C` (constante `ECHT_ROOD` in `OrderKop.tsx`).

### Biometrische prompt

- Opent automatisch 350 ms na `onShow` van de slot-Modal, één keer per slot-episode, en alleen als de
  app op de voorgrond is. Daarna alleen via de toets.
- Altijd hooguit één prompt tegelijk. Een tweede prompt terwijl er een loopt geeft `'geannuleerd'`.

### Wachtstaat

De stippen worden een aftelling (m:ss, `Fonts.monoMedium` 28, tabulair) met een `Clock`-icoon. De
cijfertoetsen zijn gedimd. De aftelling heeft rol `timer` en is geen live region.

### Beweging en haptiek

- Alleen tokens uit `theme/beweging.ts` en momenten uit `theme/haptiek.ts`.
- Haptiek: `waarschuwing` bij een fout, `succes` bij ontgrendelen, bij "Pincode ingesteld" en bij een
  goede pincode in een pincodevraag. Niets per cijfer.
- Schudden: -12, +12, -8, +8, 0 in ongeveer 300 ms (token `schud.stappen`).
- Slot weg: haken 8 dp naar binnen, dan `vervaag(duur.midden)` plus schaal naar 1,04. De slot-Modal
  blijft gemount tot die animatie klaar is (noodrem 1,5 s).
- Afdeklaag: aan zonder animatie en in dezelfde commit (een gewone View met volle dekking, geen
  effect of Reanimated-waarde ertussen; een fade-in zou inhoud laten doorschemeren), uit met
  `vervaag(duur.kort)` op een aparte Animated.View. Elke wrapper en de root zetten hem via
  `WrapperAfdekking` (in `AfdekLaag.tsx`), zodat alleen die laag hertekent als de afdekking wisselt.
- Minder beweging: geen schud, plof of schaal, alleen `vervaag`.

### Toegankelijkheid

- Elke toets heeft een label ("Wis laatste cijfer", "Ontgrendel met vingerafdruk of gezicht", de
  cijfers).
- De stippen zijn één groep: "Pincode, 3 van 6 cijfers ingevoerd".
- `announceForAccessibility` bij een fout, aan het begin en aan het einde van een wachttijd, bij
  "Pincode juist", "Pincode ingesteld" en bij ontgrendelen.
- Het slot heeft `accessibilityViewIsModal`. De afdeklaag is verborgen voor de schermlezer.

### Terminologie

Overal "pincode", nooit "pin". Overal "Koppeling verwijderen" (bestaande term).

## Staten

De provider kent vier statussen (`SlotStatus`): `laden`, `vergrendeld` (met de vlag `kluisfout`),
`open` en `setupVerplicht`. Het slotscherm toont daaruit een stand (`SlotStand`):

| Stand | Wanneer | Inhoud |
|---|---|---|
| afdekken | koude start tot de kluis gelezen is, en bij terugkomst tot de slot-Modal staat | alleen achtergrond en logo |
| ontgrendelen | `vergrendeld` | titel, stippen, toetsenbord, biometrie-toets als die bruikbaar is |
| wachten | binnen ontgrendelen, er loopt een wachttijd | aftelling in plaats van stippen |
| herstel | na "Pincode vergeten?" | inline uitleg, schermslot-prompt, dan een nieuwe pincode |
| setupVerplicht | eToro gekoppeld zonder pincode | uitleg, "Pincode instellen", "Koppeling verwijderen" met inline bevestiging |
| kluisfout | de kluis is niet leesbaar | uitleg, "Opnieuw proberen" en "Pincode vergeten?" |

Instellen kent de stappen: geen schermslot (blokkeert), huidige pincode (alleen bij wijzigen), kiezen,
herhalen, klaar (1,2 s, daarna verder) en het biometrie-aanbod.

## Copy

### Uit het plan (letterlijk)

**Slotscherm**
- Titel `Voer je pincode in`, sub `Kader is vergrendeld.`
- Fout 1 en 2: `Onjuiste pincode.` Fout 3: `Onjuiste pincode. Nog 2 pogingen.` Fout 4:
  `Onjuiste pincode. Nog 1 poging.`
- Link `Pincode vergeten?`
- Biometrie-toets `Ontgrendel met vingerafdruk of gezicht`
- Prompt `Ontgrendel Kader`, annuleren `Gebruik pincode`
- Biometrie-meldingen: `Niet herkend. Gebruik je pincode.`, `Biometrie is tijdelijk geblokkeerd.
  Gebruik je pincode.`, `Biometrie is geblokkeerd door je telefoon. Gebruik je pincode.`,
  `Biometrie staat uit op je telefoon. Gebruik je pincode.`

**Wachten**
- Titel `Even wachten`, sub `Te veel onjuiste pogingen. Probeer het opnieuw over` met de aftelling.
- Daarna `Probeer het opnieuw.`

**Instellen**
- `Kies een pincode` / `Zes cijfers. Je voert ze in om Kader te openen.`
- `Herhaal je pincode` / `Voer dezelfde zes cijfers nog een keer in.`
- Niet gelijk: `De pincodes komen niet overeen. Kies opnieuw.`
- Te zwak: `Die pincode is te makkelijk te raden. Kies een andere.`
- Wijzigen: `Voer je huidige pincode in` / `Daarna kies je een nieuwe.`, daarna `Kies een nieuwe
  pincode`
- Uitzetten: `Voer je pincode in` / `Om de vergrendeling uit te zetten.`
- Klaar: `Pincode ingesteld` / `Kader vraagt hem voortaan bij het openen.`
- Geen schermslot: `Stel eerst een schermslot in` / `Zonder schermslot op je telefoon kan Kader een
  vergeten pincode niet herstellen. Stel een pincode, patroon of vingerafdruk in bij de
  Android-instellingen en probeer het daarna opnieuw.`

**Biometrie-aanbod**
- `Ontgrendel met vingerafdruk of gezicht` / `Je hoeft je pincode dan niet elke keer in te voeren. De
  pincode blijft altijd beschikbaar als terugval.`
- Knoppen `Zet biometrie aan` / `Niet nu`
- Prompt `Zet biometrie aan voor Kader` / `Bevestig met je vingerafdruk of gezicht.`, annuleren
  `Niet nu`

**Onboarding**
- Titel `Beveilig\nde app`
- Tekst `Stel een pincode in, zodat alleen jij Kader opent. Je kunt ook je vingerafdruk of gezicht
  gebruiken. Zodra je eToro koppelt is een pincode verplicht. Overslaan kan; je vindt het later bij
  Instellingen, onder Beveiliging.`
- Knop `Pincode instellen`, na afloop `Pincode staat aan`

**Wizardstap**
- Titel `Beveilig Kader eerst`
- Tekst `Een eToro-sleutel geeft toegang tot je account. Daarom vraagt Kader eerst een pincode. De
  sleutel wordt pas daarna op dit toestel bewaard.`
- Op de teststap `Je stelt hierna een pincode in.` (de knop heet dan `Verder`)

**Verplichte setup**
- Titel `Beveilig Kader met een pincode`
- Tekst `Je eToro-koppeling staat op dit toestel. Daarom opent Kader voortaan pas na een pincode.`
- Knop `Pincode instellen`, tekstknop `Koppeling verwijderen`, toelichting `Verwijder je de koppeling,
  dan hoef je geen pincode in te stellen.`
- Inline bevestiging, extra zin `Daarna opent Kader zonder pincode.`

**Nieuw in Kader**
- Titel `Kader met pincode`
- Tekst `Open Kader met een pincode, of met je vingerafdruk of gezicht. Zo ziet niemand anders je
  portfolio als je telefoon even ligt. Je kiest zelf hoe snel de app weer op slot gaat.`
- Plek `Instellingen, Beveiliging`, knop `Pincode instellen` (alleen zonder pincode en zonder
  koppeling)

**Instellingen**
- Groep `Beveiliging`
- `App vergrendelen`, sub `Pincode bij het openen van Kader`; met een koppeling `Verplicht zolang eToro
  gekoppeld is`
- `Pincode wijzigen`
- `Vingerafdruk of gezicht`, sub `Biometrie van dit toestel`. Niet beschikbaar: `Stel eerst een
  vingerafdruk of gezicht in bij de Android-instellingen.` Weggevallen: `Staat uit omdat er geen
  vingerafdruk of gezicht is ingesteld op je telefoon.`
- `Opnieuw vergrendelen`: Direct / 30 s / 1 min / 5 min / 15 min
- Voetnoot (slot aan): `Kader vraagt je pincode bij het openen en nadat de app zo lang op de
  achtergrond stond. Echte orders vragen altijd om je vingerafdruk of pincode. Vergeet je je pincode,
  dan herstel je hem met het schermslot van je telefoon; je gegevens blijven staan. In Recente apps
  ziet niemand je saldo.`
- Voetnoot (slot uit): `Met een pincode kan niemand anders Kader openen. Zodra je eToro koppelt, is
  een pincode verplicht.`

**Pincode vergeten**
- Inline `Pincode vergeten?` / `Bevestig met het schermslot van je telefoon. Daarna kies je een nieuwe
  pincode voor Kader. Je gegevens blijven staan.`
- Knoppen `Doorgaan` / `Annuleren`
- Prompt `Bevestig dat jij het bent`. De annuleerknop is die van het systeem (naast
  `DEVICE_CREDENTIAL` is geen eigen knop toegestaan), dus de tekst `Annuleren` uit het plan is niet
  in te stellen; Android toont zijn eigen vertaling.
- Zonder schermslot: `Stel eerst weer een schermslot in op je telefoon, dan kun je je pincode
  herstellen.`

**Order (Echt)**
- Prompt `Bevestig je order` / `{Koop|Verkoop} {SYMBOOL}, {bedrag}. Echt geld.`
- Na annuleren `Order niet verstuurd.` + `Bevestig met pincode`

### Door de bouw toegevoegd

Niet in de bijlage van het plan; nalopen bij een volgende copyronde.

- Kluisfout: titel `Kader kan je pincode niet lezen`, tekst `De beveiligde opslag van je telefoon
  reageert niet. Je gegevens staan er nog. Probeer het opnieuw.`, knop `Opnieuw proberen`.
- Kluisfout bij invoer: `Kader kan je pincode nu niet controleren. Probeer het opnieuw.`
- Herstel mislukt: `Bevestigen lukte niet. Probeer het opnieuw.`
- Opslaan geweigerd: `Kader kon je pincode niet opslaan. Probeer het opnieuw.`
- Geen-schermslot-blokkade: knop `Begrepen`.
- Bezig-indicator: `Pincode wordt gecontroleerd`. Aankondigingen `Pincode juist`, `Ontgrendeld`.
- Pincodevraag bij een order: titel `Voer je pincode in`, sub de orderregel, anders `Om je order te
  bevestigen.`
- Orderregels per sheet: `Koop {symbool}, {bedrag}. Echt geld.`, `Verkoop {symbool}, {bedrag}. Echt
  geld.` (geschat terug te krijgen bedrag), `Koop copy van {username}, {bedrag}. Echt geld.`,
  `Verkoop copy van {username}. Echt geld.`, `Niveaus {symbool}, stop en doel wijzigen. Echt geld.`
  (niveaus wijzigen is geen koop of verkoop, dus eigen copy).
- Uitzetten terwijl eToro gekoppeld is: `Zolang eToro gekoppeld is, blijft de pincode verplicht.`
- Wizard, sleutel zonder pincode: titel `Eerst een pincode`, tekst `Kader bewaart een eToro-sleutel
  alleen achter een pincode. De sleutel is niet bewaard. Stel eerst een pincode in.`; bij een
  kluisfout titel `Pincode niet te controleren`, tekst `Kader kan nu niet controleren of er een
  pincode is, dus de sleutel is niet bewaard. Probeer het opnieuw.`
- Wizard, tijdens het bewaren na de pincode-stap: `Sleutel wordt bewaard`.
- Inline bevestiging "Koppeling verwijderen": de tekst van de bestaande wizard-dialoog plus `Daarna
  opent Kader zonder pincode.`, knoppen `Verwijderen` / `Annuleren`.
- Koppeling verwijderen mislukt (sleutels staan er na het wissen nog): `De koppeling is niet
  verwijderd. Probeer het opnieuw.`
- Wachtende order annuleren in Echt: prompt `Bevestig je order` / `Annuleer order {SYMBOOL}. Echt
  geld.` (zonder symbool `Annuleer order. Echt geld.`).

## Opslag

- **SecureStore** (Keystore, gaat niet mee in back-ups):
  - `kader_slot_pin` = `{v, alg: "pbkdf2-sha256", it, salt, hash}`. Het slot staat aan zodra dit
    record bestaat; er is geen losse vlag.
  - `kader_slot_pogingen` = `{v, fouten, blokkade}`.
- **AsyncStorage** (`SLEUTELS` in `storage/opslag.ts`): `slotTermijn`, `slotBiometrie`
  ('true'/'false') en `slotIngesteld`, een hint die alleen telt als de kluis niet leesbaar is.
- Schrijven altijd met teruglezen; pas 'ok' als de waarde er precies zo weer uitkomt.
- Een kluisfout betekent nooit "geen pincode". Een onleesbaar of kapot record is een kluisfout, nooit
  'nee'. Een kapotte pogingenstand wordt "vijf fouten, blokkade onbekend": hooguit één extra
  wachttijd, nooit gratis pogingen.
- Volgorde bij een poging: eerst `fouten + 1` wegschrijven, dan verifiëren. Een app-kill midden in de
  controle levert zo geen gratis poging op.
- `stelPinIn` schrijft in deze volgorde: hint, lege teller, record. Mislukt de hint, dan komt er geen
  record (een record zonder hint zou bij een latere kluisfout als "nooit ingesteld" tellen). Mislukt
  daarna de teller of het record terwijl er vooraf geen pincode stond (en nog steeds niet staat), dan
  gaat de hint weer uit.
- Geen record terwijl de hint aan staat, telt als kluisfout ('vergrendeld' met `kluisfout`): een
  record dat zonder uitzetten verdwijnt, mag het slot niet openzetten. Herstel via het schermslot
  blijft de uitweg. Daarom zet uitzetten (`wisSlot`) eerst de hint uit en wist pas daarna het record;
  mislukt het wissen, dan gaat de hint weer aan. De koude start zet de hint nooit zelf terug naar uit.
- Alles wat het record, de teller of de eToro-sleutels schrijft loopt via één rij op moduleniveau
  (`inSlotRij` in `slotOpslag.ts`), ook `bewaarSleutels`. Zo kan een sleutel nooit opgeslagen worden
  tussen de eToro-controle en het wissen van het record bij uitzetten. Niet nesten.
- Tijdslimiet: losse leesacties uit de kluis (`leesPinRecord`, `leesPogingen`) geven na 6 s een
  kluisfout, zodat een hangende SecureStore de rij vrijgeeft en het slot niet eeuwig op een spinner
  staat. Schrijfacties (en het teruglezen dat erbij hoort) worden niet afgebroken: een schrijf die na
  een time-out alsnog landt, zou een stand geven die de provider niet kent. De koude start heeft
  dezelfde grens van 6 s en valt dan op 'vergrendeld' met kluisfout.

## Sleutelafleiding

PBKDF2-HMAC-SHA256 in de lokale Expo-module `app/modules/kader-beveiliging` (Kotlin), via de
platformimplementatie `SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")` met `PBEKeySpec`. Na
gebruik `clearPassword()` en de char-array gewist. Draait als coroutine op `Dispatchers.Default`, zodat
de gedeelde AsyncFunction-wachtrij van Expo (ook die van expo-secure-store) niet blokkeert.

- 32 bytes uitvoer, 16 bytes salt (`SecureRandom`), vergelijking in constante tijd.
- Native invoercontrole: iteraties 10.000 tot 10.000.000, salt 16 tot 256 hextekens, pincode 1 tot 64
  tekens.
- Iteraties: **10.000**. Meting november 2026, debug-build, AVD kader (API 35, 2 vCPU), app stil na
  de marktscan, host-load 8 tot 10: 10.000 iteraties mediaan 529 ms (min 303, max 1742, n=7), 20.000
  mediaan 954 ms, 100.000 mediaan 4637 ms. Het plan begon bij 100.000 en mikte op ongeveer 200 ms; dat
  is op deze emulator niet haalbaar, dus de ondergrens. Een eerdere eigen Mac-lus over Conscrypt was
  sneller, maar is vervangen door de platformimplementatie (minder eigen cryptocode).
- Verhogen kan zonder migratie: een record met minder iteraties dan `PBKDF2_ITERATIES` wordt na een
  geslaagde controle opnieuw gehasht (`moetHerhashen`).
- Hashes van toestel en Node `pbkdf2Sync` zijn gelijk (vastgelegd in het voortgangslog).

## Wachttijd en klok

- De 5e fout geeft 30 s, de 6e 1 min, de 7e 5 min, de 8e en elke volgende 15 min. Na een afgelopen
  wachttijd is er telkens één poging, zoals het Android-schermslot.
- Een wachttijd moet een force-stop, het verzetten van de klok en een reboot overleven. Leidend is de
  monotone klok (`elapsedRealtime`) samen met `Settings.Global.BOOT_COUNT`. Bij een andere of onbekende
  opstartteller telt alleen min(wandverschil, monotoon verschil sinds het anker) af; een
  vooruitgezette wandklok wint dus niets, en na een herstart telt de tijd uit niet mee.
- Biometrie zet de teller niet terug; alleen een goede pincode doet dat.

## Herstel via het schermslot

"Pincode vergeten?" gebruikt `bevestigSchermslot` uit de eigen module, niet expo-local-authentication.
`authenticateAsync` met `disableDeviceFallback: false` maakt er `BIOMETRIC_WEAK | DEVICE_CREDENTIAL`
van, en dan zou een zwakke gezichtsherkenning genoeg zijn om een nieuwe pincode te kiezen. De pincode
van Kader beschermt meer dan de telefoon zelf (echte orders), dus herstel vraagt het sterkste dat het
toestel heeft: het schermslot.

- API 30 en hoger: de framework-`BiometricPrompt` met alleen
  `setAllowedAuthenticators(DEVICE_CREDENTIAL)`. Het systeem toont het schermslot in een eigen venster;
  de app krijgt alleen `blur`, geen `background`.
- Onder API 30: `KeyguardManager.createConfirmDeviceCredentialIntent` via `startActivityForResult`, de
  uitslag via `OnActivityResult` van de Expo Modules API. Dat is een eigen activity, dus de app gaat
  naar `background`; de provider zet daarom `eigenSysteemScherm` rond de aanroep.
- `KeyguardManager.isDeviceSecure` false: `geenSchermslot`. Eén bevestiging tegelijk (een tweede
  geeft `geannuleerd`). `annuleerSchermslot` is de noodklep achter `forceerPromptKlaar`.
- Geen `FLAG_SECURE`.

## AppState en het slot boven Modals

- Plek in de boom: `ThemeProvider > VergrendelProvider > View > (MarktProvider > ... > AppInhoud),
  AfdekLaag, SlotLaag`. De provider staat dus boven `DialoogProvider`. `SlotLaag` en de root-
  `AfdekLaag` staan buiten de takken van `AppInhoud` (laden, onboarding, hoofdtak) en zijn dus in elke
  tak aanwezig zonder opnieuw te mounten.
- Bij `background`: afdekken, het tijdstip bewaren, bij termijn "Direct" meteen vergrendelen.
- Bij `active`: loopt er een prompt, dan wacht de beslissing tot `opPromptKlaar`; anders beslist
  `moetHervergrendelen` (bij twijfel vergrendelen). De afdekking blijft staan tot `onShow` van de
  slot-Modal.
- Geen listener op `blur`: die vuurt ook bij de meldingenbalk en sheets. Een biometrische prompt op
  API 30 en hoger geeft alleen `blur` en vergrendelt de app dus nooit opnieuw.
- `eigenSysteemScherm`: als Kader zelf een systeemscherm opent (share-sheet, de schermslot-activity
  onder API 30) vergrendelt die ene achtergrond niet meteen. De vlag geldt eenmalig en gaat bij elke
  `active` weer uit. De termijn daarna is max(termijn, 1 min).
- Geen inhoudsflits: `SplashScreen.preventAutoHideAsync()` op moduleniveau in
  `VergrendelProvider.tsx` (App.tsx importeert hem daarom bovenaan), `afgedekt` begint op true, de
  splash verdwijnt pas na `onShow` van het slot of bij 'open', met een noodrem na 8 s.
- Slot boven Modals: op Android ligt het laatst getoonde Dialog-venster bovenop. De vijf
  Modal-wrappers (`PodiumScherm`, `BottomSheet`, `KaderDialoog`, `SysteemMenu`, `WelkomFeest`) gaan
  via `useNaSlot(zichtbaar)`: wat al open was blijft staan onder het slot en houdt zijn state; wat wil
  openen terwijl het slot er staat, wacht tot de status 'open' is en de slot-Modal 300 ms weg is.
  Elke wrapper heeft `AfdekLaag` als laatste kind, zodat ook een open sheet afgedekt is in Recente
  apps.
- Meldingstikken en `kader://`-links die van tab wisselen, wachten in `NavigatieProvider` tot het slot
  weg is (`useSlotVrij`). Het doel komt dus pas na het ontgrendelen in beeld. Een meldingstik komt
  binnen vóór AppState `active`, terwijl de status nog `open` is: komt er een navigatie binnen terwijl
  `AppState.currentState` nog `background` is, dan wacht hij op de beslissing van `opVoorgrond`
  (`useNaVoorgrondBeslissing`). Die beslissing en de wachtende navigatie vallen in dezelfde synchrone
  beurt, dus React ziet in één render al dat het slot er ligt; de tab wisselt pas na het ontgrendelen.
- Komt de app terug zonder dat er een `background` gezien is, terwijl de status `open` is en er een
  pincode is, dan vergrendelt hij (onbekend tijdstip, zoals `moetHervergrendelen` bij twijfel).
- Het slot gebruikt nooit `toonDialoog`; bevestigingen staan inline. De terugknop in het slot doet een
  stap terug of `BackHandler.exitApp()`; tijdens de ontgrendel-animatie wordt hij geslikt.
- Sluiten gebeurt gespreid (300 ms): twee Modals in dezelfde tick sluiten gaf eerder een ANR, zie
  `DialoogProvider.tsx`.

## Integraties

- **Koppelwizard**: zonder pincode komt er een pincode-stap tussen testen en klaar. De sleutel wordt
  pas na de pincode bewaard. Annuleren bewaart nooit een sleutel; een al gezette pincode blijft staan.
  Het biometrie-aanbod wordt vastgelegd bij het binnenkomen van de stap. Android-terug gaat eerst
  terug binnen het instellen (van herhalen naar kiezen), daarna naar de teststap. Tijdens het bewaren
  staat er een bezig-laag en is niets tikbaar.
- **`bewaarSleutels`** weigert zonder pincode-record (`GeenPincodeFout`), ook bij een kluisfout.
  `opSleutelWijziging` meldt bewaren en wissen; `PortfolioProvider` ververst daarop zijn eToro-stand.
- **Migratie**: eToro gekoppeld zonder pincode geeft `setupVerplicht`. Een kluisfout bij het lezen van
  de eToro-sleutel telt als gekoppeld (fail-closed). "Koppeling verwijderen" zet eerst de omgeving op
  demo en wist dan de sleutels (ook het oude demo-slot); andersom kon de verversing die het wissen
  aankondigt de oude omgeving 'real' teruglezen. `haalOmgeving` overschrijft na een await ook nooit een
  keuze die intussen gezet is. Daarna leest de provider de sleutels opnieuw: staan ze er nog, dan
  blijft het `setupVerplicht` met een melding, anders opent de app.
- **Wachtende order annuleren**: in Echt eerst `bevestigIdentiteit('order', {detail})` (via de stabiele
  `useBevestigIdentiteit`, zodat `PortfolioProvider` niet elke seconde hertekent tijdens een
  wachttijd). Bij `geannuleerd` gebeurt er niets. Demo blijft zonder.
- **Orders**: in Echt na het vasthouden `bevestigIdentiteit('order', {detail})`. Alleen bij 'ok', als
  de knop nog gemount is en de status 'open' is, gaat de order uit; de sheets controleren saldo en
  stand dan opnieuw. Valt het slot tijdens de pincodevraag, dan is de uitkomst 'geannuleerd'. Foute
  pincodes tellen in dezelfde teller.
- **Recente apps**: `setRecentsScreenshotEnabled(false)` (API 33+) zolang er een pincode, een koppeling
  of een kluisfout is, plus de afdeklaag bij `background`.

## Bekende beperkingen

- Zonder `BOOT_COUNT` (opstartteller -1) valt de wachttijd terug op de wandklok met herankering. Een
  vooruitgezette klok wint niets, maar na een onopgemerkte reboot kan een wachttijd langer duren dan
  nodig (nooit korter).
- `ERROR_LOCKOUT_PERMANENT` is in expo-local-authentication niet te onderscheiden van een tijdelijke
  lockout; Kader toont altijd de tijdelijke melding.
- Zonder schermslot geeft expo `not_enrolled`, ook voor herstel. Daarom blokkeert instellen zonder
  schermslot.
- Hangt een schrijfactie van SecureStore, dan blijft de rij bezet tot hij terugkomt (zie Opslag).
- Een ontgrendeling kost op de emulator 0,3 tot 1,7 s; een echte telefoon met een release-build is naar
  verwachting sneller, maar dat is niet gemeten.
- Een wrapper die in exact dezelfde render opent als het slot valt, kan in theorie boven het slot
  komen; `useNaSlot` maakt dat venster zo klein mogelijk.
- Een tweede biometrische prompt terwijl er een loopt, wordt geannuleerd in plaats van gedeeld.
- Onder API 33 zijn Recente apps niet afgedekt: `setRecentsScreenshotEnabled` bestaat pas vanaf
  API 33. Tijdelijk `FLAG_SECURE` alleen zolang de app op de achtergrond staat zou het oplossen, maar
  besluit 11 sluit `FLAG_SECURE` uit; dat vraagt een besluit van Thom.
- De homescreen-widget en de trade-meldingen tonen portfolio- en koersdata buiten het slot. Gesignaleerd,
  niet aangepast.
- Onder API 30 hangt het herstel als Android de activity van Kader opruimt terwijl de
  schermslot-activity open staat en de JS-kant daarbij verloren gaat; de bevestiging rondt dan niet af
  tot een herstart. Niet gezien, wel denkbaar.
