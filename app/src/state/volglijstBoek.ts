// Opslag en bijwerken van het trackrecord van de volglijst (engine/volglijstLog.ts). Draait vanuit
// KansenProvider na elke geslaagde scan. Zelfde opzet als signaalBoek.ts, met een eigen sleutel.
// Geen fout mag hier een scan laten mislukken, dus alles vangt zijn eigen fouten.

import { useCallback, useEffect, useState } from 'react';
import { laadObject, bewaarObject, SLEUTELS } from '../storage/opslag';
import { haalData } from '../engine/marketData';
import type { Opportunity } from '../engine/types';
import type { Klimaat } from '../engine/marktklimaat';
import { bepaalUitkomst } from '../engine/signaalLog';
import { voegKansenToe, type GevolgdeKans } from '../engine/volglijstLog';

interface Boek {
  versie: 1;
  regels: GevolgdeKans[];
  laatstBijgewerkt: number;
}

// Dagcandles veranderen alleen nog in de lopende dag, dus vaker bijwerken levert niets op en kost
// per lopende regel een request.
const BIJWERK_INTERVAL_MS = 3 * 60 * 60 * 1000;

// Scan en scherm kunnen tegelijk schrijven; de schrijfacties rijgen we aan elkaar.
let wachtrij: Promise<unknown> = Promise.resolve();
function opRij<T>(stap: () => Promise<T>): Promise<T> {
  const volgende = wachtrij.then(stap, stap);
  wachtrij = volgende.catch(() => undefined);
  return volgende;
}

const luisteraars = new Set<() => void>();

async function laadBoek(): Promise<Boek> {
  const b = await laadObject<Boek>(SLEUTELS.volglijstBoek);
  if (b && b.versie === 1 && Array.isArray(b.regels)) return b;
  return { versie: 1, regels: [], laatstBijgewerkt: 0 };
}

async function bewaar(b: Boek): Promise<void> {
  await bewaarObject(SLEUTELS.volglijstBoek, b);
  luisteraars.forEach(f => f());
}

export function registreerVolglijst(kansen: Opportunity[], radarLeeg: boolean, klimaat: Klimaat | null): Promise<void> {
  return opRij(async () => {
    const b = await laadBoek();
    const regels = voegKansenToe(b.regels, kansen, radarLeeg, klimaat, Date.now());
    if (regels !== b.regels) await bewaar({ ...b, regels });
  }).catch(() => undefined);
}

// Haalt per coin met een lopende regel verse dagcandles op en kijkt of stop of doel geraakt is.
// `forceer` slaat de rem over, voor als iemand het scherm opent.
export function werkVolglijstBij(forceer = false): Promise<void> {
  return opRij(async () => {
    const b = await laadBoek();
    const nu = Date.now();
    if (!forceer && nu - b.laatstBijgewerkt < BIJWERK_INTERVAL_MS) return;
    const symbolen = [...new Set(b.regels.filter(s => s.uitkomst === 'open').map(s => s.symbool))];
    const candles: Record<string, Awaited<ReturnType<typeof haalData>>> = {};
    for (const sym of symbolen) {
      try {
        candles[sym] = await haalData(sym);
      } catch {
        candles[sym] = null;
      }
    }
    // Opnieuw laden: tijdens het ophalen kan er een regel bij zijn gekomen.
    const vers = await laadBoek();
    const regels = vers.regels.map(s => {
      const c = candles[s.symbool];
      return c ? bepaalUitkomst(s, c.candles, nu) : s;
    });
    await bewaar({ ...vers, regels, laatstBijgewerkt: nu });
  }).catch(() => undefined);
}

// Voor het scherm: de regels, en opnieuw geladen zodra het boek verandert.
export function useVolglijstBoek(actief: boolean): GevolgdeKans[] | null {
  const [regels, setRegels] = useState<GevolgdeKans[] | null>(null);
  const herlaad = useCallback(() => {
    laadBoek().then(b => setRegels(b.regels)).catch(() => setRegels([]));
  }, []);

  useEffect(() => {
    if (!actief) return;
    herlaad();
    luisteraars.add(herlaad);
    werkVolglijstBij(true);
    return () => { luisteraars.delete(herlaad); };
  }, [actief, herlaad]);

  return regels;
}
