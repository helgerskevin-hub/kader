import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Clock } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { curve, duur, schud as schudToken, veer } from '../../theme/beweging';
import { HOEKEN } from '../KaderLogo';
import { Fonts } from '../../theme/typography';
import { PIN_LENGTE } from '../../state/vergrendelTypes';

// Afmetingen uit de mockup: een kader van 220 x 64 met vier hoekhaken (arm van 14, lijn van 2),
// daarbinnen zes stippen van 14 met 16 ertussen. De haken zijn dezelfde vorm als HOEKEN in
// KaderLogo, alleen dunner.
const BREEDTE = 220;
const HOOGTE = 64;
const HAAK = 16;
const STIP = 14;
// Bij succes schuift elke haak zoveel dp naar binnen: het kader sluit.
const SLUIT_AFSTAND = 8;

// De vier haken afgeleid van HOEKEN in KaderLogo (96-raster: arm, hoek, arm). Per haak: het pad in
// een eigen vakje van HAAK x HAAK (arm van 14, lijn van 2 dus 1 dp marge), de plek in het kader en
// de richting waarin hij bij succes naar binnen schuift (dezelfde kant als zijn armen wijzen).
interface HaakVorm {
  d: string;
  links: boolean;
  boven: boolean;
  richtingX: number;
  richtingY: number;
}

function haakVorm(d: string): HaakVorm {
  const [ax, ay, cx, cy, bx, by] = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  // De armen wijzen van de hoek af; hun richting is de binnenkant van het kader.
  const richtingX = Math.sign(ax - cx) || Math.sign(bx - cx);
  const richtingY = Math.sign(ay - cy) || Math.sign(by - cy);
  const arm = HAAK - 2;
  const hx = richtingX > 0 ? 1 : HAAK - 1;
  const hy = richtingY > 0 ? 1 : HAAK - 1;
  // Elke arm loopt van de hoek naar het eindpunt; de arm die in x verschilt is horizontaal.
  const eind = (x: number, y: number): [number, number] =>
    x !== cx ? [hx + Math.sign(x - cx) * arm, hy] : [hx, hy + Math.sign(y - cy) * arm];
  const [e1x, e1y] = eind(ax, ay);
  const [e2x, e2y] = eind(bx, by);
  return {
    d: `M${e1x} ${e1y} L${hx} ${hy} L${e2x} ${e2y}`,
    links: richtingX > 0,
    boven: richtingY > 0,
    richtingX,
    richtingY,
  };
}

const HAKEN: HaakVorm[] = HOEKEN.map(haakVorm);

