// Export van de handelshistorie: een CSV en een PDF-jaaroverzicht. Dit bestand is puur (regels
// opbouwen, CSV- en HTML-tekst maken, totalen); de koersen komen van buiten binnen en het schrijven
// en delen gebeurt in state/exportDelen.ts.
//
// Wat telt als "echt geld": elke trade die niet uit het eToro-demoaccount komt, dus
// `etoroOmgeving !== 'demo'`. Dat zijn eToro-posities uit het echte account (ontbrekend veld is
// 'real', zie portfolioTypes.ts) en handmatig ingevoerde trades, want die horen in de app bij de
// omgeving Echt (zie inOmgeving in openRisico.ts). Een trade in de eToro-demo is speelgeld en gaat
// nooit mee, ook niet als de gebruiker op dat moment in Demo kijkt.
//
// Euro's: alle bedragen in de app zijn dollars. Voor de euro-kolommen gebruiken we de koers van
// de betreffende dag (EUR/USD uit Binance's EURUSDT-dagcandles, openingskoers van de dag). Is die
// er niet, dan blijft het eurobedrag leeg: een verzonnen koers is erger dan geen koers.
//
// Self-check onderaan: `npx tsx src/state/export.ts` vanuit app/.

import type { PortfolioTrade } from './portfolioTypes';
import { behaaldeRR, resultaatVan } from './statistieken';

export function isEchtGeld(t: PortfolioTrade): boolean {
  return t.etoroOmgeving !== 'demo';
}

// Koers per dag, sleutel is de UTC-datum (JJJJ-MM-DD) van een dagcandle.
export type DagKoersen = Record<string, number>;

export interface ExportKoersen {
  // Dollars per coin op een dag, per symbool.
  coins: Record<string, DagKoersen>;
  // Euro per dollar op een dag. null als er geen enkele wisselkoers beschikbaar was.
  eurPerUsd: DagKoersen | null;
}

export interface ExportRegel {
  open: string | null;
  sluit: string | null;
  symbool: string;
  entry: number;
  exit: number | null;
  bedragUsd: number | null;
  bedragEur: number | null;
  r: number | null;
  resultaatUsd: number | null;
  resultaatEur: number | null;
}

export interface PeildatumRegel {
  symbool: string;
  aantal: number;
  koersUsd: number | null;
  waardeUsd: number | null;
  waardeEur: number | null;
}

export interface Peildatum {
  regels: PeildatumRegel[];
  totaalUsd: number;
  // null zodra een positie geen eurowaarde heeft: een som met een gat is geen totaal.
  totaalEur: number | null;
  // Posities zonder bekende openingsdatum: niet te beoordelen of ze er op 1 januari al waren.
  onbekendOpen: number;
}

export interface Totalen {
  aantal: number;
  gewonnen: number;
  verloren: number;
  resultaatUsd: number;
  resultaatEur: number;
  // Trades zonder eurobedrag: het eurototaal is dan onvolledig.
  zonderEur: number;
}

export interface Jaaroverzicht {
  jaar: number;
  regels: ExportRegel[];
  totalen: Totalen;
  peildatum: Peildatum;
}

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// `datum` is een opgemaakte tekst ("11 sep 2026"), zie portfolioTypes.ts. Voor trades zonder
// openTijd/slotTijd proberen we hem terug te lezen, om 12:00 lokaal zodat een tijdzone de dag niet
// verschuift.
function tijdUitDatum(tekst: string | undefined): number | null {
  if (!tekst) return null;
  const m = /(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})/i.exec(tekst);
  if (!m) return null;
  const maand = MAANDEN.indexOf(m[2].toLowerCase());
  if (maand < 0) return null;
  return new Date(Number(m[3]), maand, Number(m[1]), 12).getTime();
}

const openTijdVan = (t: PortfolioTrade) => t.openTijd ?? tijdUitDatum(t.datum);
const slotTijdVan = (t: PortfolioTrade) => t.slotTijd ?? tijdUitDatum(t.slotDatum);

const twee = (n: number) => String(n).padStart(2, '0');

