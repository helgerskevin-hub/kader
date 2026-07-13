# Security review Kader, 13 juli 2026

Volledige review tegen de OWASP MASVS/MASTG-standaard, acht domeinen. De app is statisch geanalyseerd (broncode in `app/src`), plus de daadwerkelijk gebouwde `kader-0.1.4.apk` (versionCode 13) met `aapt2`, `apksigner` en `keytool`. Geen code gewijzigd.

## Hoe deze review de severity bepaalt

MASVS is geschreven voor apps die naar een appstore gaan met een miljoen installaties, een serverkant, en een aanvaller die de app niet vertrouwt. Kader is iets anders: een persoonlijke tool voor twee mensen, gesideload via GitHub, zonder backend, zonder accounts, zonder analytics. De severity in dit rapport is daarom gekalibreerd op wat voor **deze** app werkelijk risico is, niet op wat de checklist standaard zou zeggen. Waar dat oordeel afwijkt van een letterlijke MASVS-lezing, staat dat er expliciet bij.

Drie feiten bepalen de hele weging en staan daarom vooraan:

- **De eToro-sleutel is read-only.** Alle vijf endpoints die de app aanroept zijn info-endpoints (portfolio, historie, eligibility, instrumenten). Er zit nergens een order-call in de code. Een gelekte sleutel geeft dus inzage in iemands posities, geen mogelijkheid om te handelen of geld te verplaatsen. Dat begrenst de impact van elk sleutel-lek fors, en verlaagt de kernbevinding van "kritiek" naar "hoog". Kanttekening: dit steunt deels op de gebruiker die bij eToro de "Read"-scope kiest, de app kan een schrijf-sleutel niet detecteren of weigeren.
- **De aanval-oppervlakte is klein en schoon.** Geen WebView, geen deep links, geen custom scheme, geen exported IPC-componenten van de app zelf, geen `eval` of dynamische code, geen hardcoded secrets, alle endpoints HTTPS, sleutels in headers en niet in URL's, en de invoervelden gebruiken `secureTextEntry`. Dat zijn geen kleine dingen, en ze verklaren waarom het aantal echte bevindingen laag is.
- **Er is geen serverkant en geen andere gebruiker om tegen te beschermen.** Dat maakt hele delen van MASVS-AUTH en MASVS-RESILIENCE niet van toepassing, en dat is een legitieme uitkomst, geen gat dat we wegpoetsen.

## Samenvatting

Het risico concentreert zich op één as: **de opslag en distributie van de eToro-sleutel.** De sleutel staat in platte tekst op het toestel, `allowBackup` staat aan waardoor die platte tekst het toestel af kan, en de app is met een openbare sleutel ondertekend waardoor een kwaadaardige "update" bij diezelfde platte tekst kan. Die drie punten versterken elkaar en vormen samen het enige pad met echte impact. De rest zijn nette, goedkoop te dichten punten rond datahygiëne (een wis-functie die niet wist, een marktdata-validatie die ontbreekt) en een stapel overbodige permissies die Expo standaard meebakt.

