import type { Candle } from '../engine/types';
import { useDagKoersen } from './useDagKoersen';

const BTC = ['BTC'];

// BTC-dagcandles voor de benchmark in Historie. Null zolang ze er niet zijn of als ophalen mislukte:
// dan geen benchmark, geen gok.
export function useBtcKoersen(actief: boolean): Candle[] | null {
  return useDagKoersen(BTC, actief).BTC ?? null;
}
