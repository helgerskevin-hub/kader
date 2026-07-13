import { useCallback, useEffect, useState } from 'react';
import { laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';

export type Weergave = 'uitgebreid' | 'compact';

// Onthoudt de gekozen weergave (uitgebreid/compact) op het Portfolio-scherm tussen app-starts.
// Standaard 'uitgebreid' zodat bestaande gebruikers na deze update niets zien veranderen.
export function useWeergave() {
  const [weergave, setWeergaveState] = useState<Weergave>('uitgebreid');

  useEffect(() => {
    laadTekst(SLEUTELS.portfolioWeergave, 'uitgebreid').then(w => {
      if (w === 'compact' || w === 'uitgebreid') setWeergaveState(w);
    });
  }, []);

  const setWeergave = useCallback((volgende: Weergave) => {
    setWeergaveState(volgende);
    bewaarTekst(SLEUTELS.portfolioWeergave, volgende);
  }, []);

  return { weergave, setWeergave };
}
