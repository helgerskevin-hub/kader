// De enige knop in de app die geld beweegt. Bewust één component voor alle drie de order-sheets,
// zodat kopen, verkopen en niveaus wijzigen zich identiek gedragen en er geen variant ontstaat die
// net iets makkelijker per ongeluk af te vuren is.
//
// In demo is het een gewone tik. In echt is de knop inktkleurig, staat er een rode regel boven dat
// het om echt geld gaat, en moet je 'm ingedrukt houden: een losse tik doet dan niets.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator, type LayoutChangeEvent } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { curve, duur, vervaag } from '../theme/beweging';
import { useBeweging } from '../theme/useReduceMotion';
import { useVasthouden } from '../theme/useVasthouden';
import { haptiek } from '../theme/haptiek';
import { EtoroOmgeving } from '../engine/etoro';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Lang genoeg dat het een bewuste handeling is, kort genoeg dat het niet gaat irriteren.
const HOUD_VAST_MS = 800;

// Ruim boven de werkelijke lengte van het vinkje-pad (ongeveer 24), zodat bij offset 0 het hele
// pad zeker getekend is.
const VINK_PADLENGTE = 30;
// Hoe lang het vinkje staat voordat de sheet sluit en de bevestiging verschijnt. Het tekenen zelf
// duurt duur.lang; de rest is rust, zodat je het vinkje ook echt ziet staan. De wekker zelf zit in
// useGeluktMoment (in de sheet), niet in deze knop, zodat hij niet met de knop kan verdwijnen.
const VINK_ZICHTBAAR_MS = 1100;

interface Props {
  label: string;
  omgeving: EtoroOmgeving;
  bezig: boolean;
  uitgeschakeld: boolean;
  onBevestig: () => void;
  // Zet de ouder op true zodra eToro de order heeft aangenomen: dan pas tekent het vinkje in, met
  // de succes-haptiek. Een vinkje bij het bevestigen zelf beloofde iets wat nog kon mislukken.
  // Komt uit useGeluktMoment, dat ook bepaalt wanneer de sheet daarna sluit.
  gelukt?: boolean;
  // Overschrijft de standaardtekst boven de knop in echt-modus.
  echtWaarschuwing?: string;
}

export function OrderBevestigKnop({ label, omgeving, bezig, uitgeschakeld, onBevestig, gelukt = false, echtWaarschuwing }: Props) {
  const { colors, donkerActief } = useTheme();
  const { reduceMotion } = useBeweging();
  const isEcht = omgeving === 'real';
  const [toonVink, setToonVink] = useState(false);
  const vinkVoortgang = useSharedValue(0);
  // Vulling van de balk terwijl je vasthoudt: de voortgang van 0 naar 1 uit useVasthouden, getekend
  // met scaleX in plaats van width, zodat de UI-thread 'm kan afhandelen zonder elke frame een
  // layout te herberekenen. transformOrigin is in React Native nog niet overal even betrouwbaar, dus
  // schuift dit 'm terug tot de linkerkant weer op zijn plek staat in plaats van vanuit het midden te
  // laten groeien.
  const [knopBreedte, setKnopBreedte] = useState(0);

  // Ook dicht zodra eToro ja heeft gezegd: het vinkje staat nog even, en een tik of vasthouden in
  // die tijd mag geen tweede order worden.
  const geblokkeerd = uitgeschakeld || bezig || gelukt;
  // De wekker, de haptiek onderweg, het terugveren en de controle op de actuele stand zodra de tijd
  // om is (komt in die 800 ms het saldo binnen en past de order niet meer, dan gaat hij niet) zitten
  // in useVasthouden.
  const { voortgang, start: startVasthouden, stop: stopVasthouden } = useVasthouden({
    duurMs: HOUD_VAST_MS,
    geblokkeerd,
    onVoltooid: onBevestig,
  });

  function opKnopLayout(e: LayoutChangeEvent) {
    setKnopBreedte(e.nativeEvent.layout.width);
  }

  useEffect(() => {
    if (!gelukt) {
      setToonVink(false);
      return;
    }
    haptiek('succes');
    setToonVink(true);
    vinkVoortgang.value = 0;
    vinkVoortgang.value = reduceMotion
      ? vervaag(1, duur.kort)
      : withTiming(1, { duration: duur.lang, easing: curve.binnen });
    // Alleen op gelukt: reduceMotion en de shared value veranderen niet midden in dit moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gelukt]);

  function tik() {
    // In echt doet een losse tik met opzet niets: daar geldt alleen ingedrukt houden.
    if (isEcht || geblokkeerd) return;
    // Bij vasthouden geeft het volle moment al 'stevig'; een tik krijgt zijn eigen, lichtere klik.
    haptiek('vastklikken');
    onBevestig();
  }

  // Echt is inkt op kaart: in donker keert hij om naar een lichte knop met donkere tekst.
  const knopKleur = toonVink || gelukt ? colors.winst : geblokkeerd ? colors.rand : isEcht ? colors.tekstPrimair : colors.cta;
  const voorgrondKleur = toonVink || gelukt ? 'white' : geblokkeerd ? colors.tekstGedimd : isEcht ? colors.kaart : 'white';
  // Op de donkere inktknop (licht thema) vult wit; op de lichte inktknop (donker thema) vult inkt.
  const vulKleur = donkerActief ? 'rgba(14,17,23,0.22)' : 'rgba(255,255,255,0.26)';

  const vulStijl = useAnimatedStyle(() => {
    const s = voortgang.value;
    return {
      transform: [{ translateX: -(knopBreedte / 2) * (1 - s) }, { scaleX: s }],
    };
  });

  // Onder reduce motion tekent het vinkje niet, het faded in: de lijn staat meteen compleet, en
  // alleen de dekking loopt op.
  const vinkContainerStijl = useAnimatedStyle(() => ({
    opacity: reduceMotion ? vinkVoortgang.value : 1,
  }));
  const vinkPadProps = useAnimatedProps(() => ({
    strokeDashoffset: reduceMotion ? 0 : VINK_PADLENGTE * (1 - vinkVoortgang.value),
  }));

  return (
    <View>
      {isEcht && (
        <View style={styles.waarschuwing}>
          <AlertTriangle size={14} color={colors.verlies} strokeWidth={1.75} />
          <Text style={[styles.waarschuwingTekst, { color: colors.verlies }]}>
            {echtWaarschuwing ?? 'Echt geld. Houd de knop vast om te bevestigen.'}
          </Text>
        </View>
      )}

      <Pressable
        onPress={tik}
        onPressIn={isEcht ? startVasthouden : undefined}
        onPressOut={isEcht ? stopVasthouden : undefined}
        onLayout={opKnopLayout}
        disabled={geblokkeerd}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={isEcht ? 'Houd ingedrukt om deze echte order te bevestigen' : 'Tik om te bevestigen'}
        accessibilityState={{ disabled: geblokkeerd, busy: bezig }}
        style={[styles.knop, { backgroundColor: knopKleur }]}
      >
        {/* Vulbalk die meeloopt met het ingedrukt houden, zodat je ziet dat er iets gebeurt. */}
        {/* Blijft staan na loslaten, zodat je 'm ook ziet terugveren; bij voortgang 0 is hij onzichtbaar. */}
        {isEcht && !toonVink && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              vulStijl,
              { width: '100%', backgroundColor: vulKleur },
            ]}
          />
        )}
        {toonVink ? (
          <Animated.View style={vinkContainerStijl}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <AnimatedPath
                d="M4 12.5L9.5 18L20 6"
                stroke={voorgrondKleur}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray={VINK_PADLENGTE}
                animatedProps={vinkPadProps}
              />
            </Svg>
          </Animated.View>
        ) : bezig
          ? <ActivityIndicator size="small" color={voorgrondKleur} />
          : (
            <Text numberOfLines={2} style={[Type.body, styles.label, { color: voorgrondKleur }]}>
              {label}
            </Text>
          )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  waarschuwing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  waarschuwingTekst: {
    flexShrink: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  knop: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    overflow: 'hidden',
  },
  label: { fontWeight: '600', textAlign: 'center' },
});

