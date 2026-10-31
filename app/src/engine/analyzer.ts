import { Candle, Trade, Scoreprofiel } from './types';
import { rsi as berekenRsi, ema as berekenEma, macd as berekenMacd, atr as berekenAtr } from './indicators';
import { haalData } from './marketData';
import { bepaalKlimaat, poortOpen, Marktklimaat } from './marktklimaat';
import { berekenRelatieveSterkte, RelatieveSterkte } from './relatieveSterkte';
import { HIGH_CONVICTION_SCORE, HIGH_CONVICTION_VOLUME_MIN, DREMPEL_KOOP } from './drempels';

// De coins die wij analyseren: op eToro te kopen én met een live Binance USDT-paar (eventueel via
// een alias, zie BINANCE_ALIAS in marketData.ts). Dit is dus een deelverzameling van ETORO_TRADABLE
// in opportunities.ts, niet dezelfde lijst: TON kun je op eToro aanhouden maar niet op Binance
// uitlezen, dus die analyseren we niet. `node scripts/check-universum.mjs` controleert allebei.
// Zes coins hier (SHIB, PEPE, MATIC, FTM, MKR, RNDR) voert eToro onder een andere naam of in een
// andere eenheid; zie engine/etoroSymbolen.ts voor de vertaling en de omrekening.
export const STANDAARD_UNIVERSUM = [
  'BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ETC',
  'ADA', 'SOL', 'DOT', 'AVAX', 'ATOM', 'BNB', 'TRX', 'XLM',
  'ALGO', 'VET', 'HBAR', 'XTZ', 'NEAR', 'FTM', 'ICP', 'FLOW',
  'APT', 'SUI', 'INJ', 'SEI',
  'MATIC', 'OP', 'ARB',
  'LINK', 'UNI', 'AAVE', 'COMP', 'MKR', 'SNX', 'YFI', 'CRV', 'SUSHI',
  '1INCH', 'ZRX', 'GRT', 'ENJ', 'MANA', 'SAND',
  'AXS', 'CHZ', 'GALA', 'IMX',
  'DOGE', 'SHIB', 'PEPE',
  'FET', 'RNDR',
  'FIL', 'THETA', 'BAT',
  'TIA',
];

export const REWARD_MULTIPLIER = 3.0;
export const MIN_RISK_REWARD = 2.0;
export const RSI_PERIODE = 14;
export const EMA_KORT = 20;
export const EMA_LANG = 50;
export const ATR_PERIODE = 14;
export const VOLUME_GEMIDDELDE_PERIODE = 20;
export const SWING_PERIODE = 10;

// Het omkeerprofiel mikt op een kleiner doel dan momentum: een bounce uit oversold is zelden een
// trendbeweging, dus 2x ATR pakken en weg. Samen met de krappere stop-cap hieronder ligt de R/R
// per constructie tussen 2,0 en 4,0, en blijft MIN_RISK_REWARD haalbaar zonder die drempel te
// verlagen.
export const REWARD_MULTIPLIER_OMKEER = 2.0;
// Bovengrens van de stop-clamp bij omkeer, in ATR. Bij een capitulatiecandle ligt de swing-low
// ver weg; met de momentum-cap van 3x ATR zou de stop zo ver onder de entry komen dat het doel
// van 2x ATR nooit een acceptabele R/R geeft. De houdtijd is hier ook kort: gaat de bounce niet
// snel door, dan klopt het idee niet meer.
export const STOP_CAP_OMKEER = 1.0;

// Stop-afstand op basis van de recente swing-low (support), niet een vast ATR-veelvoud.
// Zo varieert de R/R per coin en heeft de MIN_RISK_REWARD-drempel weer betekenis.
// ponytail: structuur-gebaseerde stop met ATR-ruisfloor (0.5x) en -cap (3x) tegen
// candles met een absurd dichte of verre swing-low.
export function stopAfstandStructuur(
  candles: { low: number; high: number }[],
  entry: number,
  atr: number,
  // De cap is instelbaar omdat het omkeerprofiel een krappere band wil (STOP_CAP_OMKEER).
  // Zonder argument blijft het gedrag exact zoals het was: 0,5x tot 3x ATR.
  capAtr: number = 3,
): number {
  const recent = candles.slice(-SWING_PERIODE);
  const ruwAfstand = entry - (Math.min(...recent.map(c => c.low)) - 0.1 * atr); // klein buffertje onder support
  return Math.min(Math.max(ruwAfstand, 0.5 * atr), capAtr * atr);
}

