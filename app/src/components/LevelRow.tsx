import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { fmtPrijs } from '../engine/format';
import { useValutaStand } from '../state/useValuta';

interface Props {
  stop: number;
  entry: number;
  doel: number;
}

export function LevelRow({ stop, entry, doel }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();

  // De rij loopt van lage naar hoge prijs: stop links, doel rechts.
  const range = doel - stop;
  const entryFractie = range > 0 ? (entry - stop) / range : 0.5;
  const entryPct = Math.round(Math.min(Math.max(entryFractie, 0.05), 0.95) * 100);

  const laagKleur = colors.verlies;
  const hoogKleur = colors.winst;

  return (
    <View style={styles.container}>
      {/* Labels */}
      <View style={styles.labelsRij}>
        <View style={styles.labelMetMerk}>
          <Text style={[Type.overline, { color: laagKleur }]}>STOP</Text>
        </View>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>ENTRY</Text>
        <View style={styles.labelMetMerk}>
          <Text style={[Type.overline, { color: hoogKleur }]}>DOEL</Text>
        </View>
      </View>

      {/* Balk */}
      <View style={[styles.balkContainer, { backgroundColor: colors.verhoogd }]}>
        <View style={[styles.stukLinks, { backgroundColor: laagKleur, flex: entryPct }]} />
        <View style={[styles.stukRechts, { backgroundColor: hoogKleur, flex: 100 - entryPct }]} />
        {/* Entry-markering */}
        <View style={[styles.entryMarker, { left: `${entryPct}%` as unknown as number, borderColor: colors.cta }]} />
      </View>

      {/* Prijzen */}
      <View style={styles.prijzenRij}>
        <Text style={[Type.prijs, styles.prijs, { color: laagKleur }]}>{fmtPrijs(stop)}</Text>
        <Text style={[Type.prijs, styles.prijsEntry, { color: colors.tekstPrimair }]}>{fmtPrijs(entry)}</Text>
        <Text style={[Type.prijs, styles.prijs, { color: hoogKleur }]}>{fmtPrijs(doel)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  labelsRij: { flexDirection: 'row', justifyContent: 'space-between' },
  labelMetMerk: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balkContainer: {
    height: 6,
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'visible',
    position: 'relative',
  },
  stukLinks: { borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  stukRechts: { borderTopRightRadius: 3, borderBottomRightRadius: 3 },
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
