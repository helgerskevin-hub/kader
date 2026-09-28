import { Candle, Opportunity, Trade } from './types';
import { haalData, haalCoingeckoMarkten } from './marketData';
import { STANDAARD_UNIVERSUM, MIN_RISK_REWARD, scoorCandles } from './analyzer';
import { DREMPEL_KOOP } from './drempels';
import { infoVoor } from './coinInfo';
import {
  momentumIngredienten, momentumScore, momentumRedenen, radarNiveaus, RADAR_DREMPEL, RadarNiveaus,
} from './momentum';

// Cryptos die verhandelbaar zijn op eToro (NL/EU). Controleer etoro.com voor updates.
//
// Dit is bewust een andere lijst dan STANDAARD_UNIVERSUM in analyzer.ts. Die twee beantwoorden
// verschillende vragen: hier staat "wat mag je op eToro aanhouden", daar staat "wat kunnen wij op
// Binance analyseren". TON hoort hier wel en daar niet (geen Binance-USDT-paar). Knoop ze niet
// weer aan elkaar: etoro.ts gebruikt deze set om bij een import te bepalen of een positie crypto
// is, en dan zou een TON-positie stilzwijgend als "geen crypto" worden overgeslagen.
// STANDAARD_UNIVERSUM moet een deelverzameling van deze lijst zijn; scripts/check-universum.mjs
// bewaakt dat.
//
// Zes coins hier voert eToro onder een andere naam of in een andere eenheid (SHIB en PEPE per
// miljoen munten, MATIC/FTM/MKR/RNDR onder POL/S/SKY/RENDER); zie engine/etoroSymbolen.ts.
export const ETORO_TRADABLE = new Set([
  'BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ETC',
  'ADA', 'SOL', 'DOT', 'AVAX', 'ATOM', 'BNB', 'TRX', 'XLM',
  'ALGO', 'VET', 'HBAR', 'XTZ', 'NEAR', 'FTM', 'ICP', 'FLOW',
  'APT', 'SUI', 'TON', 'INJ', 'SEI',
  'MATIC', 'OP', 'ARB',
  'LINK', 'UNI', 'AAVE', 'COMP', 'MKR', 'SNX', 'YFI', 'CRV', 'SUSHI',
  '1INCH', 'ZRX', 'GRT', 'ENJ', 'MANA', 'SAND',
  'AXS', 'CHZ', 'GALA', 'IMX',
  'DOGE', 'SHIB', 'PEPE',
  'FET', 'RNDR',
  'FIL', 'THETA', 'BAT',
  'TIA',
]);

// De Kansen-scan is een momentum-radar over hetzelfde universum als de Markt: welke coins staan
// vlak onder hun 90-dagen-high? Score, drempel en niveaus komen uit engine/momentum.ts en zijn
// gemeten in meting I en J van app/scripts/backtest.ts; hier staat alleen het ophalen en het
// samenvoegen tot een lijst.

// Minder coins dan dit op de radar = de radar geldt als leeg. Bewust 1 en niet hoger: de drempel
// van 70 is in meting I-c0 als lijst gemeten, ook op de dagen met maar één of twee coins erop.
// Een coin die hem haalt is dus een gemeten signaal. Aanvullen tot een vast aantal zou coins onder
// de drempel ertussen zetten die nooit als radar gemeten zijn, en de lijst mooier laten lijken dan
// de markt is.
export const RADAR_MIN = 1;

// Zonder radar laten we de sterkste paar coins zien, als WATCH, zodat het scherm uitlegt waarom
// het leeg is in plaats van niets te tonen.
const LEGE_RADAR_TOON = 3;

// Aantal slotkoersen voor de sparkline op de kaart.
const SPARKLINE_DAGEN = 30;

// ponytail: zelfde blokgrootte als analyzer.ts, zie de comment daar.
const GELIJKTIJDIG = 6;

/**
 * KOOP of WATCH voor een coin op de radar. KOOP vraagt allebei: de uitbraak-niveaus halen de
 * gewone R/R-drempel (MIN_RISK_REWARD, niet verlaagd) en de technische score uit scoorCandles
 * haalt DREMPEL_KOOP. Dat is precies de combinatie uit meting J (radar + score >= 55 + R/R >= 2).
 * Zonder niveaus (koers niet boven de EMA20) valt er geen plan te maken en blijft het WATCH.
 */
