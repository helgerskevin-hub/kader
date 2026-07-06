import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';

interface Props {
  huidig: number;
  totaal: number;
  kleur?: string;
}

export function Laadbalk({ huidig, totaal, kleur }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const positie = totaal > 0 ? Math.min(Math.max(huidig / totaal, 0), 1) : 0;
  const animatie = useRef(new Animated.Value(positie)).current;

  useEffect(() => {
    Animated.timing(animatie, {
      toValue: positie,
      duration: reduceMotion ? 0 : 300,
      useNativeDriver: false,
    }).start();
  }, [positie, animatie, reduceMotion]);

  const breedte = animatie.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrapper}>
      <View
        style={[styles.track, { backgroundColor: colors.verhoogd }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: totaal, now: huidig }}
      >
        <Animated.View style={[styles.vulling, { backgroundColor: kleur ?? colors.cta, width: breedte }]} />
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
    height: '100%',
    borderRadius: radii.pill,
  },
  percentage: {
    textAlign: 'right',
  },
});
