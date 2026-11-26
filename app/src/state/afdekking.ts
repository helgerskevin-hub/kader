// Externe store voor de afdekking van de app (zie AfdekkingStore in vergrendelTypes.ts). Is
// de afdekking aan, dan toont de root alleen het merkvlak en geen inhoud. Dat voorkomt een
// flits van saldo of portfolio bij een koude start en bij terugkomst op het slot.
//
// Begint op true: tot de provider weet dat de status 'open' is of het slot getoond wordt,
// blijft alles afgedekt. Geen native aanroepen hier; de provider roept zetRecentsAfbeelding aan.

import { useSyncExternalStore } from 'react';
import type { AfdekkingStore } from './vergrendelTypes';

let afgedekt = true;
const luisteraars = new Set<() => void>();

export const afdekking: AfdekkingStore = {
  isAfgedekt: () => afgedekt,
  zetAfgedekt(nieuw) {
    if (nieuw === afgedekt) return;
    afgedekt = nieuw;
    // Kopie, zodat een luisteraar die zich afmeldt de lus niet verstoort.
    for (const luisteraar of [...luisteraars]) luisteraar();
  },
  abonneer(luisteraar) {
    luisteraars.add(luisteraar);
    return () => {
      luisteraars.delete(luisteraar);
    };
  },
};

export const zetAfgedekt = afdekking.zetAfgedekt;
export const isAfgedekt = afdekking.isAfgedekt;
export const abonneer = afdekking.abonneer;

export function useAfgedekt(): boolean {
  return useSyncExternalStore(abonneer, isAfgedekt, isAfgedekt);
}
