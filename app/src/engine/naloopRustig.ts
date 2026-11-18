// De live naloop van regel C uit meting O (docs/metingen.md, docs/review-markt-algoritme.md): bij
// een open klimaatpoort de vijf rustigste coins (laagste ATR ten opzichte van de koers), zonder
// doel, met een stop die meeloopt met het laagste punt van de laatste 20 dagen. Op de coins die
// nooit in een meting zaten haalde die regel als eerste in Kader de toets; hier wordt hij live
// nagelopen, als een papieren portefeuille van 5 plekken. Geen koopadvies en geen echte orders.
//
// Puur: geen opslag, geen fetch. Opslag en ophalen staan in state/naloopBoek.ts. De regels volgen
// handel() en portefeuille() in scripts/meting-algoritme.ts:
// - de beginstop is 3x ATR onder de instap (radarNiveaus, hetzelfde plan als de kaart);
// - de stop wordt op het slot van een afgesloten dag gezet en geldt vanaf de dag erna, alleen omhoog;
// - een gap door de stop rekent met de open;
// - na 365 dagen zonder stop: verkopen op het slot;
// - 1,5% kosten bij kopen en bij verkopen (de lat in docs/mandje-lat.md), elke positie 1/5 van
//   het papieren vermogen bij instap.
//
// Deze naloop is sinds meting Q ook het Kader-mandje: wat hier open staat is het koopadvies op
// Markt, zolang latStatus() hieronder zegt dat de lat gehaald wordt.
//
// Verschil met de meting: de instap is de koers op het moment van de scan (zoals het signaalboek),
// niet de open van de dag erna. De candles van de instapdag zelf tellen niet mee voor de stop.

import type { Candle, Trade } from './types';
import { radarNiveaus } from './momentum';

export const NALOOP_PLEKKEN = 5;
export const NALOOP_LOW_DAGEN = 20;
export const NALOOP_MAX_DAGEN = 365;
// docs/mandje-lat.md: 1% eToro plus een marge voor de spread.
export const NALOOP_KOSTEN = 0.015;
const K = NALOOP_KOSTEN;
const DAG_MS = 86_400_000;
const dagVan = (ms: number) => Math.floor(ms / DAG_MS) * DAG_MS;

export type NaloopUitkomst = 'open' | 'stop' | 'verlopen';

export interface NaloopPositie {
  id: string;
  symbool: string;
  tijd: number;              // moment van instap, ms
  entry: number;
  beginStop: number;
  stop: number;              // de stop zoals hij nu staat
  // Openingstijd van de laatste afgesloten dag waarvan het slot al in de stop verwerkt is.
  verwerktTot: number;
  stuks: number;             // papieren eenheden
  uitkomst: NaloopUitkomst;
  uitkomstTijd?: number;
  uitPrijs?: number;
}

export interface NaloopBoek {
  versie: 2;
  start: number | null;      // eerste instap
  btcStart: number | null;   // BTC-koers bij de eerste instap, voor de ijklijn
  kas: number;               // begint op 1
  posities: NaloopPositie[];
  laatstePrijs: Record<string, number>;
  laatstBijgewerkt: number;
  // Voor de lat: de hoogste stand van het vermogen, welke ijkmomenten al bekeken zijn, en of en
  // waarom de lat afging. Eenmaal afgegaan blijft het mandje uit (docs/mandje-lat.md).
  piek: number;
  bekekenTot: number;
  latAf?: { tijd: number; reden: string };
}

export const leegBoek = (): NaloopBoek => ({ versie: 2, start: null, btcStart: null, kas: 1, posities: [], laatstePrijs: {}, laatstBijgewerkt: 0, piek: 1, bekekenTot: 0 });

// Versie 1 rekende met 1% per kant. Herrekenen met 1,5%: elke instap houdt hetzelfde bedrag maar
// krijgt minder stuks, en de kas wordt opnieuw opgeteld uit die bedragen en de opbrengsten.
export function migreer(b: { versie: number } & Omit<NaloopBoek, 'versie' | 'piek' | 'bekekenTot'>): NaloopBoek {
  if (b.versie === 2) return b as unknown as NaloopBoek;
  let kas = 1;
  const posities = b.posities.map(p => {
    const bedrag = p.stuks * p.entry * 1.01;
    const stuks = bedrag / (p.entry * (1 + K));
    kas -= bedrag;
    if (p.uitkomst !== 'open' && typeof p.uitPrijs === 'number') kas += stuks * p.uitPrijs * (1 - K);
    return { ...p, stuks };
  });
  const uit: NaloopBoek = { ...b, versie: 2, posities, kas: Math.max(0, kas), piek: 1, bekekenTot: 0 };
  return { ...uit, piek: Math.max(1, vermogen(uit)) };
}

