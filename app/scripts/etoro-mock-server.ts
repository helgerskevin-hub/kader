// Nep-eToro voor de emulator. GEEN app-code: de app importeert dit nooit, en een release-build kan
// er niet bij (zie MOCK_URL in src/engine/etoro.ts, alleen actief als __DEV__ waar is).
//
// Doel: de Copy-tab, de kooporder en de koppelwizard van begin tot eind doorlopen zonder echte
// eToro-sleutel. De vormen van de antwoorden volgen wat de parsers in src/engine/etoro.ts en
// src/engine/etoroTraders.ts verwachten; waar die zelf nog niet gemeten zijn, is dit ook een gok.
//
// Draaien (vanuit app/):
//   npx tsx scripts/etoro-mock-server.ts            (poort 8787, of PORT=...)
// en Metro starten met:
//   EXPO_PUBLIC_ETORO_MOCK_URL=http://10.0.2.2:8787/api npx expo start
// 10.0.2.2 is vanuit de Android-emulator de Mac zelf.
//
// Sleutels in de wizard: elke niet-lege waarde werkt. API-sleutel "fout" geeft een 401, zodat de
// foutmelding van de wizard ook te zien is.
//
// Beheer (alles POST, behalve stand; parameters in de querystring):
//   /__mock/nieuwe-trade?trader=naam&symbool=BTC&koersDelta=0.03[&stop=..&doel=..&hefboom=1&short=1]
//       De trader opent een positie. koersDelta 0.03 = zijn instap ligt 3% onder de huidige koers,
//       dus Kader hoort "te laat" te zeggen. 0 = net geopend, kopieerbaar.
//   /__mock/sluit-trade?trader=naam&symbool=BTC   (of &positionId=...)
//   /__mock/leeg-portfolio?trader=naam&keer=1     volgende N live-portfolio's van die trader leeg
//   /__mock/copy-uitkomst?modus=gelukt|mislukt|leeg|bezig   hoe /trading/copy/{ref} antwoordt
//   /__mock/fout?pad=/trading/execution/orders&status=500&keer=1   volgende N keer een fout
//   /__mock/reset
//   GET /__mock/stand                             de hele staat als JSON
import http from 'node:http';
import { URL } from 'node:url';

const POORT = Number(process.env.PORT ?? 8787);

// ---------- Instrumenten en koersen ----------

// Kaders 57 coins, met eToro's eigen schrijfwijze waar die afwijkt (zie src/engine/etoroSymbolen.ts).
// BTC en ETH hebben hun echte eToro-id; de rest is doorgenummerd, de app leert ze via de zoekfunctie.
const UNIVERSUM = [
  'BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ETC', 'ADA', 'SOL', 'DOT', 'AVAX', 'ATOM', 'BNB', 'TRX', 'XLM',
  'ALGO', 'VET', 'HBAR', 'XTZ', 'NEAR', 'S', 'ICP', 'FLOW', 'APT', 'SUI', 'INJ', 'SEI', 'POL', 'OP',
  'ARB', 'LINK', 'UNI', 'AAVE', 'COMP', 'SKY', 'SNX', 'YFI', 'CRV', 'SUSHI', '1INCH', 'ZRX', 'GRT',
  'ENJ', 'MANA', 'SAND', 'AXS', 'CHZ', 'GALA', 'IMX', 'DOGE', 'SHIBxM', 'PEPExM', 'FET', 'RENDER',
  'FIL', 'THETA', 'BAT', 'TIA',
];
// Binance-symbool per eToro-symbool, en de factor waarmee eToro de koers voert.
const BINANCE: Record<string, { sym: string; factor: number }> = {
  SHIBxM: { sym: 'SHIB', factor: 1_000_000 },
  PEPExM: { sym: 'PEPE', factor: 1_000_000 },
  RENDER: { sym: 'RENDER', factor: 1 },
};

const CRYPTO_TYPE = 10;
const AANDEEL_TYPE = 5;

interface Instrument { id: number; symbool: string; naam: string; type: number }
const instrumenten: Instrument[] = UNIVERSUM.map((s, i) => ({
  id: 100000 + i,
  symbool: s,
  naam: s === 'BTC' ? 'Bitcoin' : s === 'ETH' ? 'Ethereum' : s,
  type: CRYPTO_TYPE,
}));
// Twee aandelen, voor de trader die geen crypto doet en voor een positie buiten Kader.
instrumenten.push({ id: 1001, symbool: 'AAPL', naam: 'Apple', type: AANDEEL_TYPE });
instrumenten.push({ id: 1002, symbool: 'NVDA', naam: 'NVIDIA', type: AANDEEL_TYPE });
const perId = new Map(instrumenten.map(i => [i.id, i]));
const perSymbool = new Map(instrumenten.map(i => [i.symbool.toUpperCase(), i]));

