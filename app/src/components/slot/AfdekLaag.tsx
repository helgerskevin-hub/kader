import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { KaderLogo } from '../KaderLogo';
import { useTheme } from '../../theme/ThemeProvider';
import { duur, vervaag } from '../../theme/beweging';

interface Props {
  // Of de inhoud afgedekt moet zijn (de store-hook useAfgedekt() geeft dit straks door).
  zichtbaar: boolean;
}

// Een absolute, volledig dekkende laag met alleen de achtergrondkleur en het logo, geen inhoud.
// Hij staat in de root-View en als laatste kind van de Modal-wrappers, zodat Recente apps en de
// eerste frames na terugkomst nooit saldo of posities laten zien.
//
// Aan gaat zonder animatie (een fade-in zou juist inhoud laten doorschemeren op het moment dat
// afdekken moet); uit vervaagt kort. Zolang hij zichtbaar is, vangt hij alle aanrakingen op.
export function AfdekLaag({ zichtbaar }: Props) {
  const { colors, donkerActief } = useTheme();
  const dekking = useSharedValue(zichtbaar ? 1 : 0);

  useEffect(() => {
    dekking.value = zichtbaar ? 1 : vervaag(0, duur.kort);
  }, [zichtbaar, dekking]);

  const stijl = useAnimatedStyle(() => ({ opacity: dekking.value }));

  return (
    <Animated.View
      pointerEvents={zichtbaar ? 'auto' : 'none'}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[StyleSheet.absoluteFill, styles.laag, { backgroundColor: colors.achtergrond }, stijl]}
    >
      <KaderLogo size={56} variant={donkerActief ? 'donker' : 'licht'} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  laag: { alignItems: 'center', justifyContent: 'center' },
});
