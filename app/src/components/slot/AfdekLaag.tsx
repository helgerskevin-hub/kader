import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { KaderLogo } from '../KaderLogo';
import { useTheme } from '../../theme/ThemeProvider';
import { duur, vervaag } from '../../theme/beweging';
import { useAfgedekt } from '../../state/afdekking';

interface Props {
  // Of de inhoud afgedekt moet zijn (de store-hook useAfgedekt() geeft dit door).
  zichtbaar: boolean;
}

// Een absolute, volledig dekkende laag met alleen de achtergrondkleur en het logo, geen inhoud.
// Hij staat in de root-View en als laatste kind van de Modal-wrappers, zodat Recente apps en de
// eerste frames na terugkomst nooit saldo of posities laten zien.
//
// Aan is een gewone View met volle dekking: die dekt in dezelfde commit, zonder te wachten op een
// effect of op de UI-thread van Reanimated (een fade-in zou juist inhoud laten doorschemeren op
// het moment dat afdekken moet). Het is bewust een ander element dan de vervagende laag: een vaste
// opacity op dezelfde Animated.View zou React overslaan als zijn eigen props al 1 zeiden, terwijl
// Reanimated de native view intussen op 0 had gezet. Uit vervaagt kort. Zolang hij zichtbaar is,
// vangt hij alle aanrakingen op.
export function AfdekLaag({ zichtbaar }: Props) {
  const { colors, donkerActief } = useTheme();
  const dekking = useSharedValue(zichtbaar ? 1 : 0);

  useEffect(() => {
    dekking.value = zichtbaar ? 1 : vervaag(0, duur.kort);
  }, [zichtbaar, dekking]);

  const stijl = useAnimatedStyle(() => ({ opacity: dekking.value }));
  const basis = [StyleSheet.absoluteFill, styles.laag, { backgroundColor: colors.achtergrond }];
  const logo = <KaderLogo size={56} variant={donkerActief ? 'donker' : 'licht'} />;

  if (zichtbaar) {
    return (
      <View
        pointerEvents="auto"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={basis}
      >
        {logo}
      </View>
    );
  }
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[basis, stijl]}
    >
      {logo}
    </Animated.View>
  );
}

// De afdeklaag met de store erin. Een eigen component, zodat alleen deze laag hertekent als de
// afdekking wisselt, en niet de Modal-wrapper (of de root) waar hij in staat.
export function WrapperAfdekking() {
  return <AfdekLaag zichtbaar={useAfgedekt()} />;
}

const styles = StyleSheet.create({
  laag: { alignItems: 'center', justifyContent: 'center' },
});
