import React, { useEffect, useState } from 'react';
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
import { AnimatedGetal } from '../../AnimatedGetal';
import { HoudVastVulling } from '../../HoudVastVulling';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { radii, spacing } from '../../../theme/tokens';
import type { VisProps } from './types';

// Gewichten uit engine/auditor.ts: 0,35 consistentie, 0,40 drawdown/return, 0,25 spreiding.
// 0,35 x 72 + 0,40 x 65 + 0,25 x 70 = 68,7, afgerond 69: GEEL (50 tot 69; vanaf 70 is het GROEN).
const BALKEN = [
  { naam: 'Consistentie', gewicht: 35, score: 72 },
  { naam: 'Drawdown/return', gewicht: 40, score: 65 },
  { naam: 'Spreiding', gewicht: 25, score: 70 },
];
const TOTAAL = 1800;
const SCORE = 69;

export function VisTrader({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const [getal, setGetal] = useState(SCORE);
  const t = useSharedValue(TOTAAL);

  useEffect(() => {
    if (reduceMotion) {
      setGetal(SCORE);
      t.value = TOTAAL;
      return;
    }
    setGetal(0);
    t.value = 0;
    t.value = withTiming(TOTAAL, { duration: TOTAAL, easing: Easing.linear });
    const timer = setTimeout(() => setGetal(SCORE), 900);
    return () => clearTimeout(timer);
  }, [speelSleutel, reduceMotion]);

  const chip = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [1400, TOTAAL], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(t.value, [1400, TOTAAL], [0.9, 1], Extrapolation.CLAMP) }],
  }));
  const minBreedte = 2 * 0.7 * 28 * PixelRatio.getFontScale();

  return (
    <View style={[styles.kaart, { backgroundColor: colors.kaart, borderColor: colors.rand }]}>
      {BALKEN.map((b, i) => (
        <Balk key={b.naam} {...b} start={i * 250} t={t} />
      ))}
      <View style={styles.totaal}>
        <View style={{ minWidth: minBreedte }}>
          <AnimatedGetal waarde={getal} format={n => String(Math.round(n))} style={[Type.prijsGroot, { fontSize: 28, color: colors.tekstPrimair }]} />
        </View>
        <Animated.View style={[styles.chip, { backgroundColor: colors.letOp + '22' }, chip]}>
          <Text style={[Type.label, { color: colors.letOp }]}>GEEL</Text>
        </Animated.View>
      </View>
    </View>
  );
}

function Balk(p: { naam: string; gewicht: number; score: number; start: number; t: { value: number } }) {
  const { colors } = useTheme();
  const voortgang = useDerivedValue(() =>
    interpolate(p.t.value, [p.start, p.start + 700], [0, 1], Extrapolation.CLAMP),
  );
  return (
    <View style={styles.balk}>
      <View style={styles.kop}>
        <Text style={[Type.caption, styles.naam, { color: colors.tekstPrimair }]}>
          {p.naam} ({p.gewicht}%)
        </Text>
        <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{p.score}</Text>
      </View>
      <View style={[styles.spoor, { backgroundColor: colors.verhoogd }]}>
        <View style={{ width: `${p.score}%`, height: 8, overflow: 'hidden', borderRadius: radii.pill }}>
          <HoudVastVulling voortgang={voortgang} kleur={colors.cta} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: { borderWidth: 1, borderRadius: radii.kaart, padding: spacing.base, gap: spacing.md },
  balk: { gap: spacing.xs },
  kop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  naam: { flexShrink: 1 },
  spoor: { height: 8, borderRadius: radii.pill, overflow: 'hidden' },
  totaal: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  chip: { borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 2 },
});
