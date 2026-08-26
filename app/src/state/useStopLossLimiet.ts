// Haalt de stop-loss-grenzen van eToro op en houdt ze een dag vast. Het eligibility-endpoint heeft
// een eigen quotum van 20 requests per 60 seconden, dus we vragen in één keer alle coins op die je
// via eToro kunt handelen en bewaren dat in AsyncStorage.
//
// Zonder eToro-koppeling of bij een API-fout komt er niets terug (null): liever geen waarschuwing
// dan een verzonnen grens.
import { useEffect, useState } from 'react';
import { haalStopLossLimieten } from '../engine/etoro';
import { StopLossLimiet } from '../engine/etoroLimieten';
import type { Richting } from '../engine/types';
import { ETORO_TRADABLE } from '../engine/opportunities';
import { SLEUTELS, bewaarObject, laadObject } from '../storage/opslag';
import { actieveSleutels } from './etoroSleutels';

const TTL_MS = 24 * 60 * 60 * 1000;

// Opgehoogd zodra de vorm van `limieten` wijzigt. Tot versie 2 lag er per symbool één limiet, die
// altijd de long-config was; sinds fase 4 staat er een per richting, met SYMBOOL:richting als
// sleutel. Zonder deze controle zou een cache van gisteren gewoon geldig lijken, zouden alle
// opzoekingen niets vinden en zou de stopvalidatie een dag lang stil uit staan.
const CACHE_VERSIE = 2;

interface Cache {
  versie?: number;
  opgehaald: number;
  limieten: Record<string, StopLossLimiet>;
}

const bruikbaar = (c: Cache | null, nu: number) =>
  !!c && c.versie === CACHE_VERSIE && nu - c.opgehaald < TTL_MS;

// Module-niveau, niet per component: elk formulier dat opengaat leest anders opnieuw AsyncStorage.
let geheugen: Cache | null = null;
let lopend: Promise<Cache | null> | null = null;

async function haalCache(): Promise<Cache | null> {
  const nu = Date.now();
  if (bruikbaar(geheugen, nu)) return geheugen;

  const opgeslagen = await laadObject<Cache>(SLEUTELS.etoroLimieten);
  if (bruikbaar(opgeslagen, nu)) {
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
    geheugen = { versie: CACHE_VERSIE, opgehaald: nu, limieten };
    await bewaarObject(SLEUTELS.etoroLimieten, geheugen);
    return geheugen;
  } catch {
    // Netwerk- of API-fout. Een verlopen cache is dan nog altijd beter dan niets: eToro wijzigt
    // deze grenzen hooguit een paar keer per jaar.
    // Een verlopen cache mag nog, een cache van de VORIGE vorm niet: die zou niets teruggeven en
    // dat leest als "geen grens", terwijl er wel een grens is.
    if (opgeslagen && opgeslagen.versie === CACHE_VERSIE) {
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

export function useStopLossLimiet(
  symbool: string | null | undefined,
  richting: Richting = 'long',
): StopLossLimiet | null {
  const [limiet, setLimiet] = useState<StopLossLimiet | null>(null);

  useEffect(() => {
    if (!symbool) {
      setLimiet(null);
      return;
    }
    let actief = true;
    cacheBelofte().then(cache => {
      if (actief) setLimiet(cache?.limieten[`${symbool.toUpperCase()}:${richting}`] ?? null);
    });
    return () => { actief = false; };
  }, [symbool, richting]);

  return limiet;
}