// Lokale datum als JJJJ-MM-DD, zoals de gebruiker de dag beleefde.
export function datumTekst(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${twee(d.getMonth() + 1)}-${twee(d.getDate())}`;
}

// De UTC-dag waarop de dagcandles beginnen; de sleutel voor DagKoersen.
export function dagSleutel(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function aantalVan(t: PortfolioTrade): number | null {
  if (typeof t.aantalCoins === 'number' && t.aantalCoins > 0) return t.aantalCoins;
  if (typeof t.bedragUsd === 'number' && t.bedragUsd > 0 && t.entryPrijs > 0) return t.bedragUsd / t.entryPrijs;
  return null;
}

function naarEur(usd: number | null, ms: number | null, eur: DagKoersen | null): number | null {
  if (usd === null || ms === null || !eur) return null;
  const koers = eur[dagSleutel(ms)];
  return typeof koers === 'number' && koers > 0 ? usd * koers : null;
}

// Jaren waarin echte gesloten trades staan, plus het huidige en het vorige jaar, nieuwste eerst.
export function beschikbareJaren(trades: PortfolioTrade[], nu: number = Date.now()): number[] {
  const huidig = new Date(nu).getFullYear();
  const jaren = new Set<number>([huidig, huidig - 1]);
  for (const t of trades) {
    if (!isEchtGeld(t) || t.status === 'open') continue;
    const slot = slotTijdVan(t);
    if (slot !== null) jaren.add(new Date(slot).getFullYear());
  }
  return [...jaren].sort((a, b) => b - a);
}

export function bouwRegels(trades: PortfolioTrade[], jaar: number, eur: DagKoersen | null): ExportRegel[] {
  const uit: { slot: number; regel: ExportRegel }[] = [];
  for (const t of trades) {
    if (!isEchtGeld(t) || t.status === 'open') continue;
    const slot = slotTijdVan(t);
    if (slot === null || new Date(slot).getFullYear() !== jaar) continue;
    const open = openTijdVan(t);
    const resultaatUsd = resultaatVan(t);
    const exit = t.exitPrijs ?? (t.status === 'gewonnen' ? t.takeProfit : t.stopLoss);
    const bedragUsd = typeof t.bedragUsd === 'number' && t.bedragUsd > 0
      ? t.bedragUsd
      : (aantalVan(t) !== null ? (aantalVan(t) as number) * t.entryPrijs : null);
    uit.push({
      slot,
      regel: {
        open: open !== null ? datumTekst(open) : null,
        sluit: datumTekst(slot),
        symbool: t.symbool,
        entry: t.entryPrijs,
        exit: exit > 0 ? exit : null,
        bedragUsd,
        bedragEur: naarEur(bedragUsd, open, eur),
        r: behaaldeRR(t),
        resultaatUsd,
        resultaatEur: naarEur(resultaatUsd, slot, eur),
      },
    });
  }
  return uit.sort((a, b) => a.slot - b.slot).map(x => x.regel);
}

export function berekenTotalen(regels: ExportRegel[]): Totalen {
  const uit: Totalen = { aantal: regels.length, gewonnen: 0, verloren: 0, resultaatUsd: 0, resultaatEur: 0, zonderEur: 0 };
  for (const r of regels) {
    if (r.resultaatUsd !== null) {
      if (r.resultaatUsd >= 0) uit.gewonnen += 1; else uit.verloren += 1;
      uit.resultaatUsd += r.resultaatUsd;
    }
    if (r.resultaatEur !== null) uit.resultaatEur += r.resultaatEur; else uit.zonderEur += 1;
  }
  return uit;
}

// Posities die op 1 januari van het jaar (00:00 lokaal) open stonden: geopend ervoor en pas daarna
// gesloten, of nog open. Waarde = aantal * koers van die dag (openingskoers van de dagcandle van
// 1 januari, het dichtst bij het peilmoment), omgerekend met de EUR/USD van die dag.
export function bouwPeildatum(trades: PortfolioTrade[], jaar: number, koersen: ExportKoersen): Peildatum {
  const grens = new Date(jaar, 0, 1).getTime();
  const sleutel = `${jaar}-01-01`;
  const eurKoers = koersen.eurPerUsd?.[sleutel];
  const uit: Peildatum = { regels: [], totaalUsd: 0, totaalEur: 0, onbekendOpen: 0 };
  for (const t of trades) {
    if (!isEchtGeld(t)) continue;
    const open = openTijdVan(t);
    if (open === null) { uit.onbekendOpen += 1; continue; }
    if (open >= grens) continue;
    if (t.status !== 'open') {
      const slot = slotTijdVan(t);
      if (slot === null || slot < grens) continue;
    }
    const aantal = aantalVan(t);
    if (aantal === null) continue;
    const koers = koersen.coins[t.symbool]?.[sleutel];
    const koersUsd = typeof koers === 'number' && koers > 0 ? koers : null;
    const waardeUsd = koersUsd !== null ? koersUsd * aantal : null;
    const waardeEur = waardeUsd !== null && typeof eurKoers === 'number' && eurKoers > 0 ? waardeUsd * eurKoers : null;
    uit.regels.push({ symbool: t.symbool, aantal, koersUsd, waardeUsd, waardeEur });
    if (waardeUsd !== null) uit.totaalUsd += waardeUsd;
    if (waardeEur !== null && uit.totaalEur !== null) uit.totaalEur += waardeEur; else uit.totaalEur = null;
  }
  return uit;
}

export function bouwJaaroverzicht(trades: PortfolioTrade[], jaar: number, koersen: ExportKoersen): Jaaroverzicht {
  const regels = bouwRegels(trades, jaar, koersen.eurPerUsd);
  return { jaar, regels, totalen: berekenTotalen(regels), peildatum: bouwPeildatum(trades, jaar, koersen) };
}

// ---- CSV ----

// Onafgerond en zonder duizendtallen: punt als decimaalteken, nooit e-notatie.
function getal(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '';
  return n.toFixed(12).replace(/\.?0+$/, '') || '0';
}

function cel(tekst: string): string {
  return /[;"\n\r]/.test(tekst) ? `"${tekst.replace(/"/g, '""')}"` : tekst;
}

