// Het contract van de app-vergrendeling. Alleen types en constanten, geen logica: de engine
// (engine/pinCode.ts, engine/slotPogingen.ts, engine/herslot.ts), de native module
// (modules/kader-beveiliging), de opslag (state/slotOpslag.ts), de biometrie (state/biometrie.ts),
// de afdekking (state/afdekking.ts), de provider (state/VergrendelProvider.tsx) en de UI
// (components/slot/) bouwen hier allemaal tegen. Wijzig je hier iets, meld het dan: de andere
// stukken lopen anders uit de pas.
//
// Achtergrond en beslissingen: het plan "app-vergrendeling in Kader" en straks
// docs/vergrendeling-ontwerp.md. Kort: een 6-cijferige pincode plus toestelbiometrie, opt-in,
// verplicht zodra eToro gekoppeld is, herstel via het Android-schermslot, de app wist nooit iets.

// ---------- Termijn: hoe snel de app weer op slot gaat ----------

// Een vaste set strings in plaats van een getal in ms. Gekozen omdat de waarde zo letterlijk in
// AsyncStorage (SLEUTELS.slotTermijn) en in de SegmentKnop staat: een onbekende of oude waarde is
// dan te herkennen en valt terug op STANDAARD_TERMIJN, terwijl een los getal ongemerkt elke waarde
// zou toelaten. Reken altijd via TERMIJN_MS.
export type SlotTermijn = 'direct' | '30s' | '1m' | '5m' | '15m';

// De volgorde in Instellingen > Beveiliging > Opnieuw vergrendelen.
export const SLOT_TERMIJNEN: readonly SlotTermijn[] = ['direct', '30s', '1m', '5m', '15m'];

export const STANDAARD_TERMIJN: SlotTermijn = '1m';

// Tijd op de achtergrond waarna de app bij terugkomst vergrendelt. 'direct' is 0: vergrendelen
// gebeurt dan al bij het naar de achtergrond gaan, niet pas bij terugkomst.
export const TERMIJN_MS: Readonly<Record<SlotTermijn, number>> = {
  direct: 0,
  '30s': 30_000,
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
};

// Labels voor de SegmentKnop (copy uit het plan: Direct / 30 s / 1 min / 5 min / 15 min).
export const TERMIJN_LABEL: Readonly<Record<SlotTermijn, string>> = {
  direct: 'Direct',
  '30s': '30 s',
  '1m': '1 min',
  '5m': '5 min',
  '15m': '15 min',
};

// ---------- Pincode en opslag ervan ----------

// Aantal cijfers. Het slot ontgrendelt bij het zesde cijfer, zonder bevestigknop.
export const PIN_LENGTE = 6;

// Aantal PBKDF2-iteraties (SecretKeyFactory "PBKDF2WithHmacSHA256" in de native module). Gekozen
// op ongeveer 300 tot 500 ms per hash op de emulator, nooit onder 10.000 (de ondergrens van
// geldigeIteraties in engine/pinCode.ts en van de native module). Meting november 2026, debug-build,
// AVD kader (API 35, 2 vCPU), app stil na de marktscan, host-load 8 tot 10, emulator-load 4,5 tot
// 6,5: 10.000 iteraties mediaan 529 ms (min 303, max 1742, n=7); 20.000 mediaan 954 ms. Een snellere
// telefoon of een release-build kan later meer iteraties dragen: een record met minder iteraties
// dan de huidige waarde wordt na een geslaagde controle opnieuw gehasht (moetHerhashen), dus
// verhogen kan zonder migratie.
export const PBKDF2_ITERATIES = 10_000;

// Lengte van de salt in bytes (als hex dus twee keer zo lang).
export const PIN_SALT_BYTES = 16;

// Versie van het PinRecord-formaat. Ophogen alleen bij een wijziging die oude records breekt.
export const PIN_RECORD_VERSIE = 1;

// Wat in expo-secure-store staat onder 'kader_slot_pin'. Het slot staat aan zodra dit record
// bestaat; er is geen losse aan/uit-vlag die uit de pas kan lopen.
export interface PinRecord {
  // Formaatversie, zie PIN_RECORD_VERSIE.
  v: number;
  // Het hash-algoritme. Nu alleen PBKDF2 met HMAC-SHA256.
  alg: 'pbkdf2-sha256';
  // Aantal iteraties waarmee deze hash gemaakt is.
  it: number;
  // Salt als hex (kleine letters), PIN_SALT_BYTES bytes.
  salt: string;
  // Afgeleide sleutel als hex (kleine letters), 32 bytes.
  hash: string;
}

