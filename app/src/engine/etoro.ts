import { PortfolioTrade, nieuweId } from '../state/portfolioTypes';
import { ETORO_TRADABLE } from './opportunities';
import { COIN_INFO } from './coinInfo';
import { EtoroEligibility, StopLossLimiet, kiesLimiet } from './etoroLimieten';

const BASIS_URL = 'https://public-api.etoro.com/api';
// Lezen mag kort falen; een schrijfactie krijgt langer de tijd, want afbreken lost daar niets op
// (zie EtoroFout.afgebroken) en een order die net onderweg is wil je niet zelf onbeslist maken.
const LEES_TIMEOUT = 15_000;
const SCHRIJF_TIMEOUT = 30_000;

// eToro valideert X-Request-Id als een echt GUID; nieuweId() (base36) volstaat niet.
export function guid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type EtoroOmgeving = 'real' | 'demo';

export interface EtoroSleutels {
  apiKey: string;
  userKey: string;
  // Ontbreekt = 'real'. Demo- en echte sleutels zijn niet uitwisselbaar: dezelfde sleutel op het
  // verkeerde pad geeft een 401, geen order op het verkeerde account.
  omgeving?: EtoroOmgeving;
}

interface EtoroPositie {
  positionID: number;
  instrumentID: number;
  isBuy: boolean;
  amount?: number;
  initialAmountInDollars?: number;
  units: number;
  openRate: number;
  openDateTime: string;
  stopLossRate?: number;
  takeProfitRate?: number;
}

// Posities zitten genest onder clientPortfolio (geverifieerd tegen de echte API-respons).
interface EtoroPortfolioRespons {
  clientPortfolio?: {
    credit?: number;
    unrealizedPnL?: number;
    positions?: EtoroPositie[];
  };
}

interface EtoroInstrument {
  instrumentID: number;
  symbolFull?: string;
  ticker?: string;
  instrumentDisplayName?: string;
  instrumentTypeID?: number;
}

interface FetchOpties {
  // De meeste endpoints zitten op v1; eligibility bestaat alleen als v2.
  versie?: 'v1' | 'v2';
  // Een body aanwezig = POST. Zonder body blijft het een GET, zodat de bestaande aanroepen
  // ongewijzigd blijven werken.
  body?: unknown;
  // Overschrijft die afleiding. Nodig voor de PATCH op posities en voor een POST zonder body.
  methode?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  // De aanroeper levert 'm, zodat een handmatige herhaling van een order dezelfde id hergebruikt.
  verzoekId?: string;
  // Langere timeout, en de aanroeper mag een afgebroken poging niet als "mislukt" opvatten.
  schrijft?: boolean;
}

// Waar het /demo/-segment staat verschilt per endpointgroep en is niet uit één regel af te leiden.
// Verkeerd gokken betekent een echte order op een echt account, dus een pad dat hier niet in staat
// levert een fout op in plaats van stilzwijgend het echte pad. Links het echte pad (prefix), rechts
// wat er in demo gebruikt wordt; identiek betekent dat het endpoint niet accountgebonden is.
//
// Uit eToro's developer portal: orders, market-close-orders en eligibility hebben elk een eigen
// gedocumenteerd demo-pad, en het /demo/-segment komt steeds na `execution` of `info`. Portfolio en
// historie volgen datzelfde patroon maar zijn nog niet tegen een echte demo-sleutel bevestigd;
// scripts/etoro-demo-order.ts probeert ze en meldt welk pad werkt.
//
// De PATCH op /trading/positions/{id} staat er bewust NIET in. In de gecureerde endpoint-index van
// eToro komt hij niet voor, en de pagina over positie-informatie noemt zichzelf expliciet
// read-only. Zolang niet vaststaat dat dat endpoint bestaat, gooit dit pad.
const DEMO_PADEN: ReadonlyArray<readonly [string, string]> = [
  ['/me', '/me'],
  ['/market-data/', '/market-data/'],
  ['/trading/info/eligibility', '/trading/info/demo/eligibility'],
  ['/trading/info/portfolio', '/trading/info/demo/portfolio'],
  ['/trading/info/trade/history', '/trading/info/demo/trade/history'],
  ['/trading/execution/orders', '/trading/execution/demo/orders'],
  ['/trading/execution/market-close-orders/', '/trading/execution/demo/market-close-orders/'],
];

