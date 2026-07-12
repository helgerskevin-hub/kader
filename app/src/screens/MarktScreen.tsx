import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet, RefreshControl, LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw, SlidersHorizontal } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { useMarkt } from '../state/MarktProvider';
import { useFavorieten } from '../state/useFavorieten';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { TradeCard } from '../components/TradeCard';
import { GetradeFormulier } from '../components/GetradeFormulier';
import { Disclaimer } from '../components/Disclaimer';
import { ScreenHeader } from '../components/ScreenHeader';
import { SkeletonCard } from '../components/SkeletonCard';
import { MarktBalk } from '../components/MarktBalk';
import { OfflineMelding } from '../components/OfflineMelding';
import { Laadbalk } from '../components/Laadbalk';
import { AngstHebzucht } from '../components/AngstHebzucht';
import { WatKopenNu } from '../components/WatKopenNu';
import { MarktFilters, MarktFilterState, STANDAARD_FILTERS, aantalActieveFilters } from '../components/MarktFilters';
import { haalFearGreed } from '../engine/marketData';
import { CoinDetailScherm } from '../components/CoinDetailScherm';
import { CoinDetailData, vanTrade } from '../engine/coinDetailData';
import { useReduceMotion } from '../theme/useReduceMotion';

type Progress = { current: number; total: number; symbool: string };
type Filter = 'alle' | 'favorieten';

