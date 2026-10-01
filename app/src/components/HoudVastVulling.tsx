// De vullaag die meeloopt met ingedrukt houden (zie useVasthouden). Legt zich over de hele ouder;
// die ouder moet overflow: 'hidden' hebben als hij afgeronde hoeken heeft.
//
// Getekend met scaleX in plaats van width, zodat de UI-thread de vulling afhandelt zonder elke frame
// een layout te herberekenen. De basis is bewust 100 breed en niet 1: een view van 1dp wordt eerst
// op hele pixels afgerond en daarna opgeschaald, en dan staat de rand er een paar pixels naast.
// transformOrigin is in React Native nog niet overal even betrouwbaar, dus schuift een translateX
// de linkerkant terug op zijn plek in plaats van vanuit het midden te laten groeien.
import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

const BASIS = 100;

interface Props {
  voortgang: SharedValue<number>;
  kleur: string;
}

export function HoudVastVulling({ voortgang, kleur }: Props) {
  const [breedte, setBreedte] = useState(0);

  function opLayout(e: LayoutChangeEvent) {
    setBreedte(e.nativeEvent.layout.width);
  }

  const stijl = useAnimatedStyle(() => {
    const s = (breedte / BASIS) * voortgang.value;
    return {
      transform: [{ translateX: -(BASIS / 2) * (1 - s) }, { scaleX: s }],
    };
  }, [breedte]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={opLayout}>
      <Animated.View style={[styles.vulling, { backgroundColor: kleur }, stijl]} />
    </View>
  );
}

const styles = StyleSheet.create({
  vulling: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: BASIS,
  },
});