// Alleen het pad zelf vergelijken; de querystring blijft ongemoeid achter het pad hangen.
export function demoPad(pad: string): string {
  const vraag = pad.indexOf('?');
  const kaal = vraag === -1 ? pad : pad.slice(0, vraag);
  const staart = vraag === -1 ? '' : pad.slice(vraag);

  // Langste treffer wint, zodat /trading/info/portfolio niet per ongeluk op een kortere prefix valt.
  // Een treffer moet op een padgrens eindigen: zonder die eis zou '/me' ook op een toekomstig
  // '/messages' matchen en dat pad stilzwijgend doorlaten in plaats van te gooien.
  let beste: readonly [string, string] | null = null;
  for (const regel of DEMO_PADEN) {
    if (!kaal.startsWith(regel[0])) continue;
    const rest = kaal.slice(regel[0].length);
    if (rest !== '' && !regel[0].endsWith('/') && !rest.startsWith('/')) continue;
    if (!beste || regel[0].length > beste[0].length) beste = regel;
  }
  if (!beste) throw new Error(`Geen demo-pad bekend voor ${kaal}. Kader stuurt dit niet naar het echte account.`);
  return beste[1] + kaal.slice(beste[0].length) + staart;
}

// status null = we hebben nooit een antwoord gezien (netwerkfout of timeout).
export class EtoroFout extends Error {
  constructor(bericht: string, readonly status: number | null, readonly afgebroken = false) {
    super(bericht);
    this.name = 'EtoroFout';
  }
}

// Wat betekent deze statuscode voor een schrijfactie? 'fout' = eToro heeft 'm afgewezen, er is
// zeker niets gebeurd. 'onbekend' = het kan uitgevoerd zijn; dan verzoenen, nooit herhalen.
export function duidOrderStatus(status: number): 'ok' | 'fout' | 'onbekend' {
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 400 && status < 500) return 'fout';
  return 'onbekend';
}

