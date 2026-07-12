import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Link2 } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';

interface Props {
  zichtbaar: boolean;
  onLater: () => void;
  onNuInstellen: () => void;
}

export function EtoroPromptSheet({ zichtbaar, onLater, onNuInstellen }: Props) {
  const { colors } = useTheme();

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onLater} velStijl={styles.vel}>
      <View style={[styles.icoon, { backgroundColor: colors.verhoogd }]}>
        <Link2 size={24} color={colors.cta} strokeWidth={1.75} />
      </View>
      <Text style={[Type.titel, styles.titel, { color: colors.tekstPrimair }]}>eToro koppelen?</Text>
      <Text style={[Type.body, styles.body, { color: colors.tekstGedimd }]}>
        Koppel je eToro-account met een alleen-lezen sleutel om je open crypto-posities automatisch te importeren. Je kunt dit later altijd via Instellingen doen.
      </Text>

      <Pressable
        style={[styles.primair, { backgroundColor: colors.cta }]}
        onPress={onNuInstellen}
        accessibilityRole="button"
        accessibilityLabel="Nu instellen"
      >
        <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Nu instellen</Text>
      </Pressable>
      <Pressable
        style={styles.secundair}
        onPress={onLater}
        accessibilityRole="button"
        accessibilityLabel="Later"
      >
        <Text style={[Type.body, { color: colors.tekstGedimd }]}>Later</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  vel: {
    alignItems: 'center',
  },
  icoon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.base,
  },
  titel: { textAlign: 'center', marginBottom: spacing.sm },
  body: { textAlign: 'center', lineHeight: 24, marginBottom: spacing.lg },
  primair: {
    alignSelf: 'stretch',
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    alignItems: 'center',
    minHeight: 48,
  },
  secundair: {
    alignSelf: 'stretch',
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    marginTop: spacing.xs,
  },
});
