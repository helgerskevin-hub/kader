import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Modal } from 'react-native';
import { Bell, BookOpen, Settings } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';

export interface MenuAnker {
  x: number;
  y: number;
  breedte: number;
  hoogte: number;
}

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  anker: MenuAnker | null;
  ongelezen: number;
  onMeldingen: () => void;
  onAchtergrond: () => void;
  onInstellingen: () => void;
}

// Dropdown die onder het kebab-icoon in de header verschijnt, geankerd op de gemeten positie van
// de knop (measureInWindow), zodat hij op elk device en met elke safe-area-inset op de juiste
// plek uitklapt in plaats van op een hard-gecodeerde offset.
export function SysteemMenu({ zichtbaar, onSluiten, anker, ongelezen, onMeldingen, onAchtergrond, onInstellingen }: Props) {
  const { colors } = useTheme();

  if (!anker) return null;

  const vensterBreedte = Dimensions.get('window').width;
  const top = anker.y + anker.hoogte + 4;
  const right = Math.max(spacing.sm, vensterBreedte - (anker.x + anker.breedte));

  function uitvoeren(actie: () => void) {
    onSluiten();
    actie();
  }

  return (
    <Modal visible={zichtbaar} animationType="fade" transparent onRequestClose={onSluiten}>
      <Pressable style={styles.overlay} onPress={onSluiten} accessibilityLabel="Sluiten">
        <View style={[styles.kaart, shadow.modal, { top, right, backgroundColor: colors.kaart, borderColor: colors.rand }]}>
          <Rij
            icoon={<Bell size={18} color={colors.tekstGedimd} strokeWidth={1.75} />}
            label="Meldingen"
            aantal={ongelezen}
            rand={colors.rand}
            tekstKleur={colors.tekstPrimair}
            onPress={() => uitvoeren(onMeldingen)}
          />
          <Rij
            icoon={<BookOpen size={18} color={colors.tekstGedimd} strokeWidth={1.75} />}
            label="Achtergrond"
            rand={colors.rand}
            tekstKleur={colors.tekstPrimair}
            onPress={() => uitvoeren(onAchtergrond)}
          />
          <Rij
            icoon={<Settings size={18} color={colors.tekstGedimd} strokeWidth={1.75} />}
            label="Instellingen"
            rand={colors.rand}
            tekstKleur={colors.tekstPrimair}
            laatste
            onPress={() => uitvoeren(onInstellingen)}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

function Rij({ icoon, label, aantal, rand, tekstKleur, laatste, onPress }: {
  icoon: React.ReactNode;
  label: string;
  aantal?: number;
  rand: string;
  tekstKleur: string;
  laatste?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={[styles.rij, !laatste && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: rand }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={aantal ? `${label}, ${aantal} ongelezen` : label}
    >
      {icoon}
      <Text style={[Type.body, styles.label, { color: tekstKleur }]}>{label}</Text>
      {!!aantal && (
        <View style={[styles.badge, { backgroundColor: colors.cta, borderColor: colors.kaart }]}>
          <Text style={styles.badgeTekst}>{aantal > 9 ? '9+' : aantal}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  kaart: {
    position: 'absolute',
    minWidth: 210,
    borderRadius: radii.kaart,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  label: {
    flex: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeTekst: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
});
