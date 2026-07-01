import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';

interface Props {
  titel: string;
  meta?: string;
  rechts?: React.ReactNode;
}

export function ScreenHeader({ titel, meta, rechts }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: colors.rand }]}>
      <View style={styles.links}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{titel}</Text>
        {meta ? (
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{meta}</Text>
        ) : null}
      </View>
      {rechts ? <View style={styles.rechts}>{rechts}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  links: {
    gap: 2,
  },
  rechts: {
    alignItems: 'flex-end',
  },
});
