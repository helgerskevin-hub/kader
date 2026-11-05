import React, { useEffect, useMemo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartNoAxesColumn, Check, Clock, Minus, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useModalKopruimte } from '../theme/useModalKopruimte';
import { Fonts, Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { staggerVertraging } from '../theme/beweging';
import { useBeweging, useReduceMotion } from '../theme/useReduceMotion';
import { kaartLandt, schuifOvergang, uitklapIn, uitklapInGestaffeld, uitklapUit } from '../theme/lijstBeweging';
import { fmtR } from '../engine/format';
import { vatSamen, type GelogdSignaal, type SignaalUitkomst } from '../engine/signaalLog';
import { useSignaalBoek } from '../state/signaalBoek';
import { PodiumScherm } from './PodiumScherm';
import { LegeStaatBeeld, Opkomst } from './LegeStaatBeeld';
import { AnimatedGetal } from './AnimatedGetal';
import { CoinLogo } from './CoinLogo';
import { LijstGroep } from './lijst/LijstGroep';
import { StatRij } from './lijst/StatRij';
import { Disclaimer } from './Disclaimer';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
}

// Onder dit aantal zegt een groep weinig. Een gemiddelde van vijf signalen kan twee kanten op
// vallen door één uitschieter.
const MIN_VOOR_CONCLUSIE = 10;
const RECENT_AANTAL = 20;

function korteDatum(ms: number): string {
  return new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }).replace('.', '');
}

function langeDatum(ms: number): string {
  return new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace('.', '')
    .toUpperCase();
}

const signalenTekst = (n: number) => (n === 1 ? '1 signaal' : `${n} signalen`);

export function SignaalScorebordScherm({ zichtbaar, onSluiten }: Props) {
  const { colors } = useTheme();
  const extraKopruimte = useModalKopruimte();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { signalen, bezig } = useSignaalBoek(zichtbaar);

  const samenvatting = useMemo(() => (signalen ? vatSamen(signalen) : null), [signalen]);
  const recent = useMemo(
    () => (signalen ? [...signalen].sort((a, b) => b.tijd - a.tijd).slice(0, RECENT_AANTAL) : []),
    [signalen],
  );
  const lopend = useMemo(() => recent.filter(s => s.uitkomst === 'open'), [recent]);

  return (
    <PodiumScherm zichtbaar={zichtbaar} onSluiten={onSluiten}>
      {sluit => (
        <View style={[styles.root, { backgroundColor: colors.achtergrond }]}>
          <View style={[styles.header, { borderBottomColor: colors.rand, paddingTop: spacing.base + extraKopruimte }]}>
            <View style={styles.headerLinks}>
              <ChartNoAxesColumn size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
              <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Signaalresultaat</Text>
              {bezig && (
                <Animated.Text
                  entering={uitklapIn(reduceMotion)}
                  exiting={uitklapUit()}
                  style={[Type.caption, { color: colors.tekstGedimd }]}
                >
                  bijwerken
                </Animated.Text>
              )}
            </View>
            <Pressable
              onPress={() => sluit()}
              style={styles.sluitKnop}
              accessibilityRole="button"
              accessibilityLabel="Sluiten"
              hitSlop={8}
            >
              <X size={22} color={colors.tekstGedimd} strokeWidth={1.75} />
            </Pressable>
          </View>

          {samenvatting === null ? null : samenvatting.afgesloten === 0 ? (
            <ScrollView
              contentContainerStyle={[styles.leegScroll, { paddingBottom: spacing.xl + insets.bottom }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.leeg}>
                <Opkomst volgorde={0}>
                  <LegeStaatBeeld>
                    <ChartNoAxesColumn size={26} color={colors.primair} strokeWidth={1.5} />
                  </LegeStaatBeeld>
                </Opkomst>
                <Opkomst volgorde={1}>
                  <Text style={[Type.sectiekop, { color: colors.tekstPrimair, marginTop: spacing.base, textAlign: 'center' }]}>
                    Nog geen afgesloten signalen
                  </Text>
                </Opkomst>
                <Opkomst volgorde={2}>
                  <Text style={[Type.body, styles.leegTekst, { color: colors.tekstGedimd }]}>
                    Zodra een signaal zijn doel of stop raakt, of na 30 dagen verloopt, staat het hier met zijn resultaat.
                  </Text>
                </Opkomst>
              </View>
              {lopend.length > 0 && (
                <Animated.View entering={kaartLandt(3, reduceMotion)}>
                  <LijstGroep
                    titel="Lopende signalen"
                    lijnInspringing={62}
                    voetnoot="Kader houdt elk koopsignaal vanaf nu bij. Na een paar weken zie je hier of de signalen werken."
                  >
                    {lopend.map((s, i) => <SignaalRij key={s.id} s={s} index={i} />)}
                  </LijstGroep>
                </Animated.View>
              )}
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xl + insets.bottom }]}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View entering={kaartLandt(0, reduceMotion)}>
                <SamenvattingKaart
                  gemR={samenvatting.gemR ?? 0}
                  raakPct={samenvatting.raakPct ?? 0}
                  afgesloten={samenvatting.afgesloten}
                  lopend={samenvatting.lopend}
                  sinds={samenvatting.sinds}
                />
              </Animated.View>

              <Animated.View entering={kaartLandt(1, reduceMotion)} style={[styles.ijkpunt, { backgroundColor: colors.verhoogd }]}>
                <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 19 }]}>
                  Backtest over negen jaar: <Text style={[styles.ijkGetal, { color: colors.tekstPrimair }]}>+0.08 R</Text> per signaal,{' '}
                  <Text style={[styles.ijkGetal, { color: colors.tekstPrimair }]}>+0.15 R</Text> bij sterk koop. Live hoort Kader daar in de buurt te zitten.
                </Text>
              </Animated.View>

              <Animated.View entering={kaartLandt(2, reduceMotion)}>
                <LijstGroep
                  titel="Per scoreband"
                  lijnInspringing={spacing.base}
                  voetnoot={voetnootVoor(samenvatting.perBand.map(b => b.stand.aantal))}
                >
                  {samenvatting.perBand.map(b => (
                    <StatRij key={b.id} label={b.label} sub={signalenTekst(b.stand.aantal)} waarde={b.stand.gemR} format={r => fmtR(r)} />
                  ))}
                </LijstGroep>
              </Animated.View>

              <Animated.View entering={kaartLandt(3, reduceMotion)}>
                <LijstGroep
                  titel="Per advies"
                  lijnInspringing={spacing.base}
                  voetnoot={voetnootVoor(samenvatting.perAdvies.map(a => a.stand.aantal))}
                >
                  {samenvatting.perAdvies.map(a => (
                    <StatRij key={a.id} label={a.label} sub={signalenTekst(a.stand.aantal)} waarde={a.stand.gemR} format={r => fmtR(r)} />
                  ))}
                </LijstGroep>
              </Animated.View>

              <Animated.View entering={kaartLandt(4, reduceMotion)} layout={schuifOvergang(reduceMotion)}>
                <LijstGroep
                  titel="Recente signalen"
                  lijnInspringing={62}
                  voetnoot="Dit zijn de signalen die Kader zelf gaf, niet je eigen trades. Kader telt een signaal als raak bij een positief resultaat."
                >
                  {recent.map((s, i) => <SignaalRij key={s.id} s={s} index={i} />)}
                </LijstGroep>
              </Animated.View>

              <Disclaimer metRand={false} />
            </ScrollView>
          )}
        </View>
      )}
    </PodiumScherm>
  );
}

