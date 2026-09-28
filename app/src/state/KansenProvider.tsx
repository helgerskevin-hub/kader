import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Opportunity } from '../engine/types';
import { zoekKansen } from '../engine/opportunities';
import { laadObject, bewaarObject, SLEUTELS } from '../storage/opslag';

// De Kansen-scan (momentum-radar) woont hier en niet in het scherm, zodat het laatste resultaat
// bewaard blijft en bij het openen van de app meteen in beeld staat. Zelfde opzet als
// MarktProvider, plus opslag en een cooldown: de radar kijkt naar dagcandles, dus elke keer dat je
// naar het tabblad veegt opnieuw 57 coins ophalen levert niets nieuws op.

// Hoe oud een bewaard resultaat mag zijn voordat scanAlsVerouderd opnieuw scant.
export const KANSEN_COOLDOWN_MS = 30 * 60 * 1000;

// Hoeveel plekken een coin sinds de vorige scan gestegen is (positief) of gezakt (negatief),
// 'nieuw' als hij er de vorige keer niet op stond, null als er niets te vergelijken valt: geen
// vorige scan, of de radar is nu leeg en de lijst is dus geen ranking.
export type RangVerschil = number | 'nieuw' | null;
export type KansMetRang = Opportunity & { rangVerschil: RangVerschil };

export type KansenState =
  | { status: 'idle' }
  | {
      status: 'loading';
      gescand: number;
      totaal: number;
      // De radar tot nu toe, al gesorteerd. Een kaart die hier landt staat ook in de eindlijst,
      // maar kan nog schuiven; zie onTussenstand in opportunities.ts. Zonder rangverschil, want een
      // halve lijst heeft geen eerlijke plek.
      tussenstand: Opportunity[];
    }
  | { status: 'error'; melding: string; lastAttempt: Date }
  | {
      status: 'success';
      kansen: KansMetRang[];
      // True als er niets op de radar staat; `kansen` zijn dan de sterkste drie, als WATCH.
      radarLeeg: boolean;
      gescand: number;
      lastUpdate: Date;
    };

// Wat er in AsyncStorage staat.
interface BewaardeScan {
  kansen: Opportunity[];
  radarLeeg: boolean;
  gescand: number;
  tijdstip: number;
  // Symbool -> positie (0 = bovenaan) in de scan hiervoor. Null als er geen scan hiervoor was.
  vorigeRanking: Record<string, number> | null;
}

// De ranking die een volgende scan als "vorige" gebruikt. Een lege radar telt als een ranking
// zonder coins: wie daarna op de radar komt is dan echt nieuw.
function rankingVan(scan: BewaardeScan): Record<string, number> {
  const r: Record<string, number> = {};
  if (!scan.radarLeeg) scan.kansen.forEach((k, i) => { r[k.symbool] = i; });
  return r;
}

function metRang(scan: BewaardeScan): KansMetRang[] {
  return scan.kansen.map((k, i) => {
    let rangVerschil: RangVerschil = null;
    if (!scan.radarLeeg && scan.vorigeRanking) {
      const vorig = scan.vorigeRanking[k.symbool];
      rangVerschil = vorig === undefined ? 'nieuw' : vorig - i;
    }
    return { ...k, rangVerschil };
  });
}

function naarSucces(scan: BewaardeScan): KansenState {
  return {
    status: 'success',
    kansen: metRang(scan),
    radarLeeg: scan.radarLeeg,
    gescand: scan.gescand,
    lastUpdate: new Date(scan.tijdstip),
  };
}

type Action =
  | { type: 'START' }
  | { type: 'PROGRESS'; gescand: number; totaal: number }
  | { type: 'TUSSENSTAND'; kansen: Opportunity[] }
  | { type: 'GELADEN'; scan: BewaardeScan }
  | { type: 'SUCCESS'; scan: BewaardeScan }
  | { type: 'FOUT'; melding: string };

function reducer(state: KansenState, action: Action): KansenState {
  switch (action.type) {
    case 'START': return { status: 'loading', gescand: 0, totaal: 0, tussenstand: [] };
    case 'PROGRESS':
      if (state.status !== 'loading') return state;
      return { ...state, gescand: action.gescand, totaal: action.totaal };
    case 'TUSSENSTAND':
      if (state.status !== 'loading') return state;
      return { ...state, tussenstand: action.kansen };
    // Het bewaarde resultaat mag alleen een leeg scherm vullen, nooit een lopende of verse scan
    // overschrijven.
    case 'GELADEN': return state.status === 'idle' ? naarSucces(action.scan) : state;
    case 'SUCCESS': return naarSucces(action.scan);
    case 'FOUT': return { status: 'error', melding: action.melding, lastAttempt: new Date() };
    default: return state;
  }
}

