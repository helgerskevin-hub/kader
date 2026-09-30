import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, PixelRatio, type LayoutChangeEvent } from 'react-native';
import Animated, {
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { curve, duur, veer } from '../../../theme/beweging';
import { AnimatedGetal } from '../../AnimatedGetal';
import { AangepastPil } from '../../LevelRow';
import type { VisProps } from './types';

// Baan van -14% tot +10% rond de entry. Positie als fractie van de gemeten breedte.
const MIN = -14;
const MAX = 10;
function frac(pct: number): number {
  'worklet';
  return (pct - MIN) / (MAX - MIN);
}

export function VisEtorostop({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const bw = useSharedValue(0);
  const p = useSharedValue(1);
  const pil = useSharedValue(1);
  const [rr, setRr] = useState(reduceMotion ? 0.8 : 2.6);

  useEffect(() => {
    if (reduceMotion) {
      p.value = 1;
      pil.value = 1;
      setRr(0.8);
      return;
    }
    p.value = 0;
    pil.value = 0;
    setRr(2.6);
    p.value = withDelay(500, withSpring(1, veer.zacht));
    pil.value = withDelay(1000, withTiming(1, { duration: duur.lang, easing: curve.binnen, reduceMotion: ReduceMotion.Never }));
    const t = setTimeout(() => setRr(0.8), 1000);
    return () => clearTimeout(t);
  }, [speelSleutel, reduceMotion, p, pil]);

  // De stopstreep staat op left 0 en schuift met translateX van -3% naar -10%.
  const stopStijl = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(p.value, [0, 1], [frac(-3), frac(-10)]) * bw.value - 1.5 }],
  }));
  const pilStijl = useAnimatedStyle(() => ({ opacity: pil.value }));
  // Ruimte voor "R/R 1 : 2.6" (9 tekens), want AnimatedGetal krimpt niet mee.
  const breedteRr = Math.ceil(9 * 15 * 0.7 * PixelRatio.getFontScale());

  return (
    <View style={styles.wrap}>
      <View style={styles.baanVak} onLayout={(e: LayoutChangeEvent) => { bw.value = e.nativeEvent.layout.width; }}>
        <View style={[styles.baan, { backgroundColor: colors.verhoogd }]} />
        <View style={[styles.streep, { left: `${frac(-10) * 100}%`, backgroundColor: colors.letOp, opacity: 0.5 }]} />
        <View style={[styles.streep, styles.entry, { left: `${frac(0) * 100}%`, backgroundColor: colors.tekstPrimair }]} />
        <View style={[styles.streep, { left: `${frac(7.8) * 100}%`, backgroundColor: colors.winst }]} />
        <Animated.View style={[styles.streep, styles.stop, { backgroundColor: colors.verlies }, stopStijl]} />
      </View>
      <View style={styles.legenda}>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>eToro: minimaal 10%</Text>
        <Text style={[Type.caption, { color: colors.verlies }]}>stop -10% (Kader: -3%)</Text>
        <Text style={[Type.caption, { color: colors.winst }]}>doel +7,8%</Text>
      </View>
      <View style={styles.onder}>
        <Animated.View style={pilStijl}><AangepastPil /></Animated.View>
        <View style={{ minWidth: breedteRr }}>
          <AnimatedGetal waarde={rr} format={n => `R/R 1 : ${n.toFixed(1)}`} style={[Type.prijs, { color: colors.tekstPrimair }]} />
        </View>
      </View>
      <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
        Het doel blijft +7,8%, het risico wordt 10%. Daarmee zakt de R/R onder 1 : 2.0.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  baanVak: { height: 28, justifyContent: 'center' },
  baan: { height: 6, borderRadius: 3 },
  streep: { position: 'absolute', top: 3, width: 3, height: 22, borderRadius: 1.5, marginLeft: -1.5 },
  entry: { width: 2, marginLeft: -1, opacity: 0.6 },
  stop: { left: 0, marginLeft: 0 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4, columnGap: 12 },
  onder: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
});
