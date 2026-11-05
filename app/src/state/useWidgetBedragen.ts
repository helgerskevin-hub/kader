import { useCallback, useEffect, useState } from 'react';
import { laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import { tekenWidgets } from '../widget/widgetVerversen';

// Toont de widget op je startscherm naast R ook het resultaat in dollars? Standaard niet: je
// startscherm zien ook anderen, en R zegt genoeg over hoe je plan loopt.
let geheugen: boolean | null = null;
const luisteraars = new Set<(aan: boolean) => void>();

export async function laadWidgetBedragen(): Promise<boolean> {
  if (geheugen !== null) return geheugen;
  geheugen = (await laadTekst(SLEUTELS.widgetBedragen, 'uit')) === 'aan';
  return geheugen;
}

export function useWidgetBedragen() {
  const [aan, setAan] = useState<boolean>(geheugen ?? false);

  useEffect(() => {
    let actief = true;
    laadWidgetBedragen().then(w => { if (actief) setAan(w); });
    luisteraars.add(setAan);
    return () => { actief = false; luisteraars.delete(setAan); };
  }, []);

  const kiesBedragen = useCallback(async (nieuw: boolean) => {
    geheugen = nieuw;
    luisteraars.forEach(f => f(nieuw));
    await bewaarTekst(SLEUTELS.widgetBedragen, nieuw ? 'aan' : 'uit');
    // Meteen zichtbaar op het startscherm, niet pas bij de volgende verversing.
    await tekenWidgets();
  }, []);

  return { bedragenAan: aan, kiesBedragen };
}