// Terugval als Binance niet bereikbaar is. Ongeveer november 2026; liever live, want de app haalt
// zijn eigen koers bij Binance en de "te laat"-toets vergelijkt die met de instap hier.
const koersen: Record<string, number> = {
  BTC: 98000, ETH: 3400, SOL: 180, XRP: 2.3, ADA: 0.75, DOGE: 0.28, LINK: 18, AVAX: 32, BNB: 640,
  LTC: 95, DOT: 6.5, SUI: 3.4, AAPL: 230, NVDA: 140,
};

async function ververs(): Promise<void> {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price');
    const lijst = (await res.json()) as { symbol: string; price: string }[];
    const kaart = new Map(lijst.map(r => [r.symbol, Number(r.price)]));
    let n = 0;
    for (const s of UNIVERSUM) {
      const b = BINANCE[s] ?? { sym: s, factor: 1 };
      const p = kaart.get(`${b.sym}USDT`);
      if (p && p > 0) { koersen[s.toUpperCase()] = p * b.factor; n++; }
    }
    console.log(`[koers] ${n} koersen van Binance, BTC ${koersen.BTC}`);
  } catch (e) {
    console.log(`[koers] Binance niet bereikbaar, terugvalkoersen blijven staan (${(e as Error).message})`);
  }
}

const koersVan = (symbool: string): number | null => koersen[symbool.toUpperCase()] ?? null;

// ---------- Traders ----------

interface TraderPositie {
  positionId: number;
  openTimestamp: string;
  openRate: number;
  instrumentId: number;
  isBuy: boolean;
  leverage: number;
  takeProfitRate?: number;
  stopLossRate?: number;
  investmentPct: number;
  netProfit: number;
  parentPositionId?: number;
  socialTradeId?: number;
}

interface Trader {
  rij: Record<string, unknown> & { cid: number; username: string };
  posities: TraderPositie[];
  maanden: number[]; // fracties
}

let volgendPositieId = 9_000_000_001;
const isoUrenGeleden = (uur: number) => new Date(Date.now() - uur * 3600_000).toISOString();

function positie(symbool: string, delta: number, opties: Partial<TraderPositie> & { urenGeleden?: number } = {}): TraderPositie {
  const instr = perSymbool.get(symbool.toUpperCase());
  if (!instr) throw new Error(`onbekend symbool ${symbool}`);
  const nu = koersVan(symbool) ?? 1;
  const openRate = nu / (1 + delta);
  return {
    positionId: volgendPositieId++,
    openTimestamp: isoUrenGeleden(opties.urenGeleden ?? 48),
    openRate: rond(openRate),
    instrumentId: instr.id,
    isBuy: opties.isBuy ?? true,
    leverage: opties.leverage ?? 1,
    stopLossRate: opties.stopLossRate ?? rond(openRate * 0.92),
    takeProfitRate: opties.takeProfitRate ?? rond(openRate * 1.2),
    investmentPct: opties.investmentPct ?? 10,
    netProfit: rond(delta * 100, 2),
    parentPositionId: opties.parentPositionId,
    socialTradeId: opties.socialTradeId,
  };
}

const rond = (w: number, d = 8) => Math.round(w * 10 ** d) / 10 ** d;

