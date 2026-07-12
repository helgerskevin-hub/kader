// NL-getallenvormaat voor prijzen, percentages en R/R
// Gebruik IBM Plex Mono + fontVariant: ['tabular-nums'] in de StyleSheet.

export function fmtPrijs(p: number): string {
  if (p >= 100) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}`;
}

// Percentage met expliciet +/− teken, NL-komma voor decimalen
export function fmtPct(p: number, decimals = 1): string {
  const teken = p >= 0 ? '+' : '−';
  return `${teken}${Math.abs(p).toFixed(decimals)}%`;
}

// Resultaat in dollars, met expliciet +/− teken. Zonder het minteken leest een verlies van
// $4,21 als een winst.
export function fmtResultaatUsd(n: number): string {
  const teken = n >= 0 ? '+' : '−';
  return `${teken}$${Math.abs(n).toFixed(2)}`;
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
export function fmtMarktcap(cap: number): string {
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toFixed(0)}`;
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/format.ts`
if (require.main === module) {
  console.assert(fmtResultaatUsd(4.21) === '+$4.21', 'winst krijgt een plus');
  console.assert(fmtResultaatUsd(-4.21) === '−$4.21', `verlies krijgt een minteken, was ${fmtResultaatUsd(-4.21)}`);
  console.assert(fmtResultaatUsd(0) === '+$0.00', 'nul telt als niet-negatief');
  console.assert(fmtPct(-16.8) === '−16.8%', 'percentage krijgt een minteken');

  console.log('format.ts self-check geslaagd');
}
