import { Candle, Opportunity, Trade } from './types';
import { haalData, haalCoingeckoMarkten } from './marketData';
import { STANDAARD_UNIVERSUM, scoorCandles } from './analyzer';
import { infoVoor } from './coinInfo';
import { StopLossLimiet, EtoroNiveaus, etoroNiveaus } from './etoroLimieten';
import { bepaalKlimaat, Marktklimaat } from './marktklimaat';
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
// vlak onder hun 90-dagen-high? Het is een volglijst, geen koopsignaal: meting M (zie momentum.ts
// en docs/metingen.md) liet zien dat de keuze van de coin na eToro's kosten niet aantoonbaar beter
// is dan willekeurig. Score, drempel en plan komen uit engine/momentum.ts; hier staat alleen het
// ophalen en het samenvoegen tot een lijst.

// Minder coins dan dit op de radar = de radar geldt als leeg. Bewust 1 en niet hoger: de drempel
// van 70 is als lijst gemeten, ook op de dagen met maar één of twee coins erop. Aanvullen tot een
// vast aantal zou coins onder de drempel ertussen zetten die nooit als radar gemeten zijn, en de
// lijst mooier laten lijken dan de markt is.
export const RADAR_MIN = 1;

// Zonder radar laten we de sterkste paar coins zien, zodat het scherm uitlegt waarom het leeg is
// in plaats van niets te tonen.
const LEGE_RADAR_TOON = 3;

// Aantal punten in de sparkline op de kaart.
const SPARKLINE_DAGEN = 30;

// ponytail: zelfde blokgrootte als analyzer.ts, zie de comment daar.
const GELIJKTIJDIG = 6;

const DAG_MS = 86_400_000;

/**
 * Het plan zoals het bij eToro te zetten is. eToro accepteert Kaders stop niet altijd (bij BTC
 * minimaal 10% onder de entry); schuift de stop op, dan zakt de R/R mee. Eén functie voor kaart,
 * carrousel en detailscherm, zodat die nooit uit elkaar lopen. Zonder limiet blijft het plan van
 * Kader staan; zonder plan null.
 */
