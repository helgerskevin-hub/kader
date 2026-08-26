import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Richting } from '../state/portfolioTypes';

interface Props {
  stop: number;
  entry: number;
  doel: number;
  live: number | undefined;
  kleur: string;
  // Ontbreekt = 'long', zodat bestaande aanroepen blijven werken. Bij een short liggen stop en doel
  // andersom (stop boven de entry, doel eronder), dus range wordt anders negatief en klopt de balk niet.
  richting?: Richting;
}

// Kale balk van stop tot doel, met een markering op de live-prijs. Geen labels of prijzen,
// bedoeld voor de compacte tradelijst waar de volledige LevelRow te hoog is.
export function PositieBalk({ stop, entry, doel, live, kleur, richting = 'long' }: Props) {
  const { colors } = useTheme();

  if (stop <= 0 || doel <= 0 || live === undefined) return null;

  // De balk loopt altijd van lage naar hoge prijs. Bij long is dat stop→doel, bij short doel→stop:
  // zo blijft de fractieberekening positief in plaats van dat "doel - stop" negatief wordt.
  const isShort = richting === 'short';
  const laag = isShort ? doel : stop;
  const hoog = isShort ? stop : doel;
  const range = hoog - laag;

  const entryFractie = range > 0 ? (entry - laag) / range : 0.5;
  const entryPct = Math.round(Math.min(Math.max(entryFractie, 0.02), 0.98) * 100);

  const liveFractie = range > 0 ? (live - laag) / range : 0.5;
  const liveClamped = Math.min(Math.max(liveFractie * 100, 1), 99);

  // Welke kleur bij het lage en het hoge uiteinde hoort, wisselt mee met de richting: bij long is
  // laag de stop (rood) en hoog het doel (groen); bij short is het net andersom.
  const laagKleur = isShort ? colors.winst : colors.verlies;
  const hoogKleur = isShort ? colors.verlies : colors.winst;

  return (
    <View style={[styles.balkContainer, { backgroundColor: colors.verhoogd }]}>
      <View style={[styles.stukLinks, { backgroundColor: laagKleur, flex: entryPct }]} />
      <View style={[styles.stukRechts, { backgroundColor: hoogKleur, flex: 100 - entryPct }]} />
      <View style={[styles.liveMarker, { left: `${liveClamped}%` as unknown as number, backgroundColor: kleur }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  balkContainer: {
    height: 4,
    borderRadius: 2,
    flexDirection: 'row',
    overflow: 'visible',
    position: 'relative',
  },
  stukLinks: { borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  stukRechts: { borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  liveMarker: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
});
