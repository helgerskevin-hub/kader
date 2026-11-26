// Opslag van de app-vergrendeling: het pincode-record en de pogingenteller in expo-secure-store,
// de instellingen (termijn, biometrie) en de hint in AsyncStorage, plus de klok en de native
// hulpjes (KDF, salt, Recente apps). Geen React. De rekenregels staan in de engine
// (engine/pinCode.ts, engine/slotPogingen.ts), de types in het contract (vergrendelTypes.ts).
//
// Eigen SecureStore-helpers en niet die van etoroSleutels.ts: daar zit een migratie vanuit
// AsyncStorage in, en een kluisfout geeft daar '' terug op plekken waar dat "geen sleutel"
// betekent. Hier mag een kluisfout NOOIT als "geen pincode" gelezen worden: dat zou het slot
// openzetten. Vandaar overal LeesUitkomst met een aparte 'kluisfout'.
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FOUTEN_VOOR_BLOKKADE,
  PIN_SALT_BYTES,
  SLOT_TERMIJNEN,
  STANDAARD_TERMIJN,
  type Kdf,
  type KaderBeveiligingModule,
  type KlokStand,
  type LeesUitkomst,
  type PinRecord,
  type PogingenStand,
  type SchrijfUitkomst,
  type SlotTermijn,
} from './vergrendelTypes';
import { SLEUTELS, bewaarTekst, laadTekst } from '../storage/opslag';

const SLEUTEL_PIN = 'kader_slot_pin';
const SLEUTEL_POGINGEN = 'kader_slot_pogingen';

const KLUIS_ONBEREIKBAAR = 'De beveiligde opslag van dit toestel reageert niet.';
const RECORD_KAPOT = 'Het opgeslagen pincode-record is onleesbaar.';
const TERUGLEZEN_MISLUKT = 'Wat Kader opsloeg kwam er anders uit dan het erin ging.';
const GEEN_NATIEF = 'De beveiligingsmodule van Kader ontbreekt in deze build.';

function bericht(e: unknown, terugval: string): string {
  return e instanceof Error && e.message ? e.message : terugval;
}

// ---------- Eén rij voor alles wat het slot raakt ----------

// Alles wat het pincode-record, de pogingenteller of de eToro-sleutels schrijft loopt hierdoor,
// één tegelijk: de pogingen in de provider, stelPinIn, wijzigPin, zetSlotUit, en bewaarSleutels in
// etoroSleutels.ts. Zo kan een sleutel nooit opgeslagen worden terwijl zetSlotUit tussen zijn
// eToro-controle en het wissen van het record zit. Op moduleniveau en niet in de provider, omdat
// bewaarSleutels buiten React draait. Niet nesten: werk binnen de rij mag zelf geen inSlotRij
// aanroepen en erop wachten, dan wacht het op zichzelf.
//
// Tijdslimiet: alleen de LEESacties uit de kluis (leesPinRecord en leesPogingen, ook als ze binnen
// de rij draaien) geven na LEES_LIMIET_MS een kluisfout terug. Daarmee rondt het werk in de rij af en
// komt de rij weer vrij, zodat een hangende SecureStore het slot niet eeuwig op een spinner laat.
// Een late leesuitkomst wordt weggegooid; lezen verandert niets, dus dat kan geen inconsistente
// stand geven. Schrijfacties (setItemAsync, deleteItemAsync en het teruglezen dat bij een schrijf
// hoort) worden NIET afgebroken: een schrijf die na een time-out alsnog landt, zou een stand geven
// die de provider niet kent (bijvoorbeeld een record waarvan hij denkt dat het er niet is). Hangt
// een schrijf, dan blijft de rij dus bezet tot hij terugkomt; dat is de bewuste prijs.
let rij: Promise<unknown> = Promise.resolve();
export function inSlotRij<T>(werk: () => Promise<T>): Promise<T> {
  const r = rij.then(werk, werk);
  rij = r.catch(() => {});
  return r;
}

// ---------- Native module ----------

