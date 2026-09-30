import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts } from '../theme/typography';
import { radii, shadow } from '../theme/tokens';
import { veer } from '../theme/beweging';
import { haptiek } from '../theme/haptiek';
import { useReduceMotion } from '../theme/useReduceMotion';

export interface SegmentOptie<T extends string> {
  id: T;
  label: string;
  // Voorleestekst als het label zelf te kort is om te begrijpen, zoals "1M" voor "Eén maand".
  uitleg?: string;
}

interface Props<T extends string> {
  opties: SegmentOptie<T>[];
  actief: T;
  onKies: (id: T) => void;
}

// Minimumhoogte, geen vaste hoogte: met een grote systeemletter groeit het label mee en moet de rij
// dat ook kunnen, anders knipt de tekst af. 44 is ook meteen de raakmaat: een hitSlop zou buiten de
// rij vallen, en Android geeft een aanraking buiten de ouder niet door aan het kind. De pil hangt
// met een boven- en onderrand aan de rij en volgt zo vanzelf de hoogte van de segmenten.
const MIN_HOOGTE = 44;
const BINNENRAND = 2;

// Een rij keuzes met één pil die van segment naar segment veert, zoals de pil in de tabbalk: je
// ziet de keuze verhuizen in plaats van dat twee knoppen van kleur wisselen. Alle segmenten zijn
// even breed, zodat de pil maar één maat nodig heeft.
export function SegmentKnop<T extends string>({ opties, actief, onKies }: Props<T>) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [rijBreedte, setRijBreedte] = useState(0);
  const actieveIndex = Math.max(0, opties.findIndex(o => o.id === actief));
  // Positie van de pil in segmenten (0, 1, 2, ...), los van de breedte, zodat een nieuwe meting
  // (draaien van het scherm) de pil niet laat glijden.
  const pilIndex = useSharedValue(actieveIndex);

  useEffect(() => {
    pilIndex.value = reduceMotion ? actieveIndex : withSpring(actieveIndex, veer.stevig);
  }, [actieveIndex, reduceMotion, pilIndex]);

  const segmentBreedte = opties.length > 0 ? Math.max(0, rijBreedte - BINNENRAND * 2) / opties.length : 0;

  const pilStijl = useAnimatedStyle(() => ({
    transform: [{ translateX: pilIndex.value * segmentBreedte }],
  }), [segmentBreedte]);

  function opLayout(e: LayoutChangeEvent) {
    setRijBreedte(e.nativeEvent.layout.width);
  }

  function kies(id: T) {
    // Alleen een tik bij een echte wissel: nog eens op de actieve keuze drukken verandert niets.
    if (id === actief) return;
    haptiek('tik');
    onKies(id);
  }

  return (
    <View
      style={[styles.rij, { backgroundColor: colors.verhoogd }]}
      onLayout={opLayout}
      accessibilityRole="tablist"
    >
      {segmentBreedte > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pil,
            shadow.kaart,
            { width: segmentBreedte, backgroundColor: colors.kaart },
            pilStijl,
          ]}
        />
      )}
      {opties.map(o => {
        const geselecteerd = o.id === actief;
        return (
          <Pressable
            key={o.id}
            style={styles.segment}
            onPress={() => kies(o.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: geselecteerd }}
            accessibilityLabel={o.uitleg ?? o.label}
          >
            {/* Eén regel die desnoods krimpt: bij een grote systeemletter brak "Alles" anders midden
                in het woord af. */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[
                styles.label,
                geselecteerd
                  ? { color: colors.tekstPrimair, fontFamily: Fonts.sansSemiBold, fontWeight: '600' }
                  : { color: colors.tekstGedimd },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rij: {
    flexDirection: 'row',
    minHeight: MIN_HOOGTE,
    borderRadius: radii.pill,
    padding: BINNENRAND,
  },
  pil: {
    position: 'absolute',
    top: BINNENRAND,
    bottom: BINNENRAND,
    left: BINNENRAND,
    borderRadius: radii.pill,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.sansMedium,
    fontWeight: '500',
    fontSize: 13,
  },
});
