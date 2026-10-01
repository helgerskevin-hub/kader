import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { HoudVastVulling } from '../../HoudVastVulling';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { radii, spacing } from '../../../theme/tokens';
import type { VisProps } from './types';

const STAPPEN = ['Bedrag', 'Vasthouden', 'eToro', 'Uitgevoerd'];
const START = [0, 500, 1500, 2000]; // ms waarop stap i oplicht
const TOTAAL = 2700;

// Vier stappen lichten na elkaar op (opacity). Bij Vasthouden loopt de vulling 800 ms van 0 naar 1,
// zonder haptiek: alleen HoudVastVulling met een eigen shared value.
export function VisHandelen({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const t = useSharedValue(TOTAAL);
  const vulling = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      t.value = TOTAAL;
      vulling.value = 1;
      return;
    }
    t.value = 0;
    vulling.value = 0;
    t.value = withTiming(TOTAAL, { duration: TOTAAL, easing: Easing.linear });
    vulling.value = withDelay(START[1], withTiming(1, { duration: 800, easing: Easing.linear }));
  }, [speelSleutel, reduceMotion]);

  const notities = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [2300, TOTAAL], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.kaart, { backgroundColor: colors.kaart, borderColor: colors.rand }]}>
      {STAPPEN.map((naam, i) => (
        <Stap key={naam} i={i} naam={naam} t={t} vulling={i === 1 ? vulling : null} />
      ))}
      <Animated.View style={[styles.notities, notities]}>
        <Text style={[Type.caption, { color: colors.tekstPrimair }]}>
          Uitgevoerd: je ziet de positie na de volgende sync.
        </Text>
        <Text style={[Type.caption, { color: colors.tekstPrimair }]}>
          Onbekend: Kader kijkt bij eToro na, er gaat nooit een tweede order uit.
        </Text>
      </Animated.View>
    </View>
  );
}

function Stap(p: { i: number; naam: string; t: { value: number }; vulling: { value: number } | null }) {
  const { colors } = useTheme();
  const stijl = useAnimatedStyle(() => ({
    opacity: interpolate(p.t.value, [START[p.i], START[p.i] + 250], [0.35, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[styles.stap, stijl]}>
      <View style={[styles.nummer, { backgroundColor: colors.primair }]}>
        <Text style={[Type.label, { color: '#FFFFFF' }]}>{p.i + 1}</Text>
      </View>
      <View style={[styles.doos, { borderColor: colors.rand, backgroundColor: colors.verhoogd }]}>
        {p.vulling && <HoudVastVulling voortgang={p.vulling as never} kleur={colors.cta + '55'} />}
        <Text style={[Type.caption, { color: colors.tekstPrimair }]}>{p.naam}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  kaart: { borderWidth: 1, borderRadius: radii.kaart, padding: spacing.base, gap: spacing.sm },
  stap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nummer: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  doos: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.knop,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  notities: { gap: spacing.xs, marginTop: spacing.sm },
});