// ATR ten opzichte van de koers: de maat voor "rustig" uit meting O.
export const rust = (t: Pick<Trade, 'atr' | 'prijs'>) => t.atr / t.prijs;

export function vermogen(b: NaloopBoek): number {
  return b.kas + b.posities.filter(p => p.uitkomst === 'open').reduce((s, p) => s + p.stuks * (b.laatstePrijs[p.symbool] ?? p.entry), 0);
}

// Na elke analyse: prijzen bijwerken en, als de poort open is, lege plekken vullen met de rustigste
// coins die nog niet in de portefeuille zitten. Een coin die vandaag uitging komt pas morgen terug,
// zoals in de meting.
export function vulAan(b: NaloopBoek, trades: Trade[], poortIsOpen: boolean, nu: number): NaloopBoek {
  const prijzen = { ...b.laatstePrijs };
  for (const t of trades) if (t.prijs > 0) prijzen[t.symbool] = t.prijs;
  let boek: NaloopBoek = { ...b, laatstePrijs: prijzen };
  if (!poortIsOpen) return boek;

  const open = boek.posities.filter(p => p.uitkomst === 'open');
  if (open.length >= NALOOP_PLEKKEN) return boek;
  const bezet = new Set(open.map(p => p.symbool));
  const vandaagUit = new Set(boek.posities.filter(p => p.uitkomstTijd !== undefined && dagVan(p.uitkomstTijd) >= dagVan(nu)).map(p => p.symbool));
  const kandidaten = trades
    .filter(t => t.bron === 'Binance' && t.atr > 0 && t.prijs > 0 && !bezet.has(t.symbool) && !vandaagUit.has(t.symbool))
    .sort((x, y) => rust(x) - rust(y) || (x.symbool < y.symbool ? -1 : 1));

  const nieuw: NaloopPositie[] = [];
  let kas = boek.kas;
  // Zoals de meting: elke plek is 1/5 van het vermogen van vóór deze aankopen.
  const totaal = vermogen(boek);
  for (const t of kandidaten) {
    if (open.length + nieuw.length >= NALOOP_PLEKKEN) break;
    const nv = radarNiveaus(t.prijs, t.atr);
    if (!nv) continue;
    const bedrag = Math.min(totaal / NALOOP_PLEKKEN, kas);
    if (!(bedrag > 1e-9)) break;
    kas -= bedrag;
    nieuw.push({
      id: `${t.symbool}-${nu}`, symbool: t.symbool, tijd: nu, entry: t.prijs,
      beginStop: nv.stopLoss, stop: nv.stopLoss, verwerktTot: dagVan(nu) - DAG_MS,
      stuks: bedrag / (t.prijs * (1 + K)), uitkomst: 'open',
    });
  }
  if (nieuw.length === 0) return boek;
  const btc = trades.find(t => t.symbool === 'BTC')?.prijs ?? null;
  boek = {
    ...boek, kas, posities: [...boek.posities, ...nieuw],
    start: boek.start ?? nu, btcStart: boek.btcStart ?? btc,
  };
  return boek;
}

