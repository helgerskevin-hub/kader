import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EyeOff, X } from 'lucide-react-native';
import { fmtR } from '../engine/format';
import { KOOP_VENSTER_DAGEN, geldBijRisico, sindsDagen, vatGemistSamen } from '../engine/gemisteKansen';
import { useGemisteKansen } from '../state/useGemisteKansen';
import { useHandelskapitaal } from '../state/useHandelskapitaal';
import { useRisicoPct } from '../state/useRisicoPct';
import { useValuta } from '../state/useValuta';
import { useTheme } from '../theme/ThemeProvider';
import { useModalKopruimte } from '../theme/useModalKopruimte';
import { Fonts, Type } from '../theme/typography';
import { radii, shadow, spacing } from '../theme/tokens';
import { staggerVertraging } from '../theme/beweging';
import { useReduceMotion } from '../theme/useReduceMotion';
import { kaartLandt } from '../theme/lijstBeweging';
import { PodiumScherm } from './PodiumScherm';
import { LegeStaatBeeld, Opkomst } from './LegeStaatBeeld';
import { AnimatedGetal } from './AnimatedGetal';
import { LijstGroep } from './lijst/LijstGroep';
import { SignaalRij } from './SignaalScorebordScherm';
import { Disclaimer } from './Disclaimer';

const PERIODE_DAGEN = 30;
const WEEK_DAGEN = 7;
const VOETNOOT = `Een signaal telt als gemist als je binnen ${KOOP_VENSTER_DAGEN} dagen niet kocht. Leerzaam, geen verwijt: in de backtest haalt maar een op de drie signalen zijn doel.`;

export function GemisteKansenScherm({ zichtbaar, onSluiten }: { zichtbaar: boolean; onSluiten: () => void }) {
  const { colors } = useTheme();
  const extraKopruimte = useModalKopruimte();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { items } = useGemisteKansen(zichtbaar);
  const { kapitaal } = useHandelskapitaal();
  const { pctGetal } = useRisicoPct();
  const { eurPerUsd } = useValuta();

  const nu = Date.now();
  const inPeriode = useMemo(() => (items ? sindsDagen(items, PERIODE_DAGEN, nu) : []), [items]);
  const stand = useMemo(() => vatGemistSamen(inPeriode), [inPeriode]);
  const dezeWeek = useMemo(() => sindsDagen(inPeriode, WEEK_DAGEN, nu), [inPeriode]);
  const eerder = inPeriode.slice(dezeWeek.length);

  const [getoond, setGetoond] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setGetoond(stand.nettoR), staggerVertraging(1));
    return () => clearTimeout(t);
  }, [stand.nettoR]);

  const geld = geldBijRisico(stand.nettoR, kapitaal, pctGetal, eurPerUsd);

  return (
    <PodiumScherm zichtbaar={zichtbaar} onSluiten={onSluiten}>
      {sluit => (
        <View style={[styles.root, { backgroundColor: colors.achtergrond }]}>
          <View style={[styles.header, { borderBottomColor: colors.rand, paddingTop: spacing.base + extraKopruimte }]}>
            <View style={styles.headerLinks}>
              <EyeOff size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
              <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Gemiste kansen</Text>
            </View>
            <Pressable onPress={() => sluit()} style={styles.sluitKnop} accessibilityRole="button" accessibilityLabel="Sluiten" hitSlop={8}>
              <X size={22} color={colors.tekstGedimd} strokeWidth={1.75} />
            </Pressable>
          </View>

          {items === null ? null : inPeriode.length === 0 ? (
            <View style={styles.leeg}>
              <Opkomst volgorde={0}>
                <LegeStaatBeeld>
                  <EyeOff size={26} color={colors.primair} strokeWidth={1.5} />
                </LegeStaatBeeld>
              </Opkomst>
              <Opkomst volgorde={1}>
                <Text style={[Type.sectiekop, { color: colors.tekstPrimair, marginTop: spacing.base, textAlign: 'center' }]}>
                  Niets gemist
                </Text>
              </Opkomst>
              <Opkomst volgorde={2}>
                <Text style={[Type.body, styles.leegTekst, { color: colors.tekstGedimd }]}>
                  In de afgelopen {PERIODE_DAGEN} dagen haalde geen signaal dat je niet kocht zijn doel of stop.
                </Text>
              </Opkomst>
            </View>
          ) : (
            <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xl + insets.bottom }]} showsVerticalScrollIndicator={false}>
              <Animated.View entering={kaartLandt(0, reduceMotion)} style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
                <View style={{ gap: 2 }}>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]}>AFGELOPEN {PERIODE_DAGEN} DAGEN, NIET GEKOCHT</Text>
                  <AnimatedGetal waarde={getoond} format={r => fmtR(r, 1)} style={styles.hero} kleurBijTeken={{ positief: colors.winst, negatief: colors.verlies }} />
                  <Text style={[Type.caption, { color: colors.tekstGedimd }]}>wat elk niet-gekocht signaal blind volgen had opgeleverd</Text>
                </View>
                <View style={[styles.statRij, { borderTopColor: colors.rand }]}>
                  <Stat label="GEMIST" waarde={fmtR(stand.gemist.r, 1)} kleur={colors.winst} />
                  <Stat label="ONTWEKEN" waarde={fmtR(stand.ontweken.r, 1)} kleur={stand.ontweken.aantal > 0 ? colors.verlies : colors.tekstPrimair} />
                  {geld !== null
                    ? <Stat label={eurPerUsd !== null ? 'EURO' : 'DOLLAR'} waarde={geld} kleur={colors.tekstPrimair} />
                    : <Stat label="SIGNALEN" waarde={String(inPeriode.length)} kleur={colors.tekstPrimair} />}
                </View>
              </Animated.View>

              {dezeWeek.length > 0 && (
                <Animated.View entering={kaartLandt(1, reduceMotion)}>
                  <LijstGroep titel="Deze week" lijnInspringing={62}>
                    {dezeWeek.map((i, n) => <SignaalRij key={i.signaal.id} s={i.signaal} index={n} />)}
                  </LijstGroep>
                </Animated.View>
              )}
              {eerder.length > 0 && (
                <Animated.View entering={kaartLandt(2, reduceMotion)}>
                  <LijstGroep titel="Eerder" lijnInspringing={62} voetnoot={VOETNOOT}>
                    {eerder.map((i, n) => <SignaalRij key={i.signaal.id} s={i.signaal} index={n} />)}
                  </LijstGroep>
                </Animated.View>
              )}
              {eerder.length === 0 && (
                <Text style={[Type.caption, { color: colors.tekstGedimd, paddingHorizontal: spacing.base, lineHeight: 18 }]}>{VOETNOOT}</Text>
              )}
              <Disclaimer metRand={false} />
            </ScrollView>
          )}
        </View>
      )}
    </PodiumScherm>
  );
}

function Stat({ label, waarde, kleur }: { label: string; waarde: string; kleur: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statWaarde, { color: kleur }]}>{waarde}</Text>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  scroll: { padding: spacing.base, gap: spacing.lg },
  leeg: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl * 2 },
  leegTekst: { textAlign: 'center', marginTop: spacing.sm, lineHeight: 24 },
  kaart: { borderRadius: radii.kaart, padding: spacing.base, gap: spacing.md },
  hero: { fontFamily: Fonts.monoMedium, fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
  statRij: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  stat: { flex: 1, gap: 4 },
  statWaarde: { fontFamily: Fonts.monoMedium, fontSize: 16 },
});
