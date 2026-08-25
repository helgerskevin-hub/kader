import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, PanResponder } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Polygon, Polyline, Line, Circle } from 'react-native-svg';
import { Candle } from '../engine/types';
import { fmtPrijs } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { useValutaStand } from '../state/useValuta';

interface Niveau {
  waarde: number;
  kleur: string;
}

interface Props {
  candles: Candle[];
  niveaus?: Niveau[];
  hoogte?: number;
}

const MAX_PUNTEN = 90;
const PAD = 10;

function fmtDatumKort(tijd?: number): string {
  if (!tijd) return '';
  return new Date(tijd).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export function PrijsGrafiek({ candles, niveaus = [], hoogte = 180 }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const [breedte, setBreedte] = useState(0);
  const [actief, setActief] = useState<number | null>(null);
  const breedteRef = useRef(0);

  function opLayout(e: LayoutChangeEvent) {
    setBreedte(e.nativeEvent.layout.width);
    breedteRef.current = e.nativeEvent.layout.width;
  }

  const reeks = candles.slice(-MAX_PUNTEN);
  const sluitkoersen = reeks.map(c => c.close);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: (evt) => wijsAan(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => wijsAan(evt.nativeEvent.locationX),
      onPanResponderRelease: () => setActief(null),
      onPanResponderTerminate: () => setActief(null),
    }),
  ).current;

  function wijsAan(x: number) {
    const n = sluitkoersen.length;
    const w = breedteRef.current;
    if (n < 2 || w <= 0) return;
    const fractie = Math.min(Math.max(x / w, 0), 1);
    setActief(Math.round(fractie * (n - 1)));
  }

  if (sluitkoersen.length < 2) {
    return <View style={[styles.leeg, { height: hoogte, backgroundColor: colors.verhoogd }]} onLayout={opLayout} />;
  }

  const alleWaarden = [...sluitkoersen, ...niveaus.map(n => n.waarde)];
  const min = Math.min(...alleWaarden);
  const max = Math.max(...alleWaarden);
  const bereik = max - min || 1;

  const yVoor = (v: number) => hoogte - PAD - ((v - min) / bereik) * (hoogte - PAD * 2);
  const xVoor = (i: number) => (i / (sluitkoersen.length - 1)) * breedte;

  const stijgend = sluitkoersen[sluitkoersen.length - 1] >= sluitkoersen[0];
  const lijnKleur = stijgend ? colors.winst : colors.verlies;

  const punten = sluitkoersen.map((c, i) => `${xVoor(i)},${yVoor(c)}`).join(' ');
  const vlakPunten = `0,${hoogte} ${punten} ${breedte},${hoogte}`;
  const laatsteX = xVoor(sluitkoersen.length - 1);
  const laatsteY = yVoor(sluitkoersen[sluitkoersen.length - 1]);

  const actiefX = actief !== null ? xVoor(actief) : null;
  const actiefY = actief !== null ? yVoor(sluitkoersen[actief]) : null;
  const tooltipBreedte = 130;
  const tooltipLinks = actiefX !== null
    ? Math.min(Math.max(actiefX - tooltipBreedte / 2, 0), Math.max(breedte - tooltipBreedte, 0))
    : 0;

  return (
    <View>
      <View style={{ height: hoogte }} onLayout={opLayout} {...panResponder.panHandlers}>
        {breedte > 0 && (
          <Svg width={breedte} height={hoogte}>
            <Defs>
              <LinearGradient id="prijsVlak" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={lijnKleur} stopOpacity={0.25} />
                <Stop offset="100%" stopColor={lijnKleur} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Polygon points={vlakPunten} fill="url(#prijsVlak)" />
            {niveaus.map((n, i) => (
              <Line
                key={i}
                x1={0}
                x2={breedte}
                y1={yVoor(n.waarde)}
                y2={yVoor(n.waarde)}
                stroke={n.kleur}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            ))}
            <Polyline
              points={punten}
              fill="none"
              stroke={lijnKleur}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {actiefX !== null && actiefY !== null ? (
              <>
                <Line x1={actiefX} x2={actiefX} y1={0} y2={hoogte} stroke={colors.tekstGedimd} strokeWidth={1} strokeDasharray="2,3" />
                <Circle cx={actiefX} cy={actiefY} r={4.5} fill={colors.cta} stroke={colors.kaart} strokeWidth={2} />
              </>
            ) : (
              <Circle cx={laatsteX} cy={laatsteY} r={3.5} fill={lijnKleur} />
            )}
          </Svg>
        )}

        <Text style={[Type.label, styles.prijsLabelBoven, { color: colors.tekstGedimd }]}>{fmtPrijs(max)}</Text>
        <Text style={[Type.label, styles.prijsLabelOnder, { color: colors.tekstGedimd }]}>{fmtPrijs(min)}</Text>

        {actief !== null && (
          <View style={[styles.tooltip, { left: tooltipLinks, backgroundColor: colors.kaart, borderColor: colors.rand }]}>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{fmtDatumKort(reeks[actief].tijd)}</Text>
            <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtPrijs(sluitkoersen[actief])}</Text>
          </View>
        )}
      </View>

      <View style={styles.datumRij}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{fmtDatumKort(reeks[0].tijd)}</Text>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{fmtDatumKort(reeks[reeks.length - 1].tijd)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leeg: { borderRadius: 8 },
  prijsLabelBoven: { position: 'absolute', top: 2, right: 4 },
  prijsLabelOnder: { position: 'absolute', bottom: 2, right: 4 },
  tooltip: {
    position: 'absolute',
    top: 4,
    width: 130,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignItems: 'center',
    gap: 1,
  },
  datumRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
});