function voetnootVoor(aantallen: number[]): string | undefined {
  return aantallen.some(n => n > 0 && n < MIN_VOOR_CONCLUSIE)
    ? `Een groep met minder dan ${MIN_VOOR_CONCLUSIE} signalen zegt nog weinig.`
    : undefined;
}

function SamenvattingKaart({ gemR, raakPct, afgesloten, lopend, sinds }: {
  gemR: number;
  raakPct: number;
  afgesloten: number;
  lopend: number;
  sinds: number | null;
}) {
  const { colors } = useTheme();
  const { naar } = useBeweging();

  // Het getal rolt vanaf nul op zodra de kaart er staat, zodat je ziet dat het een uitkomst is en
  // geen vaste tekst. AnimatedGetal animeert alleen een verandering, dus we beginnen bij 0.
  const [getoond, setGetoond] = React.useState({ r: 0, pct: 0 });
  useEffect(() => {
    const t = setTimeout(() => setGetoond({ r: gemR, pct: raakPct }), staggerVertraging(1));
    return () => clearTimeout(t);
  }, [gemR, raakPct]);

  // De raakbalk vult van links, met dezelfde veer als de andere balken in de app.
  const vul = useSharedValue(0);
  useEffect(() => {
    vul.value = withDelay(staggerVertraging(2), naar(Math.max(0, Math.min(1, raakPct / 100)), 'standaard'));
  }, [raakPct, naar, vul]);
  const vulStijl = useAnimatedStyle(() => ({ transform: [{ scaleX: vul.value }] }));

  const pilKleur = gemR >= 0 ? colors.winst : colors.verlies;

  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      <View style={styles.kaartKop}>
        <View style={{ flexShrink: 1, gap: 2 }}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
            {sinds ? `LIVE SINDS ${langeDatum(sinds)}` : 'LIVE'}
          </Text>
          <AnimatedGetal
            waarde={getoond.r}
            format={r => fmtR(r)}
            style={styles.hero}
            kleurBijTeken={{ positief: colors.winst, negatief: colors.verlies }}
          />
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
            {afgesloten === 1 ? 'uit 1 afgesloten signaal' : `gemiddeld uit ${afgesloten} afgesloten signalen`}
          </Text>
        </View>
        <View style={[styles.pil, { backgroundColor: pilKleur + '1F' }]}>
          <Text style={[styles.pilTekst, { color: pilKleur }]}>{Math.round(raakPct)}% raak</Text>
        </View>
      </View>

      <View style={[styles.statRij, { borderTopColor: colors.rand }]}>
        <View style={styles.stat}>
          <AnimatedGetal waarde={getoond.pct} format={p => `${Math.round(p)}%`} style={[styles.statWaarde, { color: colors.tekstPrimair }]} />
          <View style={[styles.balk, { backgroundColor: colors.verhoogd }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Animated.View style={[styles.balkVul, { backgroundColor: colors.winst }, vulStijl]} />
          </View>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>RAAK-%</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statWaarde, { color: colors.tekstPrimair }]}>{afgesloten}</Text>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>AFGESLOTEN</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statWaarde, { color: colors.tekstPrimair }]}>{lopend}</Text>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>LOPEND</Text>
        </View>
      </View>
    </View>
  );
}

