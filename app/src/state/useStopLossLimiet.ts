// Haalt de stop-loss-grenzen van eToro op en houdt ze een dag vast. Het eligibility-endpoint heeft
// een eigen quotum van 20 requests per 60 seconden, dus we vragen in één keer alle coins op die je
// via eToro kunt handelen en bewaren dat in AsyncStorage.
//
// Zonder eToro-koppeling of bij een API-fout komt er niets terug (null): liever geen waarschuwing
// dan een verzonnen grens.
import { useEffect, useState } from 'react';
import { haalStopLossLimieten } from '../engine/etoro';
import { StopLossLimiet } from '../engine/etoroLimieten';
import { ETORO_TRADABLE } from '../engine/opportunities';
import { SLEUTELS, bewaarObject, laadObject } from '../storage/opslag';
import { actieveSleutels } from './etoroSleutels';

const TTL_MS = 24 * 60 * 60 * 1000;

interface Cache {
  opgehaald: number;
  limieten: Record<string, StopLossLimiet>;
}

// Module-niveau, niet per component: elk formulier dat opengaat leest anders opnieuw AsyncStorage.
let geheugen: Cache | null = null;
let lopend: Promise<Cache | null> | null = null;

async function haalCache(): Promise<Cache | null> {
  const nu = Date.now();
  if (geheugen && nu - geheugen.opgehaald < TTL_MS) return geheugen;

  const opgeslagen = await laadObject<Cache>(SLEUTELS.etoroLimieten);
  if (opgeslagen && nu - opgeslagen.opgehaald < TTL_MS) {
    geheugen = opgeslagen;
    return geheugen;
  }

  // Bewust de sleutels van de actieve omgeving, niet de echte. Met een demo-opzet gaf de echte
  // sleutel een 401, dus null limieten, en dan keurde bepaalStop elke stop goed: de stopvalidatie
  // was dood op precies het pad waar hij het hardst nodig is.
  const sleutels = await actieveSleutels();
  if (!sleutels) return null;

  try {
    const limieten = await haalStopLossLimieten([...ETORO_TRADABLE], sleutels);
    geheugen = { opgehaald: nu, limieten };
    await bewaarObject(SLEUTELS.etoroLimieten, geheugen);
    return geheugen;
  } catch {
    // Netwerk- of API-fout. Een verlopen cache is dan nog altijd beter dan niets: eToro wijzigt
    // deze grenzen hooguit een paar keer per jaar.
    if (opgeslagen) {
      geheugen = opgeslagen;
      return geheugen;
    }
    return null;
  }
}

// Eén gedeelde vlucht, zodat twee schermen die tegelijk openen niet twee keer het quotum aanspreken.
function cacheBelofte(): Promise<Cache | null> {
  if (!lopend) {
    lopend = haalCache().finally(() => { lopend = null; });
  }
  return lopend;
}

export function useStopLossLimiet(symbool: string | null | undefined): StopLossLimiet | null {
  const [limiet, setLimiet] = useState<StopLossLimiet | null>(null);

  useEffect(() => {
    if (!symbool) {
      setLimiet(null);
      return;
    }
    let actief = true;
    cacheBelofte().then(cache => {
      if (actief) setLimiet(cache?.limieten[symbool.toUpperCase()] ?? null);
    });
    return () => { actief = false; };
  }, [symbool]);

  return limiet;
}
