import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Layers } from 'lucide-react-native';
import { fmtBedrag } from '../engine/format';
import { OpenRisico, PLAFOND_PCT, alsPctVan, fmtPctKort } from '../state/openRisico';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts, Type } from '../theme/typography';
import { radii, shadow, spacing } from '../theme/tokens';
import { staggerVertraging } from '../theme/beweging';
import { useBeweging, useReduceMotion } from '../theme/useReduceMotion';
import { kaartLandt } from '../theme/lijstBeweging';
import { AnimatedGetal } from './AnimatedGetal';
import { UitlegKnop, UitlegTekst, useUitleg } from './UitlegKnop';

const DOLLARS = { valuta: 'USD' } as const;

const UITLEG = `Open risico is wat je verliest als de stops van al je open posities tegelijk geraakt worden, als deel van je handelskapitaal. Kader rekent met je huidige stop: staat die al op of boven je instap, dan kost die positie je geen inleg meer en telt hij als 0. Boven ${PLAFOND_PCT}% kleurt het getal oranje. Crypto beweegt vaak samen, dus "allemaal tegelijk" is geen theoretisch geval.`;

function zinVan(namen: string[]): string {
  if (namen.length <= 1) return namen.join('');
  return `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`;
}

// De kaart op Portfolio. Alleen als je handelskapitaal is ingevuld en er open posities zijn: zonder
// kapitaal is er geen percentage, en een kaart over nul posities is ruis.
export function OpenRisicoKaart({ stand, kapitaal }: { stand: OpenRisico; kapitaal: number | null }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { naar } = useBeweging();
  const { open, wissel, schuif } = useUitleg();
  const pct = alsPctVan(stand.risicoUsd, kapitaal);

  const [getoond, setGetoond] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setGetoond(pct ?? 0), staggerVertraging(1));
    return () => clearTimeout(t);
  }, [pct]);
  const vul = useSharedValue(0);
  useEffect(() => {
    vul.value = naar(Math.min(1, (pct ?? 0) / PLAFOND_PCT), 'standaard');
  }, [pct, naar, vul]);
  const vulStijl = useAnimatedStyle(() => ({ transform: [{ scaleX: vul.value }] }));

  const aantalPosities = stand.metRisico + stand.zonderRisico.length + stand.zonderStop.length;
  if (pct === null || aantalPosities === 0) return null;
  const teHoog = pct > PLAFOND_PCT;
  const kleur = teHoog ? colors.letOp : colors.primair;

  return (
    <Animated.View
      entering={kaartLandt(1, reduceMotion)}
      layout={schuif}
      style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}
    >
      <View style={styles.kop}>
        <View style={[styles.tegel, { backgroundColor: colors.primair + '1F' }]}>
          <Layers size={17} color={colors.primair} strokeWidth={1.75} />
        </View>
        <Text style={[Type.sectiekop, { color: colors.tekstPrimair, flex: 1 }]}>Open risico</Text>
        <UitlegKnop open={open} onWissel={wissel} onderwerp="open risico" />
      </View>
      <UitlegTekst open={open} tekst={UITLEG} />

      <View style={{ gap: spacing.sm }}>
        <View style={styles.getalRij} accessible accessibilityLabel={`Open risico ${fmtPctKort(pct)} van je plafond van ${PLAFOND_PCT} procent`}>
          <AnimatedGetal waarde={getoond} format={fmtPctKort} style={[styles.getal, { color: teHoog ? colors.letOp : colors.tekstPrimair }]} />
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>van je plafond van {PLAFOND_PCT}%</Text>
        </View>
        <View style={[styles.balk, { backgroundColor: colors.verhoogd }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={[styles.vul, { backgroundColor: kleur }, vulStijl]} />
        </View>
      </View>

      <Text style={[Type.caption, styles.zin, { color: colors.tekstGedimd }]}>
        Raken al je stops tegelijk, dan verlies je{' '}
        <Text style={[styles.bedrag, { color: colors.tekstPrimair }]}>{fmtBedrag(stand.risicoUsd, DOLLARS)}</Text>.
        {stand.zonderRisico.length > 0
          ? ` ${zinVan(stand.zonderRisico)} ${stand.zonderRisico.length === 1 ? 'telt' : 'tellen'} niet mee: die stop staat al op of boven je instap.`
          : ''}
      </Text>
      {stand.zonderStop.length > 0 && (
        <Text style={[Type.caption, styles.zin, { color: colors.letOp }]}>
          {zinVan(stand.zonderStop)} {stand.zonderStop.length === 1 ? 'heeft' : 'hebben'} geen stop. Daar is het verlies niet begrensd, en dat zit niet in dit getal.
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  kaart: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.md,
  },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  tegel: { width: 30, height: 30, borderRadius: radii.veld, alignItems: 'center', justifyContent: 'center' },
  getalRij: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  getal: { fontFamily: Fonts.monoMedium, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  balk: { height: 8, borderRadius: radii.pill, overflow: 'hidden' },
  vul: { flex: 1, borderRadius: radii.pill, transformOrigin: 'left' },
  zin: { lineHeight: 18 },
  bedrag: { fontFamily: Fonts.monoMedium },
});