export function radarSignaal(niveaus: RadarNiveaus | null, score: number): { signaal: 'KOOP' | 'WATCH'; voldoetAanRR: boolean } {
  const voldoetAanRR = niveaus !== null && niveaus.rr >= MIN_RISK_REWARD - 1e-9;
  return { signaal: voldoetAanRR && score >= DREMPEL_KOOP ? 'KOOP' : 'WATCH', voldoetAanRR };
}

// Hoogste momentumscore eerst. Die is afgerond, dus bij gelijkspel wint wie dichter bij zijn top
// staat, en daarna de hogere technische score.
export function vergelijkKansen(a: Opportunity, b: Opportunity): number {
  if (b.momentumScore !== a.momentumScore) return b.momentumScore - a.momentumScore;
  const afstandA = a.ingredienten.afstandHigh90d ?? -Infinity;
  const afstandB = b.ingredienten.afstandHigh90d ?? -Infinity;
  if (afstandB !== afstandA) return afstandB - afstandA;
  return b.trade.score - a.trade.score;
}

/**
 * Van alle gescoorde coins naar de lijst voor het scherm. Staan er genoeg op de radar, dan zijn
 * dat precies de coins met momentumScore >= RADAR_DREMPEL. Anders is `radarLeeg` true en komen de
 * LEGE_RADAR_TOON hoogste scores terug, allemaal als WATCH: ze lopen niet echt voorop, dus er
 * hoort geen koopsignaal bij.
 */
export function bouwRadar(alle: Opportunity[]): { kansen: Opportunity[]; radarLeeg: boolean } {
  const gesorteerd = [...alle].sort(vergelijkKansen);
  const opRadar = gesorteerd.filter(k => k.momentumScore >= RADAR_DREMPEL);
  if (opRadar.length >= RADAR_MIN) return { kansen: opRadar, radarLeeg: false };
  return {
    kansen: gesorteerd.slice(0, LEGE_RADAR_TOON).map(k => ({ ...k, signaal: 'WATCH' as const })),
    radarLeeg: true,
  };
}

/**
 * BTC-slotkoersen op dezelfde dagen als `candles`, zoals momentumIngredienten ze verwacht. Hebben
 * beide reeksen een `tijd`, dan op kalenderdag uitgelijnd (net als btcUitgelijnd in de backtest);
 * een dag zonder BTC-koers wordt NaN en levert dan geen relatieve sterkte op. Zonder tijd vallen
 * we terug op het laatste element: dan hoort de laatste candle bij de laatste BTC-candle.
 */
export function btcUitgelijnd(candles: Candle[], btc: Candle[]): number[] {
  const dag = (t: number) => Math.floor(t / 86_400_000);
  if (candles.every(c => c.tijd !== undefined) && btc.every(c => c.tijd !== undefined)) {
    const perDag = new Map<number, number>();
    for (const c of btc) perDag.set(dag(c.tijd!), c.close);
    return candles.map(c => perDag.get(dag(c.tijd!)) ?? NaN);
  }
  const closes = btc.map(c => c.close);
  const tekort = candles.length - closes.length;
  return tekort > 0 ? [...Array<number>(tekort).fill(NaN), ...closes] : closes.slice(-candles.length);
}

/**
 * Eén coin naar een kans, zonder netwerk. Null als er te weinig dagcandles zijn voor de
 * 90-dagen-high of scoorCandles niets geeft: zo'n coin kan niet op de radar.
 */
export function maakKans(
  symbool: string,
  candles: Candle[],
  bron: string,
  btcCloses: number[] | undefined,
  info?: { naam?: string; marktcap?: number },
): Opportunity | null {
  if (candles.length < 90) return null;
  // minRR: 0, want de R/R van de Markt-niveaus telt hier niet; het signaal volgt uit de
  // radar-niveaus hieronder.
  const trade: Trade | null = scoorCandles(symbool, candles, bron, { minRR: 0 });
  if (!trade) return null;
  const ingredienten = momentumIngredienten(candles, btcCloses);
  const niveaus = radarNiveaus(candles, trade.atr, trade.ema20);
  const { signaal, voldoetAanRR } = radarSignaal(niveaus, trade.score);
  return {
    symbool,
    naam: info?.naam || infoVoor(symbool).naam,
    marktcap: info?.marktcap ?? null,
    prijs: trade.prijs,
    momentumScore: momentumScore(ingredienten),
    ingredienten,
    redenen: momentumRedenen(ingredienten),
    sparkline: candles.slice(-SPARKLINE_DAGEN).map(c => c.close),
    signaal,
    niveaus,
    voldoetAanRR,
    trade,
  };
}

