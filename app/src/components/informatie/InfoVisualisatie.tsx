import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { Type } from '../../theme/typography';
import { radii, spacing } from '../../theme/tokens';
import { VISUALISATIES } from './vis';

// Omhulsel om een visualisatie: kaartvlak met 16 dp zijmarge (klimaat en fg rekenen daarop), een
// label "Voorbeeld" en een knop om het af te spelen. De speelSleutel start op 1 zodat hij bij het
// openen meteen afspeelt.
//
// `speelSignaal` is voor een omhulsel dat zelf bepaalt wanneer de visualisatie in beeld komt, zoals
// de kaarten van "Nieuw in deze versie". Bij 0 staat de eindstand er stil (nog niet in beeld); elke
// verhoging speelt hem opnieuw af, net als de knop.
export function InfoVisualisatie({ id, speelSignaal }: { id: string; speelSignaal?: number }) {
  const { colors } = useTheme();
  const systeemMinder = useReduceMotion();
  const [opnieuw, setOpnieuw] = useState(0);
  const Vis = VISUALISATIES[id];
  if (!Vis) return null;
  const extern = speelSignaal !== undefined;
  const speelSleutel = (extern ? speelSignaal : 1) + opnieuw;
  const stil = extern && speelSignaal === 0;
  const reduceMotion = systeemMinder || stil;

  return (
    <View style={[styles.vlak, { backgroundColor: colors.verhoogd }]}>
      <View style={styles.kop}>
        <Text style={[Type.overline, styles.label, { color: colors.tekstGedimd }]}>VOORBEELD</Text>
        {!systeemMinder ? (
          <Pressable
            onPress={() => setOpnieuw(s => s + 1)}
            style={styles.knop}
            accessibilityRole="button"
            accessibilityLabel="Opnieuw afspelen"
          >
            <RotateCcw size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        ) : null}
      </View>
      <Vis speelSleutel={speelSleutel} reduceMotion={reduceMotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  vlak: {
    borderRadius: radii.kaart,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    paddingTop: spacing.xs,
  },
  kop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  label: { flexShrink: 1 },
  knop: {
    width: 44,
    height: 44,
    marginRight: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
