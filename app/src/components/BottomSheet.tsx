import React from 'react';
import { View, Pressable, StyleSheet, Modal, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { radii, shadow, spacing } from '../theme/tokens';
import { useToetsenbordHoogte } from '../theme/useToetsenbordHoogte';

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

  return (
    <Modal visible={zichtbaar} animationType="slide" transparent onRequestClose={onSluiten}>
      <Pressable style={styles.overlay} onPress={onSluiten} accessibilityLabel="Sluiten">
        <Pressable
          style={[
            styles.vel,
            shadow.modal,
            {
              backgroundColor: colors.kaart,
              paddingBottom: Math.max(spacing.xl, toetsenbordHoogte, insets.bottom),
            },
            velStijl,
          ]}
          onPress={() => {}}
        >
          {children}
        </Pressable>
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