// De sleutelafleiding, geïnjecteerd zodat engine/pinCode.ts zonder native code te toetsen is (in
// Node met crypto.pbkdf2Sync, in de app met KaderBeveiligingModule.pbkdf2Sha256Hex). Geeft de
// afgeleide sleutel van 32 bytes als hex terug.
export type Kdf = (pin: string, saltHex: string, iteraties: number) => Promise<string>;

// Uitslag van de keuring van een nieuw gekozen pincode, nog voor het herhalen.
// 'ongeldig': niet precies PIN_LENGTE cijfers. 'zwak': zes gelijke cijfers, of een oplopende of
// aflopende reeks (123456, 987654).
export type PinKeuring = 'ok' | 'ongeldig' | 'zwak';

// ---------- Foute pogingen en wachttijd ----------

// Na zoveel foute pincodes op rij volgt de eerste wachttijd.
export const FOUTEN_VOOR_BLOKKADE = 5;

// De wachttrap: 30 s, 1 min, 5 min, 15 min, en daarna blijft het 15 min.
// Afspraak voor de trede: de 5e fout geeft trede 0 (30 s), de 6e trede 1 (1 min), de 7e trede 2
// (5 min), de 8e en elke volgende trede 3 (15 min). Dus na een afgelopen wachttijd is er telkens
// één poging tot de volgende wachttijd, zoals het Android-schermslot. Trede =
// min(fouten - FOUTEN_VOOR_BLOKKADE, WACHTTRAP_MS.length - 1). Een goede pincode zet alles terug.
export const WACHTTRAP_MS: readonly number[] = [30_000, 60_000, 5 * 60_000, 15 * 60_000];

// Eén meting van de klok. Een wachttijd moet een force-stop, het verzetten van de klok en een
// reboot overleven, dus de wandklok alleen is niet genoeg.
export interface KlokStand {
  // Monotone tijd in ms sinds het opstarten (Android elapsedRealtime). Loopt door in slaap en is
  // niet te verzetten, maar begint na een reboot opnieuw bij 0. Bij bron 'wand' gelijk aan wand.
  monotoon: number;
  // Hoeveelste keer het toestel is opgestart (Settings.Global.BOOT_COUNT), -1 als onbekend.
  // Verschilt hij van die in de blokkade, dan is monotoon niet meer vergelijkbaar.
  bootTeller: number;
  // Wandklok in ms (Date.now()). Alleen terugval: is te verzetten.
  wand: number;
  // 'monotoon' als de native module de monotone klok leverde, anders 'wand' (bijvoorbeeld in Node
  // of als de module ontbreekt).
  bron: 'monotoon' | 'wand';
}

// Een lopende wachttijd. Hoe je de resterende tijd bepaalt (uitgewerkt in engine/slotPogingen.ts):
// - zelfde bootTeller (en niet -1) en bron 'monotoon': resterend = totMonotoon - nu.monotoon;
// - anders (reboot, onbekende teller, geen monotone klok): resterend = resterendBijAnker - verstreken,
//   met verstreken = min(wandverschil sinds wandAnker, monotoon verschil sinds het anker). Het
//   monotone verschil is nu.monotoon - (totMonotoon - resterendBijAnker); bij een zekere herstart
//   (beide tellers bekend en verschillend) of een negatief verschil telt alleen nu.monotoon. Met
//   een monotone klok telt dat verschil ook als de wandklok is teruggezet; zonder monotone klok
//   wordt dan niets afgetrokken en wordt geherankerd (wandAnker = nu.wand, rest ongewijzigd).
//   Een vooruitgezette wandklok levert zo nooit winst op.
// - altijd geclampt op [0, duurMs]. Na een ONOPGEMERKTE reboot met dezelfde teller kan de
//   uitkomst langer zijn dan de echte rest: de wachttijd duurt dan langer, nooit korter.
// Na een herankering of een reboot schrijft de engine een vernieuwde Blokkade terug met de
// actuele klok, zodat de monotone klok weer leidend is.
export interface Blokkade {
  // Monotoon tijdstip (ms sinds boot) waarop de wachttijd afloopt.
  totMonotoon: number;
  // Opstartteller waarbij totMonotoon hoort, -1 als onbekend.
  bootTeller: number;
  // Wandkloktijd (ms) van het laatste anker.
  wandAnker: number;
  // Resterende wachttijd (ms) op het moment van wandAnker.
  resterendBijAnker: number;
  // Volledige duur van deze trede (ms), voor de weergave.
  duurMs: number;
}