// In een try: requireNativeModule gooit als de module niet gelinkt is (Node, een oude build). Dan
// valt de klok terug op de wandklok (bron 'wand') en faalt alles wat de KDF of de salt nodig heeft
// met een kluisfout, nooit met een open slot.
let natief: KaderBeveiligingModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  natief = (require('../../modules/kader-beveiliging') as { default: KaderBeveiligingModule }).default;
} catch {
  natief = null;
}

// De sleutelafleiding voor engine/pinCode.ts. Gooit zonder native module.
export const kdf: Kdf = async (pin, saltHex, iteraties) => {
  if (!natief) throw new Error(GEEN_NATIEF);
  return natief.pbkdf2Sha256Hex(pin, saltHex, iteraties);
};

// Een verse salt van PIN_SALT_BYTES bytes, als hex in kleine letters. Gooit zonder native module
// of bij een uitkomst die geen hex van de juiste lengte is.
export function nieuweSalt(): string {
  if (!natief) throw new Error(GEEN_NATIEF);
  const hex = String(natief.willekeurigeHex(PIN_SALT_BYTES)).toLowerCase();
  if (!new RegExp(`^[0-9a-f]{${PIN_SALT_BYTES * 2}}$`).test(hex)) {
    throw new Error('De salt van de beveiligingsmodule heeft een onverwachte vorm.');
  }
  return hex;
}

// Eén klokmeting. Met de native module: monotoon (elapsedRealtime) plus opstartteller; anders, of
// als een waarde niet eindig is, alleen de wandklok.
export function klokNu(): KlokStand {
  const wand = Date.now();
  if (natief) {
    try {
      const monotoon = natief.monotoneTijd();
      const teller = natief.opstartTeller();
      if (typeof monotoon === 'number' && Number.isFinite(monotoon)) {
        return {
          monotoon,
          bootTeller: typeof teller === 'number' && Number.isFinite(teller) ? teller : -1,
          wand,
          bron: 'monotoon',
        };
      }
    } catch {
      // Valt hieronder terug op de wandklok.
    }
  }
  return { monotoon: wand, bootTeller: -1, wand, bron: 'wand' };
}

// Recente apps: false zolang het slot aan staat. Een fout of een ontbrekende module doet niets.
export function zetRecentsAfbeelding(toestaan: boolean): void {
  try {
    natief?.zetRecentsAfbeelding(toestaan);
  } catch {
    // Geen activity of te oude Android: niets aan te doen.
  }
}

// ---------- Keuring ----------

// Structurele keuring: alleen de vorm. Of de waarden kloppen (iteraties, salt, hash) beslist
// controleerPin, die bij een rare waarde gewoon false geeft. Een record dat hier afvalt is kapot
// en wordt een kluisfout, nooit 'nee'.
function isPinRecordVorm(x: unknown): x is PinRecord {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.v === 'number' &&
    typeof r.alg === 'string' &&
    typeof r.it === 'number' &&
    typeof r.salt === 'string' &&
    typeof r.hash === 'string'
  );
}

// Een onleesbare of kapotte pogingenstand mag geen gratis pogingen opleveren. Daarom geen
// kluisfout (dan kon niemand meer ontgrendelen) maar een stand die de engine fail-closed afhandelt:
// "vijf fouten, blokkade onbekend". resterendeBlokkade geeft dan de volle trede en herankerStand
// legt een verse wachttijd vanaf nu vast. Hooguit één wachttijd extra, nooit permanent.
const KAPOTTE_POGINGEN: PogingenStand = { v: 1, fouten: FOUTEN_VOOR_BLOKKADE, blokkade: null };

function keurPogingen(x: unknown): PogingenStand {
  if (!x || typeof x !== 'object') return { ...KAPOTTE_POGINGEN };
  const r = x as Record<string, unknown>;
  // Een niet-numeriek aantal fouten wordt NaN: de engine telt dat als "volgende fout blokkeert".
  const fouten = typeof r.fouten === 'number' ? r.fouten : Number.NaN;
  // Een blokkade die geen object is wordt een object met NaN-velden: de engine geeft dan de volle
  // duur en herankert. Ontbreekt hij (null), dan blijft hij null.
  let blokkade: PogingenStand['blokkade'] = null;
  if (r.blokkade != null) {
    const b = (typeof r.blokkade === 'object' ? r.blokkade : {}) as Record<string, unknown>;
    const getal = (v: unknown) => (typeof v === 'number' ? v : Number.NaN);
    blokkade = {
      totMonotoon: getal(b.totMonotoon),
      bootTeller: getal(b.bootTeller),
      wandAnker: getal(b.wandAnker),
      resterendBijAnker: getal(b.resterendBijAnker),
      duurMs: getal(b.duurMs),
    };
  }
  return { v: typeof r.v === 'number' ? r.v : 1, fouten, blokkade };
}