// Minimaal aantal candles voordat EMA50 en consorten iets betekenen.
export const MIN_CANDLES = EMA_LANG + 5;

// Dagen koersverloop op de Markt-kaart. Eén close extra, zodat eerste tegen laatste punt precies
// deze periode beslaat: de candles zijn dagcandles, dus 31 closes zijn 30 dagen.
export const SPARKLINE_DAGEN_MARKT = 30;

// De scoring zelf, zonder netwerk. `candles` is de historie tot en met de candle die
// beoordeeld wordt; alles wat later komt bestaat voor deze functie niet. De backtest
// schuift daardoor gewoon een venster op (candles.slice(0, i + 1)) en kan per constructie
// niet in de toekomst kijken.
export function scoorCandles(
  symbool: string,
  candles: Candle[],
  bron: Trade['bron'],
  // De backtest zet de R/R-drempel op 0 (minRR: 0) om te kunnen meten wat die drempel ons kost:
  // presteren de afgewezen signalen beter of slechter dan de toegelaten?
  // `profiel` kiest de scoringstak: 'momentum' (de standaard, ongewijzigd) of 'omkeer'. Alleen
  // de backtest zet die op 'omkeer'; analyseerMarkt gebruikt het profiel nog niet.
  opties?: { minRR?: number; profiel?: Scoreprofiel },
): Trade | null {
  if (candles.length < MIN_CANDLES) return null;
  const minRR = opties?.minRR ?? MIN_RISK_REWARD;
  const profiel = opties?.profiel ?? 'momentum';

  const close = candles.map(c => c.close);
  const prijs = close[close.length - 1];

  const rsiWaarden = berekenRsi(close, RSI_PERIODE);
  const ema20Waarden = berekenEma(close, EMA_KORT);
  const ema50Waarden = berekenEma(close, EMA_LANG);
  const { macdLine, signalLine, histogram } = berekenMacd(close);
  const atrWaarden = berekenAtr(candles, ATR_PERIODE);

  const n = close.length;
  const rsiNu = rsiWaarden[n - 1];
  const ema20Nu = ema20Waarden[n - 1];
  const ema50Nu = ema50Waarden[n - 1];
  const macdNu = macdLine[n - 1];
  const signaalNu = signalLine[n - 1];
  const histNu = histogram[n - 1];
  const atrRaw = atrWaarden[n - 1];
  const atrNu = isNaN(atrRaw) || atrRaw <= 0 ? prijs * 0.03 : atrRaw;

  // Volume spike t.o.v. 20-daags gemiddelde
  const totalVol = candles.reduce((s, c) => s + c.volume, 0);
  let volumeRatio = 1.0;
  if (totalVol > 0) {
    // Middel over de vórige N candles (excl. de huidige), anders drukt de spike-candle
    // zijn eigen gemiddelde op en wordt de ratio structureel onderschat.
    const recent = candles.slice(-VOLUME_GEMIDDELDE_PERIODE - 1, -1);
    const volGem = recent.reduce((s, c) => s + c.volume, 0) / recent.length;
    const volNu = candles[n - 1].volume;
    volumeRatio = volGem > 0 ? volNu / volGem : 1.0;
  }

  // Scoring 0-100
  let score = 0;
  const redenen: string[] = [];

  if (profiel === 'momentum') {
    if (ema20Nu > ema50Nu) {
      score += 25;
      redenen.push('opwaartse trend (EMA20>EMA50)');
    }
    if (prijs > ema20Nu) {
      score += 15;
      redenen.push('prijs boven EMA20');
    }
    if (rsiNu >= 45 && rsiNu <= 68) {
      score += 20;
      redenen.push(`RSI gezond (${rsiNu.toFixed(0)})`);
    } else if (rsiNu < 35) {
      score += 10;
      redenen.push(`RSI oversold (${rsiNu.toFixed(0)}) - mogelijke bounce`);
    }
    if (macdNu > signaalNu) {
      score += 20;
      redenen.push('MACD bullish');
      // histNu is binnen deze tak per definitie > 0; beloon alleen een stíjgend histogram
      if (histNu > histogram[n - 2]) score += 5;
    }
    if (volumeRatio >= 1.5) {
      score += 15;
      redenen.push(`volume spike (${volumeRatio.toFixed(1)}x)`);
    } else if (volumeRatio >= 1.2) {
      score += 8;
      redenen.push(`verhoogd volume (${volumeRatio.toFixed(1)}x)`);
    }
  } else {
    // Omkeerprofiel (mean reversion). Bewust geen enkele trend-eis: geen `prijs > EMA20` en geen
    // `EMA20 > EMA50`. Dat zijn precies de twee eisen waardoor het momentumprofiel in een dalende
    // markt structureel niets vindt, terwijl een bounce uit oversold per definitie ónder die
    // gemiddeldes begint.
    //
    // Puntenverdeling (max 100), op volgorde van hoe hard het ingrediënt zegt dat de daling klaar
    // is. Diep oversold (max 35) is de voorwaarde: zonder uitverkoop is er niets om uit terug te
    // veren, maar het is op zichzelf geen reden om te kopen (een coin kan wekenlang oversold
    // blijven), dus 35 alleen haalt DREMPEL_KOOP van 55 niet. De hogere bodem (20) en het
    // capitulatievolume (20) zijn de twee bevestigingen dat de verkopers klaar zijn; die wegen
    // even zwaar en samen met oversold komt er wel een koopsignaal uit. Het oplopende MACD-
    // histogram (15) is een zwakkere bevestiging: het meet dat de daling kracht verliest, niet
    // dat er al gekocht wordt. De uitgerektheid onder EMA20 (max 10) zegt alleen iets over hoeveel
    // ruimte er terug omhoog is, dus dat blijft een bonus. Er zijn dus altijd minstens twee
    // ingrediënten nodig voor een KOOP.
    if (rsiNu < 30) {
      score += 25;
      redenen.push(`RSI diep oversold (${rsiNu.toFixed(0)})`);
      if (rsiNu < 25) {
        score += 10;
        redenen.push('uitverkoop op het extreme af (RSI onder 25)');
      }
    }
    // Capitulatie: dezelfde volumeRatio als hierboven, maar met een hogere lat. Een spike van
    // 1,5x is bij een daling nog gewoon verkoopdruk; pas rond 2x ziet het eruit als iedereen die
    // eruit wilde die er ook echt uit is.
    if (volumeRatio >= 2.0) {
      score += 20;
      redenen.push(`capitulatievolume (${volumeRatio.toFixed(1)}x)`);
    } else if (volumeRatio >= 1.5) {
      score += 10;
      redenen.push(`verhoogd volume (${volumeRatio.toFixed(1)}x)`);
    }
    // Eerste hogere bodem: de low van deze candle ligt boven de laagste low van de SWING_PERIODE
    // candles ervóór. Dat is het eerste harde bewijs dat de reeks lagere bodems doorbroken is.
    const laagsteLowDavoor = Math.min(
      ...candles.slice(-SWING_PERIODE - 1, -1).map(c => c.low),
    );
    if (candles[n - 1].low > laagsteLowDavoor) {
      score += 20;
      redenen.push('eerste hogere bodem na de daling');
    }
    // Een negatief histogram dat oploopt: nog steeds bearish momentum, maar minder bearish dan de
    // candle ervoor. Boven nul telt niet mee, dan is de omkeer al gebeurd en is dit het verkeerde
    // profiel.
    if (histNu < 0 && histNu > histogram[n - 2]) {
      score += 15;
      redenen.push('MACD-histogram loopt op, de daling verliest kracht');
    }
    // Hoe ver de koers onder EMA20 is uitgerekt, gemeten in ATR: de ruimte die een terugveer naar
    // het gemiddelde te pakken heeft.
    const uitgerekt = atrNu > 0 ? (ema20Nu - prijs) / atrNu : 0;
    if (uitgerekt >= 2.0) {
      score += 10;
      redenen.push(`koers ver onder EMA20 (${uitgerekt.toFixed(1)}x ATR)`);
    } else if (uitgerekt >= 1.0) {
      score += 5;
      redenen.push(`koers uitgerekt onder EMA20 (${uitgerekt.toFixed(1)}x ATR)`);
    }
  }
  score = Math.min(score, 100);

  // Trade-niveaus: stop op basis van marktstructuur (swing-low), doel ATR-gebaseerd.
  // Bij omkeer een kleiner doel (2x ATR) en een krappere stop-cap (1x ATR), zie de constanten.
  const entry = prijs;
  const capAtr = profiel === 'omkeer' ? STOP_CAP_OMKEER : 3;
  const risk = stopAfstandStructuur(candles, entry, atrNu, capAtr);
  const stopLoss = entry - risk;
  const doelAtr = profiel === 'omkeer' ? REWARD_MULTIPLIER_OMKEER : REWARD_MULTIPLIER;
  const takeProfit = entry + doelAtr * atrNu;
  const reward = takeProfit - entry;
  const rr = risk > 0 ? reward / risk : 0;

  const entryLaag = entry - 0.2 * atrNu;
  const entryHoog = entry + 0.2 * atrNu;

  // Een te lage R/R laat de coin niet meer verdwijnen, hij mag alleen geen koopsignaal geven.
  // De analyse blijft dus leesbaar (score, onderbouwing, niveaus) terwijl de discipline staat:
  // onder 1:2 zegt de app nooit KOOP.
  const voldoetAanRR = rr >= minRR - 1e-9;

  const vuurt = score >= DREMPEL_KOOP;
  const signaalTekst: 'KOOP' | 'WATCH' = vuurt && voldoetAanRR ? 'KOOP' : 'WATCH';
  // High conviction eist opwaartse trend én bullish MACD, en dat is bij een omkeer per
  // constructie afwezig. Daarom bij dat profiel altijd false; of er een eigen conviction-variant
  // nodig is, moet de backtest-meting uitwijzen.
  const highConviction =
    profiel === 'momentum' &&
    voldoetAanRR &&
    score >= HIGH_CONVICTION_SCORE &&
    ema20Nu > ema50Nu &&
    macdNu > signaalNu &&
    volumeRatio >= HIGH_CONVICTION_VOLUME_MIN;

  return {
    symbool, bron, prijs, entry, entryLaag, entryHoog,
    stopLoss, takeProfit, rr, atr: atrNu,
    rsi: rsiNu, ema20: ema20Nu, ema50: ema50Nu,
    macdBullish: macdNu > signaalNu,
    volumeRatio, score, redenen,
    signaal: signaalTekst, highConviction, voldoetAanRR, profiel,
    // Alleen bij Binance: dat zijn dagcandles, dus 31 closes is precies 30 dagen. De CoinGecko-
    // fallback levert 4-uurs candles, en dan beslaan die 31 closes ~5 dagen: een grafiek en een
    // "30D"-pil die dan iets anders beweren dan er staat. Zonder reeks vallen ze allebei weg.
    sparkline: bron === 'Binance' ? close.slice(-(SPARKLINE_DAGEN_MARKT + 1)) : undefined,
  };
}

