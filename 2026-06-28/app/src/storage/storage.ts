import AsyncStorage from '@react-native-async-storage/async-storage';
import { TraderBeoordeling } from '../engine/etoroAuditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface OpenTrade {
  id: string;
  symbool: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  aantal: number;       // 0 = niet ingevuld
  datumOpen: string;    // ISO string
}

export interface GeslotenTrade extends OpenTrade {
  slotPrijs: number;
  datumGesloten: string;
  resultaatPct: number;
  resultaatEur: number;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------
const KEY_ONBOARDING = 'kader_onboarding_done';
const KEY_OPEN       = 'kader_open_trades';
const KEY_GESLOTEN   = 'kader_gesloten_trades';
const KEY_TRADERS    = 'kader_traders';

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------
export async function isOnboardingGedaan(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY_ONBOARDING)) === 'true'; }
  catch { return false; }
}

export async function markeerOnboardingGedaan(): Promise<void> {
  await AsyncStorage.setItem(KEY_ONBOARDING, 'true');
}

// ---------------------------------------------------------------------------
// Open trades
// ---------------------------------------------------------------------------
export async function laadOpenTrades(): Promise<OpenTrade[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_OPEN);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function slaOpenTradesOp(trades: OpenTrade[]): Promise<void> {
  await AsyncStorage.setItem(KEY_OPEN, JSON.stringify(trades));
}

export async function voegTradeToe(trade: Omit<OpenTrade, 'id' | 'datumOpen'>): Promise<OpenTrade> {
  const trades = await laadOpenTrades();
  const nieuw: OpenTrade = { ...trade, id: Date.now().toString(), datumOpen: new Date().toISOString() };
  await slaOpenTradesOp([...trades, nieuw]);
  return nieuw;
}

export async function sluitTrade(id: string, slotPrijs: number): Promise<void> {
  const open = await laadOpenTrades();
  const trade = open.find(t => t.id === id);
  if (!trade) return;

  const resultaatPct = ((slotPrijs - trade.entry) / trade.entry) * 100;
  const resultaatEur = trade.aantal > 0 ? (slotPrijs - trade.entry) * trade.aantal : 0;
  const gesloten: GeslotenTrade = {
    ...trade,
    slotPrijs,
    datumGesloten: new Date().toISOString(),
    resultaatPct: Math.round(resultaatPct * 100) / 100,
    resultaatEur: Math.round(resultaatEur * 100) / 100,
  };

  const bestaandeGesloten = await laadGeslotenTrades();
  await AsyncStorage.setItem(KEY_GESLOTEN, JSON.stringify([gesloten, ...bestaandeGesloten]));
  await slaOpenTradesOp(open.filter(t => t.id !== id));
}

export async function verwijderTrade(id: string): Promise<void> {
  const trades = await laadOpenTrades();
  await slaOpenTradesOp(trades.filter(t => t.id !== id));
}

// ---------------------------------------------------------------------------
// Gesloten trades
// ---------------------------------------------------------------------------
export async function laadGeslotenTrades(): Promise<GeslotenTrade[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_GESLOTEN);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Traders (eToro beoordelingen)
// ---------------------------------------------------------------------------
export async function laadTraders(): Promise<TraderBeoordeling[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_TRADERS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function slaTraderOp(b: TraderBeoordeling): Promise<void> {
  const traders = await laadTraders();
  const bijgewerkt = [b, ...traders.filter(t => t.naam !== b.naam)];
  await AsyncStorage.setItem(KEY_TRADERS, JSON.stringify(bijgewerkt));
}

export async function verwijderTrader(naam: string): Promise<void> {
  const traders = await laadTraders();
  await AsyncStorage.setItem(KEY_TRADERS, JSON.stringify(traders.filter(t => t.naam !== naam)));
}
