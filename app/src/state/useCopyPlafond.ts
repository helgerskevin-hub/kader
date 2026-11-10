import { useCallback, useMemo } from 'react';
import { fmtBedrag } from '../engine/format';
import { useCopy } from './CopyProvider';
import { usePortfolio } from './PortfolioProvider';
import { useHandelskapitaal } from './useHandelskapitaal';
import { copyAandeel } from './kapitaalVerdeling';
import { copyPlafond } from './mijnCopies';

const DOLLARS = { valuta: 'USD' } as const;

// Hoeveel er nu in copies zit tegenover het plafond uit de Copy-instellingen. Dezelfde telling als
// de verdeling op Portfolio: Kader-copies op de live koers plus het geld in CopyTrader-relaties.
export function useCopyPlafond() {
  const { trades, livePrijzen, omgeving } = usePortfolio();
  const { herkomst, instellingen } = useCopy();
  const { kapitaal, stand } = useHandelskapitaal();
  const maxPct = instellingen.maxCopiesPct;

  const copiesUsd = useMemo(
    () => copyAandeel({ trades, herkomst, livePrijzen, omgeving, copyTraderUsd: stand?.inCopiesUsd ?? 0 }).copiesUsd,
    [trades, herkomst, livePrijzen, omgeving, stand],
  );
  const plafond = useMemo(() => copyPlafond({ copiesUsd, kapitaal, maxPct }), [copiesUsd, kapitaal, maxPct]);

  // Voor de koopsheet: komt deze kopie boven de grens, zeg dat dan, met de getallen erbij.
  const waarschuwing = useCallback((bedragUsd: number): string | null => {
    const p = copyPlafond({ copiesUsd, kapitaal, maxPct, extraUsd: bedragUsd });
    if (!p || !p.boven) return null;
    return `Met deze kopie zit er ${fmtBedrag(copiesUsd + bedragUsd, DOLLARS)} in copies. Je grens is ${maxPct}% van je kapitaal, ${fmtBedrag(p.grensUsd, DOLLARS)}. Kopen kan, maar het is meer dan je jezelf toestond.`;
  }, [copiesUsd, kapitaal, maxPct]);

  return { copiesUsd, kapitaal, maxPct, plafond, waarschuwing };
}