// Het gelukt-moment voor een sheet met deze knop. vier() krijgt wat er na het vinkje moet gebeuren
// (sheet sluiten, bevestiging tonen) en voert dat uit zodra het vinkje heeft gestaan. De bevestiging
// mag nooit wegvallen: sluit de gebruiker de sheet tijdens het vinkje, dan gebeurt het meteen, en is
// de sheet al weg voordat eToro antwoordt (dicht getikt terwijl de order onderweg was), dan ook. Wie
// geen bevestiging ziet, denkt dat de order mislukte en plaatst 'm nog een keer.
export function useGeluktMoment(onSluiten: () => void) {
  const [gelukt, setGelukt] = useState(false);
  const daarna = useRef<(() => void) | null>(null);
  const wekker = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gemount = useRef(false);

  function stopWekker() {
    if (wekker.current !== null) clearTimeout(wekker.current);
    wekker.current = null;
  }

  function rondAf() {
    stopWekker();
    const f = daarna.current;
    daarna.current = null;
    f?.();
  }

  // Verdwijnt de sheet midden in het vinkje (de ouder unmount 'm om een andere reden), dan alsnog
  // afronden in plaats van de bevestiging mee te nemen. Via een ref, zodat de opruiming de actuele
  // rondAf ziet en niet die van de eerste render.
  const rondAfRef = useRef(rondAf);
  rondAfRef.current = rondAf;
  useEffect(() => {
    gemount.current = true;
    return () => {
      gemount.current = false;
      rondAfRef.current();
    };
  }, []);

  function vier(naVinkje: () => void) {
    if (!gemount.current) {
      naVinkje();
      return;
    }
    daarna.current = naVinkje;
    setGelukt(true);
    stopWekker();
    wekker.current = setTimeout(rondAf, VINK_ZICHTBAAR_MS);
  }

  function sluit() {
    if (daarna.current) rondAf();
    else onSluiten();
  }

  // Terug naar begin (sheet opnieuw geopend). Staat er nog een bevestiging klaar, dan eerst die:
  // weggooien zou de order stil laten verdwijnen.
  function wis() {
    if (daarna.current) rondAf();
    setGelukt(false);
  }

  return { gelukt, vier, sluit, wis };
}