// Werkt één open positie bij met de dagcandles van die coin (oudste eerst). Dagen na de instapdag
// worden op stop gecontroleerd; elk afgesloten dag zet daarna de stop voor de volgende dag. Geeft
// de positie terug en, als hij uitging, de opbrengst voor de kas.
export function volg(p: NaloopPositie, candles: Candle[], nu: number): { p: NaloopPositie; opbrengst: number } {
  if (p.uitkomst !== 'open') return { p, opbrengst: 0 };
  const instapDag = dagVan(p.tijd);
  const metTijd = candles.filter(c => typeof c.tijd === 'number');
  let stop = p.stop, verwerktTot = p.verwerktTot;
  const sluit = (uitkomst: NaloopUitkomst, prijs: number, tijd: number) => ({
    p: { ...p, stop, verwerktTot, uitkomst, uitkomstTijd: tijd, uitPrijs: prijs },
    opbrengst: p.stuks * prijs * (1 - K),
  });
  for (let k = 0; k < metTijd.length; k++) {
    const c = metTijd[k];
    const t = c.tijd as number;
    if (t <= verwerktTot) continue;
    if (t > instapDag) {
      if (c.open <= stop) return sluit('stop', c.open, t);
      if (c.low <= stop) return sluit('stop', stop, t);
    }
    const afgesloten = t + DAG_MS <= nu;
    if (!afgesloten) break;
    if (t >= instapDag + NALOOP_MAX_DAGEN * DAG_MS) return sluit('verlopen', c.close, t + DAG_MS);
    let laagste = Infinity;
    for (let j = Math.max(0, k - NALOOP_LOW_DAGEN + 1); j <= k; j++) laagste = Math.min(laagste, metTijd[j].low);
    // Minder dan 20 dagen historie in de reeks: dan geen meeloop, de stop blijft.
    if (k >= NALOOP_LOW_DAGEN - 1) stop = Math.max(stop, laagste);
    verwerktTot = t;
  }
  return { p: { ...p, stop, verwerktTot }, opbrengst: 0 };
}

// --- de lat (docs/mandje-lat.md) ---------------------------------------------------------------

// De klok loopt vanaf de start van de naloop, niet vanaf de eerste instap op dit toestel.
export const LAT_START = Date.UTC(2026, 10, 12);
export const LAT_GRENS = -0.10;      // vermogen sinds de start op een ijkmoment
export const LAT_NOODREM = -0.60;    // terugval vanaf de hoogste stand, op elk moment

const plusMaanden = (ms: number, n: number) => { const d = new Date(ms); d.setUTCMonth(d.getUTCMonth() + n); return d.getTime(); };
// 12 mei 2027, 12 nov 2027, daarna elk jaar op 12 nov.
export function ijkmomenten(tot: number): number[] {
  const uit = [plusMaanden(LAT_START, 6)];
  for (let n = 12; plusMaanden(LAT_START, n) <= tot + 400 * DAG_MS; n += 12) uit.push(plusMaanden(LAT_START, n));
  return uit;
}

// Na elke update: piek bijwerken, de noodrem en een verstreken ijkmoment controleren. Een lat die
// afging blijft af; de naloop zelf draait door.
export function controleerLat(b: NaloopBoek, nu: number): NaloopBoek {
  const v = vermogen(b);
  const piek = Math.max(b.piek, v);
  let latAf = b.latAf, bekekenTot = b.bekekenTot;
  if (!latAf && v / piek - 1 < LAT_NOODREM) latAf = { tijd: nu, reden: `het mandje zakte meer dan ${Math.round(-LAT_NOODREM * 100)}% onder zijn hoogste stand` };
  for (const m of ijkmomenten(nu)) {
    if (m > nu || m <= bekekenTot) continue;
    bekekenTot = m;
    if (!latAf && v - 1 < LAT_GRENS) latAf = { tijd: nu, reden: `het mandje stond op het ijkmoment ${Math.round((v - 1) * 100)}%, de grens is ${Math.round(LAT_GRENS * 100)}%` };
  }
  return piek === b.piek && latAf === b.latAf && bekekenTot === b.bekekenTot ? b : { ...b, piek, latAf, bekekenTot };
}

export interface LatStatus {
  actief: boolean;
  reden?: string;
  volgendIjkmoment: number | null;
  terugval: number;     // vanaf de hoogste stand, 0 of negatief
}

export function latStatus(b: NaloopBoek, nu: number): LatStatus {
  const v = vermogen(b);
  return {
    actief: !b.latAf,
    reden: b.latAf?.reden,
    volgendIjkmoment: ijkmomenten(nu).find(m => m > nu) ?? null,
    terugval: Math.min(0, v / Math.max(b.piek, v) - 1),
  };
}

export function nettoR(p: NaloopPositie): number | null {
  if (p.uitkomst === 'open' || typeof p.uitPrijs !== 'number') return null;
  const risico = p.entry - p.beginStop;
  if (!(risico > 0)) return null;
  return (p.uitPrijs - p.entry - K * (p.entry + p.uitPrijs)) / risico;
}

export interface NaloopSamenvatting {
  sinds: number | null;
  rendement: number;            // papieren vermogen min 1
  btcRendement: number | null;  // BTC houden sinds de eerste instap, met dezelfde kosten
  afgesloten: number;
  gemNettoR: number | null;
  open: NaloopPositie[];
}