// Wat in expo-secure-store staat onder 'kader_slot_pogingen'. Volgorde bij een poging: eerst
// fouten + 1 wegschrijven, dan pas verifiëren, zodat een app-kill midden in de controle geen
// gratis poging oplevert. Een goede pincode zet de stand terug naar LEGE_POGINGEN.
export interface PogingenStand {
  // Formaatversie, nu 1.
  v: number;
  // Foute pincodes op rij sinds de laatste goede. Telt door na een wachttijd.
  fouten: number;
  // De lopende of laatst opgelegde wachttijd, null als er nooit een was sinds het laatste succes.
  blokkade: Blokkade | null;
}

// Bevroren: een mutatie van deze gedeelde constante zou elke latere lege stand besmetten.
export const LEGE_POGINGEN: Readonly<PogingenStand> = Object.freeze({
  v: 1,
  fouten: 0,
  blokkade: null,
});

// ---------- Uitkomsten van opslag ----------

// Lezen uit de kluis kent drie uitkomsten, net als SleutelUitkomst in state/etoroSleutels.ts:
// "er staat niets" en "de kluis deed het niet" zijn verschillende verhalen. Een kluisfout betekent
// nooit "geen pincode": dat zou het slot openzetten.
export type LeesUitkomst<T> =
  | { soort: 'ja'; waarde: T }
  | { soort: 'nee' }
  | { soort: 'kluisfout'; bericht: string };

// Schrijven met teruglezen: pas 'ok' als de waarde terug te lezen is.
export type SchrijfUitkomst = { soort: 'ok' } | { soort: 'kluisfout'; bericht: string };

// ---------- Status van het slot ----------

// De status in de provider.
// - 'laden': koude start, de kluis is nog niet gelezen. De afdekking staat, er is nog niets te zien.
// - 'vergrendeld': er is een pincode en de app is op slot. Met kluisfout = true als de kluis niet
//   leesbaar was en de hint SLEUTELS.slotIngesteld zei dat er een pincode is (zie
//   VergrendelContextWaarde.kluisfout). Beslisregel bij een kluisfout (engine/herslot.ts,
//   bepaalSlotStatus met hintIngesteld): is er nooit een pincode ingesteld (hint SLEUTELS.slotIngesteld
//   uit) en is er geen eToro-koppeling, dan is er niets te beschermen en wordt de status 'open'. In
//   alle andere gevallen is het 'vergrendeld' met kluisfout = true; een kluisfout is nooit "geen
//   pincode".
// - 'open': ontgrendeld, of er is geen pincode en ook geen eToro-koppeling.
// - 'setupVerplicht': eToro is gekoppeld maar er is geen pincode (migratie van bestaande
//   gebruikers). Uitweg: pincode instellen of "Koppeling verwijderen".
export type SlotStatus = 'laden' | 'vergrendeld' | 'open' | 'setupVerplicht';

// Wat SlotScherm laat zien. SlotLaag leidt dit af uit de status en de lokale stap.
// - 'ontgrendelen': titel, stippen, toetsenbord, eventueel biometrie-toets en wachtstaat.
// - 'setupVerplicht': uitleg plus "Pincode instellen" en "Koppeling verwijderen".
// - 'herstel': na "Pincode vergeten?": inline uitleg, schermslot-prompt, dan een nieuwe pincode.
// - 'kluisfout': de kluis is niet leesbaar; uitleg en opnieuw proberen, geen invoer.
// - 'afdekken': alleen het merkvlak, zonder invoer (koude start voor 'laden' klaar is, en bij
//   terugkomst tot de slot-Modal getoond is).
export type SlotStand = 'ontgrendelen' | 'setupVerplicht' | 'herstel' | 'kluisfout' | 'afdekken';

// ---------- Biometrie ----------

