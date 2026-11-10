// Gedeelde stand van de Copy-tab: favorieten, instellingen, de ranglijst en de Feed. Eén context,
// zodat de ster op een kaart in Ontdek, in het traderprofiel en in de Feed altijd hetzelfde zegt.
//
// Lezen gaat via engine/etoroTraders.ts en notifications/traderChecks.ts. Hier wordt nooit een
// order geplaatst: kopiëren loopt via de bestaande KooporderSheet, met zijn eigen bevestiging.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { actieveSleutels } from './etoroSleutels';
import { usePortfolio } from './PortfolioProvider';
import {
  CopyHerkomst, CopyInstellingen, FavorieteTrader, FeedItem, MAX_FAVORIETEN, STANDAARD_INSTELLINGEN,
  bewaarFavorieten, bewaarHerkomst, bewaarInstellingen, bewaarRanglijstCache, laadFavorieten, laadFeed, laadLaatstGekeken, laadTrackrecord,
  laadHerkomst, laadInstellingen, laadRanglijstCache, laadSymboolKaart, RANGLIJST_TTL_MS, zaaiSymboolKaart,
  bewaarSymboolKaart, markeerGekopieerd, noteerHerkomst,
} from './copyOpslag';
import {
  RanglijstRij, TraderBeoordeling, TrackrecordTrade, beoordeelRij, haaltDrempels, isCryptoTrader, waaromBuiten, ontbreektVoorDrempels,
} from '../engine/copyTrading';
import { haalRanglijst, haalRanglijstVoor } from '../engine/etoroTraders';
import { haalCryptoTypeIds } from '../engine/etoro';
import { haalLaatstePrijzen } from '../engine/marketData';
import { checkFavorieteTraders } from '../notifications/traderChecks';

export interface TraderMetScore {
  rij: RanglijstRij;
  beoordeling: TraderBeoordeling;
}

// Uitkomst van het zoekveld in Ontdek, als de naam niet in de lijst staat en Kader eToro vraagt.
export type ZoekUitkomst =
  | { soort: 'gevonden'; trader: TraderMetScore; buiten: string | null }
  | { soort: 'niet-gevonden' }
  | { soort: 'geen-koppeling' }
  | { soort: 'fout'; melding: string };

export type LaadStand = 'leeg' | 'laden' | 'klaar' | 'fout' | 'geen-koppeling';

interface CopyWaarde {
  // Favorieten en instellingen zijn van schijf gelezen. Daarvoor weet het scherm nog niet of het op
  // de Feed of op Ontdek moet openen, en of het instellingenvenster nog getoond moet worden.
  geladen: boolean;
  favorieten: FavorieteTrader[];
  isFavoriet: (username: string) => boolean;
  wisselFavoriet: (trader: FavorieteTrader) => void;
  // Meldingen over nieuwe trades van één favoriet aan of uit. De Feed vult hoe dan ook.
  zetTraderMeldingen: (username: string, aan: boolean) => void;
  // Te veel favorieten: de laatste wissel ging niet door.
  favorietenVol: boolean;

  instellingen: CopyInstellingen;
  wijzigInstellingen: (inst: CopyInstellingen) => void;

  traders: TraderMetScore[];
  ranglijstStand: LaadStand;
  ranglijstFout: string | null;
  ranglijstTijd: number | null;
  verversRanglijst: (forceer?: boolean) => Promise<void>;
  // Een trader op exacte naam bij eToro opzoeken, ook als hij buiten de drempels valt (dan met reden).
  zoekTrader: (naam: string) => Promise<ZoekUitkomst>;

  feed: FeedItem[];
  feedStand: LaadStand;
  // Live koers per Kader-symbool, voor de koersverschuiving op de feedkaarten.
  koersen: Record<string, number>;
  verversFeed: () => Promise<void>;
  // Wanneer Kader voor het laatst bij je favorieten keek (voorgrond of achtergrond), of null.
  laatstGekeken: number | null;
  // Kaders eigen trackrecord van favorieten (90 dagen), voor "Sinds je ster" op de kaarten.
  trackrecord: TrackrecordTrade[];

  herkomst: CopyHerkomst[];
  // Na een geslaagde kooporder vanuit een feedregel: onthoud welke trade je kopieerde.
  noteerKopie: (item: FeedItem, verzoekId: string, omgeving: 'real' | 'demo') => Promise<void>;
}

const CopyContext = createContext<CopyWaarde | null>(null);

// Zolang de app op de voorgrond staat: elke vijf minuten, zoals de prijs-poll in PortfolioProvider.
// De Copy-tab zelf vraagt elke minuut zolang hij in beeld is.
const VOORGROND_POLL_MS = 5 * 60 * 1000;

