// Het signaalboek: elk koopsignaal dat Kader geeft, met wat er daarna gebeurde. Hiermee zie je of
// de signalen live doen wat de backtest belooft. Puur: geen opslag, geen fetch. De opslag en het
// ophalen van candles staan in state/signaalBoek.ts.
//
// De uitkomst volgt precies dezelfde regels als `simuleer()` in scripts/backtest.ts, anders is
// het ijkpunt "backtest +0.15 R" een appel tegen een peer:
// - pas de candles ná de dag van het signaal tellen;
// - een gap door stop of doel heen rekent met de open, niet met het niveau;
// - raakt één candle zowel stop als doel, dan telt de stop (we weten niet wat eerst kwam);
// - na LOOPTIJD_DAGEN zonder stop of doel: verlopen, met de slotkoers.

import type { Candle, Trade } from './types';
import { DREMPEL_HOOG, DREMPEL_KOOP, DREMPEL_STERK_KOOP } from './drempels';

export type SignaalUitkomst = 'open' | 'doel' | 'stop' | 'verlopen';
export type SignaalAdvies = 'STERK KOOP' | 'KOOPZONE';

export interface GelogdSignaal {
  id: string;
  symbool: string;
  // Moment waarop Kader het signaal gaf, in ms.
  tijd: number;
  score: number;
  advies: SignaalAdvies;
  entry: number;
  stop: number;
  doel: number;
  rr: number;
  uitkomst: SignaalUitkomst;
  uitkomstTijd?: number;
  // Resultaat in R: (uitstap - entry) / (entry - stop). Alleen bij een afgesloten signaal.
  behaaldeR?: number;
}

// Gelijk aan MAX_BARS in de backtest (Meting E: doel 3x ATR, 30 dagen).
export const LOOPTIJD_DAGEN = 30;
// Een signaal per coin per dag kan, dus 500 is ruim een jaar bij een drukke markt.
export const MAX_SIGNALEN = 500;
const DAG_MS = 24 * 60 * 60 * 1000;

// Hetzelfde label dat de Markt-kaart toont (TradeCard.adviesLabel), alleen voor KOOP-signalen.
export function adviesVan(t: Trade): SignaalAdvies | null {
  if (t.signaal !== 'KOOP') return null;
  return t.highConviction || t.score >= DREMPEL_STERK_KOOP ? 'STERK KOOP' : 'KOOPZONE';
}

// Nieuwe signalen erbij. Een coin met een signaal dat nog loopt krijgt geen tweede: anders telt
// dezelfde koersbeweging elke dag dat het signaal blijft staan opnieuw mee.
export function voegSignalenToe(log: GelogdSignaal[], trades: Trade[], nu: number): GelogdSignaal[] {
  const lopend = new Set(log.filter(s => s.uitkomst === 'open').map(s => s.symbool));
  const nieuw: GelogdSignaal[] = [];
  for (const t of trades) {
    const advies = adviesVan(t);
    if (!advies || lopend.has(t.symbool)) continue;
    if (!(t.entry > t.stopLoss) || !(t.takeProfit > t.entry)) continue;
    lopend.add(t.symbool);
    nieuw.push({
      id: `${t.symbool}-${nu}`,
      symbool: t.symbool,
      tijd: nu,
      score: Math.round(t.score),
      advies,
      entry: t.entry,
      stop: t.stopLoss,
      doel: t.takeProfit,
      rr: t.rr,
      uitkomst: 'open',
    });
  }
  if (nieuw.length === 0) return log;
  const samen = [...log, ...nieuw];
  return samen.length > MAX_SIGNALEN ? samen.slice(samen.length - MAX_SIGNALEN) : samen;
}

// Wat bepaalUitkomst van een signaal nodig heeft. Ook de volglijst van Kansen
// (engine/volglijstLog.ts) heeft deze velden en volgt zo precies dezelfde regels.
export type VolgbaarSignaal = Pick<GelogdSignaal, 'tijd' | 'entry' | 'stop' | 'doel' | 'uitkomst' | 'uitkomstTijd' | 'behaaldeR'>;