// Wat het toestel kan, uit expo-local-authentication (getEnrolledLevelAsync, hasHardwareAsync,
// isEnrolledAsync). Kader vraagt altijd biometricsSecurityLevel 'weak'.
export interface BiometrieBeschikbaarheid {
  // Er is een vingerafdruk- of gezichtsscanner (hasHardwareAsync).
  hardware: boolean;
  // Er is een vingerafdruk of gezicht ingeschreven (isEnrolledAsync).
  ingeschreven: boolean;
  // De telefoon heeft een schermslot (pincode, patroon, wachtwoord): niveau is niet 'geen'.
  // Zonder schermslot kan er geen pincode worden ingesteld en werkt herstel niet.
  toestelBeveiligd: boolean;
  // SecurityLevel uit expo: NONE (0) 'geen', SECRET (1) 'geheim', BIOMETRIC_WEAK (2)
  // 'biometrieZwak', BIOMETRIC_STRONG (3) 'biometrieSterk'.
  niveau: BeveiligingsNiveau;
}

export type BeveiligingsNiveau = 'geen' | 'geheim' | 'biometrieZwak' | 'biometrieSterk';

// Uitkomst van een biometrische prompt (vraagBiometrie, met disableDeviceFallback: true).
// Afbeelding vanuit LocalAuthenticationError (expo-local-authentication 56.0.5, Android, gecontroleerd
// in LocalAuthenticationModule.kt):
// - success: true                                    -> 'ok'
// - 'user_cancel' (ook de negatieve knop "Gebruik pincode", ERROR_CANCELED en cancelAuthenticate),
//   'system_cancel', 'app_cancel', 'user_fallback'    -> 'geannuleerd'
//   Let op: 'app_cancel' komt op Android ook als er al een prompt loopt; biometrie.ts voorkomt dat
//   door één prompt tegelijk toe te laten.
// - 'authentication_failed'                          -> 'nietHerkend'
//   Op Android sluit een niet-herkende vinger de prompt niet; het systeem laat opnieuw proberen.
// - 'lockout'                                        -> 'tijdelijkGeblokkeerd'
//   Expo zet ERROR_LOCKOUT en ERROR_LOCKOUT_PERMANENT allebei om naar 'lockout'. 'permanentGeblokkeerd'
//   is dus niet rechtstreeks te zien; biometrie.ts mag het afleiden (bijvoorbeeld een nieuwe
//   'lockout' direct bij het openen van de prompt), anders blijft het 'tijdelijkGeblokkeerd'.
// - 'not_enrolled' (op Android: geen schermslot, warning "KeyguardManager#isDeviceSecure() returned
//   false"), en 'not_available' terwijl een nieuwe beschikbaarheid() geen ingeschreven biometrie
//   meer ziet                                         -> 'uitgeschakeld'
// - 'not_available' bij nog wel ingeschreven biometrie (hardware tijdelijk weg), 'passcode_not_set',
//   'invalid_context'                                 -> 'nietBeschikbaar'
// - 'timeout', 'unable_to_process', 'no_space', 'unknown', een afgewezen promise -> 'fout'
export type BiometrieUitkomst =
  | 'ok'
  | 'geannuleerd'
  | 'nietHerkend'
  | 'tijdelijkGeblokkeerd'
  | 'permanentGeblokkeerd'
  | 'uitgeschakeld'
  | 'nietBeschikbaar'
  | 'fout';

// De statusregel op het slotscherm na een mislukte biometrische poging (copy uit het plan).
// 'ok' en 'geannuleerd' tonen niets.
export const BIOMETRIE_MELDING: Readonly<Partial<Record<BiometrieUitkomst, string>>> = {
  nietHerkend: 'Niet herkend. Gebruik je pincode.',
  tijdelijkGeblokkeerd: 'Biometrie is tijdelijk geblokkeerd. Gebruik je pincode.',
  permanentGeblokkeerd: 'Biometrie is geblokkeerd door je telefoon. Gebruik je pincode.',
  uitgeschakeld: 'Biometrie staat uit op je telefoon. Gebruik je pincode.',
  nietBeschikbaar: 'Biometrie staat uit op je telefoon. Gebruik je pincode.',
  fout: 'Niet herkend. Gebruik je pincode.',
};

// Uitkomst van "Pincode vergeten?": de schermslot-prompt (disableDeviceFallback: false).
// 'geenSchermslot': de telefoon heeft geen schermslot meer (vooraf gezien via beschikbaarheid(),
// of expo gaf 'not_enrolled'/'passcode_not_set'). Copy: "Stel eerst weer een schermslot in op je
// telefoon, dan kun je je pincode herstellen."
export type HerstelUitkomst = 'ok' | 'geannuleerd' | 'geenSchermslot' | 'fout';

