import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, TextStyle, StyleProp } from 'react-native';
import { useReduceMotion } from '../theme/useReduceMotion';

interface Props {
  waarde: number;
  format: (n: number) => string;
  style?: StyleProp<TextStyle>;
}

// Telt soepel naar een nieuwe waarde bij elke wijziging (count-up). Bij mount met een
// bekende waarde blijft die direct staan; pas als de waarde verandert (bijv. na een
// koers-sync) animeert hij. Respecteert reduce motion (dan direct de eindwaarde).
export function AnimatedGetal({ waarde, format, style }: Props) {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(waarde)).current;
  const [display, setDisplay] = useState(waarde);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setDisplay(value));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(waarde);
      setDisplay(waarde);
      return;
    }
    const animatie = Animated.timing(anim, {
      toValue: waarde,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animatie.start();
    return () => animatie.stop();
  }, [waarde, reduceMotion, anim]);

  return <Text style={style}>{format(display)}</Text>;
}
