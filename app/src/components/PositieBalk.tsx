import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  stop: number;
  entry: number;
  doel: number;
  live: number | undefined;
  kleur: string;
}

// Kale balk van stop tot doel, met een markering op de live-prijs. Geen labels of prijzen,
// bedoeld voor de compacte tradelijst waar de volledige LevelRow te hoog is.
export function PositieBalk({ stop, entry, doel, live, kleur }: Props) {
  const { colors } = useTheme();

  if (stop <= 0 || doel <= 0 || live === undefined) return null;

  const range = doel - stop;
  const entryFractie = range > 0 ? (entry - stop) / range : 0.5;
  const entryPct = Math.round(Math.min(Math.max(entryFractie, 0.02), 0.98) * 100);

  const liveFractie = range > 0 ? (live - stop) / range : 0.5;
  const liveClamped = Math.min(Math.max(liveFractie * 100, 1), 99);

  return (
    <View style={[styles.balkContainer, { backgroundColor: colors.verhoogd }]}>
      <View style={[styles.stukStop, { backgroundColor: colors.verlies, flex: entryPct }]} />
      <View style={[styles.stukDoel, { backgroundColor: colors.winst, flex: 100 - entryPct }]} />
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
  stukStop: { borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  stukDoel: { borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  liveMarker: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
});
