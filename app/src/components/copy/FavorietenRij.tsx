// Boven de Feed: je favorieten als rij avatars. Tik filtert de Feed op die trader (nog een tik toont
// weer alles), lang drukken opent zijn profiel, en de plus brengt je naar Ontdek.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BellOff, Plus } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { spacing } from '../../theme/tokens';
import { Drukbaar } from '../Drukbaar';
import { TraderAvatar } from './TraderAvatar';
import type { FavorieteTrader } from '../../state/copyOpslag';

const AVATAR = 48;

interface Props {
  favorieten: FavorieteTrader[];
  // Avatar-url per username (kleine letters), uit de ranglijst.
  avatars: Record<string, string | undefined>;
  gekozen: string | null;
  onKies: (username: string | null) => void;
  onProfiel: (username: string) => void;
  onNaarOntdek: () => void;
}

export function FavorietenRij({ favorieten, avatars, gekozen, onKies, onProfiel, onNaarOntdek }: Props) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rij}>
      {favorieten.map(f => {
        const actief = gekozen?.toLowerCase() === f.username.toLowerCase();
        const gedimd = gekozen !== null && !actief;
        return (
          <Drukbaar
            key={f.username}
            onPress={() => onKies(actief ? null : f.username)}
            onLongPress={() => onProfiel(f.username)}
            haptiek="tik"
            schaal={0.92}
            style={[styles.item, gedimd && styles.gedimd]}
            accessibilityRole="button"
            accessibilityState={{ selected: actief }}
            accessibilityLabel={`${f.username}${actief ? ', Feed gefilterd, tik voor alles' : ', toon alleen zijn trades'}`}
            accessibilityHint="Lang drukken opent het profiel"
          >
            <View style={[styles.ring, { borderColor: actief ? colors.cta : 'transparent' }]}>
              <TraderAvatar username={f.username} url={avatars[f.username.toLowerCase()]} grootte={AVATAR} />
              {f.meldingen === false && (
                <View style={[styles.stil, { backgroundColor: colors.verhoogd, borderColor: colors.achtergrond }]}>
                  <BellOff size={11} color={colors.tekstGedimd} strokeWidth={2} />
                </View>
              )}
            </View>
            <Text
              style={[Type.caption, styles.naam, { color: actief ? colors.tekstPrimair : colors.tekstGedimd }]}
              numberOfLines={1}
            >
              {f.username}
            </Text>
          </Drukbaar>
        );
      })}
      <Drukbaar
        onPress={onNaarOntdek}
        haptiek="tik"
        schaal={0.92}
        style={styles.item}
        accessibilityRole="button"
        accessibilityLabel="Meer traders zoeken in Ontdek"
      >
        <View style={[styles.ring, { borderColor: 'transparent' }]}>
          <View style={[styles.plus, { borderColor: colors.rand }]}>
            <Plus size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
          </View>
        </View>
        <Text style={[Type.caption, styles.naam, { color: colors.tekstGedimd }]}>Ontdek</Text>
      </Drukbaar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rij: { paddingHorizontal: spacing.base, paddingBottom: spacing.md, gap: spacing.md },
  item: { alignItems: 'center', width: AVATAR + 16 },
  gedimd: { opacity: 0.5 },
  ring: { padding: 2, borderRadius: (AVATAR + 8) / 2, borderWidth: 2 },
  stil: {
    position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  plus: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  naam: { marginTop: 4, maxWidth: AVATAR + 16 },
});
