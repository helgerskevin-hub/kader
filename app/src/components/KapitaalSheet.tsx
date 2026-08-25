import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';

interface Props {
  zichtbaar: boolean;
  huidig: number | null;
  onOpslaan: (waarde: number | null) => void;
  onSluiten: () => void;
}

// Het bedrag gaat in dollars de opslag in, net als alle andere bedragen in de app, en het veld zegt
// dat er expliciet bij. Een veld dat euro's suggereert terwijl er dollars in gaan is precies de
// verwarring die een blootstellingspercentage waardeloos maakt.
export function KapitaalSheet({ zichtbaar, huidig, onOpslaan, onSluiten }: Props) {
  const { colors } = useTheme();
  const [tekst, setTekst] = useState('');

  useEffect(() => {
    if (zichtbaar) setTekst(huidig !== null ? String(huidig) : '');
  }, [zichtbaar, huidig]);

  const waarde = Number(tekst.replace(',', '.'));
  const geldig = tekst.trim() !== '' && Number.isFinite(waarde) && waarde > 0;

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={styles.vel}>
      {/* Scrollbaar, want met het toetsenbord open past de uitleg plus het veld plus de knop niet
          op een kleiner scherm en viel de knop erachter. keyboardShouldPersistTaps zodat de eerste
          tik op Opslaan meteen opslaat in plaats van alleen het toetsenbord weg te halen. */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.inhoud}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Je handelskapitaal</Text>
        <Pressable onPress={onSluiten} accessibilityRole="button" accessibilityLabel="Sluiten" style={styles.sluitKnop}>
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      {/* Bewust kort. Met het toetsenbord open moet de titel, deze uitleg, het veld en de knop
          samen boven de toetsenbordbalk passen; een alinea langer en de knop valt erachter. De
          volledige uitleg staat achter het i-icoon op de blootstellingskaart zelf. */}
      <Text style={[Type.body, { color: colors.tekstGedimd, lineHeight: 22 }]}>
        Het totale bedrag dat je aan crypto wil besteden: wat er in de markt staat plus wat er nog
        aan de kant ligt.
      </Text>

      <View style={[styles.veldRij, { backgroundColor: colors.verhoogd }]}>
        <Text style={[Type.prijs, { color: colors.tekstGedimd }]}>$</Text>
        <TextInput
          value={tekst}
          onChangeText={setTekst}
          placeholder="bijvoorbeeld 2500"
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
          style={[Type.prijs, styles.veld, { color: colors.tekstPrimair }]}
          accessibilityLabel="Handelskapitaal in dollars"
        />
      </View>

      <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
        Blijft op je telefoon. Leeg laten zet het percentage weer uit.
      </Text>

      <Pressable
        onPress={() => { onOpslaan(geldig ? waarde : null); onSluiten(); }}
        accessibilityRole="button"
        accessibilityLabel={geldig ? 'Kapitaal opslaan' : 'Kapitaal wissen'}
        style={[styles.knop, { backgroundColor: geldig ? colors.cta : colors.verhoogd }]}
      >
        <Text style={[Type.body, { color: geldig ? 'white' : colors.tekstGedimd, fontWeight: '600' }]}>
          {geldig ? 'Opslaan' : 'Wissen'}
        </Text>
      </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // De gap zit op de scroll-inhoud, niet op het vel: een ScrollView-kind rekt anders niet mee.
  vel: { maxHeight: '85%' },
  inhoud: { gap: spacing.base },
  titelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sluitKnop: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  veldRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    borderRadius: radii.veld,
    minHeight: 52,
  },
  veld: { flex: 1, paddingVertical: spacing.md },
  knop: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.knop,
    minHeight: 48,
  },
});