// Teksten voor een biometrische prompt.
export interface PromptTekst {
  // Titel (promptMessage), bijvoorbeeld 'Ontgrendel Kader' of 'Bevestig je order'.
  titel: string;
  // Regel eronder (promptSubtitle), bijvoorbeeld 'Koop BTC, € 100. Echt geld.'.
  ondertitel?: string;
  // Tekst op de annuleerknop (cancelLabel), standaard 'Gebruik pincode'.
  annuleerLabel?: string;
}

// De publieke kant van state/biometrie.ts. Er is altijd hooguit één prompt tegelijk.
export interface BiometrieApi {
  beschikbaarheid(): Promise<BiometrieBeschikbaarheid>;
  // Biometrie zonder terugval op het schermslot; de pincode is de terugval in Kader zelf.
  vraagBiometrie(tekst: PromptTekst): Promise<BiometrieUitkomst>;
  // Schermslot (of biometrie) van het toestel, voor "Pincode vergeten?". Prompt: 'Bevestig dat
  // jij het bent'.
  herstelViaToestel(): Promise<HerstelUitkomst>;
  // Loopt er nu een prompt (biometrie of schermslot)? Dan beslist AppState 'active' nog niet over
  // hervergrendelen.
  promptBezig(): boolean;
  // Roept cb één keer aan zodra de lopende prompt klaar is (meteen als er geen loopt). Geeft een
  // functie terug die het wachten afzegt. Een tweede prompt terwijl er een loopt geeft direct
  // 'geannuleerd' (vraagBiometrie, herstelViaToestel).
  opPromptKlaar(cb: () => void): () => void;
  // Noodklep voor een prompt die nooit afrondt: annuleert hem, zet promptBezig() terug en meldt de
  // wachtende opPromptKlaar-callbacks één keer. Komt de oude belofte alsnog terug, dan geeft die
  // 'geannuleerd'. De provider roept dit aan als de app uit 'background' terugkomt terwijl er nog
  // een prompt 'bezig' is.
  forceerPromptKlaar(): Promise<void>;
}

// ---------- Afdekking (Recente apps en geen inhoudsflits) ----------

// De publieke kant van state/afdekking.ts, een externe store voor useSyncExternalStore.
// Begint op true: bij een koude start is de inhoud afgedekt tot het slot getoond is of de status
// 'open' is.
export interface AfdekkingStore {
  isAfgedekt(): boolean;
  zetAfgedekt(afgedekt: boolean): void;
  // Geeft een functie terug die het abonnement opzegt.
  abonneer(luisteraar: () => void): () => void;
}
// Daarnaast exporteert afdekking.ts de hook: useAfgedekt(): boolean.

// ---------- Native module kader-beveiliging ----------

// app/modules/kader-beveiliging (Kotlin, lokale Expo-module). expo-crypto heeft geen PBKDF2 en JS
// heeft geen monotone klok die een force-stop overleeft; daarom deze module.
export interface KaderBeveiligingModule {
  // PBKDF2-HMAC-SHA256, 32 bytes uitvoer, als hex (kleine letters). Draait buiten de UI-thread.
  // De pincode gaat als UTF-8 de functie in; saltHex wordt als bytes gelezen, niet als tekst.
  pbkdf2Sha256Hex(pin: string, saltHex: string, iteraties: number): Promise<string>;
  // SystemClock.elapsedRealtime() in ms: monotoon, loopt door in slaap, reset bij reboot.
  monotoneTijd(): number;
  // Settings.Global.BOOT_COUNT, -1 als het toestel hem niet geeft.
  opstartTeller(): number;
  // Cryptografisch willekeurige bytes (SecureRandom) als hex, bytes * 2 tekens.
  willekeurigeHex(bytes: number): string;
  // Activity.setRecentsScreenshotEnabled(toestaan) op API 33 en hoger, anders niets.
  // false zolang het slot aan staat, zodat Recente apps geen saldo laat zien.
  zetRecentsAfbeelding(toestaan: boolean): void;
}

// ---------- Uitkomsten van de provider ----------

