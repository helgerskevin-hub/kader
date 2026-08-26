import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { fmtPrijs } from '../engine/format';
import { useValutaStand } from '../state/useValuta';
import { Richting } from '../state/portfolioTypes';

interface Props {
  stop: number;
  entry: number;
  doel: number;
  // Ontbreekt = 'long', zodat bestaande aanroepen blijven werken. Bij een short liggen stop en doel
  // andersom (stop boven de entry, doel eronder), dus zowel de balk als de STOP/DOEL-volgorde moeten
  // meedraaien.
  richting?: Richting;
}

export function LevelRow({ stop, entry, doel, richting = 'long' }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();

  // De rij loopt altijd van lage naar hoge prijs. Bij long is dat stop→doel, bij short doel→stop:
  // zo blijft de fractieberekening positief in plaats van dat "doel - stop" negatief wordt.
  const isShort = richting === 'short';
  const laag = isShort ? doel : stop;
  const hoog = isShort ? stop : doel;
  const range = hoog - laag;
  const entryFractie = range > 0 ? (entry - laag) / range : 0.5;
  const entryPct = Math.round(Math.min(Math.max(entryFractie, 0.05), 0.95) * 100);

  // Welke kleur en welk label bij het lage en het hoge uiteinde horen, wisselt mee met de richting:
  // bij long is laag de stop (rood) en hoog het doel (groen); bij short is het net andersom.
  const laagKleur = isShort ? colors.winst : colors.verlies;
  const hoogKleur = isShort ? colors.verlies : colors.winst;
  const laagLabel = isShort ? 'DOEL' : 'STOP';
  const hoogLabel = isShort ? 'STOP' : 'DOEL';

  return (
    <View style={styles.container}>
      {/* Labels */}
      <View style={styles.labelsRij}>
        <Text style={[Type.overline, { color: laagKleur }]}>{laagLabel}</Text>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>ENTRY</Text>
        <Text style={[Type.overline, { color: hoogKleur }]}>{hoogLabel}</Text>
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
        <Text style={[Type.prijs, styles.prijs, { color: laagKleur }]}>{fmtPrijs(isShort ? doel : stop)}</Text>
        <Text style={[Type.prijs, styles.prijsEntry, { color: colors.tekstPrimair }]}>{fmtPrijs(entry)}</Text>
        <Text style={[Type.prijs, styles.prijs, { color: hoogKleur }]}>{fmtPrijs(isShort ? stop : doel)}</Text>
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
