// De databron voor aandelen en index-fondsen: het chart-endpoint van Yahoo Finance.
//
// Waarom deze bron. Binance en CoinGecko doen geen effecten, en elke andere gratis aanbieder
// (Alpha Vantage, Twelve Data, FMP, Tiingo, EODHD) eist een API-sleutel. Een sleutel in een
// client-app is door de gebruiker uit te lezen, en dat is precies het probleem dat bij eToro is
// opgelost door de gebruiker zijn eigen sleutel te laten koppelen. Voor koersdata is die frictie
// niet te rechtvaardigen. Yahoo vraagt geen sleutel, net als de twee bronnen die er al in zitten.
//
// Wat je erover moet weten voordat je erop bouwt: dit endpoint is niet gedocumenteerd. Yahoo sloot
// zijn officiële API in 2017 en dit is wat de website zelf gebruikt. Het kan zonder aankondiging
// veranderen, en het is kieskeurig over wie het te woord staat. Gemeten op 8 september 2026: met de
// verkeerde User-Agent geeft het hard HTTP 429 vanaf het eerste verzoek, met de goede geen enkele
// keer, ook niet bij honderd verzoeken achter elkaar. Zie de header hieronder, dat is de
// belangrijkste regel in dit bestand.

import { Candle } from './types';
import { Instrument } from './instrumenten';

const YAHOO_HOSTS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];

// De User-Agent is hier geen beleefdheid maar de hele sleutel tot de bron.
//
// Gemeten op 8 september 2026, zelfde machine, zelfde IP, binnen dezelfde minuut, alleen deze
// header verschillend:
//
//   geen header                            -> 429
//   'Mozilla/5.0 (Macintosh ... Chrome)'   -> 429
//   'Mozilla/5.0 (Windows NT 10.0 ...)'    -> 200
//   'Mozilla/5.0'                          -> 200
//
// De 429 die dit endpoint teruggeeft leest dus als "te veel verzoeken" terwijl het in werkelijkheid
// "deze client niet" betekent. Dat is een dure verwarring: hij lokt uit dat je gaat wachten en
// afknijpen terwijl er niets af te knijpen valt. React Native's fetch stuurt vanzelf een okhttp-UA
// mee, en die valt in de eerste categorie, dus zonder deze regel werkt de hele bron niet.
const YAHOO_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const HTTP_TIMEOUT = 15_000;

// Hoe lang alle Yahoo-verzoeken stilliggen na een 429.
//
// Let op wat dit wel en niet is. Met de juiste User-Agent hierboven trad in de meting geen enkele
// 429 op, ook niet bij honderd verzoeken achter elkaar zonder pauze. Deze afkoeling is dus geen
// antwoord op een gemeten limiet maar een vangnet voor het geval Yahoo alsnog dichtgaat, en dan is
// stoppen het enige zinnige: bij de blokkade die wel gemeten is hielp wachten namelijk niet, want
// die zat op de client en niet op de klok. Vijf minuten stilte kost hooguit één verversing.
const AFKOEL_MS = 5 * 60 * 1000;

// Tijdstip tot wanneer er niets verstuurd wordt. Module-niveau en niet per aanroep, want de hele
// app deelt één quotum bij Yahoo: een afkoeling per component zou niets afkoelen.
let geblokkeerdTot = 0;

// De minimale tussentijd tussen twee verzoeken aan Yahoo.
//
// Dit staat hier en niet bij de aanroeper, en dat is de kern van de zaak: de marktscan haalt zijn
// universum op in parallelle blokken van zes (GELIJKTIJDIG in analyzer.ts). Zes crypto-verzoeken
// tegelijk is voor Binance geen enkel probleem, zes Yahoo-verzoeken tegelijk is precies wat de 429
// uitlokt. In plaats van elke aanroeper te laten onthouden dat effecten anders zijn, knijpt deze
// module zichzelf af: alles wat hierlangs komt gaat één voor één de deur uit, met een pauze ertussen.
// De scan mag dus gewoon blijven doen wat hij deed.
//
// Het getal is bewust bescheiden en niet ruim. Gemeten is dat er met de juiste User-Agent geen
// limiet te raken viel: honderd verzoeken zonder enige pauze, plus blokken van zes tegelijk, alles
// 200. Wat NIET gemeten is, is of er op de lange termijn een dagquotum bestaat. Een halve seconde is
// de prijs voor die onzekerheid: bij veertien effecten kost dat zeven seconden, en dat is te
// overzien. Zou hier 1500 staan, dan bepaalde de wachttijd de scan op grond van een limiet waarvan
// het bestaan niet is aangetoond.
const MIN_TUSSENTIJD_MS = 500;

