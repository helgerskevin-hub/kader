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

// Alleen voor de tekst: "2,8% onder 90d-top", of "Op de 90d-top" als hij er (afgerond) op staat.
// `kort` is voor de smalle kaarten van de top 3: daar past de volle tekst niet naast de prijs en
// brak de pil af, waardoor de drie kaarten ongelijk hoog werden. De kop erboven zegt al dat het om
// de 90-dagen-top gaat.
export function afstandLabel(afstand: number, kort = false): string {
  const abs = Math.abs(afstand);
  if (abs < 0.05) return kort ? 'Op de top' : 'Op de 90d-top';
  const getal = abs < 10 ? abs.toFixed(1).replace('.', ',') : Math.round(abs).toString();
  return kort ? `${getal}% onder top` : `${getal}% onder 90d-top`;
}

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

// Het momentum-blok van een radar-kaart: één baan voor de afstand tot de 90d-top, het ingrediënt
// waar de score op draait, met 7d en 30d alleen als getal ernaast. De afstand zelf staat als pil in
// de kop van de kaart, dus hier hoeft hij niet nog eens als tekst. Wat null is (te weinig historie)
// laten we weg.
export function MomentumCompact({ ingredienten, volgorde = 0 }: Props) {
  const { colors } = useTheme();
  const { afstandHigh90d, rendement7d, rendement30d } = ingredienten;

  return (
    <View style={styles.compact}>
      {afstandHigh90d !== null && (
        <Balk
          fractie={1 - Math.min(Math.abs(afstandHigh90d), AFSTAND_SCHAAL) / AFSTAND_SCHAAL}
          kleur={colors.primair}
          hoogte={6}
          volgorde={volgorde}
        />
      )}
      <View style={styles.compactRij}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>MOMENTUM</Text>
        <View style={styles.spacer} />
        {([
          { label: '7D', waarde: rendement7d },
          { label: '30D', waarde: rendement30d },
        ] as const).map(({ label, waarde }) => waarde !== null && (
          <View key={label} style={styles.compactPaar}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{label}</Text>
            <Text style={[Type.prijs, styles.contextWaarde, { color: waarde >= 0 ? colors.winst : colors.verlies }]}>
              {fmtPct(waarde)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contextWaarde: { fontSize: 12 },
  compact: { gap: spacing.sm },
  // Mag afbreken: met een grote systeemletter passen MOMENTUM, 7D en 30D op 360 dp niet altijd op
  // één regel.
  compactRij: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 14, rowGap: 4 },
  compactPaar: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  spacer: { flexGrow: 1 },
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