async function etoroFetch<T>(pad: string, sleutels: EtoroSleutels, opties: FetchOpties = {}): Promise<T> {
  const { versie = 'v1', body, methode, verzoekId, schrijft = false } = opties;
  const werkelijkPad = (sleutels.omgeving ?? 'real') === 'demo' ? demoPad(pad) : pad;

  // Promise.race liet de fetch gewoon doorlopen; een AbortController breekt 'm echt af.
  const controller = new AbortController();
  const wekker = setTimeout(() => controller.abort(), schrijft ? SCHRIJF_TIMEOUT : LEES_TIMEOUT);

  let res: Response;
  try {
    res = await fetch(`${BASIS_URL}/${versie}${werkelijkPad}`, {
      method: methode ?? (body === undefined ? 'GET' : 'POST'),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      headers: {
        'x-api-key': sleutels.apiKey,
        'x-user-key': sleutels.userKey,
        'x-request-id': verzoekId ?? guid(),
        'Accept': 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
    });
  } catch (e) {
    const afgebroken = controller.signal.aborted;
    throw new EtoroFout(
      afgebroken ? 'Geen antwoord van eToro binnen de tijd.' : 'Geen verbinding met eToro.',
      null,
      afgebroken,
    );
  } finally {
    clearTimeout(wekker);
  }

  if (res.status === 401 || res.status === 403) {
    throw new EtoroFout('Ongeldige API-sleutel. Controleer je sleutel bij Instellingen.', res.status);
  }
  if (res.status === 429) {
    throw new EtoroFout('Te veel aanvragen bij eToro. Probeer het over een minuut opnieuw.', res.status);
  }
  if (!res.ok) {
    // ponytail: foutbody meesturen ipv alleen de statuscode, anders is de oorzaak niet te achterhalen
    const tekst = await res.text().catch(() => '');
    throw new EtoroFout(`eToro gaf een fout terug (${res.status}).${tekst ? ' ' + tekst.slice(0, 500) : ''}`, res.status);
  }
  return res.json() as Promise<T>;
}

// Pad geverifieerd tegen eToro's publieke API (real-account). Het demo-pad komt uit DEMO_PADEN en
// is nog niet tegen een echte demo-sleutel bevestigd.
export async function haalEtoroPortfolio(sleutels: EtoroSleutels): Promise<EtoroPortfolioRespons> {
  return etoroFetch<EtoroPortfolioRespons>('/trading/info/portfolio', sleutels);
}

// ---------- Account ----------

export interface EtoroAccount {
  gcid?: number;
  realCid?: number;
  demoCid?: number;
  username?: string;
  scopes?: string[];
}

export async function haalAccountInfo(sleutels: EtoroSleutels): Promise<EtoroAccount> {
  return etoroFetch<EtoroAccount>('/me', sleutels);
}

// eToro's exacte scope-namen staan niet in de documentatie; wat /api/v1/me teruggeeft moet in
// fase 1 bevestigd worden. Tot dan herkennen we een schrijfrecht aan het woord zelf, en bij twijfel
// gaan we uit van alleen lezen: een knop die ontbreekt is vervelend, een koopknop die er ten
// onrechte staat is een geldprobleem.
const SCHRIJFRECHT = /(trade|trading|write|execute|execution|order)/i;
const LEESRECHT = /read/i;

export function magHandelenVolgensScopes(scopes: string[] | null | undefined): boolean {
  if (!Array.isArray(scopes)) return false;
  return scopes.some(s => typeof s === 'string' && SCHRIJFRECHT.test(s) && !LEESRECHT.test(s));
}

// Vrij te besteden saldo van de actieve omgeving. null = eToro gaf het veld niet mee; dan liever
// geen betaalbaarheidscontrole dan een verzonnen bedrag.
export async function haalVrijSaldo(sleutels: EtoroSleutels): Promise<number | null> {
  const portfolio = await haalEtoroPortfolio(sleutels);
  const credit = portfolio.clientPortfolio?.credit;
  return typeof credit === 'number' && isFinite(credit) ? credit : null;
}

// ---------- Stop-loss-limieten ----------

interface EligibilityRespons {
  eligibilities?: EtoroEligibility[];
  notFoundSymbols?: string[];
}

// eToro staat maximaal 100 symbolen per aanroep toe, en dit endpoint heeft een eigen quotum van
// 20 requests per 60 seconden. Daarom in één keer alles opvragen en een dag cachen (zie
// state/useStopLossLimiet.ts); de limieten veranderen zelden.
const MAX_SYMBOLEN = 100;

// Geeft per symbool de stop-loss-grenzen die eToro hanteert. Symbolen die eToro niet kent komen
// terug in notFoundSymbols en staan dus simpelweg niet in de kaart: geen limiet, geen waarschuwing.
export async function haalStopLossLimieten(
  symbolen: string[],
  sleutels: EtoroSleutels,
): Promise<Record<string, StopLossLimiet>> {
  const uniek = [...new Set(symbolen.map(s => s.toUpperCase()))].slice(0, MAX_SYMBOLEN);
  if (uniek.length === 0) return {};

  const data = await etoroFetch<EligibilityRespons>('/trading/info/eligibility', sleutels, {
    versie: 'v2',
    body: { symbols: uniek, currency: 'USD' },
  });

  const kaart: Record<string, StopLossLimiet> = {};
  for (const item of data.eligibilities ?? []) {
    const limiet = kiesLimiet(item);
    if (limiet) kaart[limiet.symbool] = limiet;
  }
  return kaart;
}

async function haalInstrumenten(ids: number[], sleutels: EtoroSleutels): Promise<Map<number, EtoroInstrument>> {
  const kaart = new Map<number, EtoroInstrument>();
  if (ids.length === 0) return kaart;
  // De respons komt terug onder instrumentDisplayDatas (geverifieerd tegen de echte API-respons).
  const data = await etoroFetch<{ instrumentDisplayDatas?: EtoroInstrument[] } | EtoroInstrument[]>(
    `/market-data/instruments?instrumentIds=${ids.join(',')}`,
    sleutels,
  );
  const lijst = Array.isArray(data) ? data : (data.instrumentDisplayDatas ?? []);
  for (const instr of lijst) kaart.set(instr.instrumentID, instr);
  return kaart;
}

// De crypto-instrumentTypeID staat niet vast gedocumenteerd; we vragen 'm live op zodat we niet
// hoeven te gokken (en zodat het blijft werken als eToro de nummering ooit wijzigt).
// ponytail: lukt de herkenning niet (onverwachte responsvorm), dan filteren we niet op type en
// nemen we liever een aandeel te veel mee dan een crypto te missen.
async function haalCryptoTypeIds(sleutels: EtoroSleutels): Promise<Set<number> | null> {
  try {
    const data = await etoroFetch<unknown>('/market-data/instrument-types', sleutels);
    const lijst = Array.isArray(data) ? data : Array.isArray((data as any)?.instrumentTypes) ? (data as any).instrumentTypes : null;
    if (!lijst) return null;

    const ids = new Set<number>();
    for (const item of lijst) {
      if (!item || typeof item !== 'object') continue;
      const isCrypto = Object.values(item).some(v => typeof v === 'string' && /crypto/i.test(v));
      if (!isCrypto) continue;
      const idVeld = Object.entries(item).find(([k, v]) => /id$/i.test(k) && typeof v === 'number');
      if (idVeld) ids.add(idVeld[1] as number);
    }
    return ids.size > 0 ? ids : null;
  } catch {
    return null;
  }
}

function symboolVan(instrument: EtoroInstrument | undefined): string {
  const ruw = instrument?.ticker ?? instrument?.symbolFull ?? '';
  return ruw.replace(/\/.*$/, '').toUpperCase(); // "BTC/USD" -> "BTC"
}

export function naarPortfolioTrade(positie: EtoroPositie, symbool: string): PortfolioTrade {
  const stopLoss = positie.stopLossRate ?? 0;
  const takeProfit = positie.takeProfitRate ?? 0;
  const rr = stopLoss > 0 && takeProfit > 0 && positie.openRate > stopLoss
    ? Math.round(((takeProfit - positie.openRate) / (positie.openRate - stopLoss)) * 10) / 10
    : 0;

  return {
    id: nieuweId(),
    symbool,
    naam: COIN_INFO[symbool]?.naam ?? symbool,
    entryPrijs: positie.openRate,
    stopLoss,
    takeProfit,
    rr,
    datum: new Date(positie.openDateTime).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }),
    status: 'open',
    bedragUsd: positie.amount ?? positie.initialAmountInDollars ?? 0,
    aantalCoins: positie.units,
    etoroPositionID: positie.positionID,
    bron: 'etoro',
  };
}

