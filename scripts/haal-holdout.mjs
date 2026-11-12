// Haalt de dagcandles op van Binance-USDT-paren die NIET in STANDAARD_UNIVERSUM staan, en dumpt
// die naar data/holdout/. Dat is de toetsset van meting O (docs/algoritme-plan.md): de 57 coins
// van de app en de jaren 2023 t/m 2026 zijn in meting M en N al bekeken, dus een nieuwe regel
// kan alleen nog eerlijk getoetst worden op coins die nooit in een meting hebben gezeten.
//
// Ook gedelistte paren (status BREAK): Binance levert hun historie nog, en ze meenemen haalt een
// deel van de overlevingsbias weg die de 57 coins hebben (die staan er allemaal nog).
//
// De filters liggen vast in docs/algoritme-plan.md en staan hieronder letterlijk:
//   - geen stablecoins, fiat, goud of wrapped tokens;
//   - geen leveraged tokens (BTCUP, ETHDOWN, ...);
//   - geen oude of nieuwe ticker van een coin uit het universum (MATIC/POL, FTM/S, ...);
//   - minstens 400 dagcandles;
//   - mediane dagomzet minstens 1 miljoen USDT (eToro noteert alleen liquide coins).
//
// Gebruik (vanuit de repo-root): node scripts/haal-holdout.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HIER, '..', 'data', 'holdout');
const HOST = 'https://data-api.binance.vision';
const DAG_MS = 24 * 60 * 60 * 1000;
const START = Date.UTC(2017, 0, 1);
const MIN_CANDLES = 400;
const MIN_MEDIANE_OMZET = 1_000_000;

const lees = pad => readFileSync(new URL(pad, import.meta.url), 'utf8');
function extractArray(src, name) {
  const m = src.match(new RegExp(`${name}[\\s\\S]*?\\[([\\s\\S]*?)\\]\\s*\\)?;`));
  if (!m) throw new Error(`Kon ${name} niet vinden`);
  return [...m[1].matchAll(/'([A-Z0-9]+)'/g)].map(x => x[1]);
}
const universum = new Set(extractArray(lees('../app/src/engine/analyzer.ts'), 'STANDAARD_UNIVERSUM'));

// Oude en nieuwe tickers van coins die al in het universum zitten.
const ZELFDE_COIN = new Set(['POL', 'S', 'SKY', 'RENDER', 'BCC', 'BCHABC', 'VEN', 'LEND', 'BTCB', 'BNSOL']);
const STABIEL_OF_FIAT = new Set([
  'USDC', 'BUSD', 'TUSD', 'PAX', 'USDP', 'USDS', 'USDSB', 'DAI', 'FDUSD', 'UST', 'USTC', 'USDE', 'USD1',
  'PYUSD', 'XUSD', 'AEUR', 'EUR', 'EURI', 'GBP', 'AUD', 'TRY', 'BRL', 'RUB', 'BIDR', 'IDRT', 'NGN',
  'UAH', 'ZAR', 'BKRW', 'BVND', 'SUSD', 'USDSOLD', 'PAXG', 'XAUT', 'WBTC', 'WBETH', 'BETH', 'STETH',
  'RLUSD', 'BFUSD', 'USDT',
]);
const HEFBOOM = /^(.+)(UP|DOWN|BULL|BEAR)$/;

async function haalJson(url, pogingen = 4) {
  for (let i = 0; i < pogingen; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 3000 * (i + 1))); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  return null;
}

const naarCandle = row => {
  const volume = Number(row[5]);
  const takerBuy = Number(row[9]);
  return {
    tijd: row[0], open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]),
    volume, quoteVolume: Number(row[7]), trades: Number(row[8]), takerBuyVolume: takerBuy,
    takerBuyRatio: volume > 0 ? takerBuy / volume : 0.5,
  };
};

async function haalCandles(paar) {
  const candles = [];
  let startTime = START;
  for (;;) {
    const rows = await haalJson(`${HOST}/api/v3/klines?symbol=${paar}&interval=1d&limit=1000&startTime=${startTime}`);
    if (!rows || rows.length === 0) break;
    for (const row of rows) candles.push(naarCandle(row));
    if (rows.length < 1000) break;
    startTime = rows[rows.length - 1][0] + DAG_MS;
  }
  const laatste = candles[candles.length - 1];
  if (laatste && Date.now() - laatste.tijd < DAG_MS) candles.pop();
  return candles;
}

const info = await haalJson(`${HOST}/api/v3/exchangeInfo?permissions=SPOT`);
if (!info) throw new Error('exchangeInfo ophalen mislukt');
const alleBases = new Set(info.symbols.map(s => s.baseAsset));
const kandidaten = info.symbols
  .filter(s => s.quoteAsset === 'USDT')
  .filter(s => {
    const b = s.baseAsset;
    if (universum.has(b) || ZELFDE_COIN.has(b) || STABIEL_OF_FIAT.has(b)) return false;
    const m = b.match(HEFBOOM);
    if (m && alleBases.has(m[1])) return false;
    return true;
  });

mkdirSync(DATA_DIR, { recursive: true });
const verslag = { bewaard: [], teKort: [], teDun: [], leeg: [] };
let k = 0;
for (const s of kandidaten) {
  k++;
  const candles = await haalCandles(s.symbol);
  if (candles.length === 0) { verslag.leeg.push(s.baseAsset); continue; }
  if (candles.length < MIN_CANDLES) { verslag.teKort.push(s.baseAsset); continue; }
  const omzet = candles.map(c => c.quoteVolume).sort((a, b) => a - b)[Math.floor(candles.length / 2)];
  if (omzet < MIN_MEDIANE_OMZET) { verslag.teDun.push(s.baseAsset); continue; }
  writeFileSync(join(DATA_DIR, `${s.baseAsset}.json`), JSON.stringify(candles));
  verslag.bewaard.push({ coin: s.baseAsset, status: s.status, n: candles.length,
    van: new Date(candles[0].tijd).toISOString().slice(0, 10), tot: new Date(candles.at(-1).tijd).toISOString().slice(0, 10) });
  if (k % 25 === 0) console.log(`  ${k}/${kandidaten.length} bekeken, ${verslag.bewaard.length} bewaard`);
}
writeFileSync(join(DATA_DIR, '_verslag.json'), JSON.stringify(verslag, null, 1));
const gedelist = verslag.bewaard.filter(x => x.status !== 'TRADING').length;
console.log(`\nKlaar: ${verslag.bewaard.length} coins bewaard (${gedelist} gedelist), ${verslag.teKort.length} te kort, ${verslag.teDun.length} te dun, ${verslag.leeg.length} zonder data.`);