// Werkt één open signaal bij met dagcandles van die coin. Geeft het signaal ongewijzigd terug als
// er nog niets beslist is.
export function bepaalUitkomst<T extends VolgbaarSignaal>(s: T, candles: Candle[], nu: number): T {
  if (s.uitkomst !== 'open') return s;
  const risico = s.entry - s.stop;
  if (risico <= 0) return s;

  // Een dagcandle met openingstijd na de signaaldag. Zonder tijd valt een candle niet te plaatsen.
  const startNa = Math.floor(s.tijd / DAG_MS) * DAG_MS + DAG_MS;
  const eind = startNa + LOOPTIJD_DAGEN * DAG_MS;
  const na = candles.filter(c => typeof c.tijd === 'number' && c.tijd >= startNa && c.tijd < eind);
  const sluit = (uitkomst: SignaalUitkomst, prijs: number, tijd: number): T => ({
    ...s, uitkomst, uitkomstTijd: tijd, behaaldeR: (prijs - s.entry) / risico,
  });

  for (const c of na) {
    const t = c.tijd as number;
    if (c.open <= s.stop) return sluit('stop', c.open, t);
    if (c.open >= s.doel) return sluit('doel', c.open, t);
    if (c.low <= s.stop) return sluit('stop', s.stop, t);
    if (c.high >= s.doel) return sluit('doel', s.doel, t);
  }

  // Verlopen pas als de laatste candle van de looptijd echt gesloten is.
  if (nu >= eind && na.length > 0) {
    const laatste = na[na.length - 1];
    return sluit('verlopen', laatste.close, (laatste.tijd as number) + DAG_MS);
  }
  return s;
}

export interface Groepsstand {
  aantal: number;
  gemR: number | null;
}

export interface SignaalSamenvatting {
  // Alleen afgesloten signalen tellen mee in de cijfers.
  afgesloten: number;
  lopend: number;
  // Aandeel afgesloten signalen met een positief resultaat, 0-100.
  raakPct: number | null;
  gemR: number | null;
  sinds: number | null;
  perBand: { id: 'hoog' | 'midden' | 'laag'; label: string; stand: Groepsstand }[];
  perAdvies: { id: SignaalAdvies; label: string; stand: Groepsstand }[];
}

function stand(lijst: GelogdSignaal[]): Groepsstand {
  const r = lijst.map(s => s.behaaldeR).filter((x): x is number => typeof x === 'number');
  return { aantal: r.length, gemR: r.length ? r.reduce((a, b) => a + b, 0) / r.length : null };
}

export function vatSamen(log: GelogdSignaal[]): SignaalSamenvatting {
  const af = log.filter(s => s.uitkomst !== 'open' && typeof s.behaaldeR === 'number');
  const totaal = stand(af);
  const raak = af.filter(s => (s.behaaldeR as number) > 0).length;
  const midden = Math.round((DREMPEL_KOOP + DREMPEL_HOOG) / 2);
  return {
    afgesloten: af.length,
    lopend: log.length - log.filter(s => s.uitkomst !== 'open').length,
    raakPct: af.length ? (raak / af.length) * 100 : null,
    gemR: totaal.gemR,
    sinds: log.length ? Math.min(...log.map(s => s.tijd)) : null,
    perBand: [
      { id: 'hoog', label: `Score ${DREMPEL_HOOG}+`, stand: stand(af.filter(s => s.score >= DREMPEL_HOOG)) },
      { id: 'midden', label: `Score ${midden} tot ${DREMPEL_HOOG}`, stand: stand(af.filter(s => s.score >= midden && s.score < DREMPEL_HOOG)) },
      { id: 'laag', label: `Score ${DREMPEL_KOOP} tot ${midden}`, stand: stand(af.filter(s => s.score < midden)) },
    ],
    perAdvies: [
      { id: 'STERK KOOP', label: 'Sterk koop', stand: stand(af.filter(s => s.advies === 'STERK KOOP')) },
      { id: 'KOOPZONE', label: 'Koopzone', stand: stand(af.filter(s => s.advies === 'KOOPZONE')) },
    ],
  };
}

