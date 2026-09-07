// Eén dialooghost voor de hele app. Elke plek die vroeger een native Alert.alert opriep vraagt nu
// via useDialoog() om deze dialoog, zodat een bevestiging er overal hetzelfde uitziet en in de
// huisstijl van Kader staat.
//
// De reden dat dit een provider is en geen los component per scherm: de dialoog verschijnt bijna
// altijd op het moment dat een BottomSheet sluit, en die sheets gebruiken een Modal. Twee Modals
// die in dezelfde tick van plek wisselen legden op Android de UI-thread plat (zie de uitleg in
// MeldingNotitie.tsx). Met één host die op InteractionManager wacht gebeurt dat niet meer.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import { KaderDialoog } from '../components/KaderDialoog';

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

  // De wachtbeurt op InteractionManager is geen nettigheid maar de kern van dit bestand: zonder die
  // beurt komt deze Modal op tafel terwijl de BottomSheet-Modal eronder nog aan het opruimen is, en
  // dat is precies de situatie die op Android de UI-thread vastzette.
  const toonDialoog = useCallback((nieuw: DialoogInhoud) => {
    InteractionManager.runAfterInteractions(() => {
      setInhoud(nieuw);
      setZichtbaar(true);
    });
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
