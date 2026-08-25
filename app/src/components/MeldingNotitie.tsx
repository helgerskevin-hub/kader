import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Info, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';

// Korte uitleg bovenaan een scherm wanneer een aangetikte melding nergens meer op uitkomt.
//
// Bewust geen Alert. Die verschijnt hier vanuit een effect, vlak nadat de meldingen-sheet is
// gesloten, en een native dialoog bovenop een Modal die net aan het verdwijnen is legde op Android
// de UI-thread plat (gemeten: ANR, "Input dispatching timed out"). Inline heeft dat probleem niet
// en leest bovendien rustiger dan een systeempopup voor iets wat geen beslissing vraagt.
export function MeldingNotitie({ tekst, onSluiten }: { tekst: string; onSluiten: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrapper, { backgroundColor: colors.kaart, borderColor: colors.letOp }]}>
      <Info size={15} color={colors.letOp} strokeWidth={2} />
      <Text style={[Type.caption, styles.tekst, { color: colors.tekstGedimd }]}>{tekst}</Text>
      <Pressable
        onPress={onSluiten}
        accessibilityRole="button"
        accessibilityLabel="Melding sluiten"
        hitSlop={8}
        style={styles.sluit}
      >
        <X size={15} color={colors.tekstGedimd} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.base,
    borderRadius: radii.kaart,
    borderLeftWidth: 3,
  },
  tekst: { flex: 1, lineHeight: 18 },
  sluit: { minHeight: 24, minWidth: 24, alignItems: 'center', justifyContent: 'center' },
});
