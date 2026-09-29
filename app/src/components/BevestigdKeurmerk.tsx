import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { withSpring, withTiming, type EntryExitAnimationFunction } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radii } from '../theme/tokens';
import { curve, duur, veer } from '../theme/beweging';
import { useReduceMotion } from '../theme/useReduceMotion';

// Een popje op de speelse veer: het keurmerk komt er als bevestiging bij, met het enige token dat
// zichtbaar overschiet. Alleen transform en opacity. Als losse functies op moduleniveau, zodat de
// identiteit gelijk blijft tussen renders (zie de uitleg bij de cache in lijstBeweging).
const POP_IN: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.6 }] },
    animations: {
      opacity: withTiming(1, { duration: duur.kort, easing: curve.binnen }),
      transform: [{ scale: withSpring(1, veer.speels) }],
    },
  };
};

// Het keurmerk naast de adviesbadge: alle vier de eisen (trend, MACD, volume, R/R) staan mee en het
// marktklimaat werkt niet tegen. Bewust een los element en geen variant van AdviceBadge: het oordeel
// (STERK KOOP) en het keurmerk zijn twee aparte dingen, en de tweede is er alleen soms.
interface Props {
  // Alleen true als het keurmerk er net bij komt op een kaart die al stond. Zonder deze vlag popt
  // hij bij elke mount, en een lijst mount opnieuw bij elke filterwissel.
  animeer?: boolean;
}

export function BevestigdKeurmerk({ animeer = false }: Props) {
  const { colors, donkerActief } = useTheme();
  const reduceMotion = useReduceMotion();

  // Zelfde regel als de gevulde badge: wit op de merkkleur in licht, de achtergrondkleur in donker.
  const vulTekst = donkerActief ? colors.achtergrond : '#FFFFFF';

  return (
    <Animated.View
      entering={animeer && !reduceMotion ? POP_IN : undefined}
      style={[styles.pil, { backgroundColor: colors.primair }]}
      accessible
      accessibilityLabel="Bevestigd: trend, MACD, volume en R/R staan allemaal mee"
    >
      <Check size={12} color={vulTekst} strokeWidth={2.75} />
      <Text style={[styles.label, { color: vulTekst }]}>BEVESTIGD</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: radii.pill,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
