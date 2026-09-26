import React, { createContext, useCallback, useContext, useReducer } from 'react';
import { Trade } from '../engine/types';
import { analyseerMarkt } from '../engine/analyzer';
import { Marktklimaat } from '../engine/marktklimaat';
import { RelatieveSterkte } from '../engine/relatieveSterkte';
import { bijwerkenBearModus, BearModusStand } from './bearModus';

type Progress = { current: number; total: number; symbool: string };

export type MarktState =
  | { status: 'idle' }
  | {
      status: 'loading';
      progress: Progress | null;
      // De voorlopige top-N tot nu toe, na elk blok bijgewerkt, zodat de kaarten al landen terwijl
      // de scan loopt. Alleen voor weergave: zie onVoorlopig in analyzer.ts. Wat er aan het eind in
      // `trades` staat komt uit de volledige analyse, niet uit deze lijst.
      voorlopig: Trade[];
      // Per symbool in welk blok hij binnenkwam (0, 1, 2, ...). Het scherm staffelt daarmee de
      // kaarten die tegelijk landen, en laat een kaart die al stond niet opnieuw binnenkomen.
      binnenBlok: Record<string, number>;
      // Van hoeveel coins er tot nu toe data is.
      bekeken: number;
    }
  | { status: 'error'; melding: string; lastAttempt: Date }
  | {
      status: 'success';
      trades: Trade[];
      // Alle gescoorde coins, niet alleen de top-N die de lijst toont. Nodig om een specifieke coin
      // te kunnen opzoeken, bijvoorbeeld voor het afbouwadvies bij een open positie die buiten de
      // top 20 valt.
      alle: Trade[];
      // Short-signalen, sterkste eerst. Alleen gevuld bij een ongunstig klimaat, zie analyzer.ts.
      shorts: Trade[];
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
  | { type: 'VOORLOPIG'; voorlopig: Trade[]; bekeken: number }
  | {
      type: 'SUCCESS';
      trades: Trade[];
      alle: Trade[];
      shorts: Trade[];
      klimaat: Marktklimaat | null;
      relatieveSterkte: RelatieveSterkte[];
      bearModus: BearModusStand | null;
      bekeken: number;
    }
  | { type: 'FOUT'; melding: string };

function reducer(state: MarktState, action: Action): MarktState {
  switch (action.type) {
    case 'START': return { status: 'loading', progress: null, voorlopig: [], binnenBlok: {}, bekeken: 0 };
    case 'PROGRESS':
      if (state.status !== 'loading') return state;
      return { ...state, progress: action.progress };
    case 'VOORLOPIG': {
      if (state.status !== 'loading') return state;
      // Het bloknummer is het aantal tussenstanden dat er al was. Een coin die al een blok had
      // houdt dat, ook als hij na een hersortering van plek verandert.
      const blok = Object.keys(state.binnenBlok).length === 0 ? 0 : Math.max(...Object.values(state.binnenBlok)) + 1;
      const binnenBlok = { ...state.binnenBlok };
      for (const t of action.voorlopig) if (!(t.symbool in binnenBlok)) binnenBlok[t.symbool] = blok;
      return { ...state, voorlopig: action.voorlopig, binnenBlok, bekeken: action.bekeken };
    }
    case 'SUCCESS': return {
      status: 'success',
      trades: action.trades,
      alle: action.alle,
      shorts: action.shorts,
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
      const { trades, alle, shorts, klimaat, relatieveSterkte, bekeken } = await analyseerMarkt({
        onProgress: (current, total, symbool) => {
          if (!stil) dispatch({ type: 'PROGRESS', progress: { current, total, symbool } });
        },
        // Een stille refresh houdt de oude lijst in beeld tot de nieuwe klaar is; daar horen geen
        // tussenstanden bij, anders zou de lijst halverwege naar een halve markt springen.
        onVoorlopig: stil
          ? undefined
          : (voorlopig, bekekenTotNu) => dispatch({ type: 'VOORLOPIG', voorlopig, bekeken: bekekenTotNu }),
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
      dispatch({ type: 'SUCCESS', trades, alle, shorts, klimaat, relatieveSterkte, bearModus, bekeken });
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
