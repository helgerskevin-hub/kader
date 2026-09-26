import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { veer } from '../theme/beweging';

interface Props {
  huidig: number;
  totaal: number;
  kleur?: string;
}

// De vulling schaalt via transform: scaleX vanaf de linkerkant, niet via width. Width is een
// layout-eigenschap: die per frame omzetten laat alles eromheen opnieuw meten, en tijdens een scan
// waarin ook de kaarten landen is dat precies het werk dat de JS-thread niet kan missen. Op een veer,
// zodat elke stap vloeiend aansluit op de vorige in plaats van telkens opnieuw op te trekken.
export function Laadbalk({ huidig, totaal, kleur }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const positie = totaal > 0 ? Math.min(Math.max(huidig / totaal, 0), 1) : 0;
  const vulling = useSharedValue(positie);

  useEffect(() => {
    vulling.value = reduceMotion ? positie : withSpring(positie, veer.standaard);
  }, [positie, reduceMotion, vulling]);

  const vulStijl = useAnimatedStyle(() => ({ transform: [{ scaleX: vulling.value }] }));

  return (
    <View style={styles.wrapper}>
      <View
        style={[styles.track, { backgroundColor: colors.verhoogd }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: totaal, now: huidig }}
      >
        <Animated.View style={[styles.vulling, { backgroundColor: kleur ?? colors.cta }, vulStijl]} />
      </View>
      <Text style={[Type.caption, styles.percentage, { color: colors.tekstGedimd }]}>
        {Math.round(positie * 100)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  track: {
    height: 6,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  vulling: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.pill,
    transformOrigin: 'left',
  },
  percentage: {
    textAlign: 'right',
  },
});
