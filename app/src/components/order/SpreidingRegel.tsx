import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { Network } from 'lucide-react-native';
import { opsomming, sterkMeeMet } from '../../engine/correlatie';
import { useDagKoersen } from '../../state/useDagKoersen';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, spacing } from '../../theme/tokens';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { uitklapIn, uitklapUit } from '../../theme/lijstBeweging';

// In de kooporder: beweegt deze coin sterk mee met posities die je al hebt? Anders niets.
export function SpreidingRegel({ symbool, bezit, zichtbaar }: { symbool: string; bezit: string[]; zichtbaar: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const nodig = useMemo(() => [symbool, ...bezit], [symbool, bezit]);
  const koersen = useDagKoersen(nodig, zichtbaar && bezit.length > 0);
  const mee = useMemo(() => sterkMeeMet(symbool, bezit, koersen), [symbool, bezit, koersen]);
  if (mee.length === 0) return null;
  const n = mee.length;
  return (
    <Animated.View entering={uitklapIn(reduceMotion)} exiting={uitklapUit()} style={[styles.melding, { backgroundColor: colors.letOp + '1A' }]}>
      <Network size={15} color={colors.letOp} strokeWidth={1.75} />
      <Text style={[Type.caption, styles.tekst, { color: colors.letOp }]}>
        {symbool} beweegt sterk mee met {n === 1 ? `${mee[0]}, dat je al hebt` : `${n} posities die je al hebt: ${opsomming(mee)}`}. Samen gedragen ze zich als één grotere positie.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  melding: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radii.knop, paddingHorizontal: spacing.md, paddingVertical: 10 },
  tekst: { flex: 1, lineHeight: 18 },
});
