import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { Info } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';

interface Props {
  score: number; // 0–100, gemiddeld over alle geanalyseerde coins
}

function sentimentLabel(score: number): string {
  if (score >= 70) return 'HEAVY BUY';
  if (score >= 55) return 'BUY';
  if (score >= 45) return 'BALANCED';
  if (score >= 30) return 'SELL';
  return 'HEAVY SELL';
}

const UITLEG = 'Deze balk toont het gemiddelde van de Kader-score over alle geanalyseerde coins. De score (0-100) weegt trend (EMA20/EMA50), RSI, MACD en volume. Richting BUY betekent dat de meeste coins nu gunstige technische signalen tonen; richting SELL betekent terughoudendheid. Het is een gemiddelde, dus losse coins kunnen afwijken.';

export function MarktBalk({ score }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const positie = Math.min(Math.max(score / 100, 0), 1);
  const label = sentimentLabel(score);

  // Knopkleur per sentiment
  const knopKleur = score >= 55 ? colors.winst
    : score >= 45 ? colors.letOp
    : colors.verlies;

  function wisselUitgeklapt() {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setUitgeklapt(v => !v);
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.kaart }]}>
      <View style={styles.bovenkant}>
        <View style={styles.titelRij}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>MARKTSENTIMENT</Text>
          <Pressable
            onPress={wisselUitgeklapt}
            accessibilityRole="button"
            accessibilityLabel={uitgeklapt ? 'Minder uitleg' : 'Wat betekent dit?'}
            style={styles.infoKnop}
          >
            <Info size={14} color={colors.cta} strokeWidth={1.75} />
          </Pressable>
        </View>
        <View style={styles.scoreRij}>
          <Text style={[Type.overline, { color: knopKleur }]}>{label}</Text>
          <Text style={[Type.prijs, styles.scoreGetal, { color: colors.tekstGedimd }]}>
            {Math.round(score)}
          </Text>
        </View>
      </View>
      {uitgeklapt && (
        <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>{UITLEG}</Text>
      )}

      {/* Balk */}
      <View style={styles.balk}>
        <View style={[styles.balkGradient, styles.balkRood]} />
        <View style={[styles.balkGradient, styles.balkAmber]} />
        <View style={[styles.balkGradient, styles.balkGroen]} />

        {/* Labels */}
        <View style={styles.labelsRij}>
          <Text style={[Type.label, { color: colors.verlies }]}>SELL</Text>
          <Text style={[Type.label, { color: colors.letOp }]}>BALANCED</Text>
          <Text style={[Type.label, { color: colors.winst }]}>BUY</Text>
        </View>

        {/* Indicator */}
        <View style={[styles.indicatorWrapper, { left: `${positie * 100}%` as any }]}>
          <View style={[styles.indicator, { backgroundColor: knopKleur }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.sm,
  },
  bovenkant: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoKnop: {
    minHeight: 32,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uitleg: {
    lineHeight: 18,
  },
  scoreRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreGetal: {
    fontSize: 13,
  },
  balk: {
    height: 20,
    borderRadius: radii.pill,
    overflow: 'visible',
    flexDirection: 'row',
    position: 'relative',
  },
  balkGradient: {
    flex: 1,
    height: 8,
    marginTop: 6,
  },
  balkRood: {
    backgroundColor: '#DC2626',
    borderTopLeftRadius: radii.pill,
    borderBottomLeftRadius: radii.pill,
  },
  balkAmber: {
    backgroundColor: '#D97706',
  },
  balkGroen: {
    backgroundColor: '#16A34A',
    borderTopRightRadius: radii.pill,
    borderBottomRightRadius: radii.pill,
  },
  labelsRij: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  indicatorWrapper: {
    position: 'absolute',
    top: 0,
    marginLeft: -8,
  },
  indicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
