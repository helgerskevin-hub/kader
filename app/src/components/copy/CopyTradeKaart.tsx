// Kaart in de Feed: één trade van een favoriete belegger. Bovenaan wie en wanneer, dan de coin, de
// niveaus als stop-doel-baan, hoeveel de koers sindsdien bewoog, en de knop. Of de knop actief is
// beslist beoordeelCopyTrade in engine/copyTrading.ts; deze kaart toont alleen de uitkomst, met de
// reden erbij als kopiëren niet (meer) kan.
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle, Copy as CopyIcoon } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, shadow, spacing } from '../../theme/tokens';
import { fmtBedrag, fmtPct, fmtPrijs } from '../../engine/format';
import { koersFactor } from '../../engine/etoroSymbolen';
import { COIN_INFO } from '../../engine/coinInfo';
import type { CopyStand } from '../../engine/copyTrading';
import type { FeedItem } from '../../state/copyOpslag';
import { CoinLogo } from '../CoinLogo';
import { StopDoelBaan } from '../StopDoelBaan';
import { Drukbaar } from '../Drukbaar';
import { TraderAvatar } from './TraderAvatar';

const DOLLARS = { valuta: 'USD' } as const;

export function tijdGeleden(ms: number, nu = Date.now()): string {
  const min = Math.max(0, Math.round((nu - ms) / 60000));
  if (min < 1) return 'net';
  if (min < 60) return `${min} min`;
  const uur = Math.round(min / 60);
  if (uur < 24) return `${uur} uur`;
  const dag = Math.round(uur / 24);
  return dag === 1 ? '1 dag' : `${dag} dagen`;
}

interface Props {
  item: FeedItem;
  stand: CopyStand;
  // Live koers in Kaders eenheid, of null.
  koers: number | null;
  bedragUsd: number;
  magHandelen: boolean;
  bezig: boolean;
  // Kort oplichten, als je via een melding binnenkomt.
  uitgelicht?: boolean;
  onKopieer: () => void;
}

