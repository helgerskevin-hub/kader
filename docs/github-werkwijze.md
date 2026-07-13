# GitHub-werkwijze

Dit project heeft twee bijdragers: Thom en Kevin. Beiden werken via Claude Code. Beiden schrijven code en werken aan de app -- niet alleen design. Geen van beiden is programmeur; de AI schrijft het werk.

Juist daarom is een vaste werkwijze belangrijk: twee Claude Code-sessies die tegelijk aan dezelfde bestanden werken, levert merge conflicts op die lastig te ontwarren zijn.

## De kernregel: `main` is altijd werkend

Werk nooit rechtstreeks op `main`. Main is de versie die op de telefoon staat en klopt. Al het werk-in-uitvoering gaat op een branch.

## Branch per taak

Maak een branch zodra je ergens aan begint:

```
main                  <- altijd stabiel en installeerbaar
feature/grafieken     <- Thom werkt hier nu aan
feature/onboarding    <- Kevin werkt hier nu aan
```

Naamgeving maakt niet uit, zolang hij beschrijvend is. Klaar met de taak? Merge via een Pull Request naar main.

## Spreek af wie wat pakt -- voor je begint

Zeg in de chat of via WhatsApp wat je oppakt ("ik begin aan de grafiekmodule"). Zo weten jullie niet pas achteraf dat er twee sessies aan hetzelfde zaten. Dit is de belangrijkste afspraak in dit document.

## Commits: klein en vaak

Commit na elke werkende tussenstap, niet pas als de hele feature af is. Kleine commits zijn veel makkelijker terug te draaien dan een grote.

Claude Code schrijft de commit messages; laat dat gewoon doen.

Richtlijn: heb je meer dan 30 minuten gewerkt zonder commit, dan is het tijd.

## Pull Requests als vierogenprincipe

Open een PR als een taak klaar is, en laat de ander er even naar kijken voor je merget. Je hoeft geen code te lezen -- je controleert of het klopt met wat was afgesproken, of er niets ontbreekt, of de beschrijving duidelijk is.

Voordeel: als iets toch niet werkt, staat main nog heel.

## Controleer altijd de actuele stand voor je begint

```bash
git fetch origin
git log --all --oneline --graph
```

Zo zie je wat de ander eventueel al heeft gepusht. Kevins en Thoms wijzigingen kunnen ingrijpend zijn -- mapstructuur, naamswijzigingen, nieuwe bestanden.

## Na elke pull: `npm install`

```bash
git pull
cd app
npm install
```

`app/package.json` is de boodschappenlijst van de app: welke externe bibliotheken hij nodig heeft. `app/node_modules` is de kast waar die bibliotheken echt in staan. Alleen de lijst staat in Git, de kast niet (die is veel te groot).

Voegt de ander een nieuwe bibliotheek toe, dan komt die dus wel op jouw lijst maar niet in jouw kast. `npm install` leest de lijst en vult de kast bij.

Sla je dit over, dan faalt de build met een melding die je niet in die richting wijst, bijvoorbeeld:

```
PluginError: Failed to resolve plugin for module "expo-splash-screen"
```

Zo'n "kan module X niet vinden" betekent bijna altijd: je hebt `npm install` nog niet gedraaid. Draai het en probeer opnieuw. Draaien terwijl er niets veranderd is, kan geen kwaad; het is dan gewoon meteen klaar.

## Een release bouwen

Bouw een release-APK **altijd** met `npm run release:apk` (vanuit `app/`), nooit
rechtstreeks met `gradlew assembleRelease` of `expo run:android`. De map
`app/android/` staat niet in Git en wordt alleen opnieuw aangemaakt door
`expo prebuild`. Een directe Gradle-build hergebruikt gewoon wat er al staat,
waardoor het versienummer in de build stil achterloopt op `app.json` zodra je
de versie ophoogt zonder opnieuw te prebuilden.

Dat is precies wat er in juli 2026 misging: releases 0.1.1 en 0.1.3 bevatten
in werkelijkheid een lager versienummer dan wat er al op de telefoon stond,
waardoor Android de installatie weigerde met "App niet geïnstalleerd". Het leek
op een signing-probleem, maar dat was het niet: alle Kader-APK's zijn met
dezelfde sleutel ondertekend.

`npm run release:apk` (script: `app/scripts/bouw-release.mjs`, ook beschreven
in de `release-apk`-skill) voorkomt dit doordat het na de build controleert of
het versienummer in de APK matcht met `app.json`, en of de handtekening nog
steeds de bekende debug-key is. Klopt een van beide niet, dan stopt het script
met een foutmelding in plaats van een kapotte APK op te leveren.

## Als het misgaat

- **Iets gebroken op een branch?** Branch weggooien en opnieuw beginnen. Main staat er nog.
- **Merge conflict?** Leg de twee versies voor aan Claude Code en vraag welke je wil bewaren. Niet zelf handmatig uitzoeken.
- **Per ongeluk op main gecommit?** Vraag hulp. Nooit zelf `git reset --hard` doen tenzij je precies weet wat je doet.
- **Nooit force-push naar main.**
