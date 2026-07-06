import React, { useCallback, useReducer, useState } from 'react';
import {
  View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet, LayoutAnimation, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw, ChevronDown, ChevronUp, Zap } from 'lucide-react-native';
import { Opportunity } from '../engine/types';
import { zoekKansen } from '../engine/opportunities';
import { useReduceMotion } from '../theme/useReduceMotion';
import { fmtPrijs, fmtPct, fmtRR } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { LevelRow } from '../components/LevelRow';
import { Disclaimer } from '../components/Disclaimer';
import { ScreenHeader } from '../components/ScreenHeader';
import { SkeletonCard } from '../components/SkeletonCard';
import { OfflineMelding } from '../components/OfflineMelding';
import { Laadbalk } from '../components/Laadbalk';
import { CoinDetailScherm } from '../components/CoinDetailScherm';
import { CoinDetailData, vanOpportunity } from '../engine/coinDetailData';

// ---------- State machine ----------
type KansenState =
  | { status: 'idle' }
  | { status: 'loading'; gescand: number; totaal: number }
  | { status: 'error'; melding: string; lastAttempt: Date }
  | { status: 'success'; kansen: Opportunity[]; lastUpdate: Date };

type Action =
  | { type: 'START' }
  | { type: 'PROGRESS'; gescand: number; totaal: number }
  | { type: 'SUCCESS'; kansen: Opportunity[] }
  | { type: 'FOUT'; melding: string };

function reducer(state: KansenState, action: Action): KansenState {
  switch (action.type) {
    case 'START': return { status: 'loading', gescand: 0, totaal: 0 };
    case 'PROGRESS': return { status: 'loading', gescand: action.gescand, totaal: action.totaal };
    case 'SUCCESS': return { status: 'success', kansen: action.kansen, lastUpdate: new Date() };
    case 'FOUT': return { status: 'error', melding: action.melding, lastAttempt: new Date() };
    default: return state;
  }
}

// ---------- OpportunityCard ----------
function OpportunityCard({ kans, onOpenDetail }: { kans: Opportunity; onOpenDetail: (kans: Opportunity) => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);

  const randKleur = kans.trendOp === true ? colors.winst
    : kans.trendOp === false ? colors.verlies
    : colors.letOp;

  const pctKleur = (p: number) =>
    p > 0 ? colors.winst : p < 0 ? colors.verlies : colors.tekstGedimd;

  function wisselUitgeklapt() {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setUitgeklapt(v => !v);
  }

  return (
    <View style={[cardStyles.kaart, shadow.kaart, { backgroundColor: colors.kaart, borderLeftColor: randKleur }]}>
      <Pressable
        onPress={() => onOpenDetail(kans)}
        accessibilityRole="button"
        accessibilityLabel={`${kans.symbool} detail bekijken`}
      >
      {/* Koptekst */}
      <View style={cardStyles.kop}>
        <View style={cardStyles.kopLinks}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{kans.naam}</Text>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>#{kans.rang} · {kans.symbool}</Text>
        </View>
        <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>{fmtPrijs(kans.prijs)}</Text>
      </View>

      {/* Percentage-rij */}
      <View style={cardStyles.pctRij}>
        {([
          { label: '24U', val: kans.p24 },
          { label: '7D', val: kans.p7 },
          { label: '30D', val: kans.p30 },
        ] as const).map(({ label, val }) => (
          <View key={label} style={cardStyles.pctItem}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{label}</Text>
            <Text style={[Type.prijs, { color: pctKleur(val), fontSize: 13 }]}>{fmtPct(val)}</Text>
          </View>
        ))}
        {kans.rsi !== null && (
          <View style={cardStyles.pctItem}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>RSI</Text>
            <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>{kans.rsi}</Text>
          </View>
        )}
      </View>

      {/* Niveaus */}
      {kans.heeftTechnisch && (
        <View style={cardStyles.sectie}>
          <LevelRow stop={kans.stopLoss} entry={kans.entry} doel={kans.takeProfit} />
        </View>
      )}

      {/* R/R + methode */}
      <View style={cardStyles.rrRij}>
        {kans.heeftTechnisch && (
          <View style={cardStyles.rrItem}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>R/R</Text>
            <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtRR(kans.rr)}</Text>
          </View>
        )}
        <View style={[cardStyles.methodeBadge, { backgroundColor: colors.verhoogd }]}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{kans.methode.toUpperCase()}</Text>
        </View>
      </View>
      </Pressable>

      {/* Uitklapbare redenen */}
      {uitgeklapt && (
        <View style={[cardStyles.redenen, { backgroundColor: colors.verhoogd }]}>
          {kans.redenen.map((r, i) => (
            <Text key={i} style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>• {r}</Text>
          ))}
        </View>
      )}

      {/* Voet */}
      <View style={[cardStyles.voet, { borderTopColor: colors.rand }]}>
        <Pressable
          style={cardStyles.voetKnop}
          onPress={wisselUitgeklapt}
          accessibilityRole="button"
          accessibilityLabel={uitgeklapt ? 'Minder info' : 'Waarom deze kans'}
        >
          <Text style={[Type.caption, { color: colors.cta }]}>
            {uitgeklapt ? 'Minder' : 'Waarom'}
          </Text>
          {uitgeklapt
            ? <ChevronUp size={12} color={colors.cta} strokeWidth={1.75} />
            : <ChevronDown size={12} color={colors.cta} strokeWidth={1.75} />}
        </Pressable>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    borderLeftWidth: 4,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  kop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.base,
    paddingBottom: spacing.sm,
  },
  kopLinks: { gap: 2, flex: 1 },
  pctRij: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  pctItem: { gap: 2 },
  sectie: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  rrRij: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.base,
  },
  rrItem: { gap: 2 },
  methodeBadge: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  redenen: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderRadius: radii.veld,
    padding: spacing.md,
    gap: 4,
  },
  voet: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.base,
  },
  voetKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.base,
    minHeight: 44,
  },
});

