import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  ReduceMotion,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  ChartPie,
  ChartSpline,
  Eye,
  Share,
  ShieldCheck,
  Smartphone,
  Target,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useBeweging } from '../theme/useReduceMotion';
import { curve, duur, staggerVertraging } from '../theme/beweging';
import { haptiek } from '../theme/haptiek';
import { Fonts, Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import type { NieuweFeature } from '../changelog';
import { PodiumScherm } from './PodiumScherm';
import { PilKnop } from './PilKnop';

// Het scherm dat na een update laat zien wat er nieuw is: per feature een pagina met een icoon dat
// op een veer binnenkomt (elk met een kleine eigen beweging), daaronder titel, uitleg en de plek
// waar je het vindt, die gestaffeld invallen. De inhoud komt uit CHANGELOG[0].nieuweFeatures.
// Veegbaar of met de knop Volgende; de indicator onderaan glijdt mee met je vinger.

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  features: NieuweFeature[];
}

const ICONEN: Record<NieuweFeature['icoon'], LucideIcon> = {
  risico: ShieldCheck,
  doel: Target,
  kansen: Eye,
  benchmark: ChartSpline,
  spreiding: ChartPie,
  export: Share,
  widget: Smartphone,
};

// Waar het icoon vandaan komt, zodat elke feature een eigen beweging heeft: het schild klikt vast,
// het doel draait in zijn plek, het oog gaat open, de lijn schuift van links, de taart draait,
// het deelicoon stijgt op en de widget kantelt recht.
interface Start {
  schaal: number;
  rot: number; // graden
  x: number;
  y: number;
  schaalY?: number;
}
const START: Record<NieuweFeature['icoon'], Start> = {
  risico: { schaal: 0.5, rot: -14, x: 0, y: 0 },
  doel: { schaal: 0.3, rot: -120, x: 0, y: 0 },
  kansen: { schaal: 0.8, rot: 0, x: 0, y: 0, schaalY: 0.08 },
  benchmark: { schaal: 0.7, rot: 0, x: -26, y: 8 },
  spreiding: { schaal: 0.6, rot: 140, x: 0, y: 0 },
  export: { schaal: 0.8, rot: 0, x: 0, y: 30 },
  widget: { schaal: 0.55, rot: 12, x: 0, y: 10 },
};

const TEGEL = 112;
const ICOON = 48;
// De ring achter de tegel die één keer uitwaaiert als het icoon landt.
const RING_SCHAAL = 1.55;
// De modal moet eerst open zijn voor de eerste pagina begint, anders mis je het begin.
const EERSTE_VERTRAGING = 320;
const SLOT = 18;

export function NieuwInKaderScherm({ zichtbaar, onSluiten, features }: Props) {
  // Elke keer dat het scherm opent beginnen we met verse staat, ook als de modal zijn kinderen
  // tussendoor bewaart.
  const openTeller = useRef(0);
  const vorigZichtbaar = useRef(false);
  if (zichtbaar && !vorigZichtbaar.current) openTeller.current += 1;
  vorigZichtbaar.current = zichtbaar;

  if (features.length === 0) return null;

  return (
    <PodiumScherm zichtbaar={zichtbaar} onSluiten={onSluiten}>
      {sluit => <Inhoud key={openTeller.current} features={features} onKlaar={() => sluit()} />}
    </PodiumScherm>
  );
}

