import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { PortfolioTrade } from './portfolioTypes';
import { haalLaatstePrijzen } from '../engine/marketData';
import { laadLijst, bewaarLijst, laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import { importeerEtoroAlles, EtoroOvergeslagenPositie, EtoroOmgeving, EtoroFout, EtoroSleutels, WachtendeOrder, OrderUitkomst, annuleerOrder, zoekOrderStatus, guid } from '../engine/etoro';
import { sleutelUitkomst, haalOmgeving, zetOmgeving, heeftSleutels, magHandelen as magNuHandelen, actieveSleutels } from './etoroSleutels';
import { OnbekendeOrder, ruimOnbekendeOrdersOp } from './lopendeOrders';
import { GeplaatsteOrder, heeftVerseLopendeOrder, isAfgerond, isMeldenswaard, kiesOmOpTeVragen, ruimOp, saldoOverOrders } from './orderUitkomsten';
import { bronVan } from './portfolioTypes';
import { checkOpenTrades, checkPrijsalerts } from '../notifications/tradeChecks';
import { checkNiveausGeraakt, meldEtoroSluitingen } from '../notifications/sluitingen';

export interface SyncResultaat {
  gekoppeld: boolean;                          // false = geen eToro-sleutels ingesteld
  toegevoegd: number;                          // nieuwe open posities
  bijgewerkt: number;                          // bestaande open posities ververst
  gesloten: number;                            // lokaal open, inmiddels op eToro gesloten
  uitHistorie: number;                         // afgeronde trades die Kader nog niet kende
  overgeslagen: EtoroOvergeslagenPositie[];
  fout: string | null;                         // eToro-fout; prijzen zijn dan wel ververst
}

// Na een annuleerverzoek: wat eToro op het verzoek zei, en (alleen na een 'ok') de status die Kader
// daarna opvroeg. Die tweede is nodig omdat een 200 niets zegt over de uitkomst: gemeten gaf ook een
// al gevulde order 200. null = niet opgevraagd, niet gelukt, of eToro kende de order niet.
export interface AnnuleerResultaat {
  uitkomst: OrderUitkomst;
  statusNa: number | null;
}

interface PortfolioContextWaarde {
  trades: PortfolioTrade[];
  livePrijzen: Record<string, number>;
  // Epoch-ms waarop de koers per symbool in livePrijzen is opgehaald. Een mislukte poll laat de
  // oude koers staan; hiermee ziet een scherm dat erop leunt voor een grens hoe oud die is.
  livePrijsTijd: Record<string, number>;
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
  // Vrij te besteden saldo van de actieve eToro-omgeving, uit de portfolio-respons van de laatste
  // geslaagde sync. null = we weten het niet: geen koppeling, nog geen geslaagde sync, of eToro gaf
  // het veld niet mee. Nooit 0 als vervanging voor onbekend, want hier hangt het totale vermogen
  // aan en een verzonnen bedrag is erger dan geen bedrag. Bij een mislukte sync blijft de vorige
  // waarde staan.
  vrijSaldoUsd: number | null;
  // Wat er van je cash vastzit in orders die eToro nog niet gevuld heeft (een limietorder, of een
  // marktorder op een aandeel terwijl de beurs dicht is). Dat bedrag zit al NIET meer in
  // vrijSaldoUsd; deze twee velden zijn er om te kunnen uitleggen waarom je beschikbare bedrag
  // lager is dan de cash die eToro zelf toont. 0 = niets in de wacht, null = er wachten orders maar
  // Kader kan het bedrag niet lezen.
  gereserveerdUsd: number | null;
  wachtendeOrders: number;
  // Diezelfde wachtende orders zelf, uit de laatste geslaagde sync en alleen die van de actieve
  // omgeving; leeg zonder koppeling. De kaart op het Portfolio-scherm toont ze en biedt er
  // "Annuleren" op aan.
  wachtendeOrderLijst: WachtendeOrder[];
  // Staat er een eToro-sleutel op dit toestel? Los van magHandelen, dat ook schrijfrecht eist.
  // Bepaalt welke uitleg de portfoliokaart geeft als het vrije saldo onbekend is: koppelen, of
  // wachten tot eToro het veld meestuurt.
  etoroGekoppeld: boolean;
  voegTradeToe: (trade: PortfolioTrade) => void;
  wijzigTrade: (trade: PortfolioTrade) => void;
  sluitTrade: (id: string, status: 'gewonnen' | 'verloren', exitPrijs: number) => void;
  verwijderTrade: (id: string) => void;
  verversPrijzen: (extraSymbolen?: string[]) => Promise<void>;
  synchroniseer: () => Promise<SyncResultaat>;

  // ---- Direct handelen via eToro ----
  // Welke eToro-omgeving actief is. Alles in `trades` hoort bij deze omgeving (handmatige trades
  // uitgezonderd, die horen bij geen van beide).
  omgeving: EtoroOmgeving;
  setOmgeving: (o: EtoroOmgeving) => Promise<void>;
  // Mag Kader in deze omgeving een order plaatsen? False zonder koppeling of zonder schrijfrecht,
  // en dan verschijnt er nergens een koop- of verkoopknop.
  magHandelen: boolean;
  // Orders waarvan we niet weten of ze zijn doorgegaan. Nooit automatisch opnieuw versturen.
  onbekendeOrders: OnbekendeOrder[];
  // Te lang onopgelost: hier hoort de banner met "Opnieuw controleren" bij.
  verlopenOrders: OnbekendeOrder[];
  // Schrijft de order eerst naar schijf en dan pas naar state, zodat een app-kill op dat moment
  // hem niet kwijtraakt.
  noteerOnbekendeOrder: (order: OnbekendeOrder) => Promise<void>;
  controleerOnbekendeOrders: () => Promise<void>;
  // Na een geslaagde order: meteen synchroniseren en daarna herhaald kijken of de positie
  // verschijnt, want eToro's portfolio-endpoint loopt vaak achter.
  verzoenNaOrder: () => void;
  // Orders die Kader zelf heeft ingediend en waarvan de uitkomst (geannuleerd, geweigerd, verlopen)
  // de gebruiker nog niet heeft gezien, in de actieve omgeving. Een gevulde order staat hier nooit
  // in: dat is geen nieuws.
  orderUitkomsten: GeplaatsteOrder[];
  noteerGeplaatsteOrder: (order: GeplaatsteOrder) => Promise<void>;
  // Annuleert een wachtende order bij eToro. Nooit automatisch herhalen: net als bij een kooporder
  // is een afgebroken verzoek geen bewijs dat er niets gebeurd is. Neemt de hele order, niet alleen
  // het id, zodat de omgeving van de order tegen die van de sleutels gecontroleerd kan worden.
  annuleerWachtendeOrder: (order: WachtendeOrder) => Promise<AnnuleerResultaat>;
  // De gebruiker tikt "Begrepen" op een uitkomst-melding: verdwijnt uit de opslag.
  wisOrderUitkomst: (verzoekId: string) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextWaarde | null>(null);

const VERVERS_INTERVAL_MS = 60_000;
// Bij terugkeer uit de achtergrond niet elke keer een volledige eToro-sync doen: dat quotum is
// maar 60 requests per 60 seconden. Binnen dit venster na de laatste geslaagde sync volstaat een
// prijs-ververs; daarbuiten halen we ook de eToro-posities en -historie opnieuw op.
const HERSYNC_COOLDOWN_MS = 5 * 60 * 1000;
// De trade-check haalt per open trade verse candles op, veel zwaarder dan een prijs-ververs. Niet
// bij elke minuut-tik dus. De achtergrondtaak dekt de momenten dat de app dicht is; dit is puur om
// een melding niet een kwartier te laten wachten terwijl je in de app zit te kijken.
const TRADE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
// Hoe lang na een aangenomen annulering Kader wacht met de status opvragen. Direct erna kan eToro
// het verzoek nog aan het verwerken zijn (status 6); langer laat de gebruiker onnodig wachten.
const STATUS_NA_ANNULEREN_MS = 2_000;
// Zolang een eigen order van de laatste tien minuten nog geen definitieve status heeft, synct Kader
// op de voorgrond zo vaak extra (zie heeftVerseLopendeOrder). Eén sync is zo'n vier requests plus
// hooguit vijf statusopvragen, ruim binnen eToro's 60 per minuut.
const NA_ORDER_SYNC_INTERVAL_MS = 75_000;
// Was er net al een eToro-sync (verzoenNaOrder, pull-to-refresh), dan slaat de extra sync een beurt over.
const MIN_TUSSEN_EXTRA_SYNCS_MS = 45_000;
// Na de eerste anderhalve minuut van verzoenNaOrder nog drie keer kijken, op 3, 5 en 10 minuten.
const VERZOEN_NA_ORDER_MS = [5_000, 20_000, 45_000, 90_000, 3 * 60_000, 5 * 60_000, 10 * 60_000];
// Na een mislukte eToro-sync (meestal 429) zo lang geen extra syncs van de timers of het vangnet;
// anders blijft elke beurt het quotum verder oprekken. Pull-to-refresh en de app-start blijven mogen.
const NA_FOUT_WACHT_MS = 3 * 60_000;

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [trades, setTrades] = useState<PortfolioTrade[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [livePrijzen, setLivePrijzen] = useState<Record<string, number>>({});
  const [livePrijsTijd, setLivePrijsTijd] = useState<Record<string, number>>({});
  const [syncing, setSyncing] = useState(false);
  const [laatsteSync, setLaatsteSync] = useState<number | null>(null);
  const [syncFout, setSyncFout] = useState(false);
  const [etoroFout, setEtoroFout] = useState<string | null>(null);
  // Blijft staan tussen syncs door: een mislukte sync maakt het saldo niet onbekend, hij maakt het
  // alleen ouder. Alleen een geslaagde sync die géén credit meekreeg zet 'm terug op null.
  // Het kale credit; het vrije saldo, het gereserveerde bedrag en het aantal wachtende orders worden
  // daaruit afgeleid over de zichtbare orders (zie saldoOverOrders onderaan).
  const [creditUsd, setCreditUsd] = useState<number | null>(null);
  const [wachtendeOrderLijst, setWachtendeOrderLijst] = useState<WachtendeOrder[]>([]);
  const [etoroGekoppeld, setEtoroGekoppeld] = useState(false);
  // Demo als tussenstand tot haalOmgeving() antwoordt. De omgeving is het enige dat speelgeld van
  // echt geld scheidt, dus de waarde van voor het laden hoort de onschuldige te zijn: hij stuurt
  // het DEMO-label in de header aan en het filter op zichtbare trades.
  const [omgeving, setOmgevingState] = useState<EtoroOmgeving>('demo');
  // Dezelfde omgeving, maar synchroon bijgewerkt in setOmgeving en ververHandelStatus. De sync
  // vergelijkt hier na zijn await tegen: is er intussen gewisseld, dan hoort wat hij ophaalde bij
  // de omgeving die je net verliet. null = nog niet van schijf gelezen, en dan is er deze sessie
  // ook nog niet gewisseld (setOmgeving zet 'm meteen).
  const omgevingRef = useRef<EtoroOmgeving | null>(null);
  const [magHandelen, setMagHandelen] = useState(false);
  const [onbekendeOrders, setOnbekendeOrders] = useState<OnbekendeOrder[]>([]);
  const [verlopenOrders, setVerlopenOrders] = useState<OnbekendeOrder[]>([]);
  const [geplaatsteOrders, setGeplaatsteOrders] = useState<GeplaatsteOrder[]>([]);
  const tradesRef = useRef(trades);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startSyncGedaan = useRef(false);
  // Voor de cooldown-check in de foreground-listener: synchroon uit te lezen, in tegenstelling
  // tot de laatsteSync-state die pas na een render bijgewerkt is.
  const laatsteSyncRef = useRef<number | null>(null);
  // Wanneer de trade-check voor het laatst draaide. Start op 0, zodat de eerste minuut-tik na het
  // openen van de app 'm meteen een keer doet.
  const laatsteTradeCheckRef = useRef(0);
  // Verwijderde eToro-posities. In een ref én in state: de sync-functies lezen 'm synchroon uit
  // (ref), maar hij moet ook van schijf komen bij het opstarten.
  const genegeerdeIdsRef = useRef<Set<number>>(new Set());
  // De leidende kopie van de geplaatste orders; de state volgt 'm alleen voor de weergave. Wordt
  // uitsluitend in bewaarGeplaatst (en bij het laden) gezet, synchroon en vóór elke await, zodat
  // twee schrijvers kort na elkaar (een order noteren terwijl de sync statussen opvraagt) elkaars
  // wijziging zien in plaats van een oude momentopname terug te schrijven. Een ref en geen state
  // ook om dezelfde reden als genegeerdeIdsRef: synchroniseer() leest 'm zonder dependency.
  const geplaatsteOrdersRef = useRef<GeplaatsteOrder[]>([]);
  // Er loopt al een werkOrderUitkomstenBij; zie daar waarom er maar één tegelijk mag.
  const uitkomstenBezig = useRef(false);
  // Leidende kopie van de onbekende orders, om dezelfde reden als geplaatsteOrdersRef: de sync ruimt
  // ze op zonder dat synchroniseer bij elke wijziging een nieuwe identiteit krijgt.
  const onbekendeOrdersRef = useRef<OnbekendeOrder[]>([]);
  // Begin van de laatste eToro-poging, geslaagd of niet, en het moment van de laatste mislukte.
  // De extra syncs (verzoenNaOrder-timers, het vangnet) houden hun minimale tussenpoos aan op de
  // poging, en wachten na een fout NA_FOUT_WACHT_MS.
  const laatsteEtoroPogingRef = useRef(0);
  const laatsteEtoroFoutRef = useRef(0);
  // De sync die nu loopt, met de omgeving waarvoor hij startte. Een tweede aanroep sluit daarbij aan
  // in plaats van een parallelle ronde te starten (dubbel quotum, en twee schrijvers op dezelfde state).
  const syncBezigRef = useRef<{ omgeving: EtoroOmgeving | null; belofte: Promise<SyncResultaat> } | null>(null);

  useEffect(() => { tradesRef.current = trades; }, [trades]);

  useEffect(() => {
    laadLijst<PortfolioTrade>(SLEUTELS.portfolio).then(l => {
      setTrades(l);
      setGeladen(true);
    });
    laadTekst(SLEUTELS.laatsteSync, '').then(t => {
      const ms = Number(t);
      if (t && Number.isFinite(ms)) {
        setLaatsteSync(ms);
        laatsteSyncRef.current = ms;
      }
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
    laatsteSyncRef.current = nu;
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
      const opgehaald = Date.now();
      setLivePrijsTijd(prev => ({ ...prev, ...Object.fromEntries(Object.keys(prijzen).map(s => [s, opgehaald])) }));
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
    intervalRef.current = setInterval(() => {
      verversPrijzen();
      const nu = Date.now();
      if (nu - laatsteTradeCheckRef.current < TRADE_CHECK_INTERVAL_MS) return;
      laatsteTradeCheckRef.current = nu;
      // tradesRef i.p.v. een storage-lees: de check draait hier binnen de React-tree en de lijst
      // in het geheugen is per definitie de verste. Fouten stilhouden, net als bij verversPrijzen:
      // dit is een achtergrondklusje, geen actie van de gebruiker.
      checkOpenTrades({ trades: tradesRef.current }).catch(() => {});
      // Prijsalerts op dezelfde cadans, maar als eigen aanroep: ze hebben hun eigen goedkope
      // prijsverzoeken (alleen de coins met een wachtende alert) en delen de uur-cooldown van
      // checkOpenTrades bewust niet, want de gebruiker koos dat niveau zelf.
      checkPrijsalerts().catch(() => {});
      // Zelfde verhaal voor de stop en het doel van handmatige trades: die niveaus koos de gebruiker
      // ook zelf, dus ook buiten de uur-cooldown. Eén melding per trade per niveau, zie sluitingen.ts.
      checkNiveausGeraakt({ trades: tradesRef.current }).catch(() => {});
    }, VERVERS_INTERVAL_MS);
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

    // Melden wat eToro zelf op de stop of het doel sloot. Met `huidig` van vóór setTrades hieronder:
    // dat is de lijst waarin deze posities nog open staan, en alleen die overgang is nieuws. Fire-
    // and-forget, want een melding mag de sync niet ophouden of laten mislukken. De omgeving hoeft
    // hier niet gefilterd: meldEtoroSluitingen koppelt op positionID én omgeving.
    if (afgesloten > 0) meldEtoroSluitingen(huidig, gesloten).catch(() => {});

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

  // Vóór synchroniseer gedefinieerd, want die roept 'm aan: bewaarGeplaatst schrijft eerst naar
  // schijf en dan pas naar state, zodat een app-kill de laatst opgehaalde status niet kwijtraakt.
  // De ref gaat vóór de await: wie hierna de lijst leest, ziet deze wijziging al. De state krijgt
  // daarna de ref en niet `lijst`, want een latere schrijver kan intussen al verder zijn.
  const bewaarGeplaatst = useCallback(async (lijst: GeplaatsteOrder[]) => {
    geplaatsteOrdersRef.current = lijst;
    await bewaarLijst(SLEUTELS.geplaatsteOrders, lijst);
    setGeplaatsteOrders(geplaatsteOrdersRef.current);
  }, []);

  const bewaarOnbekende = useCallback(async (lijst: OnbekendeOrder[]) => {
    onbekendeOrdersRef.current = lijst;
    await bewaarLijst(SLEUTELS.onbekendeOrders, lijst);
    setOnbekendeOrders(onbekendeOrdersRef.current);
  }, []);

  // Onbekende orders afstrepen tegen een tradelijst. De aanroeper geeft de lijst mee: vlak na een
  // import loopt tradesRef nog een render achter, en dan zou een net verschenen positie de order
  // pas bij de volgende sync oplossen. De volledige lijst, niet de gefilterde: een order in de
  // andere omgeving moet ook opgelost kunnen worden.
  const verzoenOnbekende = useCallback((trades: PortfolioTrade[]) => {
    const huidig = onbekendeOrdersRef.current;
    const { open, verlopen } = ruimOnbekendeOrdersOp(huidig, trades, Date.now());
    // Niet elke sync een vers leeg array: dat zou de hele context opnieuw laten renderen.
    setVerlopenOrders(vorig => vorig.length === 0 && verlopen.length === 0 ? vorig : verlopen);
    if (open.length + verlopen.length !== huidig.length) {
      bewaarOnbekende([...open, ...verlopen]).catch(() => {});
    }
  }, [bewaarOnbekende]);

  // Status opvragen van eerder door Kader geplaatste orders, en oude records opruimen. Draait
  // fire-and-forget na een geslaagde sync: de lookups mogen de sync niet vertragen, en een fout
  // hier (ook bij het wegschrijven) mag nooit etoroFout zetten, want je posities zijn dan gewoon
  // opgehaald. Bewust niet in achtergrondtaak.ts: dit hoeft niet elke 15 minuten.
  const werkOrderUitkomstenBij = useCallback(async (sleutels: EtoroSleutels) => {
    // verzoenNaOrder start binnen anderhalve minuut vijf syncs. Liepen die runs naast elkaar, dan kon
    // een oudere opvraag (status 6) als laatste schrijven over een nieuwere 7, en kostte het dubbel
    // quotum. Loopt er al een, dan slaat deze beurt over; de volgende sync pakt het op.
    if (uitkomstenBezig.current) return;
    uitkomstenBezig.current = true;
    try {
      const sleutelOmgeving = sleutels.omgeving ?? 'real';
      const teControleren = kiesOmOpTeVragen(
        geplaatsteOrdersRef.current.filter(o => o.omgeving === sleutelOmgeving),
        Date.now(),
      );
      // Per verzoekId alleen de velden die de opvraag oplevert. Die gaan bij het wegschrijven over
      // de lijst van dat moment heen, niet over de momentopname van hierboven: een order die
      // intussen genoteerd of weggeklikt is, blijft zo genoteerd of weg.
      const wijzigingen = new Map<string, Partial<GeplaatsteOrder>>();
      for (const order of teControleren) {
        try {
          // Op orderId, niet op referenceId. Gemeten (28 sep 2026, demo): eToro echoot onze
          // x-request-id als referenceId in het orderantwoord, maar de lookup op diezelfde id gaf
          // 404 "No external operation was found". kiesOmOpTeVragen laat alleen orders mét orderId door.
          const status = await zoekOrderStatus({ orderId: order.orderId as number }, sleutels);
          wijzigingen.set(order.verzoekId, status
            ? { laatstGevraagd: Date.now(), status: { id: status.id, naam: status.naam, reden: status.reden }, positieIds: status.positieIds }
            : { laatstGevraagd: Date.now() });
        } catch (e) {
          // Quotum op: de rest van deze ronde zou ook 429 krijgen en het quotum alleen verder
          // oprekken. Deze order niet als gevraagd markeren, dan staat hij de volgende ronde vooraan.
          if (e instanceof EtoroFout && e.status === 429) break;
          // Eén mislukte opvraag mag de rest niet tegenhouden; gewoon de volgende ronde opnieuw.
          wijzigingen.set(order.verzoekId, { laatstGevraagd: Date.now() });
        }
      }

      const actueel = geplaatsteOrdersRef.current;
      const bijgewerkt = actueel.map(o => {
        const wijziging = wijzigingen.get(o.verzoekId);
        return wijziging ? { ...o, ...wijziging } : o;
      });
      // Ook zonder iets op te vragen opruimen, anders blijft een order die nooit een orderId kreeg
      // (en dus nooit opgevraagd wordt) na BEWAAR_MS gewoon staan.
      const opgeruimd = ruimOp(bijgewerkt, Date.now());
      if (wijzigingen.size > 0 || opgeruimd.length !== actueel.length) await bewaarGeplaatst(opgeruimd);
    } catch {
      // Stil: de volgende geslaagde sync probeert het opnieuw.
    } finally {
      uitkomstenBezig.current = false;
    }
  }, [bewaarGeplaatst]);

  // Volledige sync: prijzen, open eToro-posities en op eToro gesloten posities. Gedeeld door
  // pull-to-refresh, de importknop en de eenmalige sync bij het openen van de app.
  // eToro-fouten worden teruggegeven, niet gegooid: de prijsververs uit stap 1 blijft geldig.
  const voerSyncUit = useCallback(async (): Promise<SyncResultaat> => {
    const leeg: SyncResultaat = { gekoppeld: false, toegevoegd: 0, bijgewerkt: 0, gesloten: 0, uitHistorie: 0, overgeslagen: [], fout: null };
    await verversPrijzen();

    const uitkomst = await sleutelUitkomst();
    if (uitkomst.soort === 'geen') {
      // Geen koppeling is geen fout: een oude foutmelding mag hier niet blijven hangen.
      setEtoroFout(null);
      setEtoroGekoppeld(false);
      // Zonder koppeling is er geen saldo om te kennen. Een bedrag van een verwijderde koppeling
      // laten staan zou een totaal vermogen opleveren dat nergens meer op slaat.
      setCreditUsd(null);
      // Zelfde reden: zonder koppeling zijn er geen wachtende orders om te tonen.
      setWachtendeOrderLijst([]);
      return leeg;
    }
    if (uitkomst.soort === 'kluisfout') {
      // Je bent wél gekoppeld, we konden alleen niet bij de sleutel. Dat stilzwijgend als "geen
      // koppeling" afdoen was precies waarom de app kon zeggen dat er geen sleutel was terwijl
      // Instellingen 'm gewoon toonde. Nu gaat de statusindicator hierop oranje staan.
      setEtoroFout(uitkomst.bericht);
      setEtoroGekoppeld(true);
      return { ...leeg, gekoppeld: true, fout: uitkomst.bericht };
    }
    const sleutels = uitkomst.sleutels;
    // De omgeving waar deze ronde voor ophaalt. Na de await hieronder kan de gebruiker gewisseld zijn.
    const syncOmgeving = sleutels.omgeving ?? 'real';
    setEtoroGekoppeld(true);
    laatsteEtoroPogingRef.current = Date.now();

    try {
      const { open, historie, creditUsd: credit, wachtendeOrderLijst: wachtendeLijst } = await importeerEtoroAlles(sleutels);
      // Alleen na een geslaagde ophaal bijwerken. Mislukt de sync, dan blijft de vorige waarde in
      // beeld: die is oud, maar hij is echt geweest.
      //
      // Niet als er intussen van omgeving gewisseld is: setOmgeving heeft deze velden dan net
      // gewist, en een trage demo-sync zou ze anders onder je echte account terugzetten. Bij de
      // wachtende orders is dat meer dan een verkeerd getal, daar hangt een Annuleren-knop aan.
      // De trades hieronder mogen wel door: die dragen hun eigen omgeving en worden daarop gefilterd.
      const nogDezelfdeOmgeving = omgevingRef.current === null || omgevingRef.current === syncOmgeving;
      if (nogDezelfdeOmgeving) {
        setCreditUsd(credit);
        setWachtendeOrderLijst(wachtendeLijst);
      }
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
      // Met de vers opgehaalde posities en historie vooraan; tradesRef loopt hier nog achter.
      verzoenOnbekende([...open.trades, ...historie.trades, ...tradesRef.current]);
      const resultaat: SyncResultaat = {
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
      // Pas na het resultaat en zonder await: zie werkOrderUitkomstenBij.
      werkOrderUitkomstenBij(sleutels);
      return resultaat;
    } catch (e) {
      // Belangrijk: verversPrijzen heeft hierboven al markeerGesynct() gedaan, dus zonder deze
      // vlag zou de statusindicator groen "Bijgewerkt zojuist" melden terwijl je posities
      // helemaal niet zijn opgehaald. bepaalSyncStand maakt er nu een oranje eToro-fout van.
      const bericht = e instanceof Error ? e.message : 'Onbekende fout.';
      setEtoroFout(bericht);
      laatsteEtoroFoutRef.current = Date.now();
      return { ...leeg, gekoppeld: true, fout: bericht };
    }
  }, [verversPrijzen, importeerEtoroTrades, verwerkEtoroHistorie, markeerGesynct, werkOrderUitkomstenBij, verzoenOnbekende]);

  // Eén sync tegelijk. Loopt er al een voor dezelfde omgeving, dan krijgt de aanroeper die belofte
  // terug. Is er intussen van omgeving gewisseld, dan wacht de nieuwe ronde tot de oude klaar is en
  // draait daarna alsnog, anders zou de nieuwe omgeving pas bij de volgende beurt opgehaald worden.
  const synchroniseer = useCallback((): Promise<SyncResultaat> => {
    const bezig = syncBezigRef.current;
    if (bezig && bezig.omgeving === omgevingRef.current) return bezig.belofte;
    const belofte: Promise<SyncResultaat> = (bezig ? bezig.belofte.catch(() => {}).then(voerSyncUit) : voerSyncUit())
      .finally(() => {
        if (syncBezigRef.current?.belofte === belofte) syncBezigRef.current = null;
      });
    syncBezigRef.current = { omgeving: omgevingRef.current, belofte };
    return belofte;
  }, [voerSyncUit]);

  // Mag een extra sync (timer of vangnet) nu? Niet als er al een loopt, niet binnen `tussenpoos` na
  // de vorige poging, en niet binnen NA_FOUT_WACHT_MS na een mislukte.
  const magExtraSyncen = useCallback((tussenpoos: number): boolean => {
    const nu = Date.now();
    return syncBezigRef.current === null
      && nu - laatsteEtoroPogingRef.current >= tussenpoos
      && nu - laatsteEtoroFoutRef.current >= NA_FOUT_WACHT_MS;
  }, []);

  // Automatisch bijwerken zodra de app weer op de voorgrond komt: het interval staat stil terwijl
  // de app op de achtergrond is. Buiten de cooldown ook eToro-posities/-historie meenemen, anders
  // klopt je portfolio wel qua koers maar niet qua posities na een dag afwezigheid.
  useEffect(() => {
    if (!geladen) return;
    const sub = AppState.addEventListener('change', (stand) => {
      if (stand !== 'active') return;
      const nu = Date.now();
      const buitenCooldown = laatsteSyncRef.current === null || nu - laatsteSyncRef.current > HERSYNC_COOLDOWN_MS;
      if (buitenCooldown) synchroniseer(); else verversPrijzen();
    });
    return () => sub.remove();
  }, [geladen, verversPrijzen, synchroniseer]);

  // Eenmalig bij het openen van de app: volledige sync zodra de opgeslagen trades geladen zijn.
  // De ref voorkomt een tweede ronde als React het effect opnieuw draait (StrictMode, remount).
  useEffect(() => {
    if (!geladen || startSyncGedaan.current) return;
    startSyncGedaan.current = true;
    synchroniseer();
  }, [geladen, synchroniseer]);

  // ---------- Direct handelen ----------

  // Omgeving en schrijfrecht komen van schijf. Ook aan te roepen na koppelen of wisselen, want
  // allebei kunnen dan veranderen.
  const ververHandelStatus = useCallback(async () => {
    const [nieuweOmgeving, mag, gekoppeld] = await Promise.all([
      haalOmgeving(), magNuHandelen(), heeftSleutels(),
    ]);
    omgevingRef.current = nieuweOmgeving;
    setOmgevingState(nieuweOmgeving);
    setMagHandelen(mag);
    setEtoroGekoppeld(gekoppeld);
  }, []);

  useEffect(() => {
    ververHandelStatus();
    // Meteen afstrepen tegen de bewaarde trades, zodat de banner ook zonder verbinding klopt.
    Promise.all([
      laadLijst<OnbekendeOrder>(SLEUTELS.onbekendeOrders),
      laadLijst<PortfolioTrade>(SLEUTELS.portfolio),
    ]).then(([lijst, bewaard]) => {
      onbekendeOrdersRef.current = lijst;
      setOnbekendeOrders(lijst);
      verzoenOnbekende(bewaard);
    });
    laadLijst<GeplaatsteOrder>(SLEUTELS.geplaatsteOrders).then(lijst => {
      geplaatsteOrdersRef.current = lijst;
      setGeplaatsteOrders(lijst);
    });
  }, [ververHandelStatus, verzoenOnbekende]);

  const setOmgeving = useCallback(async (nieuw: EtoroOmgeving) => {
    await zetOmgeving(nieuw);
    // Meteen, niet pas na ververHandelStatus: een sync die nu nog van de vorige omgeving onderweg
    // is, moet bij zijn terugkomst al zien dat er gewisseld is.
    omgevingRef.current = nieuw;
    // Het saldo hoort bij de omgeving die je net verlaat. Meteen wissen: mislukt de sync hieronder,
    // dan zou het saldo van je oefenaccount anders onder je echte posities blijven staan.
    setCreditUsd(null);
    // Zelfde reden: de wachtende orders van de vorige omgeving horen hier niet meer te staan.
    setWachtendeOrderLijst([]);
    await ververHandelStatus();
    // De zichtbare lijst hangt aan de omgeving, en de posities van de nieuwe omgeving zijn nog niet
    // opgehaald. Meteen synchroniseren, anders staat het portfolio leeg tot de volgende ronde.
    await synchroniseer();
  }, [ververHandelStatus, synchroniseer]);

  // Eerst naar schijf, dan pas naar state: als de app precies hier omvalt, mag de order niet
  // verdwijnen. Dit is het enige spoor dat er iets onderweg was.
  const noteerOnbekendeOrder = useCallback(async (order: OnbekendeOrder) => {
    await bewaarOnbekende([...onbekendeOrdersRef.current, order]);
  }, [bewaarOnbekende]);

  // Fire-and-forget vanuit de order-sheets: mag de bevestiging aan de gebruiker niet blokkeren, dus
  // de aanroeper vangt zelf een fout af. Leest de ref, niet de state: die is pas na een render bij,
  // en de ref wordt in bewaarGeplaatst al vóór de await gezet.
  const noteerGeplaatsteOrder = useCallback(async (order: GeplaatsteOrder) => {
    await bewaarGeplaatst([...geplaatsteOrdersRef.current, order]);
  }, [bewaarGeplaatst]);

  // De gebruiker tikt "Begrepen" op een uitkomst-melding.
  const wisOrderUitkomst = useCallback(async (verzoekId: string) => {
    await bewaarGeplaatst(geplaatsteOrdersRef.current.filter(o => o.verzoekId !== verzoekId));
  }, [bewaarGeplaatst]);

  // Kijken of de onopgeloste orders inmiddels beantwoord zijn door wat er bij eToro staat. Er wordt
  // hier nooit iets opnieuw verstuurd; er wordt alleen gekeken.
  // Een geslaagde sync strepen ze zelf al af; mislukt hij, dan toch de verlopen-lijst bijwerken.
  const controleerOnbekendeOrders = useCallback(async () => {
    if (onbekendeOrdersRef.current.length === 0) return;
    const resultaat = await synchroniseer();
    if (!resultaat.gekoppeld || resultaat.fout !== null) verzoenOnbekende(tradesRef.current);
  }, [synchroniseer, verzoenOnbekende]);

  // Na elke order meteen synchroniseren, zodat een order die eToro direct vult ook direct in je
  // portfolio staat. Gemeten loopt het portfolio-endpoint van eToro wel vaak achter: de positie
  // bestond al terwijl hij na 0 en na 5 seconden nog niet in het portfolio stond. Vandaar daarna
  // nog een paar keer kijken, met ruimere tussenpozen. Gemeten liep het soms minuten achter, dus de
  // reeks loopt door tot tien minuten. Vijf syncs van vier requests in de eerste anderhalve minuut
  // blijven ruim binnen eToro's quotum van 60 per minuut. Alleen op de voorgrond: een timer die op
  // de achtergrond afgaat slaat zijn beurt over, de foreground-listener synct bij terugkomst toch.
  const verzoenTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const verzoenNaOrder = useCallback(() => {
    // Een tweede order kort na de eerste start een nieuwe reeks; de oude reeks erbij laten lopen
    // zou alleen dubbel het quotum opmaken.
    verzoenTimers.current.forEach(clearTimeout);
    synchroniseer().catch(() => {});
    // Elke timer houdt een tussenpoos aan van de helft van de afstand tot zijn voorganger, met
    // MIN_TUSSEN_EXTRA_SYNCS_MS als plafond. Zo vallen de vroege stappen (5 en 20 seconden) niet weg,
    // maar slaan de late (3, 5, 10 minuten) een beurt over als het vangnet of pull-to-refresh net synct.
    verzoenTimers.current = VERZOEN_NA_ORDER_MS.map((na, i) => {
      const tussenpoos = Math.min(MIN_TUSSEN_EXTRA_SYNCS_MS, (na - (VERZOEN_NA_ORDER_MS[i - 1] ?? 0)) / 2);
      return setTimeout(() => {
        if (AppState.currentState === 'active' && magExtraSyncen(tussenpoos)) synchroniseer().catch(() => {});
      }, na);
    });
  }, [synchroniseer, magExtraSyncen]);

  useEffect(() => () => verzoenTimers.current.forEach(clearTimeout), []);

  // Vangnet naast verzoenNaOrder: zolang er een eigen order van de laatste tien minuten zonder
  // definitieve status is, elke 75 seconden een sync. Ook voor een order die vlak na een app-start
  // nog loopt, waar geen verzoenNaOrder-reeks bij hoort. Stopt vanzelf zodra eToro een eindstatus
  // geeft of de tien minuten om zijn; leest refs, dus het interval hoeft niet opnieuw te starten.
  useEffect(() => {
    if (!geladen) return;
    const id = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const nu = Date.now();
      const actief = omgevingRef.current;
      if (actief === null || !heeftVerseLopendeOrder(geplaatsteOrdersRef.current, actief, nu)) return;
      if (!magExtraSyncen(MIN_TUSSEN_EXTRA_SYNCS_MS)) return;
      synchroniseer().catch(() => {});
    }, NA_ORDER_SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [geladen, synchroniseer, magExtraSyncen]);

  // Annuleert een wachtende order. Nooit automatisch herhalen: net als bij een kooporder beslist de
  // gebruiker, niet een retry-lus.
  const annuleerWachtendeOrder = useCallback(async (order: WachtendeOrder): Promise<AnnuleerResultaat> => {
    const fout = (bericht: string): AnnuleerResultaat => ({ uitkomst: { soort: 'fout', bericht }, statusNa: null });
    const sleutels = await actieveSleutels();
    if (!sleutels) return fout('Er staat geen eToro-sleutel klaar voor deze omgeving.');
    // Het pad van de sleutels bepaalt naar welk account het verzoek gaat. Een demo-orderId naar het
    // echte account sturen (of andersom) mag nooit, ook niet als er door een wissel nog een lijst
    // van de andere omgeving in beeld zou staan.
    if ((sleutels.omgeving ?? 'real') !== order.omgeving) {
      return fout(`Deze order hoort bij je ${order.omgeving === 'demo' ? 'demo-account' : 'echte account'}, niet bij de omgeving die nu actief is. Er is niets verstuurd.`);
    }
    const orderId = order.orderId;
    if (orderId === null) return fout('Kader kan deze order niet herkennen en annuleert hem daarom niet.');
    const uitkomst = await annuleerOrder(orderId, sleutels, guid());
    // Ook bij 'onbekend': het annuleerverzoek kan wel degelijk aangekomen zijn, dus meteen kijken wat
    // er nu bij eToro staat in plaats van te wachten op de volgende ronde.
    if (uitkomst.soort === 'ok' || uitkomst.soort === 'onbekend') verzoenNaOrder();
    if (uitkomst.soort !== 'ok') return { uitkomst, statusNa: null };

    // Eén keer opvragen wat er echt gebeurd is. Alleen lezen, dus buiten de INVARIANT; een fout hier
    // maakt het resultaat niet 'fout', want het verzoek is wel aangenomen. Dan zegt de melding niets.
    await new Promise(klaar => setTimeout(klaar, STATUS_NA_ANNULEREN_MS));
    let statusNa: number | null = null;
    try {
      statusNa = (await zoekOrderStatus({ orderId }, sleutels))?.id ?? null;
    } catch {
      // statusNa blijft null: de melding zegt dan alleen dat het verzoek binnen is.
    }
    // Zelf geannuleerd (7), of de rest ervan (9, 10): daar hoeft later geen melding "is geannuleerd,
    // wil je alsnog kopen" over te komen, want dit was je eigen bewuste keuze.
    if (statusNa === 7 || statusNa === 9 || statusNa === 10) {
      try {
        await bewaarGeplaatst(geplaatsteOrdersRef.current.filter(o => o.orderId !== orderId));
      } catch {
        // Wegschrijven mislukt: dan komt de melding alsnog, dat is hinderlijk maar niet fout.
      }
    }
    return { uitkomst, statusNa };
  }, [verzoenNaOrder, bewaarGeplaatst]);

  // Eén filter, één keer bij de bron, zodat elke consument het erft: het portfolio, de statistieken
  // en de historie tonen alleen de actieve omgeving. Handmatige trades horen bij geen omgeving en
  // blijven dus altijd staan. Let op dat tradesRef, importeerEtoroTrades en verwerkEtoroHistorie
  // bewust tegen de volledige lijst blijven werken.
  const zichtbareTrades = useMemo(
    () => trades.filter(t => bronVan(t) === 'handmatig' || (t.etoroOmgeving ?? 'real') === omgeving),
    [trades, omgeving],
  );

  // Tweede slot naast de omgevingscheck in synchroniseer: alleen de wachtende orders van de actieve
  // omgeving in beeld, zodat er nooit een Annuleren-knop staat bij een order van het andere account.
  // Plus: een eigen order waarvan de statusopvraag al een eindstatus gaf, ook al stuurt eToro's
  // achterlopende portfolio hem nog mee (zie isAfgerond). Alleen op die status: een open positie met
  // hetzelfde orderID verbergt niets, want die koppeling is niet gemeten (zie etoro.ts).
  const zichtbareWachtendeOrders = useMemo(
    () => wachtendeOrderLijst.filter(o => o.omgeving === omgeving && !isAfgerond(o, geplaatsteOrders)),
    [wachtendeOrderLijst, omgeving, geplaatsteOrders],
  );
  // Saldo, gereserveerd bedrag en aantal over precies die lijst, zodat een verborgen order ook niet
  // meer als vastgezet geld telt.
  const { vrijSaldoUsd, gereserveerdUsd, wachtendeOrders } = useMemo(
    () => saldoOverOrders(creditUsd, zichtbareWachtendeOrders),
    [creditUsd, zichtbareWachtendeOrders],
  );

  // Zelfde soort filter als hierboven: alleen de meldenswaardige uitkomsten in de actieve omgeving.
  // Een gevulde order zit sowieso nooit in geplaatsteOrders' meldenswaardige subset, zie isMeldenswaard.
  const orderUitkomsten = useMemo(
    () => geplaatsteOrders.filter(o => o.omgeving === omgeving && isMeldenswaard(o)),
    [geplaatsteOrders, omgeving],
  );

  // Zonder memo is dit elke render een vers object, en abonneert elke consument (ook AppInhoud,
  // die alleen synchroniseer gebruikt) zich daardoor op elke wijziging, inclusief de 60s-prijzenpoll.
  const waarde = useMemo<PortfolioContextWaarde>(() => ({
    trades: zichtbareTrades, livePrijzen, livePrijsTijd, geladen, syncing, laatsteSync, syncFout, etoroFout,
    vrijSaldoUsd, gereserveerdUsd, wachtendeOrders, wachtendeOrderLijst: zichtbareWachtendeOrders, etoroGekoppeld,
    voegTradeToe, wijzigTrade, sluitTrade, verwijderTrade, verversPrijzen,
    synchroniseer,
    omgeving, setOmgeving, magHandelen, onbekendeOrders, verlopenOrders,
    noteerOnbekendeOrder, controleerOnbekendeOrders, verzoenNaOrder,
    orderUitkomsten, noteerGeplaatsteOrder, annuleerWachtendeOrder, wisOrderUitkomst,
  }), [
    zichtbareTrades, livePrijzen, livePrijsTijd, geladen, syncing, laatsteSync, syncFout, etoroFout,
    vrijSaldoUsd, gereserveerdUsd, wachtendeOrders, zichtbareWachtendeOrders, etoroGekoppeld,
    voegTradeToe, wijzigTrade, sluitTrade, verwijderTrade, verversPrijzen,
    synchroniseer,
    omgeving, setOmgeving, magHandelen, onbekendeOrders, verlopenOrders,
    noteerOnbekendeOrder, controleerOnbekendeOrders, verzoenNaOrder,
    orderUitkomsten, noteerGeplaatsteOrder, annuleerWachtendeOrder, wisOrderUitkomst,
  ]);

  return (
    <PortfolioContext.Provider value={waarde}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio(): PortfolioContextWaarde {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio moet binnen PortfolioProvider gebruikt worden');
  return ctx;
}