export interface EtoroOvergeslagenPositie {
  naam: string;
  reden: 'short' | 'geen-crypto';
}

export interface EtoroImportResultaat {
  trades: PortfolioTrade[];
  overgeslagen: EtoroOvergeslagenPositie[];
}

// Gedeeld door de portfolio- en de historie-import: welk symbool hoort bij dit instrument, en
// is het crypto? Alleen filteren op instrumentType als de herkenning is gelukt; anders (null)
// niet gokken (zie haalCryptoTypeIds).
function duidInstrument(
  instrumentID: number,
  instrumentKaart: Map<number, EtoroInstrument>,
  cryptoTypeIds: Set<number> | null,
): { symbool: string; naam: string; isCrypto: boolean } {
  const instrument = instrumentKaart.get(instrumentID);
  const symbool = symboolVan(instrument);
  const naam = instrument?.instrumentDisplayName || symbool || `instrument ${instrumentID}`;
  const isCrypto = !cryptoTypeIds || (instrument?.instrumentTypeID !== undefined && cryptoTypeIds.has(instrument.instrumentTypeID))
    || ETORO_TRADABLE.has(symbool);
  return { symbool, naam, isCrypto };
}

function bouwOpenTrades(
  posities: EtoroPositie[],
  instrumentKaart: Map<number, EtoroInstrument>,
  cryptoTypeIds: Set<number> | null,
): EtoroImportResultaat {
  const trades: PortfolioTrade[] = [];
  const overgeslagen: EtoroOvergeslagenPositie[] = [];

  for (const positie of posities) {
    const { symbool, naam, isCrypto } = duidInstrument(positie.instrumentID, instrumentKaart, cryptoTypeIds);

    if (!positie.isBuy) { overgeslagen.push({ naam, reden: 'short' }); continue; }
    if (!symbool || !isCrypto) { overgeslagen.push({ naam, reden: 'geen-crypto' }); continue; }
    trades.push(naarPortfolioTrade(positie, symbool));
  }

  return { trades, overgeslagen };
}

