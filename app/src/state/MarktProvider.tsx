import React, { createContext, useCallback, useContext, useReducer } from 'react';
import { Trade } from '../engine/types';
import { analyseerMarkt } from '../engine/analyzer';
import { Marktklimaat } from '../engine/marktklimaat';
import { RelatieveSterkte } from '../engine/relatieveSterkte';
import { bijwerkenBearModus, BearModusStand } from './bearModus';

type Progress = { current: number; total: number; symbool: string };

export type MarktState =
  | { status: 'idle' }
  | { status: 'loading'; progress: Progress | null }
  | { status: 'error'; melding: string; lastAttempt: Date }
  | {
      status: 'success';
      trades: Trade[];
      // Alle gescoorde coins, niet alleen de top-N die de lijst toont. Nodig om een specifieke coin
      // te kunnen opzoeken, bijvoorbeeld voor het afbouwadvies bij een open positie die buiten de
      // top 20 valt.
      alle: Trade[];
      klimaat: Marktklimaat | null;
      relatieveSterkte: RelatieveSterkte[];
      // Alleen gevuld bij een ongunstig klimaat: sinds wanneer de bear-modus loopt en wat de markt
      // sindsdien gedaan heeft.
      bearModus: BearModusStand | null;
      bekeken: number;
      lastUpdate: Date;
    };

type Action =
  | { type: 'START' }
  | { type: 'PROGRESS'; progress: Progress }
  | {
      type: 'SUCCESS';
      trades: Trade[];
      alle: Trade[];
      klimaat: Marktklimaat | null;
      relatieveSterkte: RelatieveSterkte[];
      bearModus: BearModusStand | null;
      bekeken: number;
    }
  | { type: 'FOUT'; melding: string };

function reducer(state: MarktState, action: Action): MarktState {
  switch (action.type) {
    case 'START': return { status: 'loading', progress: null };
    case 'PROGRESS': return { status: 'loading', progress: action.progress };
    case 'SUCCESS': return {
      status: 'success',
      trades: action.trades,
      alle: action.alle,
      klimaat: action.klimaat,
      relatieveSterkte: action.relatieveSterkte,
      bearModus: action.bearModus,
      bekeken: action.bekeken,
      lastUpdate: new Date(),
    };
    case 'FOUT': return { status: 'error', melding: action.melding, lastAttempt: new Date() };
    default: return state;
  }
}

interface MarktContextWaarde {
  state: MarktState;
  // stil = true (pull-to-refresh): de bestaande lijst blijft zichtbaar terwijl er ververst wordt,
  // in plaats van naar het laadscherm te springen. Mislukt een stille refresh, dan blijft de oude
  // lijst gewoon staan i.p.v. plaats te maken voor een foutscherm.
  startAnalyse: (stil?: boolean) => void;
}

const MarktContext = createContext<MarktContextWaarde | null>(null);

export function MarktProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  const startAnalyse = useCallback(async (stil = false) => {
    if (!stil) dispatch({ type: 'START' });
    try {
      const { trades, alle, klimaat, relatieveSterkte, bekeken } = await analyseerMarkt({
        onProgress: (current, total, symbool) => {
          if (!stil) dispatch({ type: 'PROGRESS', progress: { current, total, symbool } });
        },
      });
      // Loopt over AsyncStorage en mag de analyse niet kunnen laten mislukken: zonder deze vangnet
      // zou een kapotte opslagregel het hele marktscherm op de foutstand zetten terwijl de data
      // gewoon binnen is.
      let bearModus: BearModusStand | null = null;
      try {
        bearModus = await bijwerkenBearModus(klimaat);
      } catch {
        bearModus = null;
      }
      dispatch({ type: 'SUCCESS', trades, alle, klimaat, relatieveSterkte, bearModus, bekeken });
    } catch (e) {
      if (!stil) dispatch({ type: 'FOUT', melding: (e as Error)?.message ?? 'Onbekende fout' });
    }
  }, []);

  return (
    <MarktContext.Provider value={{ state, startAnalyse }}>
      {children}
    </MarktContext.Provider>
  );
}

export function useMarkt(): MarktContextWaarde {
  const ctx = useContext(MarktContext);
  if (!ctx) throw new Error('useMarkt moet binnen MarktProvider gebruikt worden');
  return ctx;
}
