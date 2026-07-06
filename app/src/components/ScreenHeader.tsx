import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Settings, BookOpen } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { InstellingenSheet } from './InstellingenSheet';
import { KaderLogo } from './KaderLogo';
import { AchtergrondScherm } from './AchtergrondScherm';

interface Props {
  titel: string;
  meta?: string;
  rechts?: React.ReactNode;
}

export function ScreenHeader({ titel, meta, rechts }: Props) {
  const { colors } = useTheme();
  const [instellingenOpen, setInstellingenOpen] = useState(false);
  const [uitlegOpen, setUitlegOpen] = useState(false);

  return (
    <View style={[styles.header, { borderBottomColor: colors.rand }]}>
      <View style={styles.linksGroep}>
        <KaderLogo size={26} variant="outline" />
        <View style={styles.links}>
          <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{titel}</Text>
          {meta ? (
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{meta}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rechtsGroep}>
        {rechts ? <View style={styles.rechts}>{rechts}</View> : null}
        <Pressable
          onPress={() => setUitlegOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Achtergrond informatie"
          style={styles.tandwiel}
        >
          <BookOpen size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
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
      <AchtergrondScherm zichtbaar={uitlegOpen} onSluiten={() => setUitlegOpen(false)} />
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
  linksGroep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  links: {
    gap: 2,
    flexShrink: 1,
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
