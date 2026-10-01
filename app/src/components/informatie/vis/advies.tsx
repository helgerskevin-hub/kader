import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { veer } from '../../../theme/beweging';
import { AdviceBadge } from '../../AdviceBadge';
import { BevestigdKeurmerk } from '../../BevestigdKeurmerk';
import type { VisProps } from './types';

type Label = 'AFWACHTEN' | 'KOOPZONE' | 'STERK KOOP';
interface Stap { score: number; label: Label }
const STAPPEN: Stap[] = [
  { score: 30, label: 'AFWACHTEN' },
  { score: 61, label: 'KOOPZONE' },
  { score: 74, label: 'STERK KOOP' },
  { score: 86, label: 'STERK KOOP' },
];
const PAUZE = 900;
const EIND = STAPPEN[STAPPEN.length - 1];
const EISEN: [string, string][] = [['Trend', 'op'], ['MACD', 'bullish'], ['Volume', '1,8x'], ['R/R', '1 : 2.4']];

export function VisAdvies({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const bw = useSharedValue(0);
  const score = useSharedValue(EIND.score);
  const [stap, setStap] = useState(reduceMotion ? STAPPEN.length - 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      score.value = EIND.score;
      setStap(STAPPEN.length - 1);
      return;
    }
    setStap(0);
    score.value = STAPPEN[0].score;
    score.value = withSequence(
      ...STAPPEN.slice(1).map(s => withDelay(PAUZE, withSpring(s.score, veer.standaard))),
    );
    const timers = STAPPEN.slice(1).map((_, i) => setTimeout(() => setStap(i + 1), (i + 1) * PAUZE + 120));
    return () => timers.forEach(clearTimeout);
  }, [speelSleutel, reduceMotion, score]);

  const markerStijl = useAnimatedStyle(() => ({
    transform: [{ translateX: (score.value / 100) * bw.value - 2 }],
  }));
  const huidig = STAPPEN[stap];
  const bevestigd = stap === STAPPEN.length - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.badges}>
        <AdviceBadge advies={huidig.label} score={huidig.score} />
        {bevestigd && <BevestigdKeurmerk animeer={!reduceMotion} />}
      </View>
      <View style={styles.schaalVak}>
        <View style={styles.schaal} onLayout={(e: LayoutChangeEvent) => { bw.value = e.nativeEvent.layout.width; }}>
          <View style={[styles.band, { left: '0%', width: '55%', backgroundColor: colors.verhoogd }]} />
          <View style={[styles.band, { left: '55%', width: '17%', backgroundColor: colors.winst + '40' }]} />
          <View style={[styles.band, { left: '72%', width: '28%', backgroundColor: colors.winst }]} />
          <Animated.View style={[styles.marker, { backgroundColor: colors.tekstPrimair, borderColor: colors.kaart }, markerStijl]} />
        </View>
        <View style={styles.assen}>
          {[0, 55, 72, 100].map(n => (
            <Text key={n} style={[Type.label, styles.as, { left: `${n}%`, color: colors.tekstGedimd }]}>{n}</Text>
          ))}
        </View>
      </View>
      <View style={styles.eisen}>
        {EISEN.map(([naam, waarde]) => (
          <Text key={naam} style={[Type.caption, { color: colors.tekstGedimd, opacity: bevestigd ? 1 : 0.4 }]}>
            {naam} <Text style={{ color: colors.tekstPrimair }}>{waarde}</Text>
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, minHeight: 28 },
  schaalVak: { paddingTop: 4 },
  schaal: { height: 10, borderRadius: 5, overflow: 'visible' },
  band: { position: 'absolute', top: 0, height: 10 },
  marker: { position: 'absolute', top: -5, left: 0, width: 4, height: 20, borderRadius: 2, borderWidth: 1 },
  assen: { height: 18, marginTop: 10 },
  as: { position: 'absolute', top: 0, width: 30, marginLeft: -15, textAlign: 'center' },
  eisen: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
