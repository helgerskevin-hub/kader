import { useCallback, useEffect, useState } from 'react';
import { laadObject, bewaarObject, verwijderSleutel, SLEUTELS } from '../storage/opslag';
import { Doelverdeling } from '../engine/doelstelling';

// De doelverdeling die de gebruiker zelf heeft ingevuld: per coin een streefpercentage.
//
// Zelfde afspraak als useHandelskapitaal: Kader vult dit nergens voor je in en leidt het nergens
// af. Een lege lijst betekent daarom "geen doel" en niet "een doel van niets", en het scherm toont
// dan de lege staat met uitleg. Een verzonnen doel zou elke afwijking die je erop afleest waardeloos
// maken.
export function useDoelverdeling() {
  const [doel, setDoel] = useState<Doelverdeling>([]);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    laadObject<Doelverdeling>(SLEUTELS.doelverdeling).then(bewaard => {
      // Een corrupte of oude sleutel kan iets anders dan een lijst bevatten; dan liever geen doel
      // dan een half doel waar percentages uit weggevallen zijn.
      setDoel(Array.isArray(bewaard) ? bewaard : []);
      setGeladen(true);
    });
  }, []);

  const zetDoel = useCallback(async (nieuw: Doelverdeling) => {
    if (nieuw.length === 0) {
      setDoel([]);
      await verwijderSleutel(SLEUTELS.doelverdeling);
      return;
    }
    setDoel(nieuw);
    await bewaarObject(SLEUTELS.doelverdeling, nieuw);
  }, []);

  return { doel, zetDoel, geladen };
}
