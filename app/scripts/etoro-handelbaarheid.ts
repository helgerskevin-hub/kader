// Wegwerpscript: welke coins uit Kaders universum zet eToro voor jouw account op "alleen bekijken"?
// GEEN app-code, wordt nooit door de app geimporteerd. Leest alleen, plaatst nooit een order: er is
// geen codepad naar een schrijf-endpoint.
//
// Draaien (vanuit app/):
//   ETORO_API_KEY=... ETORO_USER_KEY=... npx tsx scripts/etoro-handelbaarheid.ts
//   (PowerShell: $env:ETORO_API_KEY='...'; $env:ETORO_USER_KEY='...'; npx tsx scripts/etoro-handelbaarheid.ts)
//
// Per coin halen we de volledige zoekrespons (zonder fields-projectie) en de eligibility op, en
// zetten we de velden van elke coin naast die van BTC. Een veld dat alleen bij FLOW afwijkt is het
// veld dat "alleen bekijken" draagt. Het resultaat komt ook in handelbaarheid-resultaat.json.
import { writeFileSync } from 'node:fs';
import { STANDAARD_UNIVERSUM } from '../src/engine/analyzer';
import { naarEtoroSymbool } from '../src/engine/etoroSymbolen';

const BASIS = 'https://public-api.etoro.com/api';
const apiKey = process.env.ETORO_API_KEY ?? '';
const userKey = process.env.ETORO_USER_KEY ?? '';

function guid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const pauze = (ms: number) => new Promise(r => setTimeout(r, ms));

async function roep(pad: string, body?: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASIS}${pad}`, {
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      'x-api-key': apiKey,
      'x-user-key': userKey,
      'x-request-id': guid(),
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
  });
  const ruw = await res.text();
  let data: any = null;
  try { data = JSON.parse(ruw); } catch { data = ruw; }
  return { status: res.status, data };
}

// Plat alle waarden naar "pad.naar.veld" -> waarde, zodat twee coins veld voor veld te vergelijken zijn.
function plat(waarde: any, pad = '', uit: Record<string, string> = {}): Record<string, string> {
  if (waarde && typeof waarde === 'object') {
    for (const [k, v] of Object.entries(waarde)) plat(v, pad ? `${pad}.${k}` : k, uit);
  } else {
    uit[pad] = JSON.stringify(waarde);
  }
  return uit;
}

async function main() {
  if (!apiKey || !userKey) {
    console.error('Zet ETORO_API_KEY en ETORO_USER_KEY in je omgeving.');
    process.exit(1);
  }

  const kader = [...STANDAARD_UNIVERSUM, 'TON'];
  const resultaat: Record<string, { symbool: string; zoek: any; eligibility: any }> = {};

  // 1. Volledige zoekrespons per coin (exacte treffer).
  for (const k of kader) {
    const symbool = naarEtoroSymbool(k);
    const r = await roep(`/v1/market-data/search?internalSymbolFull=${encodeURIComponent(symbool)}`);
    const items: any[] = Array.isArray(r.data?.items) ? r.data.items : [];
    const exact = items.filter(i => String(i.internalSymbolFull ?? '').toUpperCase() === symbool.toUpperCase());
    resultaat[k] = { symbool, zoek: exact.length === 1 ? exact[0] : { treffers: exact.length, status: r.status }, eligibility: null };
    await pauze(150);
  }

  // 2. Eligibility in blokken (quotum 20 per minuut).
  for (let i = 0; i < kader.length; i += 10) {
    const blok = kader.slice(i, i + 10);
    const r = await roep('/v2/trading/info/eligibility', { symbols: blok.map(k => resultaat[k].symbool), currency: 'USD' });
    const lijst: any[] = r.data?.eligibilities ?? [];
    for (const k of blok) {
      const s = resultaat[k].symbool.toUpperCase();
      resultaat[k].eligibility = lijst.find(e => JSON.stringify(e).toUpperCase().includes(`"${s}"`)) ?? { status: r.status, geenTreffer: true };
    }
    await pauze(3500);
  }

  writeFileSync('handelbaarheid-resultaat.json', JSON.stringify(resultaat, null, 1));

  // 3. Diff: per veld, hoeveel coins wijken af van de meerderheid?
  const vlak: Record<string, Record<string, string>> = {};
  for (const k of kader) vlak[k] = plat({ zoek: resultaat[k].zoek, el: resultaat[k].eligibility });
  const velden = new Set(Object.values(vlak).flatMap(v => Object.keys(v)));
  console.log('\nVelden waarin niet alle coins gelijk zijn (en niet uniek per coin zoals id/naam):');
  for (const veld of velden) {
    if (/symbol|instrumentId|Name|displayName|Id$/i.test(veld)) continue;
    const telling = new Map<string, string[]>();
    for (const k of kader) {
      const w = vlak[k][veld] ?? '(ontbreekt)';
      telling.set(w, [...(telling.get(w) ?? []), k]);
    }
    if (telling.size < 2 || telling.size > 6) continue;
    console.log(`\n${veld}`);
    for (const [w, coins] of telling) console.log(`  ${w.padEnd(24)} ${coins.length <= 8 ? coins.join(' ') : `${coins.length} coins`}`);
  }
  console.log('\nVolledige respons per coin: handelbaarheid-resultaat.json');
}

main().catch(e => { console.error(e); process.exit(1); });
