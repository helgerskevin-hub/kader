import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeProvider';
import { Type, Fonts } from '../../theme/typography';
import { curve, duur } from '../../theme/beweging';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { fmtBedrag } from '../../engine/format';
import { AnimatedGetal } from '../AnimatedGetal';

interface Props {
  // De tekst zoals getypt ("250" of "12,5"); de ouder houdt hem vast en parst hem zelf.
  waarde: string;
  onWijzig: (tekst: string) => void;
  // Kleine kop boven het bedrag, bijvoorbeeld "INGELEGD".
  label?: string;
  // Regel onder het bedrag, bijvoorbeeld "Te besteden $9,980.38".
  onderschrift?: React.ReactNode;
  bewerkbaar?: boolean;
  accessibilityLabel: string;
}

const DOLLARS = { valuta: 'USD' } as const;
const MAX_GROOTTE = 52;
const MIN_GROOTTE = 28;
// Gemiddelde tekenbreedte van IBM Plex Mono relatief aan de lettergrootte, inclusief ruimte voor
// de negatieve letterspatiëring. Iets ruim gekozen zodat het bedrag liever te klein dan te breed is.
const TEKENBREEDTE = 0.62;
const CURSOR_BREEDTE = 2;
const CURSOR_MARGE = 3;

const dollars = (n: number) => fmtBedrag(n, DOLLARS).replace(/\.00$/, '');

function parseBedrag(tekst: string): number {
  const n = parseFloat(tekst.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// Het grote bedrag van een ordervenster. Het getal is alleen om naar te kijken (het rolt via
// AnimatedGetal); eroverheen ligt een onzichtbaar TextInput dat het hele blok bedekt, dus een tik
// ergens op het bedrag opent het toetsenbord voor een eigen bedrag.
export function BedragInvoer({
  waarde, onWijzig, label, onderschrift, bewerkbaar = true, accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { fontScale } = useWindowDimensions();
  const [breedte, setBreedte] = useState(0);
  const [focus, setFocus] = useState(false);

  const getal = parseBedrag(waarde);
  const tekenAantal = dollars(getal).length;

  // Zonder meting (eerste frame) de maximale grootte: AnimatedGetal rolt bij mount niet, dus er is
  // niets om te verbergen, en het blok meet zichzelf meteen daarna.
  const grootte = breedte > 0
    ? Math.max(MIN_GROOTTE, Math.min(MAX_GROOTTE, (breedte - CURSOR_BREEDTE - CURSOR_MARGE) / (tekenAantal * TEKENBREEDTE)))
    : MAX_GROOTTE;

  // AnimatedGetal geeft geen maxFontSizeMultiplier door aan zijn Text, en dat bedrag mag nooit
  // uit zijn blok lopen. Daarom de systeemletter hier teruggerekend: de breedte hierboven geldt voor
  // de getekende grootte, en het getal schaalt niet nog eens door.
  const stijl = useMemo(() => ({
    fontFamily: Fonts.monoMedium,
    fontWeight: '500' as const,
    fontVariant: ['tabular-nums' as const],
    fontSize: grootte / fontScale,
    lineHeight: (grootte * 1.15) / fontScale,
    letterSpacing: (-grootte * 0.04) / fontScale,
    color: colors.tekstPrimair,
  }), [grootte, fontScale, colors.tekstPrimair]);

  // De cursor knippert alleen met opacity. Onder Minder beweging staat hij stil, zichtbaar zolang
  // het veld focus heeft.
  const knipper = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(knipper);
    if (!focus) {
      knipper.value = 0;
      return;
    }
    knipper.value = 1;
    if (reduceMotion) return;
    const stap = { duration: duur.lang, easing: curve.fade, reduceMotion: ReduceMotion.Never };
    knipper.value = withRepeat(
      withSequence(withTiming(0, stap), withTiming(1, stap)),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [focus, reduceMotion, knipper]);
  const cursorStijl = useAnimatedStyle(() => ({ opacity: knipper.value }));

  function opLayout(e: LayoutChangeEvent) {
    setBreedte(e.nativeEvent.layout.width);
  }

  return (
    <View style={styles.blok}>
      <View style={styles.vlak} onLayout={opLayout}>
        {label ? (
          <Text style={[Type.overline, styles.label, { color: colors.tekstGedimd }]}>{label}</Text>
        ) : null}

        <View
          style={styles.getalRij}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <AnimatedGetal waarde={getal} format={dollars} style={stijl} />
          <Animated.View
            style={[
              styles.cursor,
              { height: grootte * 0.8, backgroundColor: colors.cta },
              cursorStijl,
            ]}
          />
        </View>

        <TextInput
          value={waarde}
          onChangeText={onWijzig}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          editable={bewerkbaar}
          keyboardType="decimal-pad"
          maxLength={12}
          caretHidden
          contextMenuHidden
          selectionColor="transparent"
          accessibilityLabel={accessibilityLabel}
          style={styles.invoer}
        />
      </View>

      {onderschrift ? <View style={styles.onderschrift}>{onderschrift}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  blok: { alignItems: 'stretch', gap: 4, paddingTop: 6 },
  vlak: { alignItems: 'center', gap: 4 },
  label: { textAlign: 'center' },
  getalRij: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  cursor: { width: CURSOR_BREEDTE, marginLeft: CURSOR_MARGE, borderRadius: 1 },
  // Onzichtbaar en over het hele vlak: de tekst is transparant en de cursor staat uit, want het
  // getal erboven is wat je ziet.
  invoer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    color: 'transparent',
    textAlign: 'center',
    // Klein, want er valt niets te lezen; het veld vult het vlak en is daardoor overal tikbaar.
    fontSize: 1,
    padding: 0,
  },
  onderschrift: { alignItems: 'center' },
});
