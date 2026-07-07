import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from '../theme/useReduceMotion';

interface Props {
  stapIndex: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Laat de inhoud zacht in beeld schuiven bij elke stapwissel: vooruit van rechts,
// terug van links. Alleen de nieuwe inhoud animeert (fade + korte horizontale slide).
// Respecteert reduce motion (dan direct op eindpositie).
export function StapOvergang({ stapIndex, children, style }: Props) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const vorigeIndex = useRef(stapIndex);

  useEffect(() => {
    const richting = stapIndex >= vorigeIndex.current ? 1 : -1;
    vorigeIndex.current = stapIndex;

    if (reduceMotion) {
      opacity.setValue(1);
      translateX.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateX.setValue(24 * richting);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [stapIndex, reduceMotion, opacity, translateX]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}
