// Boven de Feed: wanneer Kader voor het laatst bij je favorieten keek, en hoe vaak. Zonder deze regel
// weet je bij een lege Feed niet of er niets gebeurde of dat Kader niet keek.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Radar } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, spacing } from '../../theme/tokens';
import { UitlegKnop, UitlegTekst, useUitleg } from '../UitlegKnop';

const UITLEG =
  'Kader kijkt elke minuut bij je favorieten zolang je op de Feed staat, elke vijf minuten als de app '
  + 'op een andere tab openstaat, en ongeveer elk kwartier als de app dicht is. Dat laatste moment kiest '
  + 'Android zelf, dus het kan ook wat later worden. Een nieuwe trade komt hier bovenaan en je krijgt '
  + 'een melding, tenzij je die bij de Copy-instellingen uitzette.';

function tijdTekst(tijd: number): string {
  const d = new Date(tijd);
  const uur = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return uur;
  return `${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ${uur}`;
}

export function VolgStatus({ laatstGekeken }: { laatstGekeken: number | null }) {
  const { colors } = useTheme();
  // Bewust een gewone View: een Reanimated layout-overgang in een FlatList-kop gaf een Fabric-crash.
  const { open, wissel } = useUitleg();
  return (
    <View style={[styles.kaart, { backgroundColor: colors.verhoogd }]}>
      <View style={styles.rij}>
        <Radar size={14} color={colors.tekstGedimd} strokeWidth={1.75} />
        <Text style={[Type.overline, styles.tekst, { color: colors.tekstGedimd }]} numberOfLines={1}>
          {laatstGekeken ? `LAATST GEKEKEN ${tijdTekst(laatstGekeken)}` : 'NOG NIET GEKEKEN'} · ELKE MINUUT
        </Text>
        <UitlegKnop open={open} onWissel={wissel} onderwerp="hoe vaak Kader kijkt" />
      </View>
      <UitlegTekst open={open} tekst={UITLEG} />
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.knop,
  },
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tekst: { flex: 1 },
});
