import { useCallback, useEffect, useState } from 'react';
import { laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';

// Hoe de grote koersgrafiek op het detailscherm van een coin tekent: als lijn of als candles. De
// kleine grafiekjes op de kaarten blijven altijd een lijn, want op 50 pixels hoog is een candle
// niet te lezen.
export type GrafiekSoort = 'lijn' | 'candles';
export const STANDAARD_GRAFIEK: GrafiekSoort = 'lijn';
const GELDIG: GrafiekSoort[] = ['lijn', 'candles'];

// Instellingen en een open detailscherm lezen dit allebei. Zonder gedeelde stand zag een grafiek
// die al open stond een wijziging pas na opnieuw openen.
let geheugen: GrafiekSoort | null = null;
const luisteraars = new Set<(s: GrafiekSoort) => void>();

export async function laadGrafiekSoort(): Promise<GrafiekSoort> {
  if (geheugen) return geheugen;
  const tekst = await laadTekst(SLEUTELS.grafiekSoort, STANDAARD_GRAFIEK);
  geheugen = (GELDIG as string[]).includes(tekst) ? (tekst as GrafiekSoort) : STANDAARD_GRAFIEK;
  return geheugen;
}

export function useGrafiekSoort() {
  const [soort, setSoort] = useState<GrafiekSoort>(geheugen ?? STANDAARD_GRAFIEK);

  useEffect(() => {
    let actief = true;
    laadGrafiekSoort().then(s => { if (actief) setSoort(s); });
    luisteraars.add(setSoort);
    return () => { actief = false; luisteraars.delete(setSoort); };
  }, []);

  const kiesSoort = useCallback(async (s: GrafiekSoort) => {
    geheugen = s;
    luisteraars.forEach(f => f(s));
    await bewaarTekst(SLEUTELS.grafiekSoort, s);
  }, []);

  return { soort, kiesSoort };
}
