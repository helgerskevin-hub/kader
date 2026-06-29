import React, { useState } from 'react';
import {
  View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { useMarkt } from '../state/MarktProvider';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { TradeCard } from '../components/TradeCard';
import { GetradeFormulier } from '../components/GetradeFormulier';
import { Disclaimer } from '../components/Disclaimer';

type Progress = { current: number; total: number; symbool: string };

export function MarktScreen() {
  const { colors } = useTheme();
  const { state, startAnalyse } = useMarkt();
  const [getradeteTrade, setGetradeteTrade] = useState<Trade | null>(null);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.achtergrond }]}>
      {/* Koptekst */}
      <View style={[styles.header, { borderBottomColor: colors.rand }]}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Markt</Text>
        {state.status === 'success' && (
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
            {state.trades.length} coins · {state.lastUpdate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {/* Inhoud per state */}
      {state.status === 'idle' && <IdleView onStart={startAnalyse} />}
      {state.status === 'loading' && <LadenView progress={state.progress} />}
      {state.status === 'error' && <FoutView melding={state.melding} lastAttempt={state.lastAttempt} onRetry={startAnalyse} />}
      {state.status === 'success' && (
        <FlatList
          data={state.trades}
          keyExtractor={item => item.symbool}
          renderItem={({ item }) => (
            <TradeCard
              trade={item}
              onGetrade={setGetradeteTrade}
            />
          )}
          contentContainerStyle={styles.lijst}
          ListHeaderComponent={
            <View style={styles.lijstKop}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                {state.trades.length} coins geanalyseerd · gesorteerd op signaalsterkte
              </Text>
            </View>
          }
          ListFooterComponent={<Disclaimer />}
        />
      )}

      <GetradeFormulier
        zichtbaar={getradeteTrade !== null}
        trade={getradeteTrade}
        onSluiten={() => setGetradeteTrade(null)}
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

function LadenView({ progress }: { progress: Progress | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.midden}>
      <ActivityIndicator size="large" color={colors.cta} />
      <Text style={[Type.sectiekop, { color: colors.tekstPrimair, marginTop: spacing.lg }]}>
        Markt analyseren…
      </Text>
      {progress && (
        <Text style={[Type.caption, { color: colors.tekstGedimd, marginTop: spacing.sm }]}>
          {progress.current}/{progress.total} · {progress.symbool}
        </Text>
      )}
    </View>
  );
}

function FoutView({ melding, lastAttempt, onRetry }: { melding: string; lastAttempt: Date; onRetry: () => void }) {
  const { colors } = useTheme();
  const tijdstip = lastAttempt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={styles.midden}>
      <Text style={[Type.titel, styles.middenTitel, { color: colors.tekstPrimair }]}>Geen marktdata</Text>
      <Text style={[Type.body, styles.middenBody, { color: colors.tekstGedimd }]}>
        Binance en CoinGecko zijn nu niet bereikbaar. Controleer je verbinding en probeer opnieuw.
      </Text>
      <Pressable
        style={[styles.ctaKnop, { backgroundColor: colors.cta }]}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Opnieuw proberen"
      >
        <RefreshCw size={16} color="white" strokeWidth={2} />
        <Text style={[Type.body, styles.ctaTekst]}>Opnieuw proberen</Text>
      </Pressable>
      <Text style={[Type.caption, { color: colors.tekstGedimd, marginTop: spacing.base }]}>
        Laatste poging {tijdstip} · {melding}
      </Text>
    </View>
  );
}

// ---------- Stijlen ----------
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
});
