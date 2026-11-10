// De Copy-tab: Feed (wat doen mijn favorieten nu), Ontdek (wie is goed) en Mijn copies. Zie
// docs/copy-trading-plan.md. Elke kernactie is één tik: de ster, en Kopieer. Kopiëren opent de
// bestaande koopsheet, vooringevuld, waarin de bevestigknop de enige handeling is.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Copy as CopyIcoon, SlidersHorizontal, Users } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { ScreenHeader } from '../components/ScreenHeader';
import { SegmentKnop } from '../components/SegmentKnop';
import { SkeletonKaart } from '../components/SkeletonKaart';
import { Disclaimer } from '../components/Disclaimer';
import { LegeStaatBeeld, Opkomst } from '../components/LegeStaatBeeld';
import { Drukbaar } from '../components/Drukbaar';
import { OfflineMelding } from '../components/OfflineMelding';
import { useReduceMotion } from '../theme/useReduceMotion';
import { kaartLandt, schuifOvergang, uitklapUit } from '../theme/lijstBeweging';
import { haptiek } from '../theme/haptiek';
import { PodiumScherm } from '../components/PodiumScherm';
import { CopyTradeKaart } from '../components/copy/CopyTradeKaart';
import { TraderKaart } from '../components/copy/TraderKaart';
import { TraderProfielScherm } from '../components/copy/TraderProfielScherm';
import { CopyInstellingenSheet } from '../components/copy/CopyInstellingenSheet';
import { VolgStatus } from '../components/copy/VolgStatus';
import { FavorietenRij } from '../components/copy/FavorietenRij';
import { OntdekKop, OntdekFilters, Sortering, sorteerEnFilter } from '../components/copy/OntdekKop';
import { laadLijst, SLEUTELS } from '../storage/opslag';
import { useVerkoopOok } from '../components/copy/useVerkoopOok';
import { useKaderChecks } from '../state/useKaderChecks';
import { useDialoog } from '../state/DialoogProvider';
import { NieuwInKaderScherm } from '../components/NieuwInKaderScherm';
import { EtoroKoppelingWizard } from '../components/EtoroKoppelingWizard';
import { UitlegKnop, UitlegTekst, useUitleg } from '../components/UitlegKnop';
import type { NieuweFeature } from '../changelog';
import { MijnCopies } from '../components/copy/MijnCopies';
import { useKopieerFlow } from '../components/copy/useKopieerFlow';
import { TradersScreen } from './TradersScreen';
import { useCopy, TraderMetScore, ZoekUitkomst } from '../state/CopyProvider';
import { usePortfolio } from '../state/PortfolioProvider';
import { useNavigatie } from '../state/navigatie';
import { useTabZichtbaar } from '../state/tabZichtbaar';
import {
  beoordeelCopyTrade, CopyStand, GRENS_KOPIEER, GRENS_VOLG, MAX_RISICOSCORE, MAX_VERSCHUIVING_PCT,
  MIN_WEKEN_ACTIEF, TrackrecordSamenvatting, WEGING, vatTrackrecordSamen,
} from '../engine/copyTrading';
import { koersFactor } from '../engine/etoroSymbolen';
import { laadFeed, type FeedItem } from '../state/copyOpslag';

type Segment = 'feed' | 'ontdek' | 'mijn';

// Zolang de Copy-tab in beeld is en op de Feed staat: elke minuut kijken.
const FEED_POLL_MS = 60_000;

const SEGMENTEN = [
  { id: 'feed' as const, label: 'Feed' },
  { id: 'ontdek' as const, label: 'Ontdek' },
  { id: 'mijn' as const, label: 'Mijn copies' },
];


function standVan(item: FeedItem, koersen: Record<string, number>): { stand: CopyStand; koers: number | null } {
  const koers = item.symbool && typeof koersen[item.symbool] === 'number' ? koersen[item.symbool] : null;
  const factor = item.symbool ? koersFactor(item.symbool) : 1;
  const stand = beoordeelCopyTrade({
    positie: { positionId: item.positionId, instrumentId: item.instrumentId, openRate: item.openRate / factor, isBuy: item.isBuy },
    symbool: item.symbool,
    koers,
    stop: item.stopLossRate ? item.stopLossRate / factor : null,
    gesloten: item.gesloten,
  });
  return { stand, koers };
}

