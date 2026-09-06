import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

// Gedeeld pulsritme voor alle skeleton-componenten (SkeletonCard, SkeletonRegel, SkeletonGrafiek):
// dezelfde opacity-ademhaling, zodat een scherm met meerdere skeletons naast elkaar niet uit de
// pas loopt. Staat verminderde beweging aan, dan blijft de opacity gewoon op 1 staan: hetzelfde
// statische blok als voorheen, geen animatie.
export function useSkeletonPuls(): Animated.Value {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const lus = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    lus.start();
    return () => lus.stop();
  }, [reduceMotion, opacity]);

  return opacity;
}
