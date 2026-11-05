// Opslag en bijwerken van het signaalboek (engine/signaalLog.ts). Draait vanuit MarktProvider na
// elke analyse en vanuit de achtergrondtaak. Geen fout mag hier een analyse of melding laten
// mislukken, dus alles vangt zijn eigen fouten.

import { useCallback, useEffect, useState } from 'react';
import { laadObject, bewaarObject, SLEUTELS } from '../storage/opslag';
import { haalData } from '../engine/marketData';
import type { Trade } from '../engine/types';
import { bepaalUitkomst, voegSignalenToe, type GelogdSignaal } from '../engine/signaalLog';

interface Boek {
  versie: 1;
  signalen: GelogdSignaal[];
  laatstBijgewerkt: number;
}

// Dagcandles veranderen alleen nog in de lopende dag, dus vaker dan een paar keer per dag
// bijwerken levert niets op en kost per open signaal een request.
const BIJWERK_INTERVAL_MS = 3 * 60 * 60 * 1000;

// Twee aanroepers (voorgrond en achtergrond) kunnen tegelijk schrijven. Binnen één JS-context
// rijgen we de schrijfacties aan elkaar, zodat de ene de andere niet overschrijft.
let wachtrij: Promise<unknown> = Promise.resolve();
function opRij<T>(stap: () => Promise<T>): Promise<T> {
  const volgende = wachtrij.then(stap, stap);
  wachtrij = volgende.catch(() => undefined);
  return volgende;
}

const luisteraars = new Set<() => void>();

async function laadBoek(): Promise<Boek> {
  const b = await laadObject<Boek>(SLEUTELS.signaalBoek);
  if (b && b.versie === 1 && Array.isArray(b.signalen)) return b;
  return { versie: 1, signalen: [], laatstBijgewerkt: 0 };
}

async function bewaar(b: Boek): Promise<void> {
  await bewaarObject(SLEUTELS.signaalBoek, b);
  luisteraars.forEach(f => f());
}

export function laadSignalen(): Promise<GelogdSignaal[]> {
  return laadBoek().then(b => b.signalen).catch(() => []);
}

export function registreerSignalen(trades: Trade[]): Promise<void> {
  return opRij(async () => {
    const b = await laadBoek();
    const signalen = voegSignalenToe(b.signalen, trades, Date.now());
    if (signalen !== b.signalen) await bewaar({ ...b, signalen });
  }).catch(() => undefined);
}

// Haalt per coin met een lopend signaal verse dagcandles op en kijkt of stop of doel geraakt is.
// `forceer` slaat de rem over, voor als iemand het scherm opent.
export function werkSignalenBij(forceer = false): Promise<void> {
  return opRij(async () => {
    const b = await laadBoek();
    const nu = Date.now();
    if (!forceer && nu - b.laatstBijgewerkt < BIJWERK_INTERVAL_MS) return;
    const symbolen = [...new Set(b.signalen.filter(s => s.uitkomst === 'open').map(s => s.symbool))];
    const candles: Record<string, Awaited<ReturnType<typeof haalData>>> = {};
    for (const sym of symbolen) {
      try {
        candles[sym] = await haalData(sym);
      } catch {
        candles[sym] = null;
      }
    }
    // Opnieuw laden: tijdens het ophalen kan er een nieuw signaal bij zijn gekomen.
    const vers = await laadBoek();
    const signalen = vers.signalen.map(s => {
      const c = candles[s.symbool];
      return c ? bepaalUitkomst(s, c.candles, nu) : s;
    });
    await bewaar({ ...vers, signalen, laatstBijgewerkt: nu });
  }).catch(() => undefined);
}

// Voor het scherm: de signalen, en opnieuw geladen zodra het boek verandert.
export function useSignaalBoek(actief: boolean): { signalen: GelogdSignaal[] | null; bezig: boolean } {
  const [signalen, setSignalen] = useState<GelogdSignaal[] | null>(null);
  const [bezig, setBezig] = useState(false);
  const herlaad = useCallback(() => { laadSignalen().then(setSignalen); }, []);

  useEffect(() => {
    if (!actief) return;
    herlaad();
    luisteraars.add(herlaad);
    setBezig(true);
    werkSignalenBij(true).finally(() => setBezig(false));
    return () => { luisteraars.delete(herlaad); };
  }, [actief, herlaad]);

  return { signalen, bezig };
}
