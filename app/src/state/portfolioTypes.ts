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
  bron?: 'etoro' | 'handmatig';
}

export function nieuweId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
