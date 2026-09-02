// Prijsalerts: "waarschuw me als BTC boven de 80.000 komt". Het enige stuk van Kader waar de
// gebruiker zelf het niveau kiest, alles anders komt uit de analyse.
//
// Twee dingen liggen hier bewust vast:
//
// 1. Een alert vuurt precies EEN keer. Daarna blijft hij staan met `afgegaanOp` erop, zodat je in
//    de lijst ziet dat het gebeurd is. Zonder die eenmaligheid zou een koers die rond je niveau
//    schommelt elke ronde opnieuw melden, en dat is precies de meldingenbom die de rest van de app
//    met suppressie en cooldowns probeert te voorkomen.
// 2. De richting wordt bij het AANMAKEN bepaald, uit de koers van dat moment, en daarna nooit meer.
//    Zet je een alert op 80.000 terwijl BTC op 75.000 staat, dan is dat "boven". Zou de richting
//    later opnieuw uit de koers afgeleid worden, dan draait hij om zodra de koers erlangs gaat en
//    vuurt de alert nooit.
//
// De prijzen hier zijn ALTIJD in dollars, net als alle marktdata. Het omrekenen naar de
// weergavevaluta gebeurt pas in de UI.
import { laadLijst, bewaarLijst, SLEUTELS } from '../storage/opslag';

export type AlertRichting = 'boven' | 'onder';

export interface Prijsalert {
  id: string;
  symbool: string;
  // Het gekozen niveau, in dollars.
  prijs: number;
  richting: AlertRichting;
  aangemaakt: number;
  // Epoch-ms van het moment dat hij afging, of afwezig zolang hij wacht.
  afgegaanOp?: number;
  // De koers op het moment van afgaan. Staat er los van `prijs`: een alert op 80.000 kan afgaan
  // op 80.412, en dat is wat je wil terugzien.
  afgegaanBij?: number;
}

// Meer dan dit is geen alertlijst meer maar een tweede portfolio, en elke ronde kost een
// prijsverzoek per coin. Wie er meer wil, moet er eerst een wissen.
export const MAX_ALERTS = 20;

/**
 * Welke richting hoort bij een gekozen niveau, gegeven de koers van dat moment.
 *
 * Precies op de koers telt als 'boven': dat is de kant die de gebruiker vrijwel altijd bedoelt
 * ("laat het me weten als hij dit haalt"), en een alert die per definitie meteen afgaat is nooit
 * de bedoeling.
 */
export function richtingVoor(niveau: number, huidigeKoers: number): AlertRichting {
  return niveau >= huidigeKoers ? 'boven' : 'onder';
}

/**
 * Is dit een bruikbaar niveau? Geen NaN, niet nul of negatief, en niet zo dicht op de koers dat
 * de alert bij de eerstvolgende tick al afgaat.
 */
export function niveauProbleem(niveau: number, huidigeKoers: number | null): string | null {
  if (!isFinite(niveau) || niveau <= 0) return 'Vul een prijs boven nul in.';
  if (huidigeKoers === null || huidigeKoers <= 0) return null;
  const afstandPct = Math.abs(niveau - huidigeKoers) / huidigeKoers * 100;
  if (afstandPct < 0.5) {
    return 'Dat ligt te dicht op de huidige koers, de melding zou vrijwel meteen afgaan. Kies een niveau dat minstens een half procent verderop ligt.';
  }
  return null;
}

/** Wacht deze alert nog op zijn niveau? */
export const wacht = (alert: Prijsalert): boolean => alert.afgegaanOp === undefined;

/**
 * Welke wachtende alerts zijn bij deze koersen geraakt?
 *
 * Puur, zodat de regel los te toetsen is. Een symbool dat niet in `prijzen` staat (koers niet
 * opgehaald) levert nooit een treffer op: geen koers is geen reden om iets te melden.
 */
export function geraakteAlerts(
  alerts: Prijsalert[],
  prijzen: Record<string, number>,
): { alert: Prijsalert; koers: number }[] {
  const geraakt: { alert: Prijsalert; koers: number }[] = [];
  for (const alert of alerts) {
    if (!wacht(alert)) continue;
    const koers = prijzen[alert.symbool];
    if (typeof koers !== 'number' || !isFinite(koers) || koers <= 0) continue;
    const raak = alert.richting === 'boven' ? koers >= alert.prijs : koers <= alert.prijs;
    if (raak) geraakt.push({ alert, koers });
  }
  return geraakt;
}

// ---------- Opslag ----------
//
// Een gewone lijst in AsyncStorage, net als het portfolio. Geen secure-store: een prijsniveau is
// geen geheim.

