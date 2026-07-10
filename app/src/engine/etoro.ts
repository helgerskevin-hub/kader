import { PortfolioTrade, nieuweId } from '../state/portfolioTypes';
import { ETORO_TRADABLE } from './opportunities';
import { COIN_INFO } from './coinInfo';

const BASIS_URL = 'https://public-api.etoro.com/api/v1';
const HTTP_TIMEOUT = 15_000;

// eToro valideert X-Request-Id als een echt GUID; nieuweId() (base36) volstaat niet.
function guid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface EtoroSleutels {
  apiKey: string;
  userKey: string;
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

async function etoroFetch<T>(pad: string, sleutels: EtoroSleutels): Promise<T> {
  const res = await Promise.race([
    fetch(`${BASIS_URL}${pad}`, {
      headers: {
        'x-api-key': sleutels.apiKey,
        'x-user-key': sleutels.userKey,
        'x-request-id': guid(),
        'Accept': 'application/json',
      },
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), HTTP_TIMEOUT)),
  ]) as Response;
  if (res.status === 401 || res.status === 403) throw new Error('Ongeldige API-sleutel. Controleer je sleutel bij Instellingen.');
  if (res.status === 429) throw new Error('Te veel aanvragen bij eToro. Probeer het over een minuut opnieuw.');
  if (!res.ok) {
    // ponytail: foutbody meesturen ipv alleen de statuscode, anders is de oorzaak niet te achterhalen
    const body = await res.text().catch(() => '');
    throw new Error(`eToro gaf een fout terug (${res.status}).${body ? ' ' + body.slice(0, 500) : ''}`);
  }
  return res.json() as Promise<T>;
}

