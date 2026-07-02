import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { lightTokens, darkTokens, ColorTokens } from './tokens';
import { laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';

export type ThemaModus = 'systeem' | 'licht' | 'donker';

interface ThemeContextValue {
  colors: ColorTokens;
  modus: ThemaModus;
  donkerActief: boolean;
  setModus: (modus: ThemaModus) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightTokens,
  modus: 'systeem',
  donkerActief: false,
  setModus: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systeemSchema = useColorScheme();
  const [modus, setModusState] = useState<ThemaModus>('systeem');

  useEffect(() => {
    laadTekst(SLEUTELS.thema, 'systeem').then(waarde => {
      if (waarde === 'licht' || waarde === 'donker' || waarde === 'systeem') {
        setModusState(waarde);
      }
    });
  }, []);

  const setModus = (nieuweModus: ThemaModus) => {
    setModusState(nieuweModus);
    bewaarTekst(SLEUTELS.thema, nieuweModus);
  };

  const donkerActief = modus === 'donker' || (modus === 'systeem' && systeemSchema === 'dark');
  const colors = donkerActief ? darkTokens : lightTokens;

  return (
    <ThemeContext.Provider value={{ colors, modus, donkerActief, setModus }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
