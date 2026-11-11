// Het trackrecord van de volglijst op Kansen: elke coin die op de radar kwam, met het plan dat
// erbij stond en wat ermee gebeurde. Geen koopsignalen. Het doel is nakijken of de lijst live doet
// wat meting M zei (RADAR_METING_NETTO_R, na kosten, bij een gunstig klimaat).
//
// Bewust een eigen logboek naast het signaalboek van Markt (engine/signaalLog.ts): dat voedt
// Signaalresultaat, het weekrapport en Gemiste kansen, en daar hoort een coin waar Kader geen
// koopadvies bij gaf niet tussen. De uitkomstregels zijn wel dezelfde (bepaalUitkomst).
//
// Verschil met de meting dat je moet kennen: de meting stapt in op de open van de dag na het
// signaal, dit logboek op de koers van het moment dat de scan liep.
//
// Puur, met een self-check onderaan: `npx tsx src/engine/volglijstLog.ts` vanuit app/.

import type { Opportunity } from './types';
import type { Klimaat } from './marktklimaat';
import { nettoR, type SignaalUitkomst } from './signaalLog';
import { RADAR_DREMPEL } from './momentum';

export interface GevolgdeKans {
  id: string;
  symbool: string;
  // Moment van de scan waarop de coin op de radar stond, in ms.
  tijd: number;
  // De momentumscore op dat moment.
  score: number;
  entry: number;
  stop: number;
  doel: number;
  // Het klimaat van die scan. Null als het niet te bepalen was. De meting gold bij 'gunstig'.
  klimaat: Klimaat | null;
  uitkomst: SignaalUitkomst;
  uitkomstTijd?: number;
  // Bruto, in R: (uitstap - entry) / (entry - stop). Alleen bij een afgesloten regel.
  behaaldeR?: number;
}

// Ruim een jaar bij een paar coins per dag op de radar.
export const MAX_GEVOLGD = 500;

// Nieuwe radar-coins erbij. Een coin met een regel die nog loopt krijgt geen tweede: anders telt
// dezelfde koersbeweging elke dag dat hij op de radar blijft opnieuw mee. Op een lege radar staat
// niets dat de drempel haalt, dus dan komt er niets bij.
export function voegKansenToe(
  log: GevolgdeKans[],
  kansen: Opportunity[],
  radarLeeg: boolean,
  klimaat: Klimaat | null,
  nu: number,
): GevolgdeKans[] {
  if (radarLeeg) return log;
  const lopend = new Set(log.filter(s => s.uitkomst === 'open').map(s => s.symbool));
  const nieuw: GevolgdeKans[] = [];
  for (const k of kansen) {
    const plan = k.niveaus;
    if (!plan || k.momentumScore < RADAR_DREMPEL || lopend.has(k.symbool)) continue;
    if (!(plan.entry > plan.stopLoss) || !(plan.takeProfit > plan.entry)) continue;
    lopend.add(k.symbool);
    nieuw.push({
      id: `${k.symbool}-${nu}`,
      symbool: k.symbool,
      tijd: nu,
      score: Math.round(k.momentumScore),
      entry: plan.entry,
      stop: plan.stopLoss,
      doel: plan.takeProfit,
      klimaat,
      uitkomst: 'open',
    });
  }
  if (nieuw.length === 0) return log;
  const samen = [...log, ...nieuw];
  return samen.length > MAX_GEVOLGD ? samen.slice(samen.length - MAX_GEVOLGD) : samen;
}

// Na kosten, met dezelfde formule als het signaalboek van Markt.
export { nettoR };

export interface VolglijstStand {
  aantal: number;
  // Gemiddelde netto R van de afgesloten regels, null zonder afgesloten regels.
  gemNettoR: number | null;
}

export interface VolglijstSamenvatting {
  // Afgesloten bij een gunstig klimaat: de groep die met de meting te vergelijken is.
  gunstig: VolglijstStand;
  // Afgesloten bij een gemengd, ongunstig of onbekend klimaat.
  overig: VolglijstStand;
  lopend: number;
  sinds: number | null;
}

