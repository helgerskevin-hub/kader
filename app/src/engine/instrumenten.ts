// Het register van wat Kader kan analyseren, en van welke soort dat is.
//
// Tot fase 3 was alles crypto en was een symbool genoeg: 'BTC' betekende Binance-paar BTCUSDT en
// verder niets. Zodra er aandelen en index-fondsen bij komen klopt die aanname niet meer. Een
// aandeel heeft een andere databron, een andere handelsdag (een beurs is 's nachts en in het
// weekend dicht, een cryptomarkt niet) en straks een ander signaalprofiel.
//
// Waarom een expliciet register en geen afleiding uit het symbool: de beurssuffix is NIET te raden.
// De Vanguard S&P500-tracker noteert als VUSA op Amsterdam (`VUSA.AS`), maar de accumulerende
// variant VUAA staat alleen in Londen (`VUAA.L`) en `VUAA.AS` bestaat niet. Blind `.AS` plakken
// levert dus een lege respons op bij een fonds dat wel degelijk bestaat. Elke regel hieronder is
// daarom met de hand vastgelegd en tegen de bron gecontroleerd.

export type Activaklasse = 'crypto' | 'aandeel' | 'etf';

export interface Instrument {
  // Wat Kader intern gebruikt en op het scherm toont. Voor crypto het gewone tickersymbool, voor
  // de rest de beursticker zonder suffix, zodat 'VUSA' op de kaart staat en niet 'VUSA.AS'.
  symbool: string;
  naam: string;
  klasse: Activaklasse;
  // De ticker zoals Yahoo hem kent, met beurssuffix. Alleen voor aandelen en fondsen; crypto loopt
  // via Binance en CoinGecko en heeft dit veld niet.
  yahoo?: string;
  // De valuta waarin de bron noteert. VUSA op Amsterdam staat in euro's terwijl de rest van de app
  // in dollars rekent. Zonder dit veld zou een euro-koers als dollarbedrag in je portfolio belanden
  // en is elk totaal fout. Ontbreekt het veld, dan is het USD.
  valuta?: 'USD' | 'EUR' | 'GBP';
}

export function isCrypto(klasse: Activaklasse): boolean {
  return klasse === 'crypto';
}

// Meervoud voor in een kop of een legenda. Nederlands, kleine letter, want het staat midden in een
// zin ("40% in aandelen").
export function klasseNaam(klasse: Activaklasse, meervoud = true): string {
  if (klasse === 'crypto') return 'crypto';
  if (klasse === 'aandeel') return meervoud ? 'aandelen' : 'aandeel';
  return meervoud ? 'index-fondsen' : 'index-fonds';
}

// De niet-crypto instrumenten die Kader kent. Bewust kort gehouden: elk instrument hier is een
// belofte dat de koers klopt, en die belofte is alleen waar te maken voor tickers die tegen de
// bron gecontroleerd zijn. Uitbreiden gaat per regel, niet per lijst.
//
// De vier fondsen bovenaan zijn waar fase 3 om vroeg: de Vanguard S&P500-trackers die via DeGiro
// te koop zijn, in beide varianten (VUSA keert dividend uit, VUAA herbelegt het), plus de twee
// wereldwijde broertjes die in dezelfde hoek zitten.
export const EFFECTEN: Instrument[] = [
  { symbool: 'VUSA', naam: 'Vanguard S&P 500 UCITS', klasse: 'etf', yahoo: 'VUSA.AS', valuta: 'EUR' },
  { symbool: 'VUAA', naam: 'Vanguard S&P 500 UCITS Acc', klasse: 'etf', yahoo: 'VUAA.L', valuta: 'USD' },
  { symbool: 'VWRL', naam: 'Vanguard FTSE All-World UCITS', klasse: 'etf', yahoo: 'VWRL.AS', valuta: 'EUR' },
  { symbool: 'IWDA', naam: 'iShares Core MSCI World UCITS', klasse: 'etf', yahoo: 'IWDA.AS', valuta: 'EUR' },
  { symbool: 'VOO', naam: 'Vanguard S&P 500 ETF', klasse: 'etf', yahoo: 'VOO', valuta: 'USD' },
  { symbool: 'SPY', naam: 'SPDR S&P 500 ETF', klasse: 'etf', yahoo: 'SPY', valuta: 'USD' },
  { symbool: 'QQQ', naam: 'Invesco QQQ Trust', klasse: 'etf', yahoo: 'QQQ', valuta: 'USD' },

  { symbool: 'AAPL', naam: 'Apple', klasse: 'aandeel', yahoo: 'AAPL', valuta: 'USD' },
  { symbool: 'MSFT', naam: 'Microsoft', klasse: 'aandeel', yahoo: 'MSFT', valuta: 'USD' },
  { symbool: 'NVDA', naam: 'NVIDIA', klasse: 'aandeel', yahoo: 'NVDA', valuta: 'USD' },
  { symbool: 'GOOGL', naam: 'Alphabet', klasse: 'aandeel', yahoo: 'GOOGL', valuta: 'USD' },
  { symbool: 'AMZN', naam: 'Amazon', klasse: 'aandeel', yahoo: 'AMZN', valuta: 'USD' },
  { symbool: 'META', naam: 'Meta Platforms', klasse: 'aandeel', yahoo: 'META', valuta: 'USD' },
  { symbool: 'ASML', naam: 'ASML', klasse: 'aandeel', yahoo: 'ASML.AS', valuta: 'EUR' },
];

