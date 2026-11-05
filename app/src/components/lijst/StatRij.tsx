import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts, Type } from '../../theme/typography';
import { spacing } from '../../theme/tokens';

interface Props {
  label: string;
  // Gedimde regel onder het label, bijvoorbeeld "12 signalen".
  sub?: string;
  // Null toont een streepje: geen data is iets anders dan nul.
  waarde: number | null;
  format: (n: number) => string;
  // Kleur de waarde groen of rood op het teken. Uit voor scores en aantallen.
  kleurOpTeken?: boolean;
}

// Een rij voor in een LijstGroep met een getal rechts, in mono en eventueel gekleurd. LijstRij
// toont zijn waarde als gedimde body-tekst, wat voor een instelling klopt maar niet voor een cijfer
// dat je naast andere cijfers moet kunnen vergelijken.
export function StatRij({ label, sub, waarde, format, kleurOpTeken = true }: Props) {
  const { colors } = useTheme();
  const tekst = waarde === null ? '—' : format(waarde);
  // Op de geformatteerde tekst, niet op de waarde: wat als +0.00 R wordt getoond is niet rood.
  const kleur = waarde === null
    ? colors.tekstGedimd
    : kleurOpTeken
      ? (tekst.startsWith('−') ? colors.verlies : colors.winst)
      : colors.tekstPrimair;
  return (
    <View
      style={styles.rij}
      accessible
      accessibilityLabel={`${label}${sub ? `, ${sub}` : ''}: ${waarde === null ? 'geen data' : tekst}`}
    >
      <View style={styles.links}>
        <Text style={[Type.body, { color: colors.tekstPrimair }]} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{sub}</Text> : null}
      </View>
      <Text style={[styles.waarde, { color: kleur }]}>{tekst}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  links: { flex: 1, minWidth: 0, gap: 2 },
  waarde: { fontFamily: Fonts.monoMedium, fontSize: 15, fontVariant: ['tabular-nums'] },
});
