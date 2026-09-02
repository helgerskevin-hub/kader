import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { DREMPEL_KOOP, DREMPEL_HOOG } from '../engine/drempels';
import { RS_ACHTERBLIJVER_PP, RS_VOORLOPER_PP, RsFilter } from '../engine/relatieveSterkte';

export type RsiFilter = 'alle' | 'oversold' | 'overbought';

// Filteren op relatieve sterkte versus BTC. De grenzen komen uit meting H van de backtest (negen
// jaar, 3251 trades): koopsignalen op coins die achterbleven op bitcoin deden het gemiddeld +0,17,
// op voorlopers -0,03. Dit is nadrukkelijk een filter dat de gebruiker zelf aanzet en geen regel in
// de engine: de score blijft ongemoeid en zonder dit filter ziet het scherm er precies zo uit als
// altijd. Zie de openstaande keuze in TODO.md.
//
// RsFilter en magDoorRsFilter staan in engine/relatieveSterkte.ts, bij de grenzen en de self-check.

export interface MarktFilterState {
  rsi: RsiFilter;
  minScore: number; // 0 = alle
  minRR: number; // 0 = alle
  rs: RsFilter;
}

export const STANDAARD_FILTERS: MarktFilterState = { rsi: 'alle', minScore: 0, minRR: 0, rs: 'alle' };

export function aantalActieveFilters(f: MarktFilterState): number {
  return (f.rsi !== 'alle' ? 1 : 0) + (f.minScore > 0 ? 1 : 0) + (f.minRR > 0 ? 1 : 0)
    + (f.rs !== 'alle' ? 1 : 0);
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

const RS_OPTIES: { key: RsFilter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'geenVoorlopers', label: `Geen voorlopers` },
  { key: 'achterblijvers', label: 'Alleen achterblijvers' },
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
      <FilterRij
        titel="VS BTC (30 DAGEN)"
        opties={RS_OPTIES}
        actief={waarden.rs}
        onKies={rs => onWijzig({ ...waarden, rs })}
      />
      <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>
        {waarden.rs === 'alle'
          ? `Gemeten over negen jaar: koopsignalen op coins die achterbleven op bitcoin deden het beter dan dezelfde signalen op coins die al ver voorliepen. Deze twee filters gebruiken die grens: voorlopers zijn coins die meer dan ${RS_VOORLOPER_PP}% voorliggen, achterblijvers zitten ${Math.abs(RS_ACHTERBLIJVER_PP)}% of meer achter.`
          : waarden.rs === 'geenVoorlopers'
            ? `Coins die meer dan ${RS_VOORLOPER_PP}% voorliggen op bitcoin vallen weg. In de backtest deed die groep het gemiddeld slechter dan de rest.`
            : `Alleen coins die ${Math.abs(RS_ACHTERBLIJVER_PP)}% of meer achterlopen op bitcoin. Dat was in de backtest de sterkste groep, maar er blijven er weinig over.`}
      </Text>

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
  uitleg: { marginTop: spacing.sm, lineHeight: 18 },
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
