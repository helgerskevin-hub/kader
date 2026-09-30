import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../theme/useReduceMotion';
import { curve, duur, staggerVertraging } from '../theme/beweging';
import { CoinLogo } from './CoinLogo';

interface Props {
  symbool: string;
  // 0 tot 100. Daarbuiten wordt hij afgekapt, zodat de boog nooit verder loopt dan rond.
  score: number;
  // Buitenmaat van de ring. 48 op de kaarten, 44 in de carrousel.
  maat?: number;
  // Plek in de lijst, voor de staffeling van het intekenen (zie staggerVertraging).
  volgorde?: number;
  // Uit als een omliggend tikvlak de score al in zijn eigen label voorleest: TalkBack toont dan niet
  // twee elementen voor hetzelfde getal, en het tikvlak blijft één geheel.
  accessible?: boolean;
}

const DIKTE = 3;

// Coinlogo met de score als ring eromheen. De vulling is bewust primair en niet groen of rood: een
// score is geen resultaat, en groen en rood betekenen in Kader winst en verlies.
//
// De boog tekent in via `end` van het pad, net als de verdelingsring op Portfolio: dat is Skia-
// tekenwerk op de UI-thread, geen layout. Bij Minder beweging staat hij direct op zijn plek.
export function ScoreRing({ symbool, score, maat = 48, volgorde = 0, accessible = true }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const fractie = Math.min(Math.max(score, 0), 100) / 100;
  const vulling = useSharedValue(reduceMotion ? fractie : 0);
  // Alleen de eerste keer tekenen we vanaf nul en met staffeling in. Een latere scorewissel loopt
  // vanaf de huidige stand naar de nieuwe, zonder te wachten op zijn plek in de lijst.
  const eerste = useRef(true);

  const pad = useMemo(() => {
    const straal = (maat - 4) / 2;
    const midden = maat / 2;
    const b = Skia.PathBuilder.Make();
    // -90 graden is twaalf uur; een positieve zwaai loopt met de klok mee. Net onder 360, want een
    // volle cirkel slaat Skia als gesloten vorm op en dan klopt het intekenen via `end` niet meer.
    b.addArc(Skia.XYWHRect(midden - straal, midden - straal, straal * 2, straal * 2), -90, 359.999);
    return b.detach();
  }, [maat]);

  useEffect(() => {
    if (reduceMotion) {
      vulling.value = fractie;
      eerste.current = false;
      return;
    }
    const animatie = withTiming(fractie, { duration: duur.lang, easing: curve.binnen });
    if (eerste.current) {
      eerste.current = false;
      vulling.value = 0;
      vulling.value = withDelay(staggerVertraging(volgorde), animatie);
      return;
    }
    vulling.value = animatie;
    // volgorde telt alleen voor het eerste intekenen; een kaart die in de lijst opschuift hoort
    // zijn ring niet opnieuw te tekenen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fractie, reduceMotion]);

  const afgerond = Math.round(fractie * 100);

  return (
    <View
      style={{ width: maat, height: maat }}
      accessible={accessible}
      accessibilityRole="image"
      accessibilityLabel={`Score ${afgerond} van 100`}
    >
      <Canvas style={[StyleSheet.absoluteFill, { width: maat, height: maat }]} pointerEvents="none">
        <Path path={pad} style="stroke" strokeWidth={DIKTE} color={colors.verhoogd} />
        <Path
          path={pad}
          style="stroke"
          strokeWidth={DIKTE}
          strokeCap="round"
          color={colors.primair}
          start={0}
          end={vulling}
        />
      </Canvas>
      <View style={styles.midden} pointerEvents="none">
        <CoinLogo symbool={symbool} grootte={maat - 12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  midden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
