import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Modal, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { radii, shadow, spacing } from '../theme/tokens';
import { useToetsenbordHoogte } from '../theme/useToetsenbordHoogte';
import { useReduceMotion } from '../theme/useReduceMotion';

// Het vel is zelf de geanimeerde component, niet een wrapper eromheen. Vijf sheets zetten een
// maxHeight in procenten op hun velStijl, en een percentage rekent tegen de hoogte van de ouder:
// met een tussenliggende wrapper zonder eigen hoogte valt die maxHeight weg en groeit een lange
// sheet voorbij het scherm.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  children: React.ReactNode;
  velStijl?: StyleProp<ViewStyle>;
}

// Gedeelde bottom-sheet-wrapper: Modal + halftransparante achtergrond + het witte vel. Tikken op de
// achtergrond sluit de sheet (standaard bottom-sheet-gedrag), tikken op het vel zelf niet. Houdt ook
// meteen rekening met het toetsenbord en de veilige zone onderaan (Android-gesturebalk), zodat de
// onderste knop nooit meer verstopt zit.
export function BottomSheet({ zichtbaar, onSluiten, children, velStijl }: Props) {
  const { colors } = useTheme();
  const toetsenbordHoogte = useToetsenbordHoogte();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!zichtbaar) {
      opacity.setValue(0);
      translateY.setValue(24);
      return;
    }
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [zichtbaar, reduceMotion, opacity, translateY]);

  return (
    <Modal visible={zichtbaar} animationType="fade" transparent onRequestClose={onSluiten}>
      <Pressable style={styles.overlay} onPress={onSluiten} accessibilityLabel="Sluiten">
        <AnimatedPressable
          style={[
            styles.vel,
            shadow.modal,
            {
              backgroundColor: colors.kaart,
              // Bij een open toetsenbord een extra marge boven op de gemelde hoogte. Android meldt
              // de hoogte van het toetsenbord zelf, zonder de werkbalk met suggesties erboven, en
              // precies die strook viel over de onderste knop heen: die was dan niet aan te tikken
              // zonder eerst het toetsenbord weg te halen. Gemeten op een Pixel 8 met Gboard.
              paddingBottom: Math.max(
                spacing.xl,
                toetsenbordHoogte > 0 ? toetsenbordHoogte + spacing.xl : 0,
                insets.bottom,
              ),
              opacity,
              transform: [{ translateY }],
            },
            velStijl,
          ]}
          onPress={() => {}}
        >
          {children}
        </AnimatedPressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  vel: {
    borderTopLeftRadius: radii.kaart,
    borderTopRightRadius: radii.kaart,
    padding: spacing.base,
  },
});
