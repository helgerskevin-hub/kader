import { useEffect, useMemo, useState } from 'react';
import type { Candle } from '../engine/types';
import { haalData } from '../engine/marketData';

// Dagcandles per coin, een uur bewaard en gedeeld tussen schermen. Voor de BTC-benchmark in
// Historie en de spreiding op Portfolio en in de kooporder. Mislukt een coin, dan ontbreekt hij in
// het resultaat: geen koers is beter dan een verzonnen koers.
const BEWAAR_MS = 60 * 60 * 1000;
const cache = new Map<string, { tijd: number; candles: Candle[] }>();
const onderweg = new Map<string, Promise<void>>();

function vers(symbool: string): Candle[] | null {
  const c = cache.get(symbool);
  return c && Date.now() - c.tijd < BEWAAR_MS ? c.candles : null;
}

function haal(symbool: string): Promise<void> {
  const bezig = onderweg.get(symbool);
  if (bezig) return bezig;
  const p = haalData(symbool)
    .then(d => {
      if (d && d.candles.every(c => typeof c.tijd === 'number')) cache.set(symbool, { tijd: Date.now(), candles: d.candles });
    })
    .catch(() => {})
    .finally(() => onderweg.delete(symbool));
  onderweg.set(symbool, p);
  return p;
}

function uitCache(symbolen: string[]): Record<string, Candle[]> {
  const uit: Record<string, Candle[]> = {};
  for (const s of symbolen) { const c = vers(s) ?? cache.get(s)?.candles; if (c) uit[s] = c; }
  return uit;
}

export function useDagKoersen(symbolen: string[], actief: boolean): Record<string, Candle[]> {
  const sleutel = [...new Set(symbolen)].sort().join(',');
  const lijst = useMemo(() => (sleutel ? sleutel.split(',') : []), [sleutel]);
  const [koersen, setKoersen] = useState<Record<string, Candle[]>>(() => uitCache(lijst));

  useEffect(() => {
    if (!actief || lijst.length === 0) return;
    let nogActief = true;
    setKoersen(uitCache(lijst));
    const ontbreekt = lijst.filter(s => !vers(s));
    if (ontbreekt.length === 0) return;
    Promise.all(ontbreekt.map(haal)).then(() => { if (nogActief) setKoersen(uitCache(lijst)); });
    return () => { nogActief = false; };
  }, [actief, lijst]);

  return koersen;
}
