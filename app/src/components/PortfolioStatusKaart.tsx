import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { RefreshCw, CloudDownload, History } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { fmtPrijs, fmtPct, fmtResultaatUsd, relatieveTijd } from '../engine/format';
import { PortfolioWaarde } from '../state/statistieken';
import { bepaalSyncStand } from '../state/syncStatus';
import { AnimatedGetal } from './AnimatedGetal';

const fmtResultaatPct = (n: number) => `(${fmtPct(n)})`;

interface Props {
  waarde: PortfolioWaarde;
  syncing: boolean;
  // Tijdstip van de laatste geslaagde sync (epoch-ms) en of de laatste poging mislukte,
  // samen goed voor de kleurindicatie op het sync-icoon.
  laatsteSync: number | null;
  syncFout: boolean;
  // Foutmelding van de laatste eToro-sync, of null. Los van syncFout, want de koersen kunnen
  // gewoon ververst zijn terwijl juist het ophalen van je posities mislukte.
  etoroFout: string | null;
  etoroBezig: boolean;
  afgesloten: number;
  onVerversen: () => void;
  onImporteren: () => void;
  onOpenHistorie: () => void;
}

export function PortfolioStatusKaart({
  waarde, syncing, laatsteSync, syncFout, etoroFout, etoroBezig, afgesloten,
  onVerversen, onImporteren, onOpenHistorie,
}: Props) {
  const { colors } = useTheme();

  const heeftWaardering = waarde.gewaardeerd > 0;
  const resultaatKleur = waarde.ongerealiseerdUsd >= 0 ? colors.winst : colors.verlies;

  // Kleurindicatie voor het sync-icoon: groen = actueel, oranje = verouderd of eToro mislukt,
  // rood = te oud of de koersen zelf mislukten, blauw = bezig.
  const stand = bepaalSyncStand({ laatsteSync, syncFout, syncing, etoroFout });
  const syncKleur = colors[stand.kleur];
  // Bij een eToro-fout niet "3 min geleden" tonen: de koersen zijn dan wel bij, maar je posities
  // niet, en dat verschil moet uit de regel zelf blijken.
  const syncKort = syncing
    ? 'Bijwerken...'
    : stand.niveau === 'etoro-fout' ? 'eToro mislukt'
    : laatsteSync ? relatieveTijd(laatsteSync) : 'Nog niet';

  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      {/* Kop: label + acties */}
      <View style={styles.kop}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>PORTFOLIOWAARDE (OPEN)</Text>
        <View style={styles.acties}>
          <Pressable
            onPress={onVerversen}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={`Synchroniseren. ${stand.wanneer}. ${stand.advies}`}
            style={styles.actieKnop}
          >
            {syncing
              ? <ActivityIndicator size="small" color={syncKleur} />
              : <RefreshCw size={18} color={syncKleur} strokeWidth={1.75} />}
          </Pressable>
          <Pressable
            onPress={onImporteren}
            disabled={etoroBezig}
            accessibilityRole="button"
            accessibilityLabel="Importeer uit eToro"
            style={styles.actieKnop}
          >
            {etoroBezig
              ? <ActivityIndicator size="small" color={colors.cta} />
              : <CloudDownload size={18} color={syncKleur} strokeWidth={1.75} />}
          </Pressable>
        </View>
      </View>

      {/* Grote waarde */}
      {heeftWaardering ? (
        <AnimatedGetal
          waarde={waarde.huidigeWaardeUsd}
          format={fmtPrijs}
          style={[Type.display, { color: colors.tekstPrimair }]}
        />
      ) : (
        <Text style={[Type.display, { color: colors.tekstPrimair }]}>—</Text>
      )}

      {/* Ongerealiseerd resultaat */}
      {heeftWaardering ? (
        <View style={[styles.resultaat, styles.resultaatRij]}>
          <AnimatedGetal
            waarde={waarde.ongerealiseerdUsd}
            format={fmtResultaatUsd}
            style={[Type.prijs, { color: resultaatKleur }]}
          />
          {waarde.ongerealiseerdPct !== null && (
            <AnimatedGetal
              waarde={waarde.ongerealiseerdPct}
              format={fmtResultaatPct}
              style={[Type.prijs, { color: resultaatKleur, marginLeft: spacing.sm }]}
            />
          )}
        </View>
      ) : (
        <Text style={[Type.caption, styles.resultaat, { color: colors.tekstGedimd }]}>
          {waarde.openPosities === 0
            ? 'Nog geen open posities.'
            : 'Nog geen live koersen om je posities te waarderen.'}
        </Text>
      )}

      {/* Detailregels */}
      <View style={[styles.detailRij, { borderTopColor: colors.rand }]}>
        <View style={styles.detail}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>INGELEGD</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>
            {heeftWaardering ? fmtPrijs(waarde.ingelegdUsd) : '—'}
          </Text>
        </View>
        <View style={styles.detail}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>OPEN POSITIES</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>{waarde.openPosities}</Text>
        </View>
        <View style={styles.detail}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>LAATSTE SYNC</Text>
          <Text style={[Type.caption, { color: syncKleur, fontWeight: '600' }]}>{syncKort}</Text>
        </View>
      </View>

      {/* Advies om te synchroniseren zodra de data niet meer vers is */}
      {stand.niveau !== 'vers' && stand.niveau !== 'bezig' && (
        <Text style={[Type.caption, styles.melding, { color: syncKleur }]}>
          {stand.advies}
        </Text>
      )}

      {/* Melding bij posities zonder live prijs */}
      {waarde.zonderLivePrijs > 0 && (
        <Text style={[Type.caption, styles.melding, { color: colors.tekstGedimd }]}>
          {waarde.zonderLivePrijs} {waarde.zonderLivePrijs === 1 ? 'positie telt' : 'posities tellen'} niet mee in de waarde (geen aantal of live koers).
        </Text>
      )}

      {/* Historie-knop */}
      <Pressable
        onPress={onOpenHistorie}
        accessibilityRole="button"
        accessibilityLabel="Bekijk historie van afgesloten trades"
        style={[styles.historieKnop, { borderTopColor: colors.rand }]}
      >
        <History size={16} color={colors.cta} strokeWidth={1.75} />
        <Text style={[Type.caption, { color: colors.cta, fontWeight: '600' }]}>
          Historie{afgesloten > 0 ? ` (${afgesloten} afgesloten)` : ''}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  kop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  acties: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actieKnop: {
    minHeight: 36,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultaat: {
    marginTop: 2,
  },
  resultaatRij: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  detailRij: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detail: { gap: 2 },
  melding: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  historieKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
});
