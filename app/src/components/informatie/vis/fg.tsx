import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { curve, duur } from '../../../theme/beweging';
import { AngstHebzucht } from '../../AngstHebzucht';
import type { VisProps } from './types';

// AngstHebzucht toont een vast getal zonder rol, dus hier alleen een fade met een klein schuifje.
export function VisFg({ speelSleutel, reduceMotion }: VisProps) {
  const zicht = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      zicht.value = 1;
      return;
    }
    zicht.value = 0;
    zicht.value = withTiming(1, { duration: duur.lang, easing: curve.binnen, reduceMotion: ReduceMotion.Never });
  }, [speelSleutel, reduceMotion, zicht]);
  const stijl = useAnimatedStyle(() => ({
    opacity: zicht.value,
    transform: [{ translateY: (1 - zicht.value) * 8 }],
  }));

  // De kaart heeft zelf een horizontale marge voor het scherm; die gaat er hier af.
  return (
    <View style={{ marginHorizontal: -16 }}>
      <Animated.View style={stijl}>
        <AngstHebzucht waarde={28} klasse="Fear" />
      </Animated.View>
    </View>
  );
}