// De staart van de wachtrij. Elke aanroep hangt zich achter de vorige, dus er is er nooit meer dan
// één tegelijk onderweg.
let wachtrij: Promise<void> = Promise.resolve();
let laatsteVerzoek = 0;

const wacht = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Zet een taak achter in de rij en geef terug wat hij oplevert. De rij zelf breekt nooit: een
// mislukte taak mag de volgende niet blokkeren, dus de ketting vangt zijn eigen fouten op.
function inDeRij<T>(taak: () => Promise<T>): Promise<T> {
  const uitkomst = wachtrij.then(async () => {
    const sinds = Date.now() - laatsteVerzoek;
    if (sinds < MIN_TUSSENTIJD_MS) await wacht(MIN_TUSSENTIJD_MS - sinds);
    laatsteVerzoek = Date.now();
    return taak();
  });
  wachtrij = uitkomst.then(() => undefined, () => undefined);
  return uitkomst;
}

export function yahooGeblokkeerd(): boolean {
  return Date.now() < geblokkeerdTot;
}

// Alleen voor de zelftest en voor een handmatige "probeer opnieuw" door de gebruiker. Niet
// aanroepen vanuit een lus.
export function resetYahooBlokkade(): void {
  geblokkeerdTot = 0;
}

interface YahooRespons {
  chart?: {
    result?: {
      meta?: { currency?: string; exchangeName?: string; longName?: string };
      timestamp?: number[];
      indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
    }[] | null;
    error?: { code?: string; description?: string } | null;
  };
}

export interface YahooUitkomst {
  candles: Candle[];
  // De valuta waarin deze reeks noteert, zoals Yahoo hem meldt. VUSA op Amsterdam staat in euro's.
  valuta: string;
  // Waarom het niet lukte, in het Nederlands, of null als het lukte. Bedoeld om aan de gebruiker
  // te tonen: een leeg scherm zonder reden is precies wat deze app nergens doet.
  fout: string | null;
}

function parseCandles(resultaat: NonNullable<NonNullable<YahooRespons['chart']>['result']>[0]): Candle[] {
  const tijden = resultaat.timestamp ?? [];
  const q = resultaat.indicators?.quote?.[0];
  if (!q || tijden.length === 0) return [];

  const candles: Candle[] = [];
  for (let i = 0; i < tijden.length; i++) {
    const open = q.open?.[i];
    const high = q.high?.[i];
    const low = q.low?.[i];
    const close = q.close?.[i];
    // Yahoo levert null op dagen waarop de beurs dicht was of een koers ontbreekt. Die overslaan
    // en niet op 0 zetten: een nul-candle zou als een crash van 100 procent door de indicatoren
    // gaan en RSI, ATR en de stop-loss die daaruit volgt volledig verzieken.
    if (typeof open !== 'number' || typeof high !== 'number'
      || typeof low !== 'number' || typeof close !== 'number') continue;
    candles.push({
      open, high, low, close,
      // Volume mag wel ontbreken. Het weegt alleen mee in de volumepiek-component van de score,
      // en die kan met een 0 leven; een koers kan dat niet.
      volume: typeof q.volume?.[i] === 'number' ? q.volume[i] as number : 0,
      tijd: tijden[i] * 1000,   // Yahoo telt in seconden, de rest van de app in milliseconden
    });
  }
  return candles;
}

// Eén ticker ophalen. `ticker` is de Yahoo-vorm met beurssuffix ('VUSA.AS'), niet het symbool dat
// de app toont.
export function haalYahooCandles(
  ticker: string,
  interval: '1d' | '1wk' = '1d',
  range = '2y',
): Promise<YahooUitkomst> {
  // De blokkade buiten de rij toetsen: staat de bron stil, dan hoeft dit verzoek ook niet eerst
  // anderhalve seconde te wachten om daarna alsnog niets te doen.
  if (yahooGeblokkeerd()) {
    return Promise.resolve({ candles: [], valuta: 'USD', fout: 'Kader haalt even geen koersen op bij Yahoo, omdat die de laatste verzoeken afwees. Probeer het over een paar minuten opnieuw.' });
  }
  return inDeRij(() => verzoek(ticker, interval, range));
}

