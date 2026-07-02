import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii } from '../theme/tokens';

interface Props {
  score: number;
}

export function ScoreBadge({ score }: Props) {
  const { colors } = useTheme();
  const kleur = score >= 70 ? colors.winst : score >= 40 ? colors.letOp : colors.verlies;
  const achtergrond = kleur + '1A';

  return (
    <View style={[styles.badge, { backgroundColor: achtergrond, borderColor: kleur }]}>
      <Text style={[Type.label, styles.getal, { color: kleur }]}>{Math.round(score)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1.5,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
  },
  getal: {
    fontSize: 12,
    fontWeight: '600',
  },
});
