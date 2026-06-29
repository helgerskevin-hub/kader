import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { fmtPrijs } from '../engine/format';

interface Props {
  stop: number;
  entry: number;
  doel: number;
}

export function LevelRow({ stop, entry, doel }: Props) {
  const { colors } = useTheme();

  // Relatieve positie van entry op de schaal stop→doel
  const range = doel - stop;
  const entryFractie = range > 0 ? (entry - stop) / range : 0.5;
  const entryPct = Math.round(Math.min(Math.max(entryFractie, 0.05), 0.95) * 100);

  return (
    <View style={styles.container}>
      {/* Labels */}
      <View style={styles.labelsRij}>
        <Text style={[Type.overline, { color: colors.verlies }]}>STOP</Text>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>ENTRY</Text>
        <Text style={[Type.overline, { color: colors.winst }]}>DOEL</Text>
      </View>

      {/* Balk */}
      <View style={[styles.balkContainer, { backgroundColor: colors.verhoogd }]}>
        <View style={[styles.stukStop, { backgroundColor: colors.verlies, flex: entryPct }]} />
        <View style={[styles.stukDoel, { backgroundColor: colors.winst, flex: 100 - entryPct }]} />
        {/* Entry-markering */}
        <View style={[styles.entryMarker, { left: `${entryPct}%` as unknown as number, borderColor: colors.cta }]} />
      </View>

      {/* Prijzen */}
      <View style={styles.prijzenRij}>
        <Text style={[Type.prijs, styles.prijs, { color: colors.verlies }]}>{fmtPrijs(stop)}</Text>
        <Text style={[Type.prijs, styles.prijsEntry, { color: colors.tekstPrimair }]}>{fmtPrijs(entry)}</Text>
        <Text style={[Type.prijs, styles.prijs, { color: colors.winst }]}>{fmtPrijs(doel)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  labelsRij: { flexDirection: 'row', justifyContent: 'space-between' },
  balkContainer: {
    height: 6,
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'visible',
    position: 'relative',
  },
  stukStop: { borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  stukDoel: { borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  entryMarker: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 12,
    borderRadius: 1,
    borderWidth: 1,
    backgroundColor: 'white',
    marginLeft: -1,
  },
  prijzenRij: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prijs: { fontSize: 12.5 },
  prijsEntry: { fontSize: 12.5, textAlign: 'center' },
});
