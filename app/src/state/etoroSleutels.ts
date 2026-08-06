// Eén plek waar eToro-sleutels vandaan komen. Daarvoor lazen zes bestanden ze los van schijf; met
// twee omgevingen erbij zou dat verdubbelen en zou elk van die plekken zelf moeten weten of je nu
// demo of echt gebruikt.
//
// De sleutels staan in expo-secure-store, niet in AsyncStorage. Reden: Android Auto Backup stuurt
// de AsyncStorage-database naar Google Drive. Een leessleutel daar is vervelend, een schrijfsleutel
// die echt geld kan verplaatsen is een andere categorie. De schrijfvlag en de gekozen omgeving zijn
// geen geheim en blijven gewoon in AsyncStorage staan.
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EtoroOmgeving, EtoroSleutels } from '../engine/etoro';
import { SLEUTELS, laadTekst, laadVlag, bewaarTekst, bewaarVlag, verwijderSleutel } from '../storage/opslag';

export interface SleutelInvoer {
  apiKey: string;
  userKey: string;
  // Uit de scopes van /api/v1/me. Zonder dit blijft de koppeling alleen-lezen.
  magSchrijven: boolean;
}

const PAAR: Record<EtoroOmgeving, { api: string; user: string; schrijven: string }> = {
  real: { api: SLEUTELS.etoroApiKey, user: SLEUTELS.etoroUserKey, schrijven: SLEUTELS.etoroRealSchrijven },
  demo: { api: SLEUTELS.etoroDemoApiKey, user: SLEUTELS.etoroDemoUserKey, schrijven: SLEUTELS.etoroDemoSchrijven },
};

// Elke consument leest hier meermaals per sessie doorheen (elke sync, elk formulier). Zonder
// modulegeheugen is dat telkens een native call.
let geheugen: Partial<Record<EtoroOmgeving, EtoroSleutels | null>> = {};
let omgevingGeheugen: EtoroOmgeving | null = null;

// ---------- Secure store, met eenmalige migratie ----------

// Ouder toestel: de sleutel staat nog in AsyncStorage. Verplaats 'm, maar pas verwijderen nadat de
// nieuwe plek terugleest. Andersom zou een mislukte schrijfactie de sleutel wissen.
async function leesGeheim(sleutel: string): Promise<string> {
  try {
    const uitKluis = await SecureStore.getItemAsync(sleutel);
    if (uitKluis) return uitKluis;
  } catch {
    // Kluis onbereikbaar: hieronder valt hij terug op de oude plek, en anders op leeg.
  }

  const oud = await laadTekst(sleutel, '');
  if (!oud) return '';

  try {
    await SecureStore.setItemAsync(sleutel, oud);
    const controle = await SecureStore.getItemAsync(sleutel);
    if (controle === oud) await verwijderSleutel(sleutel);
  } catch {
    // Migratie mislukt: laat 'm staan waar hij stond en probeer het de volgende keer opnieuw.
  }
  return oud;
}

async function schrijfGeheim(sleutel: string, waarde: string): Promise<void> {
  await SecureStore.setItemAsync(sleutel, waarde);
  // Restant van vóór de migratie opruimen, anders blijft de oude kopie in de back-up staan.
  await verwijderSleutel(sleutel);
}

async function wisGeheim(sleutel: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(sleutel);
  } catch {
    // Niets in de kluis is ook goed; de AsyncStorage-kopie gaat hieronder alsnog weg.
  }
  await verwijderSleutel(sleutel);
}

// ---------- Sleutels ----------

export async function sleutelsVan(omgeving: EtoroOmgeving): Promise<EtoroSleutels | null> {
  if (omgeving in geheugen) return geheugen[omgeving] ?? null;

  const paar = PAAR[omgeving];
  const [apiKey, userKey] = await Promise.all([leesGeheim(paar.api), leesGeheim(paar.user)]);
  const gevonden = apiKey && userKey ? { apiKey, userKey, omgeving } : null;
  geheugen[omgeving] = gevonden;
  return gevonden;
}

export async function bewaarSleutels(omgeving: EtoroOmgeving, invoer: SleutelInvoer): Promise<void> {
  const paar = PAAR[omgeving];
  await schrijfGeheim(paar.api, invoer.apiKey.trim());
  await schrijfGeheim(paar.user, invoer.userKey.trim());
  await bewaarVlag(paar.schrijven, invoer.magSchrijven);
  geheugen[omgeving] = { apiKey: invoer.apiKey.trim(), userKey: invoer.userKey.trim(), omgeving };
}

export async function wisSleutels(omgeving: EtoroOmgeving): Promise<void> {
  const paar = PAAR[omgeving];
  await Promise.all([wisGeheim(paar.api), wisGeheim(paar.user)]);
  await bewaarVlag(paar.schrijven, false);
  geheugen[omgeving] = null;
}

export async function heeftSleutels(omgeving: EtoroOmgeving): Promise<boolean> {
  return (await sleutelsVan(omgeving)) !== null;
}

// Is er überhaupt een koppeling, in welke omgeving dan ook? Voor de eenmalige verwijzing naar de
// wizard: wie al demo gekoppeld heeft moet niet alsnog de "koppel eens"-popup krijgen.
export async function heeftEnigeSleutel(): Promise<boolean> {
  const [echt, demo] = await Promise.all([heeftSleutels('real'), heeftSleutels('demo')]);
  return echt || demo;
}

// ---------- Omgeving ----------

// Standaard demo: wie nog niets gekozen heeft, hoort niet per ongeluk met echt geld te beginnen.
//
// Uitzondering voor bestaande installaties: wie al een echte leessleutel had en geen demo-sleutel,
// blijft op 'real' staan. Anders zou een update stilzwijgend de portfolio-sync uitzetten van
// iedereen die vandaag gekoppeld is. Het is ook geen geldrisico: handelen vereist de schrijfvlag,
// en een bestaande leessleutel heeft die niet.
export async function haalOmgeving(): Promise<EtoroOmgeving> {
  if (omgevingGeheugen) return omgevingGeheugen;

  const opgeslagen = await laadTekst(SLEUTELS.etoroOmgeving, '');
  if (opgeslagen === 'real' || opgeslagen === 'demo') {
    omgevingGeheugen = opgeslagen;
    return omgevingGeheugen;
  }

  const [echt, demo] = await Promise.all([heeftSleutels('real'), heeftSleutels('demo')]);
  omgevingGeheugen = echt && !demo ? 'real' : 'demo';
  return omgevingGeheugen;
}

export async function zetOmgeving(omgeving: EtoroOmgeving): Promise<void> {
  omgevingGeheugen = omgeving;
  await bewaarTekst(SLEUTELS.etoroOmgeving, omgeving);
}

export async function actieveSleutels(): Promise<EtoroSleutels | null> {
  return sleutelsVan(await haalOmgeving());
}

// Mag Kader in de actieve omgeving een order plaatsen? Fail-closed: zonder sleutels of zonder een
// bevestigd schrijfrecht is dit false, en dan verschijnt er nergens een koop- of verkoopknop.
export async function magHandelen(): Promise<boolean> {
  const omgeving = await haalOmgeving();
  if (!(await heeftSleutels(omgeving))) return false;
  return laadVlag(PAAR[omgeving].schrijven);
}

// Alleen voor tests en voor het wisselpad in Instellingen: dwing een verse lezing af.
export function vergeetSleutelCache(): void {
  geheugen = {};
  omgevingGeheugen = null;
}
