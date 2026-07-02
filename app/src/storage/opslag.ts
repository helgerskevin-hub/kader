import AsyncStorage from '@react-native-async-storage/async-storage';

export const SLEUTELS = {
  portfolio: 'portfolio_trades',
  traders: 'traders',
  onboarding: 'onboarding_klaar',
  thema: 'thema_modus',
} as const;

export async function laadLijst<T>(sleutel: string): Promise<T[]> {
  try {
    const json = await AsyncStorage.getItem(sleutel);
    if (!json) return [];
    return JSON.parse(json) as T[];
  } catch {
    return [];
  }
}

export async function bewaarLijst<T>(sleutel: string, lijst: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(sleutel, JSON.stringify(lijst));
  } catch {
    // schrijffout stilt neerzetten; data blijft in memory
  }
}

export async function laadVlag(sleutel: string): Promise<boolean> {
  try {
    const waarde = await AsyncStorage.getItem(sleutel);
    return waarde === '1';
  } catch {
    return false;
  }
}

export async function bewaarVlag(sleutel: string, waarde: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(sleutel, waarde ? '1' : '0');
  } catch {
    // schrijffout stilt neerzetten
  }
}

export async function laadTekst(sleutel: string, standaard: string): Promise<string> {
  try {
    const waarde = await AsyncStorage.getItem(sleutel);
    return waarde ?? standaard;
  } catch {
    return standaard;
  }
}

export async function bewaarTekst(sleutel: string, waarde: string): Promise<void> {
  try {
    await AsyncStorage.setItem(sleutel, waarde);
  } catch {
    // schrijffout stilt neerzetten
  }
}
