import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { curve } from '../../../theme/beweging';
import { radii, spacing } from '../../../theme/tokens';
import type { VisProps } from './types';

// Echte plafonds uit state/blootstelling.ts (PLAFOND_PER_KLIMAAT): gunstig geen, gemengd 50%,
// ongunstig 20% van je kapitaal.
const HUIDIG = 0.34;
const BASIS = 100;
const STAND = [
  { naam: 'Gunstig', tekst: 'geen plafond' },
  { naam: 'Gemengd', tekst: 'plafond 50%' },
  { naam: 'Ongunstig', tekst: 'plafond 20%' },
];
const PLAFOND = [1, 0.5, 0.2];

// Fase loopt 0 (gunstig), 1 (gemengd), 2 (ongunstig, eindstand). De plafondstreep schuift met
// translateX, de overschrijding is een band met base-width 100 die met scaleX meegroeit.
export function VisBlootstelling({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const [breedte, setBreedte] = useState(0);
  const fase = useSharedValue(2);

  useEffect(() => {
    if (reduceMotion) {
      fase.value = 2;
      return;
    }
    const stap = (naar: number) => withTiming(naar, { duration: 700, easing: curve.verplaats });
    fase.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(700, stap(1)),
      withDelay(800, stap(2)),
    );
  }, [speelSleutel, reduceMotion]);

  const streep = useAnimatedStyle(() => ({
    opacity: interpolate(fase.value, [0, 0.3, 1], [0, 0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(fase.value, [0, 1, 2], PLAFOND) * breedte - 1 }],
  }), [breedte]);

  const band = useAnimatedStyle(() => {
    const plafond = interpolate(fase.value, [0, 1, 2], PLAFOND);
    const s = Math.max(0.0001, (breedte * Math.max(0, HUIDIG - plafond)) / BASIS);
    return { transform: [{ translateX: plafond * breedte - BASIS / 2 + (BASIS / 2) * s }, { scaleX: s }] };
  }, [breedte]);

  const notitie = useAnimatedStyle(() => ({
    opacity: interpolate(fase.value, [1.6, 2], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.kaart, { backgroundColor: colors.kaart, borderColor: colors.rand }]}>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>BLOOTSTELLING: 34% VAN JE KAPITAAL</Text>
      <View
        style={[styles.spoor, { backgroundColor: colors.verhoogd }]}
        onLayout={(e: LayoutChangeEvent) => setBreedte(e.nativeEvent.layout.width)}
      >
        <View style={[styles.vulling, { width: `${HUIDIG * 100}%`, backgroundColor: colors.cta }]} />
        <Animated.View style={[styles.band, { backgroundColor: colors.letOp }, band]} />
        <Animated.View style={[styles.streep, { backgroundColor: colors.tekstPrimair }, streep]} />
      </View>
      <View style={styles.chips}>
        {STAND.map((s, i) => (
          <Chip key={s.naam} i={i} fase={fase} naam={s.naam} tekst={s.tekst} />
        ))}
      </View>
      <Animated.Text style={[Type.caption, { color: colors.letOp }, notitie]}>
        Boven je plafond: afbouwen overwegen
      </Animated.Text>
    </View>
  );
}

function Chip(p: { i: number; fase: { value: number }; naam: string; tekst: string }) {
  const { colors } = useTheme();
  const stijl = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(p.fase.value - p.i), [0, 0.6, 1], [1, 0.4, 0.4], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[styles.chip, { borderColor: colors.rand }, stijl]}>
      <Text style={[Type.caption, { color: colors.tekstPrimair }]}>{p.naam}: {p.tekst}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  kaart: { borderWidth: 1, borderRadius: radii.kaart, padding: spacing.base, gap: spacing.md },
  spoor: { height: 14, borderRadius: radii.pill, overflow: 'hidden' },
  vulling: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  band: { position: 'absolute', left: 0, top: 0, bottom: 0, width: BASIS },
  streep: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 2 },
});
