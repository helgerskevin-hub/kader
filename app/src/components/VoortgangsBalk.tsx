import React, { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { useBeweging } from '../theme/useReduceMotion';

interface Props {
  // Huidige stap, 1 tot en met aantal.
  stap: number;
  aantal?: number;
  // Alles af, ook de laatste stap: het scherm na de laatste stap.
  klaar?: boolean;
}

// De vulling heeft een vaste basisbreedte en wordt met scaleX op de gemeten breedte van het
// segment gezet. Bewust niet een view van 1 punt die opgeschaald wordt: die breedte wordt eerst op
// hele pixels afgerond en daarna vermenigvuldigd, dus de fout groeit mee met de schaal.
const BASIS = 100;

// Vijf segmenten naast elkaar: af is vol, de huidige half, wat nog komt leeg. Alleen de schaal
// animeert, nooit een breedte.
export function VoortgangsBalk({ stap, aantal = 5, klaar = false }: Props) {
  return (
    <View
      style={styles.rij}
      accessibilityRole="progressbar"
      accessibilityLabel="Voortgang"
      accessibilityValue={{ min: 1, max: aantal, now: Math.min(stap, aantal) }}
    >
      {Array.from({ length: aantal }).map((_, i) => {
        const nummer = i + 1;
        const deel = klaar || nummer < stap ? 1 : nummer === stap ? 0.5 : 0;
        return <Segment key={i} deel={deel} />;
      })}
    </View>
  );
}

function Segment({ deel }: { deel: number }) {
  const { colors } = useTheme();
  const { naar } = useBeweging();
  const vulling = useSharedValue(deel);
  const breedte = useSharedValue(0);

  useEffect(() => {
    vulling.value = naar(deel, 'standaard');
  }, [deel, naar, vulling]);

  function bijLayout(e: LayoutChangeEvent) {
    breedte.value = e.nativeEvent.layout.width;
  }

  const vulStijl = useAnimatedStyle(() => {
    const schaal = (vulling.value * breedte.value) / BASIS;
    // Schalen gebeurt rond het midden; deze verschuiving houdt de linkerrand op 0.
    return {
      transform: [{ translateX: (BASIS / 2) * (schaal - 1) }, { scaleX: schaal }],
    };
  });

  return (
    <View style={[styles.baan, { backgroundColor: colors.rand }]} onLayout={bijLayout}>
      <Animated.View style={[styles.vulling, { backgroundColor: colors.cta }, vulStijl]} />
    </View>
  );
}

const styles = StyleSheet.create({
  rij: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center' },
  baan: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  vulling: { position: 'absolute', left: 0, top: 0, bottom: 0, width: BASIS },
});
