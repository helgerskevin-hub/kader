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

## Als het misgaat

- **Iets gebroken op een branch?** Branch weggooien en opnieuw beginnen. Main staat er nog.
- **Merge conflict?** Leg de twee versies voor aan Claude Code en vraag welke je wil bewaren. Niet zelf handmatig uitzoeken.
- **Per ongeluk op main gecommit?** Vraag hulp. Nooit zelf `git reset --hard` doen tenzij je precies weet wat je doet.
- **Nooit force-push naar main.**