// ponytail: self-check ipv testframework, run met `npx tsx src/engine/signaalLog.ts` vanuit app/
if (require.main === module) {
  const dag0 = Date.UTC(2026, 10, 1, 9);
  const d = (n: number) => Date.UTC(2026, 10, 1 + n);
  const sig: GelogdSignaal = {
    id: 'x', symbool: 'BTC', tijd: dag0, score: 70, advies: 'KOOPZONE',
    entry: 100, stop: 90, doel: 130, rr: 3, uitkomst: 'open',
  };
  const c = (n: number, open: number, high: number, low: number, close: number): Candle =>
    ({ open, high, low, close, volume: 0, tijd: d(n) });

  // De candle van de signaaldag zelf telt niet mee, ook al raakt hij de stop.
  const r0 = bepaalUitkomst(sig, [c(0, 100, 101, 80, 95)], d(1));
  console.assert(r0.uitkomst === 'open', `signaaldag telt niet, was ${r0.uitkomst}`);

  const r1 = bepaalUitkomst(sig, [c(1, 100, 135, 99, 120)], d(2));
  console.assert(r1.uitkomst === 'doel' && r1.behaaldeR === 3, `doel geeft +3R, was ${r1.uitkomst} ${r1.behaaldeR}`);

  const r2 = bepaalUitkomst(sig, [c(1, 100, 135, 85, 120)], d(2));
  console.assert(r2.uitkomst === 'stop' && r2.behaaldeR === -1, 'stop en doel in één candle: de stop telt');

  const r3 = bepaalUitkomst(sig, [c(1, 85, 95, 80, 90)], d(2));
  console.assert(r3.uitkomst === 'stop' && r3.behaaldeR === -1.5, `gap door de stop rekent met de open, was ${r3.behaaldeR}`);

  const vlak = Array.from({ length: 31 }, (_, i) => c(i + 1, 100, 105, 95, 104));
  const r4 = bepaalUitkomst(sig, vlak, d(40));
  console.assert(r4.uitkomst === 'verlopen' && Math.abs((r4.behaaldeR ?? 0) - 0.4) < 1e-9, `verlopen na 30 dagen op de slotkoers, was ${r4.uitkomst} ${r4.behaaldeR}`);
  console.assert(bepaalUitkomst(sig, vlak.slice(0, 10), d(11)).uitkomst === 'open', 'binnen de looptijd blijft hij open');

  const trade = { symbool: 'ETH', signaal: 'KOOP', highConviction: false, score: 60, entry: 10, stopLoss: 9, takeProfit: 13, rr: 3 } as Trade;
  const log1 = voegSignalenToe([], [trade], dag0);
  const log2 = voegSignalenToe(log1, [trade], dag0 + DAG_MS);
  console.assert(log1.length === 1 && log2.length === 1, 'zolang het signaal loopt komt er geen tweede bij');
  console.assert(voegSignalenToe([], [{ ...trade, signaal: 'WATCH' } as Trade], dag0).length === 0, 'WATCH wordt niet gelogd');

  const sam = vatSamen([r1, r2, r4, sig]);
  console.assert(sam.afgesloten === 3 && sam.lopend === 1, `drie af, één lopend, was ${sam.afgesloten}/${sam.lopend}`);
  console.assert(Math.abs((sam.gemR ?? 0) - 0.8) < 1e-9, `gemiddeld (3 - 1 + 0.4) / 3 = 0.8, was ${sam.gemR}`);

  console.log('signaalLog.ts self-check geslaagd');
}
