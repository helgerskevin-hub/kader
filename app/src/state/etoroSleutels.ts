// Eén plek waar eToro-sleutels vandaan komen. Daarvoor lazen zes bestanden ze los van schijf.
//
// Er is precies ÉÉN sleutelpaar, want eToro geeft er ook maar één uit. Gemeten op 2026-08-06 met
// een echte sleutel (zie docs/etoro-direct-handelen-plan.md §9a): dezelfde sleutel draagt
// trade.demo:read, trade.demo:write, trade.real:read en trade.real:write, en zowel een demo-pad als
// een echt pad wordt erdoor geaccepteerd. De omgeving zit uitsluitend in het PAD, niet in de
// sleutel. Eerder bewaarde dit bestand twee losse paren, een aanname uit het plan van vóór die
// meting; wie zijn enige sleutel onder "demo" invulde was daardoor in "echt" niet gekoppeld, en
// andersom, zonder dat de app dat ergens zei.
//
// De sleutels staan in expo-secure-store, niet in AsyncStorage. Reden: Android Auto Backup stuurt
// de AsyncStorage-database naar Google Drive. Een leessleutel daar is vervelend, een schrijfsleutel
// die echt geld kan verplaatsen is een andere categorie. De schrijfvlaggen en de gekozen omgeving
// zijn geen geheim en blijven gewoon in AsyncStorage staan.
import * as SecureStore from 'expo-secure-store';
import { EtoroOmgeving, EtoroSleutels } from '../engine/etoro';
import { kiesSleutelbron, standaardOmgeving, Sleutelbron, Sleutelpaar } from '../engine/sleutelKeuze';
import { SLEUTELS, laadTekst, laadVlag, bewaarTekst, bewaarVlag, verwijderSleutel } from '../storage/opslag';

export { kiesSleutelbron, standaardOmgeving };
export type { Sleutelbron, Sleutelpaar };

export interface SleutelInvoer extends Sleutelpaar {
  // Uit de scopes van /api/v1/me, per omgeving. Eén sleutel kan schrijfrecht op de ene omgeving
  // dragen en alleen leesrecht op de andere, dus dit blijft wél gesplitst. Zonder schrijfrecht
  // blijft de koppeling in die omgeving alleen-lezen.
  magSchrijven: Record<EtoroOmgeving, boolean>;
}

// Het enige paar dat vanaf nu gebruikt wordt.
const PAAR = { api: SLEUTELS.etoroApiKey, user: SLEUTELS.etoroUserKey };

// Het oude demo-paar. Alleen nog om uit te lezen bij de eenmalige verhuizing hieronder; er wordt
// nooit meer naartoe geschreven.
const OUD_DEMOPAAR = { api: SLEUTELS.etoroDemoApiKey, user: SLEUTELS.etoroDemoUserKey };

const SCHRIJFVLAG: Record<EtoroOmgeving, string> = {
  real: SLEUTELS.etoroRealSchrijven,
  demo: SLEUTELS.etoroDemoSchrijven,
};

// Elke consument leest hier meermaals per sessie doorheen (elke sync, elk formulier). Zonder
// modulegeheugen is dat telkens een native call. undefined = nog niet gelezen, null = geen sleutel.
let geheugen: Sleutelpaar | null | undefined;
let bronGeheugen: Sleutelbron = null;
let omgevingGeheugen: EtoroOmgeving | null = null;

// "Niet gekoppeld" en "de kluis deed het even niet" zijn verschillende verhalen. Ze door elkaar
// halen gaf de melding "Nog geen eToro-koppeling" aan iemand met een prima sleutel, en een stille
// sync die niets deed. Zie synchroniseer() in PortfolioProvider.
export type SleutelUitkomst =
  | { soort: 'gekoppeld'; sleutels: EtoroSleutels }
  | { soort: 'geen' }
  | { soort: 'kluisfout'; bericht: string };

const KLUIS_ONBEREIKBAAR = 'De sleutelkluis van dit toestel is nu niet bereikbaar.';

// ---------- Secure store, met eenmalige migratie ----------

// Twee lezers tegelijk op dezelfde sleutel liepen elkaar in de weg. Bij een koude start vraagt
// ververHandelStatus() haalOmgeving() en magHandelen() naast elkaar op, en magHandelen() roept
// haalOmgeving() nog eens aan; het modulegeheugen vult zich pas na afloop, dus de migratie hieronder
// liep dubbel. Verwijderde de ene lezer de oude kopie net nadat de andere de kluis al leeg had
// gezien, dan las die tweede '' en onthield de app een sessie lang "niet gekoppeld".
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
    // plaats van '' teruggeven, anders onthoudt het modulegeheugen een sessie lang dat je niet
    // gekoppeld bent terwijl je sleutel er gewoon staat.
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