// Eén keer per app-sessie opgevraagd: de crypto-instrumenttypes veranderen niet. undefined = nog
// niet gevraagd, null = gevraagd maar niet te herkennen.
let cryptoKlassen: Set<number> | null | undefined;

// De crypto-klassen en Kaders eigen crypto-instrumenten, gedeeld door Ontdek en het zoekveld.
// eToro's instrumenttypes en de assetclass in de ranglijst zijn nog niet tegen elkaar gemeten.
// Valt geen enkele regel onder de crypto-klasse, dan is de nummering kennelijk een andere, en dan
// liever niet op klasse filteren dan een lege lijst tonen.
async function cryptoBasis(rijen: RanglijstRij[]): Promise<{ klassen: Set<number> | null; crypto: Set<number> }> {
  if (cryptoKlassen === undefined) {
    const sleutels = await actieveSleutels();
    cryptoKlassen = sleutels ? await haalCryptoTypeIds(sleutels) : null;
  }
  let klassen = cryptoKlassen;
  if (klassen && !rijen.some(r => typeof r.topTradedAssetClassId === 'number' && klassen!.has(r.topTradedAssetClassId))) {
    klassen = null;
  }
  // De instrumentId's van Kaders eigen coins, uit wat de app al weet.
  const kaart = await zaaiSymboolKaart(await laadSymboolKaart());
  const crypto = new Set(Object.entries(kaart).filter(([, s]) => s !== null).map(([id]) => Number(id)));
  return { klassen, crypto };
}

