import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { Info } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';

interface Props {
  waarde: number; // 0–100
  klasse: string; // Engelse classificatie van Alternative.me
}

const KLASSE_NL: Record<string, string> = {
  'Extreme Fear': 'Extreme angst',
  'Fear': 'Angst',
  'Neutral': 'Neutraal',
  'Greed': 'Hebzucht',
  'Extreme Greed': 'Extreme hebzucht',
};

const UITLEG = 'Deze index meet het sentiment van de cryptomarkt op basis van volatiliteit, momentum, social media, dominantie en zoektrends (bron: Alternative.me). Een lage waarde (angst) duidt vaak op onderwaardering en mogelijke instapkansen. Een hoge waarde (hebzucht) wijst op overmoed en een verhoogd risico op een correctie. De index zegt niets over een losse coin, alleen over het bredere marktsentiment.';

export function AngstHebzucht({ waarde, klasse }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const label = KLASSE_NL[klasse] ?? klasse;
  const kleur = waarde <= 45 ? colors.verlies : waarde >= 55 ? colors.winst : colors.letOp;

  function wisselUitgeklapt() {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setUitgeklapt(v => !v);
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.kaart }]}>
      <View style={styles.kopRij}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>FEAR & GREED</Text>
        <Pressable
          onPress={wisselUitgeklapt}
          accessibilityRole="button"
          accessibilityLabel={uitgeklapt ? 'Minder uitleg' : 'Wat betekent dit?'}
          style={styles.infoKnop}
        >
          <Info size={14} color={colors.cta} strokeWidth={1.75} />
        </Pressable>
      </View>
      <View style={styles.rij}>
        <Text style={[Type.prijs, { color: kleur }]}>{waarde}</Text>
        <Text style={[Type.overline, { color: kleur }]}>{label}</Text>
      </View>
      {uitgeklapt && (
        <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>{UITLEG}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.sm,
  },
  kopRij: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoKnop: {
    minHeight: 32,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  uitleg: {
    lineHeight: 18,
  },
});
