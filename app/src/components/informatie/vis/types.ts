// Contract voor de visualisaties in Informatie. Elke visualisatie staat in een eigen bestand in deze
// map en krijgt alleen deze props. Ze tekent standaard de eindstand; `speelSleutel` verandert elke
// keer dat hij opnieuw moet afspelen (bij openen van het hoofdstuk en bij de knop Opnieuw).
//
// Regels die voor elke visualisatie gelden:
// - Alleen transform en opacity animeren, op shared values, timings uit theme/beweging.ts.
// - `reduceMotion` waar: meteen de eindstand, niets afspelen.
// - Alle getallen zijn voorbeeldwaarden. Het omhulsel zet er "Voorbeeld" boven.
// - Past op 360 dp met systeemletter 1,3: niets kapt af, tekst loopt terug.

export interface VisProps {
  speelSleutel: number;
  reduceMotion: boolean;
}