/** Leest de alerts en gooit weg wat niet meer als alert te lezen is. */
export async function laadAlerts(): Promise<Prijsalert[]> {
  const ruw = await laadLijst<Partial<Prijsalert>>(SLEUTELS.prijsalerts);
  const schoon: Prijsalert[] = [];
  for (const a of ruw) {
    if (typeof a.id !== 'string' || !a.id) continue;
    if (typeof a.symbool !== 'string' || !a.symbool) continue;
    if (typeof a.prijs !== 'number' || !isFinite(a.prijs) || a.prijs <= 0) continue;
    if (a.richting !== 'boven' && a.richting !== 'onder') continue;
    schoon.push({
      id: a.id,
      symbool: a.symbool.toUpperCase(),
      prijs: a.prijs,
      richting: a.richting,
      aangemaakt: typeof a.aangemaakt === 'number' ? a.aangemaakt : 0,
      ...(typeof a.afgegaanOp === 'number' ? { afgegaanOp: a.afgegaanOp } : {}),
      ...(typeof a.afgegaanBij === 'number' ? { afgegaanBij: a.afgegaanBij } : {}),
    });
  }
  return schoon;
}

export async function bewaarAlerts(alerts: Prijsalert[]): Promise<void> {
  await bewaarLijst(SLEUTELS.prijsalerts, alerts);
}

/** De symbolen waarvoor nog een koers opgehaald moet worden. Leeg = geen enkel verzoek nodig. */
export function wachtendeSymbolen(alerts: Prijsalert[]): string[] {
  return [...new Set(alerts.filter(wacht).map(a => a.symbool))];
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/state/prijsalerts.ts`
if (require.main === module) {
  const basis = { id: 'a', symbool: 'BTC', aangemaakt: 0 };

  // De richting komt uit de koers van het moment van aanmaken.
  console.assert(richtingVoor(80000, 75000) === 'boven', 'een niveau boven de koers is een boven-alert');
  console.assert(richtingVoor(70000, 75000) === 'onder', 'een niveau onder de koers is een onder-alert');
  console.assert(richtingVoor(75000, 75000) === 'boven', 'precies op de koers telt als boven');

  const boven: Prijsalert = { ...basis, prijs: 80000, richting: 'boven' };
  const onder: Prijsalert = { ...basis, id: 'b', prijs: 70000, richting: 'onder' };

  console.assert(geraakteAlerts([boven], { BTC: 80001 }).length === 1, 'boven het niveau is raak');
  console.assert(geraakteAlerts([boven], { BTC: 80000 }).length === 1, 'precies op het niveau is ook raak');
  console.assert(geraakteAlerts([boven], { BTC: 79999 }).length === 0, 'eronder is niet raak');
  console.assert(geraakteAlerts([onder], { BTC: 69999 }).length === 1, 'onder het niveau is raak');
  console.assert(geraakteAlerts([onder], { BTC: 70001 }).length === 0, 'erboven is niet raak');

  // Dit is de kern: een alert die al afging doet nooit meer mee, ook niet als de koers er nog staat.
  const alAfgegaan: Prijsalert = { ...boven, afgegaanOp: 123 };
  console.assert(geraakteAlerts([alAfgegaan], { BTC: 90000 }).length === 0,
    'een afgegane alert vuurt niet nog eens, hoe ver de koers ook doorloopt');

  // Geen koers is geen melding. Zonder deze regel zou een mislukt prijsverzoek als 0 kunnen
  // binnenkomen en elke onder-alert in één klap laten afgaan.
  console.assert(geraakteAlerts([onder], {}).length === 0, 'zonder koers geen treffer');
  console.assert(geraakteAlerts([onder], { BTC: 0 }).length === 0, 'een koers van 0 is geen koers');
  console.assert(geraakteAlerts([onder], { BTC: NaN }).length === 0, 'NaN is geen koers');
  console.assert(geraakteAlerts([boven], { ETH: 90000 }).length === 0, 'een koers van een andere coin telt niet');

  // De koers waarop hij afging komt mee, want die wijkt af van het gekozen niveau.
  const [treffer] = geraakteAlerts([boven], { BTC: 80412 });
  console.assert(treffer.koers === 80412, `de werkelijke koers hoort mee te komen, was ${treffer?.koers}`);

  // Invoervalidatie.
  console.assert(niveauProbleem(0, 100) !== null, 'nul is geen niveau');
  console.assert(niveauProbleem(-5, 100) !== null, 'negatief is geen niveau');
  console.assert(niveauProbleem(NaN, 100) !== null, 'NaN is geen niveau');
  console.assert(niveauProbleem(110, 100) === null, '10% erboven is prima');
  console.assert(niveauProbleem(100.2, 100) !== null, '0,2% erboven gaat vrijwel meteen af');
  console.assert(niveauProbleem(99.8, 100) !== null, 'dat geldt ook aan de onderkant');
  console.assert(niveauProbleem(100.6, 100) === null, '0,6% erboven mag');
  // Zonder koers valt er niets over de afstand te zeggen; dan alleen het getal zelf toetsen.
  console.assert(niveauProbleem(100, null) === null, 'zonder koers geen afstandsklacht');

  console.assert(wachtendeSymbolen([boven, onder, alAfgegaan]).length === 1,
    'wachtende symbolen ontdubbelt en slaat afgegane alerts over');
  console.assert(wachtendeSymbolen([alAfgegaan]).length === 0, 'alleen afgegane alerts kosten geen verzoek');

  console.log('prijsalerts.ts self-check geslaagd');
}
