import { createContext, useContext } from 'react';

// Of de tab waarin een component staat nu op het scherm is. De pager houdt bezochte tabs gemount
// (ook op de achtergrond, zie App.tsx), dus eindeloze animaties (adem, shimmer, puls) moeten hier
// op letten: anders draaien ze de hele sessie door op een tab die niemand ziet. Buiten de pager
// (sheets, full-screen schermen) is alles zichtbaar, vandaar de standaard true.
export const TabZichtbaarContext = createContext(true);

export function useTabZichtbaar(): boolean {
  return useContext(TabZichtbaarContext);
}
