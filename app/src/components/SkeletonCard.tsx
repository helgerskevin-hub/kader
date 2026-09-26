import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radii, shadow } from '../theme/tokens';
import { ShimmerBlok, ShimmerGroep } from './Shimmer';

export function SkeletonCard() {
  const { colors } = useTheme();

  return (
    // De glans loopt alleen over de grijze blokjes, niet over de kaart zelf. Toen de oude puls op de
    // buitenste View stond, vervaagde ook het witte kaartvlak en de schaduw en loste de kaart half
    // op in de achtergrond; hetzelfde geldt voor een glans over het hele vlak.
    <ShimmerGroep style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      {/* Op de plek waar de adviesbadge en de platformmerkjes komen te staan, zodat de kaart niet
          verspringt zodra de echte data er is. De badge is breder dan vroeger, want het scorecijfer
          staat er nu in. */}
      <View style={styles.badgeRij}>
        <ShimmerBlok style={{ width: 108, height: 22, borderRadius: radii.pill }} />
        <ShimmerBlok style={{ width: 20, height: 20, borderRadius: radii.pill }} />
      </View>
      <View style={styles.kop}>
        <View style={styles.kopLinks}>
          <ShimmerBlok style={{ width: 64, height: 16 }} />
          <ShimmerBlok style={{ width: 100, height: 12 }} />
        </View>
        <View style={styles.kopRechts}>
          <ShimmerBlok style={{ width: 80, height: 20 }} />
        </View>
      </View>
      <View style={styles.niveauRij}>
        <ShimmerBlok style={{ flex: 1, height: 8, borderRadius: radii.pill }} />
      </View>
      <View style={styles.metaRij}>
        {[72, 48, 60].map((w, i) => (
          <View key={i} style={{ gap: 4 }}>
            <ShimmerBlok style={{ width: 28, height: 10 }} />
            <ShimmerBlok style={{ width: w, height: 14 }} />
          </View>
        ))}
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
  badgeRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  kopLinks: { gap: 6 },
  kopRechts: { alignItems: 'flex-end', gap: 6 },
  niveauRij: {
    flexDirection: 'row',
  },
  metaRij: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
});
