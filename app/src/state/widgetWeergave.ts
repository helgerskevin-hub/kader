import { useCallback, useEffect, useState } from 'react';
import { laadObject, bewaarObject, laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import type { WidgetVolgorde } from './widgetStand';

// Hoe de widget op het startscherm eruitziet. Gekozen in Instellingen, onder Widget.
//
// Bedragen (dollars) staan los en standaard uit: je startscherm zien ook anderen. Wie dollars als
// hoofdgetal of het vermogen kiest, kiest daarmee ook voor bedragen, dus die gaan dan mee aan; zet
// je bedragen uit, dan valt de widget terug op procenten en het open resultaat. Zo bestaat er geen
// stand waarin een keuze stil niets doet.
//
// Self-check onderaan: `npx tsx src/state/widgetWeergave.ts` vanuit app/.

export type WidgetIndeling = 'resultaat' | 'vermogen';
export type WidgetHoofdgetal = 'pct' | 'usd' | 'r';

export interface WidgetWeergave {
  indeling: WidgetIndeling;
  hoofdgetal: WidgetHoofdgetal;
  // Per positie een baan van stop naar doel met een stip op de koers.
  balken: boolean;
  volgorde: WidgetVolgorde;
  aantal: 2 | 3 | 4;
  bedragen: boolean;
}

export const STANDAARD_WEERGAVE: WidgetWeergave = {
  indeling: 'resultaat',
  hoofdgetal: 'pct',
  balken: true,
  volgorde: 'urgent',
  aantal: 3,
  bedragen: false,
};

const een = <T,>(waarde: unknown, opties: readonly T[], standaard: T): T =>
  opties.includes(waarde as T) ? (waarde as T) : standaard;

// Zonder bedragen geen dollars: dan geldt het percentage en het open resultaat.
export function geldig(w: WidgetWeergave): WidgetWeergave {
  if (w.bedragen) return w;
  return { ...w, hoofdgetal: w.hoofdgetal === 'usd' ? 'pct' : w.hoofdgetal, indeling: 'resultaat' };
}

export function leesWeergave(ruw: unknown, bedragen: boolean): WidgetWeergave {
  const o = (ruw && typeof ruw === 'object' ? ruw : {}) as Record<string, unknown>;
  const s = STANDAARD_WEERGAVE;
  return geldig({
    indeling: een(o.indeling, ['resultaat', 'vermogen'] as const, s.indeling),
    hoofdgetal: een(o.hoofdgetal, ['pct', 'usd', 'r'] as const, s.hoofdgetal),
    balken: typeof o.balken === 'boolean' ? o.balken : s.balken,
    volgorde: een(o.volgorde, ['urgent', 'grootste', 'uitersten'] as const, s.volgorde),
    aantal: een(o.aantal, [2, 3, 4] as const, s.aantal),
    bedragen,
  });
}

// Een wijziging toepassen: dollars als hoofdgetal of het vermogen zet bedragen aan.
export function pasToe(w: WidgetWeergave, wijziging: Partial<WidgetWeergave>): WidgetWeergave {
  const nieuw = { ...w, ...wijziging };
  if (wijziging.hoofdgetal === 'usd' || wijziging.indeling === 'vermogen') nieuw.bedragen = true;
  return geldig(nieuw);
}

export async function laadWidgetWeergave(): Promise<WidgetWeergave> {
  const [ruw, bedragen] = await Promise.all([
    laadObject<Record<string, unknown>>(SLEUTELS.widgetWeergave),
    laadTekst(SLEUTELS.widgetBedragen, 'uit'),
  ]);
  return leesWeergave(ruw, bedragen === 'aan');
}

let geheugen: WidgetWeergave | null = null;
const luisteraars = new Set<(w: WidgetWeergave) => void>();

export function useWidgetWeergave(opTekenen: () => Promise<void>) {
  const [weergave, setWeergave] = useState<WidgetWeergave>(geheugen ?? STANDAARD_WEERGAVE);

  useEffect(() => {
    let actief = true;
    laadWidgetWeergave().then(w => {
      geheugen = w;
      if (actief) setWeergave(w);
    });
    luisteraars.add(setWeergave);
    return () => { actief = false; luisteraars.delete(setWeergave); };
  }, []);

  const kies = useCallback(async (wijziging: Partial<WidgetWeergave>) => {
    // Nog niet geladen (de sheet ging net open): eerst de bewaarde keuzes, anders overschrijft één
    // tik alle andere met de standaard.
    if (geheugen === null) geheugen = await laadWidgetWeergave();
    const nieuw = pasToe(geheugen, wijziging);
    geheugen = nieuw;
    luisteraars.forEach(f => f(nieuw));
    const { bedragen, ...rest } = nieuw;
    await Promise.all([
      bewaarObject(SLEUTELS.widgetWeergave, rest),
      bewaarTekst(SLEUTELS.widgetBedragen, bedragen ? 'aan' : 'uit'),
    ]);
    // Meteen zichtbaar op het startscherm, niet pas bij de volgende verversing.
    await opTekenen();
  }, [opTekenen]);

  return { weergave, kies };
}

if (typeof require !== 'undefined' && require.main === module) {
  const check = (ok: boolean, m: string) => { if (!ok) throw new Error(m); };
  check(leesWeergave(null, false).hoofdgetal === 'pct', 'standaard procenten');
  check(leesWeergave({ hoofdgetal: 'usd', indeling: 'vermogen' }, false).hoofdgetal === 'pct', 'zonder bedragen geen dollars');
  check(leesWeergave({ indeling: 'vermogen' }, false).indeling === 'resultaat', 'zonder bedragen geen vermogen');
  check(leesWeergave({ aantal: 9, volgorde: 'raar' }, true).aantal === 3, 'onzin valt terug');
  check(pasToe(STANDAARD_WEERGAVE, { hoofdgetal: 'usd' }).bedragen, 'dollars kiezen zet bedragen aan');
  check(pasToe(STANDAARD_WEERGAVE, { indeling: 'vermogen' }).bedragen, 'vermogen zet bedragen aan');
  const uit = pasToe({ ...STANDAARD_WEERGAVE, bedragen: true, hoofdgetal: 'usd', indeling: 'vermogen' }, { bedragen: false });
  check(uit.hoofdgetal === 'pct' && uit.indeling === 'resultaat', 'bedragen uit: terug naar procenten');
  console.log('widgetWeergave self-check geslaagd');
}
