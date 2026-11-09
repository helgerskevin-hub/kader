// De Copy-tab: Feed (wat doen mijn favorieten nu), Ontdek (wie is goed) en Mijn copies. Zie
// docs/copy-trading-plan.md. Elke kernactie is één tik: de ster, en Kopieer. Kopiëren opent de
// bestaande koopsheet, vooringevuld, waarin de bevestigknop de enige handeling is.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
import { PodiumScherm } from '../components/PodiumScherm';
import { CopyTradeKaart } from '../components/copy/CopyTradeKaart';
import { TraderKaart } from '../components/copy/TraderKaart';
import { TraderProfielScherm } from '../components/copy/TraderProfielScherm';
import { CopyInstellingenSheet } from '../components/copy/CopyInstellingenSheet';
import { MijnCopies } from '../components/copy/MijnCopies';
import { useKopieerFlow } from '../components/copy/useKopieerFlow';
import { TradersScreen } from './TradersScreen';
import { useCopy, TraderMetScore } from '../state/CopyProvider';
import { usePortfolio } from '../state/PortfolioProvider';
import { useNavigatie } from '../state/navigatie';
import { useTabZichtbaar } from '../state/tabZichtbaar';
import { beoordeelCopyTrade, CopyStand } from '../engine/copyTrading';
import { koersFactor } from '../engine/etoroSymbolen';
import { laadFeed, type FeedItem } from '../state/copyOpslag';

type Segment = 'feed' | 'ontdek' | 'mijn';
type Filter = 'alles' | 'laag-risico' | 'copiers';

// Zolang de Copy-tab in beeld is en op de Feed staat: elke minuut kijken.
const FEED_POLL_MS = 60_000;

const SEGMENTEN = [
  { id: 'feed' as const, label: 'Feed' },
  { id: 'ontdek' as const, label: 'Ontdek' },
  { id: 'mijn' as const, label: 'Mijn copies' },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'alles', label: 'Alles' },
  { id: 'laag-risico', label: 'Laag risico' },
  { id: 'copiers', label: 'Meeste copiers' },
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

