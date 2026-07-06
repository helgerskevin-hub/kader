import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radii } from '../theme/tokens';

interface Props {
  huidig: number;
  totaal: number;
  kleur?: string;
}

export function Laadbalk({ huidig, totaal, kleur }: Props) {
  const { colors } = useTheme();
  const positie = totaal > 0 ? Math.min(Math.max(huidig / totaal, 0), 1) : 0;

  return (
    <View
      style={[styles.track, { backgroundColor: colors.verhoogd }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: totaal, now: huidig }}
    >
      <View style={[styles.vulling, { backgroundColor: kleur ?? colors.cta, width: `${positie * 100}%` as any }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: radii.pill,
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  vulling: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
