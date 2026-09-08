import { useCallback, useEffect, useState } from 'react';
import { laadTekst, bewaarTekst, verwijderSleutel, SLEUTELS } from '../storage/opslag';

// De twee knoppen van de projectiegrafiek: het verwachte rendement per jaar en de periode.
//
// Ze zitten in één hook omdat ze alleen samen betekenis hebben: een rendement zonder periode zegt
// niets en een periode zonder rendement tekent geen lijn. Twee losse hooks zouden alleen maar twee
// keer dezelfde useEffect zijn.
//
// Het rendement start op null en wordt nooit voorgevuld. Een voorgevuld percentage zou lezen als
// een verwachting van Kader, en die heeft de app niet: het is de aanname van de gebruiker, en de
// grafiek zegt dat er ook bij.
export const STANDAARD_JAREN = 5;

export function useProjectieInstellingen() {
  const [rendementPct, setRendementPct] = useState<number | null>(null);
  const [jaren, setJaren] = useState(STANDAARD_JAREN);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    Promise.all([
      laadTekst(SLEUTELS.verwachtRendement, ''),
      laadTekst(SLEUTELS.projectieJaren, ''),
    ]).then(([rendementTekst, jarenTekst]) => {
      const rendement = Number(rendementTekst);
      // Nul en negatief zijn geldige aannames, dus hier alleen toetsen of het een getal is. Dat is
      // het verschil met de inleg, waar een bedrag van nul hetzelfde is als niets invullen.
      setRendementPct(rendementTekst !== '' && Number.isFinite(rendement) ? rendement : null);

      const bewaardeJaren = Number(jarenTekst);
      setJaren(Number.isFinite(bewaardeJaren) && bewaardeJaren > 0 ? bewaardeJaren : STANDAARD_JAREN);
      setGeladen(true);
    });
  }, []);

  const zetRendement = useCallback(async (waarde: number | null) => {
    if (waarde === null || !Number.isFinite(waarde)) {
      setRendementPct(null);
      await verwijderSleutel(SLEUTELS.verwachtRendement);
      return;
    }
    setRendementPct(waarde);
    await bewaarTekst(SLEUTELS.verwachtRendement, String(waarde));
  }, []);

  const zetJaren = useCallback(async (waarde: number) => {
    setJaren(waarde);
    await bewaarTekst(SLEUTELS.projectieJaren, String(waarde));
  }, []);

  return { rendementPct, jaren, zetRendement, zetJaren, geladen };
}
