import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TrendingDown, CheckCircle, ArrowDownCircle } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { infoVoor } from '../engine/coinInfo';
import { fmtRR, fmtScore } from '../engine/format';
import { DREMPEL_SHORT } from '../engine/drempels';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { LevelRow } from './LevelRow';
import { RichtingBadge } from './RichtingBadge';

interface Props {
  signalen: Trade[];
  magHandelen: boolean;
  onGetrade: (trade: Trade) => void;
  onKoop?: (trade: Trade) => void;
}

// De actionable tegenhanger van "Wie houdt stand?": short-signalen, alleen zichtbaar zolang het
// klimaat ongunstig is (analyseerMarkt levert de lijst anders leeg aan). Bewust een eigen kaart en
// geen hergebruik van TradeCard: die kleurt de score op long-schaal (hoog = goed), terwijl een short
// juist onder DREMPEL_SHORT vuurt en een lage score hier het sterke signaal is. Diezelfde kleur op
// een short-rij plakken zou precies het omgekeerde beweren van wat de score betekent.
export function ShortSignalenKaart({ signalen, magHandelen, onGetrade, onKoop }: Props) {
  const { colors } = useTheme();

  if (signalen.length === 0) return null;

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.kaart, borderColor: colors.goud }]}>
      <View style={styles.titelRij}>
        <TrendingDown size={16} color={colors.goud} strokeWidth={2} />
        <Text style={[Type.overline, { color: colors.goud }]}>SHORT-SIGNALEN</Text>
      </View>

      <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
        Coins die het zwakst scoren (onder de {DREMPEL_SHORT}), alleen zichtbaar zolang het
        marktklimaat ongunstig is. Een short verdient als de koers daalt en verliest als hij stijgt:
        het is het spiegelbeeld van een gewone trade, geen koopsignaal.
      </Text>

      <View style={styles.lijst}>
        {signalen.map(trade => (
          <ShortRegel
            key={trade.symbool}
            trade={trade}
            magHandelen={magHandelen}
            onGetrade={onGetrade}
            onKoop={onKoop}
          />
        ))}
      </View>
    </View>
  );
}

function ShortRegel({ trade, magHandelen, onGetrade, onKoop }: {
  trade: Trade;
  magHandelen: boolean;
  onGetrade: (trade: Trade) => void;
  onKoop?: (trade: Trade) => void;
}) {
  const { colors } = useTheme();
  const naam = infoVoor(trade.symbool).naam;

  return (
    <View style={[styles.regel, { backgroundColor: colors.verhoogd }]}>
      <View style={styles.regelKop}>
        <View style={styles.regelKopLinks}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{trade.symbool}</Text>
          <RichtingBadge richting="short" />
        </View>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>SCORE {fmtScore(trade.score)}</Text>
      </View>
      <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{naam}</Text>

      <View style={styles.niveaus}>
        <LevelRow stop={trade.stopLoss} entry={trade.entry} doel={trade.takeProfit} richting="short" />
      </View>

      <Text style={[Type.caption, { color: colors.tekstGedimd }]}>R/R {fmtRR(trade.rr)}</Text>

      <View style={[styles.actiesRij, { borderTopColor: colors.rand }]}>
        <Pressable
          style={styles.actieKnop}
          onPress={() => onGetrade(trade)}
          accessibilityLabel={`${trade.symbool} short getrade`}
          accessibilityRole="button"
        >
          <CheckCircle size={15} color={colors.winst} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.actieLabel, { color: colors.winst }]}>Getrade</Text>
        </Pressable>

        {magHandelen && onKoop && (
          <>
            <View style={[styles.scheiding, { backgroundColor: colors.rand }]} />
            <Pressable
              style={styles.actieKnop}
              onPress={() => onKoop(trade)}
              accessibilityLabel={`${trade.symbool} shorten via eToro`}
              accessibilityRole="button"
            >
              <ArrowDownCircle size={15} color={colors.goud} strokeWidth={1.75} />
              <Text style={[Type.caption, styles.actieLabel, { color: colors.goud }]}>Short</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.kaart,
    borderLeftWidth: 3,
    padding: spacing.base,
    gap: spacing.sm,
  },
  titelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lijst: { gap: spacing.sm },
  regel: {
    borderRadius: radii.veld,
    padding: spacing.md,
    gap: spacing.xs,
  },
  regelKop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  regelKopLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  niveaus: { marginTop: spacing.xs },
  actiesRij: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  actieKnop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  scheiding: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.sm,
  },
  actieLabel: { fontSize: 12 },
});