function Inhoud({ features, onKlaar }: { features: NieuweFeature[]; onKlaar: () => void }) {
  const { colors } = useTheme();
  const { reduceMotion } = useBeweging();
  const { width: schermBreedte } = useWindowDimensions();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const [breedte, setBreedte] = useState(schermBreedte);
  const [actief, setActief] = useState(0);
  const laatste = useRef(0);

  const scrollX = useSharedValue(0);
  const breedteSV = useSharedValue(schermBreedte);

  const aantal = features.length;
  const isLaatste = actief === aantal - 1;

  const opPagina = useCallback((pagina: number) => {
    if (pagina === laatste.current || pagina < 0 || pagina >= aantal) return;
    laatste.current = pagina;
    setActief(pagina);
    haptiek('tik');
  }, [aantal]);

  const onScroll = useAnimatedScrollHandler(e => {
    scrollX.value = e.contentOffset.x;
  });

  // De pagina wordt actief zodra hij voor meer dan de helft in beeld is, zodat zijn animatie al
  // loopt terwijl de vinger nog veegt.
  useAnimatedReaction(
    () => (breedteSV.value > 0 ? Math.round(scrollX.value / breedteSV.value) : 0),
    (index, vorige) => {
      if (index !== vorige) scheduleOnRN(opPagina, index);
    },
  );

  function opLayout(e: LayoutChangeEvent) {
    const b = e.nativeEvent.layout.width;
    if (b > 0 && b !== breedte) {
      setBreedte(b);
      breedteSV.value = b;
    }
  }

  function volgende() {
    if (isLaatste) {
      haptiek('vastklikken');
      onKlaar();
      return;
    }
    scrollRef.current?.scrollTo({ x: (actief + 1) * breedte, animated: !reduceMotion });
  }

  // De glijdende pil: loopt met de scrollpositie mee en rekt even uit tussen twee pagina's.
  const pilStijl = useAnimatedStyle(() => {
    const b = breedteSV.value || 1;
    const voortgang = scrollX.value / b;
    const frac = voortgang - Math.floor(voortgang);
    const rek = 1 + 0.7 * Math.sin(Math.PI * frac);
    return {
      transform: [{ translateX: voortgang * SLOT + (SLOT - 18) / 2 }, { scaleX: rek }],
    };
  });

  const skipStijl = useAnimatedStyle(() => ({
    opacity: withTiming(isLaatste ? 0 : 1, { duration: duur.midden, easing: curve.fade, reduceMotion: ReduceMotion.Never }),
  }), [isLaatste]);

  return (
    <View style={[styles.root, { backgroundColor: colors.achtergrond }]} onLayout={opLayout}>
      <View style={styles.kop}>
        <Text accessibilityRole="header" style={[Type.overline, { color: colors.cta }]}>NIEUW IN KADER</Text>
        <Animated.View style={skipStijl} pointerEvents={isLaatste ? 'none' : 'auto'}>
          <Pressable
            onPress={onKlaar}
            accessibilityRole="button"
            accessibilityLabel="Sla de rondleiding over"
            style={styles.skip}
            hitSlop={8}
          >
            <Text style={[Type.body, styles.skipTekst, { color: colors.tekstGedimd }]}>Sla over</Text>
          </Pressable>
        </Animated.View>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
        overScrollMode="never"
        style={styles.pager}
        accessibilityLabel={`Pagina ${actief + 1} van ${aantal}`}
      >
        {features.map((f, i) => (
          <Pagina
            key={f.titel}
            feature={f}
            breedte={breedte}
            actief={i === actief}
            startVertraging={i === 0 ? EERSTE_VERTRAGING : 0}
          />
        ))}
      </Animated.ScrollView>

      <View style={styles.voet}>
        <View
          style={[styles.indicator, { width: aantal * SLOT }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Stap ${actief + 1} van ${aantal}`}
        >
          {features.map(f => (
            <View key={f.titel} style={styles.slot}>
              <View style={[styles.stip, { backgroundColor: colors.rand }]} />
            </View>
          ))}
          <Animated.View style={[styles.pil, { backgroundColor: colors.cta }, pilStijl]} />
        </View>
        <PilKnop
          label={isLaatste ? 'Aan de slag' : 'Volgende'}
          variant="cta"
          onPress={volgende}
        />
      </View>
    </View>
  );
}

function Pagina({
  feature, breedte, actief, startVertraging,
}: { feature: NieuweFeature; breedte: number; actief: boolean; startVertraging: number }) {
  const { colors } = useTheme();
  const { reduceMotion, naar } = useBeweging();
  const kleur = colors[feature.kleur];
  const Icoon = ICONEN[feature.icoon];
  const start = START[feature.icoon];

  // 0 = nog niet getoond, 1 = klaar. Eén waarde per onderdeel, zodat ze los van elkaar gestaffeld
  // kunnen landen.
  const icoonP = useSharedValue(0);
  const ringP = useSharedValue(0);
  const titelP = useSharedValue(0);
  const tekstP = useSharedValue(0);
  const plekP = useSharedValue(0);

  useEffect(() => {
    if (!actief) return;
    icoonP.value = 0;
    ringP.value = 0;
    titelP.value = 0;
    tekstP.value = 0;
    plekP.value = 0;
    if (reduceMotion) {
      // Apple-gedrag bij Minder beweging: alleen een korte cross-fade, geen schaal of glijden.
      const fade = (d: number) =>
        withDelay(d, withTiming(1, { duration: duur.midden, easing: curve.fade, reduceMotion: ReduceMotion.Never }));
      icoonP.value = fade(startVertraging);
      titelP.value = fade(startVertraging);
      tekstP.value = fade(startVertraging);
      plekP.value = fade(startVertraging);
      ringP.value = 1;
      return;
    }
    icoonP.value = withDelay(startVertraging, naar(1, 'speels'));
    ringP.value = withDelay(
      startVertraging + 140,
      withTiming(1, { duration: 700, easing: curve.binnen }),
    );
    titelP.value = withDelay(startVertraging + 120 + staggerVertraging(1) * 2, naar(1, 'standaard'));
    tekstP.value = withDelay(startVertraging + 120 + staggerVertraging(2) * 2, naar(1, 'standaard'));
    plekP.value = withDelay(startVertraging + 120 + staggerVertraging(3) * 2, naar(1, 'standaard'));
    // naar en de waarden zijn stabiel genoeg; opnieuw spelen gebeurt alleen bij wisselen van pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actief]);

  const tegelStijl = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: icoonP.value };
    const p = icoonP.value;
    return {
      opacity: interpolate(p, [0, 0.25], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, [0, 1], [start.x, 0]) },
        { translateY: interpolate(p, [0, 1], [start.y, 0]) },
        { rotate: `${interpolate(p, [0, 1], [start.rot, 0])}deg` },
        { scale: interpolate(p, [0, 1], [start.schaal, 1]) },
      ],
    };
  });

  // Het oog gaat open: alleen het icoon schaalt in hoogte, de tegel blijft staan.
  const icoonStijl = useAnimatedStyle(() => {
    if (reduceMotion || start.schaalY === undefined) return {};
    return { transform: [{ scaleY: interpolate(icoonP.value, [0, 1], [start.schaalY, 1]) }] };
  });

  const ringStijl = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : interpolate(ringP.value, [0, 0.15, 1], [0, 0.45, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(ringP.value, [0, 1], [1, RING_SCHAAL]) }],
  }));

  const intrede = (p: { value: number }) => () => {
    'worklet';
    return {
      opacity: interpolate(p.value, [0, 1], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: reduceMotion ? 0 : interpolate(p.value, [0, 1], [14, 0]) }],
    };
  };
  const titelStijl = useAnimatedStyle(intrede(titelP));
  const tekstStijl = useAnimatedStyle(intrede(tekstP));
  const plekStijl = useAnimatedStyle(intrede(plekP));

  return (
    <View style={[styles.pagina, { width: breedte }]} accessible={false}>
      <View style={styles.tegelWrap}>
        <Animated.View
          style={[styles.ring, { borderColor: kleur }, ringStijl]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
        />
        <Animated.View
          style={[styles.tegel, { backgroundColor: `${kleur}1F` }, tegelStijl]}
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View style={icoonStijl}>
            <Icoon size={ICOON} color={kleur} strokeWidth={1.5} />
          </Animated.View>
        </Animated.View>
      </View>

      <Animated.Text accessibilityRole="header" style={[styles.titel, { color: colors.tekstPrimair }, titelStijl]}>
        {feature.titel}
      </Animated.Text>
      <Animated.Text style={[Type.body, styles.tekst, { color: colors.tekstGedimd }, tekstStijl]}>
        {feature.tekst}
      </Animated.Text>
      <Animated.View style={[styles.plek, { backgroundColor: colors.verhoogd }, plekStijl]}>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
          Te vinden: <Text style={{ color: colors.tekstPrimair, fontFamily: Fonts.sansSemiBold }}>{feature.plek}</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    minHeight: 52,
  },
  skip: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipTekst: { fontFamily: Fonts.sansMedium },
  pager: { flex: 1 },
  pagina: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  tegelWrap: {
    width: TEGEL,
    height: TEGEL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  tegel: {
    width: TEGEL,
    height: TEGEL,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: TEGEL,
    height: TEGEL,
    borderRadius: 34,
    borderWidth: 1.5,
  },
  titel: {
    ...Type.display,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  tekst: { textAlign: 'center', maxWidth: 340, marginBottom: spacing.lg },
  plek: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  voet: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
    gap: spacing.lg,
  },
  indicator: { height: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center' },
  slot: { width: SLOT, alignItems: 'center', justifyContent: 'center' },
  stip: { width: 6, height: 6, borderRadius: 3 },
  pil: { position: 'absolute', left: 0, width: 18, height: 6, borderRadius: 3 },
});
