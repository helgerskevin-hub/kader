import React from 'react';
import {
  Modal, ScrollView, View, Text, Pressable, StyleSheet, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CheckCircle, XCircle, History } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { fmtPrijs, fmtPct, fmtRR, fmtResultaatUsd } from '../engine/format';
import { PortfolioTrade } from '../state/portfolioTypes';
import { berekenStatistieken } from '../state/statistieken';

interface Props {
  zichtbaar: boolean;
  trades: PortfolioTrade[];
  onSluiten: () => void;
  onOpenDetail: (trade: PortfolioTrade) => void;
  onVerwijder: (id: string) => void;
}

const androidStatusBarPadding = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

export function HistorieScherm({ zichtbaar, trades, onSluiten, onOpenDetail, onVerwijder }: Props) {
  const { colors } = useTheme();

  const gesloten = trades
    .filter(t => t.status !== 'open')
    .sort((a, b) => (b.slotTijd ?? 0) - (a.slotTijd ?? 0));
  const stats = berekenStatistieken(trades);

  return (
    <Modal visible={zichtbaar} animationType="slide" onRequestClose={onSluiten} presentationStyle="fullScreen">
      <SafeAreaView style={[styles.root, { backgroundColor: colors.achtergrond }]}>
        <View style={[styles.header, { borderBottomColor: colors.rand, paddingTop: spacing.base + androidStatusBarPadding }]}>
          <View style={styles.headerLinks}>
            <History size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
            <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Historie</Text>
          </View>
          <Pressable
            onPress={onSluiten}
            style={styles.sluitKnop}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
            hitSlop={8}
          >
            <X size={22} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        </View>

        {gesloten.length === 0 ? (
          <View style={styles.leeg}>
            <History size={40} color={colors.tekstGedimd} strokeWidth={1.5} />
            <Text style={[Type.body, { color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.base, lineHeight: 24 }]}>
              Nog geen afgesloten trades. Zodra je een trade als gewonnen of verloren afsluit, verschijnt hij hier.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Samenvatting */}
            <View style={[styles.samenvatting, shadow.kaart, { backgroundColor: colors.kaart }]}>
              <View style={styles.statRij}>
                <Stat label="AFGESLOTEN" waarde={String(stats.afgesloten)} kleur={colors.tekstPrimair} />
                <Stat
                  label="TREFFERPERCENTAGE"
                  waarde={stats.trefferpercentage !== null ? `${Math.round(stats.trefferpercentage)}%` : '—'}
                  kleur={colors.tekstPrimair}
                />
                <Stat
                  label="GEM. R/R BEHAALD"
                  waarde={stats.gemBehaaldeRR !== null ? fmtRR(stats.gemBehaaldeRR) : '—'}
                  kleur={colors.tekstPrimair}
                />
              </View>
              {stats.totaalResultaatUsd !== null && (
                <View style={[styles.totaalRij, { borderTopColor: colors.rand }]}>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]}>TOTAAL RESULTAAT</Text>
                  <Text style={[Type.prijsGroot, { color: stats.totaalResultaatUsd >= 0 ? colors.winst : colors.verlies }]}>
                    {fmtResultaatUsd(stats.totaalResultaatUsd)}
                  </Text>
                </View>
              )}
            </View>

            {gesloten.map(trade => (
              <GeslotenKaart
                key={trade.id}
                trade={trade}
                onOpenDetail={() => onOpenDetail(trade)}
                onVerwijder={() => onVerwijder(trade.id)}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Stat({ label, waarde, kleur }: { label: string; waarde: string; kleur: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[Type.prijsGroot, { color: kleur }]}>{waarde}</Text>
      <Text style={[Type.overline, { color: colors.tekstGedimd, textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

function GeslotenKaart({ trade, onOpenDetail, onVerwijder }: {
  trade: PortfolioTrade;
  onOpenDetail: () => void;
  onVerwijder: () => void;
}) {
  const { colors } = useTheme();
  const gewonnen = trade.status === 'gewonnen';
  const statusKleur = gewonnen ? colors.winst : colors.verlies;
  const StatusIcon = gewonnen ? CheckCircle : XCircle;

  const heeftAantal = typeof trade.aantalCoins === 'number' && trade.aantalCoins > 0;
  const behaaldPct = trade.exitPrijs !== undefined
    ? (trade.exitPrijs - trade.entryPrijs) / trade.entryPrijs * 100
    : null;
  const behaaldUsd = trade.exitPrijs !== undefined && heeftAantal
    ? (trade.exitPrijs - trade.entryPrijs) * trade.aantalCoins!
    : null;
  const behaaldKleur = behaaldPct !== null ? (behaaldPct >= 0 ? colors.winst : colors.verlies) : colors.tekstGedimd;

  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart, borderLeftColor: statusKleur }]}>
      <Pressable onPress={onOpenDetail} accessibilityRole="button" accessibilityLabel={`${trade.symbool} detail bekijken`}>
        <View style={styles.kaartKop}>
          <View style={styles.kaartKopLinks}>
            <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{trade.symbool}</Text>
            {trade.naam ? <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{trade.naam}</Text> : null}
          </View>
          <View style={styles.kaartKopRechts}>
            <StatusIcon size={14} color={statusKleur} strokeWidth={1.75} />
            <Text style={[Type.caption, { color: statusKleur }]}>{gewonnen ? 'Gewonnen' : 'Verloren'}</Text>
          </View>
        </View>

        <View style={styles.niveaus}>
          <View style={styles.niveau}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>ENTRY</Text>
            <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>{fmtPrijs(trade.entryPrijs)}</Text>
          </View>
          <View style={styles.niveau}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>EXIT</Text>
            <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>
              {trade.exitPrijs !== undefined ? fmtPrijs(trade.exitPrijs) : '—'}
            </Text>
          </View>
          {behaaldPct !== null && (
            <View style={styles.niveau}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>BEHAALD</Text>
              <Text style={[Type.prijs, { color: behaaldKleur, fontSize: 13 }]}>
                {fmtPct(behaaldPct)}
                {behaaldUsd !== null ? `  ${fmtResultaatUsd(behaaldUsd)}` : ''}
              </Text>
            </View>
          )}
        </View>
      </Pressable>

      <View style={[styles.voet, { borderTopColor: colors.rand }]}>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
          {trade.datum}{trade.slotDatum ? ` → ${trade.slotDatum}` : ''}
        </Text>
        <Pressable
          onPress={onVerwijder}
          accessibilityRole="button"
          accessibilityLabel="Trade verwijderen"
          style={styles.voetKnop}
        >
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Verwijder</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  leeg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  scroll: { padding: spacing.base },
  samenvatting: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  statRij: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 4, flex: 1 },
  totaalRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  kaart: {
    borderRadius: radii.kaart,
    borderLeftWidth: 4,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  kaartKop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kaartKopLinks: { gap: 2, flex: 1 },
  kaartKopRechts: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  niveaus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  niveau: { gap: 2 },
  voet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  voetKnop: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.xs },
});
