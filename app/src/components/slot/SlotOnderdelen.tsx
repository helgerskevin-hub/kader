import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { Drukbaar } from '../Drukbaar';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts, Type } from '../../theme/typography';
import { radii } from '../../theme/tokens';

// Kleine bouwstenen die het slotscherm, het instellen en de pincodevraag delen.

// Linkkleur uit het ontwerp: cta in licht, primair in donker (cta op de donkere achtergrond is te
// zwak voor tekst).
export function useLinkKleur(): string {
  const { colors, donkerActief } = useTheme();
  return donkerActief ? colors.primair : colors.cta;
}

// Tekst op een gekleurde knop (cta of verlies). Er is geen token voor tekst-op-primair in
// theme/tokens.ts, en wit is in licht en donker goed leesbaar op beide, dus een vaste waarde.
const OP_KNOP = '#FFFFFF';

export type StatusSoort = 'info' | 'fout' | 'melding';

// De statusregel onder de titel: vaste hoogte van 48 dp, zodat het toetsenbord niet verspringt als
// er een melding komt of weggaat. letOp staat alleen als icoon, nooit als tekstkleur (contrast).
export function StatusRegel({ tekst, soort = 'info' }: { tekst?: string | null; soort?: StatusSoort }) {
  const { colors } = useTheme();
  const kleur = soort === 'fout' ? colors.verlies : colors.tekstGedimd;
  return (
    <View style={styles.status}>
      {soort !== 'info' && tekst ? <TriangleAlert size={18} strokeWidth={2} color={colors.letOp} /> : null}
      {tekst ? (
        <Text
          numberOfLines={2}
          maxFontSizeMultiplier={1.3}
          style={[
            Type.body,
            { lineHeight: 22, color: kleur, textAlign: 'center', flexShrink: 1 },
            soort === 'fout' ? { fontFamily: Fonts.sansMedium } : null,
          ]}
        >
          {tekst}
        </Text>
      ) : null}
    </View>
  );
}

// Tekstknop in de linkkleur, minimaal 44 dp hoog.
export function TekstKnop({
  label,
  onPress,
  kleur,
  uitgeschakeld,
  minHoogte = 44,
}: {
  label: string;
  onPress(): void;
  kleur?: string;
  uitgeschakeld?: boolean;
  minHoogte?: number;
}) {
  const link = useLinkKleur();
  return (
    <Drukbaar
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!uitgeschakeld }}
      disabled={uitgeschakeld}
      onPress={onPress}
      style={[styles.tekstKnop, { minHeight: minHoogte, opacity: uitgeschakeld ? 0.5 : 1 }]}
    >
      <Text style={[Type.body, { color: kleur ?? link, fontFamily: Fonts.sansMedium }]}>{label}</Text>
    </Drukbaar>
  );
}

// Grote knop van 52 dp (cta, witte tekst), gelijk aan de mockups.
export function PrimaireKnop({
  label,
  onPress,
  bezig,
  uitgeschakeld,
  kleur,
}: {
  label: string;
  onPress(): void;
  bezig?: boolean;
  uitgeschakeld?: boolean;
  // Achtergrond, standaard cta. Voor een destructieve bevestiging: colors.verlies.
  kleur?: string;
}) {
  const { colors } = useTheme();
  const uit = !!uitgeschakeld || !!bezig;
  return (
    <Drukbaar
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: uit, busy: !!bezig }}
      disabled={uit}
      onPress={onPress}
      style={[styles.primair, { backgroundColor: kleur ?? colors.cta, opacity: uitgeschakeld ? 0.5 : 1 }]}
    >
      {bezig ? (
        <ActivityIndicator color={OP_KNOP} />
      ) : (
        <Text style={[Type.sectiekop, { color: OP_KNOP }]}>{label}</Text>
      )}
    </Drukbaar>
  );
}

// Het ronde icoonvlak boven een uitlegpagina (verplichte setup, biometrie-aanbod, kluisfout).
export function IcoonCirkel({ grootte, children }: { grootte: number; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: grootte,
        height: grootte,
        borderRadius: grootte / 2,
        backgroundColor: colors.verhoogd,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    height: 48,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  tekstKnop: { paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  primair: {
    height: 52,
    borderRadius: radii.knop,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
});