// ---------- Gesloten posities (trade-historie) ----------

// Let op: deze endpoint levert `positionId` en `instrumentId` (kleine d), terwijl
// /trading/info/portfolio `positionID` en `instrumentID` gebruikt. We lezen beide varianten uit
// zodat een casing-wijziging aan eToro's kant ons niet stilzwijgend de historie kost.
interface EtoroHistorieRegel {
  positionId?: number;
  positionID?: number;
  instrumentId?: number;
  instrumentID?: number;
  isBuy?: boolean;
  openRate?: number;
  closeRate?: number;
  openTimestamp?: string;
  closeTimestamp?: string;
  netProfit?: number;
  units?: number;
  investment?: number;
  initialInvestment?: number;
  stopLossRate?: number;
  takeProfitRate?: number;
}

const positieIdVan = (r: EtoroHistorieRegel) => r.positionId ?? r.positionID;
const instrumentIdVan = (r: EtoroHistorieRegel) => r.instrumentId ?? r.instrumentID;

// ponytail: vast venster van 1 jaar en één pagina van 1000. PortfolioTrade.datum is een
// gelokaliseerde string ("15 jan 2026") en dus niet te parsen tot een scherpere ondergrens.
// Pagineer pas als iemand meer dan 1000 trades per jaar sluit.
const HISTORIE_VENSTER_MS = 365 * 24 * 60 * 60 * 1000;

async function haalHistorieRegels(sleutels: EtoroSleutels): Promise<EtoroHistorieRegel[]> {
  const minDate = new Date(Date.now() - HISTORIE_VENSTER_MS).toISOString().slice(0, 10);
  const data = await etoroFetch<EtoroHistorieRegel[] | { trades?: EtoroHistorieRegel[] }>(
    `/trading/info/trade/history?minDate=${minDate}&page=1&pageSize=1000`,
    sleutels,
  );
  return Array.isArray(data) ? data : (data.trades ?? []);
}

const nlDatum = (ms: number) =>
  new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

// netProfit is inclusief kosten en bepaalt daarom of het een winst of verlies was, niet de
// vergelijking van closeRate met openRate.
export function naarGeslotenTrade(regel: EtoroHistorieRegel, symbool: string): PortfolioTrade | null {
  const positionID = positieIdVan(regel);
  const slotTijd = regel.closeTimestamp ? Date.parse(regel.closeTimestamp) : NaN;
  const openTijd = regel.openTimestamp ? Date.parse(regel.openTimestamp) : NaN;
  if (typeof positionID !== 'number' || typeof regel.openRate !== 'number'
    || typeof regel.closeRate !== 'number' || isNaN(slotTijd)) return null;

  const stopLoss = regel.stopLossRate ?? 0;
  const takeProfit = regel.takeProfitRate ?? 0;
  const rr = stopLoss > 0 && takeProfit > 0 && regel.openRate > stopLoss
    ? Math.round(((takeProfit - regel.openRate) / (regel.openRate - stopLoss)) * 10) / 10
    : 0;
  const netProfit = regel.netProfit ?? 0;

  return {
    id: nieuweId(),
    symbool,
    naam: COIN_INFO[symbool]?.naam ?? symbool,
    entryPrijs: regel.openRate,
    stopLoss,
    takeProfit,
    rr,
    datum: nlDatum(isNaN(openTijd) ? slotTijd : openTijd),
    status: netProfit >= 0 ? 'gewonnen' : 'verloren',
    bedragUsd: regel.investment ?? regel.initialInvestment ?? 0,
    aantalCoins: regel.units,
    exitPrijs: regel.closeRate,
    slotDatum: nlDatum(slotTijd),
    slotTijd,
    // Alleen bewaren als eToro het echt meestuurde. Een ontbrekende netProfit als 0 wegschrijven
    // zou het totaalresultaat vervuilen met nepwinsten van precies nul.
    resultaatUsd: typeof regel.netProfit === 'number' ? regel.netProfit : undefined,
    etoroPositionID: positionID,
    bron: 'etoro',
  };
}

