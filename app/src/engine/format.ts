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

// R/R weergave
export function fmtRR(rr: number): string {
  return `1 : ${rr.toFixed(1)}`;
}

// Score als geheel getal
export function fmtScore(score: number): string {
  return Math.round(score).toString();
}

// Marktcap (miljarden / miljoenen)
export function fmtMarktcap(cap: number): string {
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toFixed(0)}`;
}
