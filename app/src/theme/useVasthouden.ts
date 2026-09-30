// Ingedrukt houden om te bevestigen, los van de knop die het tekent. OrderBevestigKnop gebruikt het
// voor een echte order, SegmentKnop voor een keuze die niet per ongeluk mag omslaan. Beide krijgen zo
// dezelfde duur, dezelfde haptiek onderweg en hetzelfde terugveren bij loslaten.
import { useEffect, useRef } from 'react';
import {
  Easing,
  ReduceMotion,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useBeweging } from './useReduceMotion';
import { haptiekVanUI } from './haptiek';

interface Opties {
  // Lang genoeg dat het een bewuste handeling is, kort genoeg dat het niet gaat irriteren.
  duurMs?: number;
  geblokkeerd: boolean;
  onVoltooid: () => void;
}

export interface Vasthouden {
  // Van 0 naar 1 terwijl je vasthoudt. Draait op de UI-thread, zodat een vulling hem zonder
  // layout-werk per frame kan volgen.
  voortgang: SharedValue<number>;
  start: () => void;
  stop: () => void;
}

export function useVasthouden({ duurMs = 800, geblokkeerd, onVoltooid }: Opties): Vasthouden {
  const { naar } = useBeweging();
  const voortgang = useSharedValue(0);
  const wekker = useRef<ReturnType<typeof setTimeout> | null>(null);

  // De wekker vuurt pas na duurMs. Verandert er in die tijd iets (het saldo komt binnen en de order
  // past niet meer), dan moet hij dat zien: dus de actuele stand, niet die van bij het indrukken.
  const actueel = useRef({ onVoltooid, geblokkeerd });
  actueel.current = { onVoltooid, geblokkeerd };

  // Een lopende wekker moet weg als de component verdwijnt, anders vuurt de handeling af nadat het
  // scherm of de sheet al weg is.
  useEffect(() => () => {
    if (wekker.current !== null) clearTimeout(wekker.current);
  }, []);

  // Haptiek loopt mee met het vasthouden: een tik op een derde, iets dat vastklikt op tweederde,
  // en het zwaarste gevoel bij het volledig vasthouden. Dit draait op de UI-thread (de voortgang
  // zelf ook), dus via haptiekVanUI in plaats van de gewone haptiek().
  useAnimatedReaction(
    () => voortgang.value,
    (huidig, vorig) => {
      if (vorig === null) return;
      if (huidig >= 0.33 && vorig < 0.33) haptiekVanUI('tik');
      if (huidig >= 0.66 && vorig < 0.66) haptiekVanUI('vastklikken');
      if (huidig >= 1 && vorig < 1) haptiekVanUI('stevig');
    },
    [],
  );

  function stop() {
    if (wekker.current !== null) {
      clearTimeout(wekker.current);
      wekker.current = null;
      // Alleen terugveren als het loslaten zelf de handeling afbrak. Is de wekker al verstreken,
      // dan staat voortgang al op 0 en doet een veer niets.
      voortgang.value = naar(0, 'standaard');
    }
  }

  function start() {
    if (geblokkeerd) return;
    // De vulling is de functionele indicator van hoe ver je bent, dus die blijft ook onder Minder
    // beweging gewoon lopen (vandaar reduceMotion: Never); alleen het terugveren bij loslaten
    // verandert daar in een korte fade in plaats van een veer, via naar().
    voortgang.value = withTiming(1, {
      duration: duurMs,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    });
    wekker.current = setTimeout(() => {
      wekker.current = null;
      if (actueel.current.geblokkeerd) {
        voortgang.value = naar(0, 'standaard');
        return;
      }
      voortgang.value = 0;
      actueel.current.onVoltooid();
    }, duurMs);
  }

  return { voortgang, start, stop };
}