function stand(lijst: GevolgdeKans[]): VolglijstStand {
  const r = lijst.map(nettoR).filter((x): x is number => x !== null);
  return { aantal: r.length, gemNettoR: r.length ? r.reduce((a, b) => a + b, 0) / r.length : null };
}

export function vatVolglijstSamen(log: GevolgdeKans[]): VolglijstSamenvatting {
  const af = log.filter(s => s.uitkomst !== 'open');
  return {
    gunstig: stand(af.filter(s => s.klimaat === 'gunstig')),
    overig: stand(af.filter(s => s.klimaat !== 'gunstig')),
    lopend: log.length - af.length,
    sinds: log.length ? Math.min(...log.map(s => s.tijd)) : null,
  };
}

if (typeof require !== 'undefined' && require.main === module) {
  const kans = (symbool: string, score: number, entry = 100): Opportunity => ({
    symbool, momentumScore: score,
    niveaus: { entry, stopLoss: entry * 0.8, takeProfit: entry * 1.6, rr: 3 },
  } as Opportunity);
  const nu = Date.UTC(2026, 10, 11, 20);

  const log1 = voegKansenToe([], [kans('PEPE', 82), kans('SOL', 60)], false, 'gunstig', nu);
  console.assert(log1.length === 1 && log1[0].symbool === 'PEPE' && log1[0].klimaat === 'gunstig',
    'alleen wie de drempel haalt komt erbij');
  console.assert(log1[0].stop === 80 && log1[0].doel === 160, 'het plan van de kaart hoort mee te gaan');
  console.assert(voegKansenToe(log1, [kans('PEPE', 90)], false, 'gunstig', nu + 86_400_000) === log1,
    'zolang de regel loopt komt er geen tweede bij');
  console.assert(voegKansenToe([], [kans('PEPE', 82)], true, null, nu).length === 0, 'een lege radar logt niets');
  console.assert(voegKansenToe([], [{ ...kans('PEPE', 82), niveaus: null }], false, null, nu).length === 0,
    'zonder plan valt er niets te volgen');

  // Netto: doel geraakt is bruto +3 R. Kosten 1% over 100 en 1% over 160, op een risico van 20.
  const doel = { entry: 100, stop: 80, behaaldeR: 3 };
  console.assert(Math.abs((nettoR(doel) ?? 0) - (3 - 2.6 / 20)) < 1e-9, `netto bij doel klopt niet: ${nettoR(doel)}`);
  // Stop geraakt is bruto -1 R, netto -1 min 1% over 100 en 1% over 80.
  const stop = { entry: 100, stop: 80, behaaldeR: -1 };
  console.assert(Math.abs((nettoR(stop) ?? 0) - (-1 - 1.8 / 20)) < 1e-9, `netto bij stop klopt niet: ${nettoR(stop)}`);
  console.assert(nettoR({ entry: 100, stop: 80 }) === null, 'een lopende regel heeft geen resultaat');

  const af = (klimaat: Klimaat | null, r: number): GevolgdeKans =>
    ({ ...log1[0], id: `${klimaat}${r}`, klimaat, uitkomst: r > 0 ? 'doel' : 'stop', behaaldeR: r });
  const sam = vatVolglijstSamen([af('gunstig', 3), af('gunstig', -1), af('ongunstig', -1), af(null, 3), log1[0]]);
  console.assert(sam.gunstig.aantal === 2 && sam.overig.aantal === 2 && sam.lopend === 1, 'de groepen kloppen niet');
  console.assert(Math.abs((sam.gunstig.gemNettoR ?? 0) - ((3 - 0.13) + (-1 - 0.09)) / 2) < 1e-9,
    `gemiddelde bij gunstig klopt niet: ${sam.gunstig.gemNettoR}`);
  console.assert(vatVolglijstSamen([]).gunstig.gemNettoR === null && vatVolglijstSamen([]).sinds === null, 'leeg hoort leeg te zijn');

  console.log('volglijstLog.ts self-check geslaagd');
}