const PER_SYMBOOL = new Map(EFFECTEN.map(e => [e.symbool, e]));

// Kent Kader dit symbool als aandeel of fonds? Alles wat hier null teruggeeft is crypto, want dat
// is waar de app mee begon en wat de standaard blijft.
export function effect(symbool: string): Instrument | null {
  return PER_SYMBOOL.get(symbool.toUpperCase()) ?? null;
}

export function klasseVan(symbool: string): Activaklasse {
  return effect(symbool)?.klasse ?? 'crypto';
}

// ponytail: self-check ipv testframework, run met `npx tsx src/engine/instrumenten.ts` vanuit app/
if (require.main === module) {
  let missers = 0;
  const origineleAssert = console.assert.bind(console);
  console.assert = ((voorwaarde?: boolean, ...rest: unknown[]) => {
    if (!voorwaarde) missers++;
    origineleAssert(voorwaarde, ...rest);
  }) as typeof console.assert;

  // Geen dubbele symbolen: twee regels met hetzelfde symbool zouden betekenen dat welke koers je
  // krijgt afhangt van de volgorde in de lijst.
  const symbolen = EFFECTEN.map(e => e.symbool);
  console.assert(new Set(symbolen).size === symbolen.length, 'elk symbool komt precies één keer voor');

  // Geen dubbele Yahoo-tickers: twee regels die naar dezelfde bron wijzen zijn dezelfde positie
  // onder twee namen, en dan telt een portfolio hem dubbel.
  const tickers = EFFECTEN.map(e => e.yahoo);
  console.assert(new Set(tickers).size === tickers.length, 'elke Yahoo-ticker komt precies één keer voor');

  // Elk effect heeft een bron. Zonder ticker is er niets op te halen en is de regel een belofte
  // die de app niet kan waarmaken.
  console.assert(EFFECTEN.every(e => typeof e.yahoo === 'string' && e.yahoo.length > 0),
    'elk effect heeft een Yahoo-ticker');
  console.assert(EFFECTEN.every(e => e.klasse !== 'crypto'), 'in EFFECTEN staat geen crypto');

  // Het symbool is de ticker zonder suffix: dat is wat er op de kaart komt te staan.
  console.assert(EFFECTEN.every(e => e.yahoo!.split('.')[0] === e.symbool),
    'het symbool is de Yahoo-ticker zonder beurssuffix');

  console.assert(klasseVan('BTC') === 'crypto', 'een onbekend symbool is crypto');
  console.assert(klasseVan('VUSA') === 'etf', 'VUSA is een fonds');
  console.assert(klasseVan('vusa') === 'etf', 'de opzoeking is hoofdletterongevoelig');
  console.assert(klasseVan('AAPL') === 'aandeel', 'AAPL is een aandeel');
  console.assert(effect('BTC') === null, 'crypto staat niet in het effectenregister');

  // De valse aanname waar dit register voor bestaat: VUAA staat in Londen, niet in Amsterdam.
  console.assert(effect('VUAA')!.yahoo === 'VUAA.L', 'VUAA noteert in Londen, VUAA.AS bestaat niet');
  console.assert(effect('VUSA')!.yahoo === 'VUSA.AS', 'VUSA noteert in Amsterdam');

  console.assert(klasseNaam('etf') === 'index-fondsen', `meervoud van etf, was ${klasseNaam('etf')}`);
  console.assert(klasseNaam('aandeel', false) === 'aandeel', 'enkelvoud van aandeel');

  if (missers > 0) {
    console.error(`instrumenten.ts self-check: ${missers} misser(s)`);
    process.exit(1);
  }
  console.log('instrumenten.ts self-check geslaagd');
}
