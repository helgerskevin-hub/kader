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
// Hoe lang het vinkje blijft staan voor het weer wijkt voor de bestaande laadstatus. Lang genoeg om
// het tekenen te zien, kort genoeg dat het niet als een aparte stap aanvoelt.
const VINK_ZICHTBAAR_MS = 550;

interface Props {
  label: string;
  omgeving: EtoroOmgeving;
  bezig: boolean;
  uitgeschakeld: boolean;
  onBevestig: () => void;
  // Overschrijft de standaardtekst boven de knop in echt-modus.
  echtWaarschuwing?: string;
}

export function OrderBevestigKnop({ label, omgeving, bezig, uitgeschakeld, onBevestig, echtWaarschuwing }: Props) {
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
  const vinkWekker = useRef<ReturnType<typeof setTimeout> | null>(null);

  const geblokkeerd = uitgeschakeld || bezig;

  // Lopende timers moeten weg als de component verdwijnt, anders vuurt de order af (of verschijnt
  // het vinkje) nadat de sheet al gesloten is.
  useEffect(() => () => {
    if (wekker.current !== null) clearTimeout(wekker.current);
    if (vinkWekker.current !== null) clearTimeout(vinkWekker.current);
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

  function toonVinkje() {
    haptiek('succes');
    setToonVink(true);
    vinkVoortgang.value = 0;
    vinkVoortgang.value = reduceMotion
      ? vervaag(1, duur.kort)
      : withTiming(1, { duration: duur.midden, easing: curve.binnen });
    if (vinkWekker.current !== null) clearTimeout(vinkWekker.current);
    vinkWekker.current = setTimeout(() => {
      vinkWekker.current = null;
      setToonVink(false);
    }, VINK_ZICHTBAAR_MS);
  }

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
      voortgang.value = 0;
      onBevestig();
      toonVinkje();
    }, HOUD_VAST_MS);
  }

  function tik() {
    // In echt doet een losse tik met opzet niets: daar geldt alleen ingedrukt houden.
    if (isEcht || geblokkeerd) return;
    onBevestig();
    toonVinkje();
  }

  const knopKleur = geblokkeerd ? colors.rand : isEcht ? colors.verlies : colors.cta;
  const voorgrondKleur = geblokkeerd ? colors.tekstGedimd : 'white';

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
        {houdtVast && (
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