async function verzoek(
  ticker: string,
  interval: '1d' | '1wk',
  range: string,
): Promise<YahooUitkomst> {
  // Tussen het aansluiten in de rij en nu kan er een 429 binnengekomen zijn op een eerder verzoek.
  // Nog een keer toetsen, anders loopt de hele rij alsnog een voor een tegen dezelfde dichte deur.
  if (yahooGeblokkeerd()) {
    return { candles: [], valuta: 'USD', fout: 'Kader haalt even geen koersen op bij Yahoo, omdat die de laatste verzoeken afwees. Probeer het over een paar minuten opnieuw.' };
  }

  const pad = `/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
  let laatsteFout = 'Kader kon de koers van dit fonds niet ophalen.';

  for (const host of YAHOO_HOSTS) {
    let res: Response;
    try {
      res = await Promise.race([
        fetch(host + pad, { headers: YAHOO_HEADERS }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), HTTP_TIMEOUT)),
      ]) as Response;
    } catch {
      laatsteFout = 'Kader kon Yahoo niet bereiken. Controleer je verbinding.';
      continue;
    }

    // 429 geldt voor de hele bron en niet voor deze ene ticker, dus de tweede host proberen heeft
    // geen zin: die deelt hetzelfde quotum. Gemeten: query1 en query2 vielen tegelijk om.
    if (res.status === 429) {
      geblokkeerdTot = Date.now() + AFKOEL_MS;
      return { candles: [], valuta: 'USD', fout: 'Yahoo wijst op dit moment verzoeken af omdat er te veel achter elkaar kwamen. Kader wacht een paar minuten en probeert het daarna opnieuw.' };
    }

    if (!res.ok) {
      laatsteFout = `Yahoo gaf een fout (${res.status}) voor ${ticker}.`;
      continue;
    }

    let data: YahooRespons;
    try {
      data = await res.json() as YahooRespons;
    } catch {
      laatsteFout = 'Kader kreeg geen leesbaar antwoord van Yahoo.';
      continue;
    }

    const resultaat = data.chart?.result?.[0];
    if (!resultaat) {
      // Yahoo zet de reden zelf in het antwoord, bijvoorbeeld "No data found, symbol may be
      // delisted". Die doorgeven is bruikbaarder dan een eigen algemene tekst: hij zegt of het
      // symbool fout is of dat er alleen geen data is.
      const reden = data.chart?.error?.description;
      return {
        candles: [], valuta: 'USD',
        fout: reden
          ? `Yahoo kent ${ticker} niet: ${reden}`
          : `Yahoo gaf geen koersen terug voor ${ticker}.`,
      };
    }

    const candles = parseCandles(resultaat);
    if (candles.length === 0) {
      return { candles: [], valuta: resultaat.meta?.currency ?? 'USD', fout: `Yahoo gaf een lege reeks terug voor ${ticker}.` };
    }
    return { candles, valuta: resultaat.meta?.currency ?? 'USD', fout: null };
  }

  return { candles: [], valuta: 'USD', fout: laatsteFout };
}

// De koers en de valuta van één effect, voor de portfoliowaardering. Haalt bewust dezelfde
// dagcandles op in plaats van een apart quote-endpoint: dat scheelt een tweede ongedocumenteerd
// pad om te onderhouden, en de laatste slotkoers is voor een beurs die dicht is sowieso het
// juiste getal.
export async function haalYahooPrijs(instrument: Instrument): Promise<{ prijs: number; valuta: string } | null> {
  if (!instrument.yahoo) return null;
  // Een maand is ruim genoeg voor de laatste koers en veel goedkoper dan twee jaar aan candles.
  const { candles, valuta } = await haalYahooCandles(instrument.yahoo, '1d', '1mo');
  if (candles.length === 0) return null;
  return { prijs: candles[candles.length - 1].close, valuta };
}
