import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts } from '../../theme/typography';
import { radii } from '../../theme/tokens';
import { Drukbaar } from '../Drukbaar';

export interface SnelOptie {
  id: string;
  label: string;
  waarde: number;
}

interface Props {
  opties: SnelOptie[];
  // De waarde die nu in het bedrag staat: de optie met dezelfde waarde krijgt de actieve stijl.
  actief?: number;
  onKies: (waarde: number) => void;
  accessibilityLabel?: string;
}

// Eén rij, geen wrap: elke pil neemt een gelijk deel van de breedte, dus vier knoppen passen ook
// op 360 dp. Het label krimpt mee in plaats van af te breken.
export function SnelKnoppen({ opties, actief, onKies, accessibilityLabel }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.rij} accessibilityLabel={accessibilityLabel}>
      {opties.map(optie => {
        const aan = actief !== undefined && Math.abs(actief - optie.waarde) < 0.005;
        return (
          <Drukbaar
            key={optie.id}
            onPress={() => onKies(optie.waarde)}
            haptiek="tik"
            accessibilityRole="button"
            accessibilityLabel={optie.label}
            accessibilityState={{ selected: aan }}
            style={[styles.pil, { backgroundColor: aan ? colors.tekstPrimair : colors.verhoogd }]}
          >
            <Text
              style={[styles.label, { color: aan ? colors.kaart : colors.tekstPrimair }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {optie.label}
            </Text>
          </Drukbaar>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rij: { flexDirection: 'row', gap: 6 },
  pil: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: radii.pill,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.monoMedium,
    fontWeight: '500',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