export function CopyProvider({ children }: { children: React.ReactNode }) {
  const { trades, etoroGekoppeld, omgeving } = usePortfolio();
  const [favorieten, setFavorieten] = useState<FavorieteTrader[]>([]);
  const [favorietenVol, setFavorietenVol] = useState(false);
  const [instellingen, setInstellingen] = useState<CopyInstellingen>(STANDAARD_INSTELLINGEN);
  const [traders, setTraders] = useState<TraderMetScore[]>([]);
  const [ranglijstStand, setRanglijstStand] = useState<LaadStand>('leeg');
  const [ranglijstFout, setRanglijstFout] = useState<string | null>(null);
  const [ranglijstTijd, setRanglijstTijd] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedStand, setFeedStand] = useState<LaadStand>('leeg');
  const [koersen, setKoersen] = useState<Record<string, number>>({});
  const [laatstGekeken, setLaatstGekeken] = useState<number | null>(null);
  const [trackrecord, setTrackrecord] = useState<TrackrecordTrade[]>([]);
  const [herkomst, setHerkomst] = useState<CopyHerkomst[]>([]);
  const favorietenRef = useRef<FavorieteTrader[]>([]);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    Promise.all([
      laadFavorieten().then(l => { favorietenRef.current = l; setFavorieten(l); }),
      laadInstellingen().then(setInstellingen),
    ]).catch(() => {}).finally(() => setGeladen(true));
    laadFeed().then(setFeed).catch(() => {});
    laadLaatstGekeken().then(setLaatstGekeken).catch(() => {});
    laadTrackrecord().then(setTrackrecord).catch(() => {});
    laadHerkomst().then(setHerkomst).catch(() => {});
  }, []);

  const isFavoriet = useCallback(
    (username: string) => favorieten.some(f => f.username.toLowerCase() === username.toLowerCase()),
    [favorieten],
  );

  const wisselFavoriet = useCallback((trader: FavorieteTrader) => {
    const huidig = favorietenRef.current;
    const bestaat = huidig.some(f => f.username.toLowerCase() === trader.username.toLowerCase());
    if (!bestaat && huidig.length >= MAX_FAVORIETEN) {
      setFavorietenVol(true);
      return;
    }
    setFavorietenVol(false);
    const volgende = bestaat
      ? huidig.filter(f => f.username.toLowerCase() !== trader.username.toLowerCase())
      : [...huidig, trader];
    favorietenRef.current = volgende;
    setFavorieten(volgende);
    bewaarFavorieten(volgende).catch(() => {});
  }, []);

  const zetTraderMeldingen = useCallback((username: string, aan: boolean) => {
    const volgende = favorietenRef.current.map(f =>
      (f.username.toLowerCase() === username.toLowerCase() ? { ...f, meldingen: aan } : f));
    favorietenRef.current = volgende;
    setFavorieten(volgende);
    bewaarFavorieten(volgende).catch(() => {});
  }, []);

  const wijzigInstellingen = useCallback((inst: CopyInstellingen) => {
    setInstellingen(inst);
    bewaarInstellingen(inst).catch(() => {});
  }, []);

  // ---------- Ranglijst ----------

  const beoordeel = useCallback(async (rijen: RanglijstRij[]): Promise<TraderMetScore[]> => {
    const { klassen, crypto } = await cryptoBasis(rijen);
    return rijen
      .filter(haaltDrempels)
      .filter(r => isCryptoTrader(r, klassen, crypto))
      .map(rij => ({ rij, beoordeling: beoordeelRij(rij) }))
      .sort((a, b) => b.beoordeling.score - a.beoordeling.score);
  }, []);

  const zoekTrader = useCallback(async (naam: string): Promise<ZoekUitkomst> => {
    const gezocht = naam.trim();
    if (!gezocht) return { soort: 'niet-gevonden' };
    const sleutels = await actieveSleutels();
    if (!sleutels) return { soort: 'geen-koppeling' };
    try {
      const rijen = await haalRanglijstVoor([gezocht], sleutels);
      const rij = rijen.find(r => r.username.toLowerCase() === gezocht.toLowerCase());
      if (!rij) return { soort: 'niet-gevonden' };
      // Zelfde klasse-terugval als Ontdek: beoordeeld tegen de ranglijst plus deze ene regel.
      const cache = await laadRanglijstCache();
      const { klassen, crypto } = await cryptoBasis([...(cache?.rijen ?? []), rij]);
      const buiten = ontbreektVoorDrempels(rij)
        ?? waaromBuiten(rij)
        ?? (isCryptoTrader(rij, klassen, crypto) ? null : 'Handelt vooral buiten crypto.');
      return { soort: 'gevonden', trader: { rij, beoordeling: beoordeelRij(rij) }, buiten };
    } catch (e) {
      return { soort: 'fout', melding: e instanceof Error ? e.message : 'Onbekende fout.' };
    }
  }, []);

  const verversRanglijst = useCallback(async (forceer = false) => {
    const cache = await laadRanglijstCache();
    if (cache) {
      setTraders(await beoordeel(cache.rijen));
      setRanglijstTijd(cache.tijd);
      setRanglijstStand('klaar');
    }
    const vers = cache && Date.now() - cache.tijd < RANGLIJST_TTL_MS;
    if (vers && !forceer) return;

    const sleutels = await actieveSleutels();
    if (!sleutels) {
      if (!cache) setRanglijstStand('geen-koppeling');
      return;
    }
    if (!cache) setRanglijstStand('laden');
    try {
      const rijen = await haalRanglijst(sleutels);
      await bewaarRanglijstCache(rijen);
      setTraders(await beoordeel(rijen));
      setRanglijstTijd(Date.now());
      setRanglijstFout(null);
      setRanglijstStand('klaar');
    } catch (e) {
      setRanglijstFout(e instanceof Error ? e.message : 'Onbekende fout.');
      // Met een oude lijst in beeld is een fout geen leeg scherm: die blijft gewoon staan.
      if (!cache) setRanglijstStand('fout');
    }
  }, [beoordeel]);

  // ---------- Feed ----------

  const verversKoersen = useCallback(async (items: FeedItem[]) => {
    const symbolen = [...new Set(items.filter(i => !i.gesloten && i.symbool).map(i => i.symbool as string))];
    if (symbolen.length === 0) return;
    try {
      const nieuw = await haalLaatstePrijzen(symbolen);
      setKoersen(oud => ({ ...oud, ...nieuw }));
    } catch {
      // Zonder koers toont de kaart geen verschuiving; de koopsheet haalt zelf een verse koers.
    }
  }, []);

  const verversFeed = useCallback(async () => {
    if (favorietenRef.current.length === 0) {
      setFeedStand('klaar');
      return;
    }
    const sleutels = await actieveSleutels();
    if (!sleutels) {
      setFeedStand('geen-koppeling');
      return;
    }
    setFeedStand(s => (s === 'klaar' ? s : 'laden'));
    try {
      // Melden mag: staat de app open maar kijk je naar een andere tab, dan is een melding nuttig.
      await checkFavorieteTraders({ melden: true });
      // Ook de herkomst: de check markeert daarin een uitstap (uitstapGemeld) voor Mijn copies.
      const [vers, gekeken, h, track] = await Promise.all([laadFeed(), laadLaatstGekeken(), laadHerkomst(), laadTrackrecord()]);
      setFeed(vers);
      setLaatstGekeken(gekeken);
      setHerkomst(h);
      setTrackrecord(track);
      setFeedStand('klaar');
      verversKoersen(vers);
    } catch {
      setFeedStand(s => (s === 'klaar' ? s : 'fout'));
    }
  }, [verversKoersen]);

  // Op de voorgrond elke vijf minuten, net als de andere checks.
  useEffect(() => {
    const tik = () => {
      if (AppState.currentState === 'active') verversFeed().catch(() => {});
    };
    const id = setInterval(tik, VOORGROND_POLL_MS);
    return () => clearInterval(id);
  }, [verversFeed]);

  // Nieuwe favorieten: meteen kijken, zodat de Feed niet vijf minuten leeg blijft.
  const aantalFavorieten = favorieten.length;
  useEffect(() => {
    if (aantalFavorieten > 0) verversFeed().catch(() => {});
  }, [aantalFavorieten, verversFeed]);

  // ---------- Herkomst koppelen aan eigen posities ----------

  // Een kopie is in eToro een gewone positie. Kader weet welke order hij voor welke trade van welke
  // belegger plaatste; de positie die daarna in dezelfde coin, dezelfde omgeving en na dat moment
  // verschijnt, is die kopie. Elke positie hoort bij hooguit één herkomst.
  useEffect(() => {
    if (herkomst.length === 0) return;
    const gekoppeld = new Set(herkomst.map(h => h.etoroPositionID).filter((x): x is number => typeof x === 'number'));
    let gewijzigd = false;
    const volgende = herkomst.map(h => {
      if (typeof h.etoroPositionID === 'number') return h;
      const kandidaat = trades
        .filter(t => t.bron === 'etoro' && t.status === 'open' && typeof t.etoroPositionID === 'number')
        .filter(t => t.symbool === h.symbool && (t.etoroOmgeving ?? 'real') === h.omgeving)
        .filter(t => typeof t.openTijd === 'number' && t.openTijd >= h.tijd - 2 * 60 * 1000)
        .filter(t => !gekoppeld.has(t.etoroPositionID as number))
        .sort((a, b) => (a.openTijd ?? 0) - (b.openTijd ?? 0))[0];
      if (!kandidaat) return h;
      gekoppeld.add(kandidaat.etoroPositionID as number);
      gewijzigd = true;
      return { ...h, etoroPositionID: kandidaat.etoroPositionID };
    });
    if (gewijzigd) {
      setHerkomst(volgende);
      bewaarHerkomst(volgende).catch(() => {});
    }
  }, [trades, herkomst]);

  // Na een kopie leest de koopsheet de herkomst niet zelf terug; dit houdt de lijst vers.
  useEffect(() => {
    laadHerkomst().then(setHerkomst).catch(() => {});
  }, [trades.length, omgeving]);

  // Bij een nieuwe koppeling de symboolkaart alvast zaaien, zodat de ranglijst crypto herkent.
  useEffect(() => {
    if (!etoroGekoppeld) return;
    laadSymboolKaart().then(zaaiSymboolKaart).then(bewaarSymboolKaart).catch(() => {});
  }, [etoroGekoppeld]);

  const noteerKopie = useCallback(async (item: FeedItem, verzoekId: string, omg: 'real' | 'demo') => {
    if (!item.symbool) return;
    await noteerHerkomst({
      verzoekId,
      username: item.username,
      bronPositieId: item.positionId,
      symbool: item.symbool,
      omgeving: omg,
      tijd: Date.now(),
    });
    await markeerGekopieerd(item.sleutel);
    setHerkomst(await laadHerkomst());
    setFeed(await laadFeed());
  }, []);

  const waarde = useMemo<CopyWaarde>(() => ({
    geladen, favorieten, isFavoriet, wisselFavoriet, zetTraderMeldingen, favorietenVol,
    instellingen, wijzigInstellingen,
    traders, ranglijstStand, ranglijstFout, ranglijstTijd, verversRanglijst, zoekTrader,
    feed, feedStand, koersen, verversFeed, laatstGekeken, trackrecord,
    herkomst, noteerKopie,
  }), [
    geladen, favorieten, isFavoriet, wisselFavoriet, zetTraderMeldingen, favorietenVol, instellingen, wijzigInstellingen,
    traders, ranglijstStand, ranglijstFout, ranglijstTijd, verversRanglijst, zoekTrader,
    feed, feedStand, koersen, verversFeed, laatstGekeken, trackrecord, herkomst, noteerKopie,
  ]);

  return <CopyContext.Provider value={waarde}>{children}</CopyContext.Provider>;
}

export function useCopy(): CopyWaarde {
  const ctx = useContext(CopyContext);
  if (!ctx) throw new Error('useCopy moet binnen CopyProvider gebruikt worden');
  return ctx;
}
