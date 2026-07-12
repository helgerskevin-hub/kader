import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { PortfolioTrade } from './portfolioTypes';
import { haalLaatstePrijzen } from '../engine/marketData';
import { laadLijst, bewaarLijst, laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import { importeerEtoroAlles, EtoroOvergeslagenPositie } from '../engine/etoro';

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
  // Epoch-ms van de laatste geslaagde verversing, of null als er nog nooit een lukte. Blijft
  // bewaard tussen app-starts, zodat "3 dagen geleden" ook na afsluiten klopt.
  laatsteSync: number | null;
  // true als de laatste poging mislukte (bijv. geen internet); stuurt de rode cloud-status aan.
  syncFout: boolean;
  // Foutmelding van de laatste eToro-sync, of null als die lukte of er geen koppeling is. Apart
  // van syncFout: de koersen kunnen prima ververst zijn terwijl juist eToro faalde, en dan mag de
  // status niet groen melden dat alles actueel is.
  etoroFout: string | null;
  voegTradeToe: (trade: PortfolioTrade) => void;
  wijzigTrade: (trade: PortfolioTrade) => void;
  sluitTrade: (id: string, status: 'gewonnen' | 'verloren', exitPrijs: number) => void;
  verwijderTrade: (id: string) => void;
  verversPrijzen: (extraSymbolen?: string[]) => Promise<void>;
  synchroniseer: () => Promise<SyncResultaat>;
}

const PortfolioContext = createContext<PortfolioContextWaarde | null>(null);