// ---------- Scherm ----------
export function KansenScreen() {
  const { colors } = useTheme();
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });
  const [ververst, setVerverstState] = useState(false);
  const [detailCoin, setDetailCoin] = useState<CoinDetailData | null>(null);

  const startScan = useCallback(async () => {
    dispatch({ type: 'START' });
    try {
      const kansen = await zoekKansen(10, (gescand, totaal) =>
        dispatch({ type: 'PROGRESS', gescand, totaal }),
      );
      dispatch({ type: 'SUCCESS', kansen });
    } catch (e) {
      dispatch({ type: 'FOUT', melding: (e as Error)?.message ?? 'Onbekende fout' });
    }
  }, []);

  async function handleVervers() {
    setVerverstState(true);
    await startScan();
    setVerverstState(false);
  }

  const metaText = state.status === 'success'
    ? `${state.kansen.length} coins · ${state.lastUpdate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
    : undefined;

  return (
    <SafeAreaView style={[screenStyles.root, { backgroundColor: colors.achtergrond }]}>
      <ScreenHeader
        titel="Grote kansen"
        meta={metaText}
        rechts={
          state.status === 'success' ? (
            <Pressable
              onPress={handleVervers}
              accessibilityRole="button"
              accessibilityLabel="Ververs scan"
              style={screenStyles.ververskOp}
            >
              <RefreshCw size={18} color={colors.letOp} strokeWidth={1.75} />
            </Pressable>
          ) : undefined
        }
      />

      {state.status === 'idle' && (
        <View style={screenStyles.midden}>
          <Zap size={40} color={colors.letOp} strokeWidth={1.5} />
          <Text style={[Type.titel, screenStyles.middenTitel, { color: colors.tekstPrimair }]}>
            Zoek grote kansen
          </Text>
          <Text style={[Type.body, screenStyles.middenBody, { color: colors.tekstGedimd }]}>
            Scant de top 250 coins buiten het standaard universum op momentum, volume en technische signalen.
          </Text>
          <Pressable
            style={[screenStyles.ctaKnop, { backgroundColor: colors.letOp }]}
            onPress={startScan}
            accessibilityRole="button"
            accessibilityLabel="Start scan"
          >
            <Zap size={16} color="white" strokeWidth={2} />
            <Text style={[Type.body, screenStyles.ctaTekst]}>Start scan</Text>
          </Pressable>
          <Text style={[Type.caption, { color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.base }]}>
            Data via CoinGecko & Binance · geen financieel advies
          </Text>
        </View>
      )}

      {state.status === 'loading' && (
        <View style={{ flex: 1 }}>
          {state.totaal > 0 && <Laadbalk huidig={state.gescand} totaal={state.totaal} kleur={colors.letOp} />}
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          {state.totaal > 0 && (
            <Text style={[Type.caption, { color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.sm }]}>
              {state.gescand} van {state.totaal} kandidaten
            </Text>
          )}
        </View>
      )}

      {state.status === 'error' && (
        <OfflineMelding
          titel="Scan mislukt"
          beschrijving="CoinGecko of Binance is niet bereikbaar. Controleer je verbinding."
          melding={state.melding}
          lastAttempt={state.lastAttempt}
          onRetry={startScan}
        />
      )}

      {state.status === 'success' && (
        <FlatList
          data={state.kansen}
          keyExtractor={item => item.symbool}
          renderItem={({ item }) => (
            <OpportunityCard kans={item} onOpenDetail={k => setDetailCoin(vanOpportunity(k))} />
          )}
          contentContainerStyle={screenStyles.lijst}
          refreshControl={
            <RefreshControl
              refreshing={ververst}
              onRefresh={handleVervers}
              colors={[colors.letOp]}
              tintColor={colors.letOp}
            />
          }
          ListHeaderComponent={
            <View style={screenStyles.lijstKop}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                {state.kansen.length} coins gevonden · gesorteerd op kansscore
              </Text>
            </View>
          }
          ListFooterComponent={<Disclaimer />}
        />
      )}

      <CoinDetailScherm data={detailCoin} onSluiten={() => setDetailCoin(null)} />
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
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
  middenTitel: { textAlign: 'center', marginBottom: spacing.sm, marginTop: spacing.base },
  middenBody: { textAlign: 'center', marginBottom: spacing.lg, lineHeight: 24 },
  ctaKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    minHeight: 44,
  },
  ctaTekst: { color: 'white', fontWeight: '600' },
  lijst: { paddingTop: spacing.md },
  lijstKop: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
});
