import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { PortfolioTrade } from './portfolioTypes';
import { haalLaatstePrijzen } from '../engine/marketData';
import { laadLijst, bewaarLijst, laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import { importeerEtoroPortfolio, importeerEtoroHistorie, EtoroOvergeslagenPositie } from '../engine/etoro';

export interface SyncResultaat {
  gekoppeld: boolean;                          // false = geen eToro-sleutels ingesteld
  toegevoegd: number;                          // nieuwe open posities
  bijgewerkt: number;                          // bestaande open posities ververst
  gesloten: number;                            // lokaal open, inmiddels op eToro gesloten
  uitHistorie: number;                         // afgeronde trades die Kader nog niet kende
  overgeslagen: EtoroOvergeslagenPositie[];
  fout: string | null;                         // eToro-fout; prijzen zijn dan wel ververst
}

interface PortfolioContextWaarde {
  trades: PortfolioTrade[];
  livePrijzen: Record<string, number>;
  geladen: boolean;
  syncing: boolean;
  volgendeVerversing: Date | null;
  // Epoch-ms van de laatste geslaagde verversing, of null als er nog nooit een lukte. Blijft
  // bewaard tussen app-starts, zodat "3 dagen geleden" ook na afsluiten klopt.
  laatsteSync: number | null;
  // true als de laatste poging mislukte (bijv. geen internet); stuurt de rode cloud-status aan.
  syncFout: boolean;
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
  const [laatsteSync, setLaatsteSync] = useState<number | null>(null);
  const [syncFout, setSyncFout] = useState(false);
  const tradesRef = useRef(trades);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startSyncGedaan = useRef(false);

  useEffect(() => { tradesRef.current = trades; }, [trades]);

  useEffect(() => {
    laadLijst<PortfolioTrade>(SLEUTELS.portfolio).then(l => {
      setTrades(l);
      setGeladen(true);
    });
    laadTekst(SLEUTELS.laatsteSync, '').then(t => {
      const ms = Number(t);
      if (t && Number.isFinite(ms)) setLaatsteSync(ms);
    });
  }, []);

  useEffect(() => {
    if (geladen) bewaarLijst(SLEUTELS.portfolio, trades);
  }, [trades, geladen]);

  // Eén plek die "we zijn net bijgewerkt" vastlegt: tijdstip in state en op schijf, foutvlag uit.
  const markeerGesynct = useCallback(() => {
    const nu = Date.now();
    setLaatsteSync(nu);
    setSyncFout(false);
    bewaarTekst(SLEUTELS.laatsteSync, String(nu));
  }, []);

  const verversPrijzen = useCallback(async () => {
    const openSymbolen = tradesRef.current
      .filter(t => t.status === 'open')
      .map(t => t.symbool);
    if (openSymbolen.length === 0) {
      // Niets op te halen betekent dat de portfolio per definitie actueel is.
      markeerGesynct();
      setVolgendeVerversing(new Date(Date.now() + VERVERS_INTERVAL_MS));
      return;
    }
    setSyncing(true);
    try {
      const prijzen = await haalLaatstePrijzen(openSymbolen);
      setLivePrijzen(prev => ({ ...prev, ...prijzen }));
      markeerGesynct();
    } catch {
      // Fout niet doorgooien: het minuut-interval en de foreground-listener roepen dit kaal aan.
      // De rode cloud-status maakt duidelijk dat de laatste poging mislukte.
      setSyncFout(true);
    } finally {
      setSyncing(false);
      setVolgendeVerversing(new Date(Date.now() + VERVERS_INTERVAL_MS));
    }
  }, [markeerGesynct]);

  // Het interval ververst alleen prijzen. Geen eToro-sync: die endpoints delen een quotum van
  // 60 requests per 60 seconden, dat is bij een minuut-interval zo op.
  useEffect(() => {
    if (!geladen) return;
    intervalRef.current = setInterval(verversPrijzen, VERVERS_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [geladen, verversPrijzen]);

  // Automatisch bijwerken zodra de app weer op de voorgrond komt: het interval staat stil terwijl
  // de app op de achtergrond is, dus na terugkeren zijn de koersen vaak verouderd.
  useEffect(() => {
    if (!geladen) return;
    const sub = AppState.addEventListener('change', (stand) => {
      if (stand === 'active') verversPrijzen();
    });
    return () => sub.remove();
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

  // Verwerkt de op eToro gesloten posities. Twee dingen tegelijk, in één setTrades-pass zodat
  // de tweede stap de uitkomst van de eerste ziet (tradesRef loopt een render achter):
  //  1. Een lokale trade die Kader als open kende, wordt afgesloten. Zulke posities verdwijnen
  //     uit /trading/info/portfolio en zouden anders eeuwig 'open' blijven staan. De lokale
  //     stop-loss/take-profit en notitie blijven staan, alleen de uitkomst komt van eToro.
  //  2. Een gesloten positie die Kader nooit gezien heeft, wordt als afgeronde trade toegevoegd,
  //     zodat je historie ook met terugwerkende kracht klopt.
  const verwerkEtoroHistorie = useCallback((gesloten: PortfolioTrade[]) => {
    const perPositie = new Map(
      gesloten.filter(t => t.etoroPositionID !== undefined).map(t => [t.etoroPositionID!, t]),
    );
    const huidig = tradesRef.current;
    const bekend = new Set(huidig.map(t => t.etoroPositionID).filter(id => id !== undefined));
    const afgesloten = huidig.filter(
      t => t.bron === 'etoro' && t.status === 'open' && t.etoroPositionID !== undefined && perPositie.has(t.etoroPositionID),
    ).length;
    const nieuw = gesloten.filter(t => t.etoroPositionID !== undefined && !bekend.has(t.etoroPositionID));
    if (afgesloten === 0 && nieuw.length === 0) return { afgesloten: 0, toegevoegd: 0 };

    setTrades(prev => {
      const bijgewerkt = prev.map(t => {
        if (t.bron !== 'etoro' || t.status !== 'open' || t.etoroPositionID === undefined) return t;
        const uitEtoro = perPositie.get(t.etoroPositionID);
        if (!uitEtoro) return t;
        return {
          ...t,
          status: uitEtoro.status,
          exitPrijs: uitEtoro.exitPrijs,
          slotDatum: uitEtoro.slotDatum,
          slotTijd: uitEtoro.slotTijd,
        };
      });
      const alBekend = new Set(bijgewerkt.map(t => t.etoroPositionID).filter(id => id !== undefined));
      const echtNieuw = gesloten.filter(t => t.etoroPositionID !== undefined && !alBekend.has(t.etoroPositionID));
      return [...echtNieuw, ...bijgewerkt];
    });
    return { afgesloten, toegevoegd: nieuw.length };
  }, []);

  // Volledige sync: prijzen, open eToro-posities en op eToro gesloten posities. Gedeeld door
  // pull-to-refresh, de importknop en de eenmalige sync bij het openen van de app.
  // eToro-fouten worden teruggegeven, niet gegooid: de prijsververs uit stap 1 blijft geldig.
  const synchroniseer = useCallback(async (): Promise<SyncResultaat> => {
    const leeg: SyncResultaat = { gekoppeld: false, toegevoegd: 0, bijgewerkt: 0, gesloten: 0, uitHistorie: 0, overgeslagen: [], fout: null };
    await verversPrijzen();

    const [apiKey, userKey] = await Promise.all([
      laadTekst(SLEUTELS.etoroApiKey, ''),
      laadTekst(SLEUTELS.etoroUserKey, ''),
    ]);
    if (!apiKey || !userKey) return leeg;

    try {
      const [open, historie] = await Promise.all([
        importeerEtoroPortfolio({ apiKey, userKey }),
        importeerEtoroHistorie({ apiKey, userKey }),
      ]);
      const toegevoegd = importeerEtoroTrades(open.trades);
      const { afgesloten, toegevoegd: uitHistorie } = verwerkEtoroHistorie(historie.trades);
      // Volledige sync geslaagd (prijzen + eToro): tijdstip verversen naar dit moment.
      markeerGesynct();
      return {
        gekoppeld: true,
        toegevoegd,
        uitHistorie,
        bijgewerkt: open.trades.length - toegevoegd,
        gesloten: afgesloten,
        // ponytail: alleen de overgeslagen open posities melden. De historie levert elk aandeel
        // en elke short die je ooit sloot, en die lijst wil niemand in een Alert zien.
        overgeslagen: open.overgeslagen,
        fout: null,
      };
    } catch (e) {
      return { ...leeg, gekoppeld: true, fout: e instanceof Error ? e.message : 'Onbekende fout.' };
    }
  }, [verversPrijzen, importeerEtoroTrades, verwerkEtoroHistorie, markeerGesynct]);

  // Eenmalig bij het openen van de app: volledige sync zodra de opgeslagen trades geladen zijn.
  // De ref voorkomt een tweede ronde als React het effect opnieuw draait (StrictMode, remount).
  useEffect(() => {
    if (!geladen || startSyncGedaan.current) return;
    startSyncGedaan.current = true;
    synchroniseer();
  }, [geladen, synchroniseer]);

  return (
    <PortfolioContext.Provider value={{
      trades, livePrijzen, geladen, syncing, volgendeVerversing, laatsteSync, syncFout,
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