const VERVERS_INTERVAL_MS = 60_000;

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [trades, setTrades] = useState<PortfolioTrade[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [livePrijzen, setLivePrijzen] = useState<Record<string, number>>({});
  const [syncing, setSyncing] = useState(false);
  const [laatsteSync, setLaatsteSync] = useState<number | null>(null);
  const [syncFout, setSyncFout] = useState(false);
  const [etoroFout, setEtoroFout] = useState<string | null>(null);
  const tradesRef = useRef(trades);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startSyncGedaan = useRef(false);
  // Verwijderde eToro-posities. In een ref én in state: de sync-functies lezen 'm synchroon uit
  // (ref), maar hij moet ook van schijf komen bij het opstarten.
  const genegeerdeIdsRef = useRef<Set<number>>(new Set());

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
    laadLijst<number>(SLEUTELS.genegeerdeEtoroIds).then(ids => {
      genegeerdeIdsRef.current = new Set(ids.filter(id => typeof id === 'number'));
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

  // extraSymbolen is voor symbolen die nog niet in tradesRef staan. Vlak na een eToro-import is
  // dat het geval: setTrades is dan wel aangeroepen, maar tradesRef loopt nog een render achter,
  // dus zonder dit bleven net geïmporteerde posities een minuut lang zonder koers staan.
  const verversPrijzen = useCallback(async (extraSymbolen?: string[]) => {
    const openSymbolen = [...new Set([
      ...tradesRef.current.filter(t => t.status === 'open').map(t => t.symbool),
      ...(extraSymbolen ?? []),
    ])];
    if (openSymbolen.length === 0) {
      // Niets op te halen betekent dat de portfolio per definitie actueel is.
      markeerGesynct();
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
    }
  }, [markeerGesynct]);

  // Het interval ververst alleen prijzen. Geen eToro-sync: die endpoints delen een quotum van
  // 60 requests per 60 seconden, dat is bij een minuut-interval zo op.
  useEffect(() => {
    if (!geladen) return;
    // Expliciet zonder argumenten aanroepen: verversPrijzen heeft een optionele parameter en
    // setInterval zou daar anders zijn eigen argumenten in kunnen duwen.
    intervalRef.current = setInterval(() => verversPrijzen(), VERVERS_INTERVAL_MS);
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

  // Een verwijderde eToro-trade moet verwijderd blijven. Ontdubbelen gebeurt op etoroPositionID,
  // dus zonder deze negeerlijst zette de eerstvolgende sync 'm er gewoon weer in en kon je hem
  // nooit kwijtraken.
  const verwijderTrade = useCallback((id: string) => {
    const trade = tradesRef.current.find(t => t.id === id);
    if (trade?.etoroPositionID !== undefined) {
      genegeerdeIdsRef.current.add(trade.etoroPositionID);
      bewaarLijst(SLEUTELS.genegeerdeEtoroIds, [...genegeerdeIdsRef.current]);
    }
    setTrades(prev => prev.filter(t => t.id !== id));
  }, []);

  // Dedupliceert op etoroPositionID: bestaande geïmporteerde trade wordt bijgewerkt (entry/bedrag/
  // aantal/SL/TP), handmatige trades blijven onaangeroerd. Retourneert het aantal nieuw toegevoegde
  // (berekend via tradesRef, want setTrades' updater draait niet gegarandeerd voor de return).
  const importeerEtoroTrades = useCallback((alle: PortfolioTrade[]): number => {
    const nieuwe = alle.filter(t => !genegeerdeIdsRef.current.has(t.etoroPositionID!));
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

  // Zoekt de handmatig ingevoerde tegenhanger van een eToro-trade. Wie een trade zelf noteerde
  // voordat hij eToro koppelde, heeft dezelfde echte trade twee keer in beeld: één handmatige
  // regel zonder positie-ID en één uit de eToro-historie. Zonder deze koppeling staan ze allebei
  // in je historie en tellen ze allebei mee in je statistieken.
  //
  // Bewust streng: alleen een afgeronde handmatige trade op hetzelfde symbool met een entryprijs
  // binnen 0,5%, en alleen als er precies één kandidaat is. Bij twijfel liever een dubbele regel
  // (zichtbaar, zelf op te ruimen) dan twee trades ten onrechte samenvoegen (stil en onherstelbaar).
  const zoekHandmatigeTweeling = (etoro: PortfolioTrade, kandidaten: PortfolioTrade[]): PortfolioTrade | null => {
    const treffers = kandidaten.filter(t =>
      t.etoroPositionID === undefined
      && t.status !== 'open'
      && t.symbool === etoro.symbool
      && etoro.entryPrijs > 0
      && Math.abs(t.entryPrijs - etoro.entryPrijs) / etoro.entryPrijs <= 0.005,
    );
    return treffers.length === 1 ? treffers[0] : null;
  };

  // Verwerkt de op eToro gesloten posities. Drie dingen tegelijk, in één setTrades-pass zodat elke
  // stap de uitkomst van de vorige ziet (tradesRef loopt een render achter):
  //  1. Een lokale trade die Kader als open kende, wordt afgesloten. Zulke posities verdwijnen
  //     uit /trading/info/portfolio en zouden anders eeuwig 'open' blijven staan. De lokale
  //     stop-loss/take-profit en notitie blijven staan, alleen de uitkomst komt van eToro.
  //  2. Een gesloten positie waarvoor een handmatige tweeling bestaat, wordt daarin opgenomen:
  //     de bestaande regel krijgt het positie-ID en de eToro-uitkomst, er komt geen tweede bij.
  //  3. Een gesloten positie die Kader nooit gezien heeft, wordt als afgeronde trade toegevoegd,
  //     zodat je historie ook met terugwerkende kracht klopt.
  const verwerkEtoroHistorie = useCallback((alle: PortfolioTrade[]) => {
    // Verwijderde posities blijven verwijderd, ook al staan ze nog in eToro's historie.
    const gesloten = alle.filter(
      t => t.etoroPositionID !== undefined && !genegeerdeIdsRef.current.has(t.etoroPositionID),
    );
    const perPositie = new Map(gesloten.map(t => [t.etoroPositionID!, t]));
    const huidig = tradesRef.current;
    const bekend = new Set(huidig.map(t => t.etoroPositionID).filter(id => id !== undefined));
    const afgesloten = huidig.filter(
      t => t.bron === 'etoro' && t.status === 'open' && t.etoroPositionID !== undefined && perPositie.has(t.etoroPositionID),
    ).length;
    const nieuw = gesloten.filter(t => !bekend.has(t.etoroPositionID!));
    if (afgesloten === 0 && nieuw.length === 0) return { afgesloten: 0, toegevoegd: 0 };

    // Hoeveel er echt bijkomen, voor de melding aan de gebruiker. Dit is dezelfde afweging als in
    // de updater hieronder, maar dan tegen tradesRef: geadopteerde tweelingen zijn geen nieuwe
    // regels en moeten dus niet als "uit je eToro-historie" geteld worden. De uitkomst is gelijk,
    // want stap 1 raakt alleen trades die al een positie-ID hebben en die tellen sowieso niet mee
    // als tweeling-kandidaat.
    const vrijeKandidaten = [...huidig];
    let echtToegevoegd = 0;
    for (const uitEtoro of nieuw) {
      const tweeling = zoekHandmatigeTweeling(uitEtoro, vrijeKandidaten);
      if (tweeling) {
        vrijeKandidaten.splice(vrijeKandidaten.findIndex(t => t.id === tweeling.id), 1);
      } else {
        echtToegevoegd += 1;
      }
    }

    setTrades(prev => {
      // Stap 1: lokaal open, op eToro gesloten.
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
          resultaatUsd: uitEtoro.resultaatUsd,
        };
      });

      // Stap 2 en 3: alles wat we nog niet kennen, óf adopteren óf toevoegen.
      const alBekend = new Set(bijgewerkt.map(t => t.etoroPositionID).filter(id => id !== undefined));
      const resultaat = [...bijgewerkt];
      const echtNieuw: PortfolioTrade[] = [];

      for (const uitEtoro of gesloten) {
        if (alBekend.has(uitEtoro.etoroPositionID!)) continue;
        const tweeling = zoekHandmatigeTweeling(uitEtoro, resultaat);
        if (tweeling) {
          // De handmatige regel blijft leidend (eigen id, eigen notitie en SL/TP), maar krijgt het
          // positie-ID zodat de volgende sync 'm herkent, plus eToro's uitkomst.
          const index = resultaat.findIndex(t => t.id === tweeling.id);
          resultaat[index] = {
            ...tweeling,
            status: uitEtoro.status,
            exitPrijs: uitEtoro.exitPrijs,
            slotDatum: uitEtoro.slotDatum,
            slotTijd: uitEtoro.slotTijd,
            resultaatUsd: uitEtoro.resultaatUsd,
            aantalCoins: tweeling.aantalCoins ?? uitEtoro.aantalCoins,
            etoroPositionID: uitEtoro.etoroPositionID,
          };
          alBekend.add(uitEtoro.etoroPositionID!);
        } else {
          echtNieuw.push(uitEtoro);
          alBekend.add(uitEtoro.etoroPositionID!);
        }
      }

      return [...echtNieuw, ...resultaat];
    });
    return { afgesloten, toegevoegd: echtToegevoegd };
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
    if (!apiKey || !userKey) {
      // Geen koppeling is geen fout: een oude foutmelding mag hier niet blijven hangen.
      setEtoroFout(null);
      return leeg;
    }

    try {
      const { open, historie } = await importeerEtoroAlles({ apiKey, userKey });
      const toegevoegd = importeerEtoroTrades(open.trades);
      const { afgesloten, toegevoegd: uitHistorie } = verwerkEtoroHistorie(historie.trades);

      // Prijzen nogmaals ophalen mét de zojuist geïmporteerde symbolen. tradesRef loopt hier nog
      // een render achter, dus verversPrijzen zou ze anders niet zien en stonden nieuwe posities
      // tot een minuut lang zonder koers in beeld.
      const nieuweSymbolen = open.trades.map(t => t.symbool);
      if (nieuweSymbolen.length > 0) await verversPrijzen(nieuweSymbolen);

      // Volledige sync geslaagd (prijzen + eToro): tijdstip verversen naar dit moment.
      setEtoroFout(null);
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
      // Belangrijk: verversPrijzen heeft hierboven al markeerGesynct() gedaan, dus zonder deze
      // vlag zou de statusindicator groen "Bijgewerkt zojuist" melden terwijl je posities
      // helemaal niet zijn opgehaald. bepaalSyncStand maakt er nu een oranje eToro-fout van.
      const bericht = e instanceof Error ? e.message : 'Onbekende fout.';
      setEtoroFout(bericht);
      return { ...leeg, gekoppeld: true, fout: bericht };
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
      trades, livePrijzen, geladen, syncing, laatsteSync, syncFout, etoroFout,
      voegTradeToe, wijzigTrade, sluitTrade, verwijderTrade, verversPrijzen,
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
