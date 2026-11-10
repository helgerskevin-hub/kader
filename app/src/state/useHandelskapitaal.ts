import { useCallback, useEffect, useState } from 'react';
import { laadTekst, bewaarTekst, verwijderSleutel, SLEUTELS } from '../storage/opslag';
import { haalOmgeving, heeftEnigeSleutel } from './etoroSleutels';
import { usePortfolio } from './PortfolioProvider';
import { AutoKapitaal, AutoKapitaalPerOmgeving, laadAutoKapitaal, luisterNaarAutoKapitaal } from './autoKapitaal';

// Het handelskapitaal in dollars: de noemer onder blootstelling, risico per trade, de verliesrem
// en het plafond voor copies.
//
// Met een eToro-koppeling haalt Kader het zelf uit eToro: alles wat er op het account van de
// actieve omgeving staat (vrij saldo, posities, copies, ongerealiseerd resultaat), bijgewerkt bij
// elke sync. Zie berekenHandelskapitaal in engine/etoro.ts. Zonder koppeling, of als eToro geen
// saldo meestuurde, geldt het getal dat de gebruiker zelf invulde. Is dat er ook niet, dan null:
// een verzonnen noemer maakt elk percentage waardeloos.

export { laadHandelskapitaal } from './handelskapitaal';
import { bruikbaar, laadHandmatig } from './handelskapitaal';

export function useHandelskapitaal() {
  const { etoroGekoppeld, omgeving } = usePortfolio();
  const [handmatig, setHandmatig] = useState<number | null>(null);
  const [auto, setAuto] = useState<AutoKapitaalPerOmgeving>({});
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    let actief = true;
    Promise.all([laadHandmatig(), laadAutoKapitaal()]).then(([h, a]) => {
      if (!actief) return;
      setHandmatig(h);
      setAuto(a);
      setGeladen(true);
    }).catch(() => { if (actief) setGeladen(true); });
    const stop = luisterNaarAutoKapitaal(setAuto);
    return () => { actief = false; stop(); };
  }, []);

  const zetKapitaal = useCallback(async (waarde: number | null) => {
    if (waarde === null || !(waarde > 0)) {
      setHandmatig(null);
      await verwijderSleutel(SLEUTELS.handelskapitaal);
      return;
    }
    setHandmatig(waarde);
    await bewaarTekst(SLEUTELS.handelskapitaal, String(waarde));
  }, []);

  const vanEtoro = etoroGekoppeld ? auto[omgeving] : undefined;
  const automatisch = bruikbaar(vanEtoro);

  return {
    kapitaal: automatisch ? vanEtoro.totaalUsd : handmatig,
    // true = het getal komt uit eToro en is niet zelf aan te passen.
    automatisch,
    // De opbouw en het tijdstip van de laatste sync, alleen als automatisch true is.
    stand: automatisch ? vanEtoro : null,
    zetKapitaal,
    geladen,
  };
}
