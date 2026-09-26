import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { Drukbaar } from './Drukbaar';

interface Props {
  titel: string;
  beschrijving: string;
  melding: string;
  lastAttempt: Date;
  onRetry: () => void;
}

export function OfflineMelding({ titel, beschrijving, melding, lastAttempt, onRetry }: Props) {
  const { colors } = useTheme();
  const tijdstip = lastAttempt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.midden}>
      <Text style={[Type.titel, styles.middenTitel, { color: colors.tekstPrimair }]}>{titel}</Text>
      <Text style={[Type.body, styles.middenBody, { color: colors.tekstGedimd }]}>{beschrijving}</Text>
      <Drukbaar
        style={[styles.ctaKnop, { backgroundColor: colors.cta }]}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Opnieuw proberen"
      >
        <RefreshCw size={16} color="white" strokeWidth={2} />
        <Text style={[Type.body, styles.ctaTekst]}>Opnieuw proberen</Text>
      </Drukbaar>
      <Text style={[Type.caption, { color: colors.tekstGedimd, marginTop: spacing.base }]}>
        Laatste poging {tijdstip} · {melding}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
