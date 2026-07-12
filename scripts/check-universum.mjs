// Twee controles op de coin-lijsten:
//
//  1. Heeft elke coin in STANDAARD_UNIVERSUM (na alias-mapping) nog een live USDT-spotpaar op
//     Binance? Tickers worden af en toe hernoemd (bv. MATIC -> POL); dit vangt dat voordat een
//     coin stil wegvalt uit de marktscan.
//  2. Is STANDAARD_UNIVERSUM een deelverzameling van ETORO_TRADABLE? Analyseren wat je op eToro
//     niet kunt kopen is zinloos, en de twee lijsten zijn bewust apart (TON staat wel in
//     ETORO_TRADABLE maar heeft geen Binance-paar), dus ze moeten actief bewaakt worden.
//
// Gebruik: node scripts/check-universum.mjs

import { readFileSync } from 'node:fs';

const lees = pad => readFileSync(new URL(pad, import.meta.url), 'utf8');
const analyzerSrc = lees('../app/src/engine/analyzer.ts');
const marketDataSrc = lees('../app/src/engine/marketData.ts');
const opportunitiesSrc = lees('../app/src/engine/opportunities.ts');

// Werkt voor zowel `const X = [...];` als `const X = new Set([...]);`.
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

const universum = extractArray(analyzerSrc, 'STANDAARD_UNIVERSUM');
const etoro = new Set(extractArray(opportunitiesSrc, 'ETORO_TRADABLE'));
const alias = extractAliasMap(marketDataSrc);

let gefaald = false;

// 1. Deelverzameling-check (geen netwerk nodig, dus eerst).
const nietOpEtoro = universum.filter(sym => !etoro.has(sym));
if (nietOpEtoro.length > 0) {
  console.error(`Coins in STANDAARD_UNIVERSUM die niet in ETORO_TRADABLE staan: ${nietOpEtoro.join(', ')}`);
  console.error('Voeg ze toe aan ETORO_TRADABLE (opportunities.ts) of haal ze uit STANDAARD_UNIVERSUM.');
  gefaald = true;
}

// 2. Live Binance-paren.
const res = await fetch('https://data-api.binance.vision/api/v3/exchangeInfo');
const data = await res.json();
const live = new Set(
  data.symbols.filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT').map(s => s.baseAsset),
);

const dood = universum.filter(sym => !live.has(alias[sym] ?? sym));
if (dood.length > 0) {
  console.error(`Dode tickers in STANDAARD_UNIVERSUM (${dood.length}/${universum.length}): ${dood.join(', ')}`);
  console.error('Voeg een alias toe in BINANCE_ALIAS (marketData.ts) of verwijder de coin uit STANDAARD_UNIVERSUM.');
  gefaald = true;
}

if (gefaald) process.exit(1);

console.log(`OK: alle ${universum.length} coins hebben een live Binance USDT-paar.`);
console.log(`OK: STANDAARD_UNIVERSUM (${universum.length}) is een deelverzameling van ETORO_TRADABLE (${etoro.size}).`);
