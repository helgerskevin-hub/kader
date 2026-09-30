import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Check, Lock } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { radii, spacing } from '../../../theme/tokens';
import type { VisProps } from './types';

// [naam, leessleutel, write-sleutel]: een Write-sleutel kan alles wat een leessleutel kan.
const RECHTEN: [string, boolean, boolean][] = [
  ['Posities ophalen', true, true],
  ['Historie ophalen', true, true],
  ['Orders in demo', false, true],
  ['Orders in echt', false, true],
  ['Stop en doel wijzigen', false, true],
];
const STAP = 220;
const TOTAAL = RECHTEN.length * STAP + 500;

export function VisKoppelen({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const t = useSharedValue(TOTAAL);

  useEffect(() => {
    if (reduceMotion) {
      t.value = TOTAAL;
      return;
    }
    t.value = 0;
    t.value = withTiming(TOTAAL, { duration: TOTAAL, easing: Easing.linear });
  }, [speelSleutel, reduceMotion]);

  return (
    <View style={[styles.kaart, { backgroundColor: colors.kaart, borderColor: colors.rand }]}>
      <View style={styles.rij}>
        <View style={styles.naam} />
        <Text style={[Type.overline, styles.kolom, { color: colors.tekstGedimd }]}>READ</Text>
        <Text style={[Type.overline, styles.kolom, { color: colors.tekstGedimd }]}>WRITE</Text>
      </View>
      {RECHTEN.map(([naam, lees, schrijf], i) => (
        <View key={naam} style={[styles.rij, { borderTopColor: colors.rand, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <Text style={[Type.caption, styles.naam, { color: colors.tekstPrimair }]}>{naam}</Text>
          <Vink aan={lees} start={i * STAP} t={t} />
          <Vink aan={schrijf} start={i * STAP + 110} t={t} />
        </View>
      ))}
      <View style={styles.slot}>
        <Lock size={14} color={colors.tekstGedimd} strokeWidth={1.75} />
        <Text style={[Type.caption, styles.naam, { color: colors.tekstGedimd }]}>
          Sleutel alleen op dit toestel, in de beveiligde opslag
        </Text>
      </View>
    </View>
  );
}

// Het vinkje poppt met een kleine overshoot (scale 0, 1,25, 1); zonder recht staat er een streepje.
function Vink(p: { aan: boolean; start: number; t: { value: number } }) {
  const { colors } = useTheme();
  const stijl = useAnimatedStyle(() => ({
    opacity: interpolate(p.t.value, [p.start, p.start + 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(p.t.value, [p.start, p.start + 160, p.start + 260], [0, 1.25, 1], Extrapolation.CLAMP) }],
  }));
  return (
    <View style={styles.kolom}>
      <Animated.View style={stijl}>
        {p.aan
          ? <Check size={18} color={colors.winst} strokeWidth={2.25} />
          : <Text style={[Type.prijs, { color: colors.tekstGedimd }]}>-</Text>}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: { borderWidth: 1, borderRadius: radii.kaart, padding: spacing.base, gap: spacing.xs },
  rij: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.sm },
  naam: { flex: 1 },
  kolom: { width: 52, alignItems: 'center', textAlign: 'center' },
  slot: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
});
