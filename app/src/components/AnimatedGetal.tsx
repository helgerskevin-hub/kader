import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type TextLayoutEvent, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { duur, vervaag } from '../theme/beweging';
import { useBeweging, useReduceMotion } from '../theme/useReduceMotion';

// Eén keer gebouwd: een nieuwe builder per render laat Reanimated de overgang telkens opnieuw
// registreren, en dit getal tekent bij elke koersupdate opnieuw.
const TEKEN_IN = FadeIn.duration(duur.kort);
const TEKEN_UIT = FadeOut.duration(duur.kort);

const CIJFERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const CIJFER_POSITIES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

interface KleurBijTeken {
  positief: string;
  negatief: string;
  // Zonder eigen neutraal valt hij terug op positief: een derde kleur eisen voor het zeldzame
  // geval van precies 0 is meer moeite dan het waard is.
  neutraal?: string;
}

interface Props {
  waarde: number;
  format: (n: number) => string;
  style?: StyleProp<TextStyle>;
  // Laat de tekstkleur vloeiend meebewegen met het teken van de waarde (winst/verlies), in plaats
  // van in één klap om te slaan zodra het cijfer door nul heen beweegt. Zonder deze prop bepaalt de
  // aanroeper de kleur zelf via `style`, zoals voorheen: de bestaande aanroepen blijven dus werken.
  kleurBijTeken?: KleurBijTeken;
}

interface Slot {
  key: string;
  isCijfer: boolean;
  teken: string;
  cijfer: number;
}

function naarSlots(tekst: string): Slot[] {
  const n = tekst.length;
  const slots: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const teken = tekst[i];
    const vanRechts = n - 1 - i;
    const isCijfer = teken >= '0' && teken <= '9';
    slots.push({
      // Cijferkolommen houden hun identiteit vast op hun afstand tot de rechterkant: zo rolt "12"
      // gewoon door naar "13", en schuift een nieuw cijfer aan de linkerkant (99 -> 100) naar
      // binnen in plaats van dat de hele rij opnieuw opgebouwd wordt. Niet-cijfers (symbolen,
      // scheidingstekens) krijgen hun waarde wél in de key: verandert die (bijv. + wordt -), dan
      // mag React 'm gewoon vervangen, en dat vervangen is meteen de cross-fade.
      key: isCijfer ? `c${vanRechts}` : `s${vanRechts}-${teken}`,
      isCijfer,
      teken,
      cijfer: isCijfer ? Number(teken) : 0,
    });
  }
  return slots;
}

