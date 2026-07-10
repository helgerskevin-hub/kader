import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { PortfolioTrade } from './portfolioTypes';
import { haalLaatstePrijzen } from '../engine/marketData';
import { laadLijst, bewaarLijst, laadTekst, SLEUTELS } from '../storage/opslag';
import { importeerEtoroPortfolio, haalEtoroSluitingen, EtoroOvergeslagenPositie, EtoroSluiting } from '../engine/etoro';

export interface SyncResultaat {
  gekoppeld: boolean;                          // false = geen eToro-sleutels ingesteld
  toegevoegd: number;
  bijgewerkt: number;
  gesloten: number;
  overgeslagen: EtoroOvergeslagenPositie[];
  fout: string | null;                         // eToro-fout; prijzen zijn dan wel ververst
}

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
  synchroniseer: () => Promise<SyncResultaat>;
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
  const startSyncGedaan = useRef(false);

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

  // Het interval ververst alleen prijzen. Geen eToro-sync: die endpoints delen een quotum van
  // 60 requests per 60 seconden, dat is bij een minuut-interval zo op.
  useEffect(() => {
    if (!geladen) return;
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

  // Een positie die op eToro gesloten is, verdwijnt uit /trading/info/portfolio. Zonder deze
  // stap blijft de lokale trade eeuwig 'open' staan. netProfit (inclusief fees) bepaalt of het
  // een winst of verlies was, niet de vergelijking van closeRate met de entryprijs.
  const sluitEtoroTrades = useCallback((sluitingen: EtoroSluiting[]): number => {
    const perPositie = new Map(sluitingen.map(s => [s.positionID, s]));
    const teSluiten = tradesRef.current.filter(
      t => t.bron === 'etoro' && t.status === 'open' && t.etoroPositionID !== undefined && perPositie.has(t.etoroPositionID),
    ).length;
    if (teSluiten === 0) return 0;

    setTrades(prev => prev.map(t => {
      if (t.bron !== 'etoro' || t.status !== 'open' || t.etoroPositionID === undefined) return t;
      const sluiting = perPositie.get(t.etoroPositionID);
      if (!sluiting) return t;
      return {
        ...t,
        status: sluiting.netProfit >= 0 ? 'gewonnen' : 'verloren',
        exitPrijs: sluiting.exitPrijs,
        slotTijd: sluiting.slotTijd,
        slotDatum: new Date(sluiting.slotTijd).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }),
      };
    }));
    return teSluiten;
  }, []);

  // Volledige sync: prijzen, open eToro-posities en op eToro gesloten posities. Gedeeld door
  // pull-to-refresh, de importknop en de eenmalige sync bij het openen van de app.
  // eToro-fouten worden teruggegeven, niet gegooid: de prijsververs uit stap 1 blijft geldig.
  const synchroniseer = useCallback(async (): Promise<SyncResultaat> => {
    const leeg: SyncResultaat = { gekoppeld: false, toegevoegd: 0, bijgewerkt: 0, gesloten: 0, overgeslagen: [], fout: null };
    await verversPrijzen();

    const [apiKey, userKey] = await Promise.all([
      laadTekst(SLEUTELS.etoroApiKey, ''),
      laadTekst(SLEUTELS.etoroUserKey, ''),
    ]);
    if (!apiKey || !userKey) return leeg;

    try {
      const [{ trades: etoroTrades, overgeslagen }, sluitingen] = await Promise.all([
        importeerEtoroPortfolio({ apiKey, userKey }),
        haalEtoroSluitingen({ apiKey, userKey }),
      ]);
      const toegevoegd = importeerEtoroTrades(etoroTrades);
      const gesloten = sluitEtoroTrades(sluitingen);
      return {
        gekoppeld: true,
        toegevoegd,
        bijgewerkt: etoroTrades.length - toegevoegd,
        gesloten,
        overgeslagen,
        fout: null,
      };
    } catch (e) {
      return { ...leeg, gekoppeld: true, fout: e instanceof Error ? e.message : 'Onbekende fout.' };
    }
  }, [verversPrijzen, importeerEtoroTrades, sluitEtoroTrades]);

  // Eenmalig bij het openen van de app: volledige sync zodra de opgeslagen trades geladen zijn.
  // De ref voorkomt een tweede ronde als React het effect opnieuw draait (StrictMode, remount).
  useEffect(() => {
    if (!geladen || startSyncGedaan.current) return;
    startSyncGedaan.current = true;
    synchroniseer();
  }, [geladen, synchroniseer]);

  return (
    <PortfolioContext.Provider value={{
      trades, livePrijzen, geladen, syncing, volgendeVerversing,
      voegTradeToe, wijzigTrade, sluitTrade, verwijderTrade, verversPrijzen, importeerEtoroTrades,
      synchroniseer,
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
