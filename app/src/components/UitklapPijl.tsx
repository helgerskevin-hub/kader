import React, { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { veer, type VeerNaam } from '../theme/beweging';
import { useReduceMotion } from '../theme/useReduceMotion';

interface Props {
  open: boolean;
  // omlaag: een pijl naar beneden die bij openen een halve slag draait (was ChevronDown/ChevronUp).
  // rechts: een pijl naar rechts die bij openen een kwartslag naar beneden draait (was
  // ChevronRight/ChevronDown).
  richting?: 'omlaag' | 'rechts';
  size: number;
  color: string;
  strokeWidth?: number;
  // Welke veer het draaien volgt. Standaard snel, zoals een schakelaar; de pijl op een kaart
  // gebruikt stevig, zodat hij net als de kaart zelf op zijn plek klikt.
  veerNaam?: VeerNaam;
}

// Eén pijl die draait in plaats van twee iconen die van plek wisselen: je ziet dan wát er
// gebeurt, niet alleen dat er iets anders staat. Met Minder beweging wisselt hij direct van stand.
export function UitklapPijl({
  open,
  richting = 'omlaag',
  size,
  color,
  strokeWidth = 1.75,
  veerNaam = 'snel',
}: Props) {
  const reduceMotion = useReduceMotion();
  const stand = useSharedValue(open ? 1 : 0);
  const hoek = richting === 'rechts' ? 90 : 180;

  useEffect(() => {
    stand.value = reduceMotion ? (open ? 1 : 0) : withSpring(open ? 1 : 0, veer[veerNaam]);
  }, [open, reduceMotion, stand, veerNaam]);

  const stijl = useAnimatedStyle(() => ({ transform: [{ rotate: `${stand.value * hoek}deg` }] }));
  const Icoon = richting === 'rechts' ? ChevronRight : ChevronDown;

  return (
    <Animated.View style={stijl}>
      <Icoon size={size} color={color} strokeWidth={strokeWidth} />
    </Animated.View>
  );
}
