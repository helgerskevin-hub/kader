import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import {
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Canvas, Circle, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../theme/useReduceMotion';
import { curve, duur, staggerVertraging, veer } from '../theme/beweging';
import { metAlfa } from './grafiek/morph';

interface Props {
  // Slotkoersen, oudste eerst.
  reeks: number[];
  hoogte?: number;
  // Plek in de lijst, voor de staffeling van het intekenen (zie staggerVertraging).
  volgorde?: number;
  // Vloeiende curve met een vlak eronder dat naar onder toe wegvloeit, zoals op de nieuwe kaarten.
  // Zonder deze prop blijft het de hoekige lijn van voorheen.
  vlak?: boolean;
  // Een stip op het laatste punt: de koers van nu.
  stip?: boolean;
}

const PAD = 3;
const STIP_STRAAL = 3.5;
// Met een stip moet er rechts en boven/onder plek zijn voor zijn straal, anders valt de helft
// ervan buiten het doek zodra de koers op een top of bodem eindigt.
const PAD_MET_STIP = STIP_STRAAL + 1.5;
// Dekking van het vlak bovenaan; onderaan loopt het uit naar nul.
const VLAK_DEKKING = 0.22;

// Kleine koerslijn zonder assen of gebaar: alleen de vorm van de laatste dagen. Kleur volgt eerste
// tegen laatste punt, zoals in PrijsGrafiek. Bij Minder beweging staat de lijn direct getekend.
export function Sparkline({ reeks, hoogte = 40, volgorde = 0, vlak = false, stip = false }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [breedte, setBreedte] = useState(0);
  const teken = useSharedValue(reduceMotion ? 1 : 0);
  const vlakDekking = useSharedValue(reduceMotion ? 1 : 0);
  const stipSchaal = useSharedValue(reduceMotion ? 1 : 0);

  const stijgend = reeks.length < 2 || reeks[reeks.length - 1] >= reeks[0];
  const kleur = stijgend ? colors.winst : colors.verlies;

  const geometrie = useMemo(() => {
    const lijn = Skia.PathBuilder.Make();
    const onder = Skia.PathBuilder.Make();
    if (breedte <= 0 || reeks.length < 2) {
      return { lijn: lijn.detach(), vlakPad: onder.detach(), laatste: vec(0, 0) };
    }
    const links = PAD;
    const rechts = stip ? PAD_MET_STIP : PAD;
    const verticaal = stip ? PAD_MET_STIP : PAD;
    const min = Math.min(...reeks);
    const max = Math.max(...reeks);
    const bereik = max - min || 1;
    const stap = (breedte - links - rechts) / (reeks.length - 1);
    const punten = reeks.map((v, i) => ({
      x: links + i * stap,
      y: hoogte - verticaal - ((v - min) / bereik) * (hoogte - verticaal * 2),
    }));

    punten.forEach((p, i) => {
      if (i === 0) {
        lijn.moveTo(p.x, p.y);
        return;
      }
      if (vlak) {
        // Kubisch, met beide controlepunten op het midden tussen twee punten: de curve vertrekt en
        // komt horizontaal aan, dus hij schiet nooit boven een top of onder een bodem uit.
        const vorig = punten[i - 1];
        const mx = (vorig.x + p.x) / 2;
        lijn.cubicTo(mx, vorig.y, mx, p.y, p.x, p.y);
      } else {
        lijn.lineTo(p.x, p.y);
      }
    });

    const laatstePunt = punten[punten.length - 1];
    if (vlak) {
      // Dezelfde curve, dan langs de onderrand terug naar het begin en dicht.
      onder.moveTo(punten[0].x, punten[0].y);
      for (let i = 1; i < punten.length; i++) {
        const vorig = punten[i - 1];
        const p = punten[i];
        const mx = (vorig.x + p.x) / 2;
        onder.cubicTo(mx, vorig.y, mx, p.y, p.x, p.y);
      }
      onder.lineTo(laatstePunt.x, hoogte);
      onder.lineTo(punten[0].x, hoogte);
      onder.close();
    }

    return { lijn: lijn.detach(), vlakPad: onder.detach(), laatste: vec(laatstePunt.x, laatstePunt.y) };
  }, [reeks, breedte, hoogte, vlak, stip]);

  const vlakKleuren = useMemo(() => [metAlfa(kleur, VLAK_DEKKING), metAlfa(kleur, 0)], [kleur]);
  const stipStraal = useDerivedValue(() => STIP_STRAAL * stipSchaal.value);

  const klaar = breedte > 0 && reeks.length >= 2;
  useEffect(() => {
    if (!klaar) return;
    if (reduceMotion) {
      teken.value = 1;
      vlakDekking.value = 1;
      stipSchaal.value = 1;
      return;
    }
    const vertraging = staggerVertraging(volgorde);
    teken.value = 0;
    teken.value = withDelay(vertraging, withTiming(1, { duration: duur.lang, easing: curve.binnen }));
    // Het vlak volgt de lijn: het komt pas op als die al een eind op weg is, zodat het oog eerst de
    // vorm ziet en dan pas het vlak eronder.
    vlakDekking.value = 0;
    vlakDekking.value = withDelay(
      vertraging + duur.midden,
      withTiming(1, { duration: duur.midden, easing: curve.fade }),
    );
    // De stip popt pas als de lijn bij hem is aangekomen.
    stipSchaal.value = 0;
    stipSchaal.value = withDelay(vertraging + duur.lang, withSpring(1, veer.speels));
    // Alleen opnieuw intekenen als de lijn zelf verandert, niet bij elke render van de kaart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klaar, reduceMotion, reeks]);

  function opLayout(e: LayoutChangeEvent) {
    setBreedte(Math.round(e.nativeEvent.layout.width));
  }

  return (
    <View
      onLayout={opLayout}
      style={{ height: hoogte }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {breedte > 0 && (
        <Canvas style={styles.canvas}>
          {vlak && (
            <Path path={geometrie.vlakPad} opacity={vlakDekking}>
              <LinearGradient start={vec(0, 0)} end={vec(0, hoogte)} colors={vlakKleuren} />
            </Path>
          )}
          <Path
            path={geometrie.lijn}
            style="stroke"
            strokeWidth={1.75}
            strokeCap="round"
            strokeJoin="round"
            color={kleur}
            start={0}
            end={teken}
          />
          {stip && reeks.length >= 2 && (
            <Circle c={geometrie.laatste} r={stipStraal} color={kleur} />
          )}
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
