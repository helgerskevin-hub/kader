import { useCallback, useEffect, useState } from 'react';
import { laadTekst, bewaarTekst, verwijderSleutel, SLEUTELS } from '../storage/opslag';

// Wat de gebruiker maandelijks van plan is bij te storten, in dollars.
//
// Eén getal voor twee blokken op het doelscherm: het bijstortplan verdeelt het over je
// doelcategorieën, de projectie rekent ermee door. Bewust niet twee losse velden, want dan kunnen
// die twee blokken uit elkaar lopen en zou het scherm zichzelf tegenspreken.
//
// Net als het handelskapitaal wordt dit nergens afgeleid en nooit verzonnen. Zonder ingevuld bedrag
// is er geen bijstortplan en geen projectie, en dat staat er dan ook zo.
export function useMaandelijkseInleg() {
  const [inleg, setInleg] = useState<number | null>(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    laadTekst(SLEUTELS.maandelijkseInleg, '').then(tekst => {
      const waarde = Number(tekst);
      setInleg(tekst !== '' && Number.isFinite(waarde) && waarde > 0 ? waarde : null);
      setGeladen(true);
    });
  }, []);

  const zetInleg = useCallback(async (waarde: number | null) => {
    if (waarde === null || !(waarde > 0)) {
      setInleg(null);
      await verwijderSleutel(SLEUTELS.maandelijkseInleg);
      return;
    }
    setInleg(waarde);
    await bewaarTekst(SLEUTELS.maandelijkseInleg, String(waarde));
  }, []);

  return { inleg, zetInleg, geladen };
}
