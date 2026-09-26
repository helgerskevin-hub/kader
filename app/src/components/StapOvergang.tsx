import React, { useLayoutEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { useReduceMotion } from '../theme/useReduceMotion';
import { duur, veer, vervaag } from '../theme/beweging';

interface Props {
  stapIndex: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Hoe ver de nieuwe stap van opzij komt. Kort: het is een hint van richting, geen schermwissel.
const AFSTAND = 24;

// Laat de inhoud zacht in beeld schuiven bij elke stapwissel: vooruit van rechts,
// terug van links. Alleen de nieuwe inhoud animeert: de verschuiving op veer.zacht, zodat hij
// uitloopt in plaats van stopt, en de fade los daarvan op een vaste korte duur, want een veer op
// opacity blijft zichtbaar nahangen. Onder Minder beweging alleen de fade, geen verschuiving.
export function StapOvergang({ stapIndex, children, style }: Props) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(reduceMotion ? 0 : AFSTAND);
  const vorigeIndex = useRef(stapIndex);

  // Layout-effect en niet useEffect: de beginstand moet gezet zijn voordat de nieuwe stap voor het
  // eerst getekend wordt, anders staat hij één frame vol in beeld en begint hij dan pas te faden.
  useLayoutEffect(() => {
    const richting = stapIndex >= vorigeIndex.current ? 1 : -1;
    vorigeIndex.current = stapIndex;

    cancelAnimation(opacity);
    cancelAnimation(translateX);
    opacity.value = 0;
    if (reduceMotion) {
      translateX.value = 0;
      opacity.value = vervaag(1, duur.kort);
      return;
    }
    translateX.value = AFSTAND * richting;
    opacity.value = vervaag(1, duur.midden);
    translateX.value = withSpring(0, veer.zacht);
    // reduceMotion hoort er bewust niet bij: omschakelen tijdens een stap is geen stapwissel.
  }, [stapIndex]);

  const stijl = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return <Animated.View style={[style, stijl]}>{children}</Animated.View>;
}
