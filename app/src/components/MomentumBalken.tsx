import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { fmtPct } from '../engine/format';
import { MomentumIngredienten } from '../engine/momentum';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { staggerVertraging, veer } from '../theme/beweging';

// Zo ver onder de top telt de score als 0, gelijk aan de schaal in momentumScore (momentum.ts).
const AFSTAND_SCHAAL = 30;
// Rendementen waarbij een balkje vol is; daarboven is de balk alleen nog context.
const VOL_7D = 20;
const VOL_30D = 50;

// Alleen voor de tekst: "2,8% onder 90d-top", of "Op de 90d-top" als hij er (afgerond) op staat.
export function afstandLabel(afstand: number): string {
  const abs = Math.abs(afstand);
  if (abs < 0.05) return 'Op de 90d-top';
  const getal = abs < 10 ? abs.toFixed(1).replace('.', ',') : Math.round(abs).toString();
  return `${getal}% onder 90d-top`;
}

// Kleinste zichtbare vulling voor een rendement dat niet precies nul is. Zonder dit staat +0,4% als
// een lege balk naast een lege balk voor 0%, en dat leest als "geen gegevens".
const MIN_VULLING = 0.04;

// Memo: de kaart tekent opnieuw bij elke favoriet- of valutawissel, en dan hoeven de balkjes met
// dezelfde stand niet mee.
const Balk = memo(function Balk({ fractie, kleur, hoogte, volgorde }: {
  fractie: number;
  kleur: string;
  hoogte: number;
  volgorde: number;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const doel = Math.min(Math.max(fractie, 0), 1);
  const vulling = useSharedValue(reduceMotion ? doel : 0);

  // De balk loopt op een veer vol bij binnenkomst en veert bij een nieuwe scan naar zijn nieuwe
  // stand. Via scaleX en niet via width, zoals in Laadbalk.
  useEffect(() => {
    vulling.value = reduceMotion
      ? doel
      : withDelay(staggerVertraging(volgorde), withSpring(doel, veer.standaard));
  }, [doel, reduceMotion, volgorde, vulling]);

  const stijl = useAnimatedStyle(() => ({ transform: [{ scaleX: vulling.value }] }));

  return (
    <View style={[styles.spoor, { height: hoogte, backgroundColor: colors.verhoogd }]}>
      <Animated.View style={[styles.vulling, { backgroundColor: kleur }, stijl]} />
    </View>
  );
});

interface Props {
  ingredienten: MomentumIngredienten;
  // Plek van de kaart in de lijst, voor de staffeling.
  volgorde?: number;
}

// Het momentum-blok van een radar-kaart. De hoofdbalk is het ingrediënt waar de score op draait
// (afstand tot de 90d-top); 7d en 30d staan er als dunne balkjes onder, puur als context.
export function MomentumBalken({ ingredienten, volgorde = 0 }: Props) {
  const { colors } = useTheme();
  const { afstandHigh90d, rendement7d, rendement30d } = ingredienten;

  const rendementKleur = (r: number) => (r >= 0 ? colors.winst : colors.verlies);

  return (
    <View style={styles.blok}>
      {afstandHigh90d !== null && (
        <View style={styles.hoofd}>
          <View style={styles.labelRij}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>MOMENTUM</Text>
            <Text style={[Type.prijs, styles.hoofdWaarde, { color: colors.tekstPrimair }]}>
              {afstandLabel(afstandHigh90d)}
            </Text>
          </View>
          <Balk
            fractie={1 - Math.min(Math.abs(afstandHigh90d), AFSTAND_SCHAAL) / AFSTAND_SCHAAL}
            kleur={colors.primair}
            hoogte={8}
            volgorde={volgorde}
          />
        </View>
      )}
      <View style={styles.context}>
        {([
          { label: '7D', waarde: rendement7d, vol: VOL_7D },
          { label: '30D', waarde: rendement30d, vol: VOL_30D },
        ] as const).map(({ label, waarde, vol }, i) => waarde !== null && (
          <View key={label} style={styles.contextItem}>
            <View style={styles.labelRij}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{label}</Text>
              <Text style={[Type.prijs, styles.contextWaarde, { color: rendementKleur(waarde) }]}>
                {fmtPct(waarde)}
              </Text>
            </View>
            <Balk
              fractie={waarde === 0 ? 0 : Math.max(Math.abs(waarde) / vol, MIN_VULLING)}
              kleur={rendementKleur(waarde)}
              hoogte={4}
              volgorde={volgorde + i + 1}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blok: { gap: spacing.md },
  hoofd: { gap: 6 },
  labelRij: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  hoofdWaarde: { fontSize: 13 },
  context: { flexDirection: 'row', gap: spacing.lg },
  contextItem: { flex: 1, gap: 4 },
  contextWaarde: { fontSize: 12 },
  spoor: { borderRadius: radii.pill, overflow: 'hidden' },
  vulling: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.pill,
    transformOrigin: 'left',
  },
});
