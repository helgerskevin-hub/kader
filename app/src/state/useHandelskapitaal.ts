import { useCallback, useEffect, useState } from 'react';
import { laadTekst, bewaarTekst, verwijderSleutel, SLEUTELS } from '../storage/opslag';

// Het handelskapitaal dat de gebruiker zelf invult, in dollars: het bedrag dat hij in totaal aan
// deze markt wil besteden, dus wat er in de markt staat plus wat er nog aan de kant ligt.
//
// Kader vraagt dit nergens verplicht en leidt het nergens af. Het staat los van wat eToro als saldo
// teruggeeft: dat is het vrij besteedbare bedrag van dat ene account, terwijl deze noemer over je
// eigen plan gaat. Zonder ingevuld kapitaal toont het blootstellingsvak alleen de richtlijn en geen
// percentage, want een verzonnen noemer maakt elk percentage waardeloos.
export function useHandelskapitaal() {
  const [kapitaal, setKapitaal] = useState<number | null>(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    laadTekst(SLEUTELS.handelskapitaal, '').then(tekst => {
      const waarde = Number(tekst);
      setKapitaal(tekst !== '' && Number.isFinite(waarde) && waarde > 0 ? waarde : null);
      setGeladen(true);
    });
  }, []);

  const zetKapitaal = useCallback(async (waarde: number | null) => {
    if (waarde === null || !(waarde > 0)) {
      setKapitaal(null);
      await verwijderSleutel(SLEUTELS.handelskapitaal);
      return;
    }
    setKapitaal(waarde);
    await bewaarTekst(SLEUTELS.handelskapitaal, String(waarde));
  }, []);

  return { kapitaal, zetKapitaal, geladen };
}