async function haalSleutelpaar(): Promise<Sleutelpaar | null> {
  if (geheugen !== undefined) return geheugen;

  let echtApi: string, echtUser: string, demoApi: string, demoUser: string;
  try {
    [echtApi, echtUser, demoApi, demoUser] = await Promise.all([
      leesGeheim(PAAR.api), leesGeheim(PAAR.user),
      leesGeheim(OUD_DEMOPAAR.api), leesGeheim(OUD_DEMOPAAR.user),
    ]);
  } catch (e) {
    // Kluis tijdelijk onbereikbaar. Bewust NIET cachen, zodat de volgende poging in dezelfde sessie
    // het opnieuw probeert, en bewust gooien in plaats van null teruggeven: null betekent hier
    // "niet gekoppeld", en dat is een heel ander verhaal dan "ik kon er even niet bij".
    throw e instanceof Error ? e : new Error(KLUIS_ONBEREIKBAAR);
  }

  const keuze = kiesSleutelbron({ apiKey: echtApi, userKey: echtUser }, { apiKey: demoApi, userKey: demoUser });
  if (!keuze) {
    geheugen = null;
    bronGeheugen = null;
    return null;
  }

  // Stond de sleutel alleen in het oude demo-slot, dan verhuist hij nu naar het enige slot dat
  // overblijft. Dit is de reparatie voor iedereen die zijn enige sleutel onder "eToro-sleutel demo"
  // had ingevuld en daardoor in "echt" niet gekoppeld was.
  //
  // Het oude demo-slot wordt met opzet NIET gewist. Zou de keuze hierboven er onverhoopt naast
  // zitten, dan is een weggegooide User Key niet terug te halen: eToro toont hem maar één keer.
  // Hij wordt vanaf nu alleen niet meer gelezen. Opruimen kan in een latere versie.
  if (keuze.bron === 'demo') {
    try {
      await schrijfGeheim(PAAR.api, keuze.apiKey);
      await schrijfGeheim(PAAR.user, keuze.userKey);
    } catch {
      // Verhuizen lukt nu niet. De sleutel is deze sessie gewoon bruikbaar uit het geheugen
      // hieronder, en de volgende start probeert het opnieuw.
    }
  }

  geheugen = { apiKey: keuze.apiKey, userKey: keuze.userKey };
  bronGeheugen = keuze.bron;
  return geheugen;
}

// De omgeving zit niet in de sleutel maar in het pad, dus dit is dezelfde sleutel met een ander
// etiket erop. Blijft per omgeving opgevraagd worden zodat elke aanroeper expliciet is over waar
// zijn verzoek heen gaat.
export async function sleutelsVan(omgeving: EtoroOmgeving): Promise<EtoroSleutels | null> {
  const paar = await haalSleutelpaar().catch(() => null);
  return paar ? { ...paar, omgeving } : null;
}

// Voor de wizard, die het opgeslagen paar wil voorvullen zonder een omgeving te hoeven kiezen.
export async function haalSleutels(): Promise<Sleutelpaar | null> {
  return haalSleutelpaar().catch(() => null);
}

// De vorm waarmee de sync en de importknop werken: die moeten "geen sleutel" en "kluis stuk" uit
// elkaar kunnen houden, want alleen het eerste is een normale toestand.
export async function sleutelUitkomst(): Promise<SleutelUitkomst> {
  let paar: Sleutelpaar | null;
  try {
    paar = await haalSleutelpaar();
  } catch (e) {
    return { soort: 'kluisfout', bericht: e instanceof Error ? e.message : KLUIS_ONBEREIKBAAR };
  }
  if (!paar) return { soort: 'geen' };
  return { soort: 'gekoppeld', sleutels: { ...paar, omgeving: await haalOmgeving() } };
}