export function etoroPlan(
  kans: Pick<Opportunity, 'niveaus'>,
  limiet: StopLossLimiet | null,
): EtoroNiveaus | null {
  const plan = kans.niveaus;
  return plan ? etoroNiveaus(plan.entry, plan.stopLoss, plan.takeProfit, limiet) : null;
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
 * LEGE_RADAR_TOON hoogste scores terug, zodat het scherm kan laten zien hoe ver de rest eraf zit.
 */
export function bouwRadar(alle: Opportunity[]): { kansen: Opportunity[]; radarLeeg: boolean } {
  const gesorteerd = [...alle].sort(vergelijkKansen);
  const opRadar = gesorteerd.filter(k => k.momentumScore >= RADAR_DREMPEL);
  if (opRadar.length >= RADAR_MIN) return { kansen: opRadar, radarLeeg: false };
  return { kansen: gesorteerd.slice(0, LEGE_RADAR_TOON), radarLeeg: true };
}

/**
 * Splitst dagcandles in de afgesloten dagen en de koers van nu. Binance levert de lopende dag als
 * laatste candle mee; die is nog niet af, dus het volume is te laag en high en slot schuiven nog.
 * De backtest gooit hem weg (zie scripts/haal-historie.mjs) en mat dus altijd op afgesloten dagen.
 * De app doet nu hetzelfde: het oordeel valt op de afgesloten dagen, het plan rekent met de koers
 * van nu. Een candle zonder tijd valt niet te plaatsen en telt als afgesloten.
 */
export function splitsLopendeDag(candles: Candle[], nu: number): { gesloten: Candle[]; prijsNu: number | null } {
  const laatste = candles[candles.length - 1];
  if (!laatste) return { gesloten: [], prijsNu: null };
  const loopt = laatste.tijd !== undefined && nu - laatste.tijd < DAG_MS;
  return { gesloten: loopt ? candles.slice(0, -1) : candles, prijsNu: laatste.close };
}

/**
 * BTC-slotkoersen op dezelfde dagen als `candles`, zoals momentumIngredienten ze verwacht. Hebben
 * beide reeksen een `tijd`, dan op kalenderdag uitgelijnd (net als btcUitgelijnd in de backtest);
 * een dag zonder BTC-koers wordt NaN en levert dan geen relatieve sterkte op. Zonder tijd vallen
 * we terug op het laatste element: dan hoort de laatste candle bij de laatste BTC-candle.
 */
export function btcUitgelijnd(candles: Candle[], btc: Candle[]): number[] {
  const dag = (t: number) => Math.floor(t / DAG_MS);
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
 * Eén coin naar een kans, zonder netwerk. `candles` zijn afgesloten dagen (zie splitsLopendeDag);
 * score, ingrediënten en ATR komen daaruit. `prijsNu` is de koers waarmee het plan rekent; zonder
 * (de backtest, of een reeks zonder lopende dag) is dat het laatste slot. Null als er te weinig
 * dagcandles zijn voor de 90-dagen-high of scoorCandles niets geeft: zo'n coin kan niet op de radar.
 */
export function maakKans(
  symbool: string,
  candles: Candle[],
  bron: string,
  btcCloses: number[] | undefined,
  info?: { naam?: string; marktcap?: number },
  prijsNu?: number | null,
): Opportunity | null {
  if (candles.length < 90) return null;
  // minRR: 0, want de niveaus van de Markt tellen hier niet; het plan komt uit radarNiveaus.
  const trade: Trade | null = scoorCandles(symbool, candles, bron, { minRR: 0 });
  if (!trade) return null;
  const prijs = prijsNu && prijsNu > 0 ? prijsNu : trade.prijs;
  const ingredienten = momentumIngredienten(candles, btcCloses);
  // De grafiek eindigt op de koers van nu, zodat de stip overeenkomt met de prijs op de kaart.
  const slotkoersen = candles.map(c => c.close);
  const sparkline = prijs !== trade.prijs
    ? [...slotkoersen.slice(-(SPARKLINE_DAGEN - 1)), prijs]
    : slotkoersen.slice(-SPARKLINE_DAGEN);
  return {
    symbool,
    naam: info?.naam || infoVoor(symbool).naam,
    marktcap: info?.marktcap ?? null,
    prijs,
    momentumScore: momentumScore(ingredienten),
    ingredienten,
    redenen: momentumRedenen(ingredienten),
    sparkline,
    niveaus: radarNiveaus(prijs, trade.atr),
    trade,
  };
}

export interface KansenUitkomst {
  kansen: Opportunity[];
  // True als er te weinig coins op de radar staan; `kansen` zijn dan de sterkste paar.
  radarLeeg: boolean;
  // Van hoeveel coins er bruikbare dagcandles waren.
  gescand: number;
  // Het klimaat uit bepaalKlimaat, de functie van Markt, maar op de afgesloten dagen: Markt rekent
  // met de lopende dag erbij, dus rond een omslag kunnen de twee een dag verschillen. Null bij te
  // weinig historie of zonder BTC. De meting van het plan gold bij een gunstig klimaat; het scherm zegt
  // het erbij als dat nu anders is.
  klimaat: Marktklimaat | null;
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
  // radar-coins: of de radar leeg blijft (en welke drie dan komen) weet je pas aan het eind, dus
  // die lijst komt uitsluitend via de returnwaarde.
  onTussenstand?: (kansen: Opportunity[]) => void,
): Promise<KansenUitkomst> {
  const universum = STANDAARD_UNIVERSUM;
  const nu = Date.now();
  const [btcRuw, marktInfo] = await Promise.all([haalDagcandles('BTC'), haalMarktInfo()]);
  const btc = btcRuw ? splitsLopendeDag(btcRuw, nu) : null;

  const alle: Opportunity[] = [];
  // De afgesloten dagen van elke coin, voor de marktbreedte in het klimaat. Zelfde candles als de
  // scan, dus geen extra requests.
  const geslotenReeksen: Candle[][] = [];
  let klaar = 0;
  let gescand = 0;
  for (let i = 0; i < universum.length; i += GELIJKTIJDIG) {
    const blok = universum.slice(i, i + GELIJKTIJDIG);
    const uitkomsten = await Promise.all(
      blok.map(async sym => {
        // BTC hebben we al; niet nog een keer ophalen.
        const ruw = sym === 'BTC' ? btcRuw : await haalDagcandles(sym);
        onProgress?.(++klaar, universum.length);
        if (!ruw) return null;
        gescand++;
        const { gesloten, prijsNu } = splitsLopendeDag(ruw, nu);
        geslotenReeksen.push(gesloten);
        // BTC tegen zichzelf is altijd 0 en zegt niets; zonder BTC-reeks blijft rsBtc30d null.
        const btcCloses = btc && sym !== 'BTC' ? btcUitgelijnd(gesloten, btc.gesloten) : undefined;
        return maakKans(sym, gesloten, 'Binance', btcCloses, marktInfo.get(sym), prijsNu);
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
  const klimaat = btc ? bepaalKlimaat(btc.gesloten, geslotenReeksen) : null;
  return { ...bouwRadar(alle), gescand, klimaat };
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/opportunities.ts`
if (require.main === module) {
  // maakKans: 100 dagen oplopend staat op zijn top, dus score 100. Te weinig historie geeft null.
  const oplopend: Candle[] = Array.from({ length: 100 }, (_, i) => ({
    open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i, volume: 1000, tijd: i * DAG_MS,
  }));
  const k = maakKans('TEST', oplopend, 'Binance', undefined);
  console.assert(k !== null && k.momentumScore >= RADAR_DREMPEL, `een stijgende reeks hoort op de radar: ${k?.momentumScore}`);
  console.assert(k !== null && k.sparkline.length === SPARKLINE_DAGEN && k.sparkline[29] === 199, 'sparkline hoort de laatste 30 closes te zijn');
  console.assert(maakKans('TEST', oplopend.slice(0, 80), 'Binance', undefined) === null, 'onder 90 candles geen kans');
  // Het plan: stop 3x ATR onder de koers, doel op 3R.
  console.assert(k !== null && k.niveaus !== null && k.niveaus.entry === 199 && k.niveaus.rr === 3
    && Math.abs(k.niveaus.entry - k.niveaus.stopLoss - 3 * k.trade.atr) < 1e-9, `plan klopt niet: ${JSON.stringify(k?.niveaus)}`);

  // Met een koers van nu: het oordeel blijft dat van de afgesloten dagen, het plan en de prijs volgen
  // de koers van nu.
  const live = maakKans('TEST', oplopend, 'Binance', undefined, undefined, 210);
  console.assert(live !== null && live.prijs === 210 && live.niveaus?.entry === 210, 'prijs en plan horen de koers van nu te volgen');
  console.assert(live !== null && live.momentumScore === k!.momentumScore && live.trade.score === k!.trade.score,
    'de score hoort niet te bewegen met de koers van nu');
  console.assert(live !== null && live.sparkline.length === SPARKLINE_DAGEN && live.sparkline[29] === 210 && live.sparkline[28] === 199,
    'de sparkline hoort op de koers van nu te eindigen');

  // splitsLopendeDag: een candle die minder dan een dag oud is loopt nog.
  const nu = 100 * DAG_MS + 3_600_000;
  const metLopend = [...oplopend, { open: 200, high: 205, low: 199, close: 204, volume: 10, tijd: 100 * DAG_MS }];
  const gesplitst = splitsLopendeDag(metLopend, nu);
  console.assert(gesplitst.gesloten.length === 100 && gesplitst.prijsNu === 204, 'de lopende dag hoort eraf te gaan');
  const zonderLopend = splitsLopendeDag(oplopend, nu);
  console.assert(zonderLopend.gesloten.length === 100 && zonderLopend.prijsNu === 199, 'zonder lopende dag blijft alles staan');
  console.assert(splitsLopendeDag([], nu).prijsNu === null, 'een lege reeks geeft geen koers');

  // btcUitgelijnd: op dag uitgelijnd, en zonder tijd op het laatste element.
  const btc: Candle[] = oplopend.slice(10).map(c => ({ ...c, close: c.close * 2 }));
  const uit = btcUitgelijnd(oplopend, btc);
  console.assert(uit.length === 100 && isNaN(uit[5]) && uit[99] === 398, `uitlijnen op dag klopt niet: ${uit[5]}, ${uit[99]}`);
  const zonderTijd = oplopend.map(({ tijd: _t, ...c }) => c);
  const uit2 = btcUitgelijnd(zonderTijd, btc.slice(0, 50));
  console.assert(uit2.length === 100 && isNaN(uit2[49]) && uit2[99] === btc[49].close, 'zonder tijd hoort het laatste element te kloppen');

  // bouwRadar: sorteert, en een lege radar geeft de drie sterkste.
  const met = (sym: string, score: number, afstand: number): Opportunity => ({
    ...k!, symbool: sym, momentumScore: score, ingredienten: { ...k!.ingredienten, afstandHigh90d: afstand },
  });
  const r = bouwRadar([met('A', 72, -8), met('B', 90, -3), met('C', 72, -7), met('D', 40, -18)]);
  console.assert(!r.radarLeeg && r.kansen.map(x => x.symbool).join() === 'B,C,A', `radar-volgorde klopt niet: ${r.kansen.map(x => x.symbool)}`);
  const leeg = bouwRadar([met('A', 20, -24), met('B', 60, -12), met('C', 50, -15), met('D', 10, -27)]);
  console.assert(leeg.radarLeeg && leeg.kansen.length === 3 && leeg.kansen[0].symbool === 'B', 'lege radar hoort de drie sterkste te geven');

  // etoroPlan: zonder limiet het plan van Kader; eist eToro een ruimere stop, dan schuift hij op.
  const plan: RadarNiveaus = { entry: 100, stopLoss: 97, takeProfit: 109, rr: 3 };
  const zonder = etoroPlan({ niveaus: plan }, null);
  console.assert(zonder !== null && zonder.aangepast === false && zonder.stop === 97, `zonder limiet hoort het plan te blijven: ${JSON.stringify(zonder)}`);
  const limiet: StopLossLimiet = { symbool: 'TEST', bewerkbaar: true, minPct: 10, maxPct: 100 };
  const krap = etoroPlan({ niveaus: plan }, limiet);
  console.assert(krap !== null && krap.aangepast === true && krap.rr < 1, `een te krappe stop hoort aangepast te worden: ${JSON.stringify(krap)}`);
  console.assert(etoroPlan({ niveaus: null }, null) === null, 'zonder plan geen niveaus');

  console.log('opportunities.ts self-check geslaagd');
}
