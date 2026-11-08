// Meetscript voor fase 0 van docs/copy-trading-plan.md. GEEN app-code: de app importeert dit nooit.
//
// Doel: met een echte eToro-sleutel nagaan of de endpoints van de Copy-tab doen wat de docs zeggen,
// en welke velden en eenheden er echt terugkomen. De uitkomst gaat naar docs/metingen.md en waar
// nodig terug in engine/copyTrading.ts (bijvoorbeeld of peakToValley een fractie of een procent is).
//
// Draaien (vanuit app/):
//   ETORO_API_KEY=... ETORO_USER_KEY=... npx tsx scripts/etoro-copy-meting.ts
//
// Zonder vlaggen leest het script alleen: ranglijst, één live portfolio, maandrendement en de
// eigen copies. Niets wordt geplaatst.
//
// Vlaggen:
//   --trader=naam       welke belegger te bekijken (standaard: de eerste uit de ranglijst)
//   --precheck=bedrag   doe de droogtest van een copy op het DEMO-pad (verandert niets)
//   --copy=bedrag       start ECHT een copy op het DEMO-pad en vraag de uitkomst op. Alleen demo:
//                       er is in dit script geen codepad naar het echte copy-endpoint.

const BASIS = 'https://public-api.etoro.com/api';
const apiKey = process.env.ETORO_API_KEY ?? process.env.ETORO_DEMO_API_KEY ?? '';
const userKey = process.env.ETORO_USER_KEY ?? process.env.ETORO_DEMO_USER_KEY ?? '';

const vlaggen = process.argv.slice(2);
const waarde = (naam: string): string | null => {
  const t = vlaggen.find(v => v.startsWith(`--${naam}=`));
  return t ? t.slice(naam.length + 3) : null;
};

function guid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function vraag(pad: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASIS}${pad}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'x-api-key': apiKey,
      'x-user-key': userKey,
      'x-request-id': guid(),
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const tekst = await res.text();
  let data: unknown = tekst;
  try { data = tekst ? JSON.parse(tekst) : null; } catch { /* geen JSON */ }
  return { status: res.status, data };
}

function velden(obj: unknown): string {
  return obj && typeof obj === 'object' ? Object.keys(obj as object).sort().join(', ') : String(obj);
}

async function main() {
  if (!apiKey || !userKey) {
    console.error('Zet ETORO_API_KEY en ETORO_USER_KEY (of de DEMO-varianten).');
    process.exit(1);
  }

  console.log('\n1. Ranglijst');
  const rang = await vraag('/v2/portfolios/rankings?period=OneYearAgo&popularInvestor=true&riskScoreMax=6&sort=-copiers&pageSize=5');
  console.log('status', rang.status);
  const rijen = (rang.data as { results?: Record<string, unknown>[] })?.results ?? [];
  if (rijen[0]) {
    console.log('velden eerste rij:', velden(rijen[0]));
    const r = rijen[0];
    console.log('eenheden: gain', r.gain, '| peakToValley', r.peakToValley, '| winRatio', r.winRatio,
      '| profitableMonthsPct', r.profitableMonthsPct, '| topTradedAssetClassId', r.topTradedAssetClassId,
      '| topTradedInstrumentPct', r.topTradedInstrumentPct, '| highLeveragePct', r.highLeveragePct);
  }

  const trader = waarde('trader') ?? (rijen[0]?.username as string | undefined);
  if (!trader) return;
  const cid = rijen.find(r => r.username === trader)?.cid as number | undefined;

  console.log(`\n2. Live portfolio van ${trader}`);
  const live = await vraag(`/v1/user-info/people/${encodeURIComponent(trader)}/portfolio/live`);
  console.log('status', live.status);
  const posities = (live.data as { positions?: Record<string, unknown>[] })?.positions ?? [];
  console.log('aantal posities', posities.length);
  if (posities[0]) console.log('velden positie:', velden(posities[0]), '\nvoorbeeld:', posities[0]);

  console.log(`\n3. Maandrendement van ${trader}`);
  const gain = await vraag(`/v2/portfolios/${encodeURIComponent(trader)}/gain/monthly?count=12`);
  console.log('status', gain.status, 'velden', velden(gain.data));

  console.log('\n4. Crypto-assetclass');
  const typen = await vraag('/v1/market-data/instrument-types');
  console.log('status', typen.status, JSON.stringify(typen.data).slice(0, 400));

  console.log('\n5. Eigen copies (mirrors) in je portfolio');
  const eigen = await vraag('/v1/trading/info/portfolio');
  const mirrors = (eigen.data as { clientPortfolio?: { mirrors?: unknown[] } })?.clientPortfolio?.mirrors;
  console.log('status', eigen.status, '| mirrors aanwezig:', Array.isArray(mirrors), Array.isArray(mirrors) && mirrors[0] ? velden(mirrors[0]) : '');

  const precheck = waarde('precheck');
  if (precheck && cid) {
    console.log(`\n6. Droogtest copy van ${trader} (cid ${cid}) voor ${precheck} op DEMO`);
    const t = await vraag('/v2/trading/copy/demo/eligibility', { parentCID: cid, amount: Number(precheck) });
    console.log('status', t.status, t.data);
  }

  const copy = waarde('copy');
  if (copy && cid) {
    const referentie = `kader-meting-${Date.now().toString(36)}`;
    console.log(`\n7. ECHTE copy op DEMO van ${trader} voor ${copy}, referentie ${referentie}`);
    const s = await vraag('/v2/trading/copy/demo', { parentCID: cid, amount: Number(copy), referenceID: referentie });
    console.log('status', s.status, s.data);
    for (const wacht of [2000, 5000, 10000]) {
      await new Promise(r => setTimeout(r, wacht));
      const u = await vraag(`/v2/trading/copy/demo/${referentie}`);
      console.log(`na ${wacht} ms:`, u.status, u.data);
      if (u.status === 200) break;
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
