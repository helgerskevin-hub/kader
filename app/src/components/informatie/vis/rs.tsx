import React, { useEffect } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { staggerVertraging, veer } from '../../../theme/beweging';
import { CoinLogo } from '../../CoinLogo';
import type { VisProps } from './types';

const RIJEN: [string, number][] = [
  ['LINK', 8.2], ['SOL', 5.1], ['ETH', 2.4], ['ADA', -3.0], ['DOT', -6.1], ['NEAR', -9.4],
];
const MAX = 10; // pt aan elke kant van de middellijn

const komma = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} pt`;

function Rij({ symbool, waarde, index, speelSleutel, reduceMotion }: VisProps & { symbool: string; waarde: number; index: number }) {
  const { colors } = useTheme();
  const bw = useSharedValue(0);
  const p = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = withDelay(200 + staggerVertraging(index) * 2, withSpring(1, veer.zacht));
  }, [speelSleutel, reduceMotion, index, p]);

  // Basisbreedte 100 met scaleX, vanuit het midden: de kant naast de middellijn blijft staan.
  const stijl = useAnimatedStyle(() => {
    const mid = bw.value / 2;
    const k = Math.max(0.0001, ((Math.abs(waarde) / MAX) * mid * p.value) / 100);
    const dx = waarde > 0 ? mid - 50 + 50 * k : mid - 50 - 50 * k;
    return { transform: [{ translateX: dx }, { scaleX: k }] };
  });
  const kleur = waarde > 0 ? colors.winst : colors.verlies;

  return (
    <View style={styles.rij}>
      <View style={styles.naam}>
        <CoinLogo symbool={symbool} grootte={22} />
        <Text style={[Type.caption, { color: colors.tekstPrimair }]}>{symbool}</Text>
      </View>
      <View style={styles.baan} onLayout={(e: LayoutChangeEvent) => { bw.value = e.nativeEvent.layout.width; }}>
        <Animated.View style={[styles.balk, { backgroundColor: kleur }, stijl]} />
        <View style={[styles.midden, { backgroundColor: colors.tekstGedimd }]} />
      </View>
      <Text style={[Type.label, styles.waarde, { color: kleur }]}>{komma(waarde)}</Text>
    </View>
  );
}

export function VisRs({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {RIJEN.map(([s, v], i) => (
        <Rij key={s} symbool={s} waarde={v} index={i} speelSleutel={speelSleutel} reduceMotion={reduceMotion} />
      ))}
      <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
        Links van de lijn zwakker dan BTC, rechts sterker dan BTC (30 dagen).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  rij: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  naam: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 80 },
  baan: { flex: 1, height: 12, justifyContent: 'center', overflow: 'hidden' },
  balk: { position: 'absolute', top: 0, left: 0, width: 100, height: 12, borderRadius: 3 },
  midden: { position: 'absolute', left: '50%', top: 0, width: 1, height: 12, marginLeft: -0.5, opacity: 0.6 },
  waarde: { width: 72, textAlign: 'right' },
});
