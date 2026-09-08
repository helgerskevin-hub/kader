// Symbool naar eToro-instrumentId, gecachet. Zelfde vorm als useStopLossLimiet, met één verschil:
// hier is geen TTL. De koppeling tussen een symbool en een instrumentId verandert niet, en hij is
// gelijk in demo en echt (gemeten: BTC is 100000 in beide).
//
// Zonder id geen koopknop. zoekInstrumentId geeft bij elke twijfel null terug, en dan blijft kopen
// geblokkeerd: een verkeerd id zou een order in een andere coin of zelfs een future plaatsen.
//
// De hook geeft met opzet een stand terug en niet alleen `number | null`. Met alleen null viel
// "we zijn nog aan het zoeken" samen met "gezocht en niets gevonden", en dat is precies wat de
// koopsheet liet zien: bij een coin die nog niet in de cache stond stond de rode melding "Kader kan
// PEPE niet eenduidig aan een eToro-instrument koppelen" er al vanaf het openen, de hele netwerkbeurt
// lang. Bij BTC merkte niemand dat, want die staat na één keer kopen in de cache en is meteen klaar.
import { useEffect, useState } from 'react';
import { zoekInstrumentId } from '../engine/etoro';
import { SLEUTELS, bewaarObject, laadObject } from '../storage/opslag';
import { actieveSleutels } from './etoroSleutels';

// 'bezig' = de zoekopdracht loopt nog, 'geen' = uitgezocht en niets bruikbaars gevonden.
export type InstrumentStand =
  | { soort: 'bezig' }
  | { soort: 'gevonden'; id: number }
  | { soort: 'geen' };

type Kaart = Record<string, number>;

// Module-niveau, niet per component: elke kaart en elke sheet die opengaat zou anders opnieuw
// AsyncStorage lezen en opnieuw het quotum aanspreken.
let geheugen: Kaart | null = null;
// Eén vlucht per symbool, zodat drie kaarten met dezelfde coin niet drie keer zoeken.
const lopend = new Map<string, Promise<number | null>>();

async function laadKaart(): Promise<Kaart> {
  if (geheugen) return geheugen;
  geheugen = (await laadObject<Kaart>(SLEUTELS.etoroInstrumentIds)) ?? {};
  return geheugen;
}

async function haalId(symbool: string): Promise<number | null> {
  const sleutel = symbool.toUpperCase();
  const kaart = await laadKaart();
  if (typeof kaart[sleutel] === 'number') return kaart[sleutel];

  const sleutels = await actieveSleutels();
  if (!sleutels) return null;

  try {
    const id = await zoekInstrumentId(sleutel, sleutels);
    // Alleen een gevonden id bewaren. Een null vastleggen zou een tijdelijke storing permanent
    // maken, en dan bleef de koopknop weg tot iemand de opslag wist.
    if (id !== null) {
      kaart[sleutel] = id;
      await bewaarObject(SLEUTELS.etoroInstrumentIds, kaart);
    }
    return id;
  } catch {
    return null;
  }
}

function idBelofte(symbool: string): Promise<number | null> {
  const sleutel = symbool.toUpperCase();
  let vlucht = lopend.get(sleutel);
  if (!vlucht) {
    vlucht = haalId(sleutel).finally(() => { lopend.delete(sleutel); });
    lopend.set(sleutel, vlucht);
  }
  return vlucht;
}

export function useInstrumentId(symbool: string | null | undefined): InstrumentStand {
  const [stand, setStand] = useState<InstrumentStand>({ soort: 'bezig' });

  useEffect(() => {
    // Zonder symbool valt er niets te zoeken. 'geen' en niet 'bezig': er loopt niets, dus wachten
    // op een uitkomst die nooit komt zou de sheet eeuwig in de laadstand houden.
    if (!symbool) {
      setStand({ soort: 'geen' });
      return;
    }
    let actief = true;
    setStand({ soort: 'bezig' });
    idBelofte(symbool).then(gevonden => {
      if (actief) setStand(gevonden === null ? { soort: 'geen' } : { soort: 'gevonden', id: gevonden });
    });
    return () => { actief = false; };
  }, [symbool]);

  return stand;
}