export async function analyseerCoin(symbool: string): Promise<Trade | null> {
  const result = await haalData(symbool);
  if (!result) return null;
  return scoorCandles(symbool, result.candles, result.bron);
}

// ponytail: blokken van 6 i.p.v. een worker-pool. 57 coins x weight 2 = 114 van
// Binance' 6000/min, ruim binnen budget. Verhoog als de scan traag blijft aanvoelen.
const GELIJKTIJDIG = 6;

export interface MarktUitkomst {
  trades: Trade[];
  klimaat: Marktklimaat | null;
  // Van hoeveel coins we daadwerkelijk data binnenkregen. `trades` is daar de top-N van, dus
  // zonder dit getal lijkt "20 coins" alsof de rest van het universum niet bekeken is.
  bekeken: number;
  // Alle gescoorde coins, dezelfde sortering als `trades` maar zonder de top-N-knip. De
  // Markt-lijst blijft `trades` gebruiken; dit is er voor wie een specifieke coin moet opzoeken,
  // zoals het risico-oordeel over je open posities. Die kunnen namelijk best buiten de top 20
  // vallen, en dan zou de app over juist die posities zwijgen.
  alle: Trade[];
  // Rangschikking op prestatie t.o.v. BTC, sterkste eerst. Leeg als BTC ontbreekt.
  relatieveSterkte: RelatieveSterkte[];
}