export interface KansenUitkomst {
  kansen: Opportunity[];
  // True als er te weinig coins op de radar staan; `kansen` zijn dan de sterkste paar, als WATCH.
  radarLeeg: boolean;
  // Van hoeveel coins er bruikbare dagcandles waren.
  gescand: number;
}

// Naam en marktcap uit CoinGecko, puur als aanvulling. Faalt het, dan gaat de scan door met de
// namen uit coinInfo.ts en zonder marktcap. Bij dubbele tickers wint de grootste (de lijst staat
// op marktcap, dus de eerste).
async function haalMarktInfo(): Promise<Map<string, { naam?: string; marktcap?: number }>> {
  const info = new Map<string, { naam?: string; marktcap?: number }>();
  try {
    for (const c of await haalCoingeckoMarkten()) {
      const sym = ((c['symbol'] as string) ?? '').toUpperCase();
      if (!sym || info.has(sym)) continue;
      const mcap = c['market_cap'];
      info.set(sym, {
        naam: typeof c['name'] === 'string' ? c['name'] : undefined,
        marktcap: typeof mcap === 'number' && mcap > 0 ? mcap : undefined,
      });
    }
  } catch {
    // Geen aanvulling, verder niets aan de hand.
  }
  return info;
}

async function haalDagcandles(symbool: string): Promise<Candle[] | null> {
  try {
    const res = await haalData(symbool);
    // Alleen Binance: de CoinGecko-fallback levert vier-uurs candles (zie marketData.ts), en dan
    // zou "90 dagen" hier 15 dagen betekenen. Liever geen coin dan een verkeerd gemeten coin.
    return res && res.bron === 'Binance' ? res.candles : null;
  } catch {
    return null;
  }
}

