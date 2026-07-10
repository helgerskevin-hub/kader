import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // De inset dekt zowel iOS' home-indicator als Android's navigatiebalk (Samsung e.d.), en is 0
  // bij gesture-navigatie. Zonder dit viel de balk onder de menu/home/terug-knoppen.
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.nav,
        { backgroundColor: colors.kaart, borderTopColor: colors.rand, paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
    >
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