// Uitkomst van een ingevoerde pincode (ontgrendelen, huidige pincode bij wijzigen of uitzetten,
// pincode als terugval bij een order). Elke foute pincode telt mee in dezelfde teller.
export type PinUitkomst =
  | { soort: 'ok' }
  // fouten: foute pogingen op rij. resterendTotBlokkade: pogingen tot de eerstvolgende wachttijd
  // (0 betekent dat deze fout de wachttijd startte; dan volgt ook een 'geblokkeerd'-stand in de
  // context). Copy: bij 1 en 2 fouten 'Onjuiste pincode.', bij 3 'Onjuiste pincode. Nog 2
  // pogingen.', bij 4 'Onjuiste pincode. Nog 1 poging.'
  | { soort: 'fout'; fouten: number; resterendTotBlokkade: number }
  // Er loopt een wachttijd; de invoer is niet gecontroleerd en telt niet mee.
  | { soort: 'geblokkeerd'; resterendMs: number }
  | { soort: 'kluisfout'; bericht: string };

// Uitkomst van een nieuwe pincode opslaan (stelPinIn, wijzigPin).
// 'geweigerd': mag nu niet (er is al een pincode en er was geen herstel of wijziging bevestigd).
export type InstelUitkomst =
  | { soort: 'ok' }
  | { soort: 'ongeldig' }
  | { soort: 'zwak' }
  | { soort: 'geweigerd' }
  | { soort: 'kluisfout'; bericht: string };

// Uitkomst van wijzigPin: eerst wordt de huidige pincode gecontroleerd (telt mee in de teller).
export type WijzigUitkomst = InstelUitkomst | Exclude<PinUitkomst, { soort: 'ok' }>;

// Uitkomst van zetSlotUit. 'etoroGekoppeld': uitzetten mag niet zolang er een eToro-koppeling is.
export type UitzetUitkomst =
  | { soort: 'ok' }
  | { soort: 'etoroGekoppeld' }
  | Exclude<PinUitkomst, { soort: 'ok' }>;

// Waarom de pincode-instellen-flow geopend wordt via vraagPinInstellen().
// - 'optIn': onboarding of Instellingen > Beveiliging > App vergrendelen.
// - 'etoro': vanuit de koppelwizard (die gebruikt PinInstellenInhoud wel inline).
// - 'nieuwInKader': de knop in "Nieuw in Kader".
// - 'wijzigen': Instellingen > Beveiliging > Pincode wijzigen (eerst de huidige pincode).
export type VraagPinReden = 'optIn' | 'etoro' | 'nieuwInKader' | 'wijzigen';

// Alle situaties waarin PinInstellenInhoud getoond wordt: de redenen hierboven plus de twee vanuit
// het slotscherm zelf ('herstel' na "Pincode vergeten?", 'setupVerplicht' bij de migratie).
export type PinInstelReden = VraagPinReden | 'herstel' | 'setupVerplicht';

// Waarvoor de identiteit bevestigd wordt. Nu alleen een echte order.
export type BevestigReden = 'order';

export interface BevestigOpties {
  // Ondertitel van de prompt, bijvoorbeeld 'Koop BTC, € 100. Echt geld.' (copy:
  // '{Koop|Verkoop} {SYMBOOL}, {bedrag}. Echt geld.').
  detail?: string;
  // true: sla de biometrie over en vraag meteen de pincode (de knop 'Bevestig met pincode' na
  // annuleren). Zonder biometrie (uit of niet beschikbaar) wordt het altijd de pincode.
  alleenPincode?: boolean;
}

// Uitkomst van bevestigIdentiteit. 'geannuleerd' dekt ook: geen pincode ingesteld meer, wachttijd
// loopt, of de app ging in de tussentijd op slot. De aanroeper verstuurt alleen bij 'ok', en alleen
// als hij nog gemount is en de status 'open' is.
export type BevestigUitkomst = 'ok' | 'geannuleerd';

// Resterende wachttijd voor de weergave (aftelling m:ss), door de provider elke seconde ververst
// zolang er een wachttijd loopt.
export interface BlokkadeWeergave {
  resterendMs: number;
  duurMs: number;
}

// ---------- De provider: useVergrendeling() ----------