// Het sleutelpaar moet altijd helemaal oud of helemaal nieuw zijn. Slaagt de eerste schrijfactie en
// faalt de tweede, dan zou er een nieuwe api-sleutel naast een oude user-sleutel staan: dat geeft
// een 401 die de gebruiker pas dagen later ziet, want in deze sessie draait de app nog op het
// modulegeheugen. Vandaar het terugdraaien.
export async function bewaarSleutels(invoer: SleutelInvoer): Promise<void> {
  const apiKey = invoer.apiKey.trim();
  const userKey = invoer.userKey.trim();

  const vorige = await haalSleutelpaar().catch(() => null);

  await schrijfGeheim(PAAR.api, apiKey);
  try {
    await schrijfGeheim(PAAR.user, userKey);
  } catch (e) {
    try {
      if (vorige) await schrijfGeheim(PAAR.api, vorige.apiKey);
      else await wisGeheim(PAAR.api);
    } catch {
      // Terugdraaien lukt ook niet. De fout hieronder is het verhaal dat de gebruiker moet zien;
      // het geheugen wissen zorgt dat de app in elk geval niet op een half paar doorwerkt.
      geheugen = undefined;
      bronGeheugen = null;
    }
    throw e;
  }

  // Beide vlaggen komen uit hetzelfde /me-antwoord, want dat geeft de scopes van alle omgevingen in
  // één keer. Eerder werd alleen de vlag gezet van de omgeving waaronder je koppelde, en dan kon je
  // na koppelen onder "echt" niet handelen in demo terwijl je sleutel dat wel mocht.
  await Promise.all([
    bewaarVlag(SCHRIJFVLAG.real, invoer.magSchrijven.real),
    bewaarVlag(SCHRIJFVLAG.demo, invoer.magSchrijven.demo),
  ]);

  geheugen = { apiKey, userKey };
  // 'beide' en niet 'echt': standaardOmgeving() geeft alleen 'real' terug voor een sleutel die al
  // vóór deze versie uitsluitend in het echte slot stond. Wie hier nu koppelt is nieuw, en die hoort
  // in demo te beginnen, niet met echt geld.
  bronGeheugen = 'beide';

  // Heeft deze gebruiker nog nooit een omgeving gekozen, leg dan nu demo vast. Zonder dit zou de
  // eerstvolgende haalOmgeving() de keuze alsnog gaan afleiden, en dan belandt iemand die zich net
  // voor het eerst koppelt op zijn echte account.
  const opgeslagen = await laadTekst(SLEUTELS.etoroOmgeving, '');
  if (opgeslagen !== 'real' && opgeslagen !== 'demo') await zetOmgeving('demo');
}

export async function wisSleutels(): Promise<void> {
  // Ook het oude demo-slot leegmaken. Bij het verhuizen laten we het staan omdat we dan niets mogen
  // verliezen, maar wie bewust zijn koppeling verwijdert wil er geen kopie meer van op zijn toestel.
  await Promise.all([
    wisGeheim(PAAR.api), wisGeheim(PAAR.user),
    wisGeheim(OUD_DEMOPAAR.api), wisGeheim(OUD_DEMOPAAR.user),
  ]);
  await Promise.all([bewaarVlag(SCHRIJFVLAG.real, false), bewaarVlag(SCHRIJFVLAG.demo, false)]);
  geheugen = null;
  bronGeheugen = null;
  omgevingGeheugen = null;
}

// Een onbereikbare kluis is hier bewust false: dit stuurt alleen statusteksten en de koopknop aan,
// en die horen fail-closed te zijn. De sync gebruikt sleutelUitkomst(), want daar moet het verschil
// wél zichtbaar worden.
export async function heeftSleutels(): Promise<boolean> {
  return (await haalSleutelpaar().catch(() => null)) !== null;
}

// Zelfde vraag, oudere naam. Er is nog maar één sleutel, dus "enige sleutel" en "de sleutel" zijn
// hetzelfde geworden.
export async function heeftEnigeSleutel(): Promise<boolean> {
  return heeftSleutels();
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

  // Nog nooit expliciet gekozen. Eén keer afleiden en meteen vastleggen, zodat de keuze daarna niet
  // meer afhangt van wat er op dat moment uit de kluis komt. Dat afhangen was een val: een tijdelijk
  // onbereikbare kluis liet "heeft echte sleutels" false zijn en zette een echte-accountgebruiker zo
  // stilzwijgend op het demo-pad, met een 401 op een sleutel waar niets mis mee was.
  const paar = await haalSleutelpaar().catch(() => null);
  if (!paar) {
    // Niets gekoppeld, of de kluis is nu niet te lezen. In allebei de gevallen niets vastleggen en
    // niets cachen: demo is de veilige tussenstand, en zodra de kluis wél opengaat valt de keuze
    // alsnog. Dit vastleggen op een mislukte lezing zou iemand die op echt stond op demo zetten.
    return 'demo';
  }

  const gekozen = standaardOmgeving(bronGeheugen);
  await zetOmgeving(gekozen);
  return gekozen;
}

export async function zetOmgeving(omgeving: EtoroOmgeving): Promise<void> {
  omgevingGeheugen = omgeving;
  await bewaarTekst(SLEUTELS.etoroOmgeving, omgeving);
}

export async function actieveSleutels(): Promise<EtoroSleutels | null> {
  const uitkomst = await sleutelUitkomst();
  return uitkomst.soort === 'gekoppeld' ? uitkomst.sleutels : null;
}

// Mag Kader in de actieve omgeving een order plaatsen? Fail-closed: zonder sleutels of zonder een
// bevestigd schrijfrecht is dit false, en dan verschijnt er nergens een koop- of verkoopknop.
export async function magHandelen(): Promise<boolean> {
  const omgeving = await haalOmgeving();
  if (!(await heeftSleutels())) return false;
  return laadVlag(SCHRIJFVLAG[omgeving]);
}

// Alleen voor tests en voor het wisselpad in Instellingen: dwing een verse lezing af.
export function vergeetSleutelCache(): void {
  geheugen = undefined;
  bronGeheugen = null;
  omgevingGeheugen = null;
}
