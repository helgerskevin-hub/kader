import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Canvas, DashPathEffect, Path, Skia } from '@shopify/react-native-skia';
import { Bell } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { radii, spacing } from '../../../theme/tokens';
import { fmtPrijs } from '../../../engine/format';
import type { VisProps } from './types';

const HOOGTE = 110;
const DOEL_Y = 26;
// Tijdlijn in ms: lijn 0 tot 1100, bel 1100 tot 1450, banner 1400 tot 1800.
const TOTAAL = 1800;
const PUNTEN = [[0, 96], [0.18, 78], [0.32, 86], [0.5, 58], [0.64, 66], [0.82, 40], [1, DOEL_Y]];

// De koers stijgt tot de stippellijn op $160, dan poppt de bel en valt de melding binnen. Skia
// tekent de lijn in via `end` van het pad; bel en banner gebruiken alleen transform en opacity.
export function VisAlerts({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const [breedte, setBreedte] = useState(0);
  const t = useSharedValue(TOTAAL);

  useEffect(() => {
    if (reduceMotion) {
      t.value = TOTAAL;
      return;
    }
    t.value = 0;
    t.value = withTiming(TOTAAL, { duration: TOTAAL, easing: Easing.linear });
  }, [speelSleutel, reduceMotion]);

  const lijn = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    PUNTEN.forEach(([x, y], i) => (i === 0 ? b.moveTo(x * breedte, y) : b.lineTo(x * breedte, y)));
    return b.detach();
  }, [breedte]);
  const doel = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    b.moveTo(0, DOEL_Y);
    b.lineTo(breedte, DOEL_Y);
    return b.detach();
  }, [breedte]);
  const eind = useDerivedValue(() => interpolate(t.value, [0, 1100], [0, 1], Extrapolation.CLAMP));

  const bel = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(t.value, [1100, 1300, 1450], [0, 1.3, 1], Extrapolation.CLAMP) }],
  }));
  const banner = useAnimatedStyle(() => {
    const v = interpolate(t.value, [1400, TOTAAL], [0, 1], Extrapolation.CLAMP);
    return { opacity: v, transform: [{ translateY: (1 - v) * -12 }] };
  });

  return (
    <View style={[styles.kaart, { backgroundColor: colors.kaart, borderColor: colors.rand }]}>
      <View style={{ height: HOOGTE }} onLayout={(e: LayoutChangeEvent) => setBreedte(e.nativeEvent.layout.width)}>
        <Canvas style={{ width: breedte, height: HOOGTE }} pointerEvents="none">
          <Path path={doel} style="stroke" strokeWidth={1.5} color={colors.tekstGedimd}>
            <DashPathEffect intervals={[6, 5]} />
          </Path>
          <Path path={lijn} style="stroke" strokeWidth={2.5} strokeCap="round" strokeJoin="round" color={colors.cta} start={0} end={eind} />
        </Canvas>
        <Text style={[Type.label, styles.doelTekst, { color: colors.tekstGedimd }]}>{fmtPrijs(160)}</Text>
        <Animated.View style={[styles.bel, { backgroundColor: colors.cta }, bel]}>
          <Bell size={16} color="#FFFFFF" strokeWidth={1.75} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.banner, { backgroundColor: colors.verhoogd }, banner]}>
        <Text style={[Type.caption, { color: colors.tekstPrimair }]}>SOL boven {fmtPrijs(160)}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: { borderWidth: 1, borderRadius: radii.kaart, padding: spacing.base, gap: spacing.md },
  doelTekst: { position: 'absolute', right: 0, top: DOEL_Y + 4 },
  bel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: { borderRadius: radii.knop, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