// UTF-8 met BOM zodat Excel de tekens goed leest, puntkomma als scheidingsteken (Nederlandse Excel).
export function maakCsv(o: Jaaroverzicht): string {
  const rij = (cellen: string[]) => cellen.map(cel).join(';');
  const lijnen: string[] = [
    rij(['Open', 'Sluit', 'Coin', 'Instap USD', 'Uitstap USD', 'Bedrag USD', 'Bedrag EUR', 'R', 'Resultaat USD', 'Resultaat EUR']),
    ...o.regels.map(r => rij([
      r.open ?? '', r.sluit ?? '', r.symbool, getal(r.entry), getal(r.exit),
      getal(r.bedragUsd), getal(r.bedragEur), getal(r.r), getal(r.resultaatUsd), getal(r.resultaatEur),
    ])),
    '',
    rij([`Waarde op 1 januari ${o.jaar}`]),
    rij(['Coin', 'Aantal', 'Koers USD', 'Waarde USD', 'Waarde EUR']),
    ...o.peildatum.regels.map(p => rij([
      p.symbool, getal(p.aantal),
      p.koersUsd !== null ? getal(p.koersUsd) : 'koers onbekend',
      getal(p.waardeUsd), getal(p.waardeEur),
    ])),
  ];
  return '﻿' + lijnen.join('\r\n') + '\r\n';
}

// ---- PDF (HTML) ----

