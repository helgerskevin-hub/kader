import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { fmtR } from '../../engine/format';
import { SPREAD_LET_OP_R } from '../../engine/spread';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts, Type } from '../../theme/typography';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { uitklapIn, uitklapUit } from '../../theme/lijstBeweging';

// "De spread kost je 0.06 R voordat de koers beweegt." Alleen met een live eToro-koers.
export function SpreadRegel({ spreadR }: { spreadR: number | null }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  if (spreadR === null) return null;
  const duur = spreadR >= SPREAD_LET_OP_R;
  // fmtR geeft een teken; kosten zijn altijd positief bedoeld, dus zonder het plusje.
  const r = fmtR(spreadR).replace(/^\+/, '');
  return (
    <Animated.View entering={uitklapIn(reduceMotion)} exiting={uitklapUit()}>
      <Text style={[Type.caption, styles.tekst, { color: duur ? colors.letOp : colors.tekstGedimd }]}>
        De spread kost je <Text style={[styles.r, { color: duur ? colors.letOp : colors.tekstPrimair }]}>{r}</Text> voordat de koers beweegt.
        {duur ? ' Dat is bijna wat een signaal gemiddeld oplevert.' : ''}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tekst: { textAlign: 'center', lineHeight: 18 },
  r: { fontFamily: Fonts.monoMedium },
});
