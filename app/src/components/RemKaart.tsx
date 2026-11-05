import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Pause } from 'lucide-react-native';
import { REM_REEKS, remTotTekst } from '../state/verliesRem';
import { useVerliesRem } from '../state/useVerliesRem';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, shadow, spacing } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { schuifOvergang, uitklapIn, uitklapUit } from '../theme/lijstBeweging';

// De rustige kaart op Markt en Kansen zolang de rem na verliezen loopt. Geen rood en geen
// uitroeptekens: het is een pauze, geen alarm. Opheffen kost twee tikken, zodat het een keuze is.
export function RemKaart() {
  const { rem, hefOp } = useVerliesRem();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [bijnaOp, setBijnaOp] = useState(false);

  // Na een eerste tik vier seconden om te bevestigen, daarna terug naar de rustige stand.
  useEffect(() => {
    if (!bijnaOp) return;
    const t = setTimeout(() => setBijnaOp(false), 4000);
    return () => clearTimeout(t);
  }, [bijnaOp]);

  if (!rem) return null;

  return (
    <Animated.View
      entering={uitklapIn(reduceMotion)}
      exiting={uitklapUit()}
      layout={schuifOvergang(reduceMotion)}
      style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}
    >
      <View style={styles.kop}>
        <View style={[styles.tegel, { backgroundColor: colors.verhoogd }]}>
          <Pause size={17} color={colors.tekstGedimd} strokeWidth={1.75} />
        </View>
        <Text style={[Type.sectiekop, { color: colors.tekstPrimair, flex: 1 }]}>Even afstand</Text>
      </View>
      <Text style={[Type.caption, styles.zin, { color: colors.tekstGedimd }]}>
        {REM_REEKS} verliezen op rij. Tot {remTotTekst(rem.tot, Date.now())} vraagt Kader een extra bevestiging voor je koopt.
      </Text>
      <Pressable
        onPress={() => (bijnaOp ? (setBijnaOp(false), hefOp()) : setBijnaOp(true))}
        accessibilityRole="button"
        accessibilityLabel={bijnaOp ? 'Tik nog een keer om de rem op te heffen' : 'Rem opheffen'}
        hitSlop={8}
        style={styles.knop}
      >
        <Text style={[Type.caption, styles.knopTekst, { color: bijnaOp ? colors.letOp : colors.cta }]}>
          {bijnaOp ? 'Tik nog een keer om de rem op te heffen' : 'Rem opheffen'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  kaart: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.sm + 2,
  },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  tegel: { width: 30, height: 30, borderRadius: radii.veld, alignItems: 'center', justifyContent: 'center' },
  zin: { lineHeight: 19 },
  knop: { alignSelf: 'flex-start', paddingVertical: 4 },
  knopTekst: { fontWeight: '600', fontSize: 13 },
});
