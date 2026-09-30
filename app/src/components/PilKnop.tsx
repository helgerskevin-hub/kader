import React from 'react';
import { Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts } from '../theme/typography';
import { radii } from '../theme/tokens';
import type { HaptiekMoment } from '../theme/haptiek';
import { Drukbaar } from './Drukbaar';

type Icoon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface Props {
  label: string;
  // Een lucide-icoon voor het label, bijvoorbeeld ShoppingCart bij Koop.
  icoon?: Icoon;
  // cta: de hoofdactie van de kaart (Koop). tweede: een gewone actie ernaast. link: alleen tekst
  // met een pijltje, voor Details, zodat die niet met de acties concurreert.
  variant?: 'cta' | 'tweede' | 'link';
  onPress: (e: GestureResponderEvent) => void;
  onPressIn?: (e: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  haptiek?: HaptiekMoment;
  // Eigen tekstkleur, voor een knop die iets onomkeerbaars doet (Verwijder in colors.verlies). De
  // achtergrond blijft die van de variant.
  tekstKleur?: string;
}

const ICOON = 16;

// De knoppen onder in een uitgeklapte kaart. Minstens 44 hoog, zodat hij met een duim te raken is,
// en het label kapt nooit af: in een rij die mag afbreken gaat een knop liever naar de volgende
// regel dan dat er "Verk..." staat.
export function PilKnop({
  label,
  icoon: IcoonComp,
  variant = 'tweede',
  onPress,
  onPressIn,
  accessibilityLabel,
  haptiek,
  tekstKleur: eigenKleur,
}: Props) {
  const { colors } = useTheme();
  const tekstKleur = eigenKleur
    ?? (variant === 'cta' ? '#FFFFFF' : variant === 'link' ? colors.cta : colors.tekstPrimair);
  const achtergrond =
    variant === 'cta' ? colors.cta : variant === 'tweede' ? colors.verhoogd : 'transparent';

  return (
    <Drukbaar
      onPress={onPress}
      onPressIn={onPressIn}
      haptiek={haptiek}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.knop,
        { backgroundColor: achtergrond, paddingHorizontal: variant === 'link' ? 8 : 16 },
      ]}
    >
      {IcoonComp && <IcoonComp size={ICOON} color={tekstKleur} strokeWidth={2} />}
      <Text style={[styles.label, { color: tekstKleur }]}>{label}</Text>
      {variant === 'link' && <ChevronRight size={ICOON} color={tekstKleur} strokeWidth={2} />}
    </Drukbaar>
  );
}

const styles = StyleSheet.create({
  knop: {
    minHeight: 44,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontWeight: '600',
    fontSize: 14,
  },
});
