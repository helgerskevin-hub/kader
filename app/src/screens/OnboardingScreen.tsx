import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, Target, Users, Shield, ArrowRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { KaderLogo } from '../components/KaderLogo';
import { useReduceMotion } from '../theme/useReduceMotion';
import { duur, vervaag } from '../theme/beweging';

interface Stap {
  Icon?: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  isWelkom?: boolean;
  titel: string;
  body: string;
}

const STAPPEN: Stap[] = [
  {
    isWelkom: true,
    titel: 'Welkom bij Kader',
    body: 'Structuur in crypto. Analyseer de markt met technische indicatoren en ontdek kansrijke trades met duidelijke stop-loss en take-profit niveaus.',
  },
  {
    Icon: TrendingUp as React.ComponentType<{ size: number; color: string; strokeWidth?: number }>,
    titel: 'Hoe werkt\nde analyse?',
    body: 'De app scant de markt met RSI, voortschrijdende gemiddelden (EMA) en ATR. Coins met score ≥ 75 zijn "high conviction", meerdere indicatoren wijzen tegelijk op een kans. Werkt het marktklimaat niet mee, dan toont Kader bewust geen koopsignalen, ook niet bij een hoge score.',
  },
  {
    Icon: Target as React.ComponentType<{ size: number; color: string; strokeWidth?: number }>,
    titel: 'Stop, entry\nen doel',
    body: 'Bij elk signaal zie je drie niveaus:\n\n· Stop-loss: net onder de recente steun, begrensd tussen 0,5 en 3 keer de ATR\n· Entry: instapprijs\n· Doel: take-profit (3× ATR)\n\nDe risk/reward is altijd minimaal 1:2.',
  },
  {
    Icon: Users as React.ComponentType<{ size: number; color: string; strokeWidth?: number }>,
    titel: 'eToro-trader\nbeoordelen',
    body: 'Kopieer je een Popular Investor? Vul zijn statistieken in op het Traders-tabblad en krijg een GROEN/GEEL/ROOD oordeel met een aanbevolen Copy Stop Loss percentage.',
  },
  {
    Icon: Shield as React.ComponentType<{ size: number; color: string; strokeWidth?: number }>,
    titel: 'Disclaimer',
    body: 'Deze app geeft technische signalen op basis van historische koersdata, geen financieel advies.\n\nControleer altijd de live koers op eToro vóór je een trade plaatst.',
  },
];

const LAATSTE_STAP = STAPPEN.length - 1;

interface Props {
  onKlaar: () => void;
}

export function OnboardingScreen({ onKlaar }: Props) {
  const { colors } = useTheme();
  const { width: breedte } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [actieveStap, setActieveStap] = useState(0);
  const isLaatsteStap = actieveStap === LAATSTE_STAP;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: e => {
      scrollX.value = e.contentOffset.x;
    },
    onMomentumEnd: e => {
      const index = Math.round(e.contentOffset.x / breedte);
      scheduleOnRN(setActieveStap, Math.min(LAATSTE_STAP, Math.max(0, index)));
    },
  });

  // Bij een tik op Vorige/Volgende schuift de pager mee, net als bij een veeg. Onder Minder
  // beweging springt hij meteen: dat is de enige plek waar dit scherm zelf besluit iets niet te
  // laten glijden, de rest is vingerbeweging en blijft dus wel bewegen.
  // Via de gewone ScrollView-methode: Reanimated's scrollTo doet vanaf de JS-thread stil niets, en
  // dan bleven de pagina's staan terwijl de knop al "Begin" zei (en de disclaimer oversloeg).
  function gaNaarStap(index: number) {
    scrollRef.current?.scrollTo({ x: index * breedte, animated: !reduceMotion });
    setActieveStap(index);
  }

  function volgende() {
    if (isLaatsteStap) {
      onKlaar();
    } else {
      gaNaarStap(actieveStap + 1);
    }
  }

  function vorige() {
    if (actieveStap > 0) gaNaarStap(actieveStap - 1);
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.achtergrond }]}>
      {/* Sla over */}
      <View style={styles.titelBalk}>
        <View />
        {!isLaatsteStap && (
          <Pressable
            onPress={onKlaar}
            accessibilityRole="button"
            accessibilityLabel="Sla onboarding over"
            style={styles.slaOverKnop}
          >
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Sla over</Text>
          </Pressable>
        )}
      </View>

      {/* Stap-indicator: de pil rekt en verschuift mee met de vinger, en morpht niet als hij
          gewoon zou moeten fade. Bij Minder beweging wisselt hij pas als de pagina echt geland is. */}
      <View style={styles.dots}>
        {STAPPEN.map((_, i) => (
          <OnboardingStip
            key={i}
            index={i}
            breedte={breedte}
            scrollX={scrollX}
            actief={i === actieveStap}
            reduceMotion={reduceMotion}
            kleurAan={colors.cta}
            kleurUit={colors.rand}
          />
        ))}
      </View>

      {/* Inhoud: een pagina per stap, naast elkaar. De vinger bepaalt het tempo, hier wordt niets
          geprogrammeerd geanimeerd behalve de knoppen hierboven/onder. */}
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {STAPPEN.map((stap, i) => (
          <OnboardingPagina
            key={i}
            index={i}
            breedte={breedte}
            scrollX={scrollX}
            reduceMotion={reduceMotion}
            stap={stap}
          />
        ))}
      </Animated.ScrollView>

      {/* Navigatie */}
      <View style={styles.navigatie}>
        {actieveStap > 0 ? (
          <Pressable
            style={[styles.vorigeKnop, { borderColor: colors.rand }]}
            onPress={vorige}
            accessibilityRole="button"
            accessibilityLabel="Vorige stap"
          >
            <Text style={[Type.body, { color: colors.tekstGedimd }]}>Vorige</Text>
          </Pressable>
        ) : (
          <View />
        )}

        <Pressable
          style={[
            styles.volgendKnop,
            { backgroundColor: isLaatsteStap ? colors.winst : colors.cta },
          ]}
          onPress={volgende}
          accessibilityRole="button"
          accessibilityLabel={isLaatsteStap ? 'Begin met de app' : 'Volgende stap'}
        >
          <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>
            {isLaatsteStap ? 'Begin' : 'Volgende'}
          </Text>
          <ArrowRight size={16} color="white" strokeWidth={2} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface StipProps {
  index: number;
  breedte: number;
  scrollX: SharedValue<number>;
  actief: boolean;
  reduceMotion: boolean;
  kleurAan: string;
  kleurUit: string;
}

