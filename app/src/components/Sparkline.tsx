import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../theme/useReduceMotion';
import { curve, duur, staggerVertraging } from '../theme/beweging';

interface Props {
  // Slotkoersen, oudste eerst.
  reeks: number[];
  hoogte?: number;
  // Plek in de lijst, voor de staffeling van het intekenen (zie staggerVertraging).
  volgorde?: number;
}

const PAD = 3;

// Kleine koerslijn zonder assen of gebaar: alleen de vorm van de laatste dagen. Kleur volgt eerste
// tegen laatste punt, zoals in PrijsGrafiek. Bij Minder beweging staat de lijn direct getekend.
export function Sparkline({ reeks, hoogte = 40, volgorde = 0 }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [breedte, setBreedte] = useState(0);
  const teken = useSharedValue(reduceMotion ? 1 : 0);

  const stijgend = reeks.length < 2 || reeks[reeks.length - 1] >= reeks[0];
  const kleur = stijgend ? colors.winst : colors.verlies;

  const pad = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    if (breedte <= 0 || reeks.length < 2) return b.detach();
    const min = Math.min(...reeks);
    const max = Math.max(...reeks);
    const bereik = max - min || 1;
    const stap = (breedte - PAD * 2) / (reeks.length - 1);
    reeks.forEach((v, i) => {
      const x = PAD + i * stap;
      const y = hoogte - PAD - ((v - min) / bereik) * (hoogte - PAD * 2);
      if (i === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    });
    return b.detach();
  }, [reeks, breedte, hoogte]);

  const klaar = breedte > 0 && reeks.length >= 2;
  useEffect(() => {
    if (!klaar) return;
    if (reduceMotion) {
      teken.value = 1;
      return;
    }
    teken.value = 0;
    teken.value = withDelay(
      staggerVertraging(volgorde),
      withTiming(1, { duration: duur.lang, easing: curve.binnen }),
    );
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
          <Path
            path={pad}
            style="stroke"
            strokeWidth={1.75}
            strokeCap="round"
            strokeJoin="round"
            color={kleur}
            start={0}
            end={teken}
          />
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
