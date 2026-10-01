import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, PixelRatio, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  ReduceMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { curve, duur, staggerVertraging, veer } from '../../../theme/beweging';
import { AnimatedGetal } from '../../AnimatedGetal';
import type { VisProps } from './types';

// Bouwstenen van de voorbeeldscore van 80: [naam, uitleg, punten].
const DELEN: [string, string, number][] = [
  ['Trend', 'EMA20 boven EMA50', 25],
  ['Boven EMA20', 'koers boven het gemiddelde', 15],
  ['RSI 58', 'gezond, tussen 45 en 68', 20],
  ['MACD', 'boven de signaallijn', 20],
];
const EIND = 80;

interface SegmentProps extends VisProps {
  links: number; // begin als fractie van de balk
  breed: number; // breedte als fractie van de balk
  kleur: string;
  index: number;
  bw: SharedValue<number>;
}

// Een segment is een View van vaste breedte 100 die met scaleX naar de gemeten breedte groeit: een
// View van 1dp breed zou op hele pixels afronden. Vanuit het midden schalen en terugschuiven zet de
// linkerkant op `links`.
function Segment({ links, breed, kleur, index, bw, speelSleutel, reduceMotion }: SegmentProps) {
  const p = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = withDelay(200 + staggerVertraging(index) * 2, withSpring(1, veer.zacht));
  }, [speelSleutel, reduceMotion, index, p]);
  const stijl = useAnimatedStyle(() => {
    const k = Math.max(0.0001, ((breed * bw.value) / 100) * p.value);
    return { transform: [{ translateX: links * bw.value - 50 + 50 * k }, { scaleX: k }] };
  });
  return <Animated.View style={[styles.segment, { backgroundColor: kleur }, stijl]} />;
}

export function VisScore({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const bw = useSharedValue(0);
  const lijst = useSharedValue(1);
  const [getal, setGetal] = useState(reduceMotion ? EIND : 0);

  useEffect(() => {
    if (reduceMotion) {
      setGetal(EIND);
      lijst.value = 1;
      return;
    }
    setGetal(0);
    lijst.value = 0;
    lijst.value = withDelay(700, withTiming(1, { duration: duur.lang, easing: curve.binnen, reduceMotion: ReduceMotion.Never }));
    const t = setTimeout(() => setGetal(EIND), 250);
    return () => clearTimeout(t);
  }, [speelSleutel, reduceMotion, lijst]);

  const lijstStijl = useAnimatedStyle(() => ({ opacity: lijst.value }));
  const kleuren = [colors.cta + '55', colors.cta + '88', colors.cta + 'BB', colors.cta];
  let x = 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.kop}>
        {/* Ruimte voor twee cijfers, want AnimatedGetal krimpt niet mee. */}
        <View style={{ minWidth: Math.ceil(2 * 28 * 0.7 * PixelRatio.getFontScale()) }}>
          <AnimatedGetal waarde={getal} format={n => String(Math.round(n))} style={[Type.display, { color: colors.tekstPrimair }]} />
        </View>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>van 100</Text>
      </View>
      <View>
        <View
          style={[styles.spoor, { backgroundColor: colors.verhoogd }]}
          onLayout={(e: LayoutChangeEvent) => { bw.value = e.nativeEvent.layout.width; }}
        >
          {DELEN.map(([naam, , punten], i) => {
            const links = x / 100;
            x += punten;
            return <Segment key={naam} links={links} breed={punten / 100} kleur={kleuren[i]} index={i} bw={bw} speelSleutel={speelSleutel} reduceMotion={reduceMotion} />;
          })}
        </View>
        {[55, 72].map(m => (
          <View key={m} style={[styles.merk, { left: `${m}%`, backgroundColor: colors.tekstPrimair }]} />
        ))}
        <View style={styles.merkLabels}>
          {[55, 72].map(m => (
            <Text key={m} style={[Type.label, styles.merkTekst, { left: `${m}%`, color: colors.tekstGedimd }]}>{m}</Text>
          ))}
        </View>
      </View>
      <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Vanaf 55 is het KOOPZONE, vanaf 72 STERK KOOP.</Text>
      <Animated.View style={[styles.lijst, lijstStijl]}>
        {DELEN.map(([naam, uitleg, punten], i) => (
          <View key={naam} style={styles.regel}>
            <View style={[styles.blokje, { backgroundColor: kleuren[i] }]} />
            <Text style={[Type.caption, styles.regelTekst, { color: colors.tekstPrimair }]}>{naam}: {uitleg}</Text>
            <Text style={[Type.label, { color: colors.tekstPrimair }]}>+{punten}</Text>
          </View>
        ))}
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Volume 1,1x telt niet mee: onder 1,2x geen punten.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  kop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  spoor: { height: 12, borderRadius: 6, overflow: 'hidden' },
  segment: { position: 'absolute', top: 0, left: 0, width: 100, height: 12 },
  merk: { position: 'absolute', top: -4, width: 2, height: 20, marginLeft: -1, opacity: 0.6 },
  merkLabels: { height: 18, marginTop: 14 },
  merkTekst: { position: 'absolute', top: 0, width: 30, marginLeft: -15, textAlign: 'center' },
  lijst: { gap: 6 },
  regel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blokje: { width: 10, height: 10, borderRadius: 3 },
  regelTekst: { flex: 1 },
});
