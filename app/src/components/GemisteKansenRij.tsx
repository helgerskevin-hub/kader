import React from 'react';
import Animated from 'react-native-reanimated';
import { EyeOff } from 'lucide-react-native';
import { fmtR } from '../engine/format';
import { sindsDagen, vatGemistSamen } from '../engine/gemisteKansen';
import { useGemisteKansen } from '../state/useGemisteKansen';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../theme/useReduceMotion';
import { schuifOvergang, uitklapIn, uitklapUit } from '../theme/lijstBeweging';
import { LijstGroep } from './lijst/LijstGroep';
import { LijstRij } from './lijst/LijstRij';

function telling(n: number, enkel: string, meer: string): string {
  return n === 0 ? '' : `${n} ${n === 1 ? enkel : meer}`;
}

// De compacte rij op Markt. Staat er alleen als er de afgelopen week een gemist doel of ontweken
// stop bijkwam; Markt hoort niet vol te raken met iets dat er meestal niet is.
export function GemisteKansenRij({ onOpen }: { onOpen: () => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { items } = useGemisteKansen(true, false);
  if (!items) return null;
  const week = sindsDagen(items, 7, Date.now());
  if (week.length === 0) return null;
  const stand = vatGemistSamen(week);
  const delen = [telling(stand.gemist.aantal, 'doel', 'doelen'), telling(stand.ontweken.aantal, 'stop', 'stops')].filter(Boolean);
  const sub = `${delen.join(' en ')} deze week, samen ${fmtR(stand.nettoR, 1)}`;

  return (
    <Animated.View entering={uitklapIn(reduceMotion)} exiting={uitklapUit()} layout={schuifOvergang(reduceMotion)}>
      <LijstGroep>
        <LijstRij icoon={EyeOff} icoonKleur={colors.primair} titel="Gemiste kansen" sub={sub} rechts="pijl" onPress={onOpen} accessibilityHint="Opent de signalen die je niet kocht" />
      </LijstGroep>
    </Animated.View>
  );
}
