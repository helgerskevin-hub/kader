// Historische dagkoersen voor het resultaat over een periode op de portfoliokaart.
//
// Eén reeks per symbool dekt alle periodes tegelijk: de langste is een jaar, dus met circa 400
// dagcandles ligt elk referentiepunt (een dag, een maand, drie, zes en twaalf maanden terug) al in
// huis. Ophalen gebeurt daarom per symbool en niet per periode, en wisselen tussen de chips kost
// daarna niets meer.
//
// Opzet net als useStopLossLimiet.ts: een module-niveau geheugen zodat niet elk scherm opnieuw
// AsyncStorage leest, een gedeelde lopende belofte zodat twee aanroepen niet twee keer over de lijn
// gaan, en een verlopen cache als terugval bij een netwerkfout. Een dagcandle van gisteren is voor
// een venster van 90 of 365 dagen nog prima bruikbaar; niets teruggeven zou het cijfer onnodig
// onvolledig maken.
import { useEffect, useMemo, useRef, useState } from 'react';
import { haalDagHistorie } from '../engine/marketData';
import { KoersPunt, HISTORIE_DAGEN } from './periodeResultaat';
import { SLEUTELS, bewaarObject, laadObject } from '../storage/opslag';

const TTL_MS = 24 * 60 * 60 * 1000;

// Ophogen zodra de vorm van een reeks wijzigt, zodat een cache van de vorige vorm niet geldig lijkt.
const CACHE_VERSIE = 1;

interface SymboolReeks {
  opgehaald: number;
  punten: KoersPunt[];
}

interface Cache {
  versie: number;
  perSymbool: Record<string, SymboolReeks>;
}

export type HistorieStatus = 'leeg' | 'laden' | 'klaar';

let geheugen: Cache | null = null;
let geladenVanSchijf = false;
// Per symbool, zodat twee schermen die tegelijk om BTC vragen samen één verzoek delen.
const lopend = new Map<string, Promise<KoersPunt[] | null>>();

const vers = (reeks: SymboolReeks | undefined, nu: number) =>
  !!reeks && nu - reeks.opgehaald < TTL_MS;

async function laadGeheugen(): Promise<Cache> {
  if (geheugen && geladenVanSchijf) return geheugen;
  const opgeslagen = await laadObject<Cache>(SLEUTELS.resultaatHistorie);
  geheugen = opgeslagen && opgeslagen.versie === CACHE_VERSIE && opgeslagen.perSymbool
    ? opgeslagen
    : { versie: CACHE_VERSIE, perSymbool: {} };
  geladenVanSchijf = true;
  return geheugen;
}

// Bewust niet na elk symbool wegschrijven: bij tien open posities zou dat tien keer serialiseren van
// een groeiend object zijn. De aanroeper schrijft één keer weg als de ronde klaar is.
async function bewaarGeheugen(): Promise<void> {
  if (geheugen) await bewaarObject(SLEUTELS.resultaatHistorie, geheugen);
}

async function haalSymbool(symbool: string): Promise<KoersPunt[] | null> {
  const cache = await laadGeheugen();
  const nu = Date.now();
  const bestaand = cache.perSymbool[symbool];
  if (vers(bestaand, nu)) return bestaand.punten;

  const bezig = lopend.get(symbool);
  if (bezig) return bezig;

  const belofte = (async () => {
    try {
      const candles = await haalDagHistorie(symbool, HISTORIE_DAGEN);
      if (candles && candles.length > 0) {
        // Alleen tijd en slotkoers bewaren. Open, high, low en volume doen hier niets en zouden de
        // opslag een paar keer zo groot maken.
        const punten = candles
          .filter(c => typeof c.tijd === 'number' && typeof c.close === 'number' && isFinite(c.close))
          .map(c => ({ tijd: c.tijd as number, close: c.close }));
        if (punten.length > 0) {
          cache.perSymbool[symbool] = { opgehaald: Date.now(), punten };
          return punten;
        }
      }
    } catch {
      // Valt hieronder terug op een verlopen reeks, of op niets.
    }
    // Mislukt: een verouderde reeks is beter dan geen reeks, zie de kop van dit bestand.
    return bestaand ? bestaand.punten : null;
  })();

  lopend.set(symbool, belofte);
  try {
    return await belofte;
  } finally {
    lopend.delete(symbool);
  }
}

export function useResultaatHistorie(symbolen: string[]): {
  punten: Record<string, KoersPunt[]>;
  status: HistorieStatus;
} {
  // De lijst komt bij elke render als nieuwe array binnen; zonder deze sleutel zou het effect elke
  // render opnieuw draaien en bij elke render opnieuw ophalen.
  const sleutel = useMemo(() => [...new Set(symbolen)].sort().join(','), [symbolen]);
  const [punten, setPunten] = useState<Record<string, KoersPunt[]>>({});
  const [status, setStatus] = useState<HistorieStatus>(symbolen.length === 0 ? 'leeg' : 'laden');
  // Voorkomt setState op een component die alweer weg is, en voorkomt dat een trage ronde de
  // uitkomst van een nieuwere ronde overschrijft.
  const rondeRef = useRef(0);

  useEffect(() => {
    const lijst = sleutel === '' ? [] : sleutel.split(',');
    if (lijst.length === 0) {
      setPunten({});
      setStatus('leeg');
      return;
    }

    const ronde = ++rondeRef.current;
    setStatus('laden');

    (async () => {
      const verzameld: Record<string, KoersPunt[]> = {};
      // Eén voor één en niet allemaal tegelijk: Binance heeft een gewichtslimiet per minuut, en dit
      // loopt op de achtergrond terwijl de kaart al gewoon in beeld staat. Snelheid is hier minder
      // waard dan niet tegen een rate limit aanlopen.
      for (const symbool of lijst) {
        const reeks = await haalSymbool(symbool);
        if (rondeRef.current !== ronde) return;
        if (reeks) verzameld[symbool] = reeks;
      }
      await bewaarGeheugen();
      if (rondeRef.current !== ronde) return;
      setPunten(verzameld);
      setStatus('klaar');
    })();

    return () => { rondeRef.current += 1; };
  }, [sleutel]);

  return { punten, status };
}