export function vatNaloopSamen(b: NaloopBoek): NaloopSamenvatting {
  const af = b.posities.map(nettoR).filter((x): x is number => x !== null);
  const btcNu = b.laatstePrijs.BTC;
  return {
    sinds: b.start,
    rendement: vermogen(b) - 1,
    btcRendement: b.btcStart && btcNu
      ? (btcNu * (1 - K)) / (b.btcStart * (1 + K)) - 1
      : null,
    afgesloten: af.length,
    gemNettoR: af.length ? af.reduce((s, x) => s + x, 0) / af.length : null,
    open: b.posities.filter(p => p.uitkomst === 'open'),
  };
}

// ponytail: self-check ipv testframework, run met `npx tsx src/engine/naloopRustig.ts` vanuit app/
if (require.main === module) {
  const dag0 = Date.UTC(2026, 10, 12, 10);
  const d = (n: number) => Date.UTC(2026, 10, 12 + n);
  const tr = (symbool: string, prijs: number, atr: number) => ({ symbool, bron: 'Binance', prijs, atr } as Trade);

  // Poort dicht: alleen prijzen bij, geen posities.
  const dicht = vulAan(leegBoek(), [tr('BTC', 100, 4)], false, dag0);
  console.assert(dicht.posities.length === 0 && dicht.laatstePrijs.BTC === 100, 'poort dicht: niets kopen');

  // Poort open: de vijf rustigste van zeven, gelijk verdeeld, kosten bij de instap.
  const zeven = [tr('A', 100, 10), tr('B', 100, 2), tr('C', 100, 3), tr('D', 100, 4), tr('E', 100, 5), tr('F', 100, 6), tr('BTC', 100, 1)];
  const b1 = vulAan(leegBoek(), zeven, true, dag0);
  console.assert(b1.posities.map(p => p.symbool).join() === 'BTC,B,C,D,E', `rustigste eerst, was ${b1.posities.map(p => p.symbool)}`);
  console.assert(Math.abs(b1.kas) < 1e-9 && Math.abs(vermogen(b1) - 1 / (1 + K)) < 1e-9, `alles belegd na kosten, vermogen ${vermogen(b1)}`);
  console.assert(vulAan(b1, zeven, true, dag0 + 1000).posities.length === 5, 'vol is vol');

  // Meelopende stop: B op 100, ATR 2, beginstop 94. 20 dagen historie op laag 90, dan stijgt hij.
  const p = b1.posities.find(x => x.symbool === 'B') as NaloopPositie;
  const hist: Candle[] = Array.from({ length: 19 }, (_, i) => ({ open: 100, high: 101, low: 90, close: 100, volume: 0, tijd: d(-19 + i) }));
  const c = (n: number, o: number, h: number, l: number, cl: number): Candle => ({ open: o, high: h, low: l, close: cl, volume: 0, tijd: d(n) });
  // Instapdag (0) laag 99: de stop wordt min(laag 20d) = 90, blijft dus 94.
  const r0 = volg(p, [...hist, c(0, 100, 101, 99, 100)], d(1));
  console.assert(r0.p.uitkomst === 'open' && r0.p.stop === 94 && r0.p.verwerktTot === d(0), `instapdag verwerkt, stop 94, was ${r0.p.stop}`);
  // Twintig dagen hoger: laagste punt wordt 110, dan dag 21 zakt door 110.
  const hoog = Array.from({ length: 20 }, (_, i) => c(1 + i, 120, 125, 110, 120));
  const r1 = volg(r0.p, [...hist, c(0, 100, 101, 99, 100), ...hoog, c(21, 118, 119, 105, 106)], d(22));
  console.assert(r1.p.uitkomst === 'stop' && r1.p.uitPrijs === 110, `meelopende stop op 110, was ${r1.p.uitkomst} ${r1.p.uitPrijs}`);
  console.assert(Math.abs(r1.opbrengst - p.stuks * 110 * (1 - K)) < 1e-12, 'opbrengst na kosten');
  // Netto R: (110 - 100 - 0,015 * 210) / 6.
  console.assert(Math.abs((nettoR(r1.p) ?? 0) - (10 - 3.15) / 6) < 1e-9, `netto R klopt niet: ${nettoR(r1.p)}`);
  // Een gap door de stop rekent met de open.
  const r2 = volg(r0.p, [...hist, c(0, 100, 101, 99, 100), c(1, 80, 85, 79, 84)], d(2));
  console.assert(r2.p.uitkomst === 'stop' && r2.p.uitPrijs === 80, 'gap door de stop: de open');
  // De lopende dag zet de stop nog niet.
  const r3 = volg(r0.p, [...hist, c(0, 100, 101, 99, 100), c(1, 120, 125, 110, 120)], d(1) + 3_600_000);
  console.assert(r3.p.uitkomst === 'open' && r3.p.verwerktTot === d(0), 'lopende dag telt niet voor de stop');

  // Wie vandaag uitging komt vandaag niet terug.
  const metUit = { ...b1, posities: b1.posities.map(x => x.symbool === 'B' ? { ...x, uitkomst: 'stop' as const, uitkomstTijd: dag0 + 1000, uitPrijs: 94 } : x), kas: 0.19 };
  console.assert(!vulAan(metUit, zeven, true, dag0 + 2000).posities.some(x => x.symbool === 'B' && x.uitkomst === 'open'), 'niet op dezelfde dag terug');
  console.assert(vulAan(metUit, zeven, true, dag0 + 2000).posities.filter(x => x.uitkomst === 'open').map(x => x.symbool).includes('F'), 'de plek gaat naar de volgende rustigste');

  const sam = vatNaloopSamen({ ...b1, laatstePrijs: { ...b1.laatstePrijs, BTC: 110 } });
  console.assert(sam.btcRendement !== null && Math.abs(sam.btcRendement - (110 * (1 - K)) / (100 * (1 + K)) + 1) < 1e-9, 'ijklijn BTC na kosten');

  // Migratie: een boek van versie 1 met één open positie van 0,2 tegen 1% wordt 0,2 tegen 1,5%.
  const v1 = { ...leegBoek(), versie: 1, kas: 0.8, posities: [{ ...p, stuks: 0.2 / (100 * 1.01) }] } as unknown as Parameters<typeof migreer>[0];
  const m = migreer(v1);
  console.assert(m.versie === 2 && Math.abs(m.kas - 0.8) < 1e-9 && Math.abs(m.posities[0].stuks - 0.2 / (100 * (1 + K))) < 1e-12, 'migratie naar 1,5%');

  // De lat: ijkmomenten 12 mei en 12 nov 2027.
  const ijk = ijkmomenten(Date.UTC(2027, 0, 1));
  console.assert(ijk[0] === Date.UTC(2027, 4, 12) && ijk[1] === Date.UTC(2027, 10, 12), `ijkmomenten, was ${ijk.map(x => new Date(x).toISOString())}`);
  const boek = (kas: number, piek = 1): NaloopBoek => ({ ...leegBoek(), kas, piek });
  // Voor het eerste ijkmoment telt -20% niet, erna wel; de lat blijft daarna af, ook bij herstel.
  console.assert(!controleerLat(boek(0.8), Date.UTC(2027, 4, 11)).latAf, 'voor het ijkmoment geen oordeel');
  const af = controleerLat(boek(0.8), Date.UTC(2027, 4, 13));
  console.assert(!!af.latAf && !latStatus(af, Date.UTC(2027, 4, 13)).actief, 'ijkmoment onder -10%: uit');
  console.assert(!!controleerLat({ ...af, kas: 2 }, Date.UTC(2027, 10, 13)).latAf, 'eenmaal af blijft af');
  console.assert(!controleerLat(boek(0.95), Date.UTC(2027, 4, 13)).latAf, '-5% op het ijkmoment: aan');
  // Een gemist ijkmoment wordt maar één keer bekeken: herstel na het moment telt niet als nieuw oordeel.
  const goed = controleerLat(boek(0.95), Date.UTC(2027, 4, 13));
  console.assert(!controleerLat({ ...goed, kas: 0.5 }, Date.UTC(2027, 4, 20)).latAf, 'tussen ijkmomenten alleen de noodrem');
  // Noodrem: van piek 2 naar 0,7 is -65%.
  console.assert(!!controleerLat(boek(0.7, 2), Date.UTC(2027, 0, 1)).latAf, 'noodrem voorbij -60%');
  console.assert(!controleerLat(boek(0.9, 2), Date.UTC(2027, 0, 1)).latAf, '-55%: geen noodrem');

  console.log('naloopRustig.ts self-check geslaagd');
}
