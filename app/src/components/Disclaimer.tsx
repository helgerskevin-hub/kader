import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';

export function Disclaimer() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { borderTopColor: colors.rand }]}>
      <Text style={[Type.caption, { color: colors.tekstGedimd, textAlign: 'center' }]}>
        Geen financieel advies · check altijd de live koers op eToro
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
