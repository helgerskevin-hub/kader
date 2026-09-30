import React, { useEffect } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { staggerVertraging, veer } from '../../../theme/beweging';
import { CoinLogo } from '../../CoinLogo';
import type { VisProps } from './types';

// Afstand tot de 90-dagen-top in procent. Van -30% (links) tot de top zelf (rechts); het radarvlak
// is het rechter deel, vanaf -9%.
const RIJEN: [string, number][] = [['INJ', -1.2], ['SOL', -2.8], ['LINK', -4.6], ['BTC', -12.3]];
const MIN = -30;
const RADAR_VANAF = -9;
function pos(pct: number): number {
  'worklet';
  return (pct - MIN) / -MIN;
}

function Rij({ symbool, afstand, index, speelSleutel, reduceMotion }: VisProps & { symbool: string; afstand: number; index: number }) {
  const { colors } = useTheme();
  const bw = useSharedValue(0);
  const p = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = withDelay(200 + staggerVertraging(index) * 3, withSpring(1, veer.zacht));
  }, [speelSleutel, reduceMotion, index, p]);

  // De stip staat op left 0 en schuift met translateX vanaf de linkerrand naar zijn plek.
  const stijl = useAnimatedStyle(() => ({
    transform: [{ translateX: pos(afstand) * bw.value * p.value - 6 }],
  }));
  const opRadar = afstand >= RADAR_VANAF;

  return (
    <View style={styles.rij}>
      <View style={styles.naam}>
        <CoinLogo symbool={symbool} grootte={22} />
        <Text style={[Type.caption, { color: colors.tekstPrimair }]}>{symbool}</Text>
      </View>
      <View style={styles.baan} onLayout={(e: LayoutChangeEvent) => { bw.value = e.nativeEvent.layout.width; }}>
        <View style={[styles.spoor, { backgroundColor: colors.verhoogd }]} />
        <View style={[styles.zone, { left: `${pos(RADAR_VANAF) * 100}%`, backgroundColor: colors.cta + '33' }]} />
        <Animated.View style={[styles.stip, { backgroundColor: opRadar ? colors.cta : colors.tekstGedimd }, stijl]} />
      </View>
      <Text style={[Type.label, styles.waarde, { color: colors.tekstPrimair }]}>
        {afstand.toFixed(1).replace('.', ',')}%
      </Text>
    </View>
  );
}

export function VisRadar({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.rij}>
        <View style={styles.naam} />
        <Text style={[Type.overline, styles.kop, { color: colors.cta }]}>Op de radar</Text>
        <View style={styles.waarde} />
      </View>
      {RIJEN.map(([s, a], i) => (
        <Rij key={s} symbool={s} afstand={a} index={i} speelSleutel={speelSleutel} reduceMotion={reduceMotion} />
      ))}
      <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
        Afstand tot de 90-dagen-top. Het blauwe vlak is de radar: dicht bij de top.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  rij: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  naam: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 80 },
  kop: { flex: 1, textAlign: 'right' },
  baan: { flex: 1, height: 20, justifyContent: 'center' },
  spoor: { height: 4, borderRadius: 2 },
  zone: { position: 'absolute', top: 0, right: 0, height: 20, borderRadius: 6 },
  stip: { position: 'absolute', top: 4, left: 0, width: 12, height: 12, borderRadius: 6 },
  waarde: { width: 64, textAlign: 'right' },
});
