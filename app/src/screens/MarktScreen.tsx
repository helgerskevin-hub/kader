import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet, RefreshControl, LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw, SlidersHorizontal, TriangleAlert } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { useMarkt } from '../state/MarktProvider';
import { useNavigatie } from '../state/navigatie';
import { MeldingNotitie } from '../components/MeldingNotitie';
import { MIN_RISK_REWARD } from '../engine/analyzer';
import { useFavorieten } from '../state/useFavorieten';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { TradeCard } from '../components/TradeCard';
import { GetradeFormulier } from '../components/GetradeFormulier';
import { KooporderSheet } from '../components/KooporderSheet';
import { usePortfolio } from '../state/PortfolioProvider';
import { infoVoor } from '../engine/coinInfo';
import { Disclaimer } from '../components/Disclaimer';
import { ScreenHeader } from '../components/ScreenHeader';
import { SkeletonCard } from '../components/SkeletonCard';
import { MarktBalk } from '../components/MarktBalk';
import { OfflineMelding } from '../components/OfflineMelding';
import { Laadbalk } from '../components/Laadbalk';
import { AngstHebzucht } from '../components/AngstHebzucht';
import { WatKopenNu } from '../components/WatKopenNu';
import { BearModusKaart } from '../components/BearModusKaart';
import { RelatieveSterkteKaart } from '../components/RelatieveSterkteKaart';
import { ShortSignalenKaart } from '../components/ShortSignalenKaart';
import { MarktFilters, MarktFilterState, STANDAARD_FILTERS, aantalActieveFilters } from '../components/MarktFilters';
import { haalFearGreed } from '../engine/marketData';
import { CoinDetailScherm } from '../components/CoinDetailScherm';
import { CoinDetailData, vanTrade } from '../engine/coinDetailData';
import { useReduceMotion } from '../theme/useReduceMotion';
import { limietVoor, useStopLossLimieten } from '../state/useStopLossLimiet';

type Progress = { current: number; total: number; symbool: string };
type Filter = 'alle' | 'favorieten';

