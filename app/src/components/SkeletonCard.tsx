import React from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radii, shadow } from '../theme/tokens';
import { useSkeletonPuls } from '../theme/useSkeletonPuls';

export function SkeletonCard() {
  const { colors } = useTheme();
  const bg = colors.verhoogd;
  const opacity = useSkeletonPuls();

  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      {/* De puls staat op de inhoud en niet op de kaart zelf. Met de opacity op de buitenste View
          vervaagde ook het witte kaartvlak en de schaduw, en loste de kaart half op in de
          achtergrond in plaats van dat de grijze blokjes ademden. */}
      <Animated.View style={{ opacity, gap: spacing.md }}>
      {/* Op de plek waar de adviesbadge komt te staan, zodat de kaart niet verspringt zodra de
          echte data er is. */}
      <View style={[styles.blok, { width: 84, height: 22, backgroundColor: bg, borderRadius: radii.pill }]} />
      <View style={styles.kop}>
        <View style={styles.kopLinks}>
          <View style={[styles.blok, { width: 64, height: 16, backgroundColor: bg }]} />
          <View style={[styles.blok, { width: 100, height: 12, backgroundColor: bg }]} />
        </View>
        <View style={styles.kopRechts}>
          <View style={[styles.blok, { width: 80, height: 20, backgroundColor: bg }]} />
          <View style={[styles.blok, { width: 48, height: 18, backgroundColor: bg, borderRadius: radii.pill }]} />
        </View>
      </View>
      <View style={styles.niveauRij}>
        <View style={[styles.blok, { flex: 1, height: 8, backgroundColor: bg, borderRadius: radii.pill }]} />
      </View>
      <View style={styles.metaRij}>
        {[72, 48, 60].map((w, i) => (
          <View key={i} style={{ gap: 4 }}>
            <View style={[styles.blok, { width: 28, height: 10, backgroundColor: bg }]} />
            <View style={[styles.blok, { width: w, height: 14, backgroundColor: bg }]} />
          </View>
        ))}
      </View>
      </Animated.View>
    </View>
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
  blok: {
    borderRadius: 4,
  },
});
