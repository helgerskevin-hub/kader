import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { curve } from '../../../theme/beweging';
import { radii, spacing } from '../../../theme/tokens';
import type { VisProps } from './types';

// Lokale ring in dezelfde opzet als VerdelingKaart (die exporteert zijn Ring niet): boogstrepen via
// addArc, elk met een eigen `end` dat van de gedeelde voortgang wordt afgeleid.
const MAAT = 140;
const MIDDEN = MAAT / 2;
const STRAAL = 54;
const DIKTE = 20;
const OMTREK = 2 * Math.PI * STRAAL;
const NAAD = 2;
const OVAAL = Skia.XYWHRect(MIDDEN - STRAAL, MIDDEN - STRAAL, STRAAL * 2, STRAAL * 2);
const COINS = [
  { naam: 'ETH', aandeel: 0.42 },
  { naam: 'SOL', aandeel: 0.28 },
  { naam: 'LINK', aandeel: 0.18 },
  { naam: 'NEAR', aandeel: 0.12 },
];

export function VisVerdeling({ speelSleutel, reduceMotion }: VisProps) {
  const { colors } = useTheme();
  const voortgang = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      voortgang.value = 1;
      return;
    }
    voortgang.value = 0;
    voortgang.value = withTiming(1, { duration: 900, easing: curve.binnen });
  }, [speelSleutel, reduceMotion]);

  let gelopen = 0;
  const segmenten = COINS.map((c, i) => {
    const begin = gelopen;
    gelopen += c.aandeel;
    return { ...c, begin, kleur: colors.verdeling[i] };
  });

  return (
    <View style={[styles.kaart, { backgroundColor: colors.kaart, borderColor: colors.rand }]}>
      <View style={styles.ring}>
        <Canvas style={{ width: MAAT, height: MAAT }} pointerEvents="none">
          <Group>
            {segmenten.map(s => (
              <Boog key={s.naam} {...s} voortgang={voortgang} />
            ))}
          </Group>
        </Canvas>
        <View style={styles.midden} pointerEvents="none">
          <Text style={[Type.prijs, { fontSize: 13, color: colors.winst }]}>+$100.17</Text>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>ongerealiseerd</Text>
        </View>
      </View>
      <View style={styles.legenda}>
        {segmenten.map(s => (
          <View key={s.naam} style={styles.legendaRij}>
            <View style={[styles.stip, { backgroundColor: s.kleur }]} />
            <Text style={[Type.caption, { color: colors.tekstPrimair }]}>
              {s.naam} {Math.round(s.aandeel * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Boog(p: { kleur: string; begin: number; aandeel: number; voortgang: { value: number } }) {
  const lengte = p.aandeel * OMTREK - NAAD;
  const pad = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    b.addArc(OVAAL, -90 + p.begin * 360, (lengte / OMTREK) * 360);
    return b.detach();
  }, [p.begin, lengte]);
  const eind = useDerivedValue(() =>
    Math.min(Math.max((p.voortgang.value - p.begin) / p.aandeel, 0), 1),
  );
  return <Path path={pad} color={p.kleur} style="stroke" strokeWidth={DIKTE} start={0} end={eind} />;
}

const styles = StyleSheet.create({
  kaart: { borderWidth: 1, borderRadius: radii.kaart, padding: spacing.base, gap: spacing.md, alignItems: 'center' },
  ring: { width: MAAT, height: MAAT, alignItems: 'center', justifyContent: 'center' },
  midden: { position: 'absolute', alignItems: 'center', width: 88 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  legendaRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stip: { width: 10, height: 10, borderRadius: 5 },
});