// Pad geverifieerd tegen eToro's publieke API (real-account). Demo zou /trading/info/demo/portfolio
// zijn; wij gaan uit van een Real + Read-sleutel.
export async function haalEtoroPortfolio(sleutels: EtoroSleutels): Promise<EtoroPortfolioRespons> {
  return etoroFetch<EtoroPortfolioRespons>('/trading/info/portfolio', sleutels);
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

// ---------- Gesloten posities (trade-historie) ----------

// Let op: deze endpoint levert `positionId` (kleine d), terwijl /trading/info/portfolio
// `positionID` gebruikt. We lezen beide varianten uit zodat een casing-wijziging aan
// eToro's kant ons niet stilzwijgend de historie kost.
interface EtoroHistorieRegel {
  positionId?: number;
  positionID?: number;
  closeRate?: number;
  closeTimestamp?: string;
  netProfit?: number;
}

export interface EtoroSluiting {
  positionID: number;
  exitPrijs: number;   // closeRate
  slotTijd: number;    // closeTimestamp als epoch ms
  netProfit: number;   // bepaalt gewonnen/verloren, inclusief fees
}

export function naarSluiting(regel: EtoroHistorieRegel): EtoroSluiting | null {
  const positionID = regel.positionId ?? regel.positionID;
  const slotTijd = regel.closeTimestamp ? Date.parse(regel.closeTimestamp) : NaN;
  if (typeof positionID !== 'number' || typeof regel.closeRate !== 'number' || isNaN(slotTijd)) return null;
  return { positionID, exitPrijs: regel.closeRate, slotTijd, netProfit: regel.netProfit ?? 0 };
}

// ponytail: vast venster van 1 jaar en één pagina van 1000. PortfolioTrade.datum is een
// gelokaliseerde string ("15 jan 2026") en dus niet te parsen tot een scherpere ondergrens.
// Pagineer pas als iemand meer dan 1000 trades per jaar sluit.
const HISTORIE_VENSTER_MS = 365 * 24 * 60 * 60 * 1000;

export async function haalEtoroSluitingen(sleutels: EtoroSleutels): Promise<EtoroSluiting[]> {
  const minDate = new Date(Date.now() - HISTORIE_VENSTER_MS).toISOString().slice(0, 10);
  const data = await etoroFetch<EtoroHistorieRegel[] | { trades?: EtoroHistorieRegel[] }>(
    `/trading/info/trade/history?minDate=${minDate}&page=1&pageSize=1000`,
    sleutels,
  );
  const lijst = Array.isArray(data) ? data : (data.trades ?? []);
  return lijst.map(naarSluiting).filter((s): s is EtoroSluiting => s !== null);
}

export interface EtoroOvergeslagenPositie {
  naam: string;
  reden: 'short' | 'geen-crypto';
}

export interface EtoroImportResultaat {
  trades: PortfolioTrade[];
  overgeslagen: EtoroOvergeslagenPositie[];
}

export async function importeerEtoroPortfolio(sleutels: EtoroSleutels): Promise<EtoroImportResultaat> {
  const portfolio = await haalEtoroPortfolio(sleutels);
  const posities = portfolio.clientPortfolio?.positions ?? [];
  const [instrumentKaart, cryptoTypeIds] = await Promise.all([
    haalInstrumenten([...new Set(posities.map(p => p.instrumentID))], sleutels),
    haalCryptoTypeIds(sleutels),
  ]);

  const trades: PortfolioTrade[] = [];
  const overgeslagen: EtoroOvergeslagenPositie[] = [];

  for (const positie of posities) {
    const instrument = instrumentKaart.get(positie.instrumentID);
    const symbool = symboolVan(instrument);
    const naam = instrument?.instrumentDisplayName || symbool || `instrument ${positie.instrumentID}`;
    // Alleen filteren op instrumentType als de herkenning is gelukt; anders (null) niet gokken (zie haalCryptoTypeIds).
    const isCrypto = !cryptoTypeIds || (instrument?.instrumentTypeID !== undefined && cryptoTypeIds.has(instrument.instrumentTypeID))
      || ETORO_TRADABLE.has(symbool);

    if (!positie.isBuy) { overgeslagen.push({ naam, reden: 'short' }); continue; }
    if (!symbool || !isCrypto) { overgeslagen.push({ naam, reden: 'geen-crypto' }); continue; }
    trades.push(naarPortfolioTrade(positie, symbool));
  }

  return { trades, overgeslagen };
}

// ponytail: self-check ipv testframework, run met `npx ts-node app/src/engine/etoro.ts`
if (require.main === module) {
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

  // Historie: beide casings van positionId, en het teken van netProfit.
  const winst = naarSluiting({ positionId: 123, closeRate: 65000, closeTimestamp: '2026-02-01T12:00:00Z', netProfit: 150 });
  console.assert(winst?.positionID === 123, 'positionId (kleine d) moet gelezen worden');
  console.assert(winst?.exitPrijs === 65000, 'closeRate moet exitPrijs worden');
  console.assert(winst?.slotTijd === Date.parse('2026-02-01T12:00:00Z'), 'closeTimestamp moet epoch ms worden');
  console.assert(winst!.netProfit >= 0, 'positieve netProfit is winst');

  const oudeCasing = naarSluiting({ positionID: 9, closeRate: 100, closeTimestamp: '2026-02-01T12:00:00Z', netProfit: -5 });
  console.assert(oudeCasing?.positionID === 9, 'positionID (hoofdletter D) moet ook gelezen worden');
  console.assert(oudeCasing!.netProfit < 0, 'negatieve netProfit is verlies');

  const zonderProfit = naarSluiting({ positionId: 1, closeRate: 100, closeTimestamp: '2026-02-01T12:00:00Z' });
  console.assert(zonderProfit?.netProfit === 0, 'ontbrekende netProfit moet 0 worden');

  console.assert(naarSluiting({ closeRate: 1, closeTimestamp: '2026-02-01T12:00:00Z' }) === null, 'regel zonder positionId is onbruikbaar');
  console.assert(naarSluiting({ positionId: 1, closeTimestamp: '2026-02-01T12:00:00Z' }) === null, 'regel zonder closeRate is onbruikbaar');
  console.assert(naarSluiting({ positionId: 1, closeRate: 1, closeTimestamp: 'onzin' }) === null, 'onparseerbare closeTimestamp is onbruikbaar');

  console.log('etoro.ts self-check geslaagd');
}
