// NL-getallenvormaat voor prijzen, percentages en R/R
// Gebruik IBM Plex Mono + fontVariant: ['tabular-nums'] in de StyleSheet.
//
// Alle bedragen komen in dollars binnen (Binance, CoinGecko, eToro). De formatters hieronder
// rekenen om naar de gekozen weergavevaluta, zie engine/valuta.ts. Wil je op een plek gegarandeerd
// dollars tonen, geef dan `{ valuta: 'USD' }` mee: dat doen de orderschermen, omdat eToro in
// dollars afrekent en het bedrag dat je daar intikt letterlijk zo de order in gaat.

import { Valuta, naarWeergave } from './valuta';

type Opties = { valuta?: Valuta };

// Aantal decimalen voor een koers onder de cent. Een vaste 5 decimalen maakte SHIB ($0,00000547)
// en PEPE onleesbaar: die werden allebei "$0.00001", en alles onder $0,000005 werd zelfs
// "$0.00000". Daarom schalen we mee met de grootteorde en houden we drie betekenisvolle cijfers.
function decimalenOnderCent(p: number): number {
  const nullenNaKomma = Math.max(0, Math.ceil(-Math.log10(p)) - 1);
  return Math.min(nullenNaKomma + 3, 12);
}

export function fmtPrijs(p: number, opties?: Opties): string {
  const { waarde, teken } = naarWeergave(p, opties?.valuta);
  const abs = Math.abs(waarde);
  let decimalen: number;
  if (abs >= 100) decimalen = 2;
  else if (abs >= 1) decimalen = 3;
  else if (abs >= 0.01 || abs === 0) decimalen = 5;
  else decimalen = decimalenOnderCent(abs);
  return `${teken}${waarde.toLocaleString('en-US', {
    minimumFractionDigits: decimalen,
    maximumFractionDigits: decimalen,
  })}`;
}