function esc(tekst: string): string {
  return tekst.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const NL = (n: number, d: number) => n.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (n: number | null) => (n === null ? '-' : `$${NL(n, 2)}`);
const eurT = (n: number | null) => (n === null ? '-' : `€${NL(n, 2)}`);
const prijs = (n: number | null) => (n === null ? '-' : n >= 1 ? NL(n, 2) : NL(n, 6));
const rT = (n: number | null) => (n === null ? '-' : `${n >= 0 ? '+' : ''}${NL(n, 2)}R`);

export function maakHtml(o: Jaaroverzicht, gemaaktOp: number = Date.now()): string {
  const t = o.totalen;
  const heeftEur = o.regels.some(r => r.resultaatEur !== null);
  const trs = o.regels.map(r => `<tr>
<td>${esc(r.open ?? '-')}</td><td>${esc(r.sluit ?? '-')}</td><td>${esc(r.symbool)}</td>
<td class="g">${prijs(r.entry)}</td><td class="g">${prijs(r.exit)}</td>
<td class="g">${usd(r.bedragUsd)}</td><td class="g">${eurT(r.bedragEur)}</td>
<td class="g">${rT(r.r)}</td><td class="g">${usd(r.resultaatUsd)}</td><td class="g">${eurT(r.resultaatEur)}</td>
</tr>`).join('\n');
  const p = o.peildatum;
  const ptrs = p.regels.map(x => `<tr>
<td>${esc(x.symbool)}</td><td class="g">${NL(x.aantal, 6)}</td>
<td class="g">${x.koersUsd !== null ? usd(x.koersUsd) : 'koers onbekend'}</td>
<td class="g">${usd(x.waardeUsd)}</td><td class="g">${x.waardeUsd !== null && x.waardeEur === null ? 'koers onbekend' : eurT(x.waardeEur)}</td>
</tr>`).join('\n');

  return `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8">
<style>
body{font-family:sans-serif;color:#111;font-size:10px;margin:24px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 6px}
p{margin:4px 0;line-height:1.4}.klein{color:#555;font-size:9px}
table{border-collapse:collapse;width:100%;margin-top:6px}
th,td{padding:3px 4px;border-bottom:1px solid #ddd;text-align:left}
th{font-size:9px;color:#555}.g{text-align:right;font-family:monospace}
tfoot td{font-weight:bold;border-top:2px solid #111}
</style></head><body>
<h1>Kader jaaroverzicht ${o.jaar}</h1>
<p class="klein">Gemaakt op ${esc(datumTekst(gemaaktOp))}. Alleen trades met echt geld, demo-trades zijn niet meegenomen.</p>
<p class="klein">Geen financieel advies. De koers op eToro kan afwijken. Kader geeft zelf geen belastingadvies: dit overzicht is een hulpmiddel bij je eigen aangifte.</p>
${heeftEur || o.regels.length === 0 ? '' : '<p>Eurobedragen ontbreken: er was geen wisselkoers beschikbaar.</p>'}

<h2>Afgesloten trades</h2>
${o.regels.length === 0 ? `<p>Geen afgesloten trades in ${o.jaar}.</p>` : `<table>
<thead><tr><th>Open</th><th>Sluit</th><th>Coin</th><th class="g">Instap</th><th class="g">Uitstap</th><th class="g">Bedrag USD</th><th class="g">Bedrag EUR</th><th class="g">R</th><th class="g">Resultaat USD</th><th class="g">Resultaat EUR</th></tr></thead>
<tbody>
${trs}
</tbody>
<tfoot><tr><td colspan="8">Totaal (${t.aantal} trades, ${t.gewonnen} gewonnen, ${t.verloren} verloren)</td><td class="g">${usd(t.resultaatUsd)}</td><td class="g">${eurT(t.resultaatEur)}</td></tr></tfoot>
</table>
${t.zonderEur > 0 ? `<p class="klein">Voor ${t.zonderEur} trade${t.zonderEur === 1 ? '' : 's'} was geen koers van die dag beschikbaar. Het eurototaal is daardoor onvolledig.</p>` : ''}`}

<h2>Waarde op 1 januari ${o.jaar}</h2>
<p class="klein">Peildatum voor box 3. Aantal coins maal de openingskoers van 1 januari, in euro tegen de EUR/USD-koers van die dag.</p>
${p.regels.length === 0 ? '<p>Geen open posities op deze datum.</p>' : `<table>
<thead><tr><th>Coin</th><th class="g">Aantal</th><th class="g">Koers USD</th><th class="g">Waarde USD</th><th class="g">Waarde EUR</th></tr></thead>
<tbody>
${ptrs}
</tbody>
<tfoot><tr><td colspan="3">Totaal</td><td class="g">${usd(p.totaalUsd)}</td><td class="g">${p.totaalEur !== null ? eurT(p.totaalEur) : 'onvolledig'}</td></tr></tfoot>
</table>`}
${p.onbekendOpen > 0 ? `<p class="klein">${p.onbekendOpen} positie${p.onbekendOpen === 1 ? '' : 's'} zonder bekende openingsdatum is niet beoordeeld.</p>` : ''}
</body></html>`;
}

if (typeof require !== 'undefined' && require.main === module) {
  const dag = (j: number, m: number, d: number) => new Date(j, m - 1, d, 12).getTime();
  const basis = { naam: '', rr: 3, datum: '', takeProfit: 0 } as const;
  const trades: PortfolioTrade[] = [
    { ...basis, id: 'a', symbool: 'BTC', entryPrijs: 100, stopLoss: 90, initieleStop: 90, aantalCoins: 2, bedragUsd: 200,
      status: 'gewonnen', exitPrijs: 120, resultaatUsd: 38, openTijd: dag(2025, 12, 20), slotTijd: dag(2026, 2, 10), bron: 'etoro' },
    { ...basis, id: 'b', symbool: 'ETH', entryPrijs: 50, stopLoss: 45, initieleStop: 45, aantalCoins: 1,
      status: 'verloren', exitPrijs: 45, openTijd: dag(2026, 3, 1), slotTijd: dag(2026, 3, 5), bron: 'handmatig' },
    { ...basis, id: 'c', symbool: 'SOL', entryPrijs: 10, stopLoss: 9, aantalCoins: 5, status: 'gewonnen', exitPrijs: 12,
      openTijd: dag(2026, 1, 5), slotTijd: dag(2026, 1, 9), bron: 'etoro', etoroOmgeving: 'demo' },
    { ...basis, id: 'd', symbool: 'ADA', entryPrijs: 1, stopLoss: 0.9, aantalCoins: 100, status: 'open',
      openTijd: dag(2025, 6, 1), bron: 'etoro', etoroOmgeving: 'real' },
    { ...basis, id: 'e', symbool: 'DOT', entryPrijs: 4, stopLoss: 3, aantalCoins: 10, status: 'gewonnen', exitPrijs: 5,
      openTijd: dag(2025, 11, 1), slotTijd: dag(2025, 12, 15), bron: 'etoro' },
    { ...basis, id: 'f', symbool: 'XRP', entryPrijs: 1, stopLoss: 0.9, aantalCoins: 1, status: 'open', bron: 'handmatig' },
  ];
  const koersen: ExportKoersen = {
    coins: { BTC: { '2026-01-01': 110 }, ADA: { '2026-01-01': 2 } },
    eurPerUsd: { '2026-01-01': 0.5, '2026-02-10': 0.5, '2025-12-20': 0.5, '2026-03-05': 0.5, '2026-03-01': 0.5 },
  };
  const o = bouwJaaroverzicht(trades, 2026, koersen);
  console.assert(o.regels.length === 2, `twee echte trades in 2026, kreeg ${o.regels.length}`);
  console.assert(!o.regels.some(r => r.symbool === 'SOL'), 'demo-trade gaat nooit mee');
  console.assert(o.regels[0].symbool === 'BTC' && o.regels[1].symbool === 'ETH', 'op sluitdatum gesorteerd');
  console.assert(o.regels[0].resultaatUsd === 38 && o.regels[0].resultaatEur === 19, 'netto resultaat en euro');
  console.assert(o.regels[0].r === 2, 'R = (120-100)/10');
  console.assert(o.regels[1].r === -1 && o.regels[1].resultaatUsd === -5, 'verliezer: -1R en -5 USD');
  console.assert(o.regels[0].bedragEur === 100, 'bedrag in euro tegen koers van de opendag');
  console.assert(o.totalen.gewonnen === 1 && o.totalen.verloren === 1, 'totalen winst/verlies');
  console.assert(o.totalen.resultaatUsd === 33, 'totaal USD 33');
  console.assert(o.peildatum.regels.length === 2, 'BTC (gesloten later) en ADA (open) op 1 jan; DOT sloot in 2025');
  console.assert(o.peildatum.regels.find(x => x.symbool === 'BTC')?.waardeEur === 110, 'BTC: 2 * 110 * 0.5');
  console.assert(o.peildatum.regels.find(x => x.symbool === 'ADA')?.waardeEur === 100, 'ADA: 100 * 2 * 0.5');
  console.assert(o.peildatum.totaalEur === 210, 'totaal peildatum 210 EUR');
  console.assert(o.peildatum.onbekendOpen === 1, 'XRP heeft geen openingsdatum');
  const zonderKoers = bouwJaaroverzicht(trades, 2026, { coins: { BTC: { '2026-01-01': 110 } }, eurPerUsd: null });
  console.assert(zonderKoers.regels[0].resultaatEur === null, 'zonder EUR/USD geen eurobedrag');
  console.assert(zonderKoers.peildatum.regels.find(x => x.symbool === 'ADA')?.koersUsd === null, 'ontbrekende koers blijft null');
  console.assert(zonderKoers.peildatum.totaalEur === null, 'totaal met gat is null');
  console.assert(beschikbareJaren(trades, dag(2026, 6, 1)).join() === '2026,2025', 'jaren');
  const csv = maakCsv(o);
  console.assert(csv.startsWith('﻿'), 'BOM');
  console.assert(csv.includes('2025-12-20;2026-02-10;BTC;100;120;200;100;2;38;19'), `CSV-regel, kreeg ${csv}`);
  console.assert(!csv.includes('SOL;10'), 'demo niet in CSV');
  console.assert(maakCsv(zonderKoers).includes('ADA;100;koers onbekend'), 'koers onbekend in CSV');
  console.assert(getal(0.00000123) === '0.00000123', 'geen e-notatie');
  const html = maakHtml(o);
  console.assert(html.includes('Kader jaaroverzicht 2026') && html.includes('Waarde op 1 januari 2026'), 'koppen');
  console.assert(html.includes('Geen financieel advies. De koers op eToro kan afwijken.'), 'disclaimer');
  console.assert(!html.includes('\u2014'), 'geen em-dash');
  console.log('export.ts self-check klaar');
}
