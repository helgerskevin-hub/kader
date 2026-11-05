import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { TriangleAlert } from 'lucide-react-native';
import { fmtBedrag } from '../../engine/format';
import { PLAFOND_PCT, alsPctVan, fmtPctKort } from '../../state/openRisico';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts, Type } from '../../theme/typography';
import { radii, spacing } from '../../theme/tokens';
import { useBeweging, useReduceMotion } from '../../theme/useReduceMotion';
import { schuifOvergang, uitklapIn, uitklapUit } from '../../theme/lijstBeweging';
import { AnimatedGetal } from '../AnimatedGetal';

const DOLLARS = { valuta: 'USD' } as const;

interface Props {
  kapitaal: number | null;
  // Wat je bij al je open stops samen verliest, zonder deze order.
  bestaandUsd: number;
  // Wat deze order er bij zijn stop aan toevoegt. Null zonder bedrag of zonder eigen stop.
  ditUsd: number | null;
}

// "Open risico na deze order" in de kooporder: je bestaande risico plus deze order, als deel van je
// kapitaal. Boven het plafond oranje, maar kopen blijft kunnen.
export function OpenRisicoRegel({ kapitaal, bestaandUsd, ditUsd }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { naar } = useBeweging();
  const totaal = bestaandUsd + (ditUsd ?? 0);
  const pct = alsPctVan(totaal, kapitaal);

  const vul = useSharedValue(0);
  useEffect(() => {
    vul.value = naar(Math.min(1, (pct ?? 0) / PLAFOND_PCT), 'standaard');
  }, [pct, naar, vul]);
  const vulStijl = useAnimatedStyle(() => ({ transform: [{ scaleX: vul.value }] }));

  if (pct === null || ditUsd === null) return null;
  const teHoog = pct > PLAFOND_PCT;
  const kleur = teHoog ? colors.letOp : colors.primair;

  return (
    <Animated.View entering={uitklapIn(reduceMotion)} exiting={uitklapUit()} layout={schuifOvergang(reduceMotion)} style={styles.blok}>
      <View style={[styles.vak, { backgroundColor: colors.verhoogd }]}>
        <View style={styles.rij} accessible accessibilityLabel={`Open risico na deze order ${fmtPctKort(pct)} van ${PLAFOND_PCT} procent`}>
          <Text style={[Type.overline, { color: colors.tekstGedimd, flex: 1 }]}>OPEN RISICO NA DEZE ORDER</Text>
          <AnimatedGetal waarde={pct} format={fmtPctKort} style={[styles.pct, { color: teHoog ? colors.letOp : colors.tekstPrimair }]} />
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>van {PLAFOND_PCT}%</Text>
        </View>
        <View style={[styles.balk, { backgroundColor: colors.kaart }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={[styles.vul, { backgroundColor: kleur }, vulStijl]} />
        </View>
      </View>
      {teHoog && (
        <Animated.View entering={uitklapIn(reduceMotion)} exiting={uitklapUit()} style={[styles.melding, { backgroundColor: colors.letOp + '1A' }]}>
          <TriangleAlert size={15} color={colors.letOp} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.tekst, { color: colors.letOp }]}>
            Met deze order kom je boven je plafond van {PLAFOND_PCT}%. Gaan je stops allemaal tegelijk, dan verlies je {fmtBedrag(totaal, DOLLARS)}.
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  blok: { gap: spacing.sm },
  vak: { borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: 10, gap: 6 },
  rij: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  pct: { fontFamily: Fonts.monoMedium, fontSize: 13 },
  balk: { height: 4, borderRadius: radii.pill, overflow: 'hidden' },
  vul: { flex: 1, borderRadius: radii.pill, transformOrigin: 'left' },
  melding: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radii.knop, paddingHorizontal: spacing.md, paddingVertical: 10 },
  tekst: { flex: 1, lineHeight: 18 },
});
