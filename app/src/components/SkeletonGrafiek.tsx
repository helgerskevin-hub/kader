import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radii } from '../theme/tokens';
import { useSkeletonPuls } from '../theme/useSkeletonPuls';

interface Props {
  hoogte?: number;
}

// Skeleton in de vorm van PrijsGrafiek: een grafiekvlak op dezelfde hoogte, met daaronder de
// periodeknoppen als pillen. Gebruikt tijdens het laden van een coin-detail, vóór de eerste
// candles binnen zijn.
export function SkeletonGrafiek({ hoogte = 180 }: Props) {
  const { colors } = useTheme();
  const bg = colors.verhoogd;
  const opacity = useSkeletonPuls();

  return (
    <Animated.View style={{ opacity }}>
      <Animated.View style={[styles.vlak, { height: hoogte, backgroundColor: bg }]} />
      <Animated.View style={styles.pillenRij}>
        {[1, 2, 3, 4].map(i => (
          <Animated.View key={i} style={[styles.pil, { backgroundColor: bg }]} />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  vlak: {
    borderRadius: 8,
  },
  pillenRij: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pil: {
    width: 52,
    height: 28,
    borderRadius: radii.pill,
  },
});
