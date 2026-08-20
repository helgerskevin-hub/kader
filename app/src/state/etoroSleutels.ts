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

// Twee lezers tegelijk op dezelfde sleutel liepen elkaar in de weg. Bij een koude start vraagt
// ververHandelStatus() haalOmgeving() en magHandelen() naast elkaar op, en magHandelen() roept
// haalOmgeving() nog eens aan; sleutelsVan vult zijn cache pas na afloop, dus de migratie hieronder
// liep dubbel. Verwijderde de ene lezer de oude kopie net nadat de andere de kluis al leeg had
// gezien, dan las die tweede '' en onthield sleutelsVan een sessie lang "niet gekoppeld".
// Eén lopende belofte per sleutel delen, zodat de migratie precies één keer gebeurt.
const lopendeLezingen = new Map<string, Promise<string>>();

function leesGeheim(sleutel: string): Promise<string> {
  const lopend = lopendeLezingen.get(sleutel);
  if (lopend) return lopend;
  const belofte = leesGeheimEenmalig(sleutel).finally(() => lopendeLezingen.delete(sleutel));
  lopendeLezingen.set(sleutel, belofte);
  return belofte;
}

// Ouder toestel: de sleutel staat nog in AsyncStorage. Verplaats 'm, maar pas verwijderen nadat de
// nieuwe plek terugleest. Andersom zou een mislukte schrijfactie de sleutel wissen.
async function leesGeheimEenmalig(sleutel: string): Promise<string> {
  let kluisFout = false;
  try {
    const uitKluis = await SecureStore.getItemAsync(sleutel);
    if (uitKluis) return uitKluis;
  } catch {
    // Kluis onbereikbaar: hieronder valt hij terug op de oude plek.
    kluisFout = true;
  }

  const oud = await laadTekst(sleutel, '');
  if (!oud) {
    // Een lege kluis en een lege oude plek betekent "geen sleutel". Maar als de kluis een fout gaf
    // weten we dat niet: dat kan een vergrendeld toestel vlak na het opstarten zijn. Dan gooien in
    // plaats van '' teruggeven, anders onthoudt sleutelsVan een sessie lang dat je niet gekoppeld
    // bent terwijl je sleutel er gewoon staat.
    if (kluisFout) throw new Error('De sleutelkluis van dit toestel is nu niet bereikbaar.');
    return '';
  }

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
  // Een lezing die nu nog loopt heeft de oude waarde te pakken; die mag na deze schrijfactie niet
  // alsnog aan een nieuwe aanroeper worden uitgedeeld.
  lopendeLezingen.delete(sleutel);
  await SecureStore.setItemAsync(sleutel, waarde);
  // Restant van vóór de migratie opruimen, anders blijft de oude kopie in de back-up staan.
  await verwijderSleutel(sleutel);
}

async function wisGeheim(sleutel: string): Promise<void> {
  lopendeLezingen.delete(sleutel);
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
  let apiKey: string;
  let userKey: string;
  try {
    [apiKey, userKey] = await Promise.all([leesGeheim(paar.api), leesGeheim(paar.user)]);
  } catch {
    // Kluis tijdelijk onbereikbaar. Wel null teruggeven (dan gebeurt er niets), maar bewust NIET
    // cachen, zodat de volgende poging in dezelfde sessie het opnieuw probeert.
    return null;
  }

  const gevonden = apiKey && userKey ? { apiKey, userKey, omgeving } : null;
  geheugen[omgeving] = gevonden;
  return gevonden;
}

// Het sleutelpaar moet altijd helemaal oud of helemaal nieuw zijn. Slaagt de eerste schrijfactie en
// faalt de tweede, dan zou er een nieuwe api-sleutel naast een oude user-sleutel staan: dat geeft
// een 401 die de gebruiker pas dagen later ziet, want in deze sessie draait de app nog op het
// modulegeheugen. Vandaar het terugdraaien.
export async function bewaarSleutels(omgeving: EtoroOmgeving, invoer: SleutelInvoer): Promise<void> {
  const paar = PAAR[omgeving];
  const apiKey = invoer.apiKey.trim();
  const userKey = invoer.userKey.trim();

  const vorige = await sleutelsVan(omgeving).catch(() => null);

  await schrijfGeheim(paar.api, apiKey);
  try {
    await schrijfGeheim(paar.user, userKey);
  } catch (e) {
    try {
      if (vorige) await schrijfGeheim(paar.api, vorige.apiKey);
      else await wisGeheim(paar.api);
    } catch {
      // Terugdraaien lukt ook niet. De fout hieronder is het verhaal dat de gebruiker moet zien;
      // het geheugen wissen zorgt dat de app in elk geval niet op een half paar doorwerkt.
      delete geheugen[omgeving];
    }
    throw e;
  }

  await bewaarVlag(paar.schrijven, invoer.magSchrijven);
  geheugen[omgeving] = { apiKey, userKey, omgeving };
  // De gekozen omgeving kan door dit koppelen verschuiven (zie haalOmgeving), dus opnieuw laten
  // afleiden in plaats van op de oude waarde blijven staan.
  omgevingGeheugen = null;
}

export async function wisSleutels(omgeving: EtoroOmgeving): Promise<void> {
  const paar = PAAR[omgeving];
  await Promise.all([wisGeheim(paar.api), wisGeheim(paar.user)]);
  await bewaarVlag(paar.schrijven, false);
  geheugen[omgeving] = null;
  omgevingGeheugen = null;
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
    // Alleen een expliciete keuze onthouden we. Die verandert namelijk niet vanzelf.
    omgevingGeheugen = opgeslagen;
    return omgevingGeheugen;
  }

  // De afgeleide keuze bewust NIET cachen en niet wegschrijven. Hij hangt af van welke sleutels er
  // staan, en dat verandert precies op het moment dat de gebruiker koppelt. Cachen gaf dit:
  // verse installatie -> opstart-sync leidt 'demo' af en onthoudt dat -> gebruiker vult zijn echte
  // sleutel in -> de sync die daarop volgt kijkt nog steeds naar demo, vindt niets, en meldt niets.
  // Instellingen zei "Gekoppeld" terwijl de importknop zei dat er geen koppeling was, tot herstart.
  const [echt, demo] = await Promise.all([heeftSleutels('real'), heeftSleutels('demo')]);
  return echt && !demo ? 'real' : 'demo';
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
