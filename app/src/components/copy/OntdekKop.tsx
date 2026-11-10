// De kop van Ontdek: zoeken op naam, sorteren en twee filters. Zoeken filtert eerst de lijst zelf;
// staat de naam er niet in, dan kan Kader hem bij eToro opzoeken (zie zoekTrader in CopyProvider).
import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, spacing } from '../../theme/tokens';
import { Drukbaar } from '../Drukbaar';
import type { TraderMetScore } from '../../state/CopyProvider';

export type Sortering = 'score' | 'rendement' | 'daling' | 'copiers';

export interface OntdekFilters {
  laagRisico: boolean;
  alleenKopieer: boolean;
}

export const SORTERINGEN: { id: Sortering; label: string }[] = [
  { id: 'score', label: 'Kader-score' },
  { id: 'rendement', label: 'Rendement' },
  { id: 'daling', label: 'Kleinste daling' },
  { id: 'copiers', label: 'Copiers' },
];

// Laag risico: eToro-risico tot en met 3.
const LAAG_RISICO = 3;

export function sorteerEnFilter(
  traders: readonly TraderMetScore[], zoek: string, sortering: Sortering, filters: OntdekFilters,
): TraderMetScore[] {
  const q = zoek.trim().toLowerCase();
  const lijst = traders.filter(t =>
    (!q || t.rij.username.toLowerCase().includes(q) || (t.rij.fullName ?? '').toLowerCase().includes(q))
    && (!filters.laagRisico || (t.rij.riskScore ?? 10) <= LAAG_RISICO)
    && (!filters.alleenKopieer || t.beoordeling.oordeel === 'KOPIEER'));
  // Onbekende waarden altijd achteraan, welke kant je ook op sorteert.
  const metNull = (a: number | null | undefined, b: number | null | undefined, oplopend: boolean) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return oplopend ? a - b : b - a;
  };
  return [...lijst].sort((a, b) => {
    switch (sortering) {
      case 'rendement': return metNull(a.beoordeling.rendementPct, b.beoordeling.rendementPct, false);
      case 'daling': return metNull(a.beoordeling.maxDalingPct, b.beoordeling.maxDalingPct, true);
      case 'copiers': return metNull(a.rij.copiers, b.rij.copiers, false);
      default: return b.beoordeling.score - a.beoordeling.score;
    }
  });
}

interface Props {
  zoek: string;
  onZoek: (v: string) => void;
  onZoekBijEtoro: () => void;
  sortering: Sortering;
  onSortering: (s: Sortering) => void;
  filters: OntdekFilters;
  onFilters: (f: OntdekFilters) => void;
}

function Chip({ label, actief, onDruk }: { label: string; actief: boolean; onDruk: () => void }) {
  const { colors } = useTheme();
  return (
    <Drukbaar
      onPress={onDruk}
      haptiek="tik"
      style={[styles.chip, { backgroundColor: actief ? colors.tekstPrimair : colors.verhoogd }]}
      accessibilityRole="button"
      accessibilityState={{ selected: actief }}
    >
      <Text style={[Type.caption, { color: actief ? colors.achtergrond : colors.tekstPrimair }]}>{label}</Text>
    </Drukbaar>
  );
}

export function OntdekKop({ zoek, onZoek, onZoekBijEtoro, sortering, onSortering, filters, onFilters }: Props) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={[styles.zoekVeld, { backgroundColor: colors.verhoogd }]}>
        <Search size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
        <TextInput
          value={zoek}
          onChangeText={onZoek}
          onSubmitEditing={onZoekBijEtoro}
          placeholder="Zoek een trader op naam"
          placeholderTextColor={colors.tekstGedimd}
          accessibilityLabel="Zoek een trader op naam"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={[Type.body, styles.zoekInvoer, { color: colors.tekstPrimair }]}
        />
        {zoek.length > 0 && (
          <Drukbaar onPress={() => onZoek('')} style={styles.wis} accessibilityRole="button" accessibilityLabel="Zoekveld leegmaken">
            <X size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Drukbaar>
        )}
      </View>

      <Text style={[Type.overline, styles.label, { color: colors.tekstGedimd }]}>SORTEER OP</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rij}>
        {SORTERINGEN.map(s => (
          <Chip key={s.id} label={s.label} actief={sortering === s.id} onDruk={() => onSortering(s.id)} />
        ))}
      </ScrollView>
      <View style={[styles.rij, styles.filterRij]}>
        <Chip label="Laag risico" actief={filters.laagRisico} onDruk={() => onFilters({ ...filters, laagRisico: !filters.laagRisico })} />
        <Chip label="Alleen KOPIEER" actief={filters.alleenKopieer} onDruk={() => onFilters({ ...filters, alleenKopieer: !filters.alleenKopieer })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zoekVeld: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44,
    borderRadius: radii.knop, paddingLeft: spacing.md, marginHorizontal: spacing.base, marginBottom: spacing.md,
  },
  zoekInvoer: { flex: 1, minHeight: 44, paddingVertical: 0 },
  wis: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  label: { paddingHorizontal: spacing.base, marginBottom: spacing.xs },
  rij: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.base },
  filterRij: { marginTop: spacing.sm, marginBottom: spacing.md },
  chip: { borderRadius: radii.pill, paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center' },
});
