import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { relatieveTijd } from '../engine/format';
import { MeldingLogEntry } from '../notifications/tradeChecks';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  log: MeldingLogEntry[];
}

export function MeldingenSheet({ zichtbaar, onSluiten, log }: Props) {
  const { colors } = useTheme();

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={styles.vel}>
      <View style={styles.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Meldingen</Text>
        <Pressable
          onPress={onSluiten}
          accessibilityLabel="Sluiten"
          accessibilityRole="button"
          style={styles.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      {log.length === 0 ? (
        <Text style={[Type.body, { color: colors.tekstGedimd }]}>
          Nog geen meldingen. Zodra Kader iets over je trades te melden heeft, verschijnt het hier.
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {log.map((entry, i) => (
            <View key={`${entry.tijd}-${i}`} style={[styles.entry, { borderBottomColor: colors.rand }]}>
              <View style={styles.entryKop}>
                <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]} numberOfLines={1}>{entry.titel}</Text>
                <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{relatieveTijd(entry.tijd)}</Text>
              </View>
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{entry.tekst}</Text>
            </View>
          ))}
        </ScrollView>
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
  entry: {
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  entryKop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
});
