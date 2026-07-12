import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { CHANGELOG } from '../changelog';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  // Toont alleen de nieuwste versie, voor de "nieuw in deze versie"-melding bij opstarten
  alleenNieuwste?: boolean;
}

export function ChangelogSheet({ zichtbaar, onSluiten, alleenNieuwste }: Props) {
  const { colors } = useTheme();
  const entries = alleenNieuwste ? CHANGELOG.slice(0, 1) : CHANGELOG;
  const titel = alleenNieuwste ? `Nieuw in v${CHANGELOG[0]?.versie}` : 'Wijzigingen';

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={styles.vel}>
      <View style={styles.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{titel}</Text>
        <Pressable
          onPress={onSluiten}
          accessibilityLabel="Sluiten"
          accessibilityRole="button"
          style={styles.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {entries.map(entry => (
          <View key={entry.versie} style={styles.entry}>
            <View style={styles.entryKop}>
              <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>v{entry.versie}</Text>
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{entry.datum}</Text>
            </View>
            {entry.punten.map((punt, i) => (
              <Text key={i} style={[Type.caption, styles.punt, { color: colors.tekstGedimd }]}>• {punt}</Text>
            ))}
          </View>
        ))}
      </ScrollView>

      {alleenNieuwste && (
        <Pressable
          style={[styles.begrepenKnop, { backgroundColor: colors.cta }]}
          onPress={onSluiten}
          accessibilityRole="button"
        >
          <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Begrepen</Text>
        </Pressable>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  vel: {
    maxHeight: '80%',
  },
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  entry: { marginBottom: spacing.base },
  entryKop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  punt: { lineHeight: 18, marginBottom: 2 },
  begrepenKnop: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    alignItems: 'center',
    minHeight: 44,
  },
});