export function MarktScreen() {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { state, startAnalyse } = useMarkt();
  const { doel: navigatieDoel, wisDoel } = useNavigatie();
  const [meldingNotitie, setMeldingNotitie] = useState<string | null>(null);
  const { isFavoriet, wisselFavoriet } = useFavorieten();
  const [getradeteTrade, setGetradeteTrade] = useState<Trade | null>(null);
  const [koopTrade, setKoopTrade] = useState<Trade | null>(null);
  const [detailCoin, setDetailCoin] = useState<CoinDetailData | null>(null);
  // Geen schrijfrecht in de actieve omgeving betekent geen koopknop. De kaart is dan identiek
  // aan hoe hij altijd was.
  const { magHandelen } = usePortfolio();
  const [ververst, setVerverstState] = useState(false);
  const [fearGreed, setFearGreed] = useState<{ waarde: number; klasse: string } | null>(null);
  const [filter, setFilter] = useState<Filter>('alle');
  const [marktFilters, setMarktFilters] = useState<MarktFilterState>(STANDAARD_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Eén keer per scherm, niet per kaart: de stop-loss-grenzen van eToro voor alle coins. Ze bepalen
  // welke stop er op de kaarten staat, want Kaders eigen niveau is voor de meeste coins krapper dan
  // eToro toestaat en dan is het een niveau dat je niet kunt zetten.
  const stopLimieten = useStopLossLimieten();
  // Relatieve sterkte per symbool, uit dezelfde scan die de kaarten vult. Kost dus niets extra.
  // Los van de "Wie houdt stand?"-lijst hieronder, die alleen bij een niet-gunstig klimaat
  // verschijnt: dit cijfer hoort bij elke coin, in elk klimaat.
  // state is een union: relatieveSterkte bestaat alleen in de success-tak, dus eerst toetsen.
  const rsLijst = state.status === 'success' ? state.relatieveSterkte : null;
  const rsPerSymbool = useMemo(
    () => Object.fromEntries((rsLijst ?? []).map(r => [r.symbool, r.versusBtc])),
    [rsLijst],
  );

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

  // Aangetikt vanuit het meldingenlog. Anders dan bij het portfolio hebben we de data hier niet
  // altijd al: is er nog geen analyse gedraaid, dan start die eerst en blijft het doel staan tot
  // de coins binnen zijn. Zonder dat kom je na een tik op een koopsignaal uit op "Nog geen
  // analyse" en moet je het zelf nog een keer doen.
  useEffect(() => {
    if (!navigatieDoel) return;
    if (navigatieDoel.soort === 'markt') { wisDoel(); return; }
    if (navigatieDoel.soort !== 'coin') return;

    if (state.status === 'idle') { startAnalyse(); return; }
    if (state.status === 'loading') return;
    // Bij een fout staat er al een scherm dat uitlegt wat er mis is; daar niets overheen zetten.
    if (state.status === 'error') { wisDoel(); return; }

    const trade = state.alle.find(t => t.symbool === navigatieDoel.symbool);
    if (trade) {
      setDetailCoin(vanTrade(trade, rsPerSymbool[trade.symbool]));
    } else {
      setMeldingNotitie(
        `${navigatieDoel.symbool} zat niet in de laatste analyse. Ververs de markt en probeer het opnieuw.`,
      );
    }
    wisDoel();
    // rsPerSymbool hangt af van state en verandert dus mee, maar hij staat er expliciet bij:
    // anders leest een lezer (en een linter) dit als een vergeten afhankelijkheid.
  }, [navigatieDoel, state, rsPerSymbool, startAnalyse, wisDoel]);

  async function handleVervers() {
    if (ververst) return;
    setVerverstState(true);
    await Promise.all([startAnalyse(true), haalFearGreed().then(setFearGreed)]);
    setVerverstState(false);
  }

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

  const bearModus = state.status === 'success' && state.klimaat?.klimaat === 'ongunstig';

  // De relatieve-sterktelijst kent alleen symbolen. De bijbehorende analyse zoeken we op in `alle`
  // en niet in `trades`: een coin die standhoudt in een dalende markt scoort vaak juist laag op
  // momentum en valt dan buiten de top-20 die de lijst toont.
  function openCoinDetail(symbool: string) {
    if (state.status !== 'success') return;
    const trade = state.alle.find(t => t.symbool === symbool);
    if (trade) setDetailCoin(vanTrade(trade, rsPerSymbool[trade.symbool]));
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: colors.achtergrond }]}>
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
              onOpenDetail={t => setDetailCoin(vanTrade(t, rsPerSymbool[t.symbool]))}
              favoriet={isFavoriet(item.symbool)}
              onToggleFavoriet={wisselFavoriet}
              onKoop={magHandelen ? setKoopTrade : undefined}
              limiet={limietVoor(stopLimieten, item.symbool)}
              versusBtc={rsPerSymbool[item.symbool]}
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
              {meldingNotitie && (
                <MeldingNotitie tekst={meldingNotitie} onSluiten={() => setMeldingNotitie(null)} />
              )}
              {/* Niet in bear-modus: dan staat er al een kaart die uitlegt waarom er geen koopsignaal
                  is, en is de klimaatpoort de zwaarwegende reden. Twee balken die allebei "vandaag
                  geen koopsignaal" zeggen, met de minst belangrijke bovenaan, begraven het punt. */}
              {!bearModus && state.trades.length > 0 && !state.trades.some(t => t.voldoetAanRR) && (
                <RrWaarschuwing bekeken={state.bekeken} />
              )}
              {/* In een dalende markt is "wat moet ik nu kopen" de verkeerde vraag: het antwoord is
                  dan maandenlang hetzelfde lege "wacht op een sterker signaal". De bear-modus-kaart
                  neemt die plek in en vertelt wat er wél te doen is. */}
              {bearModus ? (
                <BearModusKaart stand={state.bearModus} />
              ) : (
                <WatKopenNu trades={weergegevenTrades} onOpenDetail={t => setDetailCoin(vanTrade(t, rsPerSymbool[t.symbool]))} />
              )}
              {/* Short-signalen zijn de actionable tegenhanger van de bear-modus-kaart: die legt uit
                  waarom er geen koopsignaal is, dit is wat er dan wél te doen valt. Leeg zolang het
                  klimaat niet ongunstig is, want dan levert analyseerMarkt() hier niets voor aan. */}
              <ShortSignalenKaart
                signalen={state.shorts}
                limieten={stopLimieten}
                magHandelen={magHandelen}
                onGetrade={setGetradeteTrade}
                onKoop={magHandelen ? setKoopTrade : undefined}
                onOpenDetail={t => setDetailCoin(vanTrade(t, rsPerSymbool[t.symbool]))}
              />
              {state.klimaat && <MarktBalk klimaat={state.klimaat} />}
              {/* Alleen als het klimaat niet gunstig is. In een stijgende markt zegt de gewone score
                  al waar de kracht zit en zou deze lijst er een tweede rangschikking naast zetten. */}
              {state.klimaat && state.klimaat.klimaat !== 'gunstig' && (
                <RelatieveSterkteKaart
                  lijst={state.relatieveSterkte}
                  klimaat={state.klimaat.klimaat}
                  onOpenCoin={openCoinDetail}
                />
              )}
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
                  {state.trades.length} van {state.bekeken} coins · gesorteerd op signaalsterkte
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
            ) : (
              <Text style={[Type.body, styles.leegFavorieten, { color: colors.tekstGedimd }]}>
                Er kwam van geen enkele coin marktdata binnen. Trek de lijst omlaag om het opnieuw
                te proberen.
              </Text>
            )
          }
          ListFooterComponent={<Disclaimer />}
        />
      )}

      <GetradeFormulier
        zichtbaar={getradeteTrade !== null}
        trade={getradeteTrade}
        onSluiten={() => setGetradeteTrade(null)}
      />

      {koopTrade && (
        <KooporderSheet
          zichtbaar
          symbool={koopTrade.symbool}
          naam={infoVoor(koopTrade.symbool).naam}
          entry={koopTrade.entry}
          stop={koopTrade.stopLoss}
          doel={koopTrade.takeProfit}
          richting={koopTrade.richting}
          onSluiten={() => setKoopTrade(null)}
        />
      )}

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
// Geen enkele coin haalt de R/R-drempel. Dat is een normale markttoestand, geen storing, maar
// zonder deze uitleg lijkt het scherm kapot: je ziet dan wel scores en niveaus en nergens een KOOP.
function RrWaarschuwing({ bekeken }: { bekeken: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.waarschuwing, { backgroundColor: colors.kaart, borderColor: colors.letOp }]}>
      <View style={styles.waarschuwingKop}>
        <TriangleAlert size={16} color={colors.letOp} strokeWidth={2} />
        <Text style={[Type.overline, { color: colors.letOp }]}>
          GEEN COIN HAALT NU 1:{MIN_RISK_REWARD}
        </Text>
      </View>
      <Text style={[Type.body, { color: colors.tekstGedimd, lineHeight: 22 }]}>
        Alle {bekeken} coins zijn geanalyseerd, maar bij geen enkele ligt het doel ver genoeg boven
        de stop. Je ziet de analyse hieronder ter informatie; er staat vandaag geen koopsignaal
        tussen.
      </Text>
    </View>
  );
}

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
  lijst: { paddingTop: spacing.md, paddingBottom: spacing.md },
  waarschuwing: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.base,
    borderRadius: radii.kaart,
    borderLeftWidth: 3,
    gap: spacing.sm,
  },
  waarschuwingKop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
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
