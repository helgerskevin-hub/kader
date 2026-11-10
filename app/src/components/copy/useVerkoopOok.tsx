// "Verkoop ook": stapt een trader uit een positie die jij via Kader kopieerde, dan kun je in één tik
// de verkoopsheet voor jouw positie openen. Verkopen gebeurt pas na de bevestigknop daar; Kader
// verkoopt nooit zelf.
import React, { useCallback, useMemo, useState } from 'react';
import { VerkoopOrderSheet } from '../VerkoopOrderSheet';
import { usePortfolio } from '../../state/PortfolioProvider';
import { useCopy } from '../../state/CopyProvider';
import { isEtoroBestuurbaar } from '../../state/etoroBestuurbaar';
import type { FeedItem } from '../../state/copyOpslag';
import type { PortfolioTrade } from '../../state/portfolioTypes';

export function useVerkoopOok() {
  const { trades, livePrijzen, omgeving, magHandelen } = usePortfolio();
  const { herkomst } = useCopy();
  // De trade zoals hij was toen je tikte. De sheet krijgt de verse versie zolang de sync hem nog
  // heeft (een bijgewerkt aantal of niveau na een sync), en houdt de oude alleen vast als hij net
  // verdween, bijvoorbeeld tijdens het vinkje na een geslaagde verkoop.
  const [gekozen, setGekozen] = useState<PortfolioTrade | null>(null);

  // Jouw open, via eToro te verkopen positie per eToro-positie-id.
  const verkoopbaar = useMemo(() => {
    const kaart = new Map<number, PortfolioTrade>();
    if (!magHandelen) return kaart;
    for (const t of trades) {
      if (typeof t.etoroPositionID === 'number' && isEtoroBestuurbaar(t, omgeving)) kaart.set(t.etoroPositionID, t);
    }
    return kaart;
  }, [trades, omgeving, magHandelen]);

  // Alleen voor een feedregel die de trader sloot en die jij kopieerde en nog open hebt.
  const tradeVoor = useCallback((item: FeedItem): PortfolioTrade | null => {
    if (!item.gesloten) return null;
    const h = herkomst.find(x => x.username === item.username && x.bronPositieId === item.positionId
      && x.omgeving === omgeving && typeof x.etoroPositionID === 'number');
    return h ? verkoopbaar.get(h.etoroPositionID as number) ?? null : null;
  }, [herkomst, verkoopbaar, omgeving]);

  const trade = gekozen
    ? trades.find(t => t.id === gekozen.id && t.status === 'open') ?? gekozen
    : null;

  const sheet = trade ? (
    <VerkoopOrderSheet
      zichtbaar
      trade={trade}
      huidigePrijs={livePrijzen[trade.symbool]}
      onSluiten={() => setGekozen(null)}
    />
  ) : null;

  return { tradeVoor, verkoopbaar, open: setGekozen, sheet };
}
