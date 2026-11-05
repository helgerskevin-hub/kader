import { useEffect, useState } from 'react';
import type { Candle } from '../engine/types';
import { haalData } from '../engine/marketData';

// BTC-dagcandles voor de benchmark in Historie. Een uur bewaard, zodat Historie open- en dichtdoen
// niet elke keer opnieuw ophaalt. Mislukt het ophalen, dan null: dan geen benchmark, geen gok.
const BEWAAR_MS = 60 * 60 * 1000;
let cache: { tijd: number; candles: Candle[] } | null = null;

export function useBtcKoersen(actief: boolean): Candle[] | null {
  const [candles, setCandles] = useState<Candle[] | null>(cache?.candles ?? null);

  useEffect(() => {
    if (!actief) return;
    if (cache && Date.now() - cache.tijd < BEWAAR_MS) { setCandles(cache.candles); return; }
    let actiefNog = true;
    haalData('BTC')
      .then(d => {
        if (!d || !d.candles.every(c => typeof c.tijd === 'number')) return;
        cache = { tijd: Date.now(), candles: d.candles };
        if (actiefNog) setCandles(d.candles);
      })
      .catch(() => {});
    return () => { actiefNog = false; };
  }, [actief]);

  return candles;
}
