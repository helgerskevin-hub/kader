import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, Zap, Wallet, Users } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { veer } from '../theme/beweging';
import { haptiekVanUI } from '../theme/haptiek';
import { useReduceMotion } from '../theme/useReduceMotion';

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

// De volgorde van links naar rechts, ook de volgorde van de pagina's waartussen je swipet.
export const TAB_VOLGORDE: Tab[] = TABS.map(t => t.id);

// Wat de pager in App.tsx met de balk deelt, allemaal op de UI-thread.
export interface TabPagerStand {
  // Waar de pagina's nu staan, als kommagetal: 1.4 is tussen Kansen en Portfolio in.
  positie: SharedValue<number>;
  // De tab waar het naartoe gaat: bij een tik meteen de nieuwe, tijdens een swipe de pagina die
  // het meest in beeld is (dus wisselend op de helft), na loslaten de pagina waar hij landt.
  doel: SharedValue<number>;
  // Of er nu een vinger aan de pagina's trekt.
  sleept: SharedValue<boolean>;
}

interface Props {
  actief: Tab;
  onWissel: (tab: Tab) => void;
  pager: TabPagerStand;
}

// Breedte van de pil achter het actieve icoon, de "active indicator" zoals Android hem kent. Hij
// omsluit alleen het icoon en niet ook het label: zo blijft de balk rustig en leest het label
// gewoon als tekst.
const PIL_BREEDTE = 56;
const PIL_HOOGTE = 28;

export function BottomNav({ actief, onWissel, pager }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  // De inset dekt zowel iOS' home-indicator als Android's navigatiebalk (Samsung e.d.), en is 0
  // bij gesture-navigatie. Zonder dit viel de balk onder de menu/home/terug-knoppen.
  const insets = useSafeAreaInsets();

  // Welke tab er getint staat. Volgt pager.doel en niet `actief`: tijdens een swipe springt de tint
  // al op de helft over, zoals op iOS, terwijl App de tab pas vastlegt als de pagina stilstaat.
  const [getint, setGetint] = useState(() => TAB_VOLGORDE.indexOf(actief));
  const rijBreedte = useSharedValue(0);
  // Positie van de pil, in tabs (0 tot 3), los van de pagina's: bij een tik veert hij zelf met
  // veer.stevig naar zijn plek en klikt hij er dus sneller vast dan de pagina's glijden.
  const pilX = useSharedValue(TAB_VOLGORDE.indexOf(actief));

  useAnimatedReaction(
    () => pager.doel.value,
    (nu, vorig) => {
      if (vorig === null || nu === vorig) return;
      scheduleOnRN(setGetint, nu);
      // Eén tik per tabwissel, ook halverwege een swipe: dat is het moment waarop loslaten de
      // wissel zou maken.
      haptiekVanUI('tik');
    },
  );

  useAnimatedReaction(
    () => (pager.sleept.value ? pager.positie.value : pager.doel.value),
    (nu, vorig) => {
      if (nu === vorig) return;
      // Onder de vinger volgt de pil de pagina's één op één. Daarbuiten veert hij naar het doel,
      // of springt hij er onder Minder beweging meteen heen.
      if (pager.sleept.value || reduceMotion) pilX.value = nu;
      else pilX.value = withSpring(nu, veer.stevig);
    },
    [reduceMotion],
  );

  const pilStijl = useAnimatedStyle(() => {
    const itemBreedte = rijBreedte.value / TABS.length;
    return {
      opacity: itemBreedte > 0 ? 1 : 0,
      transform: [{ translateX: pilX.value * itemBreedte + (itemBreedte - PIL_BREEDTE) / 2 }],
    };
  });

  function opLayout(e: LayoutChangeEvent) {
    rijBreedte.value = e.nativeEvent.layout.width;
  }

  return (
    <View
      style={[
        styles.nav,
        { backgroundColor: colors.kaart, borderTopColor: colors.rand, paddingBottom: Math.max(insets.bottom, spacing.sm) },
      ]}
    >
      <View style={styles.rij} onLayout={opLayout}>
        {/* De pil is één gedeeld vlak dat van tab naar tab glijdt, geen achtergrond per knop: zo
            zie je hem reizen, ook terwijl je tussen twee pagina's in swipet. De CTA-kleur op 10
            procent is net genoeg om te lezen welke tab het is zonder dat het een knop wordt. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.pil, { backgroundColor: colors.cta + '1A' }, pilStijl]}
        />
        {TABS.map(({ id, label, Icon }, index) => (
          <TabKnop
            key={id}
            label={label}
            Icon={Icon}
            isActief={getint === index}
            reduceMotion={reduceMotion}
            onDruk={() => onWissel(id)}
          />
        ))}
      </View>
    </View>
  );
}

function TabKnop({ label, Icon, isActief, reduceMotion, onDruk }: {
  label: string;
  Icon: TabItem['Icon'];
  isActief: boolean;
  reduceMotion: boolean;
  onDruk: () => void;
}) {
  const { colors } = useTheme();
  const kleur = isActief ? colors.cta : colors.tekstGedimd;

  // Het actieve icoon wordt een fractie groter, met het enige speelse veertje in de balk. Onder
  // Minder beweging blijft het op zijn maat; het dikkere lijnwerk zegt dan genoeg.
  const icoonStijl = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : withSpring(isActief ? 1.08 : 1, veer.speels) }],
  }), [isActief, reduceMotion]);

  return (
    <Pressable
      style={styles.item}
      onPress={onDruk}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActief }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.icoonVak, icoonStijl]}>
        <Icon size={22} color={kleur} strokeWidth={isActief ? 2.2 : 1.75} />
      </Animated.View>
      <Text style={[Type.caption, styles.label, { color: kleur }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  rij: {
    flexDirection: 'row',
  },
  pil: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PIL_BREEDTE,
    height: PIL_HOOGTE,
    borderRadius: radii.pill,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 44,
    gap: 2,
  },
  // Even hoog als de pil, zodat het icoon er precies in het midden van staat.
  icoonVak: {
    height: PIL_HOOGTE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
  },
});
