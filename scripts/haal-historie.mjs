// Haalt eenmalig de historische marktdata op die de backtest nodig heeft en dumpt die naar
// data/historie/. Dumpen in plaats van live fetchen, zodat de backtest herhaalbaar en offline
// draait: je kunt vijftig modelvarianten doorrekenen zonder Binance te bestoken, en twee runs
// van hetzelfde model geven gegarandeerd hetzelfde antwoord.
//
// Per coin uit STANDAARD_UNIVERSUM: dagcandles van Binance (gratis, geen sleutel), via
// startTime-paginatie omdat Binance er maximaal 1000 per request geeft.
// Plus de volledige Fear & Greed-historie van alternative.me, nodig om de regime-hypothese
// historisch te kunnen toetsen.
//
// Bewust alleen Binance: de CoinGecko-fallback in de app levert 4-uurs candles met volume 0,
// dat zou timeframes en volumesignalen door elkaar husselen.
//
// Gebruik: node scripts/haal-historie.mjs [aantal_jaren]   (default 3)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HIER, '..', 'data', 'historie');
const HOST = 'https://data-api.binance.vision';
const DAG_MS = 24 * 60 * 60 * 1000;
const JAREN = Number(process.argv[2] ?? 3);

const lees = pad => readFileSync(new URL(pad, import.meta.url), 'utf8');

function extractArray(src, name) {
  const m = src.match(new RegExp(`${name}[\\s\\S]*?\\[([\\s\\S]*?)\\]\\s*\\)?;`));
  if (!m) throw new Error(`Kon ${name} niet vinden`);
  return [...m[1].matchAll(/'([A-Z0-9]+)'/g)].map(x => x[1]);
}

function extractAliasMap(src) {
  const m = src.match(/BINANCE_ALIAS[\s\S]*?\{([\s\S]*?)\};/);
  if (!m) throw new Error('Kon BINANCE_ALIAS niet vinden');
  const map = {};
  for (const [, from, to] of m[1].matchAll(/(\w+):\s*'(\w+)'/g)) map[from] = to;
  return map;
}

const universum = extractArray(lees('../app/src/engine/analyzer.ts'), 'STANDAARD_UNIVERSUM');
const alias = extractAliasMap(lees('../app/src/engine/marketData.ts'));

async function haalJson(url, pogingen = 3) {
  for (let i = 0; i < pogingen; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

// Binance-kline: [openTijd, open, high, low, close, volume, sluitTijd, quoteVolume,
//                 aantalTrades, takerBuyBaseVolume, takerBuyQuoteVolume, ignore]
// De app leest nu alleen index 0 t/m 5. We bewaren hier ook 8 en 9: aantal trades en
// taker-buy-volume (de agressieve kopers). Die zitten al gratis in elke respons en zijn
// de basis voor het koopdruk-signaal in fase 1, dus ze nu meenemen scheelt later een
// volledige nieuwe download.
function naarCandle(row) {
  const volume = Number(row[5]);
  const takerBuy = Number(row[9]);
  return {
    tijd: row[0],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume,
    trades: Number(row[8]),
    takerBuyVolume: takerBuy,
    // Aandeel van het volume dat door agressieve kopers werd weggehaald. 0.5 is neutraal.
    takerBuyRatio: volume > 0 ? takerBuy / volume : 0.5,
  };
}

async function haalCandles(symbool) {
  const paar = `${alias[symbool] ?? symbool}USDT`;
  const vanaf = Date.now() - JAREN * 365 * DAG_MS;
  const candles = [];
  let startTime = vanaf;

  for (;;) {
    const url = `${HOST}/api/v3/klines?symbol=${paar}&interval=1d&limit=1000&startTime=${startTime}`;
    const rows = await haalJson(url);
    if (!rows || rows.length === 0) break;

    for (const row of rows) candles.push(naarCandle(row));

    if (rows.length < 1000) break;
    startTime = rows[rows.length - 1][0] + DAG_MS;
  }

  // De laatste candle is de dag van vandaag en dus nog niet gesloten. Een backtest die op een
  // halve candle handelt meet zichzelf voor de gek, dus die gooien we weg.
  const laatste = candles[candles.length - 1];
  if (laatste && Date.now() - laatste.tijd < DAG_MS) candles.pop();

  return candles;
}

mkdirSync(DATA_DIR, { recursive: true });

let gelukt = 0;
const mislukt = [];

for (const symbool of universum) {
  const candles = await haalCandles(symbool);
  if (candles.length === 0) {
    mislukt.push(symbool);
    console.warn(`  ${symbool}: geen data`);
    continue;
  }
  writeFileSync(join(DATA_DIR, `${symbool}.json`), JSON.stringify(candles));
  const van = new Date(candles[0].tijd).toISOString().slice(0, 10);
  const tot = new Date(candles[candles.length - 1].tijd).toISOString().slice(0, 10);
  console.log(`  ${symbool.padEnd(6)} ${String(candles.length).padStart(4)} candles  ${van} .. ${tot}`);
  gelukt++;
}

// Fear & Greed: limit=0 geeft de volledige historie sinds 2018, gratis en zonder sleutel.
const fng = await haalJson('https://api.alternative.me/fng/?limit=0&format=json');
if (fng?.data) {
  // Sleutel op datum (YYYY-MM-DD) zodat de backtest per candle kan opzoeken.
  const perDag = {};
  for (const p of fng.data) {
    const dag = new Date(Number(p.timestamp) * 1000).toISOString().slice(0, 10);
    perDag[dag] = Number(p.value);
  }
  writeFileSync(join(DATA_DIR, '_fng.json'), JSON.stringify(perDag));
  console.log(`\nFear & Greed: ${Object.keys(perDag).length} dagen bewaard.`);
} else {
  console.warn('\nFear & Greed ophalen mislukt. De regime-analyse valt dan terug op alleen de BTC-trend.');
}

console.log(`\nKlaar: ${gelukt}/${universum.length} coins in data/historie/.`);
if (mislukt.length > 0) console.log(`Zonder data: ${mislukt.join(', ')}`);
