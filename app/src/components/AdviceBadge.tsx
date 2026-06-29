import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radii } from '../theme/tokens';

type Advies = 'KOOPZONE' | 'AFWACHTEN' | 'HIGH CONVICTION' | 'STERK KOOP';

interface Props {
  advies: Advies;
}

export function AdviceBadge({ advies }: Props) {
  const { colors } = useTheme();

  const config: Record<Advies, { bg: string; tekst: string; border: string }> = {
    'HIGH CONVICTION': { bg: '#EFF6FF', tekst: colors.primair, border: colors.primair },
    'STERK KOOP': { bg: '#F0FDF4', tekst: colors.winst, border: colors.winst },
    KOOPZONE: { bg: '#F0FDF4', tekst: colors.winst, border: colors.winst },
    AFWACHTEN: { bg: '#FEF3C7', tekst: colors.letOp, border: colors.letOp },
  };

  const { bg, tekst, border } = config[advies] ?? config.AFWACHTEN;

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.label, { color: tekst }]}>{advies}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