// De waarde van de VergrendelContext. VergrendelProvider.tsx exporteert:
//   useVergrendeling(): VergrendelContextWaarde
//   useNaSlot(zichtbaar: boolean): boolean
// useNaSlot geeft voor een Modal-wrapper (PodiumScherm, BottomSheet, KaderDialoog, SysteemMenu,
// WelkomFeest) terug of hij nu zichtbaar mag zijn: wat al open was blijft true (blijft onder het slot
// staan en houdt zijn state), wat wil openen terwijl de status niet 'open' is wacht tot 'open'.
export interface VergrendelContextWaarde {
  status: SlotStatus;
  // Alleen true bij status 'vergrendeld': de kluis was niet leesbaar, dus de pincode kan nu niet
  // gecontroleerd worden. SlotScherm toont stand 'kluisfout'.
  kluisfout: boolean;
  // Er staat een pincode-record in de kluis (bij een kluisfout: volgens de hint).
  pincodeIngesteld: boolean;
  // Er is een eToro-koppeling. Dan is het slot verplicht en kan het niet uit.
  etoroGekoppeld: boolean;
  // De gebruiker wil biometrie (SLEUTELS.slotBiometrie). Effectief alleen als biometrieBeschikbaar
  // ook bruikbaar is; zie biometrieBruikbaar.
  biometrieAan: boolean;
  // Laatst gemeten mogelijkheden van het toestel, null zolang nog niet gemeten. Wordt opnieuw
  // gemeten bij elke terugkomst naar de voorgrond (iemand kan zijn vingerafdruk verwijderd hebben).
  biometrieBeschikbaar: BiometrieBeschikbaarheid | null;
  // biometrieAan && hardware && ingeschreven: toon de biometrie-toets en gebruik biometrie bij orders.
  biometrieBruikbaar: boolean;
  termijn: SlotTermijn;
  // De lopende wachttijd, null als er geen loopt.
  blokkade: BlokkadeWeergave | null;

  // Controleert de pincode en opent bij 'ok' de app. Telt mee in de teller.
  ontgrendelMetPin(pin: string): Promise<PinUitkomst>;
  // Biometrische prompt 'Ontgrendel Kader' / 'Gebruik pincode'; opent bij 'ok' de app. Werkt ook
  // tijdens een wachttijd. Telt niet mee in de pincode-teller.
  ontgrendelMetBiometrie(): Promise<BiometrieUitkomst>;
  // "Pincode vergeten?": schermslot-prompt. Bij 'ok' mag stelPinIn() het bestaande record
  // overschrijven (eenmalig, tot het slot weer wordt opgebouwd); de teller gaat dan terug naar nul.
  // Werkt ook tijdens een wachttijd. De app wist nooit iets.
  herstelViaToestel(): Promise<HerstelUitkomst>;
  // Slaat een nieuwe pincode op (met teruglezen) en zet de hint SLEUTELS.slotIngesteld. Mag
  // zonder bestaand record, of na een geslaagd herstel; anders 'geweigerd' (gebruik wijzigPin).
  // Bij status 'setupVerplicht' of na herstel wordt de status daarna 'open'.
  stelPinIn(pin: string): Promise<InstelUitkomst>;
  // Controleert de huidige pincode zonder iets te veranderen, voor de eerste stap van wijzigen en
  // uitzetten. Telt mee in de teller; een goede zet de teller terug.
  controleerHuidigePin(pin: string): Promise<PinUitkomst>;
  // Controleert oud opnieuw en vervangt dan het record.
  wijzigPin(oud: string, nieuw: string): Promise<WijzigUitkomst>;
  // Verwijdert het pincode-record, de pogingen en de hint. Weigert met 'etoroGekoppeld' zolang er
  // een eToro-koppeling is.
  zetSlotUit(pin: string): Promise<UitzetUitkomst>;
  // Aanzetten vraagt eerst een prompt ('Zet biometrie aan voor Kader' / 'Bevestig met je
  // vingerafdruk of gezicht.') en bewaart alleen bij 'ok'. Uitzetten geeft altijd 'ok'.
  zetBiometrie(aan: boolean): Promise<BiometrieUitkomst>;
  zetTermijn(termijn: SlotTermijn): Promise<void>;
  // Extra bevestiging voor een echte order: biometrie ('Bevestig je order' + detail), met de
  // pincode als terugval via de PinVraagSheet in SlotLaag. Demo roept dit niet aan.
  bevestigIdentiteit(reden: BevestigReden, opties?: BevestigOpties): Promise<BevestigUitkomst>;
  // Opent de PinInstellenSheet (met biometrie-aanbod, behalve bij 'wijzigen'). Lost op met true
  // als er na afloop een pincode is ingesteld (of gewijzigd), false bij annuleren.
  vraagPinInstellen(reden: VraagPinReden): Promise<boolean>;
  // Kader opent zelf een systeemscherm dat de app naar de achtergrond duwt (share-sheet, de
  // schermslot-activity onder API 30). Zolang aan: AppState 'background' vergrendelt niet.
  // Altijd weer uitzetten, ook bij een fout (finally).
  meldEigenSysteemScherm(aan: boolean): void;
  // De uitweg bij 'setupVerplicht' (na de inline bevestiging): wisSleutels(), omgeving terug naar
  // demo, status 'open'.
  verwijderKoppelingEnOpen(): Promise<void>;
  // Bij een kluisfout: de kluis opnieuw lezen en de status opnieuw bepalen.
  opnieuwProberen(): Promise<void>;
}

