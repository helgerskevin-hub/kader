// Spreiding: hoe sterk je posities samen bewegen. Vijf altcoins tegelijk is in de praktijk vaak één
// weddenschap op BTC, en dan beschermt "vijf posities" je minder dan het lijkt.
//
// Gemeten met de correlatie van dagrendementen over de laatste 30 dagen. Het aantal losse
// weddenschappen is het effectieve aantal posities: n / (1 + (n - 1) * gemiddelde onderlinge
// correlatie). Vijf posities die perfect samen bewegen zijn er dan één; vijf onafhankelijke vijf.
//
// Puur, met een self-check onderaan: `npx tsx src/engine/correlatie.ts` vanuit app/.

import type { Candle } from './types';

export const CORRELATIE_DAGEN = 30;
// Minder gemeenschappelijke dagen dan dit zegt te weinig; dan geen getal.
const MIN_DAGEN = 20;
export const STERK = 0.7;
export const MATIG = 0.4;

export type Samenhang = 'sterk' | 'matig' | 'zwak';

export function samenhangVan(r: number): Samenhang {
  return r >= STERK ? 'sterk' : r >= MATIG ? 'matig' : 'zwak';
}

const DAG_MS = 24 * 60 * 60 * 1000;

// Dagrendementen van de laatste `dagen`, op dagnummer, zodat twee coins op dezelfde dagen te
// vergelijken zijn ook als er bij één een dag ontbreekt.
export function dagRendementen(candles: Candle[], dagen = CORRELATIE_DAGEN): Map<number, number> {
  const uit = new Map<number, number>();
  const metTijd = candles.filter(c => typeof c.tijd === 'number' && c.close > 0);
  const laatste = metTijd.slice(-(dagen + 1));
  for (let i = 1; i < laatste.length; i++) {
    const dag = Math.floor((laatste[i].tijd as number) / DAG_MS);
    const vorige = Math.floor((laatste[i - 1].tijd as number) / DAG_MS);
    if (dag - vorige !== 1) continue;
    uit.set(dag, laatste[i].close / laatste[i - 1].close - 1);
  }
  return uit;
}

// Pearson-correlatie op de gemeenschappelijke dagen. Null bij te weinig dagen of zonder beweging.
export function correlatie(a: Map<number, number>, b: Map<number, number>): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [dag, x] of a) {
    const y = b.get(dag);
    if (y !== undefined) { xs.push(x); ys.push(y); }
  }
  const n = xs.length;
  if (n < MIN_DAGEN) return null;
  const gx = xs.reduce((s, v) => s + v, 0) / n;
  const gy = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - gx, dy = ys[i] - gy;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function effectiefAantal(n: number, gemCorrelatie: number): number {
  if (n <= 1) return n;
  return n / (1 + (n - 1) * Math.max(0, gemCorrelatie));
}

export interface SpreidingStand {
  // Per positie de correlatie met BTC (null zonder genoeg data). BTC zelf staat er met 1.
  perPositie: { symbool: string; metBtc: number | null }[];
  aantal: number;
  effectief: number;
  gemCorrelatie: number;
}

// Over de symbolen met data. Null bij minder dan twee: dan valt er niets te spreiden.
export function berekenSpreiding(symbolen: string[], koersen: Record<string, Candle[]>): SpreidingStand | null {
  const uniek = [...new Set(symbolen)];
  const rend = new Map<string, Map<number, number>>();
  for (const s of uniek) if (koersen[s]) rend.set(s, dagRendementen(koersen[s]));
  const btc = koersen.BTC ? dagRendementen(koersen.BTC) : null;
  const metData = uniek.filter(s => rend.has(s));
  if (metData.length < 2) return null;

  const paren: number[] = [];
  for (let i = 0; i < metData.length; i++) {
    for (let j = i + 1; j < metData.length; j++) {
      const r = correlatie(rend.get(metData[i])!, rend.get(metData[j])!);
      if (r !== null) paren.push(r);
    }
  }
  if (paren.length === 0) return null;
  const gem = paren.reduce((s, v) => s + v, 0) / paren.length;
  const perPositie = metData
    .map(s => ({ symbool: s, metBtc: s === 'BTC' ? 1 : btc ? correlatie(rend.get(s)!, btc) : null }))
    .sort((a, b) => (b.metBtc ?? -2) - (a.metBtc ?? -2));
  return { perPositie, aantal: metData.length, effectief: effectiefAantal(metData.length, gem), gemCorrelatie: gem };
}

