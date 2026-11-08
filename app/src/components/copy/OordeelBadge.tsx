// Het eToro-oordeel uit de huisstijl: KOPIEER, VOLG of VERMIJD. Altijd met label, nooit kleur alleen.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii } from '../../theme/tokens';
import type { Oordeel } from '../../engine/copyTrading';

export function OordeelBadge({ oordeel }: { oordeel: Oordeel }) {
  const { colors } = useTheme();
  const kleur = oordeel === 'KOPIEER' ? colors.winst : oordeel === 'VOLG' ? colors.letOp : colors.verlies;
  return (
    <View style={[styles.badge, { borderColor: kleur, backgroundColor: kleur + '1A' }]}>
      <Text style={[Type.overline, { color: kleur }]}>{oordeel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  score: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 36,
    alignItems: 'center',
  },
});

// De Kader-score als neutraal getal naast het oordeel. Bewust niet de gekleurde ScoreBadge van de
// coins: die kleurt vanaf 40 amber, terwijl een trader onder de 50 al VERMIJD is. Het oordeel
// draagt de kleur, het getal niet.
export function ScorePil({ score }: { score: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.score, { borderColor: colors.rand, backgroundColor: colors.verhoogd }]}>
      <Text style={[Type.label, { color: colors.tekstPrimair, fontSize: 12 }]}>{Math.round(score)}</Text>
    </View>
  );
}
