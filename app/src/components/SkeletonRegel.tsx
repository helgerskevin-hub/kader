import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '../theme/tokens';
import { ShimmerBlok, ShimmerGroep } from './Shimmer';

interface Props {
  // Aantal label/waarde-paren op de rij, bijvoorbeeld 3 voor een niveau-rij (stop/entry/doel) of
  // 4-5 voor een indicatorgrid.
  aantal?: number;
}

// Skeleton voor een rij losse statistiekjes: een overline-label boven een waarde, zoals LevelRow
// of het indicatorgrid in CoinDetailScherm. Generiek genoeg om op meerdere plekken te hergebruiken
// in plaats van per scherm een eigen variant te bouwen.
export function SkeletonRegel({ aantal = 3 }: Props) {
  return (
    <ShimmerGroep style={styles.rij}>
      {Array.from({ length: aantal }).map((_, i) => (
        <View key={i} style={styles.item}>
          <ShimmerBlok style={styles.label} />
          <ShimmerBlok style={styles.waarde} />
        </View>
      ))}
    </ShimmerGroep>
  );
}

const styles = StyleSheet.create({
  rij: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base,
  },
  item: { gap: 4 },
  label: { width: 40, height: 10, borderRadius: 4 },
  waarde: { width: 64, height: 16, borderRadius: 4 },
});
