import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { TriangleAlert, Wallet } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts, Type } from '../../theme/typography';
import { radii, spacing } from '../../theme/tokens';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { schuifOvergang, uitklapIn, uitklapUit } from '../../theme/lijstBeweging';
import { fmtBedrag } from '../../engine/format';
import { AnimatedGetal } from '../AnimatedGetal';

const DOLLARS = { valuta: 'USD' } as const;

interface Props {
  kapitaal: number | null;
  // De gekozen instelling, als tekst zoals in Instellingen ('0.5', '1', '2').
  risicoPct: string;
  // Wat je in dollars verliest bij de stop voor het bedrag dat nu in beeld staat. Null zonder bedrag.
  verliesBijStop: number | null;
  // Gevuld als Mijn risico onder het eToro-minimum uitkwam en het bedrag dus op het minimum staat.
  onderMinimum: number | null;
  minimum: number;
  eurPerUsd: number | null;
  // Zonder eigen stop (eToro kiest hem) is er geen verlies bij de stop te noemen.
  heeftStop: boolean;
}

// De regel onder de snelknoppen: wat je bij je stop verliest, als deel van je kapitaal. Rolt mee
// als je het bedrag aanpast, en kleurt oranje zodra je boven je gekozen risico uitkomt.
export function RisicoRegel({ kapitaal, risicoPct, verliesBijStop, onderMinimum, minimum, eurPerUsd, heeftStop }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  if (!heeftStop) return null;

  if (kapitaal === null) {
    return (
      <Animated.View entering={uitklapIn(reduceMotion)} exiting={uitklapUit()} style={[styles.hint, { backgroundColor: colors.verhoogd }]}>
        <Wallet size={15} color={colors.tekstGedimd} strokeWidth={1.75} />
        <Text style={[Type.caption, styles.tekst, { color: colors.tekstGedimd }]}>
          Vul op Portfolio je handelskapitaal in, dan stelt Kader hier een bedrag voor bij {risicoPct}% risico.
        </Text>
      </Animated.View>
    );
  }
  if (verliesBijStop === null) return null;

  const pct = (verliesBijStop / kapitaal) * 100;
  const teHoog = pct > Number(risicoPct) * 1.05;
  const kleur = teHoog ? colors.letOp : colors.tekstPrimair;

  return (
    <Animated.View entering={uitklapIn(reduceMotion)} exiting={uitklapUit()} layout={schuifOvergang(reduceMotion)} style={styles.blok}>
      <View style={styles.rij} accessible accessibilityLabel={`Bij je stop verlies je ${fmtBedrag(verliesBijStop, DOLLARS)}, ${pct.toFixed(1)} procent van je kapitaal`}>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Bij je stop verlies je</Text>
        <AnimatedGetal waarde={verliesBijStop} format={n => fmtBedrag(n, DOLLARS)} style={[styles.bedrag, { color: kleur }]} />
        <Text style={[Type.caption, { color: teHoog ? colors.letOp : colors.tekstGedimd }]}>
          ({pct < 0.95 ? pct.toFixed(1) : pct.toFixed(pct < 10 ? 1 : 0)}% van je kapitaal{eurPerUsd !== null ? `, ongeveer €${(verliesBijStop * eurPerUsd).toFixed(2)}` : ''})
        </Text>
      </View>
      {onderMinimum !== null ? (
        <Animated.View entering={uitklapIn(reduceMotion)} exiting={uitklapUit()} style={[styles.melding, { backgroundColor: colors.letOp + '1A' }]}>
          <TriangleAlert size={15} color={colors.letOp} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.tekst, { color: colors.letOp }]}>
            Op {risicoPct}% risico zou je positie {fmtBedrag(onderMinimum, DOLLARS)} zijn, kleiner dan het eToro-minimum van {fmtBedrag(minimum, DOLLARS)}. Met het minimum riskeer je iets meer dan je wilde.
          </Text>
        </Animated.View>
      ) : teHoog ? (
        <Text style={[Type.caption, styles.midden, { color: colors.letOp }]}>
          Dat is meer dan je gekozen {risicoPct}% risico per trade.
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  blok: { gap: spacing.sm },
  rij: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 5, rowGap: 2 },
  bedrag: { fontFamily: Fonts.monoMedium, fontSize: 13 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: 10 },
  melding: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radii.knop, paddingHorizontal: spacing.md, paddingVertical: 10 },
  tekst: { flex: 1, lineHeight: 18 },
  midden: { textAlign: 'center' },
});
