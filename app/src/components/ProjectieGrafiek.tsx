// De grafiek in blok 3 van DoelScherm: twee lijnen die laten zien wat een maandelijkse inleg
// wordt bij een zelf ingevuld rendement, tegenover diezelfde inleg zonder rendement.
//
// Zelfde SVG-opbouw als PrijsGrafiek.tsx (Svg, Defs/LinearGradient voor de vulling, Polyline voor
// de lijn), maar met twee bedoelde afwijkingen. Ten eerste zijn ALLE lijnen gestippeld: dat is het
// omgekeerde van PrijsGrafiek, waar de lijn een dichte streep is omdat het gemeten koersdata is.
// Hier is niets gemeten, de stippellijn is de visuele articulatie van "dit is een aanname". Ten
// tweede zijn er twee lijnen en geen aanwijzer: dit is een uitkomst om te lezen, niet historie om
// doorheen te bladeren, en zonder PanResponder kan een veeg hier ook nooit per ongeluk als "ander
// jaartal" gelezen worden terwijl dat antwoord al in de jaren-chips boven de grafiek staat.
import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Polygon, Polyline } from 'react-native-svg';
import { ProjectiePunt } from '../engine/doelstelling';
import { fmtBedrag } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { useValutaStand } from '../state/useValuta';

interface Props {
  punten: ProjectiePunt[];
  jaren: number;
}

// Lager dan PrijsGrafiek's standaard 180: deze grafiek heeft geen periode-pillen en geen tooltip
// die ruimte opeisen.
const HOOGTE = 140;
const PAD = 10;

export function ProjectieGrafiek({ punten, jaren }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijven de eindwaarden na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const [breedte, setBreedte] = useState(0);

  function opLayout(e: LayoutChangeEvent) {
    setBreedte(e.nativeEvent.layout.width);
  }

  if (punten.length < 2 || breedte === 0) {
    return <View style={[stijlen.leeg, { height: HOOGTE, backgroundColor: colors.verhoogd }]} onLayout={opLayout} />;
  }

  const alleWaarden = punten.flatMap(p => [p.totaalWaarde, p.ingelegdWaarde]);
  const min = Math.min(...alleWaarden);
  const max = Math.max(...alleWaarden);
  const bereik = max - min || 1;

  const yVoor = (v: number) => HOOGTE - PAD - ((v - min) / bereik) * (HOOGTE - PAD * 2);
  const xVoor = (i: number) => (i / (punten.length - 1)) * breedte;

  const lijn1Punten = punten.map((p, i) => `${xVoor(i)},${yVoor(p.totaalWaarde)}`).join(' ');
  const lijn2Punten = punten.map((p, i) => `${xVoor(i)},${yVoor(p.ingelegdWaarde)}`).join(' ');
  const vlakPunten = `0,${HOOGTE} ${lijn1Punten} ${breedte},${HOOGTE}`;

  const laatste = punten[punten.length - 1];
  const laatsteY1 = yVoor(laatste.totaalWaarde);
  const laatsteY2 = yVoor(laatste.ingelegdWaarde);

  // De twee eindlabels moeten van elkaar én van hun eigen lijn wegblijven. Beide op een vaste plek
  // zetten werkt niet: bij een klein verschil tussen de lijnen, of bij een negatief rendement waar
  // ze van plek wisselen, komen ze dan over elkaar of over de lijn heen te liggen. Dus krijgt het
  // label van de bovenste lijn zijn plek bóven dat eindpunt en dat van de onderste eronder, wat
  // ze altijd uit elkaar houdt, ook als de lijnen samenvallen bij een rendement van 0 procent.
  const LABEL_HOOGTE = 14;
  const klem = (y: number) => Math.min(HOOGTE - LABEL_HOOGTE, Math.max(0, y));
  const eersteIsBoven = laatsteY1 <= laatsteY2;
  const labelY1 = klem(eersteIsBoven ? laatsteY1 - LABEL_HOOGTE - 3 : laatsteY1 + 3);
  const labelY2 = klem(eersteIsBoven ? laatsteY2 + 3 : laatsteY2 - LABEL_HOOGTE - 3);

  return (
    <View>
      <View style={{ height: HOOGTE }} onLayout={opLayout}>
        <Svg
          width={breedte}
          height={HOOGTE}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Defs>
            <LinearGradient id="projectieVlak" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.cta} stopOpacity={0.2} />
              <Stop offset="100%" stopColor={colors.cta} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Polygon points={vlakPunten} fill="url(#projectieVlak)" />
          {/* Lijn 2 eerst getekend, zodat lijn 1 (de hoofdlijn) er bovenop ligt waar ze elkaar
              raken, bijvoorbeeld bij een rendement van 0 procent. */}
          <Polyline
            points={lijn2Punten}
            fill="none"
            stroke={colors.tekstGedimd}
            strokeWidth={1.5}
            strokeDasharray="4,4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points={lijn1Punten}
            fill="none"
            stroke={colors.cta}
            strokeWidth={2}
            strokeDasharray="4,4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>

        {/* Per lijn de eindwaarde bij het eigen eindpunt: bij deze grafiek gaat het alleen om waar
            elke reeks uitkomt, niet om het min/max van de hele reeks zoals bij PrijsGrafiek. */}
        <Text
          style={[Type.label, stijlen.labelBijLijn, { top: labelY1, color: colors.cta }]}
          numberOfLines={1}
        >
          {fmtBedrag(laatste.totaalWaarde)}
        </Text>
        <Text
          style={[Type.label, stijlen.labelBijLijn, { top: labelY2, color: colors.tekstGedimd }]}
          numberOfLines={1}
        >
          {fmtBedrag(laatste.ingelegdWaarde)}
        </Text>
      </View>

      <View style={stijlen.datumRij}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>Nu</Text>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>Over {jaren} jaar</Text>
      </View>

      <View style={stijlen.legenda}>
        <View style={stijlen.legendaItem}>
          <View style={[stijlen.bolletje, { backgroundColor: colors.cta }]} />
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>met rendement</Text>
        </View>
        <View style={stijlen.legendaItem}>
          <View style={stijlen.streepRij}>
            <View style={[stijlen.streepje, { backgroundColor: colors.tekstGedimd }]} />
            <View style={[stijlen.streepje, { backgroundColor: colors.tekstGedimd }]} />
            <View style={[stijlen.streepje, { backgroundColor: colors.tekstGedimd }]} />
          </View>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>alleen inleg</Text>
        </View>
      </View>
    </View>
  );
}

const stijlen = StyleSheet.create({
  leeg: { borderRadius: 8 },
  labelBijLijn: { position: 'absolute', right: 4 },
  datumRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  legenda: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.base,
    marginTop: spacing.sm,
  },
  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bolletje: { width: 7, height: 7, borderRadius: 4 },
  streepRij: { flexDirection: 'row', gap: 2, width: 12 },
  streepje: { width: 3, height: 1.5, borderRadius: 1 },
});
