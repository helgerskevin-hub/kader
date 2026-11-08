// De ster: één tik maakt een belegger favoriet of haalt hem eruit. Raakvlak 44x44, ook al is het
// icoon kleiner.
import React from 'react';
import { StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Drukbaar } from '../Drukbaar';

interface Props {
  username: string;
  aan: boolean;
  onWissel: () => void;
}

export function SterKnop({ username, aan, onWissel }: Props) {
  const { colors } = useTheme();
  return (
    <Drukbaar
      onPress={onWissel}
      haptiek="tik"
      schaal={0.85}
      style={styles.knop}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected: aan }}
      accessibilityLabel={aan ? `Haal ${username} uit favorieten` : `Maak ${username} favoriet`}
    >
      <Star
        size={22}
        strokeWidth={1.75}
        color={aan ? colors.goud : colors.tekstGedimd}
        fill={aan ? colors.goud : 'transparent'}
      />
    </Drukbaar>
  );
}

const styles = StyleSheet.create({
  knop: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
