import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, G, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts } from '../theme/typography';

interface Props {
  size?: number;
  metWoordmerk?: boolean;
  /**
   * outline: alleen de 4 hoekhaken in één kleur, geen achtergrondvlak (voor de app-header).
   * licht: gevuld vlak (#1E3A8A) met witte hoekhaken, voor lichte achtergronden.
   * donker: gevuld vlak (#2563EB) met witte hoekhaken, voor donkere UI, splash en app-icoon.
   */
  variant?: 'outline' | 'licht' | 'donker';
}

// v2-geometrie: open vierkant kader van 4 losse hoekhaken, viewBox 0 0 96 96.
const HOEKEN = [
  'M24 40 L24 24 L40 24',
  'M56 24 L72 24 L72 40',
  'M24 56 L24 72 L40 72',
  'M56 72 L72 72 L72 56',
];

export function KaderLogo({ size = 48, metWoordmerk = false, variant = 'donker' }: Props) {
  const { colors } = useTheme();
  const vlakKleur = variant === 'licht' ? '#1E3A8A' : variant === 'donker' ? '#2563EB' : null;
  const paadKleur = variant === 'outline' ? colors.primair : '#FFFFFF';

  return (
    <View style={metWoordmerk ? styles.rij : undefined}>
      <Svg width={size} height={size} viewBox="0 0 96 96">
        {vlakKleur ? <Rect width={96} height={96} rx={22} fill={vlakKleur} /> : null}
        <G stroke={paadKleur} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none">
          {HOEKEN.map((d) => (
            <Path key={d} d={d} />
          ))}
        </G>
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