const pct = (f: number) => `${Math.round(f * 100)}%`;

// De rondleiding bij het eerste bezoek. Daarna kies je meteen je bedrag.
const INTRO: NieuweFeature[] = [
  {
    icoon: 'ontdek', kleur: 'cta', plek: 'Copy, onder Ontdek',
    titel: 'Ontdek de beste crypto-traders',
    tekst: 'Kader haalt de ranglijst van eToro op en geeft elke trader een Kader-score met een oordeel: KOPIEER, VOLG of VERMIJD.',
  },
  {
    icoon: 'ster', kleur: 'goud', plek: 'De ster op elke trader',
    titel: 'Geef een trader een ster',
    tekst: 'Zijn nieuwe crypto-trades verschijnen in je Feed en Kader stuurt je een melding. Kopieerde je een trade, dan hoor je het ook als hij die sluit.',
  },
  {
    icoon: 'copy', kleur: 'primair', plek: 'Copy, onder Feed',
    titel: 'Kopieer met één druk',
    tekst: 'De kooporder staat al klaar met je bedrag, een stop en een doel. Jij kijkt hem na en bevestigt, Kader verstuurt niets zonder jou.',
  },
  {
    icoon: 'risico', kleur: 'winst', plek: 'Elke kopie',
    titel: 'Veilig kopiëren',
    tekst: `Altijd long, zonder hefboom en met een stop. Ligt de koers meer dan ${MAX_VERSCHUIVING_PCT}% van de instap van de trader af, dan kopieert Kader niet: je bent dan te laat.`,
  },
];

const HOE_GEKOZEN =
  'Kader vraagt eToro om de Popular Investors, gesorteerd op het aantal copiers, en ververst die lijst '
  + `elke zes uur. Alleen wie minstens ${MIN_WEKEN_ACTIEF} weken actief is, een eToro-risico van hooguit `
  + `${MAX_RISICOSCORE} heeft en vooral crypto handelt komt erin. Smart Portfolios vallen af. Daarna geeft `
  + `Kader elke trader een eigen score: consistentie (winstmaanden) telt ${pct(WEGING.consistentie)}, risico `
  + `(grootste daling en eToro-risico) ${pct(WEGING.risico)} en spreiding (niet alles in één coin, weinig `
  + `hefboom) ${pct(WEGING.spreiding)}. Vanaf ${GRENS_KOPIEER} is het oordeel KOPIEER, vanaf ${GRENS_VOLG} VOLG, `
  + 'daaronder VERMIJD. Het rendement uit het verleden is geen belofte voor later.';

