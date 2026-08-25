import { useCallback, useSyncExternalStore } from 'react';
import {
  Valuta, ValutaStand, abonneerValuta, haalValutaStand, zetValutaStand,
} from '../engine/valuta';
import { haalEurPerUsd } from '../engine/marketData';
import { laadObject, bewaarObject, laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';

interface KoersCache {
  koers: number;
  tijd: number;
}

// Een halve dag. De euro/dollar-koers beweegt langzaam genoeg dat vaker ophalen niets toevoegt,
// en zo opent de app ook offline gewoon in euro's.
const KOERS_MAX_LEEFTIJD = 12 * 60 * 60 * 1000;

// Bij app-start: eerst de bewaarde keuze en de gecachete koers erin, zodat het eerste scherm al
// klopt, daarna pas eventueel een verse koers ophalen. Aanroepen vanuit App.tsx.
export async function laadValutaBijStart(): Promise<void> {
  const [opgeslagen, cache] = await Promise.all([
    laadTekst(SLEUTELS.valuta, 'USD'),
    laadObject<KoersCache>(SLEUTELS.wisselkoers),
  ]);
  const valuta: Valuta = opgeslagen === 'EUR' ? 'EUR' : 'USD';
  zetValutaStand({ valuta, eurPerUsd: cache?.koers ?? null });

  const vers = !cache || Date.now() - cache.tijd > KOERS_MAX_LEEFTIJD;
  if (vers) await ververWisselkoers();
}

// Haalt een nieuwe koers op. Mislukt dat, dan blijft de gecachete koers staan (of blijft de app
// in dollars): een verzonnen koers zou elk bedrag in de app stilletjes verkeerd maken.
export async function ververWisselkoers(): Promise<void> {
  const koers = await haalEurPerUsd();
  if (koers === null) return;
  zetValutaStand({ eurPerUsd: koers });
  await bewaarObject<KoersCache>(SLEUTELS.wisselkoers, { koers, tijd: Date.now() });
}

// Abonneert een component op de valutastand. Nodig in elk component dat bedragen toont: de
// formatters lezen de stand uit een gewone module, dus zonder dit abonnement blijft een scherm
// na het omzetten in de oude valuta staan tot het om een andere reden opnieuw rendert.
export function useValutaStand(): ValutaStand {
  return useSyncExternalStore(abonneerValuta, haalValutaStand, haalValutaStand);
}

export function useValuta() {
  const stand = useValutaStand();

  const kiesValuta = useCallback(async (volgende: Valuta) => {
    zetValutaStand({ valuta: volgende });
    await bewaarTekst(SLEUTELS.valuta, volgende);
    // Pas bij het kiezen van euro's hebben we een koers nodig; ontbreekt hij nog, haal hem dan nu.
    if (volgende === 'EUR' && haalValutaStand().eurPerUsd === null) await ververWisselkoers();
  }, []);

  return {
    valuta: stand.valuta,
    eurPerUsd: stand.eurPerUsd,
    // True als er euro's gekozen zijn maar er nog geen koers is; dan toont de app dollars.
    koersOntbreekt: stand.valuta === 'EUR' && stand.eurPerUsd === null,
    kiesValuta,
  };
}