function Haak({
  haak,
  kleur,
  binnen,
}: {
  haak: HaakVorm;
  kleur: string;
  binnen: SharedValue<number>;
}) {
  const stijl = useAnimatedStyle(() => ({
    transform: [
      { translateX: binnen.value * SLUIT_AFSTAND * haak.richtingX },
      { translateY: binnen.value * SLUIT_AFSTAND * haak.richtingY },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.haak,
        haak.links ? { left: 0 } : { right: 0 },
        haak.boven ? { top: 0 } : { bottom: 0 },
        stijl,
      ]}
    >
      <Svg width={HAAK} height={HAAK} viewBox={`0 0 ${HAAK} ${HAAK}`}>
        <Path d={haak.d} stroke={kleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

export type StippenStand = 'normaal' | 'fout' | 'succes';

// m:ss, naar boven afgerond zodat de aftelling nooit 0:00 toont terwijl er nog tijd rest.
export function formatAftelling(ms: number): string {
  const totaal = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totaal / 60);
  const s = totaal % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Voor schermlezers: "1 minuut en 5 seconden".
export function aftellingInWoorden(ms: number): string {
  const totaal = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totaal / 60);
  const s = totaal % 60;
  const minuten = m === 1 ? '1 minuut' : `${m} minuten`;
  const seconden = s === 1 ? '1 seconde' : `${s} seconden`;
  if (m === 0) return seconden;
  if (s === 0) return minuten;
  return `${minuten} en ${seconden}`;
}

interface Props {
  // Hoeveel cijfers er zijn ingevoerd.
  ingevoerd: number;
  lengte?: number;
  stand?: StippenStand;
  // Telt op bij elke fout: elke wijziging laat de stippen en haken schudden.
  schudTeller?: number;
  // Een lopende wachttijd (ms): de stippen worden een aftelling met Clock-icoon.
  wachtMs?: number | null;
}

// Eén stip. Een gevulde stip ploft kort van 0,6 naar 1 (veer.speels); onder Minder beweging niet.
function Stip({
  gevuld,
  kleur,
  ringKleur,
  reduceMotion,
}: {
  gevuld: boolean;
  kleur: string;
  ringKleur: string;
  reduceMotion: boolean;
}) {
  const schaal = useSharedValue(1);
  const eerste = useRef(true);

  useEffect(() => {
    if (eerste.current) {
      eerste.current = false;
      return;
    }
    if (reduceMotion || !gevuld) {
      schaal.value = 1;
      return;
    }
    schaal.value = 0.6;
    schaal.value = withSpring(1, veer.speels);
  }, [gevuld, reduceMotion, schaal]);

  const stijl = useAnimatedStyle(() => ({ transform: [{ scale: schaal.value }] }));

  return (
    <Animated.View
      style={[
        styles.stip,
        gevuld
          ? { backgroundColor: kleur, borderColor: kleur }
          : { backgroundColor: 'transparent', borderColor: ringKleur },
        stijl,
      ]}
    />
  );
}

// De zes stippen tussen vier hoekhaken. Eén toegankelijkheidsgroep ("Pincode, 3 van 6 cijfers
// ingevoerd"); tijdens een wachttijd een timer zonder live region, de aankondigingen doet het scherm.
export function PinStippen({ ingevoerd, lengte = PIN_LENGTE, stand = 'normaal', schudTeller = 0, wachtMs = null }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();

  const schud = useSharedValue(0);
  const binnen = useSharedValue(0);
  const vorigeSchud = useRef(schudTeller);

  useEffect(() => {
    if (schudTeller === vorigeSchud.current) return;
    vorigeSchud.current = schudTeller;
    if (reduceMotion) return;
    cancelAnimation(schud);
    schud.value = withSequence(
      ...schudToken.stappen.map(st =>
        withTiming(st.naar, { duration: st.duur, easing: Easing.out(Easing.quad) }),
      ),
    );
  }, [schudTeller, reduceMotion, schud]);

  useEffect(() => {
    if (stand === 'succes' && !reduceMotion) {
      binnen.value = withTiming(1, { duration: duur.midden, easing: curve.binnen });
    } else {
      binnen.value = 0;
    }
  }, [stand, reduceMotion, binnen]);

  const schudStijl = useAnimatedStyle(() => ({ transform: [{ translateX: schud.value }] }));
  const wacht = wachtMs != null && wachtMs > 0;
  const haakKleur = stand === 'fout' ? colors.verlies : colors.tekstGedimd;
  const stipKleur = stand === 'fout' ? colors.verlies : colors.tekstPrimair;
  const ringKleur = colors.tekstGedimd;

  return (
    <Animated.View style={[styles.kader, schudStijl]}>
      {HAKEN.map(h => (
        <Haak key={h.d} haak={h} kleur={haakKleur} binnen={binnen} />
      ))}

      {wacht ? (
        <View
          accessible
          accessibilityRole="timer"
          accessibilityLabel={`Nog ${aftellingInWoorden(wachtMs as number)}`}
          style={styles.aftelling}
        >
          <Clock size={26} strokeWidth={1.75} color={colors.tekstGedimd} />
          <Text
            maxFontSizeMultiplier={1.3}
            style={[styles.tijd, { color: colors.tekstPrimair }]}
          >
            {formatAftelling(wachtMs as number)}
          </Text>
        </View>
      ) : (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Pincode, ${ingevoerd} van ${lengte} cijfers ingevoerd`}
          style={styles.stippen}
        >
          {Array.from({ length: lengte }, (_, i) => (
            <Stip key={i} gevuld={i < ingevoerd} kleur={stipKleur} ringKleur={ringKleur} reduceMotion={reduceMotion} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  kader: { width: BREEDTE, height: HOOGTE, alignItems: 'center', justifyContent: 'center' },
  haak: { position: 'absolute', width: HAAK, height: HAAK },
  stippen: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stip: { width: STIP, height: STIP, borderRadius: STIP / 2, borderWidth: 1.5 },
  aftelling: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tijd: {
    fontFamily: Fonts.monoMedium,
    fontSize: 28,
    lineHeight: 36,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
});