export function CopyScreen() {
  const { colors } = useTheme();
  const inBeeld = useTabZichtbaar();
  const copy = useCopy();
  const { magHandelen, omgeving, setOmgeving } = usePortfolio();
  const { doel, wisDoel } = useNavigatie();
  const [segment, setSegment] = useState<Segment | null>(null);
  const [zoek, setZoek] = useState('');
  const [sortering, setSortering] = useState<Sortering>('score');
  const [ontdekFilters, setOntdekFilters] = useState<OntdekFilters>({ laagRisico: false, alleenKopieer: false });
  const [zoekUitkomst, setZoekUitkomst] = useState<ZoekUitkomst | null>(null);
  const [zoekBezig, setZoekBezig] = useState(false);
  // De oude handmatige beoordelingen blijven bereikbaar zolang er een is opgeslagen.
  const [heeftHandmatig, setHeeftHandmatig] = useState(false);
  const [profiel, setProfiel] = useState<TraderMetScore | null>(null);
  const [instellingenOpen, setInstellingenOpen] = useState(false);
  const [handmatigOpen, setHandmatigOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [introGezien, setIntroGezien] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  // De Feed gefilterd op één favoriet (tik op zijn avatar), of null voor alles.
  const [feedTrader, setFeedTrader] = useState<string | null>(null);
  const verkoopOok = useVerkoopOok();
  const { toonDialoog } = useDialoog();
  const hoeGekozen = useUitleg();
  const [uitgelicht, setUitgelicht] = useState<string | null>(null);
  const [vernieuwt, setVernieuwt] = useState(false);
  const reduceMotion = useReduceMotion();
  // Wanneer Kader zag dat eToro niet te bereiken was, voor "Laatste poging" in de foutmelding.
  const [foutTijd, setFoutTijd] = useState<Date>(() => new Date());
  useEffect(() => {
    if (copy.feedStand === 'fout' || copy.ranglijstStand === 'fout') setFoutTijd(new Date());
  }, [copy.feedStand, copy.ranglijstStand]);
  const kopieer = useKopieerFlow();

  // Openen op de Feed als er favorieten zijn, anders op Ontdek. Eén keer, zodra dat bekend is.
  useEffect(() => {
    if (segment === null && copy.geladen) setSegment(copy.favorieten.length > 0 ? 'feed' : 'ontdek');
  }, [copy.geladen, copy.favorieten.length, segment]);

  const { verversRanglijst, verversFeed } = copy;

  // Bij het eerste bezoek eerst de rondleiding; het bedrag kiezen komt daarna (zie sluitIntro).
  // De bedragsheet slaat bij elke manier van sluiten op, dus de intro komt maar één keer.
  useEffect(() => {
    if (inBeeld && copy.geladen && !copy.instellingen.ingesteld && !introGezien) {
      setIntroGezien(true);
      setIntroOpen(true);
    }
  }, [inBeeld, copy.geladen, copy.instellingen.ingesteld, introGezien]);

  const sluitIntro = useCallback(() => {
    setIntroOpen(false);
    // Eerst het scherm laten wegschuiven, dan pas de sheet: geen twee Modals tegelijk in beweging.
    setTimeout(() => setInstellingenOpen(true), 280);
  }, []);

  const naKoppelen = useCallback(() => {
    // Zelfde als in Instellingen: leest het schrijfrecht vers en synchroniseert. Daarna de Copy-data.
    setOmgeving(omgeving).catch(() => {});
    verversRanglijst(true).catch(() => {});
    verversFeed().catch(() => {});
  }, [setOmgeving, omgeving, verversRanglijst, verversFeed]);

  // Bij het openen van de tab: ranglijst (uit de cache als die vers is) en de Feed.
  useEffect(() => {
    if (!inBeeld) return;
    verversRanglijst().catch(() => {});
    verversFeed().catch(() => {});
  }, [inBeeld, verversRanglijst, verversFeed]);

  useEffect(() => {
    if (!inBeeld || segment !== 'feed') return;
    const id = setInterval(() => { verversFeed().catch(() => {}); }, FEED_POLL_MS);
    return () => clearInterval(id);
  }, [inBeeld, segment, verversFeed]);

  // Een tik op een melding: naar de Feed, die trade bovenaan oplichten en meteen de koopsheet.
  // Zo is het melding plus één druk op de bevestigknop.
  useEffect(() => {
    if (!doel || doel.soort !== 'copy') return;
    if (doel.segment === 'mijn') {
      setSegment('mijn');
      wisDoel();
      return;
    }
    setSegment('feed');
    const sleutel = doel.sleutel;
    wisDoel();
    if (!sleutel) return;
    setUitgelicht(sleutel);
    // Bij een koude start vanuit de melding kan de Feed nog niet in de context staan; dan van schijf.
    (async () => {
      const item = copy.feed.find(i => i.sleutel === sleutel) ?? (await laadFeed()).find(i => i.sleutel === sleutel);
      if (item && !item.gekopieerd && magHandelen) await kopieer.start(item);
    })().catch(() => {});
    const wekker = setTimeout(() => setUitgelicht(null), 4000);
    return () => clearTimeout(wekker);
    // kopieer.start is per render nieuw; alleen op een nieuw doel reageren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doel]);

  const vernieuw = useCallback(async () => {
    haptiek('vastklikken');
    setVernieuwt(true);
    try {
      if (segment === 'ontdek') await copy.verversRanglijst(true);
      else await copy.verversFeed();
    } finally {
      setVernieuwt(false);
    }
  }, [segment, copy]);

  const traders = useMemo(
    () => sorteerEnFilter(copy.traders, zoek, sortering, ontdekFilters),
    [copy.traders, zoek, sortering, ontdekFilters],
  );
  const trackPerTrader = useMemo(() => {
    const kaart: Record<string, TrackrecordSamenvatting> = {};
    for (const f of copy.favorieten) kaart[f.username.toLowerCase()] = vatTrackrecordSamen(copy.trackrecord, f.username);
    return kaart;
  }, [copy.favorieten, copy.trackrecord]);

  useEffect(() => {
    laadLijst<unknown>(SLEUTELS.traders).then(l => setHeeftHandmatig(l.length > 0)).catch(() => {});
  }, [handmatigOpen]);

  // Een nieuwe zoekterm maakt een eerdere eToro-uitkomst ongeldig.
  const wijzigZoek = useCallback((v: string) => { setZoek(v); setZoekUitkomst(null); }, []);
  const gezocht = zoek.trim();
  const exactInLijst = gezocht.length > 0
    && copy.traders.some(t => t.rij.username.toLowerCase() === gezocht.toLowerCase());
  const { zoekTrader } = copy;
  const zoekBijEtoro = useCallback(async () => {
    if (!gezocht || exactInLijst || zoekBezig) return;
    setZoekBezig(true);
    try {
      setZoekUitkomst(await zoekTrader(gezocht));
    } finally {
      setZoekBezig(false);
    }
  }, [gezocht, exactInLijst, zoekBezig, zoekTrader]);

  // Een filter op iemand die geen favoriet meer is, vervalt vanzelf.
  const filterTrader = feedTrader && copy.favorieten.some(f => f.username.toLowerCase() === feedTrader.toLowerCase())
    ? feedTrader : null;
  const feed = useMemo(
    () => copy.feed
      .filter(i => !filterTrader || i.username.toLowerCase() === filterTrader.toLowerCase())
      .sort((a, b) => (b.openTijd ?? b.gezien) - (a.openTijd ?? a.gezien)),
    [copy.feed, filterTrader],
  );
  const kaderChecks = useKaderChecks(useMemo(
    () => copy.feed.filter(i => i.symbool && i.isBuy && !i.gesloten).map(i => i.symbool as string),
    [copy.feed],
  ));
  const avatars = useMemo(() => {
    const kaart: Record<string, string | undefined> = {};
    for (const t of copy.traders) kaart[t.rij.username.toLowerCase()] = t.rij.avatarUrl;
    return kaart;
  }, [copy.traders]);
  const openProfielVan = useCallback((username: string) => {
    const t = copy.traders.find(x => x.rij.username.toLowerCase() === username.toLowerCase());
    if (t) { setProfiel(t); return; }
    // Het profiel leunt op de ranglijst (score, cijfers). Staat hij daar niet (meer) in, zeg dat dan.
    haptiek('waarschuwing');
    toonDialoog({
      variant: 'informatie',
      titel: `Geen profiel van ${username}`,
      tekst: copy.traders.length === 0
        ? 'De ranglijst is nog niet geladen. Probeer het zo nog eens.'
        : `${username} staat niet meer in de ranglijst van crypto-traders, dus Kader heeft geen actuele score. Zijn trades komen wel gewoon in je Feed.`,
      knoppen: [{ label: 'Oké' }],
    });
  }, [copy.traders, toonDialoog]);

  const instellingenKnop = (
    <Drukbaar
      onPress={() => setInstellingenOpen(true)}
      schaal={0.9}
      style={styles.kopKnop}
      accessibilityRole="button"
      accessibilityLabel="Copy-instellingen"
      hitSlop={8}
    >
      <SlidersHorizontal size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
    </Drukbaar>
  );

  const geenKoppeling = (
    <LegeStaat
      icoon={<CopyIcoon size={26} color={colors.tekstGedimd} strokeWidth={1.5} />}
      titel="Koppel eToro"
      tekst="Kader haalt de ranglijst en de trades van beleggers uit eToro. Koppel je account met een API-sleutel, dat duurt een paar minuten. Een trader beoordelen kan ook zonder koppeling."
      knop={{ label: 'Koppel eToro', onDruk: () => setWizardOpen(true) }}
      tweede={{ label: 'Beoordeel handmatig', onDruk: () => setHandmatigOpen(true) }}
    />
  );

  const renderFeed = () => {
    if (copy.favorieten.length === 0) {
      return (
        <LegeStaat
          icoon={<Users size={26} color={colors.tekstGedimd} strokeWidth={1.5} />}
          titel="Nog geen favorieten"
          tekst="Tik op de ster bij een trader en zijn trades verschijnen hier."
          knop={{ label: 'Naar Ontdek', onDruk: () => setSegment('ontdek') }}
        />
      );
    }
    if (copy.feedStand === 'geen-koppeling') return geenKoppeling;
    if (copy.feedStand === 'laden' && feed.length === 0) return <Skeletons aantal={3} />;
    if (copy.feedStand === 'fout' && feed.length === 0) {
      return (
        <OfflineMelding
          titel="Kader kan eToro nu niet bereiken"
          beschrijving="De trades van je favorieten komen van eToro. Controleer je verbinding."
          melding="Ophalen mislukt"
          lastAttempt={foutTijd}
          onRetry={() => { copy.verversFeed().catch(() => {}); }}
        />
      );
    }
    return (
      <Animated.FlatList
        data={feed}
        keyExtractor={i => i.sleutel}
        itemLayoutAnimation={schuifOvergang(reduceMotion)}
        contentContainerStyle={styles.lijst}
        refreshControl={<RefreshControl refreshing={vernieuwt} onRefresh={vernieuw} tintColor={colors.cta} colors={[colors.cta]} />}
        ListHeaderComponent={
          <View>
            <FavorietenRij
              favorieten={copy.favorieten}
              avatars={avatars}
              gekozen={filterTrader}
              onKies={setFeedTrader}
              onProfiel={openProfielVan}
              onNaarOntdek={() => setSegment('ontdek')}
            />
            <VolgStatus laatstGekeken={copy.laatstGekeken} />
          </View>
        }
        ListEmptyComponent={
          <Text style={[Type.body, styles.uitleg, { color: colors.tekstGedimd }]}>
            {filterTrader
              ? `Nog geen trades van ${filterTrader} in je Feed. Tik nog een keer op zijn avatar voor alle trades.`
              : 'Nog geen nieuwe trades van je favorieten. Zodra er een opent, staat hij hier.'}
          </Text>
        }
        renderItem={({ item, index }) => {
          const { stand, koers } = standVan(item, copy.koersen);
          const teVerkopen = verkoopOok.tradeVoor(item);
          return (
            <Animated.View entering={kaartLandt(index, reduceMotion)} exiting={uitklapUit()}>
            <CopyTradeKaart
              volgorde={index}
              item={item}
              stand={stand}
              koers={koers}
              bedragUsd={copy.instellingen.bedragUsd}
              magHandelen={magHandelen}
              bezig={kopieer.bezigSleutel === item.sleutel}
              uitgelicht={uitgelicht === item.sleutel}
              onKopieer={() => { kopieer.start(item).catch(() => {}); }}
              onVerkoopOok={teVerkopen ? () => verkoopOok.open(teVerkopen) : undefined}
              kaderCheck={item.symbool ? kaderChecks[item.symbool] : undefined}
            />
            </Animated.View>
          );
        }}
        ListFooterComponent={<Disclaimer />}
      />
    );
  };

  const renderOntdek = () => {
    if (copy.ranglijstStand === 'geen-koppeling') return geenKoppeling;
    if ((copy.ranglijstStand === 'laden' || copy.ranglijstStand === 'leeg') && traders.length === 0) return <Skeletons aantal={5} />;
    if (copy.ranglijstStand === 'fout' && traders.length === 0) {
      return (
        <OfflineMelding
          titel="Kader kan eToro nu niet bereiken"
          beschrijving="De ranglijst van traders komt van eToro. Controleer je verbinding."
          melding={copy.ranglijstFout ?? 'Ophalen mislukt'}
          lastAttempt={foutTijd}
          onRetry={() => { copy.verversRanglijst(true).catch(() => {}); }}
        />
      );
    }
    const tijd = copy.ranglijstTijd
      ? new Date(copy.ranglijstTijd).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
      : null;
    return (
      <Animated.FlatList
        data={traders}
        keyExtractor={t => t.rij.username}
        itemLayoutAnimation={schuifOvergang(reduceMotion)}
        contentContainerStyle={styles.lijst}
        refreshControl={<RefreshControl refreshing={vernieuwt} onRefresh={vernieuw} tintColor={colors.cta} colors={[colors.cta]} />}
        ListHeaderComponent={
          <View>
            <OntdekKop
              zoek={zoek}
              onZoek={wijzigZoek}
              onZoekBijEtoro={() => { zoekBijEtoro().catch(() => {}); }}
              sortering={sortering}
              onSortering={setSortering}
              filters={ontdekFilters}
              onFilters={setOntdekFilters}
            />
            {gezocht.length > 0 && !exactInLijst && (
              <View style={styles.zoekBlok}>
                {zoekUitkomst === null ? (
                  <Drukbaar
                    onPress={() => { zoekBijEtoro().catch(() => {}); }}
                    accessibilityRole="button"
                    style={styles.zoekKnop}
                  >
                    <Text style={[Type.body, { color: colors.cta }]}>
                      {zoekBezig ? 'Even zoeken bij eToro' : `Zoek "${gezocht}" bij eToro`}
                    </Text>
                  </Drukbaar>
                ) : zoekUitkomst.soort === 'gevonden' ? (
                  <TraderKaart
                    trader={zoekUitkomst.trader}
                    favoriet={copy.isFavoriet(zoekUitkomst.trader.rij.username)}
                    onWisselFavoriet={() => copy.wisselFavoriet({ username: zoekUitkomst.trader.rij.username, cid: zoekUitkomst.trader.rij.cid })}
                    onOpen={() => setProfiel(zoekUitkomst.trader)}
                    bron={{ kleur: colors.kaart, radius: radii.kaart }}
                    buiten={zoekUitkomst.buiten}
                    trackrecord={trackPerTrader[zoekUitkomst.trader.rij.username.toLowerCase()]}
                  />
                ) : (
                  <Text style={[Type.body, styles.uitleg, { color: colors.tekstGedimd }]}>
                    {zoekUitkomst.soort === 'niet-gevonden'
                      ? `eToro kent geen trader met precies de naam "${gezocht}". Let op de schrijfwijze, zoals op zijn profiel.`
                      : zoekUitkomst.soort === 'geen-koppeling'
                        ? 'Koppel eToro om traders op te zoeken.'
                        : `Zoeken lukte niet: ${zoekUitkomst.melding}`}
                  </Text>
                )}
              </View>
            )}
            {copy.favorietenVol && (
              <Text style={[Type.caption, styles.uitleg, { color: colors.letOp }]}>
                Je hebt al 20 favorieten. Haal er een weg voor je een nieuwe toevoegt.
              </Text>
            )}
            <View style={styles.lijstKopBlok}>
              <View style={styles.lijstKopRij}>
                <Text style={[Type.overline, styles.flex, { color: colors.tekstGedimd }]}>
                  {traders.length === copy.traders.length ? traders.length : `${traders.length} VAN ${copy.traders.length}`} CRYPTO-TRADERS{tijd ? ` · BIJGEWERKT ${tijd}` : ''}
                </Text>
                <UitlegKnop open={hoeGekozen.open} onWissel={hoeGekozen.wissel} onderwerp="hoe Kader deze traders kiest" />
              </View>
              {!hoeGekozen.open && (
                <Drukbaar onPress={hoeGekozen.wissel} accessibilityRole="button" hitSlop={6}>
                  <Text style={[Type.caption, { color: colors.cta }]}>Hoe kiest Kader deze traders?</Text>
                </Drukbaar>
              )}
              <UitlegTekst open={hoeGekozen.open} tekst={HOE_GEKOZEN} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={[Type.body, styles.uitleg, { color: colors.tekstGedimd }]}>
            {gezocht ? `Niemand in de lijst met "${gezocht}" in de naam.` : 'Geen traders met deze filters.'}
          </Text>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={kaartLandt(index, reduceMotion)} exiting={uitklapUit()}>
          <TraderKaart
            volgorde={index}
            trader={item}
            favoriet={copy.isFavoriet(item.rij.username)}
            onWisselFavoriet={() => copy.wisselFavoriet({ username: item.rij.username, cid: item.rij.cid })}
            onOpen={() => setProfiel(item)}
            bron={{ kleur: colors.kaart, radius: radii.kaart }}
            trackrecord={trackPerTrader[item.rij.username.toLowerCase()]}
          />
          </Animated.View>
        )}
        ListFooterComponent={
          <View>
            {heeftHandmatig && (
              <Drukbaar
                onPress={() => setHandmatigOpen(true)}
                accessibilityRole="button"
                style={styles.handmatig}
              >
                <Text style={[Type.body, { color: colors.cta }]}>Je handmatige beoordelingen</Text>
              </Drukbaar>
            )}
            <Disclaimer />
          </View>
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: colors.achtergrond }]}>
      <ScreenHeader titel="Copy" rechts={instellingenKnop} />
      <View style={styles.segment}>
        <SegmentKnop opties={SEGMENTEN} actief={segment ?? 'feed'} onKies={setSegment} />
      </View>

      <View style={styles.flex}>
        {segment === null ? <Skeletons aantal={3} />
          : segment === 'feed' ? renderFeed()
          : segment === 'ontdek' ? renderOntdek()
          : (
            <FlatList
              data={[]}
              renderItem={null}
              contentContainerStyle={styles.lijst}
              ListHeaderComponent={<MijnCopies inBeeld={inBeeld && segment === 'mijn'} />}
              ListFooterComponent={<Disclaimer />}
            />
          )}
      </View>

      <TraderProfielScherm trader={profiel} onSluiten={() => setProfiel(null)} />
      <CopyInstellingenSheet
        zichtbaar={instellingenOpen}
        huidig={copy.instellingen}
        onOpslaan={copy.wijzigInstellingen}
        onSluiten={() => setInstellingenOpen(false)}
      />
      <NieuwInKaderScherm
        zichtbaar={introOpen}
        onSluiten={sluitIntro}
        features={INTRO}
        kop="ZO WERKT COPY"
        laatsteLabel="Kies je bedrag"
      />
      <EtoroKoppelingWizard zichtbaar={wizardOpen} onSluiten={() => setWizardOpen(false)} onOpgeslagen={naKoppelen} />
      <PodiumScherm zichtbaar={handmatigOpen} onSluiten={() => setHandmatigOpen(false)}>
        {sluit => <TradersScreen onSluiten={() => sluit()} />}
      </PodiumScherm>
      {kopieer.sheet}
      {verkoopOok.sheet}
    </SafeAreaView>
  );
}

function Skeletons({ aantal }: { aantal: number }) {
  return (
    <View style={styles.lijst}>
      {Array.from({ length: aantal }, (_, i) => (
        <Animated.View key={i} exiting={uitklapUit()}><SkeletonKaart /></Animated.View>
      ))}
    </View>
  );
}

function LegeStaat({ icoon, titel, tekst, knop, tweede }: {
  icoon?: React.ReactNode;
  titel: string;
  tekst: string;
  knop?: { label: string; onDruk: () => void };
  tweede?: { label: string; onDruk: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.leeg}>
      {icoon && (
        <Opkomst volgorde={0}>
          <LegeStaatBeeld>{icoon}</LegeStaatBeeld>
        </Opkomst>
      )}
      <Opkomst volgorde={1}>
        <Text style={[Type.titel, styles.midden, { color: colors.tekstPrimair, marginTop: spacing.base }]}>{titel}</Text>
      </Opkomst>
      <Opkomst volgorde={2}>
        <Text style={[Type.body, styles.midden, { color: colors.tekstGedimd, marginTop: spacing.sm, lineHeight: 24 }]}>{tekst}</Text>
      </Opkomst>
      {knop && (
        <Opkomst volgorde={3}>
          <Drukbaar onPress={knop.onDruk} haptiek="tik" accessibilityRole="button" style={[styles.leegKnop, { backgroundColor: colors.cta }]}>
            <Text style={[Type.body, { color: '#FFFFFF', fontWeight: '600' }]}>{knop.label}</Text>
          </Drukbaar>
        </Opkomst>
      )}
      {tweede && (
        <Opkomst volgorde={4}>
          <Drukbaar onPress={tweede.onDruk} accessibilityRole="button" style={styles.tweedeKnop}>
            <Text style={[Type.body, { color: colors.cta }]}>{tweede.label}</Text>
          </Drukbaar>
        </Opkomst>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  kopKnop: { minHeight: 44, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  segment: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  lijst: { paddingTop: spacing.md, paddingBottom: spacing.md },
  zoekBlok: { marginBottom: spacing.md },
  zoekKnop: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.base },
  lijstKopBlok: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm, gap: 4 },
  lijstKopRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tweedeKnop: { minHeight: 48, justifyContent: 'center', marginTop: spacing.sm },
  uitleg: { marginHorizontal: spacing.base, marginBottom: spacing.md, lineHeight: 22 },
  handmatig: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.base },
  leeg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  midden: { textAlign: 'center' },
  leegKnop: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    minHeight: 44,
    marginTop: spacing.lg,
  },
});
