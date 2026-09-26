// De enige knop in de app die geld beweegt. Bewust één component voor alle drie de order-sheets,
// zodat kopen, verkopen en niveaus wijzigen zich identiek gedragen en er geen variant ontstaat die
// net iets makkelijker per ongeluk af te vuren is.
//
// In demo is het een gewone tik. In echt is de knop rood, staat er expliciet bij dat het om echt
// geld gaat, en moet je 'm ingedrukt houden: een losse tik doet dan niets.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator, type LayoutChangeEvent } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { curve, duur, vervaag } from '../theme/beweging';
import { useBeweging } from '../theme/useReduceMotion';
import { haptiek, haptiekVanUI } from '../theme/haptiek';
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
  const { colors } = useTheme();
  const { reduceMotion, naar } = useBeweging();
  const isEcht = omgeving === 'real';
  const [houdtVast, setHoudtVast] = useState(false);
  const [toonVink, setToonVink] = useState(false);
  // Vulling van de balk terwijl je vasthoudt: een voortgang van 0 naar 1, getekend met scaleX in
  // plaats van width, zodat de UI-thread 'm kan afhandelen zonder elke frame een layout te
  // herberekenen. transformOrigin is in React Native nog niet overal even betrouwbaar, dus schuift
  // dit 'm terug tot de linkerkant weer op zijn plek staat in plaats van vanuit het midden te laten
  // groeien.
  const voortgang = useSharedValue(0);
  const vinkVoortgang = useSharedValue(0);
  const [knopBreedte, setKnopBreedte] = useState(0);
  const wekker = useRef<ReturnType<typeof setTimeout> | null>(null);

  const geblokkeerd = uitgeschakeld || bezig;
  // De houd-wekker vuurt 800 ms na het indrukken. Komt in die tijd het saldo binnen en past de
  // order niet meer, dan moet hij dat zien: dus de actuele stand, niet die van bij het indrukken.
  const actueel = useRef({ onBevestig, geblokkeerd });
  actueel.current = { onBevestig, geblokkeerd };

  // Een lopende houd-wekker moet weg als de component verdwijnt, anders vuurt de order af nadat de
  // sheet al gesloten is.
  useEffect(() => () => {
    if (wekker.current !== null) clearTimeout(wekker.current);
  }, []);

  // Haptiek loopt mee met het vasthouden: een tik op een derde, iets dat vastklikt op tweederde,
  // en het zwaarste gevoel bij het volledig vasthouden. Dit draait op de UI-thread (de voortgang
  // zelf ook), dus via haptiekVanUI in plaats van de gewone haptiek().
  useAnimatedReaction(
    () => voortgang.value,
    (huidig, vorig) => {
      if (vorig === null) return;
      if (huidig >= 0.33 && vorig < 0.33) haptiekVanUI('tik');
      if (huidig >= 0.66 && vorig < 0.66) haptiekVanUI('vastklikken');
      if (huidig >= 1 && vorig < 1) haptiekVanUI('stevig');
    },
    [],
  );

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

  function stopVasthouden() {
    if (wekker.current !== null) {
      clearTimeout(wekker.current);
      wekker.current = null;
      // Alleen terugveren als het loslaten zelf de order afbrak. Is de wekker al verstreken (order
      // onderweg), dan staat voortgang al op 0 en doet een veer niets.
      voortgang.value = naar(0, 'standaard');
    }
    setHoudtVast(false);
  }

  function startVasthouden() {
    if (geblokkeerd) return;
    setHoudtVast(true);
    // De vulling is de functionele indicator van hoe ver je bent, dus die blijft ook onder Minder
    // beweging gewoon lopen (vandaar reduceMotion: Never); alleen het terugveren bij loslaten
    // verandert daar in een korte fade in plaats van een veer, via naar().
    voortgang.value = withTiming(1, {
      duration: HOUD_VAST_MS,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    });
    wekker.current = setTimeout(() => {
      wekker.current = null;
      setHoudtVast(false);
      if (actueel.current.geblokkeerd) {
        voortgang.value = naar(0, 'standaard');
        return;
      }
      voortgang.value = 0;
      actueel.current.onBevestig();
    }, HOUD_VAST_MS);
  }

  function tik() {
    // In echt doet een losse tik met opzet niets: daar geldt alleen ingedrukt houden.
    if (isEcht || geblokkeerd) return;
    // Bij vasthouden geeft het volle moment al 'stevig'; een tik krijgt zijn eigen, lichtere klik.
    haptiek('vastklikken');
    onBevestig();
  }

  const knopKleur = toonVink ? colors.winst : geblokkeerd ? colors.rand : isEcht ? colors.verlies : colors.cta;
  const voorgrondKleur = toonVink ? 'white' : geblokkeerd ? colors.tekstGedimd : 'white';

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
        <View style={[styles.waarschuwing, { backgroundColor: colors.verlies + '1A' }]}>
          <AlertTriangle size={16} color={colors.verlies} strokeWidth={1.75} />
          <Text style={[Type.caption, { color: colors.verlies, flex: 1, lineHeight: 18 }]}>
            {echtWaarschuwing ?? 'Dit is een echte order met echt geld. Houd de knop ingedrukt om te bevestigen.'}
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
              { width: '100%', backgroundColor: 'rgba(255,255,255,0.28)' },
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
          ? <ActivityIndicator size="small" color="white" />
          : (
            <Text style={[Type.body, { color: voorgrondKleur, fontWeight: '600' }]}>
              {isEcht && !houdtVast ? `${label} (ingedrukt houden)` : label}
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
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.veld,
    marginBottom: spacing.md,
  },
  knop: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
  },
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
