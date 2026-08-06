export interface PortfolioTrade {
  id: string;
  symbool: string;
  naam: string;
  entryPrijs: number;
  stopLoss: number;
  takeProfit: number;
  rr: number;
  datum: string;
  status: 'open' | 'gewonnen' | 'verloren';
  notitie?: string;
  bedragUsd?: number;
  aantalCoins?: number;
  exitPrijs?: number;
  slotDatum?: string;
  slotTijd?: number;            // epoch ms bij sluiten, voor chronologische historie
  // Werkelijk gerealiseerd resultaat in dollars, inclusief kosten (eToro's netProfit). Alleen
  // gevuld voor trades die uit eToro komen; bij handmatige trades kennen we de kosten niet en
  // rekent statistieken.ts het bruto koersverschil uit. Zonder dit veld zou het totaalresultaat
  // altijd bruto zijn terwijl het trefferpercentage netto is, en die twee spreken elkaar tegen.
  resultaatUsd?: number;
  etoroPositionID?: number;
  // Nodig om deze positie via de API te kunnen sluiten; het sluit-endpoint wil naast het
  // positionID ook het instrumentID. Ontbreekt bij alles wat vóór de handelskoppeling is
  // geïmporteerd, en herstelt zichzelf bij de volgende sync.
  etoroInstrumentID?: number;
  // In welke eToro-omgeving deze positie staat. Ontbreekt = 'real', want alles van vóór deze
  // versie kwam uit een echt account. Een echt positionID naar het demo-endpoint sturen (of
  // andersom) is een slechte afloop, dus de verkoopknop hangt hierop.
  etoroOmgeving?: 'real' | 'demo';
  bron?: 'etoro' | 'handmatig';
}

export function nieuweId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Bestaande opgeslagen trades hebben geen `bron`; die zijn per definitie handmatig ingevoerd,
// eToro-import zet het veld altijd expliciet. Dus geen migratie nodig, alleen deze fallback.
export function bronVan(t: PortfolioTrade): 'etoro' | 'handmatig' {
  return t.bron === 'etoro' ? 'etoro' : 'handmatig';
}
