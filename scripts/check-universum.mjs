// Controleert of elke coin in STANDAARD_UNIVERSUM (na alias-mapping) nog een
// live USDT-spotpaar heeft op Binance. Tickers worden af en toe hernoemd
// (bv. MATIC -> POL); dit script vangt dat voordat een coin stil wegvalt.
//
// Gebruik: node scripts/check-universum.mjs

import { readFileSync } from 'node:fs';

const analyzerSrc = readFileSync(new URL('../app/src/engine/analyzer.ts', import.meta.url), 'utf8');
const marketDataSrc = readFileSync(new URL('../app/src/engine/marketData.ts', import.meta.url), 'utf8');

function extractArray(src, name) {
  const m = src.match(new RegExp(`${name}[\\s\\S]*?\\[([\\s\\S]*?)\\];`));
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

const universum = extractArray(analyzerSrc, 'STANDAARD_UNIVERSUM');
const alias = extractAliasMap(marketDataSrc);

const res = await fetch('https://data-api.binance.vision/api/v3/exchangeInfo');
const data = await res.json();
const live = new Set(
  data.symbols.filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT').map(s => s.baseAsset),
);

const dood = universum.filter(sym => !live.has(alias[sym] ?? sym));

if (dood.length > 0) {
  console.error(`Dode tickers in STANDAARD_UNIVERSUM (${dood.length}/${universum.length}):`, dood.join(', '));
  console.error('Voeg een alias toe in BINANCE_ALIAS (marketData.ts) of verwijder de coin uit STANDAARD_UNIVERSUM.');
  process.exit(1);
}

console.log(`OK: alle ${universum.length} coins hebben een live Binance USDT-paar.`);