function maakTraders(): Trader[] {
  const btc = perSymbool.get('BTC')!.id;
  const eth = perSymbool.get('ETH')!.id;
  const sol = perSymbool.get('SOL')!.id;
  // Velden als in de docs: gain als fractie, procenten als 0-100. Gekozen zodat alle drie de
  // oordelen voorkomen; de verwachte uitkomst staat erbij en wordt bij het opstarten nagerekend.
  const basis = (cid: number, username: string, fullName: string, v: Record<string, unknown>) => ({
    cid, username, fullName, type: 'trader', avatarUrl: '', weeksSinceRegistration: 200,
    topTradedAssetClassId: CRYPTO_TYPE, topTradedInstrumentId: btc, trades: 300, longPosPct: 95, ...v,
  });
  return [
    {
      // Rustig en consistent: KOPIEER.
      rij: basis(5001, 'RustigeRik', 'Rik de Vries', { gain: 0.42, riskScore: 3, copiers: 5400, peakToValley: -0.12, winRatio: 68, profitableMonthsPct: 83, profitableWeeksPct: 64, highLeveragePct: 0, topTradedInstrumentPct: 22 }),
      posities: [positie('BTC', 0.04, { urenGeleden: 300 }), positie('ETH', -0.02, { urenGeleden: 120 }), positie('SOL', 0.01, { urenGeleden: 30 })],
      maanden: [0.04, 0.03, -0.01, 0.05, 0.02, 0.03, 0.04, -0.02, 0.06, 0.03, 0.02, 0.04],
    },
    {
      rij: basis(5002, 'CryptoCor', 'Cor Jansen', { gain: 0.65, riskScore: 4, copiers: 3100, peakToValley: -0.18, winRatio: 61, profitableMonthsPct: 75, profitableWeeksPct: 58, highLeveragePct: 0, topTradedInstrumentPct: 30, topTradedInstrumentId: eth }),
      posities: [positie('ETH', 0.05, { urenGeleden: 200 }), positie('LINK', 0.0, { urenGeleden: 2 })],
      maanden: [0.06, -0.03, 0.08, 0.04, 0.05, -0.02, 0.07, 0.03, 0.02, 0.06, -0.01, 0.05],
    },
    {
      // Middelmatig: VOLG.
      rij: basis(5003, 'SolanaSanne', 'Sanne Bakker', { gain: 0.31, riskScore: 5, copiers: 1200, peakToValley: -0.28, winRatio: 55, profitableMonthsPct: 58, profitableWeeksPct: 52, highLeveragePct: 5, topTradedInstrumentPct: 45, topTradedInstrumentId: sol }),
      posities: [positie('SOL', 0.08, { urenGeleden: 400 }), positie('SUI', -0.05, { urenGeleden: 72 })],
      maanden: [0.09, -0.06, 0.12, -0.04, 0.05, -0.08, 0.1, 0.02, -0.03, 0.07, -0.05, 0.06],
    },
    {
      rij: basis(5004, 'AltcoinAnouk', 'Anouk Visser', { gain: 0.22, riskScore: 6, copiers: 800, peakToValley: -0.33, winRatio: 52, profitableMonthsPct: 58, profitableWeeksPct: 50, highLeveragePct: 10, topTradedInstrumentPct: 35 }),
      posities: [positie('ADA', 0.02), positie('DOT', -0.04), positie('AVAX', 0.03)],
      maanden: [0.05, -0.07, 0.08, 0.03, -0.05, 0.04, -0.06, 0.09, 0.02, -0.03, 0.04, 0.01],
    },
    {
      // Hefboom en shorts: VERMIJD, en "Kopieer alles" hoort geweigerd te worden.
      rij: basis(5005, 'HefboomHenk', 'Henk Smit', { gain: 0.95, riskScore: 6, copiers: 2600, peakToValley: -0.55, winRatio: 48, profitableMonthsPct: 42, profitableWeeksPct: 47, highLeveragePct: 70, topTradedInstrumentPct: 80, longPosPct: 40 }),
      posities: [
        positie('BTC', 0.02, { leverage: 5, urenGeleden: 10 }),
        positie('ETH', -0.01, { isBuy: false, leverage: 2, urenGeleden: 20 }),
        positie('XRP', 0.03, { leverage: 10, urenGeleden: 5 }),
      ],
      maanden: [0.3, -0.25, 0.4, -0.2, 0.15, -0.3, 0.5, -0.1, 0.2, -0.35, 0.25, 0.1],
    },
    {
      // Doet vooral aan kopiëren en heeft een aandeel: alleen BTC is een eigen beslissing.
      rij: basis(5006, 'KopieerKim', 'Kim de Boer', { gain: 0.18, riskScore: 4, copiers: 400, peakToValley: -0.15, winRatio: 60, profitableMonthsPct: 67, profitableWeeksPct: 55, highLeveragePct: 0, topTradedInstrumentPct: 25 }),
      posities: [
        positie('BTC', 0.01, { urenGeleden: 100 }),
        positie('ETH', 0.02, { parentPositionId: 777001, urenGeleden: 100 }),
        { ...positie('BTC', 0.0), instrumentId: 1002, openRate: koersen.NVDA, stopLossRate: undefined, takeProfitRate: undefined },
      ],
      maanden: [0.02, 0.01, 0.03, -0.01, 0.02, 0.01, 0.02, 0.01, -0.02, 0.03, 0.01, 0.02],
    },
    {
      // Valt af op de drempels: te nieuw.
      rij: basis(5007, 'NieuweNina', 'Nina Peters', { gain: 1.2, riskScore: 5, copiers: 150, peakToValley: -0.2, profitableMonthsPct: 80, weeksSinceRegistration: 20 }),
      posities: [positie('DOGE', 0.1)],
      maanden: [0.2, 0.1, 0.15],
    },
    {
      // Valt af: geen crypto.
      rij: basis(5008, 'AandelenAad', 'Aad Mulder', { gain: 0.25, riskScore: 3, copiers: 9000, peakToValley: -0.1, profitableMonthsPct: 80, topTradedAssetClassId: AANDEEL_TYPE, topTradedInstrumentId: 1001 }),
      posities: [{ ...positie('BTC', 0), instrumentId: 1001, openRate: koersen.AAPL }],
      maanden: [0.02, 0.02, 0.01, 0.03, 0.02, 0.01, 0.02, 0.02, 0.01, 0.02, 0.03, 0.02],
    },
  ];
}

