import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Tab } from '../components/BottomNav';
import { MeldingDoel, leesDoel } from '../notifications/meldingDoel';

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

  // Een tik op een push-melding in de notificatiebalk. stuurTradeMelding geeft een losse melding
  // haar doel mee in de data; hier gaat dat doel dezelfde weg als een tik in het meldingenlog. De
  // hook geeft ook de tik terug die de app vanuit een koude start opende. Na verwerken gewist, anders
  // zou dezelfde tik bij een volgende mount opnieuw navigeren. Een melding zonder (geldig) doel, zoals
  // een bundel of de dagelijkse herinnering, opent gewoon de app.
  const laatsteTik = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!laatsteTik || laatsteTik.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const volgende = leesDoel(laatsteTik.notification.request.content.data?.doel);
    // Wissen is ook nodig voor de volgende tik: alle trade-meldingen delen één identifier, en de hook
    // negeert een nieuwe tik met dezelfde identifier zolang de vorige nog staat.
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      // Niet beschikbaar op dit platform: dan navigeren we gewoon, hooguit een keer te veel.
    }
    if (volgende) gaNaar(volgende);
  }, [laatsteTik, gaNaar]);

  const waarde = useMemo<NavigatieWaarde>(() => ({ doel, gaNaar, wisDoel }), [doel, gaNaar, wisDoel]);

  return <NavigatieContext.Provider value={waarde}>{children}</NavigatieContext.Provider>;
}

export function useNavigatie(): NavigatieWaarde {
  const ctx = useContext(NavigatieContext);
  if (!ctx) throw new Error('useNavigatie moet binnen NavigatieProvider gebruikt worden');
  return ctx;
}
