import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent, PanResponder } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Polygon, Polyline, Line, Circle } from 'react-native-svg';
import { Candle } from '../engine/types';
import { fmtPrijs } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useValutaStand } from '../state/useValuta';
import { BereikId, STANDAARD_BEREIK, beschikbareBereiken, geldigBereik, reeksVoorBereik } from '../engine/grafiekBereik';

interface Niveau {
  waarde: number;
  kleur: string;
}

interface Props {
  candles: Candle[];
  niveaus?: Niveau[];
  hoogte?: number;
  // Uit voor de voorbeeldgrafiek onder het informatie-scherm: dat is een plaatje bij een uitleg,
  // geen coin waar je doorheen wilt bladeren.
  toonPeriodes?: boolean;
}

const PAD = 10;

function fmtDatumKort(tijd?: number): string {
  if (!tijd) return '';
  return new Date(tijd).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export function PrijsGrafiek({ candles, niveaus = [], hoogte = 180, toonPeriodes = true }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const [breedte, setBreedte] = useState(0);
  const [actief, setActief] = useState<number | null>(null);
  const [periode, setPeriode] = useState<BereikId>(STANDAARD_BEREIK);
  const breedteRef = useRef(0);

  function opLayout(e: LayoutChangeEvent) {
    setBreedte(e.nativeEvent.layout.width);
    breedteRef.current = e.nativeEvent.layout.width;
  }

  const periodes = toonPeriodes ? beschikbareBereiken(candles) : [];
  // Niet op de keuze zelf markeren maar op wat er echt getoond wordt: heeft deze coin te weinig
  // historie voor de gekozen periode, dan valt hij terug op Alles en hoort die knop op te lichten.
  const actievePeriode = geldigBereik(candles, periode);
  const reeks = reeksVoorBereik(candles, periode);
  const sluitkoersen = reeks.map(c => c.close);

  // De aanwijzer wijst een index in `reeks` aan, en die reeks krimpt als je een korter bereik kiest.
  // Zonder deze grens leest de tooltip na het wisselen buiten de rij en valt het scherm om.
  const actiefVeilig = actief !== null && actief < sluitkoersen.length ? actief : null;

  function kiesPeriode(id: BereikId) {
    setActief(null);
    setPeriode(id);
  }

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

  const actiefX = actiefVeilig !== null ? xVoor(actiefVeilig) : null;
  const actiefY = actiefVeilig !== null ? yVoor(sluitkoersen[actiefVeilig]) : null;
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

        {actiefVeilig !== null && (
          <View style={[styles.tooltip, { left: tooltipLinks, backgroundColor: colors.kaart, borderColor: colors.rand }]}>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{fmtDatumKort(reeks[actiefVeilig].tijd)}</Text>
            <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtPrijs(sluitkoersen[actiefVeilig])}</Text>
          </View>
        )}
      </View>

      <View style={styles.datumRij}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{fmtDatumKort(reeks[0].tijd)}</Text>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{fmtDatumKort(reeks[reeks.length - 1].tijd)}</Text>
      </View>

      {/* Alleen tonen als er iets te kiezen valt: bij een bron die maar een maand teruggaat zou elke
          knop dezelfde grafiek geven, en dat leest als een kapotte app. */}
      {periodes.length > 0 && (
        <View style={styles.bereikRij}>
          {periodes.map(b => {
            const aan = b.id === actievePeriode;
            return (
              <Pressable
                key={b.id}
                onPress={() => kiesPeriode(b.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: aan }}
                accessibilityLabel={`Toon ${b.label}`}
                style={[
                  styles.bereikPil,
                  { backgroundColor: aan ? colors.cta : colors.verhoogd },
                ]}
              >
                <Text style={[Type.caption, { color: aan ? 'white' : colors.tekstGedimd, fontWeight: '600' }]}>
                  {b.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
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
  bereikRij: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  bereikPil: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    minHeight: 32,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
