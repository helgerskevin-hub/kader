import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link2, Wallet, Bell, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts, Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { PilKnop } from './PilKnop';

interface Props {
  zichtbaar: boolean;
  onLater: () => void;
  onNuInstellen: () => void;
}

type Icoon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Wat je aan de koppeling hebt, in drie regels. Geen uitleg over sleutels: dat doet de wizard.
const VOORDELEN: { icoon: Icoon; titel: string; tekst: string }[] = [
  { icoon: Wallet, titel: 'Posities komen vanzelf binnen', tekst: 'Geen trades meer overtikken.' },
  { icoon: Bell, titel: 'Meldingen per positie', tekst: 'Bijna op doel, stop geraakt, klimaat omgeslagen.' },
  { icoon: ShieldCheck, titel: 'Handelen met bevestiging', tekst: 'Alleen als je dat wilt, en altijd pas na jouw akkoord.' },
];

export function EtoroPromptSheet({ zichtbaar, onLater, onNuInstellen }: Props) {
  const { colors } = useTheme();

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onLater} velStijl={styles.vel}>
      <View style={[styles.icoon, { backgroundColor: colors.cta + '1F' }]}>
        <Link2 size={28} color={colors.cta} strokeWidth={1.75} />
      </View>
      <Text style={[Type.titel, styles.titel, { color: colors.tekstPrimair }]} accessibilityRole="header">
        Koppel je eToro-account
      </Text>

      <View style={styles.voordelen}>
        {VOORDELEN.map(({ icoon: IcoonComp, titel, tekst }) => (
          <View key={titel} style={styles.voordeel}>
            <View style={[styles.tegel, { backgroundColor: colors.cta + '1F' }]}>
              <IcoonComp size={19} color={colors.cta} strokeWidth={1.75} />
            </View>
            <View style={styles.voordeelTekst}>
              <Text style={[styles.voordeelTitel, { color: colors.tekstPrimair }]}>{titel}</Text>
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{tekst}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.knoppen}>
        <PilKnop label="Koppelen, duurt 3 minuten" variant="cta" onPress={onNuInstellen} />
        <PilKnop label="Later" variant="tweede" onPress={onLater} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  vel: {
    alignItems: 'center',
  },
  icoon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  titel: { textAlign: 'center', marginBottom: spacing.lg },
  voordelen: { alignSelf: 'stretch', gap: 14, marginBottom: spacing.lg },
  voordeel: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tegel: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  voordeelTekst: { flex: 1, flexShrink: 1 },
  voordeelTitel: { fontFamily: Fonts.sansSemiBold, fontWeight: '600', fontSize: 14.5, lineHeight: 20 },
  knoppen: { alignSelf: 'stretch', gap: spacing.sm },
});