export const CopyTradeKaart = React.memo(function CopyTradeKaart({
  item, stand, koers, bedragUsd, magHandelen, bezig, uitgelicht = false, onKopieer,
}: Props) {
  const { colors } = useTheme();
  const factor = item.symbool ? koersFactor(item.symbool) : 1;
  const entry = item.openRate / factor;
  const stop = item.stopLossRate ? item.stopLossRate / factor : 0;
  const doel = item.takeProfitRate ? item.takeProfitRate / factor : 0;
  const heeftBaan = stop > 0 && doel > 0 && stop < entry && doel > entry;
  const symbool = item.symbool ?? '?';
  const naam = item.symbool ? COIN_INFO[item.symbool]?.naam ?? item.symbool : 'Onbekende coin';
  const kopieerbaar = stand.soort === 'kopieerbaar' && !item.gekopieerd;

  // De adviesrand uit de huisstijl: groen als je kunt kopiëren, amber als je te laat bent, anders
  // neutraal. Altijd met een tekstregel ernaast, nooit kleur alleen.
  const rand = item.gekopieerd ? colors.rand
    : kopieerbaar ? colors.winst
    : stand.soort === 'te-laat' || stand.soort === 'onder-stop' ? colors.letOp
    : colors.rand;

  let reden: string | null = null;
  if (!item.gekopieerd) {
    if (stand.soort === 'te-laat') reden = `Te laat: de koers staat ${fmtPct(stand.verschuivingPct)} ten opzichte van de trader.`;
    else if (stand.soort === 'onder-stop') reden = 'De koers staat al onder de stop van de trader.';
    else if (stand.soort === 'gesloten') reden = `${item.username} heeft deze positie gesloten.`;
    else if (stand.soort === 'short') reden = 'Short, Kader kopieert alleen long.';
    else if (stand.soort === 'buiten-kader') reden = 'Deze coin hoort niet bij de 57 die Kader volgt.';
    else if (!magHandelen) reden = 'Koppel eToro met schrijfrecht om te kopiëren.';
  }

  const verschuiving = stand.soort === 'kopieerbaar' && stand.verschuivingPct !== null
    ? `Nu ${fmtPrijs(koers ?? entry)} · ${fmtPct(stand.verschuivingPct)} sinds de trader`
    : koers !== null ? `Nu ${fmtPrijs(koers)}` : null;

  const label = `${item.username} ${item.isBuy ? 'kocht' : 'shortte'} ${symbool} op ${fmtPrijs(entry)}, ${tijdGeleden(item.openTijd ?? item.gezien)} geleden.`;

  return (
    <View
      style={[
        styles.kaart, shadow.kaart,
        { backgroundColor: colors.kaart, borderLeftColor: rand },
        uitgelicht && { borderColor: colors.cta, borderWidth: 1.5, borderLeftWidth: 4 },
      ]}
      accessible={false}
    >
      <View style={styles.kop} accessible accessibilityLabel={label}>
        <TraderAvatar username={item.username} grootte={24} />
        <Text style={[Type.sectiekop, styles.flex, { color: colors.tekstPrimair }]} numberOfLines={1}>{item.username}</Text>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{tijdGeleden(item.openTijd ?? item.gezien)}</Text>
      </View>

      <View style={styles.coin}>
        <CoinLogo symbool={symbool} grootte={32} />
        <Text style={[Type.body, styles.flex, { color: colors.tekstPrimair }]} numberOfLines={1}>{naam}</Text>
        <View style={[styles.pil, { backgroundColor: colors.verhoogd }]}>
          <Text style={[Type.overline, { color: colors.tekstPrimair }]}>{item.isBuy ? 'LONG' : 'SHORT'}</Text>
        </View>
      </View>

      {heeftBaan ? (
        <View style={styles.baan}>
          <StopDoelBaan stop={stop} entry={entry} doel={doel} live={koers ?? undefined} labels accessible={false} />
        </View>
      ) : (
        <Text style={[Type.prijs, styles.regel, { color: colors.tekstPrimair }]}>
          Instap {fmtPrijs(entry)}{stop > 0 ? ` · stop ${fmtPrijs(stop)}` : ''}{doel > 0 ? ` · doel ${fmtPrijs(doel)}` : ''}
        </Text>
      )}

      {verschuiving && (
        <Text style={[Type.label, styles.regel, { color: colors.tekstGedimd, fontSize: 12 }]}>{verschuiving}</Text>
      )}
      <Text style={[Type.label, styles.regel, { color: colors.tekstGedimd, fontSize: 12 }]}>
        Jij: {fmtBedrag(bedragUsd, DOLLARS)} · hefboom 1x{item.leverage > 1 ? ` (trader ${item.leverage}x)` : ''}
      </Text>

      {item.gekopieerd ? (
        <View style={styles.status}>
          <CheckCircle size={16} color={colors.winst} strokeWidth={1.75} />
          <Text style={[Type.caption, { color: colors.tekstPrimair }]}>Gekopieerd</Text>
        </View>
      ) : reden ? (
        <View style={styles.status}>
          <AlertTriangle size={16} color={rand === colors.letOp ? colors.letOp : colors.tekstGedimd} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.flex, { color: colors.tekstGedimd }]}>{reden}</Text>
        </View>
      ) : (
        <Drukbaar
          onPress={onKopieer}
          disabled={bezig}
          haptiek="tik"
          style={[styles.knop, { backgroundColor: colors.cta }]}
          accessibilityRole="button"
          accessibilityLabel={`Kopieer ${symbool} van ${item.username} voor ${fmtBedrag(bedragUsd, DOLLARS)}`}
        >
          {bezig
            ? <ActivityIndicator color="#FFFFFF" />
            : <CopyIcoon size={18} color="#FFFFFF" strokeWidth={1.75} />}
          <Text style={[Type.body, styles.knopTekst]}>Kopieer voor {fmtBedrag(bedragUsd, DOLLARS)}</Text>
        </Drukbaar>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
  },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  coin: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  pil: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  baan: { marginTop: spacing.md },
  regel: { marginTop: spacing.sm },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, minHeight: 44 },
  knop: {
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: radii.knop,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  knopTekst: { color: '#FFFFFF', fontWeight: '600' },
});
