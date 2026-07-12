// Vertaalt het laatste-sync-tijdstip naar een status voor de cloud-indicator in de header.
// Gedeeld door de kleine knop (kleur + icoon) en het detailvel (tekst + advies), zodat beide
// altijd hetzelfde oordeel tonen.
import { relatieveTijd } from '../engine/format';

export type SyncNiveau = 'bezig' | 'vers' | 'verouderd' | 'oud' | 'fout' | 'etoro-fout' | 'nooit';

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
  // Foutmelding van de laatste eToro-sync, of null als die lukte (of er geen koppeling is). Los
  // van syncFout, want de koersen kunnen prima ververst zijn terwijl eToro faalde.
  etoroFout?: string | null;
  nu?: number;
}

export function bepaalSyncStand({ laatsteSync, syncFout, syncing, etoroFout = null, nu = Date.now() }: Invoer): SyncStand {
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

  // eToro faalde terwijl de koersen wél ververst zijn. Dat is oranje en geen rood: je prijzen
  // kloppen, je posities niet. Dit moet vóór de "vers"-tak, anders staat de indicator groen te
  // melden dat alles actueel is terwijl je posities al weken niet zijn opgehaald.
  if (etoroFout) {
    return {
      niveau: 'etoro-fout',
      kleur: 'letOp',
      wanneer: 'Koersen bijgewerkt, eToro-sync mislukt',
      // De foutmelding van eToro is zelf al een hele zin (zie etoroFetch), dus die plakken we er
      // ongewijzigd achter in plaats van er nog een eigen advies overheen te leggen.
      advies: `Je posities zijn niet opgehaald. ${etoroFout}`,
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

// ponytail: self-check ipv testframework, run met `npx tsx app/src/state/syncStatus.ts`
if (require.main === module) {
  const nu = Date.UTC(2026, 6, 12, 12, 0, 0);
  const min = (n: number) => nu - n * 60 * 1000;

  console.assert(bepaalSyncStand({ laatsteSync: min(1), syncFout: false, syncing: true, nu }).niveau === 'bezig',
    'bezig gaat voor op alles');
  console.assert(bepaalSyncStand({ laatsteSync: min(1), syncFout: false, syncing: false, nu }).niveau === 'vers',
    'net gesynct is vers');
  console.assert(bepaalSyncStand({ laatsteSync: min(30), syncFout: false, syncing: false, nu }).niveau === 'verouderd',
    'een half uur oud is verouderd');
  console.assert(bepaalSyncStand({ laatsteSync: min(180), syncFout: false, syncing: false, nu }).niveau === 'oud',
    'ouder dan 2 uur is oud');
  console.assert(bepaalSyncStand({ laatsteSync: null, syncFout: false, syncing: false, nu }).niveau === 'nooit',
    'zonder tijdstip is het nooit gesynct');
  console.assert(bepaalSyncStand({ laatsteSync: min(1), syncFout: true, syncing: false, nu }).niveau === 'fout',
    'een prijsfout is rood');

  // De kern van de bug: verversPrijzen slaagt (en zet laatsteSync op nu), maar eToro faalt. Zonder
  // de etoro-fout-tak zou dit 'vers' zijn en meldde de indicator groen dat alles actueel was,
  // terwijl je posities helemaal niet waren opgehaald.
  const etoro = bepaalSyncStand({
    laatsteSync: min(0), syncFout: false, syncing: false, etoroFout: 'Ongeldige API-sleutel.', nu,
  });
  console.assert(etoro.niveau === 'etoro-fout', `verse koersen met een eToro-fout is geen 'vers', was '${etoro.niveau}'`);
  console.assert(etoro.kleur === 'letOp', 'eToro-fout is oranje, niet groen en niet rood: de koersen kloppen wel');
  console.assert(etoro.advies.includes('Ongeldige API-sleutel.'), 'de eToro-melding zelf moet in het advies staan');

  // Een kapotte internetverbinding raakt allebei; dan wint de rode prijsfout.
  console.assert(
    bepaalSyncStand({ laatsteSync: min(5), syncFout: true, syncing: false, etoroFout: 'timeout', nu }).niveau === 'fout',
    'als de koersen ook al falen is dat het ergere signaal',
  );

  console.log('syncStatus.ts self-check geslaagd');
}