| # | Bevinding | Severity | MASVS |
|---|---|---|---|
| 1 | eToro-sleutel en user-key in platte tekst in AsyncStorage | Hoog | STORAGE-1, CRYPTO-1 |
| 2 | `allowBackup="true"` laat die sleutels en de handelshistorie het toestel af | Hoog | STORAGE-2, PRIVACY-1 |
| 3 | Release-APK ondertekend met de openbare Android debug-key | Middel-hoog | RESILIENCE-2 |
| 4 | "Koppeling verwijderen" wist de sleutels niet-financiële data, en er is geen wis-functie | Middel | PRIVACY-4, STORAGE-1 |
| 5 | Marktdata-prijzen niet gevalideerd, foute koopsignalen mogelijk | Middel | CODE-4 |
| 6 | Geen FLAG_SECURE op schermen met bedragen en de zichtbare sleutel | Middel | PLATFORM-3 |
| 7 | Geen tapjacking-bescherming, trade verwijderen is onbevestigde single-tap | Middel | PLATFORM-3 |
| 8 | Firebase-push-stack en circa 25 overbodige permissies meegebakken, ongebruikt | Laag-middel | PRIVACY-1, PLATFORM-1 |
| 9 | Rauwe eToro-foutbody (500 tekens) lekt naar UI en logcat | Laag | CODE-4 |
| 10 | Geen app-lock en geen drempel op het tonen van de opgeslagen sleutel | Laag-middel | AUTH-2, AUTH-3 |
| 11 | `Math.random()` voor identifiers | Laag/info | CRYPTO-1 |
| 12 | Signing-certificaat gebruikt SHA1withRSA | Laag/info | CRYPTO-1 |
| 13 | Geen forced-update-mechanisme | Info | CODE-2 |
| 14 | Geen certificate pinning | Info (geaccepteerd) | NETWORK-2 |

## Domein-dekking

| Domein | Oordeel | Kern |
|---|---|---|
| STORAGE | Fail | Bevindingen 1, 2, 4, 9 |
| CRYPTO | Fail | Geen encryptie waar het hoort (1), zwakke RNG (11), zwak cert (12) |
| NETWORK | Pass-1 / Fail-2 | Alles HTTPS, geen cleartext. Geen pinning (14), bewust geaccepteerd |
| PLATFORM | Pass-1,2 / Fail-3 | Schone IPC, geen WebView, geen deep links. Wel 6, 7, 8 |
| CODE | Fail | Input-validatie (5), foutbody-lek (9), geen forced update (13) |
| AUTH | N.v.t.-1 / Fail-2,3 | Geen backend. Wel bevinding 10, proportioneel |
| PRIVACY | Fail | Bevindingen 2, 4, 8. Geen analytics/tracking is een sterk punt |
| RESILIENCE | N.v.t.-1,3,4 / Fail-2 | Alleen de signing key (3) telt, de rest is niet van toepassing |

---

## Bevindingen

### 1. eToro-sleutel en user-key in platte tekst opgeslagen

**Severity: Hoog.** MASVS-STORAGE-1, MASVS-CRYPTO-1. MASTG-TEST-0001.

De koppel-wizard schrijft beide sleutels rechtstreeks naar AsyncStorage, dat op Android een onversleutelde SQLite-database is (`/data/data/com.kader.app/databases/RKStorage`). Er zit geen enkele crypto-library in het project: geen `expo-secure-store`, geen Keystore, niets.