interface KansenContextWaarde {
  state: KansenState;
  // True zolang er een scan loopt, ook een stille. Bij een stille scan blijft `state` op success
  // staan met de oude lijst, dus zonder deze vlag ziet het scherm niet dat er ververst wordt.
  bezig: boolean;
  // stil = true: de bestaande lijst blijft zichtbaar tot de nieuwe klaar is, zonder voortgang of
  // tussenstanden. Mislukt een stille scan, dan blijft de oude lijst gewoon staan.
  scan: (stil?: boolean) => Promise<void>;
  // Scant alleen als er niets bewaard is of het laatste resultaat ouder is dan KANSEN_COOLDOWN_MS.
  // Met een bewaard resultaat gebeurt dat stil. Het scherm roept dit aan zodra het in beeld komt.
  scanAlsVerouderd: () => Promise<void>;
}

const KansenContext = createContext<KansenContextWaarde | null>(null);

export function KansenProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });
  const [bezig, setBezig] = useState(false);
  // Het laatst bewaarde resultaat: basis voor de cooldown en voor de ranking van de volgende scan.
  const laatsteRef = useRef<BewaardeScan | null>(null);
  // Eén keer laden, gedeeld door het mount-effect en de scanfuncties. Nodig omdat het scherm
  // (een kind) zijn effect vóór dit provider-effect draait en dus al kan vragen of er gescand moet
  // worden voordat de opslag gelezen is.
  const ladenRef = useRef<Promise<void> | null>(null);
  const lopendRef = useRef<Promise<void> | null>(null);

  const laadBewaard = useCallback(() => {
    if (!ladenRef.current) {
      ladenRef.current = (async () => {
        const bewaard = await laadObject<BewaardeScan>(SLEUTELS.kansenScan);
        // Een scan van vóór de momentum-radar heeft een andere vorm; die tonen we niet.
        if (!bewaard || !Array.isArray(bewaard.kansen) || typeof bewaard.tijdstip !== 'number'
          || bewaard.kansen.some(k => typeof k?.momentumScore !== 'number')) return;
        laatsteRef.current = bewaard;
        dispatch({ type: 'GELADEN', scan: bewaard });
      })();
    }
    return ladenRef.current;
  }, []);

  useEffect(() => {
    laadBewaard();
  }, [laadBewaard]);

  const scan = useCallback((stil = false) => {
    // Loopt er al een scan, dan wachten we die af in plaats van een tweede te starten.
    if (lopendRef.current) return lopendRef.current;
    const loop = (async () => {
      setBezig(true);
      if (!stil) dispatch({ type: 'START' });
      try {
        await laadBewaard();
        const { kansen, radarLeeg, gescand } = await zoekKansen(
          (klaar, totaal) => {
            if (!stil) dispatch({ type: 'PROGRESS', gescand: klaar, totaal });
          },
          stil ? undefined : tussenstand => dispatch({ type: 'TUSSENSTAND', kansen: tussenstand }),
        );
        const vorige = laatsteRef.current;
        const nieuw: BewaardeScan = {
          kansen, radarLeeg, gescand,
          tijdstip: Date.now(),
          vorigeRanking: vorige ? rankingVan(vorige) : null,
        };
        laatsteRef.current = nieuw;
        dispatch({ type: 'SUCCESS', scan: nieuw });
        await bewaarObject(SLEUTELS.kansenScan, nieuw);
      } catch (e) {
        if (!stil) dispatch({ type: 'FOUT', melding: (e as Error)?.message ?? 'Onbekende fout' });
      } finally {
        lopendRef.current = null;
        setBezig(false);
      }
    })();
    lopendRef.current = loop;
    return loop;
  }, [laadBewaard]);

  const scanAlsVerouderd = useCallback(async () => {
    await laadBewaard();
    const laatste = laatsteRef.current;
    if (laatste && Date.now() - laatste.tijdstip < KANSEN_COOLDOWN_MS) return;
    await scan(laatste !== null);
  }, [laadBewaard, scan]);

  const waarde = useMemo(() => ({ state, bezig, scan, scanAlsVerouderd }), [state, bezig, scan, scanAlsVerouderd]);

  return (
    <KansenContext.Provider value={waarde}>
      {children}
    </KansenContext.Provider>
  );
}

export function useKansen(): KansenContextWaarde {
  const ctx = useContext(KansenContext);
  if (!ctx) throw new Error('useKansen moet binnen KansenProvider gebruikt worden');
  return ctx;
}
