// De eToro-spread uitgedrukt in R: hoeveel van je risico je al kwijt bent voordat de koers ook maar
// beweegt. Je koopt tegen de laatkoers (ask) en een long-positie sluit tegen de biedkoers (bid), dus
// de hele spread is kosten. Bij een krappe stop is dat al gauw een flink deel van wat een signaal
// gemiddeld oplevert (+0.15 R bij sterk koop in de backtest).
//
// Alleen met een live koers uit de eToro-koppeling. Zonder koppeling of bij een fout toont Kader
// niets: een geschatte spread is erger dan geen spread.
//
// Self-check onderaan: `npx tsx src/engine/spread.ts` vanuit app/.

// Vanaf hier kleurt de regel oranje: dan eet de spread ongeveer de helft van het gemiddelde
// voordeel per signaal op.
export const SPREAD_LET_OP_R = 0.1;

export interface Koers { bid: number; ask: number }

// De respons van /market-data/instruments/rates. De vorm is niet tegen een echte respons
// geverifieerd, dus we lezen beide schrijfwijzen en zowel een kale lijst als een omhulsel.
export function leesKoers(data: unknown, instrumentId: number): Koers | null {
  const lijst: unknown[] = Array.isArray(data) ? data
    : data && typeof data === 'object'
      ? (Object.values(data as Record<string, unknown>).find(Array.isArray) as unknown[] | undefined) ?? []
      : [];
  for (const ruw of lijst) {
    if (!ruw || typeof ruw !== 'object') continue;
    const r = ruw as Record<string, unknown>;
    const id = r.instrumentId ?? r.instrumentID ?? r.InstrumentID ?? r.InstrumentId;
    if (Number(id) !== instrumentId) continue;
    const bid = Number(r.bid ?? r.Bid);
    const ask = Number(r.ask ?? r.Ask);
    if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask >= bid) return { bid, ask };
  }
  return null;
}

// Koersen van eToro staan in eToro's eenheid; met koersFactor terug naar Kaders koers per coin.
export function naarKaderKoers(k: Koers, factor: number): Koers {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return { bid: k.bid / f, ask: k.ask / f };
}

export function spreadInR(k: Koers, entry: number, stop: number): number | null {
  const risico = entry - stop;
  if (!(risico > 0)) return null;
  return (k.ask - k.bid) / risico;
}

// R/R na spread: het doel ligt een spread verder weg, de stop een spread dichterbij.
export function nettoRR(k: Koers, entry: number, stop: number, doel: number): number | null {
  const s = k.ask - k.bid;
  const risico = entry - stop + s;
  const winst = doel - entry - s;
  if (!(risico > 0) || !(entry - stop > 0)) return null;
  return winst / risico;
}

if (typeof require !== 'undefined' && require.main === module) {
  const k = leesKoers({ rates: [{ instrumentID: 1, bid: 99, ask: 100 }, { instrumentID: 2, bid: 10, ask: 11 }] }, 2);
  console.assert(k !== null && k.bid === 10 && k.ask === 11, 'leest omhulsel en id');
  console.assert(leesKoers([{ instrumentId: 7, Bid: 5, Ask: 5.1 }], 7)?.ask === 5.1, 'leest kale lijst en hoofdletters');
  console.assert(leesKoers([{ instrumentId: 7, bid: 5, ask: 4 }], 7) === null, 'ask onder bid is onzin');
  console.assert(leesKoers(null, 1) === null, 'geen data');
  console.assert(Math.abs(naarKaderKoers({ bid: 2, ask: 4 }, 2).ask - 2) < 1e-9, 'koersFactor');
  const kk = { bid: 99.9, ask: 100.5 };
  console.assert(Math.abs((spreadInR(kk, 100, 90) ?? 0) - 0.06) < 1e-9, 'spread 0.6 op 10 risico is 0.06 R');
  console.assert(spreadInR(kk, 100, 100) === null, 'geen risico, geen R');
  console.assert(Math.abs((nettoRR(kk, 100, 90, 130) ?? 0) - (29.4 / 10.6)) < 1e-9, 'netto R/R');
  console.log('spread.ts self-check klaar');
}