export async function zoekKansen(
  onProgress?: (gescand: number, totaal: number) => void,
  // Na elk blok de radar tot nu toe, al gesorteerd zoals de eindlijst. Eerlijk omdat elke kans per
  // coin definitief is (alleen de eigen candles tellen) en omdat een coin die de radar haalt ook
  // in de eindlijst staat: de tussenstand is altijd een deelverzameling van de uitkomst, in
  // dezelfde volgorde. Een kaart die landt kan dus nog schuiven, maar verdwijnt niet meer. Alleen
  // radar-coins: of de radar leeg blijft (en welke drie dan als WATCH komen) weet je pas aan het
  // eind, dus die lijst komt uitsluitend via de returnwaarde.
  onTussenstand?: (kansen: Opportunity[]) => void,
): Promise<KansenUitkomst> {
  const universum = STANDAARD_UNIVERSUM;
  const [btcCandles, marktInfo] = await Promise.all([haalDagcandles('BTC'), haalMarktInfo()]);

  const alle: Opportunity[] = [];
  let klaar = 0;
  let gescand = 0;
  for (let i = 0; i < universum.length; i += GELIJKTIJDIG) {
    const blok = universum.slice(i, i + GELIJKTIJDIG);
    const uitkomsten = await Promise.all(
      blok.map(async sym => {
        // BTC hebben we al; niet nog een keer ophalen.
        const candles = sym === 'BTC' ? btcCandles : await haalDagcandles(sym);
        onProgress?.(++klaar, universum.length);
        if (!candles) return null;
        gescand++;
        // BTC tegen zichzelf is altijd 0 en zegt niets; zonder BTC-reeks blijft rsBtc30d null.
        const btcCloses = btcCandles && sym !== 'BTC' ? btcUitgelijnd(candles, btcCandles) : undefined;
        return maakKans(sym, candles, 'Binance', btcCloses, marktInfo.get(sym));
      }),
    );
    for (const k of uitkomsten) if (k) alle.push(k);
    if (onTussenstand) {
      // Een fout in de weergave mag de scan zelf nooit laten mislukken.
      try {
        onTussenstand(alle.filter(k => k.momentumScore >= RADAR_DREMPEL).sort(vergelijkKansen));
      } catch {
        // Alleen de tussenstand valt weg.
      }
    }
  }

  if (gescand === 0) throw new Error('Geen marktdata ontvangen van Binance');
  return { ...bouwRadar(alle), gescand };
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/opportunities.ts`
if (require.main === module) {
  // radarSignaal: KOOP alleen met R/R >= 2 en score >= DREMPEL_KOOP.
  const nv = (rr: number): RadarNiveaus => ({ entry: 100, stopLoss: 95, takeProfit: 100 + 5 * rr, rr });
  console.assert(radarSignaal(nv(2.5), DREMPEL_KOOP).signaal === 'KOOP', 'R/R en score op orde hoort KOOP te zijn');
  console.assert(radarSignaal(nv(2), 60).signaal === 'KOOP', 'R/R precies 2 hoort mee te tellen');
  console.assert(radarSignaal(nv(1.9), 90).signaal === 'WATCH', 'R/R onder 2 hoort WATCH te zijn');
  console.assert(radarSignaal(nv(3), DREMPEL_KOOP - 1).signaal === 'WATCH', 'score onder de drempel hoort WATCH te zijn');
  console.assert(radarSignaal(null, 90).signaal === 'WATCH' && !radarSignaal(null, 90).voldoetAanRR,
    'zonder niveaus geen KOOP');

  // maakKans: 100 dagen oplopend staat op zijn top, dus score 100. Te weinig historie geeft null.
  const oplopend: Candle[] = Array.from({ length: 100 }, (_, i) => ({
    open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i, volume: 1000, tijd: i * 86_400_000,
  }));
  const k = maakKans('TEST', oplopend, 'Binance', undefined);
  console.assert(k !== null && k.momentumScore >= RADAR_DREMPEL, `een stijgende reeks hoort op de radar: ${k?.momentumScore}`);
  console.assert(k !== null && k.sparkline.length === SPARKLINE_DAGEN && k.sparkline[29] === 199, 'sparkline hoort de laatste 30 closes te zijn');
  console.assert(maakKans('TEST', oplopend.slice(0, 80), 'Binance', undefined) === null, 'onder 90 candles geen kans');

  // btcUitgelijnd: op dag uitgelijnd, en zonder tijd op het laatste element.
  const btc: Candle[] = oplopend.slice(10).map(c => ({ ...c, close: c.close * 2 }));
  const uit = btcUitgelijnd(oplopend, btc);
  console.assert(uit.length === 100 && isNaN(uit[5]) && uit[99] === 398, `uitlijnen op dag klopt niet: ${uit[5]}, ${uit[99]}`);
  const zonderTijd = oplopend.map(({ tijd: _t, ...c }) => c);
  const uit2 = btcUitgelijnd(zonderTijd, btc.slice(0, 50));
  console.assert(uit2.length === 100 && isNaN(uit2[49]) && uit2[99] === btc[49].close, 'zonder tijd hoort het laatste element te kloppen');

  // bouwRadar: sorteert, en een lege radar geeft de drie sterkste als WATCH.
  const met = (sym: string, score: number, afstand: number, signaal: 'KOOP' | 'WATCH' = 'KOOP'): Opportunity => ({
    ...k!, symbool: sym, momentumScore: score, signaal, ingredienten: { ...k!.ingredienten, afstandHigh90d: afstand },
  });
  const r = bouwRadar([met('A', 72, -8), met('B', 90, -3), met('C', 72, -7), met('D', 40, -18)]);
  console.assert(!r.radarLeeg && r.kansen.map(x => x.symbool).join() === 'B,C,A', `radar-volgorde klopt niet: ${r.kansen.map(x => x.symbool)}`);
  const leeg = bouwRadar([met('A', 20, -24), met('B', 60, -12), met('C', 50, -15), met('D', 10, -27)]);
  console.assert(leeg.radarLeeg && leeg.kansen.length === 3 && leeg.kansen[0].symbool === 'B', 'lege radar hoort de drie sterkste te geven');
  console.assert(leeg.kansen.every(x => x.signaal === 'WATCH'), 'op een lege radar is alles WATCH');

  console.log('opportunities.ts self-check geslaagd');
}
