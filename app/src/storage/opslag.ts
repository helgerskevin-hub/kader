import AsyncStorage from '@react-native-async-storage/async-storage';

export const SLEUTELS = {
  portfolio: 'portfolio_trades',
  traders: 'traders',
  onboarding: 'onboarding_klaar',
  thema: 'thema_modus',
  favorieten: 'favoriete_coins',
  changelogVersie: 'changelog_versie_gezien',
  etoroApiKey: 'etoro_api_key',
  etoroUserKey: 'etoro_user_key',
  etoroSetupGevraagd: 'etoro_setup_gevraagd',
  laatsteSync: 'laatste_sync_tijd',
  // eToro-positie-ID's die de gebruiker uit zijn portfolio heeft verwijderd. Zonder deze lijst
  // zet de eerstvolgende sync ze er gewoon weer in, want ontdubbelen gebeurt op positie-ID.
  genegeerdeEtoroIds: 'genegeerde_etoro_ids',
  // Concept van het "Trade toevoegen"-formulier: overleeft een activity-restart door Android
  // terwijl je even naar eToro schakelt om de exacte prijs te checken.
  tradeConcept: 'trade_concept',
} as const;

export async function laadLijst<T>(sleutel: string): Promise<T[]> {
  try {
    const json = await AsyncStorage.getItem(sleutel);
    if (!json) return [];
    const data = JSON.parse(json);
    // corrupte/legacy sleutel kan een niet-array bevatten; callers doen direct .map/.filter/new Set
    return Array.isArray(data) ? data as T[] : [];
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

export async function laadObject<T>(sleutel: string): Promise<T | null> {
  try {
    const json = await AsyncStorage.getItem(sleutel);
    return json ? JSON.parse(json) as T : null;
  } catch {
    return null;
  }
}

export async function bewaarObject<T>(sleutel: string, waarde: T): Promise<void> {
  try {
    await AsyncStorage.setItem(sleutel, JSON.stringify(waarde));
  } catch {
    // schrijffout stilt neerzetten; data blijft in memory
  }
}

export async function verwijderSleutel(sleutel: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(sleutel);
  } catch {
    // verwijderfout stilt neerzetten
  }
}