// Rekt en kleurt mee met de scrollpositie (Apple-stijl), tenzij Minder beweging aanstaat: dan
// wisselt hij pas als `actief` echt verandert, met een korte fade in plaats van een doorlopende
// morph tijdens het slepen.
function OnboardingStip({ index, breedte, scrollX, actief, reduceMotion, kleurAan, kleurUit }: StipProps) {
  const fade = useSharedValue(actief ? 1 : 0);

  useEffect(() => {
    if (!reduceMotion) return;
    fade.value = vervaag(actief ? 1 : 0, duur.kort);
  }, [actief, reduceMotion, fade]);

  const stijl = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {
        width: 8 + 12 * fade.value,
        backgroundColor: interpolateColor(fade.value, [0, 1], [kleurUit, kleurAan]),
      };
    }
    const bereik = [(index - 1) * breedte, index * breedte, (index + 1) * breedte];
    const t = interpolate(scrollX.value, bereik, [0, 1, 0], Extrapolation.CLAMP);
    return {
      width: 8 + 12 * t,
      backgroundColor: interpolateColor(t, [0, 1], [kleurUit, kleurAan]),
    };
  });

  return <Animated.View style={[styles.dot, stijl]} />;
}

interface PaginaProps {
  index: number;
  breedte: number;
  scrollX: SharedValue<number>;
  reduceMotion: boolean;
  stap: Stap;
}

// Eén stap. De illustratie (logo of icoon) hangt in zijn eigen laag: die krijgt bovenop de
// gewone scrollverplaatsing nog een tegengestelde duw mee, zodat hij maar op ongeveer halve
// snelheid van de tekst meekomt. Onder Minder beweging blijft die laag stilstaan.
function OnboardingPagina({ index, breedte, scrollX, reduceMotion, stap }: PaginaProps) {
  const { colors } = useTheme();

  const illustratieStijl = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ translateX: 0 }] };
    const bereik = [(index - 1) * breedte, index * breedte, (index + 1) * breedte];
    const translateX = interpolate(scrollX.value, bereik, [breedte * 0.5, 0, -breedte * 0.5], Extrapolation.CLAMP);
    return { transform: [{ translateX }] };
  });

  return (
    <View style={{ width: breedte }}>
      <View style={styles.inhoud}>
        {stap.isWelkom ? (
          <>
            <Animated.View style={[styles.logoContainer, illustratieStijl]}>
              <KaderLogo size={80} />
            </Animated.View>
            <Text style={[Type.display, styles.titel, { color: colors.tekstPrimair }]}>
              Welkom bij Kader
            </Text>
            <Text style={[Type.sectiekop, styles.slogan, { color: colors.primair }]}>
              Structuur in crypto.
            </Text>
            <Text style={[Type.body, styles.body, { color: colors.tekstGedimd }]}>
              {stap.body}
            </Text>
          </>
        ) : (
          <>
            <Animated.View
              style={[styles.iconContainer, { backgroundColor: colors.verhoogd }, illustratieStijl]}
            >
              {stap.Icon && <stap.Icon size={36} color={colors.cta} strokeWidth={1.5} />}
            </Animated.View>
            <Text style={[Type.display, styles.titel, { color: colors.tekstPrimair }]}>
              {stap.titel}
            </Text>
            <Text style={[Type.body, styles.body, { color: colors.tekstGedimd }]}>
              {stap.body}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titelBalk: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  slaOverKnop: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: radii.pill,
  },
  pager: {
    flex: 1,
  },
  inhoud: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  titel: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  slogan: {
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  body: {
    textAlign: 'center',
    lineHeight: 26,
  },
  navigatie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
    paddingTop: spacing.base,
  },
  vorigeKnop: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    borderWidth: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volgendKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    minHeight: 44,
  },
});