export function CopyScreen() {
  const { colors } = useTheme();
  const inBeeld = useTabZichtbaar();
  const copy = useCopy();
  const { magHandelen } = usePortfolio();
  const { doel, wisDoel } = useNavigatie();
  const [segment, setSegment] = useState<Segment | null>(null);
  const [filter, setFilter] = useState<Filter>('alles');
  const [profiel, setProfiel] = useState<TraderMetScore | null>(null);
  const [instellingenOpen, setInstellingenOpen] = useState(false);
  const [handmatigOpen, setHandmatigOpen] = useState(false);
  const [uitgelicht, setUitgelicht] = useState<string | null>(null);
  const [vernieuwt, setVernieuwt] = useState(false);
  const kopieer = useKopieerFlow();

  // Openen op de Feed als er favorieten zijn, anders op Ontdek. Eén keer, zodra dat bekend is.
  useEffect(() => {
    if (segment === null && copy.geladen) setSegment(copy.favorieten.length > 0 ? 'feed' : 'ontdek');
  }, [copy.geladen, copy.favorieten.length, segment]);

  // Het instellingenvenster één keer, bij het eerste bezoek.
  useEffect(() => {
    if (inBeeld && copy.geladen && !copy.instellingen.ingesteld) setInstellingenOpen(true);
  }, [inBeeld, copy.geladen, copy.instellingen.ingesteld]);

  // Bij het openen van de tab: ranglijst (uit de cache als die vers is) en de Feed.
  const { verversRanglijst, verversFeed } = copy;
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
    setVernieuwt(true);
    try {
      if (segment === 'ontdek') await copy.verversRanglijst(true);
      else await copy.verversFeed();
    } finally {
      setVernieuwt(false);
    }
  }, [segment, copy]);

  const traders = useMemo(() => {
    const lijst = [...copy.traders];
    if (filter === 'laag-risico') return lijst.filter(t => (t.rij.riskScore ?? 10) <= 3);
    if (filter === 'copiers') return lijst.sort((a, b) => (b.rij.copiers ?? 0) - (a.rij.copiers ?? 0));
    return lijst;
  }, [copy.traders, filter]);

  const feed = useMemo(
    () => [...copy.feed].sort((a, b) => (b.openTijd ?? b.gezien) - (a.openTijd ?? a.gezien)),
    [copy.feed],
  );

  const instellingenKnop = (
    <Pressable
      onPress={() => setInstellingenOpen(true)}
      style={styles.kopKnop}
      accessibilityRole="button"
      accessibilityLabel="Copy-instellingen"
      hitSlop={8}
    >
      <SlidersHorizontal size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
    </Pressable>
  );

  const geenKoppeling = (
    <LegeStaat
      icoon={<CopyIcoon size={26} color={colors.tekstGedimd} strokeWidth={1.5} />}
      titel="Koppel eToro"
      tekst="Kader haalt de ranglijst en de trades van beleggers uit eToro. Koppel je eToro-account via de drie puntjes rechtsboven, bij Instellingen. Een trader beoordelen kan ook zonder koppeling."
      knop={{ label: 'Beoordeel handmatig', onDruk: () => setHandmatigOpen(true) }}
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
        <LegeStaat
          titel="Kader kan eToro nu niet bereiken"
          tekst="Controleer je verbinding en probeer het opnieuw."
          knop={{ label: 'Opnieuw', onDruk: () => { copy.verversFeed().catch(() => {}); } }}
        />
      );
    }
    return (
      <FlatList
        data={feed}
        keyExtractor={i => i.sleutel}
        contentContainerStyle={styles.lijst}
        refreshControl={<RefreshControl refreshing={vernieuwt} onRefresh={vernieuw} tintColor={colors.tekstGedimd} />}
        ListEmptyComponent={
          <Text style={[Type.body, styles.uitleg, { color: colors.tekstGedimd }]}>
            Nog geen nieuwe trades van je favorieten. Kader kijkt elke minuut zolang deze tab open is, en
            ongeveer elk kwartier als de app dicht is.
          </Text>
        }
        renderItem={({ item }) => {
          const { stand, koers } = standVan(item, copy.koersen);
          return (
            <CopyTradeKaart
              item={item}
              stand={stand}
              koers={koers}
              bedragUsd={copy.instellingen.bedragUsd}
              magHandelen={magHandelen}
              bezig={kopieer.bezigSleutel === item.sleutel}
              uitgelicht={uitgelicht === item.sleutel}
              onKopieer={() => { kopieer.start(item).catch(() => {}); }}
            />
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
        <LegeStaat
          titel="Kader kan eToro nu niet bereiken"
          tekst={copy.ranglijstFout ?? 'Probeer het opnieuw.'}
          knop={{ label: 'Opnieuw', onDruk: () => { copy.verversRanglijst(true).catch(() => {}); } }}
        />
      );
    }
    const tijd = copy.ranglijstTijd
      ? new Date(copy.ranglijstTijd).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
      : null;
    return (
      <FlatList
        data={traders}
        keyExtractor={t => t.rij.username}
        contentContainerStyle={styles.lijst}
        refreshControl={<RefreshControl refreshing={vernieuwt} onRefresh={vernieuw} tintColor={colors.tekstGedimd} />}
        ListHeaderComponent={
          <View>
            <View style={styles.filters}>
              {FILTERS.map(f => {
                const actief = filter === f.id;
                return (
                  <Drukbaar
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    haptiek="tik"
                    style={[styles.filter, { backgroundColor: actief ? colors.tekstPrimair : colors.verhoogd }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: actief }}
                  >
                    <Text style={[Type.caption, { color: actief ? colors.achtergrond : colors.tekstPrimair }]}>{f.label}</Text>
                  </Drukbaar>
                );
              })}
            </View>
            {copy.favorietenVol && (
              <Text style={[Type.caption, styles.uitleg, { color: colors.letOp }]}>
                Je hebt al 20 favorieten. Haal er een weg voor je een nieuwe toevoegt.
              </Text>
            )}
            <Text style={[Type.overline, styles.lijstKop, { color: colors.tekstGedimd }]}>
              {traders.length} CRYPTO-TRADERS{tijd ? ` · BIJGEWERKT ${tijd}` : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={[Type.body, styles.uitleg, { color: colors.tekstGedimd }]}>Geen traders gevonden met dit filter.</Text>
        }
        renderItem={({ item }) => (
          <TraderKaart
            trader={item}
            favoriet={copy.isFavoriet(item.rij.username)}
            onWisselFavoriet={() => copy.wisselFavoriet({ username: item.rij.username, cid: item.rij.cid })}
            onOpen={() => setProfiel(item)}
            bron={{ kleur: colors.kaart, radius: radii.kaart }}
          />
        )}
        ListFooterComponent={
          <View>
            <Pressable
              onPress={() => setHandmatigOpen(true)}
              accessibilityRole="button"
              style={styles.handmatig}
            >
              <Text style={[Type.body, { color: colors.cta }]}>Trader niet gevonden? Beoordeel handmatig</Text>
            </Pressable>
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
      <PodiumScherm zichtbaar={handmatigOpen} onSluiten={() => setHandmatigOpen(false)}>
        {sluit => <TradersScreen onSluiten={() => sluit()} />}
      </PodiumScherm>
      {kopieer.sheet}
    </SafeAreaView>
  );
}

function Skeletons({ aantal }: { aantal: number }) {
  return (
    <View style={styles.lijst}>
      {Array.from({ length: aantal }, (_, i) => <SkeletonKaart key={i} />)}
    </View>
  );
}

function LegeStaat({ icoon, titel, tekst, knop }: {
  icoon?: React.ReactNode;
  titel: string;
  tekst: string;
  knop?: { label: string; onDruk: () => void };
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
          <Pressable onPress={knop.onDruk} accessibilityRole="button" style={[styles.leegKnop, { backgroundColor: colors.cta }]}>
            <Text style={[Type.body, { color: '#FFFFFF', fontWeight: '600' }]}>{knop.label}</Text>
          </Pressable>
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
  lijstKop: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  filters: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.base, paddingBottom: spacing.md },
  filter: { borderRadius: radii.pill, paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center' },
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