// Een bedrag dat je inlegt of beschikbaar hebt, geen muntkoers. fmtPrijs geeft onder de $100 extra
// decimalen omdat een koers die precisie nodig heeft, en dan wordt een inleg van 10 dollar
// "$10.000". Dat leest als tienduizend, precies de verwarring die je op een orderscherm niet wilt.
export function fmtBedrag(n: number, opties?: Opties): string {
  const { waarde, teken } = naarWeergave(n, opties?.valuta);
  return `${teken}${waarde.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Percentage met expliciet +/− teken, NL-komma voor decimalen
export function fmtPct(p: number, decimals = 1): string {
  const teken = p >= 0 ? '+' : '−';
  return `${teken}${Math.abs(p).toFixed(decimals)}%`;
}

// Resultaat in geld, met expliciet +/− teken. Zonder het minteken leest een verlies van
// $4,21 als een winst.
export function fmtResultaatUsd(n: number, opties?: Opties): string {
  const { waarde, teken } = naarWeergave(n, opties?.valuta);
  const rekenteken = waarde >= 0 ? '+' : '−';
  return `${rekenteken}${teken}${Math.abs(waarde).toFixed(2)}`;
}

// R/R weergave
export function fmtRR(rr: number): string {
  return `1 : ${rr.toFixed(1)}`;
}

// Score als geheel getal
export function fmtScore(score: number): string {
  return Math.round(score).toString();
}

// Relatieve tijd sinds een tijdstip, kort en in het Nederlands: "zojuist", "3 min geleden",
// "2 uur geleden", "4 dagen geleden". Gebruikt voor de sync-status in de header.
export function relatieveTijd(sinds: number, nu: number = Date.now()): string {
  const seconden = Math.max(0, Math.round((nu - sinds) / 1000));
  if (seconden < 45) return 'zojuist';
  const minuten = Math.round(seconden / 60);
  if (minuten < 60) return `${minuten} min geleden`;
  const uren = Math.round(minuten / 60);
  if (uren < 24) return uren === 1 ? '1 uur geleden' : `${uren} uur geleden`;
  const dagen = Math.round(uren / 24);
  return dagen === 1 ? '1 dag geleden' : `${dagen} dagen geleden`;
}

// Marktcap (miljarden / miljoenen)
export function fmtMarktcap(cap: number, opties?: Opties): string {
  const { waarde, teken } = naarWeergave(cap, opties?.valuta);
  if (waarde >= 1e9) return `${teken}${(waarde / 1e9).toFixed(1)}B`;
  if (waarde >= 1e6) return `${teken}${(waarde / 1e6).toFixed(0)}M`;
  return `${teken}${waarde.toFixed(0)}`;
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/format.ts`
if (require.main === module) {
  const { zetValutaStand } = require('./valuta');

  console.assert(fmtBedrag(10) === '$10.00', `een inleg van 10 moet $10.00 zijn, niet $10.000; was ${fmtBedrag(10)}`);
  console.assert(fmtBedrag(250) === '$250.00', 'een rond bedrag krijgt twee decimalen');
  console.assert(fmtBedrag(74749.84) === '$74,749.84', 'grote bedragen houden hun duizendtalscheiding');
  console.assert(fmtPrijs(10) === '$10.000', 'fmtPrijs blijft ongewijzigd voor koersen');
  console.assert(fmtPrijs(0.219) === '$0.21900', `boven de cent blijft het 5 decimalen, was ${fmtPrijs(0.219)}`);

  // De reden dat decimalenOnderCent bestaat: deze twee waren allebei "$0.00001" resp. "$0.00000".
  console.assert(fmtPrijs(0.00000547) === '$0.00000547', `SHIB moet leesbaar blijven, was ${fmtPrijs(0.00000547)}`);
  console.assert(fmtPrijs(0.0000012) === '$0.00000120', `PEPE moet leesbaar blijven, was ${fmtPrijs(0.0000012)}`);
  console.assert(fmtPrijs(0.0000000123) === '$0.0000000123', `ook tien nullen moet werken, was ${fmtPrijs(0.0000000123)}`);
  console.assert(fmtPrijs(0.005) === '$0.00500', `net onder de cent, was ${fmtPrijs(0.005)}`);
  console.assert(fmtPrijs(0) === '$0.00000', `nul mag niet in een log10 lopen, was ${fmtPrijs(0)}`);

  console.assert(fmtResultaatUsd(4.21) === '+$4.21', 'winst krijgt een plus');
  console.assert(fmtResultaatUsd(-4.21) === '−$4.21', `verlies krijgt een minteken, was ${fmtResultaatUsd(-4.21)}`);
  console.assert(fmtResultaatUsd(0) === '+$0.00', 'nul telt als niet-negatief');
  console.assert(fmtPct(-16.8) === '−16.8%', 'percentage krijgt een minteken');

  // Euro's: alleen als er ook echt een koers is opgehaald.
  zetValutaStand({ valuta: 'EUR' });
  console.assert(fmtBedrag(10) === '$10.00', `zonder koers blijft het dollars, was ${fmtBedrag(10)}`);
  zetValutaStand({ eurPerUsd: 0.92 });
  console.assert(fmtBedrag(10) === '€9.20', `10 dollar bij 0.92 is 9.20 euro, was ${fmtBedrag(10)}`);
  console.assert(fmtResultaatUsd(-10) === '−€9.20', `verlies rekent net zo om, was ${fmtResultaatUsd(-10)}`);
  console.assert(fmtBedrag(10, { valuta: 'USD' }) === '$10.00', 'orderschermen kunnen dollars afdwingen');
  console.assert(fmtMarktcap(2e9) === '€1.8B', `marktcap rekent mee, was ${fmtMarktcap(2e9)}`);
  zetValutaStand({ valuta: 'USD', eurPerUsd: null });

  console.log('format.ts self-check geslaagd');
}
