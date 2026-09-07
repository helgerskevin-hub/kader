import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii } from '../theme/tokens';

type Advies = 'KOOPZONE' | 'AFWACHTEN' | 'HIGH CONVICTION' | 'STERK KOOP';

interface Props {
  advies: Advies;
  // Het scorecijfer stond eerst als losse badge naast de koers en daarna als SCORE-kolom onderaan.
  // Onderaan is de zwakste plek voor het cijfer dat het meest zegt. Hier draagt één element zowel
  // het oordeel als de maat ervan, linksboven waar je begint met lezen, en nog steeds maar één keer
  // op de kaart.
  score?: number;
}

// Het gewicht van de badge draagt het oordeel, niet alleen de kleur: gevuld bij high conviction,
// omlijnd met een stip bij sterk koop, zacht bij koopzone en vlak grijs bij afwachten. Zo blijft
// het onderscheid leesbaar zonder dat elke kaart in de lijst even hard roept, en voldoet het aan
// de huisstijlregel dat kleur nooit het enige signaal is.
export function AdviceBadge({ advies, score }: Props) {
  const { colors, donkerActief } = useTheme();

  const vulTekst = donkerActief ? colors.achtergrond : '#FFFFFF';

  const config: Record<Advies, {
    bg: string;
    tekst: string;
    border: string;
    randBreedte: number;
    stip: boolean;
    gewicht: '600' | '700';
  }> = {
    'HIGH CONVICTION': { bg: colors.primair, tekst: vulTekst, border: colors.primair, randBreedte: 0, stip: false, gewicht: '700' },
    'STERK KOOP': { bg: 'transparent', tekst: colors.winst, border: colors.winst, randBreedte: 1.5, stip: true, gewicht: '700' },
    KOOPZONE: { bg: colors.winst + '1A', tekst: colors.winst, border: 'transparent', randBreedte: 0, stip: false, gewicht: '700' },
    AFWACHTEN: { bg: colors.verhoogd, tekst: colors.tekstGedimd, border: 'transparent', randBreedte: 0, stip: false, gewicht: '600' },
  };

  const { bg, tekst, border, randBreedte, stip, gewicht } = config[advies] ?? config.AFWACHTEN;

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border, borderWidth: randBreedte }]}>
      {stip ? <View style={[styles.stip, { backgroundColor: tekst }]} /> : null}
      <Text style={[styles.label, { color: tekst, fontWeight: gewicht }]}>{advies}</Text>
      {/* Het label blijft voorop staan, dus het cijfer krijgt iets minder dekking. Bij AFWACHTEN
          niet: colors.tekstGedimd is al gedimd en zakt daarmee onder de leesbaarheidsgrens. */}
      {score !== undefined && (
        <Text
          style={[
            Type.label,
            styles.score,
            { color: tekst, opacity: advies === 'AFWACHTEN' ? 1 : 0.85 },
          ]}
        >
          · {Math.round(score)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  stip: { width: 6, height: 6, borderRadius: 3 },
  score: { fontSize: 11 },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
});
