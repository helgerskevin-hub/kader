import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';

interface Props {
  waarde: number; // 0–100
  klasse: string; // Engelse classificatie van Alternative.me
}

const KLASSE_NL: Record<string, string> = {
  'Extreme Fear': 'Extreme angst',
  'Fear': 'Angst',
  'Neutral': 'Neutraal',
  'Greed': 'Hebzucht',
  'Extreme Greed': 'Extreme hebzucht',
};

export function AngstHebzucht({ waarde, klasse }: Props) {
  const { colors } = useTheme();
  const label = KLASSE_NL[klasse] ?? klasse;
  const kleur = waarde <= 45 ? colors.verlies : waarde >= 55 ? colors.winst : colors.letOp;

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.kaart }]}>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>FEAR & GREED</Text>
      <View style={styles.rij}>
        <Text style={[Type.prijs, { color: kleur }]}>{waarde}</Text>
        <Text style={[Type.overline, { color: kleur }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.sm,
  },
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