// ---------- SecureStore ----------

// Gelijk aan de grens van de koude start in de provider.
const LEES_LIMIET_MS = 6000;
const LEES_TE_LAAT = 'De beveiligde opslag reageert niet op tijd.';

// SecureStore.getItemAsync met tijdslimiet, alleen voor losse leesacties (zie inSlotRij). Gooit bij
// een time-out; de aanroeper maakt daar een kluisfout van.
function leesMetLimiet(sleutel: string): Promise<string | null> {
  return new Promise<string | null>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(LEES_TE_LAAT)), LEES_LIMIET_MS);
    SecureStore.getItemAsync(sleutel).then(
      w => {
        clearTimeout(t);
        resolve(w);
      },
      e => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function schrijfEnLeesTerug(sleutel: string, waarde: string): Promise<SchrijfUitkomst> {
  try {
    await SecureStore.setItemAsync(sleutel, waarde);
    const terug = await SecureStore.getItemAsync(sleutel);
    if (terug !== waarde) return { soort: 'kluisfout', bericht: TERUGLEZEN_MISLUKT };
    return { soort: 'ok' };
  } catch (e) {
    return { soort: 'kluisfout', bericht: bericht(e, KLUIS_ONBEREIKBAAR) };
  }
}

async function wisEnControleer(sleutel: string): Promise<SchrijfUitkomst> {
  try {
    await SecureStore.deleteItemAsync(sleutel);
    const terug = await SecureStore.getItemAsync(sleutel);
    if (terug != null) return { soort: 'kluisfout', bericht: TERUGLEZEN_MISLUKT };
    return { soort: 'ok' };
  } catch (e) {
    return { soort: 'kluisfout', bericht: bericht(e, KLUIS_ONBEREIKBAAR) };
  }
}

// Het pincode-record. 'nee' alleen als de kluis zegt dat er niets staat; onleesbaar of kapot is
// een kluisfout.
export async function leesPinRecord(): Promise<LeesUitkomst<PinRecord>> {
  let ruw: string | null;
  try {
    ruw = await leesMetLimiet(SLEUTEL_PIN);
  } catch (e) {
    return { soort: 'kluisfout', bericht: bericht(e, KLUIS_ONBEREIKBAAR) };
  }
  if (ruw == null) return { soort: 'nee' };
  let data: unknown;
  try {
    data = JSON.parse(ruw);
  } catch {
    return { soort: 'kluisfout', bericht: RECORD_KAPOT };
  }
  if (!isPinRecordVorm(data)) return { soort: 'kluisfout', bericht: RECORD_KAPOT };
  return { soort: 'ja', waarde: data };
}

// Schrijft het record en leest het terug; pas 'ok' als het er precies zo weer uitkomt.
export function bewaarPinRecord(record: PinRecord): Promise<SchrijfUitkomst> {
  return schrijfEnLeesTerug(SLEUTEL_PIN, JSON.stringify(record));
}

// De pogingenteller. 'nee' = er staat niets (gebruik LEGE_POGINGEN). Een kapotte stand komt terug
// als 'ja' met een fail-closed stand (zie keurPogingen). Alleen een kluis die niet antwoordt is
// een kluisfout: dan mag er niet geverifieerd worden, want de fout kan niet eerst worden
// weggeschreven.
export async function leesPogingen(): Promise<LeesUitkomst<PogingenStand>> {
  let ruw: string | null;
  try {
    ruw = await leesMetLimiet(SLEUTEL_POGINGEN);
  } catch (e) {
    return { soort: 'kluisfout', bericht: bericht(e, KLUIS_ONBEREIKBAAR) };
  }
  if (ruw == null) return { soort: 'nee' };
  try {
    return { soort: 'ja', waarde: keurPogingen(JSON.parse(ruw)) };
  } catch {
    return { soort: 'ja', waarde: { ...KAPOTTE_POGINGEN } };
  }
}

export function bewaarPogingen(stand: PogingenStand): Promise<SchrijfUitkomst> {
  return schrijfEnLeesTerug(SLEUTEL_POGINGEN, JSON.stringify(stand));
}

// Bij uitzetten: eerst de hint, dan het record (daarmee staat het slot uit), dan de pogingen en de
// biometrie-voorkeur. Faalt de hint of het record, dan stopt het hier: liever een slot dat nog aan
// staat dan een half gewist slot.
export async function wisSlot(): Promise<SchrijfUitkomst> {
  // Eerst de hint uit, dan pas het record weg. 'Geen record' met de hint aan telt als kluisfout
  // (bepaalSlotStatus), dus andersom zou een legitiem uitzetten dat halverwege stopt in het
  // kluisfout-slot eindigen. Lukt de hint niet, dan blijft alles staan.
  if (!(await bewaarHintIngesteld(false))) {
    return { soort: 'kluisfout', bericht: 'Kader kon de instelling van het slot niet opslaan.' };
  }
  const pin = await wisEnControleer(SLEUTEL_PIN);
  if (pin.soort !== 'ok') {
    // Het record staat er nog: de hint weer aan, anders opent een latere kluisfout zonder koppeling.
    await bewaarHintIngesteld(true);
    return pin;
  }
  // De teller weg is netjes maar niet kritiek: zonder record wordt hij nergens gelezen, en een
  // nieuw record begint met een verse teller (stelPinIn schrijft LEGE_POGINGEN).
  await wisEnControleer(SLEUTEL_POGINGEN);
  await bewaarBiometrieAan(false);
  return { soort: 'ok' };
}

// ---------- AsyncStorage: instellingen en hint ----------

function isTermijn(x: string): x is SlotTermijn {
  return (SLOT_TERMIJNEN as readonly string[]).includes(x);
}

// Onbekend of ontbrekend: STANDAARD_TERMIJN (1 min).
export async function laadTermijn(): Promise<SlotTermijn> {
  const t = await laadTekst(SLEUTELS.slotTermijn, STANDAARD_TERMIJN);
  return isTermijn(t) ? t : STANDAARD_TERMIJN;
}

export function bewaarTermijn(termijn: SlotTermijn): Promise<void> {
  return bewaarTekst(SLEUTELS.slotTermijn, termijn);
}

// 'true' of 'false', zoals bij SLEUTELS.slotBiometrie beschreven. Alles behalve 'true' is uit.
export async function laadBiometrieAan(): Promise<boolean> {
  return (await laadTekst(SLEUTELS.slotBiometrie, 'false')) === 'true';
}

export function bewaarBiometrieAan(aan: boolean): Promise<void> {
  return bewaarTekst(SLEUTELS.slotBiometrie, aan ? 'true' : 'false');
}

// De hint: alleen gebruikt als de kluis niet leesbaar is (bepaalSlotStatus, hintIngesteld).
// Dicht bij twijfel: een leesfout telt als "er is een pincode", want de hint uit betekent bij een
// kluisfout zonder koppeling 'open'. Opgeslagen als '1' of '0' (zoals laadVlag), maar met eigen
// foutafhandeling: laadVlag geeft bij een fout false, en dat is hier de verkeerde kant.
export async function laadHintIngesteld(): Promise<boolean> {
  try {
    const waarde = await AsyncStorage.getItem(SLEUTELS.slotIngesteld);
    if (waarde == null) return false;
    return waarde !== '0';
  } catch {
    return true;
  }
}

// true als de hint is weggeschreven. stelPinIn schrijft hem VOOR het record en stopt als dit
// false geeft: een record zonder hint zou bij een latere kluisfout als "nooit ingesteld" tellen.
export async function bewaarHintIngesteld(ingesteld: boolean): Promise<boolean> {
  try {
    await AsyncStorage.setItem(SLEUTELS.slotIngesteld, ingesteld ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}
