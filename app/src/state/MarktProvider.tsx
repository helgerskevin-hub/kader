import React, { createContext, useCallback, useContext, useReducer } from 'react';
import { Trade } from '../engine/types';
import { analyseerMarkt } from '../engine/analyzer';

type Progress = { current: number; total: number; symbool: string };

export type MarktState =
  | { status: 'idle' }
  | { status: 'loading'; progress: Progress | null }
  | { status: 'error'; melding: string; lastAttempt: Date }
  | { status: 'success'; trades: Trade[]; lastUpdate: Date };

type Action =
  | { type: 'START' }
  | { type: 'PROGRESS'; progress: Progress }
  | { type: 'SUCCESS'; trades: Trade[] }
  | { type: 'FOUT'; melding: string };

function reducer(state: MarktState, action: Action): MarktState {
  switch (action.type) {
    case 'START': return { status: 'loading', progress: null };
    case 'PROGRESS': return { status: 'loading', progress: action.progress };
    case 'SUCCESS': return { status: 'success', trades: action.trades, lastUpdate: new Date() };
    case 'FOUT': return { status: 'error', melding: action.melding, lastAttempt: new Date() };
    default: return state;
  }
}

interface MarktContextWaarde {
  state: MarktState;
  startAnalyse: () => void;
}

const MarktContext = createContext<MarktContextWaarde | null>(null);

export function MarktProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  const startAnalyse = useCallback(async () => {
    dispatch({ type: 'START' });
    try {
      const trades = await analyseerMarkt({
        onProgress: (current, total, symbool) =>
          dispatch({ type: 'PROGRESS', progress: { current, total, symbool } }),
      });
      dispatch({ type: 'SUCCESS', trades });
    } catch (e) {
      dispatch({ type: 'FOUT', melding: (e as Error)?.message ?? 'Onbekende fout' });
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
