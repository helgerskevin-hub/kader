// Biometrie via expo-local-authentication en het schermslot via de eigen native module
// kader-beveiliging (zie BiometrieApi in vergrendelTypes.ts).
//
// Herstel ("Pincode vergeten?") loopt bewust NIET via expo: authenticateAsync met
// disableDeviceFallback: false maakt er BIOMETRIC_WEAK | DEVICE_CREDENTIAL van, en dan zou een
// zwakke gezichtsherkenning genoeg zijn om een nieuwe pincode te kiezen. Besluit 6 is herstel via
// het schermslot, dus bevestigSchermslot staat alleen DEVICE_CREDENTIAL toe.
//
// Keuze bij gelijktijdige prompts: er loopt hooguit één prompt. Een tweede aanroep terwijl er een
// loopt wacht niet en hergebruikt de lopende belofte ook niet (een biometrie-prompt en een
// schermslot-prompt betekenen iets anders), maar geeft direct 'geannuleerd'. Zo krijgt Android
// nooit een tweede authenticate-aanroep (dat geeft 'app_cancel' en sluit de lopende prompt).
//
// Permanent geblokkeerd is niet betrouwbaar te zien: expo geeft voor tijdelijke en permanente
// blokkade allebei 'lockout'. Daarom geeft vraagBiometrie altijd 'tijdelijkGeblokkeerd'; de
// uitkomst 'permanentGeblokkeerd' blijft in het contract voor het geval expo ze ooit scheidt.

import * as LocalAuthentication from 'expo-local-authentication';
import { SecurityLevel } from 'expo-local-authentication';
import type {
  BeveiligingsNiveau,
  BiometrieApi,
  BiometrieBeschikbaarheid,
  BiometrieUitkomst,
  HerstelUitkomst,
  KaderBeveiligingModule,
  PromptTekst,
} from './vergrendelTypes';

// In een try, zoals in slotOpslag.ts: zonder gelinkte module (Node, een oude build) geeft herstel
// 'fout', nooit 'ok'.
let natief: KaderBeveiligingModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  natief = (require('../../modules/kader-beveiliging') as { default: KaderBeveiligingModule }).default;
} catch {
  natief = null;
}

const STANDAARD_ANNULEER_LABEL = 'Gebruik pincode';

// Prompt-copy uit het plan (copy-bijlage).
export const PROMPT_ONTGRENDEL: PromptTekst = {
  titel: 'Ontgrendel Kader',
  annuleerLabel: STANDAARD_ANNULEER_LABEL,
};
export const PROMPT_BIOMETRIE_AAN: PromptTekst = {
  titel: 'Zet biometrie aan voor Kader',
  ondertitel: 'Bevestig met je vingerafdruk of gezicht.',
  annuleerLabel: 'Niet nu',
};
export const PROMPT_ORDER: PromptTekst = {
  titel: 'Bevestig je order',
  annuleerLabel: STANDAARD_ANNULEER_LABEL,
};
const PROMPT_HERSTEL = 'Bevestig dat jij het bent';

// ---------- Eén prompt tegelijk ----------

let bezig = false;
// Telt prompts. Na forceerPromptKlaar hoort een nog lopende belofte bij een oud nummer en mag hij
// de status van een nieuwere prompt niet meer aanraken.
let promptNummer = 0;
const klaarLuisteraars = new Set<() => void>();

// Draait een prompt als er geen loopt; anders null. Meldt de wachtende luisteraars na afloop.
// Is de prompt ondertussen geforceerd afgesloten, dan geeft hij verlopen terug (de aanroeper maakt
// daar 'geannuleerd' van).
async function metPrompt<T>(werk: () => Promise<T>): Promise<T | null> {
  if (bezig) return null;
  bezig = true;
  const nummer = ++promptNummer;
  try {
    const r = await werk();
    return nummer === promptNummer ? r : null;
  } finally {
    if (nummer === promptNummer) {
      bezig = false;
      meldPromptKlaar();
    }
  }
}

// Roept de wachtende callbacks precies één keer aan en leegt de lijst.
function meldPromptKlaar(): void {
  const wachtend = [...klaarLuisteraars];
  klaarLuisteraars.clear();
  for (const cb of wachtend) {
    try {
      cb();
    } catch {
      // Een falende luisteraar mag de rest niet tegenhouden.
    }
  }
}

// Noodklep voor een prompt die nooit afrondt (expo resolvet soms niet). De provider roept dit aan
// als de app uit 'background' terugkomt terwijl promptBezig() nog true is. Een lopende belofte die
// alsnog terugkomt geeft 'geannuleerd' en raakt een nieuwere prompt niet aan.
async function forceerPromptKlaar(): Promise<void> {
  if (!bezig) return;
  promptNummer++;
  bezig = false;
  try {
    await LocalAuthentication.cancelAuthenticate();
  } catch {
    // Geen prompt meer om te annuleren of de module weigert: niets aan te doen.
  }
  try {
    await natief?.annuleerSchermslot();
  } catch {
    // Idem voor de schermslot-bevestiging.
  }
  meldPromptKlaar();
}