// ---------- Je eigen account ----------

interface EigenPositie {
  positionID: number;
  instrumentID: number;
  isBuy: boolean;
  amount: number;
  units: number;
  openRate: number;
  openDateTime: string;
  stopLossRate?: number;
  takeProfitRate?: number;
  orderID?: number;
}

interface Mirror {
  mirrorID: number;
  parentCID: number;
  parentUsername: string;
  initialInvestment: number;
  depositSummary: number;
  withdrawalSummary: number;
  stopLossPercentage: number;
  stopLossAmount: number;
  mirrorStatusID: number;
  positions: unknown[];
  startedCopyDate: string;
}

interface Account {
  credit: number;
  posities: EigenPositie[];
  mirrors: Mirror[];
  historie: Record<string, unknown>[];
  orders: Map<number, { positieId: number; status: number }>;
  // referenceID -> uitkomst van een copy-verzoek, en hoe vaak hij al is opgevraagd.
  copies: Map<string, { parentCID: number; amount: number; opgevraagd: number }>;
}

function nieuwAccount(credit: number): Account {
  const btc = perSymbool.get('BTC')!;
  const prijs = koersVan('BTC')! * 0.97;
  return {
    credit,
    posities: [{
      positionID: 8_000_000_001, instrumentID: btc.id, isBuy: true, amount: 100, units: rond(100 / prijs),
      openRate: rond(prijs, 2), openDateTime: isoUrenGeleden(96), stopLossRate: rond(prijs * 0.9, 2), takeProfitRate: rond(prijs * 1.25, 2),
    }],
    mirrors: [],
    historie: [{
      positionId: 7_000_000_001, instrumentId: perSymbool.get('ETH')!.id, isBuy: true, openRate: 3100, closeRate: 3350,
      openTimestamp: isoUrenGeleden(24 * 40), closeTimestamp: isoUrenGeleden(24 * 30), netProfit: 8.06, units: 0.0322, investment: 100,
      stopLossRate: 2900, takeProfitRate: 3400,
    }],
    orders: new Map(),
    copies: new Map(),
  };
}

// ---------- Staat ----------

let traders: Trader[] = [];
let accounts: Record<'real' | 'demo', Account> = { real: nieuwAccount(250), demo: nieuwAccount(10_000) };
let copyModus: 'gelukt' | 'mislukt' | 'leeg' | 'bezig' = 'gelukt';
const leegTeller = new Map<string, number>();
const foutRegels: { pad: string; status: number; keer: number }[] = [];
let volgendOrderId = 600_000_001;
let volgendMirrorId = 40_000_001;

function reset(): void {
  volgendPositieId = 9_000_000_001;
  traders = maakTraders();
  accounts = { real: nieuwAccount(250), demo: nieuwAccount(10_000) };
  copyModus = 'gelukt';
  leegTeller.clear();
  foutRegels.length = 0;
}

const vindTrader = (naam: string | null) =>
  traders.find(t => t.rij.username.toLowerCase() === (naam ?? '').toLowerCase()) ?? null;

// ---------- HTTP ----------

type Antwoord = { status: number; body?: unknown };
const ok = (body?: unknown): Antwoord => ({ status: 200, body });
const nietGevonden = (bericht = 'Not found'): Antwoord => ({ status: 404, body: { errorCode: 'NotFound', errorMessage: bericht } });

function eigenPortfolio(acc: Account) {
  return {
    clientPortfolio: {
      credit: rond(acc.credit, 2),
      unrealizedPnL: 0,
      positions: acc.posities,
      mirrors: acc.mirrors,
      orders: [], stockOrders: [], entryOrders: [], exitOrders: [],
      ordersForOpen: [], ordersForClose: [], ordersForCloseMultiple: [],
    },
  };
}