function bouwGeslotenTrades(
  regels: EtoroHistorieRegel[],
  instrumentKaart: Map<number, EtoroInstrument>,
  cryptoTypeIds: Set<number> | null,
): EtoroImportResultaat {
  const trades: PortfolioTrade[] = [];
  const overgeslagen: EtoroOvergeslagenPositie[] = [];

  for (const regel of regels) {
    const instrumentID = instrumentIdVan(regel);
    if (instrumentID === undefined) continue;
    const { symbool, naam, isCrypto } = duidInstrument(instrumentID, instrumentKaart, cryptoTypeIds);

    if (regel.isBuy === false) { overgeslagen.push({ naam, reden: 'short' }); continue; }
    if (!symbool || !isCrypto) { overgeslagen.push({ naam, reden: 'geen-crypto' }); continue; }
    const trade = naarGeslotenTrade(regel, symbool);
    if (trade) trades.push(trade);
  }

  return { trades, overgeslagen };
}

export interface EtoroSyncResultaat {
  open: EtoroImportResultaat;       // wat er nu open staat op eToro
  historie: EtoroImportResultaat;   // wat er het afgelopen jaar is gesloten
}

// Open posities en gesloten historie in één keer. Bewust één functie en niet twee losse imports:
// beide hebben dezelfde instrument- en instrumenttype-lookups nodig, en die endpoints delen een
// quotum van 60 requests per 60 seconden. Los aanroepen deed elke sync die twee calls dubbel.
export async function importeerEtoroAlles(sleutels: EtoroSleutels): Promise<EtoroSyncResultaat> {
  const [portfolio, regels] = await Promise.all([
    haalEtoroPortfolio(sleutels),
    haalHistorieRegels(sleutels),
  ]);
  const posities = portfolio.clientPortfolio?.positions ?? [];

  const ids = [...new Set([
    ...posities.map(p => p.instrumentID),
    ...regels.map(instrumentIdVan).filter((id): id is number => typeof id === 'number'),
  ])];
  const [instrumentKaart, cryptoTypeIds] = await Promise.all([
    haalInstrumenten(ids, sleutels),
    haalCryptoTypeIds(sleutels),
  ]);

  return {
    open: bouwOpenTrades(posities, instrumentKaart, cryptoTypeIds),
    historie: bouwGeslotenTrades(regels, instrumentKaart, cryptoTypeIds),
  };
}

