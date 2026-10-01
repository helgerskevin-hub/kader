import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MarktBalk } from '../../MarktBalk';
import type { Marktklimaat } from '../../../engine/marktklimaat';
import type { VisProps } from './types';

// Drie voorbeeldmetingen, van slecht naar goed. De balk tekent ze zelf.
const KLIMATEN: Marktklimaat[] = [
  { klimaat: 'ongunstig', btcBovenEma50: false, breedte: 0.28, breedteStijgend: false, btcPrijs: 64000 },
  { klimaat: 'gemengd', btcBovenEma50: true, breedte: 0.38, breedteStijgend: false, btcPrijs: 66000 },
  { klimaat: 'gunstig', btcBovenEma50: true, breedte: 0.44, breedteStijgend: true, btcPrijs: 68000 },
];
const PAUZE = 1100;

export function VisKlimaat({ speelSleutel, reduceMotion }: VisProps) {
  const [stap, setStap] = useState(reduceMotion ? 2 : 0);

  useEffect(() => {
    if (reduceMotion) {
      setStap(2);
      return;
    }
    setStap(0);
    const timers = [1, 2].map(i => setTimeout(() => setStap(i), i * PAUZE));
    return () => timers.forEach(clearTimeout);
  }, [speelSleutel, reduceMotion]);

  // MarktBalk heeft zelf een horizontale marge voor het scherm; in de uitleg zit hij al in een
  // omhulsel, dus die marge gaat er hier af.
  return (
    <View style={{ marginHorizontal: -16 }}>
      <MarktBalk klimaat={KLIMATEN[stap]} />
    </View>
  );
}
