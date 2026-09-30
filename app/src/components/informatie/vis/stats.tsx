import React, { useEffect, useMemo, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { AnimatedGetal } from '../../AnimatedGetal';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { radii, spacing } from '../../../theme/tokens';
import type { VisProps } from './types';

// ScoreRing past niet (die is een coinlogo met score en vraagt een symbool), dus een lokale ring
// met dezelfde Skia-opzet: start/end op het pad, niet groen of rood.
const MAAT = 104;
const DIKTE = 9;
const WINST = 0.58;
const TOTAAL = 1400;
const RIJEN = [
  { label: 'Trades', waarde: '24' },
  { label: 'Gemiddelde R', waarde: '0,8' },
  { label: 'Beste', waarde: '+18,2%' },
];
const pct = (n: number) => `${Math.round(n)}%`;

export function VisStats({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const [getal, setGetal] = useState(58);
  const t = useSharedValue(TOTAAL);

  useEffect(() => {
    if (reduceMotion) {
      setGetal(58);
      t.value = TOTAAL;
      return;
    }
    setGetal(0);
    t.value = 0;
    t.value = withTiming(TOTAAL, { duration: TOTAAL, easing: Easing.linear });
    const timer = setTimeout(() => setGetal(58), 200);
    return () => clearTimeout(timer);
  }, [speelSleutel, reduceMotion]);

  const pad = useMemo(() => {
    const straal = (MAAT - DIKTE) / 2;
    const b = Skia.PathBuilder.Make();
    b.addArc(Skia.XYWHRect(DIKTE / 2, DIKTE / 2, straal * 2, straal * 2), -90, 359.999);
    return b.detach();
  }, []);
  const eind = useDerivedValue(() => interpolate(t.value, [0, 900], [0, WINST], Extrapolation.CLAMP));
  const minBreedte = 3 * 0.7 * 20 * PixelRatio.getFontScale();

  return (
    <View style={[styles.kaart, { backgroundColor: colors.kaart, borderColor: colors.rand }]}>
      <View style={styles.ring}>
        <Canvas style={{ width: MAAT, height: MAAT }} pointerEvents="none">
          <Path path={pad} style="stroke" strokeWidth={DIKTE} color={colors.verhoogd} />
          <Path path={pad} style="stroke" strokeWidth={DIKTE} strokeCap="round" color={colors.primair} start={0} end={eind} />
        </Canvas>
        <View style={styles.midden} pointerEvents="none">
          <View style={{ minWidth: minBreedte, alignItems: 'center' }}>
            <AnimatedGetal waarde={getal} format={pct} style={[Type.prijsGroot, { fontSize: 20, color: colors.tekstPrimair }]} />
          </View>
        </View>
      </View>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>Winstpercentage</Text>
      <View style={styles.rijen}>
        {RIJEN.map((r, i) => (
          <Rij key={r.label} {...r} start={600 + i * 200} t={t} />
        ))}
      </View>
    </View>
  );
}

function Rij(p: { label: string; waarde: string; start: number; t: { value: number } }) {
  const { colors } = useTheme();
  const stijl = useAnimatedStyle(() => ({
    opacity: interpolate(p.t.value, [p.start, p.start + 300], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[styles.rij, { borderColor: colors.rand }, stijl]}>
      <Text style={[Type.caption, styles.rijLabel, { color: colors.tekstGedimd }]}>{p.label}</Text>
      <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{p.waarde}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  kaart: { borderWidth: 1, borderRadius: radii.kaart, padding: spacing.base, gap: spacing.sm, alignItems: 'center' },
  ring: { width: MAAT, height: MAAT, alignItems: 'center', justifyContent: 'center' },
  midden: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  rijen: { alignSelf: 'stretch' },
  rij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rijLabel: { flexShrink: 1 },
});
