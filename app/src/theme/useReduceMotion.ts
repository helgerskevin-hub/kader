import { useCallback, useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { withSpring, type AnimationCallback } from 'react-native-reanimated';
import { veer, duur, vervaag, type VeerNaam } from './beweging';

// Eén bron voor de hele app in plaats van een eigen abonnement per component. Het uitlezen gebeurt
// meteen bij het laden van deze module, dus ruim voor het eerste scherm met beweging; zo tekent
// een component dat later mount (een order-sheet, een nieuwe kaart) zijn eerste frame al met de
// juiste stand, en veert een sheet onder Minder beweging niet toch even binnen.
let minderBeweging = false;
const luisteraars = new Set<() => void>();

function zetMinderBeweging(aan: boolean) {
  if (aan === minderBeweging) return;
  minderBeweging = aan;
  luisteraars.forEach(l => l());
}

AccessibilityInfo.isReduceMotionEnabled().then(zetMinderBeweging).catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', zetMinderBeweging);

function abonneer(luisteraar: () => void) {
  luisteraars.add(luisteraar);
  return () => {
    luisteraars.delete(luisteraar);
  };
}

function leesStand() {
  return minderBeweging;
}

export function useReduceMotion(): boolean {
  return useSyncExternalStore(abonneer, leesStand);
}

export interface NaarOpties {
  // Beginsnelheid voor de veer, bijvoorbeeld de velocity van een losgelaten gebaar, zodat de
  // beweging de vaart van de vinger overneemt in plaats van vanuit stilstand te vertrekken.
  snelheid?: number;
  // Draait op de UI-thread als de animatie klaar of onderbroken is (finished = false).
  klaar?: AnimationCallback;
}

// Eén toegangspunt voor "beweeg hierheen" dat vanzelf het Apple-gedrag bij Minder beweging
// krijgt: normaal een veer uit beweging.ts, met Minder beweging aan een korte fade-timing zonder
// veer. Werkt in worklets (useAnimatedStyle, gesture-callbacks) en op de JS-thread.
//
// Waarom niet Reanimated's eigen useReducedMotion(): die leest de systeeminstelling één keer bij
// het opstarten en hoort een wijziging niet. useReduceMotion hierboven luistert wel mee, en
// dezelfde bron gebruiken als de rest van de app voorkomt dat twee delen het oneens zijn. De
// boolean wordt door de worklets-plugin in de closure van naar() meegenomen naar de UI-thread;
// verandert hij, dan maakt useCallback een nieuwe naar() en pakt useAnimatedStyle die op.
//
// Let op bij Minder beweging: naar() maakt de beweging kort, maar schuift nog steeds. Voor een
// verplaatsing of zoom hoort het component zelf reduceMotion te lezen en op opacity over te
// stappen (zoals Drukbaar doet); naar() is dan de terugval, geen vrijbrief.
export function useBeweging() {
  const reduceMotion = useReduceMotion();

  const naar = useCallback(
    (waarde: number, veerNaam: VeerNaam = 'standaard', opties?: NaarOpties): number => {
      'worklet';
      if (reduceMotion) return vervaag(waarde, duur.kort, opties?.klaar);
      return withSpring(
        waarde,
        { ...veer[veerNaam], velocity: opties?.snelheid ?? 0 },
        opties?.klaar,
      );
    },
    [reduceMotion],
  );

  return { reduceMotion, naar };
}
