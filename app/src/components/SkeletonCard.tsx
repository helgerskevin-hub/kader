import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radii, shadow } from '../theme/tokens';

export function SkeletonCard() {
  const { colors } = useTheme();
  const bg = colors.verhoogd;

  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart, borderLeftColor: bg }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    borderLeftWidth: 4,
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
