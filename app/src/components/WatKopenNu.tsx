import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { infoVoor } from '../engine/coinInfo';
import { fmtPrijs } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';

interface Props {
  trades: Trade[];
  onOpenDetail: (trade: Trade) => void;
}

export function WatKopenNu({ trades, onOpenDetail }: Props) {
  const { colors } = useTheme();
  // Alleen high conviction: gemeten +0,16 R gemiddeld, de sterkste bucket uit de backtest.
  // Een lagere score kan hier ook nog KOOP zijn, maar is niet sterk genoeg voor dit uitgelichte advies.
  const kandidaat = [...trades]
    .filter(t => t.signaal === 'KOOP' && t.highConviction)
    .sort((a, b) => b.score - a.score)[0];

  if (!kandidaat) {
    return (
      <View style={[styles.wrapper, { backgroundColor: colors.kaart }]}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>WAT MOET IK NU KOPEN?</Text>
        <Text style={[Type.body, { color: colors.tekstGedimd }]}>
          Nu geen duidelijke koopkans. Wacht op een sterker signaal.
        </Text>
      </View>
    );
  }

  const naam = infoVoor(kandidaat.symbool).naam;
  const reden = kandidaat.redenen[0] ?? `sterk signaal (score ${Math.round(kandidaat.score)})`;

  return (
    <Pressable
      onPress={() => onOpenDetail(kandidaat)}
      style={[styles.wrapper, { backgroundColor: colors.primair }]}
      accessibilityRole="button"
      accessibilityLabel={`Bekijk ${kandidaat.symbool}, aanbevolen koopkans: ${reden}`}
    >
      <Text style={[Type.overline, styles.kopWit]}>WAT MOET IK NU KOPEN?</Text>
      <View style={styles.rij}>
        <Text style={[Type.titel, styles.symbool]}>{kandidaat.symbool}</Text>
        <Text style={[Type.caption, styles.naam]} numberOfLines={1}>{naam}</Text>
        <Text style={[Type.prijs, styles.prijs]}>{fmtPrijs(kandidaat.prijs)}</Text>
      </View>
      <Text style={[Type.body, styles.reden]}>{reden}</Text>
      <View style={styles.hintRij}>
        <Text style={[Type.caption, styles.hintTekst]}>Tik voor meer info</Text>
        <ChevronRight size={13} color="rgba(255,255,255,0.75)" strokeWidth={2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.sm,
  },
  kopWit: { color: 'rgba(255,255,255,0.85)' },
  rij: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  symbool: { color: 'white' },
  naam: { color: 'rgba(255,255,255,0.75)', flex: 1 },
  prijs: { color: 'white' },
  reden: { color: 'rgba(255,255,255,0.92)' },
  hintRij: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 2,
  },
  hintTekst: {
    color: 'rgba(255,255,255,0.75)',
  },
});
