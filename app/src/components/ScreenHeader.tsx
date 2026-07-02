import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Settings } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { InstellingenSheet } from './InstellingenSheet';

interface Props {
  titel: string;
  meta?: string;
  rechts?: React.ReactNode;
}

export function ScreenHeader({ titel, meta, rechts }: Props) {
  const { colors } = useTheme();
  const [instellingenOpen, setInstellingenOpen] = useState(false);

  return (
    <View style={[styles.header, { borderBottomColor: colors.rand }]}>
      <View style={styles.links}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{titel}</Text>
        {meta ? (
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{meta}</Text>
        ) : null}
      </View>
      <View style={styles.rechtsGroep}>
        {rechts ? <View style={styles.rechts}>{rechts}</View> : null}
        <Pressable
          onPress={() => setInstellingenOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Instellingen"
          style={styles.tandwiel}
        >
          <Settings size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>
      <InstellingenSheet zichtbaar={instellingenOpen} onSluiten={() => setInstellingenOpen(false)} />
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
  rechtsGroep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rechts: {
    alignItems: 'flex-end',
  },
  tandwiel: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
