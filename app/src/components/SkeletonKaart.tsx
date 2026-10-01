import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radii, shadow } from '../theme/tokens';
import { ShimmerBlok, ShimmerGroep } from './Shimmer';

// Laadkaart voor Markt, Kansen en Portfolio. Volgt de anatomie van de nieuwe kaart (ring, twee
// regels, prijs met pil, grafiekblok, voetpillen) met dezelfde maten, zodat er bij het landen van
// de echte kaart niets verspringt: alleen de blokken maken plaats voor inhoud. SkeletonCard blijft
// voor Traders, want die kaart heeft nog de oude opbouw.
export function SkeletonKaart() {
  const { colors } = useTheme();

  return (
    // De glans loopt alleen over de grijze blokjes, niet over de kaart zelf; zie SkeletonCard.
    <ShimmerGroep style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      <View style={styles.kop}>
        <ShimmerBlok style={{ width: 48, height: 48, borderRadius: radii.pill }} />
        <View style={styles.kopMidden}>
          <ShimmerBlok style={{ width: 56, height: 16 }} />
          <ShimmerBlok style={{ width: 88, height: 12 }} />
        </View>
        <View style={styles.kopRechts}>
          <ShimmerBlok style={{ width: 84, height: 16 }} />
          <ShimmerBlok style={{ width: 64, height: 18, borderRadius: radii.pill }} />
        </View>
      </View>
      <ShimmerBlok style={{ height: 52, borderRadius: 12 }} />
      <View style={styles.voet}>
        <ShimmerBlok style={{ width: 112, height: 22, borderRadius: radii.pill }} />
        <ShimmerBlok style={{ width: 72, height: 22, borderRadius: radii.pill }} />
      </View>
    </ShimmerGroep>
  );
}

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    padding: spacing.base,
    gap: spacing.md,
  },
  kop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  kopMidden: { flex: 1, gap: 6 },
  kopRechts: { alignItems: 'flex-end', gap: 6 },
  voet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
