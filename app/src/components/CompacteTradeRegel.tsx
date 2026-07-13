import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { fmtPrijs, fmtPct, fmtResultaatUsd } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { PortfolioTrade } from '../state/portfolioTypes';
import { bepaalAdvies } from '../state/advies';
import { PositieBalk } from './PositieBalk';

interface Props {
  trade: PortfolioTrade;
  livePrijs: number | undefined;
  onOpenDetail: (trade: PortfolioTrade) => void;
  onOpenActies: (trade: PortfolioTrade) => void;
}

export function CompacteTradeRegel({ trade, livePrijs, onOpenDetail, onOpenActies }: Props) {
  const { colors } = useTheme();

  const advies = bepaalAdvies(trade.entryPrijs, trade.stopLoss, trade.takeProfit, livePrijs);
  const adviesKleur = advies.kleur === 'winst' ? colors.winst
    : advies.kleur === 'verlies' ? colors.verlies
    : advies.kleur === 'letOp' ? colors.letOp
    : colors.tekstGedimd;

  const heeftAantal = typeof trade.aantalCoins === 'number' && trade.aantalCoins > 0;
  const resultaatUsd = livePrijs !== undefined && heeftAantal
    ? (livePrijs - trade.entryPrijs) * trade.aantalCoins!
    : null;
  const resultaatPct = livePrijs !== undefined
    ? (livePrijs - trade.entryPrijs) / trade.entryPrijs * 100
    : null;
  const resultaatKleur = resultaatPct !== null
    ? (resultaatPct >= 0 ? colors.winst : colors.verlies)
    : colors.tekstGedimd;

  const accessibilityLabel = `${trade.symbool}, ${advies.kort}${resultaatPct !== null ? `, resultaat ${fmtPct(resultaatPct)}` : ''}`;

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
            <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]} numberOfLines={1}>
              {trade.symbool}
            </Text>
            <Text style={[Type.caption, { color: adviesKleur }]} numberOfLines={1}>
              {advies.kort}
            </Text>
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