// ---------- Props van gedeelde UI-stukken ----------

// PinInstellenInhoud (components/slot/PinInstellen.tsx) staat inline in SlotScherm, in de
// PinInstellenSheet en in de koppelwizard. Hij praat niet zelf met de provider, zodat hij ook
// zonder provider te bouwen en te tonen is; de plek die hem toont geeft de functies mee.
export interface PinInstellenInhoudProps {
  reden: PinInstelReden;
  // Keuring van de gekozen pincode na zes cijfers in stap 1 (isGeldigePin/isZwakkePin uit
  // engine/pinCode.ts). Bij 'zwak': 'Die pincode is te makkelijk te raden. Kies een andere.'
  keurPin(pin: string): PinKeuring;
  // Alleen bij 'wijzigen': de huidige pincode controleren voor de nieuwe gekozen wordt.
  onControleerHuidige?(pin: string): Promise<PinUitkomst>;
  // Slaat de nieuwe pincode op. Bij 'wijzigen' komt de eerder gecontroleerde huidige mee.
  onOpslaan(nieuw: string, huidige?: string): Promise<InstelUitkomst | WijzigUitkomst>;
  // false: blokkeer met 'Stel eerst een schermslot in' en de uitleg uit het plan.
  toestelBeveiligd: boolean;
  // Biometrie-aanbod na het instellen ('Zet biometrie aan' / 'Niet nu'). null: geen aanbod
  // (bij 'wijzigen', of als er geen biometrie is ingeschreven).
  biometrieAanbod: { onZetAan(): Promise<BiometrieUitkomst> } | null;
  // Klaar: pincode staat (en het aanbod is afgehandeld).
  onKlaar(): void;
  // Afbreken zonder iets op te slaan. Ontbreekt bij 'herstel'-zonder-terug of waar de plek zelf
  // een terugknop heeft.
  onAnnuleer?(): void;
}

// SlotScherm (components/slot/SlotScherm.tsx) is presentatief: SlotLaag geeft de stand en de
// functies van de provider mee. De terugknop roept BackHandler.exitApp() aan (SlotScherm zelf).
export interface SlotSchermProps {
  stand: SlotStand;
  // Toon de biometrie-toets links onder in het toetsenbord.
  biometrieToets: boolean;
  // Open de biometrische prompt automatisch, 350 ms nadat dit true wordt. SlotLaag zet het op true
  // in onShow van zijn Modal, eenmaal per slot-episode; daarna alleen via de toets.
  autoBiometrie: boolean;
  blokkade: BlokkadeWeergave | null;
  onPin(pin: string): Promise<PinUitkomst>;
  onBiometrie(): Promise<BiometrieUitkomst>;
  // "Pincode vergeten?" > Doorgaan.
  onHerstel(): Promise<HerstelUitkomst>;
  // Na 'herstel' of bij 'setupVerplicht': de inline PinInstellenInhoud krijgt deze props mee
  // (zonder reden; SlotScherm vult 'herstel' of 'setupVerplicht' zelf in).
  pinInstellen: Omit<PinInstellenInhoudProps, 'reden'>;
  // 'setupVerplicht' > Koppeling verwijderen > bevestigd.
  onKoppelingVerwijderen(): Promise<void>;
  // 'kluisfout' > opnieuw proberen.
  onOpnieuwProberen(): Promise<void>;
}
// De Modal zelf (en dus onShow, waarna de afdekking weg gaat en de splash verdwijnt) hoort bij
// SlotLaag, niet bij SlotScherm.
