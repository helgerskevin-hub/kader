import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { PortfolioTrade } from './portfolioTypes';
import { haalLaatstePrijzen } from '../engine/marketData';
import { laadLijst, bewaarLijst, SLEUTELS } from '../storage/opslag';

interface PortfolioContextWaarde {
  trades: PortfolioTrade[];
  livePrijzen: Record<string, number>;
  geladen: boolean;
  syncing: boolean;
  volgendeVerversing: Date | null;
  voegTradeToe: (trade: PortfolioTrade) => void;
  wijzigTrade: (trade: PortfolioTrade) => void;
  sluitTrade: (id: string, status: 'gewonnen' | 'verloren', exitPrijs: number) => void;
  verwijderTrade: (id: string) => void;
  verversPrijzen: () => Promise<void>;
  importeerEtoroTrades: (nieuwe: PortfolioTrade[]) => number;
}

const PortfolioContext = createContext<PortfolioContextWaarde | null>(null);

const VERVERS_INTERVAL_MS = 60_000;

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [trades, setTrades] = useState<PortfolioTrade[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [livePrijzen, setLivePrijzen] = useState<Record<string, number>>({});
  const [syncing, setSyncing] = useState(false);
  const [volgendeVerversing, setVolgendeVerversing] = useState<Date | null>(null);
  const tradesRef = useRef(trades);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { tradesRef.current = trades; }, [trades]);

  useEffect(() => {
    laadLijst<PortfolioTrade>(SLEUTELS.portfolio).then(l => {
      setTrades(l);
      setGeladen(true);
    });
  }, []);

  useEffect(() => {
    if (geladen) bewaarLijst(SLEUTELS.portfolio, trades);
  }, [trades, geladen]);

  const verversPrijzen = useCallback(async () => {
    const openSymbolen = tradesRef.current
      .filter(t => t.status === 'open')
      .map(t => t.symbool);
    if (openSymbolen.length === 0) {
      setVolgendeVerversing(new Date(Date.now() + VERVERS_INTERVAL_MS));
      return;
    }
    setSyncing(true);
    try {
      const prijzen = await haalLaatstePrijzen(openSymbolen);
      setLivePrijzen(prev => ({ ...prev, ...prijzen }));
    } finally {
      setSyncing(false);
      setVolgendeVerversing(new Date(Date.now() + VERVERS_INTERVAL_MS));
    }
  }, []);

  useEffect(() => {
    if (!geladen) return;
    verversPrijzen();
    intervalRef.current = setInterval(verversPrijzen, VERVERS_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [geladen, verversPrijzen]);

  const voegTradeToe = useCallback((trade: PortfolioTrade) => {
    setTrades(prev => [trade, ...prev]);
  }, []);

  const wijzigTrade = useCallback((trade: PortfolioTrade) => {
    setTrades(prev => prev.map(t => t.id === trade.id ? trade : t));
  }, []);

  // exitPrijs komt expliciet uit het sluit-modaal (voorgevuld met TP/SL, door de gebruiker
  // te overschrijven met de werkelijke verkoopprijs), zodat trefferpercentage en behaald
  // resultaat niet meer uiteen kunnen lopen.
  const sluitTrade = useCallback((id: string, status: 'gewonnen' | 'verloren', exitPrijs: number) => {
    setTrades(prev => prev.map(t => {
      if (t.id !== id) return t;
      const nu = new Date();
      const slotDatum = nu.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
      return { ...t, status, exitPrijs, slotDatum, slotTijd: nu.getTime() };
    }));
  }, []);

  const verwijderTrade = useCallback((id: string) => {
    setTrades(prev => prev.filter(t => t.id !== id));
  }, []);

  // Dedupliceert op etoroPositionID: bestaande geïmporteerde trade wordt bijgewerkt (entry/bedrag/
  // aantal/SL/TP), handmatige trades blijven onaangeroerd. Retourneert het aantal nieuw toegevoegde
  // (berekend via tradesRef, want setTrades' updater draait niet gegarandeerd voor de return).
  const importeerEtoroTrades = useCallback((nieuwe: PortfolioTrade[]): number => {
    const huidig = tradesRef.current;
    const toegevoegd = nieuwe.filter(
      t => !huidig.some(h => h.etoroPositionID === t.etoroPositionID),
    ).length;

    setTrades(prev => {
      const resultaat = [...prev];
      for (const trade of nieuwe) {
        const index = resultaat.findIndex(t => t.etoroPositionID === trade.etoroPositionID);
        if (index >= 0) {
          resultaat[index] = { ...trade, id: resultaat[index].id, status: resultaat[index].status };
        } else {
          resultaat.unshift(trade);
        }
      }
      return resultaat;
    });
    return toegevoegd;
  }, []);

  return (
    <PortfolioContext.Provider value={{
      trades, livePrijzen, geladen, syncing, volgendeVerversing,
      voegTradeToe, wijzigTrade, sluitTrade, verwijderTrade, verversPrijzen, importeerEtoroTrades,
    }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio(): PortfolioContextWaarde {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio moet binnen PortfolioProvider gebruikt worden');
  return ctx;
}
