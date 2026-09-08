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

// Vrijwel een kopie van KapitaalSheet: zelfde opbouw en validatie, alleen een ander bedrag met een
// andere betekenis. Het bedrag gaat in dollars de opslag in, net als de rest van de app.
export function InlegSheet({ zichtbaar, huidig, onOpslaan, onSluiten }: Props) {
  const { colors } = useTheme();
  const [tekst, setTekst] = useState('');

  useEffect(() => {
    if (zichtbaar) setTekst(huidig !== null ? String(huidig) : '');
  }, [zichtbaar, huidig]);

  const waarde = Number(tekst.replace(',', '.'));
  const geldig = tekst.trim() !== '' && Number.isFinite(waarde) && waarde > 0;

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={styles.vel}>
      {/* Scrollbaar om dezelfde reden als bij KapitaalSheet: met het toetsenbord open moet de
          uitleg plus het veld plus de knop samen boven de toetsenbordbalk passen. */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.inhoud}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Maandelijkse inleg</Text>
        <Pressable onPress={onSluiten} accessibilityRole="button" accessibilityLabel="Sluiten" style={styles.sluitKnop}>
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      <Text style={[Type.body, { color: colors.tekstGedimd, lineHeight: 22 }]}>
        Wat je van plan bent om deze markt maandelijks bij te storten, in dollars.
      </Text>

      <View style={[styles.veldRij, { backgroundColor: colors.verhoogd }]}>
        <Text style={[Type.prijs, { color: colors.tekstGedimd }]}>$</Text>
        <TextInput
          value={tekst}
          onChangeText={setTekst}
          placeholder="bijv. 300"
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
          style={[Type.prijs, styles.veld, { color: colors.tekstPrimair }]}
          accessibilityLabel="Maandelijkse inleg in dollars"
        />
      </View>

      <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
        Blijft op je telefoon. Leeg laten wist het bedrag.
      </Text>

      <Pressable
        onPress={() => { onOpslaan(geldig ? waarde : null); onSluiten(); }}
        accessibilityRole="button"
        accessibilityLabel={geldig ? 'Inleg opslaan' : 'Inleg wissen'}
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
