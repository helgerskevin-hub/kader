import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';

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

export function MarktBalk({ score }: Props) {
  const { colors } = useTheme();
  const positie = Math.min(Math.max(score / 100, 0), 1);
  const label = sentimentLabel(score);

  // Knopkleur per sentiment
  const knopKleur = score >= 55 ? colors.winst
    : score >= 45 ? colors.letOp
    : colors.verlies;

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.kaart }]}>
      <View style={styles.bovenkant}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>MARKSENTIMENT</Text>
        <View style={styles.scoreRij}>
          <Text style={[Type.overline, { color: knopKleur }]}>{label}</Text>
          <Text style={[Type.prijs, styles.scoreGetal, { color: colors.tekstGedimd }]}>
            {Math.round(score)}
          </Text>
        </View>
      </View>

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