// Demo-paden terug naar het echte pad, plus de omgeving. Spiegelt DEMO_PADEN in src/engine/etoro.ts.
function ontleedPad(pad: string): { pad: string; demo: boolean } {
  const regels: [RegExp, string][] = [
    [/^\/trading\/info\/demo\//, '/trading/info/'],
    [/^\/trading\/info\/trade\/demo\/history/, '/trading/info/trade/history'],
    [/^\/trading\/execution\/demo\//, '/trading/execution/'],
    [/^\/trading\/demo\/positions\//, '/trading/positions/'],
    [/^\/trading\/copy\/demo(?=\/|$)/, '/trading/copy'],
  ];
  for (const [re, vervang] of regels) if (re.test(pad)) return { pad: pad.replace(re, vervang), demo: true };
  return { pad, demo: false };
}

function routeer(methode: string, url: URL, body: any, headers: http.IncomingHttpHeaders): Antwoord {
  const m = url.pathname.match(/^\/api\/(v1|v2)(\/.*)$/);
  if (!m) return nietGevonden();
  const { pad, demo } = ontleedPad(m[2]);
  const acc = accounts[demo ? 'demo' : 'real'];
  const q = url.searchParams;

  // Sleutels: alles wat niet leeg is werkt, behalve de api-sleutel "fout".
  const apiKey = String(headers['x-api-key'] ?? '');
  const userKey = String(headers['x-user-key'] ?? '');
  if (!apiKey || !userKey || apiKey === 'fout') return { status: 401, body: { errorCode: 'Unauthorized', errorMessage: 'Unauthorized' } };

  const regel = foutRegels.find(f => f.keer > 0 && pad.startsWith(f.pad));
  if (regel) {
    regel.keer--;
    return { status: regel.status, body: { errorCode: 'Mock', errorMessage: `Nagebootste fout ${regel.status}` } };
  }

  // Account
  if (pad === '/me') {
    return ok({
      gcid: 12345678, realCid: 12345678, demoCid: 87654321, username: 'mocktester',
      scopes: ['etoro-public:trade.real:write', 'etoro-public:trade.demo:write', 'etoro-public:trade.real:read', 'etoro-public:trade.demo:read'],
    });
  }

  // Market data
  if (pad === '/market-data/search') {
    const gezocht = (q.get('internalSymbolFull') ?? '').toUpperCase();
    const i = perSymbool.get(gezocht);
    if (!i) return ok({ items: [] });
    return ok({ items: [
      { internalSymbolFull: i.symbool, instrumentId: i.id, internalAssetClassName: i.type === CRYPTO_TYPE ? 'Crypto' : 'Stocks', isDelisted: false, isBuyEnabled: true, isInternalInstrument: false },
      // Een cross die de app moet negeren, zoals de echte zoekfunctie er ook een paar teruggeeft.
      { internalSymbolFull: `${i.symbool}EUR`, instrumentId: i.id + 50_000, internalAssetClassName: 'Crypto', isBuyEnabled: false },
    ] });
  }
  if (pad === '/market-data/instruments/rates') {
    const ids = (q.get('instrumentIds') ?? '').split(',').map(Number);
    const rates = ids.flatMap(id => {
      const i = perId.get(id);
      const p = i ? koersVan(i.symbool) : null;
      return p ? [{ instrumentID: id, bid: rond(p * 0.9995), ask: rond(p * 1.0005), date: new Date().toISOString() }] : [];
    });
    return ok({ rates });
  }
  if (pad === '/market-data/instruments') {
    const ids = (q.get('instrumentIds') ?? '').split(',').map(Number);
    return ok({ instrumentDisplayDatas: ids.flatMap(id => {
      const i = perId.get(id);
      return i ? [{ instrumentID: i.id, symbolFull: i.symbool, instrumentDisplayName: i.naam, instrumentTypeID: i.type }] : [];
    }) });
  }
  if (pad === '/market-data/instrument-types') {
    return ok({ instrumentTypes: [
      { instrumentTypeID: AANDEEL_TYPE, instrumentTypeDescription: 'Stocks' },
      { instrumentTypeID: CRYPTO_TYPE, instrumentTypeDescription: 'Crypto' },
    ] });
  }

  // Eigen portfolio en historie
  if (pad === '/trading/info/portfolio') return ok(eigenPortfolio(acc));
  if (pad === '/trading/info/trade/history') return ok(acc.historie);
  if (pad === '/trading/info/eligibility' && methode === 'POST') {
    const symbolen: string[] = Array.isArray(body?.symbols) ? body.symbols : [];
    const gevonden = symbolen.filter(s => perSymbool.has(s.toUpperCase()));
    return ok({
      eligibilities: gevonden.map(s => ({
        instrumentId: perSymbool.get(s.toUpperCase())!.id, symbol: s,
        leverageConfigs: [
          { direction: 'Buy', leverageValues: [1], allowEditStopLoss: true, minStopLossPercentage: 1, maxStopLossPercentage: 75, defaultStopLossPercentage: 50 },
          { direction: 'Sell', leverageValues: [1, 2], allowEditStopLoss: true, minStopLossPercentage: 1, maxStopLossPercentage: 50 },
        ],
      })),
      notFoundSymbols: symbolen.filter(s => !perSymbool.has(s.toUpperCase())),
    });
  }
  if (pad === '/trading/info/orders:lookup') {
    const orderId = Number(q.get('orderId'));
    const order = acc.orders.get(orderId);
    // Zoals gemeten: op referenceId kent eToro de order niet.
    if (!order) return nietGevonden('No external operation was found');
    return ok({ orderId, status: { id: order.status, name: order.status === 3 ? 'Filled' : 'Rejected' }, positionExecutions: [{ positionId: order.positieId }] });
  }

  // Orders
  if (pad === '/trading/execution/orders' && methode === 'POST') {
    console.log(`  [ORDER ${demo ? 'DEMO' : 'ECHT'}] ${JSON.stringify(body)}`);
    if (body?.leverage !== 1) console.log('  !!! hefboom is niet 1');
    if (body?.transaction !== 'buy') console.log('  !!! geen koop');
    const i = perId.get(Number(body?.instrumentId));
    const p = i ? koersVan(i.symbool) : null;
    const bedrag = Number(body?.amount);
    if (!i || !p) return { status: 400, body: { errorCode: 'InstrumentNotFound', errorMessage: 'Instrument not found' } };
    if (!(bedrag > 0) || bedrag > acc.credit) return { status: 400, body: { errorCode: 'InsufficientFunds', errorMessage: 'Insufficient funds' } };
    const ask = p * 1.0005;
    const orderId = volgendOrderId++;
    const positionID = volgendPositieId++;
    acc.credit -= bedrag;
    acc.posities.push({
      positionID, instrumentID: i.id, isBuy: true, amount: bedrag, units: rond(bedrag / ask), openRate: rond(ask),
      openDateTime: new Date().toISOString(), stopLossRate: body.stopLossRate, takeProfitRate: body.takeProfitRate, orderID: orderId,
    });
    acc.orders.set(orderId, { positieId: positionID, status: 3 });
    return ok({ orderId, token: `tok-${orderId}` });
  }
  const annuleer = pad.match(/^\/trading\/execution\/orders\/(\d+)$/);
  if (annuleer && methode === 'DELETE') {
    const orderId = Number(annuleer[1]);
    if (!acc.orders.has(orderId)) return nietGevonden();
    return ok({ orderId, referenceId: '' });
  }
  const sluit = pad.match(/^\/trading\/execution\/market-close-orders\/positions\/(\d+)$/);
  if (sluit && methode === 'POST') {
    const id = Number(sluit[1]);
    const idx = acc.posities.findIndex(x => x.positionID === id);
    if (idx === -1) return nietGevonden('Position not found');
    const pos = acc.posities[idx];
    const p = koersVan(perId.get(pos.instrumentID)!.symbool) ?? pos.openRate;
    const opbrengst = pos.units * p * 0.9995;
    acc.posities.splice(idx, 1);
    acc.credit += opbrengst;
    acc.historie.unshift({
      positionId: id, instrumentId: pos.instrumentID, isBuy: true, openRate: pos.openRate, closeRate: rond(p),
      openTimestamp: pos.openDateTime, closeTimestamp: new Date().toISOString(), netProfit: rond(opbrengst - pos.amount, 2),
      units: pos.units, investment: pos.amount, stopLossRate: pos.stopLossRate, takeProfitRate: pos.takeProfitRate,
    });
    const orderID = volgendOrderId++;
    acc.orders.set(orderID, { positieId: id, status: 3 });
    return ok({ orderForClose: { positionID: id, instrumentID: pos.instrumentID, orderID, orderType: 19, statusID: 1 }, token: `tok-${orderID}` });
  }
  const wijzig = pad.match(/^\/trading\/positions\/(\d+)$/);
  if (wijzig && methode === 'PATCH') {
    const pos = acc.posities.find(x => x.positionID === Number(wijzig[1]));
    if (!pos) return nietGevonden('Position not found');
    if (body?.clearStopLoss) pos.stopLossRate = undefined; else if (body?.stopLossRate) pos.stopLossRate = body.stopLossRate;
    if (body?.clearTakeProfit) pos.takeProfitRate = undefined; else if (body?.takeProfitRate) pos.takeProfitRate = body.takeProfitRate;
    return { status: 202, body: { token: 'tok-patch' } };
  }

  // Copy trading (eToro's CopyTrader)
  if (pad === '/trading/copy/eligibility' && methode === 'POST') {
    const bedrag = Number(body?.amount);
    const t = traders.find(x => x.rij.cid === Number(body?.parentCID));
    if (!t) return ok({ isSuccess: false, errorMessage: 'Parent not found' });
    if (bedrag < 200) return ok({ isSuccess: false, errorMessage: 'Minimum copy amount is $200' });
    if (bedrag > acc.credit) return ok({ isSuccess: false, errorMessage: 'Insufficient funds' });
    if (acc.mirrors.some(mi => mi.parentCID === t.rij.cid)) return ok({ isSuccess: false, errorMessage: 'Already copying this user' });
    return ok({ isSuccess: true, errorMessage: null });
  }
  if (pad === '/trading/copy/close' && methode === 'POST') {
    const idx = acc.mirrors.findIndex(mi => mi.mirrorID === Number(body?.mirrorID));
    if (idx === -1) return nietGevonden('Mirror not found');
    acc.credit += acc.mirrors[idx].initialInvestment;
    acc.mirrors.splice(idx, 1);
    return ok({ token: 'tok-close' });
  }
  if (pad === '/trading/copy' && methode === 'POST') {
    console.log(`  [COPY ${demo ? 'DEMO' : 'ECHT'}] ${JSON.stringify(body)}`);
    const ref = String(body?.referenceID ?? '');
    if (!ref) return { status: 400, body: { errorCode: 'BadRequest', errorMessage: 'referenceID missing' } };
    acc.copies.set(ref, { parentCID: Number(body?.parentCID), amount: Number(body?.amount), opgevraagd: 0 });
    return ok({ token: `tok-${ref}` });
  }
  const uitkomst = pad.match(/^\/trading\/copy\/([^/]+)$/);
  if (uitkomst && methode === 'GET') {
    const ref = decodeURIComponent(uitkomst[1]);
    const c = acc.copies.get(ref);
    if (!c) return nietGevonden('Copy request not found');
    c.opgevraagd++;
    // De eerste keer nog geen eindstand, zoals de docs het beschrijven.
    if (copyModus === 'bezig' || c.opgevraagd === 1) return nietGevonden('Pending');
    if (copyModus === 'leeg') return { status: 200 };
    if (copyModus === 'mislukt') return ok({ isSuccess: false, failReason: 'Nagebootst: copy geweigerd' });
    let mi = acc.mirrors.find(x => x.parentCID === c.parentCID);
    if (!mi) {
      const t = traders.find(x => x.rij.cid === c.parentCID);
      mi = {
        mirrorID: volgendMirrorId++, parentCID: c.parentCID, parentUsername: t?.rij.username ?? 'onbekend',
        initialInvestment: c.amount, depositSummary: 0, withdrawalSummary: 0, stopLossPercentage: 40,
        stopLossAmount: rond(c.amount * 0.6, 2), mirrorStatusID: 0, positions: t ? t.posities.slice() : [],
        startedCopyDate: new Date().toISOString(),
      };
      acc.mirrors.push(mi);
      acc.credit -= c.amount;
    }
    return ok({ isSuccess: true, mirrorID: mi.mirrorID });
  }

  // Ranglijst en beleggers (openbaar, dus voor demo en echt gelijk)
  if (pad === '/portfolios/rankings' && methode === 'GET') {
    const pagina = Number(q.get('page') ?? 1);
    const grootte = Number(q.get('pageSize') ?? 100);
    const rijen = traders.map(t => t.rij);
    return ok({ results: rijen.slice((pagina - 1) * grootte, pagina * grootte), pagination: { page: pagina, pageSize: grootte, hasNext: pagina * grootte < rijen.length, totalItems: rijen.length } });
  }
  if (pad === '/portfolios/rankings/multiple' && methode === 'POST') {
    const namen: string[] = Array.isArray(body?.usernames) ? body.usernames : [];
    return ok({ results: namen.flatMap(n => {
      const t = vindTrader(n);
      return t ? [{ username: t.rij.username, value: { ...t.rij } }] : [];
    }) });
  }
  const live = pad.match(/^\/user-info\/people\/([^/]+)\/portfolio\/live$/);
  if (live) {
    const naam = decodeURIComponent(live[1]);
    const t = vindTrader(naam);
    if (!t) return nietGevonden('User not found');
    const leeg = leegTeller.get(t.rij.username) ?? 0;
    if (leeg > 0) {
      leegTeller.set(t.rij.username, leeg - 1);
      console.log(`  [leeg] lege portfolio voor ${t.rij.username}`);
      return ok({ positions: [], socialTrades: [] });
    }
    return ok({ positions: t.posities, socialTrades: [] });
  }
  const maand = pad.match(/^\/portfolios\/([^/]+)\/gain\/monthly$/);
  if (maand) {
    const t = vindTrader(decodeURIComponent(maand[1]));
    if (!t) return nietGevonden('User not found');
    const nu = new Date();
    return ok({ gains: t.maanden.map((g, i) => {
      const d = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() - (t.maanden.length - i), 1));
      return { date: d.toISOString().slice(0, 10), gain: g };
    }) });
  }

  return { status: 404, body: { errorCode: 'RouteNotFound', errorMessage: `Mock kent ${methode} ${pad} niet` }, onbekend: true } as Antwoord;
}

function beheer(methode: string, url: URL): Antwoord | null {
  if (!url.pathname.startsWith('/__mock/')) return null;
  const q = url.searchParams;
  const actie = url.pathname.slice('/__mock/'.length);
  if (actie === 'stand') return ok({ traders, accounts: { real: { ...accounts.real, orders: [...accounts.real.orders], copies: [...accounts.real.copies] }, demo: { ...accounts.demo, orders: [...accounts.demo.orders], copies: [...accounts.demo.copies] } }, copyModus, koersen });
  if (methode !== 'POST') return { status: 405, body: { fout: 'gebruik POST' } };
  if (actie === 'reset') { reset(); return ok({ ok: true }); }
  if (actie === 'nieuwe-trade') {
    const t = vindTrader(q.get('trader'));
    const symbool = (q.get('symbool') ?? 'BTC').toUpperCase();
    if (!t) return { status: 400, body: { fout: 'onbekende trader' } };
    if (!perSymbool.has(symbool)) return { status: 400, body: { fout: 'onbekend symbool' } };
    const delta = Number(q.get('koersDelta') ?? 0);
    const openRate = (koersVan(symbool) ?? 1) / (1 + delta);
    const p = positie(symbool, delta, {
      urenGeleden: 0,
      leverage: Number(q.get('hefboom') ?? 1),
      isBuy: q.get('short') !== '1',
      stopLossRate: q.has('stop') ? Number(q.get('stop')) : rond(openRate * 0.93),
      takeProfitRate: q.has('doel') ? Number(q.get('doel')) : rond(openRate * 1.15),
    });
    t.posities.push(p);
    return ok(p);
  }
  if (actie === 'sluit-trade') {
    const t = vindTrader(q.get('trader'));
    if (!t) return { status: 400, body: { fout: 'onbekende trader' } };
    const id = q.get('positionId');
    const instr = perSymbool.get((q.get('symbool') ?? '').toUpperCase());
    // Zonder positionId de nieuwste positie in dat symbool: meestal de trade die je net liet openen.
    const idx = id ? t.posities.findIndex(p => p.positionId === Number(id)) : t.posities.findLastIndex(p => p.instrumentId === instr?.id);
    if (idx === -1) return { status: 400, body: { fout: 'geen positie gevonden' } };
    return ok(t.posities.splice(idx, 1)[0]);
  }
  if (actie === 'leeg-portfolio') {
    const t = vindTrader(q.get('trader'));
    if (!t) return { status: 400, body: { fout: 'onbekende trader' } };
    leegTeller.set(t.rij.username, Number(q.get('keer') ?? 1));
    return ok({ ok: true });
  }
  if (actie === 'copy-uitkomst') {
    const modus = q.get('modus');
    if (modus !== 'gelukt' && modus !== 'mislukt' && modus !== 'leeg' && modus !== 'bezig') return { status: 400, body: { fout: 'modus: gelukt|mislukt|leeg|bezig' } };
    copyModus = modus;
    return ok({ copyModus });
  }
  if (actie === 'fout') {
    foutRegels.push({ pad: q.get('pad') ?? '/', status: Number(q.get('status') ?? 500), keer: Number(q.get('keer') ?? 1) });
    return ok({ foutRegels });
  }
  return { status: 404, body: { fout: `onbekende beheeractie ${actie}` } };
}

const server = http.createServer((req, res) => {
  const delen: Buffer[] = [];
  req.on('data', d => delen.push(d));
  req.on('end', () => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const methode = req.method ?? 'GET';
    const ruw = Buffer.concat(delen).toString('utf8');
    let body: unknown;
    try { body = ruw ? JSON.parse(ruw) : undefined; } catch { body = ruw; }

    let antwoord: Antwoord & { onbekend?: boolean };
    try {
      antwoord = beheer(methode, url) ?? routeer(methode, url, body, req.headers);
    } catch (e) {
      antwoord = { status: 500, body: { errorCode: 'MockCrash', errorMessage: (e as Error).message } };
    }
    const tijd = new Date().toISOString().slice(11, 19);
    const regel = `${tijd} ${methode} ${url.pathname}${url.search} -> ${antwoord.status}`;
    if (antwoord.onbekend) console.log(`\n!!!!! ONBEKEND PAD !!!!! ${regel}\n`);
    else console.log(regel);

    res.statusCode = antwoord.status;
    if (antwoord.body === undefined) { res.end(); return; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(antwoord.body));
  });
});

async function start(): Promise<void> {
  await ververs();
  reset();
  // De app haalt elke minuut verse koersen bij Binance; hier ook, zodat "te laat" klopt.
  setInterval(() => { ververs().catch(() => {}); }, 60_000);
  server.listen(POORT, () => {
    console.log(`Nep-eToro luistert op http://localhost:${POORT}/api (emulator: http://10.0.2.2:${POORT}/api)`);
    console.log(`Traders: ${traders.map(t => t.rij.username).join(', ')}`);
  });
}

start();
