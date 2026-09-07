// Eén dialooghost voor de hele app. Elke plek die vroeger een native Alert.alert opriep vraagt nu
// via useDialoog() om deze dialoog, zodat een bevestiging er overal hetzelfde uitziet en in de
// huisstijl van Kader staat.
//
// De reden dat dit een provider is en geen los component per scherm: de dialoog verschijnt bijna
// altijd op het moment dat een BottomSheet sluit, en die sheets gebruiken een Modal. Twee Modals
// die in dezelfde tick van plek wisselen legden op Android de UI-thread plat (zie de uitleg in
// MeldingNotitie.tsx). Met één host die de sheet eerst laat sluiten gebeurt dat niet meer.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { KaderDialoog } from '../components/KaderDialoog';

// De sheet die op dit moment sluit doet er 200ms over (Modal animationType="fade" plus de eigen
// timing in BottomSheet.tsx). We wachten die tijd plus een marge af voordat onze eigen Modal
// mount. Hier stond eerst runAfterInteractions, maar die API is in React Native 0.85 afgeschaft en
// verdwijnt in een volgende versie, met een waarschuwing in beeld als bijvangst. Een expliciete
// wachttijd doet hier hetzelfde en blijft werken.
const WACHT_NA_SHEET_MS = 260;

export interface DialoogKnop {
  label: string;
  onDruk?: () => void;
  soort?: 'primair' | 'secundair' | 'destructief';
}

// Het blok tussen de tekst en de knoppen. Drie vormen, omdat er drie dingen te melden zijn na een
// order: een resultaat dat we kennen, een resultaat dat we eerlijk niet kennen, en een order
// waarvan we niet weten of hij is doorgegaan.
export type DialoogResultaat =
  | {
      soort: 'bedrag';
      bedragUsd: number;
      procent: number;
      // Bijvoorbeeld: 1,3714 SOL · aankoop $87,20 · nu $182,40
      detail?: string;
      toelichting: string;
    }
  | { soort: 'onbekend'; toelichting: string }
  | { soort: 'waarschuwing'; tekst: string };

export interface DialoogInhoud {
  variant: 'informatie' | 'gelukt' | 'waarschuwing' | 'fout';
  titel: string;
  tekst: string;
  // Optioneel blok, bijvoorbeeld de lijst overgeslagen posities of een technische foutmelding.
  details?: string;
  resultaat?: DialoogResultaat;
  // Eén of twee knoppen. De knop die de actie uitvoert staat vooraan.
  knoppen: DialoogKnop[];
}

interface DialoogContextWaarde {
  toonDialoog: (inhoud: DialoogInhoud) => void;
}

const DialoogContext = createContext<DialoogContextWaarde>({ toonDialoog: () => {} });

export function DialoogProvider({ children }: { children: React.ReactNode }) {
  const [inhoud, setInhoud] = useState<DialoogInhoud | null>(null);
  // Los van de inhoud, zodat de kaart tijdens het uitfaden nog getekend wordt in plaats van halverwege
  // leeg te lopen.
  const [zichtbaar, setZichtbaar] = useState(false);

  // Het uitstel is geen nettigheid maar de kern van dit bestand: zonder die pauze komt deze Modal
  // op tafel terwijl de BottomSheet-Modal eronder nog aan het opruimen is, en dat is precies de
  // situatie die op Android de UI-thread vastzette.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toonDialoog = useCallback((nieuw: DialoogInhoud) => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setInhoud(nieuw);
      setZichtbaar(true);
    }, WACHT_NA_SHEET_MS);
  }, []);

  // Een openstaande timer mag niet na het opruimen van de provider alsnog vuren.
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const sluit = useCallback(() => setZichtbaar(false), []);

  const waarde = useMemo(() => ({ toonDialoog }), [toonDialoog]);

  return (
    <DialoogContext.Provider value={waarde}>
      {children}
      <KaderDialoog inhoud={inhoud} zichtbaar={zichtbaar} onSluiten={sluit} />
    </DialoogContext.Provider>
  );
}

export function useDialoog(): DialoogContextWaarde {
  return useContext(DialoogContext);
}
