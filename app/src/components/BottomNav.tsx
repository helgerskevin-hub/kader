import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Activity, Zap, Wallet, Users } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';

export type Tab = 'markt' | 'kansen' | 'portfolio' | 'traders';

interface TabItem {
  id: Tab;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

const TABS: TabItem[] = [
  { id: 'markt', label: 'Markt', Icon: Activity },
  { id: 'kansen', label: 'Kansen', Icon: Zap },
  { id: 'portfolio', label: 'Portfolio', Icon: Wallet },
  { id: 'traders', label: 'Traders', Icon: Users },
];

interface Props {
  actief: Tab;
  onWissel: (tab: Tab) => void;
}

export function BottomNav({ actief, onWissel }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.nav, { backgroundColor: colors.kaart, borderTopColor: colors.rand }]}>
      {TABS.map(({ id, label, Icon }) => {
        const isActief = actief === id;
        const kleur = isActief ? colors.cta : colors.tekstGedimd;
        return (
          <Pressable
            key={id}
            style={styles.item}
            onPress={() => onWissel(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActief }}
            accessibilityLabel={label}
          >
            <Icon size={22} color={kleur} strokeWidth={isActief ? 2.2 : 1.75} />
            <Text style={[Type.caption, styles.label, { color: kleur }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'ios' ? 24 : spacing.sm,
    paddingTop: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: 3,
  },
  label: {
    fontSize: 11,
  },
});
