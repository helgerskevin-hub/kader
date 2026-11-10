// De bel naast de ster: meldingen over nieuwe trades van deze favoriet aan of uit. Alleen zichtbaar
// voor een favoriet; de Feed vult ook als de bel uit staat.
import React from 'react';
import { StyleSheet } from 'react-native';
import { Bell, BellOff } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Drukbaar } from '../Drukbaar';

export function BelKnop({ username, aan, onWissel }: { username: string; aan: boolean; onWissel: () => void }) {
  const { colors } = useTheme();
  const Icoon = aan ? Bell : BellOff;
  return (
    <Drukbaar
      onPress={onWissel}
      haptiek="tik"
      schaal={0.85}
      style={styles.knop}
      hitSlop={4}
      accessibilityRole="switch"
      accessibilityState={{ checked: aan }}
      accessibilityLabel={`Meldingen over nieuwe trades van ${username}`}
    >
      <Icoon size={21} strokeWidth={1.75} color={aan ? colors.cta : colors.tekstGedimd} />
    </Drukbaar>
  );
}

const styles = StyleSheet.create({
  knop: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