// Met welke posities beweegt een nieuwe coin sterk mee? Voor de regel in de kooporder.
export function sterkMeeMet(nieuw: string, bezit: string[], koersen: Record<string, Candle[]>): string[] {
  const a = koersen[nieuw] ? dagRendementen(koersen[nieuw]) : null;
  if (!a) return [];
  return [...new Set(bezit)].filter(s => {
    if (s === nieuw || !koersen[s]) return false;
    const r = correlatie(a, dagRendementen(koersen[s]));
    return r !== null && r >= STERK;
  });
}

export function opsomming(namen: string[]): string {
  return namen.length <= 1 ? namen.join('') : `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`;
}

if (typeof require !== 'undefined' && require.main === module) {
  // Vaste pseudo-willekeur, zodat de check elke keer hetzelfde doet.
  let zaad = 7;
  const rnd = () => ((zaad = (zaad * 16807) % 2147483647) / 2147483647) - 0.5;
  const reeks = (rendementen: number[]): Candle[] => {
    let p = 100;
    return [p, ...rendementen.map(r => (p *= 1 + r))].map((close, i) => ({ open: close, high: close, low: close, close, volume: 0, tijd: i * DAG_MS }));
  };
  const markt = Array.from({ length: 40 }, () => rnd() * 0.06);
  const ruis = () => Array.from({ length: 40 }, () => rnd() * 0.06);
  const koersen: Record<string, Candle[]> = {
    BTC: reeks(markt),
    ETH: reeks(markt.map(m => m * 1.2 + rnd() * 0.005)),   // bijna gelijk aan BTC
    SOL: reeks(markt.map(m => m * 1.5 + rnd() * 0.008)),
    DOGE: reeks(ruis()),                                     // eigen pad
  };
  const eth = correlatie(dagRendementen(koersen.ETH), dagRendementen(koersen.BTC))!;
  const doge = correlatie(dagRendementen(koersen.DOGE), dagRendementen(koersen.BTC))!;
  console.assert(eth > 0.9, `ETH hoort sterk mee te bewegen, was ${eth}`);
  console.assert(Math.abs(doge) < 0.5, `DOGE hoort los te staan, was ${doge}`);
  console.assert(samenhangVan(0.85) === 'sterk' && samenhangVan(0.5) === 'matig' && samenhangVan(0.1) === 'zwak', 'woorden');
  console.assert(effectiefAantal(5, 1) === 1 && effectiefAantal(5, 0) === 5 && Math.abs(effectiefAantal(5, 0.53) - 1.6) < 0.01, 'effectief aantal');
  console.assert(effectiefAantal(3, -0.4) === 3, 'negatieve correlatie telt als 0');

  const samen = berekenSpreiding(['ETH', 'SOL', 'BTC'], koersen)!;
  console.assert(samen.effectief < 1.2, `drie die samen bewegen zijn ongeveer één weddenschap, was ${samen.effectief}`);
  console.assert(samen.perPositie[0].symbool === 'BTC', 'BTC bovenaan met 1');
  const los = berekenSpreiding(['ETH', 'DOGE'], koersen)!;
  console.assert(los.effectief > 1.4, `twee losse zijn bijna twee, was ${los.effectief}`);
  console.assert(berekenSpreiding(['ETH'], koersen) === null, 'een positie: niets te spreiden');
  console.assert(sterkMeeMet('SOL', ['ETH', 'DOGE', 'SOL'], koersen).join() === 'ETH', 'SOL beweegt sterk mee met ETH');
  console.assert(opsomming(['ETH', 'SOL', 'LINK']) === 'ETH, SOL en LINK', 'opsomming');
  console.assert(correlatie(dagRendementen(koersen.ETH, 10), dagRendementen(koersen.BTC, 10)) === null, 'te weinig dagen');
  console.log('correlatie.ts self-check klaar');
}