- Definitie: [opslag.ts:10-11](../app/src/storage/opslag.ts#L10-L11)
- Geschreven: [EtoroKoppelingWizard.tsx:95-96](../app/src/components/EtoroKoppelingWizard.tsx#L95-L96) via `bewaarTekst` ([opslag.ts:71-77](../app/src/storage/opslag.ts#L71-L77))
- Gelezen op vijf plekken, o.a. [PortfolioProvider.tsx:309-311](../app/src/state/PortfolioProvider.tsx#L309-L311), [useStopLossLimiet.ts:34-36](../app/src/state/useStopLossLimiet.ts#L34-L36)

**Waarom hoog en niet kritiek.** De belangrijkste nuance is dat encryptie hier geen theoretische defense-in-depth is. Op een niet-geroot toestel zonder USB-debugging beschermen de Android-sandbox en file-based encryption de map al: een andere app kan er niet bij. Dat scenario is dus gedekt. Wat overblijft zijn drie scenario's waar de sandbox niet helpt en die hier wel reëel zijn:

1. `adb backup` (zie bevinding 2), werkt vandaag zonder root op elk toestel met USB-debugging aan.
2. Een geroot toestel: root leest elk bestand, en de FBE-sleutel is toestel-breed ontgrendeld zodra het scherm dat is.
3. Een kwaadaardige rebuild als update (zie bevinding 3), die de platte tekst gewoon uitleest.

De reden dat dit "hoog" is en niet "kritiek": de sleutel is read-only, dus de buit is portfolio-inzage, geen geld. Zou de sleutel kunnen handelen, dan was dit kritiek.

`expo-secure-store` is de juiste oplossing: dat gebruikt op Android `EncryptedSharedPreferences`, met een AES-256-GCM-sleutel die zelf in de hardware-gebonden Keystore leeft en het toestel nooit verlaat. Zo'n backup of root-dump levert dan alleen ciphertext op. Migratie moet de bestaande platte-tekst-waarde eenmalig overzetten en de oude AsyncStorage-kopie wissen, anders blijft er een onversleutelde bron staan.

### 2. `allowBackup="true"` laat de sleutels en de handelshistorie het toestel af

**Severity: Hoog.** MASVS-STORAGE-2, MASVS-PRIVACY-1. MASTG-TEST-0011.

[AndroidManifest.xml:14](../app/android/app/src/main/AndroidManifest.xml#L14) zet `android:allowBackup="true"` zonder `dataExtractionRules` of `fullBackupContent`. Dit is de Expo/RN-default, niet een bewuste keuze, en komt bij elke `expo prebuild` terug.

Dit is de versterker van bevinding 1. Zonder dit zou de platte tekst root vereisen. Mét dit kan `adb backup -f backup.ab com.kader.app` de volledige AsyncStorage-database exporteren op elk toestel met USB-debugging aan, plus komt dezelfde data in Android Auto Backup (Google Drive) terecht. Dat betreft zowel de sleutels uit bevinding 1 als de volledige `portfolio_trades`-historie (USD-bedragen, entry/exit, P&L, eToro-positie-ID's) uit [opslag.ts:4](../app/src/storage/opslag.ts#L4).

Fix: `dataExtractionRules`/`fullBackupContent` die de gevoelige database uitsluiten, via een Expo config-plugin (de native map wordt bij elke build opnieuw gegenereerd, dus een handmatige manifest-edit overleeft de volgende prebuild niet). Keystore-materiaal uit bevinding 1 valt sowieso automatisch buiten backups, dus die twee fixes vullen elkaar aan.

### 3. Release-APK ondertekend met de openbare Android debug-key

**Severity: Middel-hoog.** MASVS-RESILIENCE-2. MASTG-TEST-0040. Dit is het punt waar je specifiek naar vroeg, dus het krijgt een eigen sectie met het alternatief hieronder.

`apksigner verify` op de APK bevestigt: alleen v2-scheme, certificaat `CN=Android Debug`, SHA-256 `FA:C6:17:45:...:9C`, SHA-1 `5E:8F:16:06:...:F6:25`, RSA 2048, `SHA1withRSA (weak)`, geldig sinds 2013. Dit is de universele Android debug-key: elke Android Studio-installatie ter wereld genereert exact deze sleutel met wachtwoord `android`. De private key is dus openbaar.

- Config: [build.gradle:113-115](../app/android/app/build.gradle#L113-L115) hergebruikt `signingConfigs.debug` ([build.gradle:100-107](../app/android/app/build.gradle#L100-L107)) voor de release, met letterlijk de comment "Caution! In production, you need to generate your own keystore file."

**Het aanvalsscenario.** Android staat een update alleen toe als de nieuwe APK hetzelfde package-ID én dezelfde handtekening heeft, en behoudt dan de datamap. Omdat de sleutel openbaar is, kan iedereen een aangepaste Kader bouwen (de repo is openbaar), er een paar regels aan toevoegen die de sleutel exfiltreren, en die met dezelfde debug-key ondertekenen. Android ziet dat als een legitieme update: geen waarschuwing, geen herinstallatie, datamap intact. Gecombineerd met bevinding 1 leest die build de platte-tekst-sleutel zo uit. De kans is begrensd (er is een sociale duw nodig om iemand die APK te laten sideloaden), maar de impact is toegang tot een echt brokerage-account. Het certificaat gebruikt bovendien `SHA1withRSA`, wat op zichzelf al niet meer door de beugel kan.

**Waarom dit geen pleidooi is voor root-detectie of obfuscatie.** Die zouden dit scenario niet raken: de aanvaller hoeft de app niet te kraken, alleen opnieuw te bouwen met een sleutel die al openbaar is. Dit is puur een code-signing-kwestie.

#### Het alternatief: v3 key rotation (de CLAUDE.md-regel is achterhaald)

CLAUDE.md zegt "Never change the release signing key", met als reden dat een sleutelwissel iedereen zou dwingen te deinstalleren en zijn data te verliezen. Dat klopt voor een naïeve wissel, maar sinds **Android 9 (API 28)** bestaat **APK Signature Scheme v3 key rotation**: je ondertekent met de nieuwe sleutel en sluit een *proof-of-rotation lineage* bij, een klein bestand dat bewijst dat de oude sleutel de nieuwe heeft geautoriseerd. Toestellen op API 28+ accepteren de update in-place, zonder deinstallatie en zonder dataverlies.

Alle voorwaarden zijn vervuld: de oude private key is beschikbaar (dat is de harde eis, en het is precies `debug.keystore`), `apksigner` staat er al (build-tools 37.0.0) en wordt al aangeroepen door `bouw-release.mjs`, en minSdk 24 / targetSdk 36 betekent dat alleen Android 7.0-8.1 buiten het v3-bereik valt.

**Belangrijke correctie op het eerste advies.** De APK heeft vandaag alleen een v2-blok, geen v3. En `apksigner` zet een rotatie standaard in een **v3.1**-blok dat pas vanaf Android 13 (API 33) werkt. Om de rotatie ook op Android 9-12 te laten gelden, moet je expliciet `--rotation-min-sdk-version 28` meegeven. Zonder die vlag werkt de bescherming alleen op de nieuwste toestellen.

Schets van de uitvoering (buiten deze review, dit is alleen het advies):

1. `keytool -genkeypair` voor een eigen release-keystore, RSA 4096, SHA256withRSA.
2. `apksigner rotate --out kader-lineage.bin --old-signer --ks debug.keystore --new-signer --ks kader-release.jks`
3. In `bouw-release.mjs` een post-`assembleRelease`-stap: `apksigner sign --ks kader-release.jks --lineage kader-lineage.bin --rotation-min-sdk-version 28 ...`. AGP's `signingConfig`-DSL heeft geen lineage-veld, dus dit moet als losse apksigner-stap, niet in `build.gradle`.
4. `VERWACHTE_SHA256` in `bouw-release.mjs` omzetten naar het nieuwe certificaat, plus een check dat de lineage aanwezig is.
5. De regel in CLAUDE.md herformuleren van "verander de key nooit" naar "verander hem nooit zonder lineage".

**De prijs, eerlijk.** Een kwijtgeraakte release-key is definitief onherstelbaar: vanaf dat moment kun je nooit meer in-place updaten. Dat is de enige deugd van de debug-key, die kún je niet verliezen. De nieuwe keystore moet dus in een gedeelde wachtwoordmanager waar Thom én Kevin bij kunnen, met een geverifieerde back-up, niet in een map op één laptop.

**De beperking, eerlijk.** Android 7.0-8.1 negeert het v3-blok en blijft updaten via v1/v2 met de oude debug-key, dus daar blijft het aanvalsscenario intact. Gegeven minSdk 24 is dat een restrisico, al is het een krimpende groep en treft het jullie alleen als een eigen toestel toevallig op die versies zit.

**Aanbeveling: roteer nu.** De kosten van deze fix stijgen met elke gebruiker die erbij komt, en dalen nooit. Bij twee gebruikers is dit het goedkoopste moment dat er ooit komt.

### 4. "Koppeling verwijderen" wist de financiële data niet, en er is geen wis-functie

**Severity: Middel.** MASVS-PRIVACY-4, MASVS-STORAGE-1. MASTG-TEST-0319.

[EtoroKoppelingWizard.tsx:102-126](../app/src/components/EtoroKoppelingWizard.tsx#L102-L126): "Koppeling verwijderen" wist alleen `etoro_api_key` en `etoro_user_key`. De bevestiging suggereert een schone ontkoppeling, maar de volgende data blijft gewoon staan: `portfolio_trades` (de volledige geïmporteerde handelshistorie met bedragen en positie-ID's), `genegeerde_etoro_ids`, `etoro_limieten`, `laatste_sync_tijd`. Er is verder geen enkele in-app manier om die data te wissen of te exporteren; alleen de app deinstalleren wist alles, en dat staat nergens.

Dit is de enige "verwijder mijn data"-achtige actie in de app, en hij belooft meer dan hij doet. Fix: bij ontkoppelen apart aanbieden om ook de geïmporteerde eToro-trades en de koppeling-gebonden sleutels te wissen, plus de knoptekst eerlijk maken. Overweeg een losse "Wis al mijn data"-knop in de instellingen.

### 5. Marktdata-prijzen niet gevalideerd, foute koopsignalen mogelijk

**Severity: Middel.** MASVS-CODE-4. MASTG-TEST-0245.

[parseBinanceKlines](../app/src/engine/marketData.ts#L48-L57) filtert alleen op `!isNaN(close)`; `open/high/low/volume` en de conditie `close > 0` worden niet gecontroleerd. `haalCoingeckoOhlc` valideert helemaal niet. Een negatieve of NaN-prijs (corrupte respons, foutieve upstream, of een MITM aangezien er geen pinning is) komt zo de indicator-math in.

In [analyzer.ts:119-129](../app/src/engine/analyzer.ts#L119-L129) wordt die prijs direct de `entry`, en de R/R-filter vangt het niet: bij een `NaN`-rr is `rr < MIN_RISK_REWARD - 1e-9` gelijk aan `false` (elke vergelijking met NaN is false), dus de coin glipt door met `rr = NaN`. Een negatieve entry passeert eveneens. Het gevolg is geen crash maar een stille integriteitsfout: onjuiste bedragen gepresenteerd als een technisch onderbouwd koopsignaal, in een app die letterlijk over geldbeslissingen gaat.

Fix: in beide parse-functies alle candle-velden op `Number.isFinite(x) && x > 0` controleren en verwerpen wat niet voldoet, plus een `Number.isFinite(rr)`-check aan de filter op regel 129. Een handvol unit-tests op `indicators.ts`/`analyzer.ts` met kapotte candles zou dit soort dingen vroeg vangen; het bestaande `if (require.main === module)`-zelfcontrolepatroon kan daarvoor uitgebreid worden.

### 6. Geen FLAG_SECURE op schermen met bedragen en de zichtbare sleutel

**Severity: Middel.** MASVS-PLATFORM-3.

Geen `FLAG_SECURE`, geen `expo-screen-capture` in het project. Het portfolio-scherm toont echte bedragen, en de wizard kan de eToro-sleutel met een oog-toggle zichtbaar maken ([EtoroKoppelingWizard.tsx:352](../app/src/components/EtoroKoppelingWizard.tsx#L352)). Zonder FLAG_SECURE komt dat in de recente-apps-thumbnail en in schermopnames. Fix: `preventScreenCaptureAsync()` op de gevoeligste schermen, niet app-breed (anders blokkeer je ook legitieme screenshots van de gebruiker zelf).

### 7. Geen tapjacking-bescherming, trade verwijderen is onbevestigde single-tap

**Severity: Middel.** MASVS-PLATFORM-3.

Geen `filterTouchesWhenObscured`. [PortfolioScreen.tsx:213](../app/src/screens/PortfolioScreen.tsx#L213) roept `onVerwijder(trade.id)` direct aan zonder bevestiging, en [PortfolioProvider.tsx:160-167](../app/src/state/PortfolioProvider.tsx#L160-L167) verwijdert meteen én zet eToro-trades op een permanente negeerlijst, dus deels onomkeerbaar. Ter vergelijking: het verwijderen van de koppeling heeft wél een bevestiging. Een overlay van een andere app kan een tik naar die verwijderknop sturen. Fix: bevestigingsdialoog toevoegen (het patroon staat al in dezelfde file) en `filterTouchesWhenObscured` op de gevoelige schermen.

### 8. Firebase-push-stack en circa 25 overbodige permissies, ongebruikt meegebakken

**Severity: Laag-middel.** MASVS-PRIVACY-1, MASVS-PLATFORM-1. MASTG-TEST-0255.

[meldingen.ts](../app/src/notifications/meldingen.ts) plant precies één lokale dagelijkse herinnering en registreert nergens een push-token (geen `getExpoPushTokenAsync`). Toch trekt `expo-notifications` een volledige Firebase Cloud Messaging-stack, de Play install-referrer-service en circa twintig OEM-launcher-badge-permissies binnen (`shouldSetBadge` staat zelfs op `false`). Ook `SYSTEM_ALERT_WINDOW` en de legacy storage-permissies zitten in de APK, uit Expo's ongepruimde basistemplate.

**Belangrijke nuance: de FCM-stack is nu inert.** Er is geen `google-services.json` en de google-services Gradle-plugin wordt niet toegepast, dus Firebase kan niet initialiseren en er gaat geen data naar Google. Dit is dode code, geen actief lek. Het risico is tweeledig: onnodig permissie-oppervlak dat de app "tracking-achtig" doet ogen, en latente activering als er ooit per ongeluk een `google-services.json` bijkomt.

Fix: `SYSTEM_ALERT_WINDOW` en de storage-permissies strippen via een config-plugin met `tools:node="remove"`. De badge-permissies zitten hard in `ShortcutBadger` binnen `expo-notifications` en zijn lastiger weg te krijgen; documenteer dat als geaccepteerd, of strip per permissie. Leg vast dat er nooit een `google-services.json` bij mag zonder eerst een consent-flow, zodat de inerte stack niet stilletjes activeert.

### 9. Rauwe eToro-foutbody lekt naar UI en logcat

**Severity: Laag.** MASVS-CODE-4 (CWE-209). MASTG-TEST-0201.

[etoro.ts:79-83](../app/src/engine/etoro.ts#L79-L83) stopt tot 500 tekens rauwe eToro-responsbody in de `Error.message`. Die belandt in de wizard-UI, in de doorlopende portfolio-statuskaart bij elke gefaalde sync, en via [FoutGrens.tsx:24](../app/src/components/FoutGrens.tsx#L24) in logcat (console-logging wordt niet uit de release gestript). De sleutel zelf komt niet in die body, dus het is geen directe sleutel-lek, maar het is een onbeperkte sink voor alles wat upstream teruggeeft. Fix: de body loggen in `__DEV__`, de gebruiker een vaste melding per statuscode-klasse tonen.

### 10. Geen app-lock en geen drempel op het tonen van de opgeslagen sleutel

**Severity: Laag-middel.** MASVS-AUTH-2, AUTH-3.

Er is geen app-lock, en de opgeslagen sleutel is zonder enige drempel in leesbare vorm op te halen (tandwiel, koppeling, volgende, oog-icoon). Proportioneel oordeel: een verplichte biometrische lock is hier overdreven (het toestel heeft al een lockscreen, en de app synct bewust automatisch bij opstart, wat botst met een prompt bij elke start). Het gerichte advies is een **optionele** app-lock (standaard uit) plus een biometrische check specifiek op het oog-icoon dat de sleutel onthult. Niet `requireAuthentication` op de opslag zelf zetten, want dat breekt de automatische sync.

### 11-14. Lagere en informatieve punten

- **11. `Math.random()` voor identifiers** (laag/info, CRYPTO-1). [etoro.ts:10-16](../app/src/engine/etoro.ts#L10-L16) (x-request-id) en [portfolioTypes.ts:26-27](../app/src/state/portfolioTypes.ts#L26-L27) (trade-id). Beide zijn correlatie-/lijst-identifiers, geen security-tokens, dus de impact is nihil. Correctheidsfix: `expo-crypto`'s `randomUUID()`. Wel principieel belangrijk: als er ooit een security-relevante random waarde nodig is (een encryptie-IV voor de trade-historie bijvoorbeeld), is `Math.random()` categorisch onacceptabel.
- **12. SHA1withRSA op het signing-certificaat** (laag/info, CRYPTO-1). Wordt door Android nog geaccepteerd, maar is een extra argument voor de sleutelrotatie uit bevinding 3 (een eigen keystore krijgt SHA256withRSA).
- **13. Geen forced-update-mechanisme** (info, CODE-2). Sideloaded via GitHub, dus geen store-mechanisme om een kritieke versie af te dwingen. Proportioneel: hooguit een lichte versie-check tegen de GitHub Releases-API bij app-start. Geen prioriteit.
- **14. Geen certificate pinning** (info, geaccepteerd risico, NETWORK-2). Bewust verdedigbaar: de sleutel is read-only, er is geen OTA-update-mechanisme, en pinning zou de app breken zodra eToro zijn certificaat roteert (er is dan geen snelle weg naar een nieuwe release). Het resterende MITM-risico vereist een geroot toestel of een systeem-CA, wat op targetSdk 36 al niet triviaal is. Laten staan, niet fixen.

## Wat expliciet goed is

Om het beeld eerlijk te houden, dit is geen slordige app:

- Geen WebView, geen deep links, geen custom scheme, geen exported IPC-componenten van de app zelf. De hele klasse van IPC- en deep-link-aanvallen is afwezig.
- Alle netwerkverkeer is HTTPS, geen cleartext in de release. Sleutels reizen in headers, niet in URL's.
- De sleutel-invoervelden gebruiken `secureTextEntry`, `autoCorrect={false}`, `autoCapitalize="none"`, dus geen keyboard-cache-lek.
- API-responses worden defensief geparsed met type-guards; `JSON.parse` staat overal in try/catch met een `Array.isArray`-check.
- Geen `eval`, geen dynamische code, geen hardcoded secrets in de source.
- Geen analytics-, advertentie- of crash-reporting-SDK. Geen advertising ID. Voor privacy is dat een sterk uitgangspunt.
- De eToro-integratie is aantoonbaar read-only over alle vijf endpoints, wat de impact van elk sleutel-lek structureel begrenst.

## Aanbevolen volgorde

1. **Bevinding 1 + 2 samen**: `expo-secure-store` voor de sleutels, plus `dataExtractionRules`. Kleinste diff, grootste risicoreductie, dicht het hele hoofdpad.
2. **Bevinding 3**: v3 key rotation. Nu doen, bij twee gebruikers, want het wordt alleen maar duurder.
3. **Bevinding 4 + 5**: de wis-functie eerlijk maken en de marktdata-validatie toevoegen. Goedkoop, en 5 raakt direct de kernfunctie van de app.
4. **Bevinding 6, 7, 8, 10**: UI-hardening en permissie-hygiëne. Klein werk, kan gebundeld.
5. De rest naar behoefte.

De onderliggende per-domein-rapporten (met codefragmenten en migratievoorbeelden) staan in de scratchpad van deze sessie en kunnen op verzoek toegevoegd worden.
