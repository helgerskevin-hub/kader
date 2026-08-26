import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radii } from '../theme/tokens';
import { Richting } from '../state/portfolioTypes';

interface Props {
  richting: Richting;
}

// Klein label bij een trade zodat direct duidelijk is of het een long of een short is: de niveaus
// en het resultaat lezen voor een short tegenovergesteld, en zonder dit label is dat verschil pas
// zichtbaar als je de stop- en doelprijs naast elkaar legt.
export function RichtingBadge({ richting }: Props) {
  const { colors } = useTheme();

  // Bij een long staat er niets. Vrijwel alles is long, dus een LONG-label bij elke trade is ruis
  // en maakt juist de shorts minder zichtbaar. Geen label betekent hier long, en dat is precies de
  // aanname die de rest van de app ook maakt.
  if (richting !== 'short') return null;

  return (
    <View style={[styles.badge, { backgroundColor: colors.goud + '1A', borderColor: colors.goud }]}>
      <Text style={[styles.label, { color: colors.goud }]}>SHORT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