// Rolt bij elke wijziging soepel naar een nieuwe waarde, zoals de koersen in Apple's Stocks-app:
// elke cijferkolom rolt verticaal naar zijn nieuwe stand. Bij mount blijft de waarde direct staan
// (geen optelanimatie bij openen); pas een verandering daarna rolt. Respecteert reduce motion met
// een korte cross-fade in plaats van rollen.
export function AnimatedGetal({ waarde, format, style, kleurBijTeken }: Props) {
  const reduceMotion = useReduceMotion();
  const { naar } = useBeweging();

  const gevlakt = useMemo(() => (StyleSheet.flatten(style) ?? {}) as TextStyle, [style]);
  // Marges horen bij het getal als geheel, niet bij elk teken. Kwamen ze mee in de tekststijl, dan
  // kreeg elk los cijfer en elk los teken zijn eigen marginLeft: het percentage viel daardoor uit
  // elkaar en de cijfers schoven half buiten hun kolom.
  const { buitenStijl, tekstStijl } = useMemo(() => {
    const buiten: TextStyle = {};
    const tekst: TextStyle = {};
    for (const [sleutel, waardeVanStijl] of Object.entries(gevlakt)) {
      const doel = sleutel.startsWith('margin') ? buiten : tekst;
      (doel as Record<string, unknown>)[sleutel] = waardeVanStijl;
    }
    return { buitenStijl: buiten, tekstStijl: tekst };
  }, [gevlakt]);
  // Zonder kleurBijTeken blijft de kleur van de aanroeper gewoon in de stijl staan. Mét
  // kleurBijTeken wordt de kleur straks door interpolateColor geleverd, dus dan mag de statische
  // kleur niet meer meekomen (die zou de animatie overschrijven).
  const cijferStijl = useMemo<TextStyle>(() => {
    if (!kleurBijTeken) return tekstStijl;
    const { color, ...rest } = tekstStijl;
    return rest;
  }, [tekstStijl, kleurBijTeken]);

  const geformatteerd = format(waarde);

  // Kleur: vloeit over duur.lang mee met het teken van de waarde. vervaag() forceert
  // ReduceMotion.Never, want dit is een kleur, geen beweging, en die mag onder Minder beweging
  // gewoon blijven vloeien.
  const teken = waarde > 0 ? 1 : waarde < 0 ? -1 : 0;
  const tekenWaarde = useSharedValue(teken);
  const eersteTeken = useRef(true);
  useEffect(() => {
    if (!kleurBijTeken) return;
    if (eersteTeken.current) {
      eersteTeken.current = false;
      tekenWaarde.value = teken;
      return;
    }
    tekenWaarde.value = vervaag(teken, duur.lang);
    // kleurBijTeken zelf is geen afhankelijkheid: het is bij elke render een nieuw object-literal
    // van de aanroeper, en alleen een echte tekenwisseling hoort deze animatie te starten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teken]);

  const kleurStijl = useAnimatedStyle(() => {
    if (!kleurBijTeken) return {};
    const neutraal = kleurBijTeken.neutraal ?? kleurBijTeken.positief;
    return {
      color: interpolateColor(
        tekenWaarde.value,
        [-1, 0, 1],
        [kleurBijTeken.negatief, neutraal, kleurBijTeken.positief],
      ),
    };
  });

  // Per cijfer de breedte meten in dit lettertype en deze grootte, via onzichtbare exemplaren.
  // Bewust de eigen breedte van elk cijfer en geen vaste kolombreedte met tabular figures: dan
  // staat het getal in rust precies zoals gewone tekst, met dezelfde afstand als voorheen. Tijdens
  // een rol vloeit de kolombreedte mee van het oude naar het nieuwe cijfer.
  const [afmeting, setAfmeting] = useState<Afmeting | null>(null);
  const metingSleutel = `${cijferStijl.fontFamily ?? ''}|${cijferStijl.fontSize ?? ''}|${cijferStijl.fontWeight ?? ''}|${cijferStijl.lineHeight ?? ''}|${String(cijferStijl.fontVariant ?? '')}|${cijferStijl.letterSpacing ?? ''}`;
  const metingen = useRef<{ sleutel: string; breedtes: (number | undefined)[]; hoogte?: number }>({
    sleutel: metingSleutel,
    breedtes: [],
  });

  function meting() {
    if (metingen.current.sleutel !== metingSleutel) {
      metingen.current = { sleutel: metingSleutel, breedtes: [] };
    }
    return metingen.current;
  }

  function probeerAf() {
    const m = meting();
    if (m.hoogte === undefined || !CIJFERS.every((_, i) => m.breedtes[i] !== undefined)) return;
    const breedtes = [...m.breedtes] as number[];
    setAfmeting({ breedtes, maxBreedte: Math.max(...breedtes), hoogte: m.hoogte });
  }

  // Breedte via onTextLayout: die geeft de regelbreedte als kommagetal, onLayout rondt op hele
  // pixels af en dat telt over een heel bedrag merkbaar op.
  function opBreedte(cijfer: number, e: TextLayoutEvent) {
    const regel = e.nativeEvent.lines[0];
    if (!regel) return;
    meting().breedtes[cijfer] = regel.width;
    probeerAf();
  }

  // Hoogte via onLayout, zoals voorheen: dat is de hoogte die de tekst in de layout echt inneemt,
  // inclusief de font-padding die Android erbij rekent.
  function opHoogte(e: LayoutChangeEvent) {
    meting().hoogte = e.nativeEvent.layout.height;
    probeerAf();
  }

  const slots = useMemo(() => naarSlots(geformatteerd), [geformatteerd]);
  const kanRollen = !reduceMotion && afmeting !== null;

  // Onder reduce motion: geen rollen, gewoon de waarde direct tonen met een korte cross-fade
  // wanneer hij verandert. vervaag() speelt bewust wel af onder Minder beweging: dat is precies
  // het Apple-alternatief voor een rol of een veer.
  const fadeOpacity = useSharedValue(1);
  const vorigeTekst = useRef(geformatteerd);
  useEffect(() => {
    if (!reduceMotion) return;
    if (vorigeTekst.current === geformatteerd) return;
    vorigeTekst.current = geformatteerd;
    fadeOpacity.value = 0;
    fadeOpacity.value = vervaag(1, duur.kort);
  }, [geformatteerd, reduceMotion]);
  const fadeStijl = useAnimatedStyle(() => ({ opacity: fadeOpacity.value }));

  return (
    <View style={buitenStijl}>
      {/* Onzichtbare meters: zelfde stijl als de echte cijfers, buiten beeld geplaatst zodat ze de
          layout niet raken. */}
      {CIJFERS.map((c, i) => (
        <Text
          key={`${metingSleutel}-${c}`}
          style={[cijferStijl, styles.meter]}
          onTextLayout={e => opBreedte(i, e)}
          onLayout={i === 0 ? opHoogte : undefined}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {c}
        </Text>
      ))}

      {reduceMotion ? (
        <Animated.Text style={[cijferStijl, kleurStijl, fadeStijl]}>{geformatteerd}</Animated.Text>
      ) : !kanRollen ? (
        // Nog niet gemeten (alleen de eerste frame(s) na mount): gewone tekst, geen rol. Dit is
        // meteen ook waarom er bij mount niets rolt, zoals Apple's Stocks-app dat ook niet doet.
        <Animated.Text style={[cijferStijl, kleurStijl]}>{geformatteerd}</Animated.Text>
      ) : (
        // Eén geheel voor TalkBack: anders leest hij per cijferkolom alle tien cijfers 0 tot 9 voor.
        <View style={styles.rij} accessible accessibilityLabel={geformatteerd}>
          {slots.map(slot =>
            slot.isCijfer ? (
              <RollendCijfer
                key={slot.key}
                cijfer={slot.cijfer}
                afmeting={afmeting!}
                stijl={cijferStijl}
                kleurStijl={kleurStijl}
                naar={naar}
              />
            ) : (
              <Animated.View
                key={slot.key}
                entering={TEKEN_IN}
                exiting={TEKEN_UIT}
              >
                <Animated.Text style={[cijferStijl, kleurStijl, styles.slotTekst]}>
                  {slot.teken}
                </Animated.Text>
              </Animated.View>
            ),
          )}
        </View>
      )}
    </View>
  );
}

interface Afmeting {
  // Breedte van elk cijfer 0-9, index = cijfer.
  breedtes: number[];
  maxBreedte: number;
  hoogte: number;
}

interface RollendCijferProps {
  cijfer: number;
  afmeting: Afmeting;
  stijl: TextStyle;
  kleurStijl: ReturnType<typeof useAnimatedStyle>;
  naar: ReturnType<typeof useBeweging>['naar'];
}

// Eén kolom: een verticale stapel van de cijfers 0-9, geclipt op de hoogte van één regel en
// verschoven met -cijfer * hoogte. De kolom houdt zijn identiteit vast over renders heen (de key
// in de ouder is de positie, niet de waarde), dus een wijziging rolt door in plaats van dat de
// kolom opnieuw opgebouwd wordt. De kolom is zo breed als het cijfer dat erin staat; de stapel is
// zo breed als het breedste cijfer en staat daarin gecentreerd, zodat het zichtbare cijfer precies
// in zijn eigen breedte valt.
function RollendCijfer({ cijfer, afmeting, stijl, kleurStijl, naar }: RollendCijferProps) {
  const positie = useSharedValue(cijfer);
  const eerste = useRef(true);

  useEffect(() => {
    if (eerste.current) {
      eerste.current = false;
      positie.value = cijfer;
      return;
    }
    positie.value = naar(cijfer, 'standaard');
  }, [cijfer, naar]);

  const { breedtes, maxBreedte, hoogte } = afmeting;

  const kolomStijl = useAnimatedStyle(() => ({
    width: interpolate(positie.value, CIJFER_POSITIES, breedtes, Extrapolation.CLAMP),
  }));

  const rijStijl = useAnimatedStyle(() => {
    const breedte = interpolate(positie.value, CIJFER_POSITIES, breedtes, Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: (breedte - maxBreedte) / 2 },
        { translateY: -positie.value * hoogte },
      ],
    };
  });

  return (
    <Animated.View style={[{ height: hoogte, overflow: 'hidden' }, kolomStijl]}>
      <Animated.View style={[{ width: maxBreedte }, rijStijl]}>
        {CIJFERS.map(c => (
          <Animated.Text
            key={c}
            style={[
              stijl,
              kleurStijl,
              { width: maxBreedte, height: hoogte, textAlign: 'center' },
            ]}
          >
            {c}
          </Animated.Text>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotTekst: {
    textAlign: 'center',
  },
  meter: {
    position: 'absolute',
    opacity: 0,
    left: -9999,
  },
});
