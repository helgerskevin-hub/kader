import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { Info, CheckCircle, ChevronDown, ChevronUp, Star } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { infoVoor } from '../engine/coinInfo';
import { fmtPrijs, fmtRR } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { ScoreBadge } from './ScoreBadge';
import { AdviceBadge } from './AdviceBadge';
import { LevelRow } from './LevelRow';

interface Props {
  trade: Trade;
  onGetrade?: (trade: Trade) => void;
  favoriet?: boolean;
  onToggleFavoriet?: (symbool: string) => void;
}

type AdviesLabel = 'HIGH CONVICTION' | 'STERK KOOP' | 'KOOPZONE' | 'AFWACHTEN';

function adviesLabel(trade: Trade): AdviesLabel {
  if (trade.highConviction) return 'HIGH CONVICTION';
  if (trade.score >= 72) return 'STERK KOOP';
  if (trade.signaal === 'KOOP') return 'KOOPZONE';
  return 'AFWACHTEN';
}

function adviesRandKleur(label: AdviesLabel, colors: ReturnType<typeof useTheme>['colors']): string {
  if (label === 'HIGH CONVICTION') return colors.primair;
  if (label === 'STERK KOOP' || label === 'KOOPZONE') return colors.winst;
  return colors.letOp;
}

export function TradeCard({ trade, onGetrade, favoriet, onToggleFavoriet }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const info = infoVoor(trade.symbool);
  const advies = adviesLabel(trade);
  const randKleur = adviesRandKleur(advies, colors);

  function wisselUitgeklapt() {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setUitgeklapt(v => !v);
  }

  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart, borderLeftColor: randKleur }]}>
      {/* Koptekst */}
      <View style={styles.kop}>
        <View style={styles.kopLinks}>
          <View style={styles.symboolRij}>
            <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{trade.symbool}</Text>
            {onToggleFavoriet && (
              <Pressable
                onPress={() => onToggleFavoriet(trade.symbool)}
                accessibilityRole="button"
                accessibilityLabel={favoriet ? 'Favoriet verwijderen' : 'Favoriet maken'}
                hitSlop={8}
              >
                <Star
                  size={16}
                  color={favoriet ? '#F59E0B' : colors.tekstGedimd}
                  fill={favoriet ? '#F59E0B' : 'transparent'}
                  strokeWidth={1.75}
                />
              </Pressable>
            )}
          </View>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{info.naam}</Text>
        </View>
        <View style={styles.kopRechts}>
          <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>{fmtPrijs(trade.prijs)}</Text>
          <ScoreBadge score={trade.score} />
        </View>
      </View>

      {/* Sub-label */}
      <Text style={[Type.overline, styles.paar, { color: colors.tekstGedimd }]}>
        {trade.symbool} / USDT
      </Text>

      {/* Niveaus */}
      <View style={styles.sectie}>
        <LevelRow stop={trade.stopLoss} entry={trade.entry} doel={trade.takeProfit} />
      </View>

      {/* R/R + RSI */}
      <View style={styles.metaRij}>
        <View style={styles.metaItem}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>R/R</Text>
          <Text style={[Type.prijs, styles.metaWaarde, { color: colors.tekstPrimair }]}>{fmtRR(trade.rr)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>RSI</Text>
          <Text style={[Type.prijs, styles.metaWaarde, { color: colors.tekstPrimair }]}>{Math.round(trade.rsi)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>SCORE</Text>
          <Text style={[Type.prijs, styles.metaWaarde, { color: colors.tekstPrimair }]}>{Math.round(trade.score)}</Text>
        </View>
      </View>

      {/* Advies-badge */}
      <View style={styles.sectie}>
        <AdviceBadge advies={advies} />
      </View>

      {/* Uitklapbare redenen */}
      {uitgeklapt && (
        <View style={[styles.redenen, { backgroundColor: colors.verhoogd }]}>
          {trade.redenen.map((r, i) => (
            <Text key={i} style={[Type.caption, styles.reden, { color: colors.tekstGedimd }]}>• {r}</Text>
          ))}
        </View>
      )}

      {/* Acties */}
      <View style={[styles.actiesRij, { borderTopColor: colors.rand }]}>
        <Pressable
          style={[styles.actieKnop, { minHeight: 44 }]}
          onPress={wisselUitgeklapt}
          accessibilityLabel={uitgeklapt ? 'Minder info' : 'Over deze coin'}
          accessibilityRole="button"
        >
          <Info size={15} color={colors.cta} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.actieLabel, { color: colors.cta }]}>
            {uitgeklapt ? 'Minder' : 'Over deze coin'}
          </Text>
          {uitgeklapt
            ? <ChevronUp size={12} color={colors.cta} strokeWidth={1.75} />
            : <ChevronDown size={12} color={colors.cta} strokeWidth={1.75} />}
        </Pressable>

        <View style={[styles.scheiding, { backgroundColor: colors.rand }]} />

        <Pressable
          style={[styles.actieKnop, { minHeight: 44 }]}
          onPress={() => onGetrade?.(trade)}
          accessibilityLabel="Getrade"
          accessibilityRole="button"
        >
          <CheckCircle size={15} color={colors.winst} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.actieLabel, { color: colors.winst }]}>Getrade</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: spacing.xs,
  },
  kopLinks: { gap: 2 },
  symboolRij: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kopRechts: { alignItems: 'flex-end', gap: 6 },
  paar: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  sectie: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  metaRij: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  metaItem: { gap: 2 },
  metaWaarde: { fontSize: 14 },
  redenen: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderRadius: radii.veld,
    padding: spacing.md,
    gap: 4,
  },
  reden: { lineHeight: 18 },
  actiesRij: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actieKnop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  scheiding: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.sm,
  },
  actieLabel: { fontSize: 12 },
});