export function MarktScreen() {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { state, startAnalyse } = useMarkt();
  const { isFavoriet, wisselFavoriet } = useFavorieten();
  const [getradeteTrade, setGetradeteTrade] = useState<Trade | null>(null);
  const [detailCoin, setDetailCoin] = useState<CoinDetailData | null>(null);
  const [ververst, setVerverstState] = useState(false);
  const [fearGreed, setFearGreed] = useState<{ waarde: number; klasse: string } | null>(null);
  const [filter, setFilter] = useState<Filter>('alle');
  const [marktFilters, setMarktFilters] = useState<MarktFilterState>(STANDAARD_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  function soepelWisselen() {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }

  function wisselFilterTab(volgende: Filter) {
    soepelWisselen();
    setFilter(volgende);
  }

  function wijzigMarktFilters(volgende: MarktFilterState) {
    soepelWisselen();
    setMarktFilters(volgende);
  }

  useEffect(() => {
    haalFearGreed().then(setFearGreed);
  }, []);

  async function handleVervers() {
    if (ververst) return;
    setVerverstState(true);
    await Promise.all([startAnalyse(true), haalFearGreed().then(setFearGreed)]);
    setVerverstState(false);
  }

  const gemScore = state.status === 'success' && state.trades.length > 0
    ? state.trades.reduce((s, t) => s + t.score, 0) / state.trades.length
    : null;

  const metaText = state.status === 'success'
    ? `${state.trades.length} coins · ${state.lastUpdate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
    : undefined;

  const gesorteerdeTrades = state.status === 'success'
    ? [...state.trades].sort((a, b) => Number(isFavoriet(b.symbool)) - Number(isFavoriet(a.symbool)))
    : [];
  const aantalFavorieten = gesorteerdeTrades.filter(t => isFavoriet(t.symbool)).length;
  const weergegevenTrades = (filter === 'favorieten'
    ? gesorteerdeTrades.filter(t => isFavoriet(t.symbool))
    : gesorteerdeTrades
  )
    .filter(t => marktFilters.rsi === 'alle'
      || (marktFilters.rsi === 'oversold' ? t.rsi < 30 : t.rsi > 70))
    .filter(t => t.score >= marktFilters.minScore)
    .filter(t => t.rr >= marktFilters.minRR);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.achtergrond }]}>
      <ScreenHeader
        titel="Markt"
        meta={metaText}
        rechts={
          state.status === 'success' ? (
            <Pressable
              onPress={handleVervers}
              accessibilityRole="button"
              accessibilityLabel="Ververs analyse"
              style={styles.ververskOp}
            >
              <RefreshCw size={18} color={colors.cta} strokeWidth={1.75} />
            </Pressable>
          ) : undefined
        }
      />

      {/* Inhoud per state */}
      {state.status === 'idle' && <IdleView onStart={() => startAnalyse()} />}
      {state.status === 'loading' && <LadenView progress={state.progress} />}
      {state.status === 'error' && (
        <OfflineMelding
          titel="Geen marktdata"
          beschrijving="Binance en CoinGecko zijn nu niet bereikbaar. Controleer je verbinding en probeer opnieuw."
          melding={state.melding}
          lastAttempt={state.lastAttempt}
          onRetry={() => startAnalyse()}
        />
      )}
      {state.status === 'success' && (
        <FlatList
          data={weergegevenTrades}
          keyExtractor={item => item.symbool}
          renderItem={({ item }) => (
            <TradeCard
              trade={item}
              onGetrade={setGetradeteTrade}
              onOpenDetail={t => setDetailCoin(vanTrade(t))}
              favoriet={isFavoriet(item.symbool)}
              onToggleFavoriet={wisselFavoriet}
            />
          )}
          contentContainerStyle={styles.lijst}
          refreshControl={
            <RefreshControl
              refreshing={ververst}
              onRefresh={handleVervers}
              colors={[colors.cta]}
              tintColor={colors.cta}
            />
          }
          ListHeaderComponent={
            <>
              <WatKopenNu trades={weergegevenTrades} onOpenDetail={t => setDetailCoin(vanTrade(t))} />
              {gemScore !== null && <MarktBalk score={gemScore} />}
              {fearGreed && <AngstHebzucht waarde={fearGreed.waarde} klasse={fearGreed.klasse} />}
              <View style={styles.tabsRij}>
                <FilterTabs actief={filter} onWijzig={wisselFilterTab} aantalFavorieten={aantalFavorieten} />
                <Pressable
                  style={[styles.filterKnop, { backgroundColor: colors.verhoogd }]}
                  onPress={() => setFiltersOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Filters op RSI, score en R/R"
                >
                  <SlidersHorizontal size={17} color={colors.tekstPrimair} strokeWidth={1.75} />
                  {aantalActieveFilters(marktFilters) > 0 && (
                    <View style={[styles.filterBadge, { backgroundColor: colors.cta }]}>
                      <Text style={styles.filterBadgeTekst}>{aantalActieveFilters(marktFilters)}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
              <View style={styles.lijstKop}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                  {state.trades.length} coins geanalyseerd · gesorteerd op signaalsterkte
                </Text>
              </View>
            </>
          }
          ListEmptyComponent={
            filter === 'favorieten' && aantalFavorieten === 0 ? (
              <Text style={[Type.body, styles.leegFavorieten, { color: colors.tekstGedimd }]}>
                Nog geen favorieten. Tik op de ster bij een coin om die hier te verzamelen.
              </Text>
            ) : aantalActieveFilters(marktFilters) > 0 ? (
              <Text style={[Type.body, styles.leegFavorieten, { color: colors.tekstGedimd }]}>
                Geen coins voldoen aan de gekozen filters.
              </Text>
            ) : null
          }
          ListFooterComponent={<Disclaimer />}
        />
      )}

      <GetradeFormulier
        zichtbaar={getradeteTrade !== null}
        trade={getradeteTrade}
        onSluiten={() => setGetradeteTrade(null)}
      />

      <CoinDetailScherm data={detailCoin} onSluiten={() => setDetailCoin(null)} />

      <MarktFilters
        zichtbaar={filtersOpen}
        waarden={marktFilters}
        onWijzig={wijzigMarktFilters}
        onSluiten={() => setFiltersOpen(false)}
      />
    </SafeAreaView>
  );
}

// ---------- Sub-views ----------
function IdleView({ onStart }: { onStart: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.midden}>
      <Text style={[Type.titel, styles.middenTitel, { color: colors.tekstPrimair }]}>Nog geen analyse</Text>
      <Text style={[Type.body, styles.middenBody, { color: colors.tekstGedimd }]}>
        Start een analyse om kansrijke trades met entry, stop en take-profit te zien.
      </Text>
      <Pressable
        style={[styles.ctaKnop, { backgroundColor: colors.cta }]}
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel="Start analyse"
      >
        <Text style={[Type.body, styles.ctaTekst]}>Start analyse</Text>
      </Pressable>
      <Text style={[Type.caption, { color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.base }]}>
        Data via Binance & CoinGecko · geen financieel advies
      </Text>
    </View>
  );
}

function FilterTabs({ actief, onWijzig, aantalFavorieten }: {
  actief: Filter;
  onWijzig: (filter: Filter) => void;
  aantalFavorieten: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tabsWrapper, { backgroundColor: colors.verhoogd }]}>
      <Pressable
        style={[styles.tab, actief === 'alle' && { backgroundColor: colors.kaart }]}
        onPress={() => onWijzig('alle')}
        accessibilityRole="button"
        accessibilityLabel="Alle coins tonen"
      >
        <Text style={[
          Type.caption, styles.tabTekst,
          { color: actief === 'alle' ? colors.tekstPrimair : colors.tekstGedimd },
        ]}>
          Alle coins
        </Text>
      </Pressable>
      <Pressable
        style={[styles.tab, actief === 'favorieten' && { backgroundColor: colors.kaart }]}
        onPress={() => onWijzig('favorieten')}
        accessibilityRole="button"
        accessibilityLabel="Alleen favorieten tonen"
      >
        <Text style={[
          Type.caption, styles.tabTekst,
          { color: actief === 'favorieten' ? colors.tekstPrimair : colors.tekstGedimd },
        ]}>
          Favorieten{aantalFavorieten > 0 ? ` (${aantalFavorieten})` : ''}
        </Text>
      </Pressable>
    </View>
  );
}

function LadenView({ progress }: { progress: Progress | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      {progress && progress.total > 0 && <Laadbalk huidig={progress.current} totaal={progress.total} />}
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      {progress && (
        <Text style={[Type.caption, { color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.sm }]}>
          {progress.current}/{progress.total} · {progress.symbool}
        </Text>
      )}
    </View>
  );
}

// ---------- Stijlen ----------
const styles = StyleSheet.create({
  root: { flex: 1 },
  ververskOp: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  midden: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  middenTitel: { textAlign: 'center', marginBottom: spacing.sm },
  middenBody: { textAlign: 'center', marginBottom: spacing.lg, lineHeight: 24 },
  ctaKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    minHeight: 44,
  },
  ctaTekst: { color: 'white', fontWeight: '600' },
  lijst: { paddingTop: spacing.md },
  lijstKop: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  tabsRij: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tabsWrapper: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: radii.knop,
    padding: 3,
    gap: 3,
  },
  filterKnop: {
    width: 44,
    height: 44,
    borderRadius: radii.knop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeTekst: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.veld,
    minHeight: 40,
  },
  tabTekst: { fontWeight: '600' },
  leegFavorieten: {
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    lineHeight: 22,
  },
});
