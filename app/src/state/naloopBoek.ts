// Opslag en bijwerken van de naloop van regel C (engine/naloopRustig.ts), en daarmee van het
// Kader-mandje op Markt. Draait vanuit
// MarktProvider na elke analyse en vanuit de achtergrondtaak. Net als het signaalboek mag hier geen
// fout een analyse of melding laten mislukken, dus alles vangt zijn eigen fouten.

import { useCallback, useEffect, useState } from 'react';
import { laadObject, bewaarObject, SLEUTELS } from '../storage/opslag';
import { haalData } from '../engine/marketData';
import type { Trade } from '../engine/types';
import { leegBoek, volg, vulAan, migreer, controleerLat, type NaloopBoek } from '../engine/naloopRustig';

// Dagcandles veranderen alleen nog in de lopende dag; een stop wordt op het slot gezet. Een paar
// keer per dag kijken is genoeg en kost per open positie een request.
const BIJWERK_INTERVAL_MS = 3 * 60 * 60 * 1000;

let wachtrij: Promise<unknown> = Promise.resolve();
function opRij<T>(stap: () => Promise<T>): Promise<T> {
  const volgende = wachtrij.then(stap, stap);
  wachtrij = volgende.catch(() => undefined);
  return volgende;
}

const luisteraars = new Set<() => void>();

async function laadBoek(): Promise<NaloopBoek> {
  const b = await laadObject<Parameters<typeof migreer>[0]>(SLEUTELS.naloopBoek);
  return b && (b.versie === 1 || b.versie === 2) && Array.isArray(b.posities) ? migreer(b) : leegBoek();
}

async function bewaar(b: NaloopBoek): Promise<void> {
  await bewaarObject(SLEUTELS.naloopBoek, b);
  luisteraars.forEach(f => f());
}

// Eerst de stops bijwerken (een positie die uitging maakt een plek vrij), dan aanvullen.
export function registreerNaloop(trades: Trade[], poortIsOpen: boolean): Promise<void> {
  return opRij(async () => {
    const b = await laadBoek();
    const nu = Date.now();
    const na = controleerLat(vulAan(b, trades, poortIsOpen, nu), nu);
    if (na !== b) await bewaar(na);
  }).catch(() => undefined);
}

export function werkNaloopBij(forceer = false): Promise<void> {
  return opRij(async () => {
    const b = await laadBoek();
    const nu = Date.now();
    if (!forceer && nu - b.laatstBijgewerkt < BIJWERK_INTERVAL_MS) return;
    const symbolen = [...new Set(b.posities.filter(p => p.uitkomst === 'open').map(p => p.symbool))];
    const candles: Record<string, Awaited<ReturnType<typeof haalData>>> = {};
    for (const sym of symbolen) {
      try {
        candles[sym] = await haalData(sym);
      } catch {
        candles[sym] = null;
      }
    }
    const vers = await laadBoek();
    let kas = vers.kas;
    const laatstePrijs = { ...vers.laatstePrijs };
    // Alleen dagcandles van Binance: de stop rekent in dagen, de CoinGecko-terugval levert vier-uurs
    // candles.
    const posities = vers.posities.map(p => {
      const c = candles[p.symbool];
      if (!c || c.bron !== 'Binance') return p;
      const laatste = c.candles[c.candles.length - 1];
      if (laatste?.close > 0) laatstePrijs[p.symbool] = laatste.close;
      const { p: nieuw, opbrengst } = volg(p, c.candles, nu);
      kas += opbrengst;
      return nieuw;
    });
    await bewaar(controleerLat({ ...vers, posities, kas, laatstePrijs, laatstBijgewerkt: nu }, nu));
  }).catch(() => undefined);
}

// De coins die nu in het mandje zitten, voor de stop-meldingen. Leeg als de lat afging.
export async function laadMandjeSymbolen(): Promise<Set<string>> {
  try {
    const b = await laadBoek();
    if (b.latAf) return new Set();
    return new Set(b.posities.filter(p => p.uitkomst === 'open').map(p => p.symbool));
  } catch {
    return new Set();
  }
}

export function useNaloopBoek(actief: boolean): NaloopBoek | null {
  const [boek, setBoek] = useState<NaloopBoek | null>(null);
  const herlaad = useCallback(() => { laadBoek().then(setBoek).catch(() => setBoek(leegBoek())); }, []);
  useEffect(() => {
    if (!actief) return;
    herlaad();
    luisteraars.add(herlaad);
    werkNaloopBij(true);
    return () => { luisteraars.delete(herlaad); };
  }, [actief, herlaad]);
  return boek;
}
