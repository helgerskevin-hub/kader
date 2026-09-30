import React, { useEffect, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { AnimatedGetal } from '../../AnimatedGetal';
import { HoudVastVulling } from '../../HoudVastVulling';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { curve, duur } from '../../../theme/beweging';
import { radii, spacing } from '../../../theme/tokens';
import { fmtBedrag } from '../../../engine/format';
import type { VisProps } from './types';

const TOTAAL = 12480.55;
const GROOTTE = 28;
const BLOOTSTELLING = 0.2;

// Totaal vermogen met daaronder de balk "in posities" tegenover "beschikbaar". Het getal rolt van
// nul naar het totaal; de balk groeit tot 20% via HoudVastVulling (base-width 100, scaleX).
export function VisVermogen({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const [waarde, setWaarde] = useState(TOTAAL);
  const vulling = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      setWaarde(TOTAAL);
      vulling.value = 1;
      return;
    }
    setWaarde(0);
    vulling.value = 0;
    const timer = setTimeout(() => setWaarde(TOTAAL), 250);
    vulling.value = withTiming(1, { duration: duur.lang * 2, easing: curve.binnen });
    return () => clearTimeout(timer);
  }, [speelSleutel, reduceMotion]);

  // Het getal krimpt nooit: de breedte voor het volle bedrag staat vast (ca. 0,7 em per teken).
  const minBreedte = fmtBedrag(TOTAAL).length * 0.7 * GROOTTE * PixelRatio.getFontScale();

  return (
    <View style={[styles.kaart, { backgroundColor: colors.kaart, borderColor: colors.rand }]}>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>TOTAAL VERMOGEN</Text>
      <View style={{ minWidth: minBreedte }}>
        <AnimatedGetal
          waarde={waarde}
          format={fmtBedrag}
          style={[Type.prijsGroot, { fontSize: GROOTTE, color: colors.tekstPrimair }]}
        />
      </View>
      <View style={[styles.spoor, { backgroundColor: colors.verhoogd }]}>
        <View style={styles.vulHouder}>
          <HoudVastVulling voortgang={vulling} kleur={colors.cta} />
        </View>
      </View>
      <View style={styles.rij}>
        <View style={styles.kolom}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>IN POSITIES</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>
            {fmtBedrag(TOTAAL * BLOOTSTELLING)}
          </Text>
        </View>
        <View style={styles.kolom}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>BESCHIKBAAR</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>
            {fmtBedrag(TOTAAL * (1 - BLOOTSTELLING))}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: { borderWidth: 1, borderRadius: radii.kaart, padding: spacing.base, gap: spacing.sm },
  spoor: { height: 10, borderRadius: radii.pill, overflow: 'hidden' },
  // De vulling is 20% van het spoor breed en groeit daarbinnen van 0 naar volle breedte.
  vulHouder: { width: '20%', height: 10, overflow: 'hidden', borderRadius: radii.pill },
  rij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base },
  kolom: { flexGrow: 1, flexBasis: 120, gap: 2 },
});
