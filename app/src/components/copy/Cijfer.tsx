// Eén klein cijfer met een label erboven, voor de rijen op de kaarten van Copy. Getallen in Plex
// Mono, zodat ze onder elkaar en naast elkaar vergelijkbaar blijven.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts, Type } from '../../theme/typography';
import { spacing } from '../../theme/tokens';

export function Cijfer({ label, waarde, kleur }: { label: string; waarde: string; kleur?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.cijfer} accessible accessibilityLabel={`${label.toLowerCase()}: ${waarde}`}>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]} numberOfLines={1}>{label}</Text>
      <Text
        style={[Type.prijs, styles.waarde, { color: kleur ?? colors.tekstPrimair }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {waarde}
      </Text>
    </View>
  );
}

export function CijferRij({ children }: { children: React.ReactNode }) {
  return <View style={styles.rij}>{children}</View>;
}

const styles = StyleSheet.create({
  rij: { flexDirection: 'row', gap: spacing.md },
  cijfer: { flex: 1, gap: 2 },
  waarde: { fontFamily: Fonts.monoMedium, fontSize: 14 },
});
