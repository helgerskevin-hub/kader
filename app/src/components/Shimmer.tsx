import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  makeMutable,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../theme/useReduceMotion';
import { useTabZichtbaar } from '../state/tabZichtbaar';

// Shimmer voor de skeleton-componenten (SkeletonCard, SkeletonRegel, SkeletonGrafiek): een zachte
// schuine glansband die van links naar rechts over de grijze blokjes trekt. Vervangt de oude
// opacity-puls, die het hele blok liet ademen: een band die ergens heen gaat leest als "er wordt
// iets opgehaald", een puls als "er hapert iets".
//
// Opbouw: een ShimmerGroep (de kaart of rij) met daarin losse ShimmerBlokken (de grijze vormen).
// Elk blok knipt zijn eigen stukje band af, maar rekent de positie uit in de coördinaten van de
// groep. Zo loopt er één doorgaande diagonaal over de hele kaart, in plaats van tien bandjes die
// elk op hun eigen tempo over hun eigen blokje schieten.

// Eén klok voor de hele app. Alle skeletons in beeld lopen daardoor in de pas, ook als ze in
// verschillende componenten zitten, en er draait nooit meer dan één herhalende animatie, hoeveel
// blokken er ook zijn. Hij start bij de eerste groep die mount en stopt bij de laatste die weggaat.
const klok = makeMutable(0);
let abonnees = 0;

// Een hele ronde, inclusief de rustpauze aan het eind waarin de band buiten beeld is. De band
// zelf trekt in het eerste deel voorbij; zonder pauze begint hij direct opnieuw en wordt het
// een onrustige lopende band.
const RONDE_MS = 1300;
const TREK_DEEL = 0.8;
// Breedte van de glansband en de hoek van de diagonaal. Smal en licht schuin: zichtbaar genoeg om
// beweging te zien, niet zo breed dat het blok even helemaal oplicht.
const BAND = 96;
const HOEK_GRADEN = 20;
const HELLING = Math.tan((HOEK_GRADEN * Math.PI) / 180);

function useKlok(actief: boolean) {
  useEffect(() => {
    if (!actief) return;
    abonnees += 1;
    if (abonnees === 1) {
      klok.value = 0;
      klok.value = withRepeat(withTiming(1, { duration: RONDE_MS, easing: Easing.linear }), -1, false);
    }
    return () => {
      abonnees -= 1;
      if (abonnees === 0) cancelAnimation(klok);
    };
  }, [actief]);
}

interface GroepWaarde {
  ref: React.RefObject<View | null>;
  breedte: number;
  hoogte: number;
  actief: boolean;
  glans: string;
  glansDekking: number;
  blokKleur: string;
}

const GroepContext = createContext<GroepWaarde | null>(null);

export function ShimmerGroep({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const { colors, donkerActief } = useTheme();
  // Minder beweging: een statisch skeleton, geen lus. De blokken zelf blijven gewoon staan.
  const reduceMotion = useReduceMotion();
  const ref = useRef<View>(null);
  const [maat, setMaat] = useState({ breedte: 0, hoogte: 0 });
  // Een skeleton op een tab die niet in beeld is, telt niet mee: dan staat de klok gewoon stil.
  const inBeeld = useTabZichtbaar();
  useKlok(!reduceMotion && inBeeld);

  function opLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setMaat(v => (v.breedte === width && v.hoogte === height ? v : { breedte: width, hoogte: height }));
  }

  // Licht thema: een witte glans over lichtgrijs. Donker thema: wit op heel lage dekking, want
  // alles daarboven licht op als een zaklamp op een donkere kaart.
  const waarde: GroepWaarde = {
    ref,
    breedte: maat.breedte,
    hoogte: maat.hoogte,
    actief: !reduceMotion,
    glans: donkerActief ? colors.tekstPrimair : colors.kaart,
    glansDekking: donkerActief ? 0.07 : 0.75,
    blokKleur: colors.verhoogd,
  };

  return (
    <View ref={ref} style={style} onLayout={opLayout}>
      <GroepContext.Provider value={waarde}>{children}</GroepContext.Provider>
    </View>
  );
}

export function ShimmerBlok({ style }: { style?: StyleProp<ViewStyle> }) {
  const groep = useContext(GroepContext);
  const ref = useRef<View>(null);
  // Positie van dit blok binnen de groep, plus zijn hoogte. Pas als die bekend is komt er een band.
  const [plek, setPlek] = useState<{ x: number; y: number; h: number } | null>(null);

  function opLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    const doel = groep?.ref.current;
    const ik = ref.current;
    if (!doel || !ik) return;
    ik.measureLayout(
      doel,
      (x, y) => setPlek(v => (v && v.x === x && v.y === y && v.h === h ? v : { x, y, h })),
      () => {},
    );
  }

  const breedte = groep?.breedte ?? 0;
  const hoogte = groep?.hoogte ?? 0;
  const bx = plek?.x ?? 0;
  const by = plek?.y ?? 0;
  const bh = plek?.h ?? 0;

  const bandStijl = useAnimatedStyle(() => {
    // De band is de lijn x + y * HELLING = c in groepscoördinaten, met c lopend van net links van
    // de groep tot net rechts ervan. Omgerekend naar dit blok is dat een verschuiving; de skewX
    // hieronder geeft de band dezelfde helling, zodat de stukjes in alle blokken op één lijn liggen.
    const p = Math.min(klok.value / TREK_DEEL, 1);
    const c = -BAND / 2 + p * (breedte + hoogte * HELLING + BAND);
    const midden = c - bx - (by + bh / 2) * HELLING;
    return { transform: [{ translateX: midden - BAND / 2 }, { skewX: `${-HOEK_GRADEN}deg` }] };
  });

  return (
    <View
      ref={ref}
      onLayout={opLayout}
      style={[styles.blok, { backgroundColor: groep?.blokKleur }, style]}
    >
      {groep?.actief && plek && breedte > 0 && (
        <Animated.View pointerEvents="none" style={[styles.band, bandStijl]}>
          <Svg width={BAND} height={bh}>
            <Defs>
              <LinearGradient id="glans" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={groep.glans} stopOpacity={0} />
                <Stop offset="0.5" stopColor={groep.glans} stopOpacity={groep.glansDekking} />
                <Stop offset="1" stopColor={groep.glans} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={BAND} height={bh} fill="url(#glans)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blok: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: BAND,
  },
});
