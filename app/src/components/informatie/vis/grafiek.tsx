import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { curve, duur } from '../../../theme/beweging';
import { PrijsGrafiek } from '../../PrijsGrafiek';
import type { Candle } from '../../../engine/types';
import type { VisProps } from './types';

const DEMO_CANDLES: Candle[] = Array.from({ length: 40 }, (_, i) => {
  const close = 100 + i * 0.4 + Math.sin(i / 4) * 6;
  return { open: close - 0.5, high: close + 1, low: close - 1, close, volume: 1000, tijd: Date.now() - (40 - i) * 864e5 };
});

// Statisch: de grafiek staat er, alleen een fade bij openen.
export function VisGrafiek({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
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

  const niveaus = useMemo(() => [
    { waarde: 101, kleur: colors.verlies },
    { waarde: 105, kleur: colors.cta },
    { waarde: 115.4, kleur: colors.winst },
  ], [colors.verlies, colors.cta, colors.winst]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={stijl}>
        <PrijsGrafiek candles={DEMO_CANDLES} toonPeriodes={false} hoogte={170} niveaus={niveaus} />
      </Animated.View>
      <View style={styles.legenda}>
        <Text style={[Type.caption, { color: colors.verlies }]}>- - stop</Text>
        <Text style={[Type.caption, { color: colors.cta }]}>- - entry</Text>
        <Text style={[Type.caption, { color: colors.winst }]}>- - doel</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
});
