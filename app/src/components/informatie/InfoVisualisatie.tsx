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
export function InfoVisualisatie({ id }: { id: string }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [speelSleutel, setSpeelSleutel] = useState(1);
  const Vis = VISUALISATIES[id];
  if (!Vis) return null;

  return (
    <View style={[styles.vlak, { backgroundColor: colors.verhoogd }]}>
      <View style={styles.kop}>
        <Text style={[Type.overline, styles.label, { color: colors.tekstGedimd }]}>VOORBEELD</Text>
        {!reduceMotion ? (
          <Pressable
            onPress={() => setSpeelSleutel(s => s + 1)}
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
