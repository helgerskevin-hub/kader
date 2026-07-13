import { Candle } from './types';
import { ema as berekenEma } from './indicators';

export type Klimaat = 'gunstig' | 'gemengd' | 'ongunstig';

export interface Marktklimaat {
  klimaat: Klimaat;
  btcBovenEma50: boolean;
  breedte: number; // aandeel van het universum boven de eigen 50-daags EMA, 0-1
  breedteStijgend: boolean;
}

const EMA_LANG = 50;
const MIN_CANDLES = EMA_LANG + 5;
// Vergelijk de breedte van nu met de breedte 20 candles terug, zelfde venster als de backtest
// gebruikte om "stijgende breedte" te meten (app/scripts/backtest.ts, meting D).
const BREEDTE_TERUGKIJK = 20;
// Onder dit aantal coins is een breedtecijfer te ruisig om iets te betekenen (zelfde ondergrens
// als de backtest hanteerde).
const MIN_COINS_VOOR_BREEDTE = 20;

function bovenEigenEma50(candles: Candle[], terug = 0): boolean | null {
  if (candles.length < MIN_CANDLES + terug) return null;
  const close = candles.map(c => c.close);
  const ema50 = berekenEma(close, EMA_LANG);
  const i = close.length - 1 - terug;
  return close[i] > ema50[i];
}

// Bepaalt het marktklimaat op basis van BTC t.o.v. zijn eigen EMA50 en de richting van de
// marktbreedte (aandeel van het universum boven de eigen EMA50). Beide gunstig: gunstig klimaat,
// gemeten +0,20 R gemiddeld tegenover +0,15 R zonder deze poort. Beide ongunstig: precies het
// soort klimaat (2018, 2022, begin 2026) waarin koopsignalen historisch gemiddeld geld verloren.
// Geeft null terug als er te weinig historie is; de aanroeper moet dat behandelen als "geen poort"
// (zie poortOpen), een verzonnen klimaat is erger dan geen klimaat.
export function bepaalKlimaat(btcCandles: Candle[], universumCandles: Candle[][]): Marktklimaat | null {
  const btcBovenEma50 = bovenEigenEma50(btcCandles);
  if (btcBovenEma50 === null) return null;

  const nu: boolean[] = [];
  const verleden: boolean[] = [];
  for (const candles of universumCandles) {
    const b = bovenEigenEma50(candles);
    const v = bovenEigenEma50(candles, BREEDTE_TERUGKIJK);
    if (b !== null) nu.push(b);
    if (v !== null) verleden.push(v);
  }
  if (nu.length < MIN_COINS_VOOR_BREEDTE || verleden.length < MIN_COINS_VOOR_BREEDTE) return null;

  const breedte = nu.filter(Boolean).length / nu.length;
  const breedteVerleden = verleden.filter(Boolean).length / verleden.length;
  const breedteStijgend = breedte > breedteVerleden;

  const klimaat: Klimaat =
    btcBovenEma50 && breedteStijgend ? 'gunstig'
      : !btcBovenEma50 && !breedteStijgend ? 'ongunstig'
        : 'gemengd';

  return { klimaat, btcBovenEma50, breedte, breedteStijgend };
}

// De poort voor KOOP-signalen: alleen open bij een gunstig klimaat, exact de gate die de backtest
// mat. Zonder klimaatdata blijft de poort open: geen data is geen reden om te blokkeren.
export function poortOpen(klimaat: Marktklimaat | null): boolean {
  if (!klimaat) return true;
  return klimaat.klimaat === 'gunstig';
}
