import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { DREMPEL_KOOP, DREMPEL_HOOG } from '../engine/drempels';

export type RsiFilter = 'alle' | 'oversold' | 'overbought';

export interface MarktFilterState {
  rsi: RsiFilter;
  minScore: number; // 0 = alle
  minRR: number; // 0 = alle
}

export const STANDAARD_FILTERS: MarktFilterState = { rsi: 'alle', minScore: 0, minRR: 0 };

export function aantalActieveFilters(f: MarktFilterState): number {
  return (f.rsi !== 'alle' ? 1 : 0) + (f.minScore > 0 ? 1 : 0) + (f.minRR > 0 ? 1 : 0);
}

interface Props {
  zichtbaar: boolean;
  waarden: MarktFilterState;
  onWijzig: (waarden: MarktFilterState) => void;
  onSluiten: () => void;
}

const RSI_OPTIES: { key: RsiFilter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'oversold', label: 'Oversold (<30)' },
  { key: 'overbought', label: 'Overbought (>70)' },
];

const SCORE_OPTIES: { key: number; label: string }[] = [
  { key: 0, label: 'Alle' },
  { key: DREMPEL_KOOP, label: `${DREMPEL_KOOP}+` },
  { key: DREMPEL_HOOG, label: `${DREMPEL_HOOG}+` },
];

const RR_OPTIES: { key: number; label: string }[] = [
  { key: 0, label: 'Alle' },
  { key: 2, label: '1:2+' },
  { key: 3, label: '1:3+' },
];

export function MarktFilters({ zichtbaar, waarden, onWijzig, onSluiten }: Props) {
  const { colors } = useTheme();

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten}>
      <View style={styles.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Filters</Text>
        <Pressable
          onPress={onSluiten}
          accessibilityLabel="Sluiten"
          accessibilityRole="button"
          style={styles.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      <FilterRij
        titel="RSI"
        opties={RSI_OPTIES}
        actief={waarden.rsi}
        onKies={rsi => onWijzig({ ...waarden, rsi })}
      />
      <FilterRij
        titel="SCORE"
        opties={SCORE_OPTIES}
        actief={waarden.minScore}
        onKies={minScore => onWijzig({ ...waarden, minScore })}
      />
      <FilterRij
        titel="R/R"
        opties={RR_OPTIES}
        actief={waarden.minRR}
        onKies={minRR => onWijzig({ ...waarden, minRR })}
      />

      <Pressable
        style={styles.wisKnop}
        onPress={() => onWijzig(STANDAARD_FILTERS)}
        accessibilityRole="button"
        accessibilityLabel="Filters wissen"
      >
        <Text style={[Type.body, { color: colors.cta, fontWeight: '600' }]}>Filters wissen</Text>
      </Pressable>
    </BottomSheet>
  );
}

function FilterRij<T extends string | number>({ titel, opties, actief, onKies }: {
  titel: string;
  opties: { key: T; label: string }[];
  actief: T;
  onKies: (waarde: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectie}>
      <Text style={[Type.overline, styles.sectieTitel, { color: colors.tekstGedimd }]}>{titel}</Text>
      <View style={styles.pillRij}>
        {opties.map(optie => {
          const isActief = optie.key === actief;
          return (
            <Pressable
              key={String(optie.key)}
              onPress={() => onKies(optie.key)}
              style={[
                styles.pill,
                { backgroundColor: isActief ? colors.cta : colors.verhoogd },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${titel}: ${optie.label}`}
            >
              <Text style={[Type.caption, { color: isActief ? 'white' : colors.tekstGedimd, fontWeight: '600' }]}>
                {optie.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  sectie: { marginBottom: spacing.base },
  sectieTitel: { marginBottom: spacing.sm },
  pillRij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    minHeight: 36,
    justifyContent: 'center',
  },
  wisKnop: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
});
