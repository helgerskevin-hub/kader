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
}

export function nieuweId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
