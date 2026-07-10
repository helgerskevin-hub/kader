// Vertaalt het laatste-sync-tijdstip naar een status voor de cloud-indicator in de header.
// Gedeeld door de kleine knop (kleur + icoon) en het detailvel (tekst + advies), zodat beide
// altijd hetzelfde oordeel tonen.
import { relatieveTijd } from '../engine/format';

export type SyncNiveau = 'bezig' | 'vers' | 'verouderd' | 'oud' | 'fout' | 'nooit';

// Onder 5 minuten geldt als actueel; de prijzen ververst het interval sowieso elke minuut.
const VERS_GRENS_MS = 5 * 60 * 1000;
// Boven 2 uur is de kans groot dat koersen merkbaar zijn verschoven: dan dringend adviseren.
const VEROUDERD_GRENS_MS = 2 * 60 * 60 * 1000;

export interface SyncStand {
  niveau: SyncNiveau;
  // Kleursleutel uit de theme-tokens, zodat licht/donker allebei kloppen.
  kleur: 'winst' | 'letOp' | 'verlies' | 'cta' | 'tekstGedimd';
  // Korte regel voor onder het icoon of in het vel, bijv. "3 min geleden".
  wanneer: string;
  // Eén zin advies onder de statusregel.
  advies: string;
}

interface Invoer {
  laatsteSync: number | null;
  syncFout: boolean;
  syncing: boolean;
  nu?: number;
}

export function bepaalSyncStand({ laatsteSync, syncFout, syncing, nu = Date.now() }: Invoer): SyncStand {
  if (syncing) {
    return {
      niveau: 'bezig',
      kleur: 'cta',
      wanneer: 'Bezig met synchroniseren',
      advies: 'De nieuwste koersen en posities worden opgehaald.',
    };
  }

  if (syncFout) {
    return {
      niveau: 'fout',
      kleur: 'verlies',
      wanneer: laatsteSync ? `Laatst gelukt: ${relatieveTijd(laatsteSync, nu)}` : 'Nog niet gelukt',
      advies: 'De laatste synchronisatie mislukte. Controleer je internet en probeer opnieuw.',
    };
  }

  if (laatsteSync === null) {
    return {
      niveau: 'nooit',
      kleur: 'letOp',
      wanneer: 'Nog niet gesynchroniseerd',
      advies: 'Synchroniseer om de actuele koersen en je eToro-posities op te halen.',
    };
  }

  const leeftijd = nu - laatsteSync;
  const wanneer = relatieveTijd(laatsteSync, nu);

  if (leeftijd < VERS_GRENS_MS) {
    return {
      niveau: 'vers',
      kleur: 'winst',
      wanneer: `Bijgewerkt ${wanneer}`,
      advies: 'Je koersen en posities zijn actueel.',
    };
  }

  if (leeftijd < VEROUDERD_GRENS_MS) {
    return {
      niveau: 'verouderd',
      kleur: 'letOp',
      wanneer: `Bijgewerkt ${wanneer}`,
      advies: 'De gegevens raken verouderd. Synchroniseer voor de nieuwste stand.',
    };
  }

  return {
    niveau: 'oud',
    kleur: 'verlies',
    wanneer: `Bijgewerkt ${wanneer}`,
    advies: 'Je bent al een tijd niet bijgewerkt. Synchroniseer voor actuele koersen en posities.',
  };
}
