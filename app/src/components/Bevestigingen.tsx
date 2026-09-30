import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { BevestigingenUitkomst } from '../engine/bevestigingen';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';

interface Props {
  uitkomst: BevestigingenUitkomst;
}

// De vier eisen achter het keurmerk als raster, met per eis de waarde. Zo zie je bij een trade
// zonder BEVESTIGD in één blik welke eis ontbreekt, in plaats van dat te moeten afleiden uit de
// redenen. Geen numberOfLines op de kop: op 360dp is de langste variant ("MARKTKLIMAAT WERKT NIET
// MEE") te breed voor één regel en mag hij afbreken. Bij de waarden is één regel wel genoeg.
export function Bevestigingen({ uitkomst }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.blok}>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{uitkomst.kop}</Text>
      <View style={styles.raster}>
        {/* colors.verhoogd: het raster staat sinds de UI-makeover direct op de kaart en niet meer
            in een verhoogd uitklapblok. Op colors.kaart zouden de tegels wegvallen tegen hun eigen
            achtergrond. */}
        {uitkomst.lijst.map(b => (
          <View key={b.naam} style={[styles.item, { backgroundColor: colors.verhoogd }]}>
            <View style={[styles.rondje, { backgroundColor: b.ok ? colors.primair + '29' : colors.rand }]}>
              {b.ok
                ? <Check size={11} color={colors.primair} strokeWidth={2.75} />
                : <X size={11} color={colors.tekstGedimd} strokeWidth={2.75} />}
            </View>
            <Text style={[styles.naam, { color: b.ok ? colors.tekstPrimair : colors.tekstGedimd }]}>
              {b.naam}
            </Text>
            <Text
              style={[Type.prijs, styles.waarde, { color: b.ok ? colors.tekstPrimair : colors.tekstGedimd }]}
              numberOfLines={1}
            >
              {b.waarde}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blok: { gap: spacing.sm },
  raster: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  item: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    padding: 8,
  },
  rondje: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  naam: { fontSize: 12, fontWeight: '500' },
  waarde: { fontSize: 12, marginLeft: 'auto', flexShrink: 1 },
});
