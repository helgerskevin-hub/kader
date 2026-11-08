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
});
