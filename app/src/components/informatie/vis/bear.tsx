import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, PixelRatio } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { radii } from '../../../theme/tokens';
import { curve, duur, staggerVertraging } from '../../../theme/beweging';
import { AnimatedGetal } from '../../AnimatedGetal';
import type { VisProps } from './types';

// Alle drie bestaan in de app: het koopsignaalslot (poortOpen), de lijst Wie houdt stand? en het
// afbouwadvies bij posities.
const RIJEN: { tekst: string; aan: boolean }[] = [
  { tekst: 'Koopsignalen', aan: false },
  { tekst: 'Wie houdt stand?', aan: true },
  { tekst: 'Afbouwadvies', aan: true },
];
const EIND = 23;

function Rij({ index, tekst, aan, speelSleutel, reduceMotion }: VisProps & { index: number; tekst: string; aan: boolean }) {
  const { colors } = useTheme();
  const zicht = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      zicht.value = 1;
      return;
    }
    zicht.value = 0;
    zicht.value = withDelay(
      700 + staggerVertraging(index) * 3,
      withTiming(1, { duration: duur.lang, easing: curve.binnen, reduceMotion: ReduceMotion.Never }),
    );
  }, [speelSleutel, reduceMotion, index, zicht]);
  const stijl = useAnimatedStyle(() => ({ opacity: zicht.value }));
  const pilKleur = aan ? colors.winst : colors.verlies;
  return (
    <Animated.View style={[styles.rij, stijl]}>
      <Text style={[Type.body, styles.rijTekst, { color: colors.tekstPrimair }]}>{tekst}</Text>
      <View style={[styles.pil, { backgroundColor: pilKleur + '1A' }]}>
        <Text style={[Type.label, { color: pilKleur }]}>{aan ? 'AAN' : 'UIT'}</Text>
      </View>
    </Animated.View>
  );
}

export function VisBear({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const [dagen, setDagen] = useState(reduceMotion ? EIND : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDagen(EIND);
      return;
    }
    setDagen(0);
    const t = setTimeout(() => setDagen(EIND), 250);
    return () => clearTimeout(t);
  }, [speelSleutel, reduceMotion]);

  return (
    <View style={[styles.kaart, { backgroundColor: colors.verhoogd }]}>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>BEAR-MODUS</Text>
      <View style={styles.dagen}>
        <View style={{ minWidth: Math.ceil(2 * 28 * 0.7 * PixelRatio.getFontScale()) }}>
          <AnimatedGetal waarde={dagen} format={n => String(Math.round(n))} style={[Type.display, { color: colors.tekstPrimair }]} />
        </View>
        <Text style={[Type.body, { color: colors.tekstGedimd }]}>dagen ongunstig</Text>
      </View>
      <View style={styles.rijen}>
        {RIJEN.map((r, i) => (
          <Rij key={r.tekst} index={i} tekst={r.tekst} aan={r.aan} speelSleutel={speelSleutel} reduceMotion={reduceMotion} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: { borderRadius: radii.kaart, padding: 16, gap: 8 },
  dagen: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
  rijen: { gap: 6 },
  rij: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rijTekst: { flex: 1 },
  pil: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3 },
});
