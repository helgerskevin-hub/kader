import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldAlert, ShieldCheck, Info } from 'lucide-react-native';
import { AfbouwAdvies } from '../state/afbouw';
import { fmtPrijs } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useValutaStand } from '../state/useValuta';

// Het klimaat-bewuste advies onder een open positie: wat het dalen van de markt betekent voor deze
// specifieke trade. Staat bewust náást het gewone advieslabel en vervangt het niet: dat label gaat
// over de koers ten opzichte van je eigen stop en doel, dit gaat over de markt eromheen.
//
// Verschijnt alleen als er iets te zeggen valt. In een stijgende markt bij een gezonde trade geeft
// bepaalAfbouwAdvies null terug en staat hier dus niets, want een tweede zin die niets toevoegt
// leert de gebruiker alleen om hem over te slaan.
export function AfbouwRegel({ advies, huidigeStop }: { advies: AfbouwAdvies; huidigeStop: number }) {
  useValutaStand();

  const { colors } = useTheme();

  const kleur = advies.niveau === 'houden' ? colors.winst
    : colors.letOp;
  const Icoon = advies.niveau === 'houden' ? ShieldCheck
    : advies.niveau === 'afbouwen' ? ShieldAlert
    : Info;
  // Alleen het dringendste niveau krijgt een vlak eronder. Zonder dat verschil lezen "overweeg
  // winst te nemen" en "hou je aan je plan" als even hard, terwijl alleen het eerste om een
  // beslissing vraagt.
  const achtergrond = advies.niveau === 'afbouwen' ? colors.letOp + '1A' : 'transparent';

  return (
    <View style={[styles.wrapper, { backgroundColor: achtergrond }]}>
      <View style={styles.kop}>
        <Icoon size={14} color={kleur} strokeWidth={2} />
        <Text style={[Type.overline, { color: kleur }]}>{advies.kort.toUpperCase()}</Text>
      </View>
      <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>{advies.tekst}</Text>
      {advies.trailingStop !== undefined && (
        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
          Voorstel: stop van {fmtPrijs(huidigeStop)} naar {fmtPrijs(advies.trailingStop)}. Daarmee
          zet je de winst tot daar vast.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.veld,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  kop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
