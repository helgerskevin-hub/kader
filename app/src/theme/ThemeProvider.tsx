import React, { createContext, useContext } from 'react';
import { lightTokens, ColorTokens } from './tokens';

interface ThemeContextValue {
  colors: ColorTokens;
}

const ThemeContext = createContext<ThemeContextValue>({ colors: lightTokens });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ colors: lightTokens }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
