import { useEffect, useState } from 'react';
import { haalKoersRuw } from '../engine/etoro';
import { koersFactor } from '../engine/etoroSymbolen';
import { Koers, leesKoers, naarKaderKoers } from '../engine/spread';
import { actieveSleutels } from './etoroSleutels';

// Eén keer de live bied- en laatkoers ophalen als de kooporder opengaat. Geen koppeling, geen
// instrument of een fout: null, en dan toont de kooporder geen spread.
export function useSpread(instrumentId: number | null, symbool: string, zichtbaar: boolean): Koers | null {
  const [koers, setKoers] = useState<Koers | null>(null);

  useEffect(() => {
    setKoers(null);
    if (!zichtbaar || instrumentId === null) return;
    let actief = true;
    (async () => {
      try {
        const sleutels = await actieveSleutels();
        if (!sleutels) return;
        const k = leesKoers(await haalKoersRuw(instrumentId, sleutels), instrumentId);
        if (actief && k) setKoers(naarKaderKoers(k, koersFactor(symbool)));
      } catch {
        // Geen spread is beter dan een verzonnen spread.
      }
    })();
    return () => { actief = false; };
  }, [zichtbaar, instrumentId, symbool]);

  return koers;
}
