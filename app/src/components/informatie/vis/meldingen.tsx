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
import { Bell } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { staggerVertraging } from '../../../theme/beweging';
import { radii, spacing } from '../../../theme/tokens';
import type { VisProps } from './types';

// Echte titels uit notifications/ (tradeChecks.ts, sluitingen.ts, meldingen.ts).
const TITELS = [
  'LINK: doel gehaald',
  'LINK nadert de rand van je kader',
  'LINK: momentum vlakt af',
  'Marktklimaat omgeslagen naar ongunstig',
  'Het kader van vandaag staat klaar',
];
// Vermenigvuldiger op staggerVertraging: vijf banners moeten merkbaar na elkaar vallen.
const STAP = 3;
const DUUR = 320;
const TOTAAL = staggerVertraging(TITELS.length - 1) * STAP + DUUR;

// t loopt in milliseconden; elke banner leest zijn eigen stuk van die tijdlijn.
export function VisMeldingen({ speelSleutel, reduceMotion }: VisProps) {
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

  const voet = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [TOTAAL - 200, TOTAAL], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.kolom}>
      {TITELS.map((titel, i) => (
        <Banner key={titel} titel={titel} start={staggerVertraging(i) * STAP} t={t} />
      ))}
      <Animated.Text style={[Type.caption, { color: colors.tekstGedimd }, voet]}>
        Hooguit één keer per 6 uur per positie
      </Animated.Text>
    </View>
  );
}

function Banner(p: { titel: string; start: number; t: { value: number } }) {
  const { colors } = useTheme();
  const stijl = useAnimatedStyle(() => {
    const v = interpolate(p.t.value, [p.start, p.start + DUUR], [0, 1], Extrapolation.CLAMP);
    return { opacity: v, transform: [{ translateY: (1 - (1 - Math.pow(1 - v, 3))) * -16 }] };
  });
  return (
    <Animated.View style={[styles.banner, { backgroundColor: colors.kaart, borderColor: colors.rand }, stijl]}>
      <Bell size={16} color={colors.primair} strokeWidth={1.75} />
      <Text style={[Type.caption, styles.titel, { color: colors.tekstPrimair }]}>{p.titel}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  kolom: { gap: spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.knop,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  titel: { flex: 1 },
});
