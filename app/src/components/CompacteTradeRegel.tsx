import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { fmtPrijs, fmtPct, fmtResultaatUsd } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { PortfolioTrade, richtingVan, tekenVan } from '../state/portfolioTypes';
import { bepaalAdvies } from '../state/advies';
import { AfbouwAdvies } from '../state/afbouw';
import { RichtingBadge } from './RichtingBadge';
import { PositieBalk } from './PositieBalk';
import { useValutaStand } from '../state/useValuta';

interface Props {
  trade: PortfolioTrade;
  livePrijs: number | undefined;
  onOpenDetail: (trade: PortfolioTrade) => void;
  onOpenActies: (trade: PortfolioTrade) => void;
  // Het klimaat-bewuste advies, als er iets te zeggen valt. In de compacte weergave is er geen
  // ruimte voor de hele zin, dus staat hier alleen het korte label; de volledige tekst zie je in de
  // uitgebreide weergave en in het detailscherm.
  afbouw?: AfbouwAdvies | null;
}

export function CompacteTradeRegel({ trade, livePrijs, onOpenDetail, onOpenActies, afbouw }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();

  const richting = richtingVan(trade);
  const teken = tekenVan(trade);
  const advies = bepaalAdvies(trade.entryPrijs, trade.stopLoss, trade.takeProfit, livePrijs, richting);
  const adviesKleur = advies.kleur === 'winst' ? colors.winst
    : advies.kleur === 'verlies' ? colors.verlies
    : advies.kleur === 'letOp' ? colors.letOp
    : colors.tekstGedimd;

  const heeftAantal = typeof trade.aantalCoins === 'number' && trade.aantalCoins > 0;
  const resultaatUsd = livePrijs !== undefined && heeftAantal
    ? (livePrijs - trade.entryPrijs) * trade.aantalCoins! * teken
    : null;
  const resultaatPct = livePrijs !== undefined
    ? (livePrijs - trade.entryPrijs) / trade.entryPrijs * 100 * teken
    : null;
  const resultaatKleur = resultaatPct !== null
    ? (resultaatPct >= 0 ? colors.winst : colors.verlies)
    : colors.tekstGedimd;

  const afbouwKleur = afbouw?.niveau === 'houden' ? colors.winst : colors.letOp;

  const accessibilityLabel = `${trade.symbool}${richting === 'short' ? ', short' : ''}, ${advies.kort}${afbouw ? `, ${afbouw.kort}` : ''}${resultaatPct !== null ? `, resultaat ${fmtPct(resultaatPct)}` : ''}`;

  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart, borderLeftColor: adviesKleur }]}>
      <Pressable
        style={styles.inhoud}
        onPress={() => onOpenDetail(trade)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={styles.rij}>
          <View style={styles.links}>
            {/* Symbool en SHORT-label naast elkaar: zonder dat label zijn een long en een short op
                dezelfde coin in deze compacte lijst niet uit elkaar te houden, terwijl hun
                resultaat precies tegenovergesteld is. */}
            <View style={styles.symboolRij}>
              <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]} numberOfLines={1}>
                {trade.symbool}
              </Text>
              <RichtingBadge richting={richting} />
            </View>
            <Text style={[Type.caption, { color: adviesKleur }]} numberOfLines={1}>
              {advies.kort}
            </Text>
            {afbouw && (
              <Text style={[Type.caption, { color: afbouwKleur }]} numberOfLines={1}>
                {afbouw.kort}
              </Text>
            )}
          </View>
          <View style={styles.rechts}>
            <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>
              {livePrijs !== undefined ? fmtPrijs(livePrijs) : '—'}
            </Text>
            <Text style={[Type.prijs, { color: resultaatKleur, fontSize: 13 }]}>
              {resultaatPct !== null
                ? `${fmtPct(resultaatPct)}${resultaatUsd !== null ? `  ${fmtResultaatUsd(resultaatUsd)}` : ''}`
                : '—'}
            </Text>
          </View>
        </View>

        <PositieBalk
          stop={trade.stopLoss}
          entry={trade.entryPrijs}
          doel={trade.takeProfit}
          live={livePrijs}
          kleur={adviesKleur}
          richting={richting}
        />
      </Pressable>

      <Pressable
        style={styles.kebab}
        onPress={() => onOpenActies(trade)}
        accessibilityRole="button"
        accessibilityLabel={`Acties voor ${trade.symbool}`}
        hitSlop={8}
      >
        <MoreVertical size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  symboolRij: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kaart: {
    borderRadius: radii.kaart,
    borderLeftWidth: 4,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inhoud: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    gap: 4,
  },
  rij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  links: { gap: 2, flexShrink: 1, marginRight: spacing.sm },
  rechts: { alignItems: 'flex-end' },
  kebab: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
