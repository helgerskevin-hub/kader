import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Tab } from '../components/BottomNav';
import { MeldingDoel } from '../notifications/meldingDoel';

// Navigatie op verzoek van iets dat zelf niet weet welk tabblad er open staat, zoals het
// meldingenlog in de header. Dat log zit in ScreenHeader en die staat op elk scherm, dus een tik
// op een melding kan overal vandaan komen en moet toch op het juiste tabblad uitkomen.
//
// Het doel blijft staan tot het scherm zegt dat het verwerkt is (wisDoel). Dat is nodig omdat het
// doelscherm zijn data soms nog niet heeft: tik je op een koopsignaal terwijl er nog geen analyse
// gedraaid is, dan start het Marktscherm die analyse en opent het de coin pas als de data binnen is.

export function tabVoorDoel(doel: MeldingDoel): Tab {
  switch (doel.soort) {
    case 'trade':
    case 'portfolio':
      return 'portfolio';
    case 'coin':
    case 'markt':
      return 'markt';
  }
}

interface NavigatieWaarde {
  doel: MeldingDoel | null;
  gaNaar: (doel: MeldingDoel) => void;
  wisDoel: () => void;
}

const NavigatieContext = createContext<NavigatieWaarde | null>(null);

export function NavigatieProvider({ wisselTab, children }: {
  wisselTab: (tab: Tab) => void;
  children: React.ReactNode;
}) {
  const [doel, setDoel] = useState<MeldingDoel | null>(null);

  // wisselTab komt uit App.tsx en is elke render een nieuwe functie. Via een ref blijft de
  // context-waarde hieronder stabiel, zodat de schermen niet bij elke render van App opnieuw
  // tekenen. Dat is precies wat de memo's om de schermen heen beschermen (zie App.tsx).
  const wisselRef = React.useRef(wisselTab);
  wisselRef.current = wisselTab;

  const gaNaar = useCallback((volgende: MeldingDoel) => {
    wisselRef.current(tabVoorDoel(volgende));
    setDoel(volgende);
  }, []);

  const wisDoel = useCallback(() => setDoel(null), []);

  const waarde = useMemo<NavigatieWaarde>(() => ({ doel, gaNaar, wisDoel }), [doel, gaNaar, wisDoel]);

  return <NavigatieContext.Provider value={waarde}>{children}</NavigatieContext.Provider>;
}

export function useNavigatie(): NavigatieWaarde {
  const ctx = useContext(NavigatieContext);
  if (!ctx) throw new Error('useNavigatie moet binnen NavigatieProvider gebruikt worden');
  return ctx;
}
