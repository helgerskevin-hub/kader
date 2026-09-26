import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing, radii } from '../theme/tokens';
import { ShimmerBlok, ShimmerGroep } from './Shimmer';

interface Props {
  hoogte?: number;
}

// Skeleton in de vorm van PrijsGrafiek: een grafiekvlak op dezelfde hoogte, met daaronder de
// periodeknoppen als pillen. Gebruikt tijdens het laden van een coin-detail, vóór de eerste
// candles binnen zijn.
export function SkeletonGrafiek({ hoogte = 180 }: Props) {
  return (
    <ShimmerGroep>
      <ShimmerBlok style={[styles.vlak, { height: hoogte }]} />
      <View style={styles.pillenRij}>
        {[1, 2, 3, 4].map(i => (
          <ShimmerBlok key={i} style={styles.pil} />
        ))}
      </View>
    </ShimmerGroep>
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
