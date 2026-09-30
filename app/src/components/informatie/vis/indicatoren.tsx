import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, PixelRatio, type LayoutChangeEvent } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { radii } from '../../../theme/tokens';
import { curve, duur } from '../../../theme/beweging';
import type { VisProps } from './types';

const TEGELS: { naam: string; waarde: string; uitleg: string }[] = [
  { naam: 'RSI', waarde: '58', uitleg: 'Gezond, niet oververhit' },
  { naam: 'EMA20 / EMA50', waarde: 'Boven', uitleg: 'EMA20 boven EMA50: de trend stijgt' },
  { naam: 'MACD', waarde: 'Bullish', uitleg: 'Momentum versnelt' },
  { naam: 'Volume', waarde: '1,8x', uitleg: 'Laatste dag boven gemiddeld' },
];

// Statisch: vier tegels met alleen een fade bij openen. Twee kolommen, of één als de gemeten breedte
// (gecorrigeerd voor de systeemletter) te smal is. Twee expliciete rijen in plaats van flexWrap.
export function VisIndicatoren({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const [breedte, setBreedte] = useState(0);
  const zicht = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      zicht.value = 1;
      return;
    }
    zicht.value = 0;
    zicht.value = withTiming(1, { duration: duur.lang, easing: curve.binnen, reduceMotion: ReduceMotion.Never });
  }, [speelSleutel, reduceMotion, zicht]);
  const stijl = useAnimatedStyle(() => ({ opacity: zicht.value }));

  const kolommen = breedte > 0 && breedte / PixelRatio.getFontScale() < 260 ? 1 : 2;
  const rijen: (typeof TEGELS)[] = [];
  for (let i = 0; i < TEGELS.length; i += kolommen) rijen.push(TEGELS.slice(i, i + kolommen));

  return (
    <Animated.View style={[styles.wrap, stijl]} onLayout={(e: LayoutChangeEvent) => setBreedte(e.nativeEvent.layout.width)}>
      {rijen.map((rij, r) => (
        <View key={r} style={styles.rij}>
          {rij.map(t => (
            <View key={t.naam} style={[styles.tegel, { backgroundColor: colors.verhoogd }]}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{t.naam}</Text>
              <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>{t.waarde}</Text>
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{t.uitleg}</Text>
            </View>
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  rij: { flexDirection: 'row', gap: 8 },
  tegel: { flex: 1, borderRadius: radii.kaart, padding: 12, gap: 2 },
});
