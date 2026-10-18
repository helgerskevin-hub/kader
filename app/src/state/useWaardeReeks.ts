// De twee hooks rond de waardegrafiek in Historie. Het rekenwerk zelf staat in portfolioWaarde.ts.
//
// useWaardeMomentopname draait op het Portfolio-scherm, dat altijd gemount is: zodra de kaart een
// volledig totaal kent, gaat dat als opname van vandaag op schijf. useWaardeReeks draait in Historie
// en haalt pas dagkoersen op als dat scherm open staat.
import { useEffect, useMemo, useRef, useState } from 'react';
import { PortfolioTrade } from './portfolioTypes';
import { SLEUTELS, bewaarObject, laadObject } from '../storage/opslag';
import { useResultaatHistorie } from './useResultaatHistorie';
import {
  Momentopname, WAARDE_DAGEN, WaardePunt, berekenWaardeReeks, dagSleutel, metMomentopname,
} from './portfolioWaarde';

type Omgeving = 'real' | 'demo';
type Opslag = Partial<Record<Omgeving, Momentopname[]>>;

// Elke prijspoll (een minuut) een schrijfactie is zonde; een kwartier is ruim genoeg voor een punt
// per dag. Een nieuwe dag schrijft altijd meteen.
const SCHRIJF_INTERVAL_MS = 15 * 60 * 1000;
const DAG_MS = 24 * 60 * 60 * 1000;

let geheugen: Opslag | null = null;
const luisteraars = new Set<() => void>();

async function laad(): Promise<Opslag> {
  if (geheugen) return geheugen;
  geheugen = (await laadObject<Opslag>(SLEUTELS.waardeMomentopnames)) ?? {};
  return geheugen;
}

export function useWaardeMomentopname(waardeNu: number | null, omgeving: Omgeving): void {
  const laatsteRef = useRef<{ omgeving: Omgeving; tijd: number } | null>(null);

  useEffect(() => {
    if (waardeNu === null || !isFinite(waardeNu) || waardeNu <= 0) return;
    const nu = Date.now();
    const vorige = laatsteRef.current;
    const zelfdeDag = vorige !== null && vorige.omgeving === omgeving && dagSleutel(vorige.tijd) === dagSleutel(nu);
    if (zelfdeDag && nu - vorige!.tijd < SCHRIJF_INTERVAL_MS) return;
    laatsteRef.current = { omgeving, tijd: nu };
    (async () => {
      const opslag = await laad();
      opslag[omgeving] = metMomentopname(opslag[omgeving] ?? [], nu, waardeNu);
      await bewaarObject(SLEUTELS.waardeMomentopnames, opslag);
      luisteraars.forEach(f => f());
    })();
  }, [waardeNu, omgeving]);
}

export interface WaardeReeks {
  punten: WaardePunt[];
  laden: boolean;
}

export function useWaardeReeks(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
  waardeNu: number | null,
  omgeving: Omgeving,
  actief: boolean,
): WaardeReeks {
  const [opnames, setOpnames] = useState<Momentopname[]>([]);

  useEffect(() => {
    let weg = false;
    const lees = () => { laad().then(o => { if (!weg) setOpnames(o[omgeving] ?? []); }); };
    lees();
    luisteraars.add(lees);
    return () => { weg = true; luisteraars.delete(lees); };
  }, [omgeving]);

  // Dezelfde selectie als het totaal op de portfoliokaart: alleen eToro-trades uit deze omgeving.
  // Een handmatige trade zit niet in eToro's saldo, dus die erbij tellen trekt de lijn scheef.
  const eigen = useMemo(
    () => trades.filter(t => t.bron === 'etoro' && (t.etoroOmgeving ?? 'real') === omgeving),
    [trades, omgeving],
  );

  // Alleen coins die binnen het venster open stonden; een trade van twee jaar terug heeft geen
  // dagkoersen nodig.
  const symbolen = useMemo(() => {
    if (!actief) return [];
    const grens = Date.now() - WAARDE_DAGEN * DAG_MS;
    return eigen
      .filter(t => t.status === 'open' || (typeof t.slotTijd === 'number' && t.slotTijd >= grens))
      .map(t => t.symbool);
  }, [eigen, actief]);

  const { punten: koersen, status } = useResultaatHistorie(symbolen);

  const punten = useMemo(
    () => (actief
      ? berekenWaardeReeks({ trades: eigen, koersen, livePrijzen, momentopnames: opnames, nu: Date.now(), waardeNu })
      : []),
    [actief, eigen, koersen, livePrijzen, opnames, waardeNu],
  );

  return { punten, laden: actief && status === 'laden' };
}
