// Biometrie en schermslot via expo-local-authentication (zie BiometrieApi in vergrendelTypes.ts).
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
  PromptTekst,
} from './vergrendelTypes';

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

// niveauOnbekend: getEnrolledLevelAsync faalde. Dan weten we niet of er een schermslot is; het
// niveau valt terug op 'geen', maar herstelViaToestel behandelt dat niet als "geen schermslot".
async function meetBeschikbaarheid(): Promise<{
  b: BiometrieBeschikbaarheid;
  niveauOnbekend: boolean;
}> {
  let niveauOnbekend = false;
  const [hardware, ingeschreven, level] = await Promise.all([
    veilig(() => LocalAuthentication.hasHardwareAsync(), false),
    veilig(() => LocalAuthentication.isEnrolledAsync(), false),
    LocalAuthentication.getEnrolledLevelAsync().catch(() => {
      niveauOnbekend = true;
      return SecurityLevel.NONE;
    }),
  ]);
  const niveau = niveauNaam(level);
  return {
    b: { hardware, ingeschreven, toestelBeveiligd: niveau !== 'geen', niveau },
    niveauOnbekend,
  };
}

async function beschikbaarheid(): Promise<BiometrieBeschikbaarheid> {
  return (await meetBeschikbaarheid()).b;
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

async function herstelViaToestel(): Promise<HerstelUitkomst> {
  const uitkomst = await metPrompt<HerstelUitkomst>(async () => {
    try {
      // Vooraf kijken: zonder schermslot geeft de prompt toch niets om te bevestigen.
      const { b, niveauOnbekend } = await meetBeschikbaarheid();
      if (niveauOnbekend) return 'fout';
      if (!b.toestelBeveiligd) return 'geenSchermslot';
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: PROMPT_HERSTEL,
        cancelLabel: 'Annuleren',
        disableDeviceFallback: false,
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
        case 'not_enrolled':
        case 'passcode_not_set':
          return 'geenSchermslot';
        default:
          return 'fout';
      }
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