function waarschuwAppCancel(): void {
  if (__DEV__) console.warn('[biometrie] app_cancel: er liep al een prompt of de app sloot hem zelf.');
}

function promptBezig(): boolean {
  return bezig;
}

// Roept cb één keer aan zodra de lopende prompt klaar is, of meteen als er geen loopt. Geeft een
// functie terug die de aanroep annuleert (no-op als hij al gedaan is).
function opPromptKlaar(cb: () => void): () => void {
  if (!bezig) {
    cb();
    return () => {};
  }
  let gedaan = false;
  const eenmalig = () => {
    if (gedaan) return;
    gedaan = true;
    cb();
  };
  klaarLuisteraars.add(eenmalig);
  return () => {
    gedaan = true;
    klaarLuisteraars.delete(eenmalig);
  };
}

// ---------- Beschikbaarheid ----------

function niveauNaam(niveau: SecurityLevel): BeveiligingsNiveau {
  if (niveau === SecurityLevel.BIOMETRIC_STRONG) return 'biometrieSterk';
  if (niveau === SecurityLevel.BIOMETRIC_WEAK) return 'biometrieZwak';
  if (niveau === SecurityLevel.SECRET) return 'geheim';
  return 'geen';
}

// Elke native aanroep apart afgevangen: een falende aanroep telt als "niet beschikbaar" en geeft
// nooit een exception door.
async function veilig<T>(werk: () => Promise<T>, terugval: T): Promise<T> {
  try {
    return await werk();
  } catch {
    return terugval;
  }
}

async function beschikbaarheid(): Promise<BiometrieBeschikbaarheid> {
  const [hardware, ingeschreven, level] = await Promise.all([
    veilig(() => LocalAuthentication.hasHardwareAsync(), false),
    veilig(() => LocalAuthentication.isEnrolledAsync(), false),
    veilig(() => LocalAuthentication.getEnrolledLevelAsync(), SecurityLevel.NONE),
  ]);
  const niveau = niveauNaam(level);
  return { hardware, ingeschreven, toestelBeveiligd: niveau !== 'geen', niveau };
}

// ---------- Prompts ----------

async function vraagBiometrie(tekst: PromptTekst): Promise<BiometrieUitkomst> {
  const uitkomst = await metPrompt<BiometrieUitkomst>(async () => {
    try {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: tekst.titel,
        promptSubtitle: tekst.ondertitel,
        cancelLabel: tekst.annuleerLabel ?? STANDAARD_ANNULEER_LABEL,
        disableDeviceFallback: true,
        biometricsSecurityLevel: 'weak',
      });
      if (r.success) return 'ok';
      switch (r.error) {
        case 'app_cancel':
          waarschuwAppCancel();
          return 'geannuleerd';
        case 'user_cancel':
        case 'system_cancel':
        case 'user_fallback':
          return 'geannuleerd';
        case 'authentication_failed':
          return 'nietHerkend';
        case 'lockout':
          return 'tijdelijkGeblokkeerd';
        case 'not_enrolled':
          return 'uitgeschakeld';
        case 'not_available': {
          const b = await beschikbaarheid();
          return b.hardware && b.ingeschreven ? 'nietBeschikbaar' : 'uitgeschakeld';
        }
        case 'passcode_not_set':
        case 'invalid_context':
          return 'nietBeschikbaar';
        default:
          return 'fout';
      }
    } catch {
      return 'fout';
    }
  });
  return uitkomst ?? 'geannuleerd';
}

const HERSTEL_UITKOMSTEN: readonly HerstelUitkomst[] = ['ok', 'geannuleerd', 'geenSchermslot', 'fout'];

// Alleen het schermslot (zie bovenaan). Of er een schermslot is, beslist de native kant
// (KeyguardManager.isDeviceSecure); een onbekend antwoord telt als 'fout'.
async function herstelViaToestel(): Promise<HerstelUitkomst> {
  const uitkomst = await metPrompt<HerstelUitkomst>(async () => {
    if (!natief) return 'fout';
    try {
      const r: unknown = await natief.bevestigSchermslot(PROMPT_HERSTEL);
      return HERSTEL_UITKOMSTEN.includes(r as HerstelUitkomst) ? (r as HerstelUitkomst) : 'fout';
    } catch {
      return 'fout';
    }
  });
  return uitkomst ?? 'geannuleerd';
}

export const biometrie: BiometrieApi = {
  beschikbaarheid,
  vraagBiometrie,
  herstelViaToestel,
  promptBezig,
  opPromptKlaar,
  forceerPromptKlaar,
};

export { beschikbaarheid, vraagBiometrie, herstelViaToestel, promptBezig, opPromptKlaar, forceerPromptKlaar };
