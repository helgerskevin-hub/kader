// Symbool naar eToro-instrumentId, gecachet. Zelfde vorm als useStopLossLimiet, met één verschil:
// hier is geen TTL. De koppeling tussen een symbool en een instrumentId verandert niet, en hij is
// gelijk in demo en echt (gemeten: BTC is 100000 in beide).
//
// Zonder id geen koopknop. zoekInstrumentId geeft bij elke twijfel null terug, en dan blijft kopen
// geblokkeerd: een verkeerd id zou een order in een andere coin of zelfs een future plaatsen.
import { useEffect, useState } from 'react';
import { zoekInstrumentId } from '../engine/etoro';
import { SLEUTELS, bewaarObject, laadObject } from '../storage/opslag';
import { actieveSleutels } from './etoroSleutels';

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

export function useInstrumentId(symbool: string | null | undefined): number | null {
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    if (!symbool) {
      setId(null);
      return;
    }
    let actief = true;
    idBelofte(symbool).then(gevonden => {
      if (actief) setId(gevonden);
    });
    return () => { actief = false; };
  }, [symbool]);

  return id;
}
