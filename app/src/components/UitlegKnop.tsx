import React, { useCallback, useState } from 'react';
import { Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { Info } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';

// De uitklapbare uitleg die op meerdere kaarten zit: een klein i-icoon in de titelrij, en de tekst
// verschijnt onderaan diezelfde kaart. Hetzelfde patroon als MarktBalk al gebruikte, maar dan uit
// één bron, zodat het icoon overal even groot is en overal hetzelfde doet. Trigger en tekst zijn
// bewust twee losse componenten: ze staan op elke kaart op een andere plek in de opbouw.

export function useUitleg() {
  const reduceMotion = useReduceMotion();
  const [open, setOpen] = useState(false);
  const wissel = useCallback(() => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  }, [reduceMotion]);
  return { open, wissel };
}

export function UitlegKnop({ open, onWissel, onderwerp }: {
  open: boolean;
  onWissel: () => void;
  // Waar de uitleg over gaat, alleen voor de schermlezer: "Wat betekent bear-modus?"
  onderwerp: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onWissel}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={open ? 'Uitleg verbergen' : `Wat betekent ${onderwerp}?`}
      style={styles.knop}
      hitSlop={8}
    >
      <Info size={14} color={colors.cta} strokeWidth={1.75} />
    </Pressable>
  );
}

export function UitlegTekst({ open, tekst }: { open: boolean; tekst: string }) {
  const { colors } = useTheme();
  if (!open) return null;
  return (
    <Text style={[Type.caption, styles.tekst, { color: colors.tekstGedimd }]}>{tekst}</Text>
  );
}

const styles = StyleSheet.create({
  knop: {
    minHeight: 24,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tekst: {
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
