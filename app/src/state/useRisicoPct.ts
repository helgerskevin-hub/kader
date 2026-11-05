import { useCallback, useEffect, useState } from 'react';
import { laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';

// Hoeveel procent van je handelskapitaal je per trade wilt riskeren: wat je verliest als de stop
// geraakt wordt. De kooporder rekent daar het bedrag mee uit (engine/planInGeld.ts,
// inlegVoorRisico). Drie vaste keuzes: meer dan 2% per trade is geen voorzichtige richtlijn meer,
// en een vrij veld nodigt uit tot 10%.
export type RisicoPct = '0.5' | '1' | '2';
export const STANDAARD_RISICO: RisicoPct = '1';
const GELDIG: RisicoPct[] = ['0.5', '1', '2'];

// Instellingen en de kooporder lezen dit allebei. Zonder gedeelde stand zag een kooporder die al
// gemount was een wijziging in Instellingen pas na een herstart.
let geheugen: RisicoPct | null = null;
const luisteraars = new Set<(p: RisicoPct) => void>();

export async function laadRisicoPct(): Promise<RisicoPct> {
  if (geheugen) return geheugen;
  const tekst = await laadTekst(SLEUTELS.risicoPct, STANDAARD_RISICO);
  geheugen = (GELDIG as string[]).includes(tekst) ? (tekst as RisicoPct) : STANDAARD_RISICO;
  return geheugen;
}

export function useRisicoPct() {
  const [pct, setPct] = useState<RisicoPct>(geheugen ?? STANDAARD_RISICO);

  useEffect(() => {
    let actief = true;
    laadRisicoPct().then(p => { if (actief) setPct(p); });
    luisteraars.add(setPct);
    return () => { actief = false; luisteraars.delete(setPct); };
  }, []);

  const kiesPct = useCallback(async (p: RisicoPct) => {
    geheugen = p;
    luisteraars.forEach(f => f(p));
    await bewaarTekst(SLEUTELS.risicoPct, p);
  }, []);

  return { pct, pctGetal: Number(pct), kiesPct };
}
