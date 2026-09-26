import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
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
  // Zonder kleurBijTeken blijft de kleur van de aanroeper gewoon in de stijl staan. Mét
  // kleurBijTeken wordt de kleur straks door interpolateColor geleverd, dus dan mag de statische
  // kleur niet meer meekomen (die zou de animatie overschrijven).
  const basisStijl = useMemo<TextStyle>(() => {
    if (!kleurBijTeken) return gevlakt;
    const { color, ...rest } = gevlakt;
    return rest;
  }, [gevlakt, kleurBijTeken]);
  // Tabular figures zijn een harde eis voor rollende cijfers: zonder gelijke breedte per cijfer
  // schuift een kolom bij elke rol een fractie opzij. IBM Plex Sans en Mono ondersteunen tabular
  // figures via deze OpenType-feature, dus dit voegt alleen de cijfervariant toe, nooit het
  // lettertype zelf.
  const cijferStijl = useMemo<TextStyle>(
    () => ({ ...basisStijl, fontVariant: ['tabular-nums'] }),
    [basisStijl],
  );

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

  // Eén keer de afmeting van een cijfer meten in dit lettertype en deze grootte, via een
  // onzichtbaar exemplaar. Zonder een vaste breedte en hoogte kan de verticale stapel van 0-9 niet
  // los van de tekststroom gepositioneerd worden.
  const [afmeting, setAfmeting] = useState<{ width: number; height: number } | null>(null);
  const metingSleutel = `${cijferStijl.fontFamily ?? ''}|${cijferStijl.fontSize ?? ''}|${cijferStijl.fontWeight ?? ''}|${cijferStijl.lineHeight ?? ''}`;
  const gemeten = useRef<string | null>(null);

  function opMeting(e: LayoutChangeEvent) {
    if (gemeten.current === metingSleutel) return;
    gemeten.current = metingSleutel;
    const { width, height } = e.nativeEvent.layout;
    setAfmeting({ width, height });
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
    <View>
      {/* Onzichtbare meter: zelfde stijl als de echte cijfers, buiten beeld geplaatst zodat hij de
          layout niet raakt. */}
      <Text
        style={[cijferStijl, styles.meter]}
        onLayout={opMeting}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        0
      </Text>

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

interface RollendCijferProps {
  cijfer: number;
  afmeting: { width: number; height: number };
  stijl: TextStyle;
  kleurStijl: ReturnType<typeof useAnimatedStyle>;
  naar: ReturnType<typeof useBeweging>['naar'];
}

// Eén kolom: een verticale stapel van de cijfers 0-9, geclipt op de hoogte van één regel en
// verschoven met -cijfer * hoogte. De kolom houdt zijn identiteit vast over renders heen (de key
// in de ouder is de positie, niet de waarde), dus een wijziging rolt door in plaats van dat de
// kolom opnieuw opgebouwd wordt.
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

  const rijStijl = useAnimatedStyle(() => ({
    transform: [{ translateY: -positie.value * afmeting.height }],
  }));

  return (
    <View style={{ width: afmeting.width, height: afmeting.height, overflow: 'hidden' }}>
      <Animated.View style={rijStijl}>
        {CIJFERS.map(c => (
          <Animated.Text
            key={c}
            style={[
              stijl,
              kleurStijl,
              { width: afmeting.width, height: afmeting.height, textAlign: 'center' },
            ]}
          >
            {c}
          </Animated.Text>
        ))}
      </Animated.View>
    </View>
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
