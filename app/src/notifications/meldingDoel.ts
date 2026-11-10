// Waar een melding over gaat, zodat je er in de app naartoe kunt tikken.
//
// Staat los van de meldingstekst omdat het meeschrijft in AsyncStorage: het meldingenlog blijft
// bewaard over app-updates heen. Alles hier moet dus JSON zijn en tegen een oude of half kapotte
// opgeslagen waarde kunnen (zie leesDoel).

export type MeldingDoel =
  // Een positie in je portfolio. `symbool` staat er naast het id bij als terugval: een trade die
  // opnieuw uit eToro is geïmporteerd kan een ander id hebben gekregen.
  //
  // `voorstelStop` staat er alleen bij de melding "stop aantrekken": een tik opent dan het
  // stop-venster met dit niveau al ingevuld. Optioneel, zodat oude logregels zonder dit veld gewoon
  // als gewone trade-tik blijven werken. Het is een voorstel: verzetten gebeurt pas na de
  // bevestigknop in dat venster, nooit vanuit de melding zelf.
  //
  // `verkoop` staat er bij "je trader stapte uit": een tik opent dan de verkoopsheet voor deze
  // positie. Ook dat is alleen een voorstel; verkopen gebeurt pas na de bevestigknop daar. Bij
  // `verkoop` horen `etoroPositionID` en `omgeving`: alleen precies die positie mag de verkoopsheet
  // openen, nooit een andere in dezelfde coin of in de andere omgeving.
  | {
    soort: 'trade'; tradeId: string; symbool: string; voorstelStop?: number;
    verkoop?: boolean; etoroPositionID?: number; omgeving?: 'real' | 'demo';
  }
  // Een coin die je (nog) niet hebt, zoals bij een koopsignaal. Hoort thuis op het Marktscherm.
  | { soort: 'coin'; symbool: string }
  // Gaat over je posities als geheel, niet over één trade.
  | { soort: 'portfolio' }
  // Gaat over de markt als geheel, zoals een omslag van het klimaat.
  | { soort: 'markt' }
  // Een trade van een favoriete belegger in de Copy-tab. `sleutel` is "username:positionId" van de
  // feedregel; een tik opent de koopsheet voor die trade als hij nog te kopiëren is.
  // segment 'mijn' opent Copy op Mijn copies (vanaf de kapitaalkaart op Portfolio).
  | { soort: 'copy'; sleutel?: string; segment?: 'mijn' };

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
    if (!tradeId || !symbool) return null;
    const voorstel = (ruw as { voorstelStop?: unknown }).voorstelStop;
    const basis = typeof voorstel === 'number' && Number.isFinite(voorstel) && voorstel > 0
      ? { soort: 'trade' as const, tradeId, symbool, voorstelStop: voorstel }
      : { soort: 'trade' as const, tradeId, symbool };
    // Een verkoopdoel zonder exacte positie en omgeving is geen verkoopdoel: dan gewoon de trade.
    const r = ruw as { verkoop?: unknown; etoroPositionID?: unknown; omgeving?: unknown };
    if (r.verkoop === true && typeof r.etoroPositionID === 'number' && Number.isFinite(r.etoroPositionID)
      && (r.omgeving === 'real' || r.omgeving === 'demo')) {
      return { ...basis, verkoop: true, etoroPositionID: r.etoroPositionID, omgeving: r.omgeving };
    }
    return basis;
  }
  if (soort === 'coin') {
    const symbool = tekst((ruw as { symbool?: unknown }).symbool);
    return symbool ? { soort: 'coin', symbool } : null;
  }
  if (soort === 'portfolio') return { soort: 'portfolio' };
  if (soort === 'markt') return { soort: 'markt' };
  if (soort === 'copy') {
    const sleutel = tekst((ruw as { sleutel?: unknown }).sleutel);
    if (sleutel) return { soort: 'copy', sleutel };
    return (ruw as { segment?: unknown }).segment === 'mijn' ? { soort: 'copy', segment: 'mijn' } : { soort: 'copy' };
  }
  return null;
}
