import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { Info, TriangleAlert } from 'lucide-react-native';
import { Marktklimaat } from '../engine/marktklimaat';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';

interface Props {
  klimaat: Marktklimaat;
}

const LABEL: Record<Marktklimaat['klimaat'], string> = {
  gunstig: 'GUNSTIG',
  gemengd: 'GEMENGD',
  ongunstig: 'ONGUNSTIG',
};

const POSITIE: Record<Marktklimaat['klimaat'], number> = {
  ongunstig: 1 / 6,
  gemengd: 0.5,
  gunstig: 5 / 6,
};

const UITLEG = 'Deze balk toont het marktklimaat: staat BTC boven zijn 50-daags gemiddelde, en stijgt het aandeel coins dat boven zijn eigen 50-daags gemiddelde staat? Beide gunstig is GUNSTIG: in dat klimaat presteerden koopsignalen historisch het best. Beide ongunstig is ONGUNSTIG: in dat soort periodes (2018, 2022, begin 2026) verloren koopsignalen historisch gemiddeld geld, en toont Kader daarom geen KOOP-signalen, hoe hoog de score ook is. Bij GEMENGD blijven de gewone koopsignalen gewoon zichtbaar.';

export function MarktBalk({ klimaat }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const positie = POSITIE[klimaat.klimaat];
  const label = LABEL[klimaat.klimaat];

  const knopKleur = klimaat.klimaat === 'gunstig' ? colors.winst
    : klimaat.klimaat === 'gemengd' ? colors.letOp
    : colors.verlies;

  function wisselUitgeklapt() {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setUitgeklapt(v => !v);
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.kaart }]}>
      <View style={styles.bovenkant}>
        <View style={styles.titelRij}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>MARKTKLIMAAT</Text>
          <Pressable
            onPress={wisselUitgeklapt}
            accessibilityRole="button"
            accessibilityLabel={uitgeklapt ? 'Minder uitleg' : 'Wat betekent dit?'}
            style={styles.infoKnop}
          >
            <Info size={14} color={colors.cta} strokeWidth={1.75} />
          </Pressable>
        </View>
        <View style={styles.scoreRij}>
          <Text style={[Type.overline, { color: knopKleur }]}>{label}</Text>
        </View>
      </View>
      {uitgeklapt && (
        <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>{UITLEG}</Text>
      )}

      <View style={styles.detailRij}>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
          BTC {klimaat.btcBovenEma50 ? 'boven' : 'onder'} EMA50 · marktbreedte {Math.round(klimaat.breedte * 100)}%
          {klimaat.breedteStijgend ? ' (stijgend)' : ' (dalend)'}
        </Text>
      </View>

      {klimaat.klimaat === 'ongunstig' && (
        <View style={[styles.waarschuwing, { backgroundColor: colors.verlies + '1A' }]}>
          <TriangleAlert size={14} color={colors.verlies} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.waarschuwingTekst, { color: colors.verlies }]}>
            In dit klimaat verloren koopsignalen historisch gemiddeld geld. Kader toont daarom nu geen KOOP-signalen.
          </Text>
        </View>
      )}

      {/* Balk */}
      <View style={styles.balk}>
        <View style={[styles.balkGradient, styles.balkRood]} />
        <View style={[styles.balkGradient, styles.balkAmber]} />
        <View style={[styles.balkGradient, styles.balkGroen]} />

        {/* Labels */}
        <View style={styles.labelsRij}>
          <Text style={[Type.label, { color: colors.verlies }]}>ONGUNSTIG</Text>
          <Text style={[Type.label, { color: colors.letOp }]}>GEMENGD</Text>
          <Text style={[Type.label, { color: colors.winst }]}>GUNSTIG</Text>
        </View>

        {/* Indicator */}
        <View style={[styles.indicatorWrapper, { left: `${positie * 100}%` as any }]}>
          <View style={[styles.indicator, { backgroundColor: knopKleur }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.sm,
  },
  bovenkant: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoKnop: {
    minHeight: 32,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uitleg: {
    lineHeight: 18,
  },
  scoreRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailRij: {
    flexDirection: 'row',
  },
  waarschuwing: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderRadius: radii.veld,
    padding: spacing.sm,
  },
  waarschuwingTekst: {
    flex: 1,
    lineHeight: 17,
  },
  balk: {
    height: 20,
    borderRadius: radii.pill,
    overflow: 'visible',
    flexDirection: 'row',
    position: 'relative',
  },
  balkGradient: {
    flex: 1,
    height: 8,
    marginTop: 6,
  },
  balkRood: {
    backgroundColor: '#DC2626',
    borderTopLeftRadius: radii.pill,
    borderBottomLeftRadius: radii.pill,
  },
  balkAmber: {
    backgroundColor: '#D97706',
  },
  balkGroen: {
    backgroundColor: '#16A34A',
    borderTopRightRadius: radii.pill,
    borderBottomRightRadius: radii.pill,
  },
  labelsRij: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  indicatorWrapper: {
    position: 'absolute',
    top: 0,
    marginLeft: -8,
  },
  indicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
