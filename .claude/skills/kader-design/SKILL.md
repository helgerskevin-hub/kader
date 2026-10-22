---
name: kader-design
description: Huisstijl, schermbeschrijvingen, design system en logo van de Kader-app. Gebruik bij elk UI- of designwerk in Kader, zoals een nieuw scherm, sheet, kaart of component, kleuren, typografie, iconen, copy of animaties, en bij het reviewen van UI-code.
---

# Kader design

Lees voor UI-werk eerst de twee docs, die zijn de bron van waarheid:

1. `docs/huisstijl-kader.md`: merkidentiteit, kleurenpalet, typografie, tone of voice.
2. `docs/app-beschrijving-voor-claude-design.md`: per scherm de opbouw, user flows en copy.

Alleen als je ze nodig hebt (zip-bestanden, niet direct leesbaar):

- `Design system voor React Native app.zip` (repo root): componentbibliotheek, spacing-tokens, UI-patronen.
- `docs/Logo.zip`: officiele logo-bestanden en gebruiksregels.

Bekijk de inhoud met `unzip -l <zip>` en pak alleen de bestanden uit die je nodig hebt, naar een tijdelijke map buiten de repo.

## Vaste regels

- Bouw op de bestaande code: `theme/` voor tokens, typografie, `beweging.ts` (animatie) en `haptiek.ts`; `components/BottomSheet.tsx` voor sheets en `components/PodiumScherm.tsx` voor full-screen views. Geen nieuwe losse kleuren, ms-waarden of kale `Modal`.
- Toon: sober, behulpzaam, Nederlands, nooit hype. Disclaimer altijd zichtbaar: "Geen financieel advies. De koers op eToro kan afwijken."
- Licht en donker moeten allebei kloppen (ThemeProvider), en "Minder beweging" moet gerespecteerd worden (`useBeweging`).
- Controleer het resultaat op de emulator met de `run-android` skill.
