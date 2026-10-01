import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { radii } from '../../../theme/tokens';
import { curve, duur, stagger } from '../../../theme/beweging';
import { PrijsGrafiek } from '../../PrijsGrafiek';
import type { Candle } from '../../../engine/types';
import type { VisProps } from './types';

// Vaste demo-reeks, zoals in AchtergrondScherm: de uitleg toont altijd hetzelfde.
const DEMO_CANDLES: Candle[] = Array.from({ length: 40 }, (_, i) => {
  const close = 100 + i * 0.4 + Math.sin(i / 4) * 6;
  return { open: close - 0.5, high: close + 1, low: close - 1, close, volume: 1000, tijd: Date.now() - (40 - i) * 864e5 };
});

// Risico 4, beloning 10,4: precies 1 : 2.6.
const STOP = 101;
const ENTRY = 105;
const DOEL = 115.4;

function fade(vertraging: number) {
  'worklet';
  return withDelay(vertraging, withTiming(1, { duration: duur.lang, easing: curve.binnen, reduceMotion: ReduceMotion.Never }));
}

export function VisAtr({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const grafiek = useSharedValue(1);
  const stop = useSharedValue(1);
  const entry = useSharedValue(1);
  const doel = useSharedValue(1);
  const chip = useSharedValue(1);

  useEffect(() => {
    const alle = [grafiek, stop, entry, doel, chip];
    if (reduceMotion) {
      alle.forEach(v => { v.value = 1; });
      return;
    }
    alle.forEach(v => { v.value = 0; });
    grafiek.value = fade(0);
    stop.value = fade(500);
    entry.value = fade(500 + stagger.stap * 10);
    doel.value = fade(500 + stagger.stap * 20);
    chip.value = fade(500 + stagger.stap * 30);
  }, [speelSleutel, reduceMotion, grafiek, stop, entry, doel, chip]);

  const niveaus = useMemo(() => [
    { waarde: STOP, kleur: colors.verlies },
    { waarde: ENTRY, kleur: colors.cta },
    { waarde: DOEL, kleur: colors.winst },
  ], [colors.verlies, colors.cta, colors.winst]);

  const grafiekStijl = useAnimatedStyle(() => ({ opacity: grafiek.value }));
  const stopStijl = useAnimatedStyle(() => ({ opacity: stop.value }));
  const entryStijl = useAnimatedStyle(() => ({ opacity: entry.value }));
  const doelStijl = useAnimatedStyle(() => ({ opacity: doel.value }));
  const chipStijl = useAnimatedStyle(() => ({ opacity: chip.value }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={grafiekStijl}>
        <PrijsGrafiek candles={DEMO_CANDLES} toonPeriodes={false} hoogte={160} niveaus={niveaus} />
      </Animated.View>
      <View style={styles.rij}>
        <Animated.Text style={[Type.overline, { color: colors.verlies }, stopStijl]}>STOP</Animated.Text>
        <Animated.Text style={[Type.overline, { color: colors.cta }, entryStijl]}>ENTRY</Animated.Text>
        <Animated.Text style={[Type.overline, { color: colors.winst }, doelStijl]}>DOEL (3x ATR)</Animated.Text>
      </View>
      <Animated.View style={[styles.chip, { backgroundColor: colors.verhoogd }, chipStijl]}>
        <Text style={[Type.label, { color: colors.tekstPrimair }]}>R/R 1 : 2.6</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  rij: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  chip: { alignSelf: 'flex-start', borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
});
