import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Bell, BookOpen, Settings } from 'lucide-react-native';
import { usePortfolio } from '../state/PortfolioProvider';
import { useBeweging } from '../theme/useReduceMotion';
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
  const { etoroGekoppeld, omgeving } = usePortfolio();
  const { naar, reduceMotion } = useBeweging();

  // Voortgang 0 -> 1 van de intrede. Schaal en opacity lopen mee; de schaal groeit vanuit de
  // rechterbovenhoek (waar de kebab zit), dus de gemeten kaartmaat corrigeert de middenpunt-schaal.
  const voortgang = useSharedValue(0);
  const kaartB = useSharedValue(0);
  const kaartH = useSharedValue(0);

  useEffect(() => {
    if (zichtbaar) voortgang.value = naar(1, 'stevig');
    else voortgang.value = 0;
  }, [zichtbaar, naar, voortgang]);

  const kaartStijl = useAnimatedStyle(() => {
    // Onder Minder beweging alleen een fade, geen zoom.
    const s = reduceMotion ? 1 : 0.92 + 0.08 * voortgang.value;
    return {
      opacity: Math.min(1, Math.max(0, voortgang.value)),
      transform: [
        { translateX: (kaartB.value / 2) * (1 - s) },
        { translateY: -(kaartH.value / 2) * (1 - s) },
        { scale: s },
      ],
    };
  });

  if (!anker) return null;

  const echt = omgeving !== 'demo';
  const chipKleur = echt ? colors.tekstPrimair : colors.letOp;

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
        <Animated.View
          onLayout={e => {
            kaartB.value = e.nativeEvent.layout.width;
            kaartH.value = e.nativeEvent.layout.height;
          }}
          style={[styles.kaart, shadow.modal, { top, right, backgroundColor: colors.kaart, borderColor: colors.rand }, kaartStijl]}
        >
          <View
            style={[styles.status, { borderBottomColor: colors.rand }]}
            accessibilityLabel={etoroGekoppeld ? `eToro gekoppeld, ${echt ? 'echte' : 'demo'}-omgeving` : 'eToro niet gekoppeld'}
          >
            <Text style={[Type.caption, styles.statusTekst, { color: colors.tekstGedimd }]}>
              {etoroGekoppeld ? `eToro gekoppeld · ${echt ? 'Echt' : 'Demo'}` : 'eToro niet gekoppeld'}
            </Text>
            {etoroGekoppeld && (
              <View style={[styles.chip, { borderColor: chipKleur }]}>
                <Text style={[Type.overline, { color: chipKleur }]}>{echt ? 'ECHT' : 'DEMO'}</Text>
              </View>
            )}
          </View>
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
            label="Informatie"
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
        </Animated.View>
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
      <Text style={[Type.body, styles.label, { color: tekstKleur }]}>{label}</Text>
      {!!aantal && (
        <View style={[styles.badge, { backgroundColor: colors.cta, borderColor: colors.kaart }]}>
          <Text style={styles.badgeTekst}>{aantal > 9 ? '9+' : aantal}</Text>
        </View>
      )}
      {icoon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  kaart: {
    position: 'absolute',
    minWidth: 236,
    borderRadius: radii.kaart,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusTekst: {
    flex: 1,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
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
