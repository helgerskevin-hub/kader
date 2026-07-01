import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, G, Path, Polyline } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts } from '../theme/typography';

interface Props {
  size?: number;
  metWoordmerk?: boolean;
}

export function KaderLogo({ size = 48, metWoordmerk = false }: Props) {
  const { colors } = useTheme();
  const s = 60;
  const sw = 2.8;
  const swp = 2.2;
  const a = 14;
  const b = 46;

  return (
    <View style={metWoordmerk ? styles.rij : undefined}>
      <Svg width={size} height={size} viewBox={`0 0 ${s} ${s}`}>
        <Defs>
          <LinearGradient id="kaderGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#1E3A8A" />
            <Stop offset="100%" stopColor="#2563EB" />
          </LinearGradient>
        </Defs>
        <Rect width={s} height={s} rx={16} fill="url(#kaderGrad)" />
        <G stroke="white" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Path d={`M${a} ${a * 1.7} L${a} ${a} L${a * 1.7} ${a}`} />
          <Path d={`M${b - a * 0.7} ${a} L${b} ${a} L${b} ${a * 1.7}`} />
          <Path d={`M${a} ${b - a * 0.7} L${a} ${b} L${a * 1.7} ${b}`} />
          <Path d={`M${b - a * 0.7} ${b} L${b} ${b} L${b} ${b - a * 0.7}`} />
        </G>
        <Polyline
          points="18,38 24,31 30,34 42,20"
          stroke="white"
          strokeWidth={swp}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.92}
        />
      </Svg>
      {metWoordmerk && (
        <Text style={[styles.woordmerk, { color: colors.tekstPrimair }]}>Kader</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  woordmerk: {
    fontFamily: Fonts.sansBold,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
});