const UITKOMST_LABEL: Record<SignaalUitkomst, string> = {
  open: 'Open',
  doel: 'Doel',
  stop: 'Stop',
  verlopen: 'Verlopen',
};

function SignaalRij({ s, index }: { s: GelogdSignaal; index: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const kleur = {
    open: colors.tekstGedimd,
    doel: colors.winst,
    stop: colors.verlies,
    verlopen: colors.letOp,
  }[s.uitkomst];
  const pilAchter = s.uitkomst === 'open' ? colors.verhoogd : kleur + '1F';
  const Icoon = { open: Clock, doel: Check, stop: X, verlopen: Minus }[s.uitkomst];
  const r = s.behaaldeR;
  const datum = s.uitkomstTijd ? `${korteDatum(s.tijd)} → ${korteDatum(s.uitkomstTijd)}` : `sinds ${korteDatum(s.tijd)}`;

  return (
    <Animated.View
      entering={uitklapInGestaffeld(index, reduceMotion)}
      style={styles.rij}
      accessible
      accessibilityLabel={`${s.symbool}, ${s.advies.toLowerCase()}, ${UITKOMST_LABEL[s.uitkomst]}${typeof r === 'number' ? `, ${fmtR(r)}` : ''}`}
    >
      <CoinLogo symbool={s.symbool} grootte={36} />
      <View style={styles.rijMidden}>
        <View style={styles.rijKop}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]} numberOfLines={1}>{s.symbool}</Text>
          <View style={[styles.statusPil, { backgroundColor: pilAchter }]}>
            <Icoon size={11} color={kleur} strokeWidth={2.5} />
            <Text style={[styles.statusTekst, { color: kleur }]}>{UITKOMST_LABEL[s.uitkomst]}</Text>
          </View>
        </View>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]} numberOfLines={1}>
          {datum} · score {s.score}
        </Text>
      </View>
      {typeof r === 'number' && (
        <Text style={[styles.rijR, { color: fmtR(r).startsWith('−') ? colors.verlies : colors.winst }]}>{fmtR(r)}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  scroll: { padding: spacing.base, gap: spacing.lg },
  leegScroll: { padding: spacing.base, gap: spacing.lg, flexGrow: 1 },
  leeg: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  leegTekst: { textAlign: 'center', marginTop: spacing.sm, lineHeight: 24 },
  kaart: { borderRadius: radii.kaart, padding: spacing.base, gap: spacing.md },
  kaartKop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  hero: { fontFamily: Fonts.monoMedium, fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
  pil: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pilTekst: { fontFamily: Fonts.monoMedium, fontSize: 12.5 },
  statRij: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, gap: 4 },
  statWaarde: { fontFamily: Fonts.monoMedium, fontSize: 16 },
  balk: { height: 4, borderRadius: 2, overflow: 'hidden' },
  balkVul: { flex: 1, transformOrigin: 'left' },
  ijkpunt: { borderRadius: radii.knop, paddingHorizontal: spacing.md, paddingVertical: 10, marginTop: -spacing.sm },
  ijkGetal: { fontFamily: Fonts.monoMedium },
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    minHeight: 64,
  },
  rijMidden: { flex: 1, minWidth: 0, gap: 3 },
  rijKop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusPil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusTekst: { fontSize: 11, fontWeight: '600' },
  rijR: { fontFamily: Fonts.monoMedium, fontSize: 14 },
});
