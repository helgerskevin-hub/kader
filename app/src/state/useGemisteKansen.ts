import { useMemo } from 'react';
import { bepaalGemisteKansen, GemistItem } from '../engine/gemisteKansen';
import { usePortfolio } from './PortfolioProvider';
import { useSignaalBoek } from './signaalBoek';

// De gemiste kansen uit het signaalboek tegen je trades. Alle trades tellen, ook demo: wie een
// signaal in demo volgde heeft het niet gemist.
export function useGemisteKansen(actief: boolean, bijwerken = true): { items: GemistItem[] | null; bezig: boolean } {
  const { signalen, bezig } = useSignaalBoek(actief, bijwerken);
  const { trades } = usePortfolio();
  const items = useMemo(() => (signalen ? bepaalGemisteKansen(signalen, trades) : null), [signalen, trades]);
  return { items, bezig };
}