// Sorteer: HIGH CONVICTION eerst, dan wie de R/R-drempel haalt (die is verhandelbaar, de rest
// is alleen ter informatie), dan op score, dan op R/R. Eén functie voor de eindlijst en de
// voorlopige lijst tijdens het laden, zodat die twee nooit verschillend kunnen rangschikken.
function vergelijkLongs(a: Trade, b: Trade): number {
  if (a.highConviction !== b.highConviction) return a.highConviction ? -1 : 1;
  if (a.voldoetAanRR !== b.voldoetAanRR) return a.voldoetAanRR ? -1 : 1;
  if (b.score !== a.score) return b.score - a.score;
  return b.rr - a.rr;
}

// De voorlopige top-N na een blok, alleen voor de weergave terwijl de scan nog loopt. De scores
// en niveaus zijn per coin al definitief (scoorCandles kijkt alleen naar de candles van die ene
// coin), maar de klimaatpoort hangt af van de hele markt. Die rekenen we op wat er tot nu toe
// binnen is, met één verschil met de eindberekening: zolang er nog geen klimaat te bepalen valt
// (BTC nog niet binnen, of te weinig coins voor de marktbreedte) telt de poort hier als dicht en
// niet als open. Een KOOP die aan het eind alsnog verschijnt is een afronding; een KOOP die je
// al zag en die aan het eind verdwijnt is een belofte die de app niet waarmaakt.
function voorlopigeTop(
  gescoord: Trade[],
  opgehaald: { symbool: string; candles: Candle[] }[],
  topN: number,
): Trade[] {
  const btc = opgehaald.find(o => o.symbool === 'BTC');
  const klimaat = btc ? bepaalKlimaat(btc.candles, opgehaald.map(o => o.candles)) : null;
  const lijst = klimaat && poortOpen(klimaat)
    ? [...gescoord]
    : gescoord.map(t => (t.signaal === 'KOOP' ? { ...t, signaal: 'WATCH' as const, highConviction: false } : t));
  lijst.sort(vergelijkLongs);
  return lijst.slice(0, topN);
}