// ponytail: self-check ipv testframework, run met `npx ts-node app/src/engine/etoro.ts`
if (require.main === module) {
  // console.assert gooit niet in Node en zet de exitcode niet, dus zonder deze wrapper zou dit
  // bestand "geslaagd" printen terwijl bijvoorbeeld demoPad stuk is. De poort uit het plan moet
  // echt een poort zijn.
  let missers = 0;
  const origineleAssert = console.assert.bind(console);
  console.assert = ((voorwaarde?: boolean, ...rest: unknown[]) => {
    if (!voorwaarde) missers++;
    origineleAssert(voorwaarde, ...rest);
  }) as typeof console.assert;

  const mock: EtoroPositie = {
    positionID: 123, instrumentID: 1, isBuy: true, amount: 500, units: 0.01,
    openRate: 50000, openDateTime: '2026-01-15T10:00:00Z', stopLossRate: 45000, takeProfitRate: 65000,
  };
  const trade = naarPortfolioTrade(mock, 'BTC');
  console.assert(trade.symbool === 'BTC', 'symbool moet BTC zijn');
  console.assert(trade.entryPrijs === 50000, 'entry moet 50000 zijn');
  console.assert(trade.stopLoss === 45000 && trade.takeProfit === 65000, 'SL/TP moeten overgenomen worden');
  console.assert(trade.rr === 3, `RR moet 3 zijn ((65000-50000)/(50000-45000)), was ${trade.rr}`);
  console.assert(trade.etoroPositionID === 123, 'positionID moet bewaard blijven');
  console.assert(trade.bron === 'etoro', 'bron moet etoro zijn');

  const geenSlTp = naarPortfolioTrade({ ...mock, stopLossRate: undefined, takeProfitRate: undefined }, 'BTC');
  console.assert(geenSlTp.stopLoss === 0 && geenSlTp.takeProfit === 0, 'ontbrekende SL/TP moet 0 worden');
  console.assert(geenSlTp.rr === 0, 'RR zonder SL/TP moet 0 zijn');

  // Historie: gesloten trade uit een ruwe historie-regel.
  const ruw = {
    positionId: 123, instrumentId: 1, isBuy: true, openRate: 50000, closeRate: 65000,
    openTimestamp: '2026-01-15T10:00:00Z', closeTimestamp: '2026-02-01T12:00:00Z',
    netProfit: 150, units: 0.01, investment: 500, stopLossRate: 45000, takeProfitRate: 65000,
  };
  const gesloten = naarGeslotenTrade(ruw, 'BTC');
  console.assert(gesloten?.etoroPositionID === 123, 'positionId (kleine d) moet gelezen worden');
  console.assert(gesloten?.entryPrijs === 50000 && gesloten?.exitPrijs === 65000, 'openRate/closeRate moeten entry/exit worden');
  console.assert(gesloten?.slotTijd === Date.parse('2026-02-01T12:00:00Z'), 'closeTimestamp moet epoch ms worden');
  console.assert(gesloten?.status === 'gewonnen', 'positieve netProfit is gewonnen');
  console.assert(gesloten?.rr === 3, `RR moet 3 zijn, was ${gesloten?.rr}`);
  console.assert(gesloten?.aantalCoins === 0.01 && gesloten?.bedragUsd === 500, 'units/investment moeten overgenomen worden');
  console.assert(gesloten?.bron === 'etoro', 'bron moet etoro zijn');
  console.assert(gesloten?.resultaatUsd === 150, `netProfit moet als resultaatUsd bewaard blijven, was ${gesloten?.resultaatUsd}`);

  // netProfit wint van de prijsvergelijking: exit boven entry, maar door kosten toch verlies.
  const kostenVerlies = naarGeslotenTrade({ ...ruw, netProfit: -2 }, 'BTC');
  console.assert(kostenVerlies?.status === 'verloren', 'negatieve netProfit is verloren, ook als closeRate > openRate');
  console.assert(kostenVerlies?.resultaatUsd === -2, 'het netto verlies moet bewaard blijven, niet alleen het teken');

  // Ontbrekende netProfit blijft undefined, wordt geen nul: anders telt een onbekend resultaat
  // als "precies break-even" mee in het totaal.
  const zonderNetProfit = naarGeslotenTrade({ ...ruw, netProfit: undefined }, 'BTC');
  console.assert(zonderNetProfit?.resultaatUsd === undefined, 'ontbrekende netProfit mag geen 0 worden');

  // Oude casing (positionID/instrumentID) moet ook werken.
  const oudeCasing = naarGeslotenTrade(
    { positionID: 9, instrumentID: 1, openRate: 100, closeRate: 90, closeTimestamp: '2026-02-01T12:00:00Z', netProfit: -5 },
    'ETH',
  );
  console.assert(oudeCasing?.etoroPositionID === 9, 'positionID (hoofdletter D) moet ook gelezen worden');
  console.assert(oudeCasing?.status === 'verloren', 'negatieve netProfit is verloren');
  console.assert(oudeCasing?.rr === 0, 'RR zonder SL/TP moet 0 zijn');
  console.assert(oudeCasing?.datum === oudeCasing?.slotDatum, 'zonder openTimestamp valt datum terug op de slotdatum');

  console.assert(naarGeslotenTrade({ ...ruw, positionId: undefined }, 'BTC') === null, 'regel zonder positionId is onbruikbaar');
  console.assert(naarGeslotenTrade({ ...ruw, closeRate: undefined }, 'BTC') === null, 'regel zonder closeRate is onbruikbaar');
  console.assert(naarGeslotenTrade({ ...ruw, openRate: undefined }, 'BTC') === null, 'regel zonder openRate is onbruikbaar');
  console.assert(naarGeslotenTrade({ ...ruw, closeTimestamp: 'onzin' }, 'BTC') === null, 'onparseerbare closeTimestamp is onbruikbaar');

  // ---------- Demo-paden ----------
  // Het gevaar is niet dat een demo-pad ontbreekt, maar dat een onbekend pad stilzwijgend naar het
  // echte account gaat. Dus: elk bekend pad mapt, en al het andere gooit.
  console.assert(demoPad('/trading/execution/orders') === '/trading/execution/demo/orders', 'orders moet het demo-segment krijgen');
  console.assert(demoPad('/trading/info/portfolio') === '/trading/info/demo/portfolio', 'portfolio moet het demo-segment krijgen');
  console.assert(demoPad('/trading/info/trade/history?minDate=2026-01-01&page=1') === '/trading/info/demo/trade/history?minDate=2026-01-01&page=1',
    'de querystring moet intact achter het demo-pad blijven staan');
  console.assert(demoPad('/trading/info/eligibility') === '/trading/info/demo/eligibility', 'eligibility heeft een eigen demo-pad');
  console.assert(demoPad('/trading/execution/market-close-orders/positions/123') === '/trading/execution/demo/market-close-orders/positions/123',
    'het positionID moet achter het demo-segment blijven staan');
  console.assert(demoPad('/market-data/instruments?instrumentIds=1,2') === '/market-data/instruments?instrumentIds=1,2', 'market-data is niet accountgebonden');
  console.assert(demoPad('/me') === '/me', '/me werkt in beide omgevingen');

  const gooit = (pad: string) => { try { demoPad(pad); return false; } catch { return true; } };
  console.assert(gooit('/trading/positions/1'), 'de PATCH op posities is niet geverifieerd en moet dus gooien');
  console.assert(gooit('/trading/execution/close-orders/1'), 'een onbekend schrijfpad moet gooien, niet naar het echte account gaan');
  console.assert(gooit('/verzonnen/pad'), 'een onbekend pad moet gooien');
  console.assert(gooit('/messages'), 'een pad dat toevallig met /me begint mag niet op de /me-regel vallen');
  console.assert(gooit('/trading/info/portfolio-extra'), 'een treffer moet op een padgrens eindigen');
  console.assert(demoPad('/me?veld=1') === '/me?veld=1', 'een querystring direct achter een exacte treffer blijft goed');

  // ---------- Statusduiding ----------
  console.assert(duidOrderStatus(200) === 'ok' && duidOrderStatus(201) === 'ok' && duidOrderStatus(202) === 'ok', '2xx is uitgevoerd');
  console.assert(duidOrderStatus(400) === 'fout', '400 is afgewezen door eToro, dus zeker niet uitgevoerd');
  console.assert(duidOrderStatus(422) === 'fout', '422 is afgewezen');
  console.assert(duidOrderStatus(429) === 'fout', '429 is afgewezen, niet onbekend: eToro heeft de order niet aangenomen');
  console.assert(duidOrderStatus(500) === 'onbekend', '500 kan uitgevoerd zijn');
  console.assert(duidOrderStatus(502) === 'onbekend', '502 kan uitgevoerd zijn');

  // ---------- Scopes ----------
  console.assert(magHandelenVolgensScopes(['trading']) === true, 'een schrijfscope ontgrendelt handelen');
  console.assert(magHandelenVolgensScopes(['trading.read']) === false, 'een leesscope ontgrendelt niets');
  console.assert(magHandelenVolgensScopes(['read']) === false, 'alleen lezen is niet handelen');
  console.assert(magHandelenVolgensScopes([]) === false, 'geen scopes is niet handelen');
  console.assert(magHandelenVolgensScopes(undefined) === false, 'een ontbrekend scopes-veld is niet handelen');

  if (missers > 0) {
    console.error(`etoro.ts self-check GEFAALD: ${missers} controle(s) klopten niet`);
    process.exit(1);
  }
  console.log('etoro.ts self-check geslaagd');
}
