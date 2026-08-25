// Waar een melding over gaat, zodat je er in de app naartoe kunt tikken.
//
// Staat los van de meldingstekst omdat het meeschrijft in AsyncStorage: het meldingenlog blijft
// bewaard over app-updates heen. Alles hier moet dus JSON zijn en tegen een oude of half kapotte
// opgeslagen waarde kunnen (zie leesDoel).

export type MeldingDoel =
  // Een positie in je portfolio. `symbool` staat er naast het id bij als terugval: een trade die
  // opnieuw uit eToro is geïmporteerd kan een ander id hebben gekregen.
  | { soort: 'trade'; tradeId: string; symbool: string }
  // Een coin die je (nog) niet hebt, zoals bij een koopsignaal. Hoort thuis op het Marktscherm.
  | { soort: 'coin'; symbool: string }
  // Gaat over je posities als geheel, niet over één trade.
  | { soort: 'portfolio' }
  // Gaat over de markt als geheel, zoals een omslag van het klimaat.
  | { soort: 'markt' };

function tekst(waarde: unknown): string | null {
  return typeof waarde === 'string' && waarde.length > 0 ? waarde : null;
}

/**
 * Leest een doel uit de opslag. Geeft null bij alles wat niet klopt, en dat is de bedoeling:
 * meldingen van vóór deze versie hebben helemaal geen doel, en die horen gewoon leesbaar te
 * blijven in de lijst in plaats van een lege tik op te leveren.
 */
export function leesDoel(ruw: unknown): MeldingDoel | null {
  if (ruw === null || typeof ruw !== 'object') return null;
  const soort = (ruw as { soort?: unknown }).soort;

  if (soort === 'trade') {
    const tradeId = tekst((ruw as { tradeId?: unknown }).tradeId);
    const symbool = tekst((ruw as { symbool?: unknown }).symbool);
    return tradeId && symbool ? { soort: 'trade', tradeId, symbool } : null;
  }
  if (soort === 'coin') {
    const symbool = tekst((ruw as { symbool?: unknown }).symbool);
    return symbool ? { soort: 'coin', symbool } : null;
  }
  if (soort === 'portfolio') return { soort: 'portfolio' };
  if (soort === 'markt') return { soort: 'markt' };
  return null;
}