export async function analyseerMarkt(options?: {
  universum?: string[];
  topN?: number;
  onProgress?: (current: number, total: number, symbool: string) => void;
  // Na elk blok van GELIJKTIJDIG coins: de voorlopige top-N van wat er tot nu toe binnen is, en
  // van hoeveel coins er data is. Alleen om kaarten te laten landen terwijl de scan loopt; de
  // returnwaarde blijft de enige uitkomst en wordt precies zo berekend als zonder deze callback.
  onVoorlopig?: (voorlopig: Trade[], bekeken: number) => void;
}): Promise<MarktUitkomst> {
  const universum = options?.universum ?? STANDAARD_UNIVERSUM;
  const topN = options?.topN ?? 20;
  const opgehaald: { symbool: string; candles: Candle[]; bron: string }[] = [];
  let klaar = 0;
  // Alleen gevuld met onVoorlopig. Staat los van `resultaten` hieronder, zodat de eindberekening
  // niets van de tussenstanden erft.
  const voorlopigGescoord: Trade[] = [];

  // Data ophalen en scoren in twee losse stappen, zodat we de candles van élke coin (ook wie
  // straks geen KOOP-signaal haalt) kunnen hergebruiken voor de marktbreedte hieronder, zonder
  // een tweede ronde requests.
  for (let i = 0; i < universum.length; i += GELIJKTIJDIG) {
    const blok = universum.slice(i, i + GELIJKTIJDIG);
    const uitkomsten = await Promise.all(
      blok.map(async sym => {
        try {
          const result = await haalData(sym);
          options?.onProgress?.(++klaar, universum.length, sym);
          return result ? { symbool: sym, candles: result.candles, bron: result.bron } : null;
        } catch {
          options?.onProgress?.(++klaar, universum.length, sym);
          return null;
        }
      }),
    );
    for (const res of uitkomsten) if (res) opgehaald.push(res);

    if (options?.onVoorlopig) {
      // Een fout in de weergave mag de scan zelf nooit laten mislukken.
      try {
        for (const res of uitkomsten) {
          if (!res) continue;
          const trade = scoorCandles(res.symbool, res.candles, res.bron);
          if (trade) voorlopigGescoord.push(trade);
        }
        options.onVoorlopig(voorlopigeTop(voorlopigGescoord, opgehaald, topN), opgehaald.length);
      } catch {
        // Alleen de tussenstand valt weg; de scan loopt door.
      }
    }
  }

  const resultaten: Trade[] = [];
  for (const { symbool, candles, bron } of opgehaald) {
    const trade = scoorCandles(symbool, candles, bron);
    if (trade) resultaten.push(trade);
  }

  const btc = opgehaald.find(o => o.symbool === 'BTC');
  const klimaat = btc ? bepaalKlimaat(btc.candles, opgehaald.map(o => o.candles)) : null;

  // Hergebruikt dezelfde candles als de scan hierboven, dus dit kost geen extra requests.
  const relatieveSterkte = berekenRelatieveSterkte(opgehaald);

  // De poort: bij een ongunstig of gemengd klimaat wordt geen enkel signaal nog als KOOP getoond.
  // De score en de onderbouwing blijven gewoon zichtbaar, alleen het koopsignaal zelf zwijgt.
  const gefilterd = poortOpen(klimaat)
    ? resultaten
    : resultaten.map(t => (t.signaal === 'KOOP' ? { ...t, signaal: 'WATCH' as const, highConviction: false } : t));

  // Sorteer: HIGH CONVICTION eerst, dan wie de R/R-drempel haalt, dan op score, dan op R/R. Zie
  // vergelijkLongs.
  gefilterd.sort(vergelijkLongs);

  return {
    trades: gefilterd.slice(0, topN),
    alle: gefilterd,
    klimaat,
    relatieveSterkte,
    bekeken: opgehaald.length,
  };
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/analyzer.ts`
if (require.main === module) {
  // Vlakke candles met een duidelijke swing-low en swing-high in het laatste venster, zodat de
  // structuurstop iets te pakken heeft dat niet op de ATR-clamp landt.
  const bouw = (n: number): Candle[] =>
    Array.from({ length: n }, (_, i) => ({ open: 100, high: 101, low: 99, close: 100, volume: 1000 + i }));

  const c = bouw(80);
  c[75] = { open: 100, high: 104, low: 96, close: 100, volume: 1000 }; // swing binnen SWING_PERIODE

  const atr = 2;
  const risicoLong = stopAfstandStructuur(c, 100, atr);
  // Meet naar de low van 96, min een buffertje.
  console.assert(Math.abs(risicoLong - (100 - (96 - 0.1 * atr))) < 1e-9, `long-afstand klopt niet: ${risicoLong}`);

  const lang = scoorCandles('TEST', c, 'Binance');
  console.assert(lang !== null, 'de testcandles horen een uitkomst te geven');
  console.assert(lang !== null && lang.sparkline?.length === SPARKLINE_DAGEN_MARKT + 1
    && lang.sparkline[SPARKLINE_DAGEN_MARKT] === c[c.length - 1].close,
    'sparkline hoort de laatste 31 closes te zijn, de nieuwste achteraan');
  console.assert(lang !== null && lang.stopLoss < lang.entry && lang.takeProfit > lang.entry,
    'de long-niveaus mogen niet veranderd zijn');
  // 4-uurs candles van de fallback mogen nooit als 30 dagen getoond worden.
  const fallback = scoorCandles('TEST', c, 'CoinGecko (fallback)');
  console.assert(fallback !== null && fallback.sparkline === undefined,
    'bij de CoinGecko-fallback hoort er geen sparkline te zijn');

  console.assert(poortOpen(null) === true, 'zonder klimaat hoort de koop-poort juist open te blijven');

  console.log('analyzer.ts self-check geslaagd');
}
