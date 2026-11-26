// De app-vergrendeling: status, AppState-logica en alle acties uit het contract
// (VergrendelContextWaarde in vergrendelTypes.ts). De rekenregels zitten in de engine
// (pinCode, slotPogingen, herslot), de opslag in slotOpslag.ts, de prompts in biometrie.ts en de
// afdekking in afdekking.ts. De UI (SlotLaag, SlotScherm) is presentatief en leest via
// useVergrendeling() en het interne useSlotIntern().
//
// Plek in de boom: ThemeProvider > VergrendelProvider > MarktProvider > ... (boven DialoogProvider:
// het slot gebruikt nooit toonDialoog). SlotLaag hoort er één keer binnen te staan.
//
// Drie regels die overal terugkomen:
// - Een kluisfout is nooit "geen pincode". Twijfel valt altijd de veilige kant op (vergrendelen).
// - Bij een poging eerst fouten + 1 wegschrijven, dan pas verifiëren: een app-kill midden in de
//   controle levert zo geen gratis poging op. Alles wat de teller of het record raakt loopt via
//   één rij (inRij), zodat twee pogingen elkaar nooit inhalen.
// - Er is geen listener op 'blur'. Die vuurt ook bij de meldingenbalk, bij sheets en bij een
//   biometrische prompt (API 30+), en zou de app dan steeds opnieuw vergrendelen.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  LEGE_POGINGEN,
  TERMIJN_MS,
  type BevestigOpties,
  type BevestigReden,
  type BevestigUitkomst,
  type BiometrieBeschikbaarheid,
  type BiometrieUitkomst,
  type BlokkadeWeergave,
  type HerstelUitkomst,
  type InstelUitkomst,
  type KlokStand,
  type PinInstellenInhoudProps,
  type PinKeuring,
  type PinRecord,
  type PinUitkomst,
  type PogingenStand,
  type SlotStatus,
  type SlotTermijn,
  type UitzetUitkomst,
  type VergrendelContextWaarde,
  type VraagPinReden,
  type WijzigUitkomst,
} from './vergrendelTypes';
import { controleerPin, isGeldigePin, isZwakkePin, maakPinRecord, moetHerhashen } from '../engine/pinCode';
import {
  herankerStand,
  pogingenTotBlokkade,
  registreerFout,
  registreerSucces,
  resterendeBlokkade,
} from '../engine/slotPogingen';
import { bepaalSlotStatus, moetHervergrendelen } from '../engine/herslot';
import {
  bewaarBiometrieAan,
  bewaarHintIngesteld,
  bewaarPinRecord,
  bewaarPogingen,
  bewaarTermijn,
  inSlotRij,
  kdf,
  klokNu,
  laadBiometrieAan,
  laadHintIngesteld,
  laadTermijn,
  leesPinRecord,
  leesPogingen,
  nieuweSalt,
  wisSlot,
  zetRecentsAfbeelding,
} from './slotOpslag';
import { biometrie, PROMPT_BIOMETRIE_AAN, PROMPT_ONTGRENDEL, PROMPT_ORDER } from './biometrie';
import { zetAfgedekt } from './afdekking';
import {
  MELDING_KOPPELING_NIET_WEG,
  opSleutelWijziging,
  sleutelUitkomst,
  wisSleutels,
  zetOmgeving,
} from './etoroSleutels';
import { tekenWidgetsNaSlotWijziging } from '../widget/widgetVerversen';
import { herplanDagelijkseMelding, verbergMeldingenMetInhoud } from '../notifications/meldingen';

// ---------- Splash ----------

// Zo vroeg mogelijk: dit bestand wordt bovenin App.tsx geïmporteerd, dus dit draait voor de eerste
// render (ook voor de fonts geladen zijn). De splash gaat pas weg na onShow van de slot-Modal of
// zodra de status 'open' is; anders flitst er inhoud voor het slot er ligt.
SplashScreen.preventAutoHideAsync().catch(() => {});

let splashWeg = false;
function verbergSplash(): void {
  if (splashWeg) return;
  splashWeg = true;
  SplashScreen.hideAsync().catch(() => {});
}

// Noodrem: blijft de kluis hangen of mount de provider nooit, dan toch weg. Veilig, want de
// afdekking (begint op true) houdt de inhoud dan nog steeds bedekt.
const SPLASH_NOODREM_MS = 8000;
setTimeout(verbergSplash, SPLASH_NOODREM_MS);

// ---------- Constanten ----------

// Tijd tussen het sluiten van de ene Modal en het openen van een andere. Twee Modals die in
// dezelfde tick van plek wisselen legden op Android de UI-thread plat (DialoogProvider.tsx:5-8).
export const MODAL_SPREIDING_MS = 300;

// Koude start: blijft de kluis langer dan dit hangen, dan 'vergrendeld' met kluisfout in plaats van
// eeuwig 'laden'. "Opnieuw proberen" leest daarna opnieuw (met dezelfde grens).
const LEES_TIJDSLIMIET_MS = 6000;

const MELDING_GEEN_PINCODE = 'Er staat geen pincode op dit toestel.';
const MELDING_NIET_VERGRENDELD = 'Kader is nu niet vergrendeld.';

// Copy voor de pincodevraag bij een order. Niet in de bijlage van het plan; de titel is die van het
// slot, de ondertitel is de orderregel van de prompt ('Koop BTC, € 100. Echt geld.').
const PINVRAAG_ORDER_TITEL = 'Voer je pincode in';
const PINVRAAG_ORDER_SUB = 'Om je order te bevestigen.';

// Onder API 30 opent de schermslot-bevestiging een eigen activity: de app gaat dan echt naar
// 'background'. Dat is Kaders eigen systeemscherm en mag het slot niet opnieuw laten vallen.
const SCHERMSLOT_IS_ACTIVITY =
  Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version < 30;

// ---------- Interne types (voor SlotLaag) ----------

// Hoe de app open ging. 'slot': met pincode of biometrie op het slotscherm; SlotLaag laat de
// Modal dan staan tot de ontgrendel-animatie klaar is (onWeg). 'anders': instellen afgerond,
// koppeling verwijderd, geen pincode; de Modal gaat meteen weg.
export type OpenVia = 'slot' | 'anders';

interface SlotStaat {
  status: SlotStatus;
  kluisfout: boolean;
  openVia: OpenVia | null;
  // Telt elke nieuwe vergrendeling, ook een hervergrendeling terwijl het slot al lag.
  episode: number;
}

export interface PinVraagVerzoek {
  id: number;
  titel: string;
  sub?: string;
  beginBlokkadeMs?: number;
  beginBlokkadeDuurMs?: number;
}

export interface PinInstellenVerzoek {
  id: number;
  props: Omit<PinInstellenInhoudProps, 'onKlaar' | 'onAnnuleer'>;
}

// Alleen voor SlotLaag. Niet gebruiken buiten components/slot.
export interface SlotIntern {
  episode: number;
  openVia: OpenVia | null;
  // Props voor de inline PinInstellenInhoud in SlotScherm (herstel en verplichte setup).
  slotInstellen: Omit<PinInstellenInhoudProps, 'reden'>;
  pinVraag: PinVraagVerzoek | null;
  pinVraagZichtbaar: boolean;
  pinVraagControleer(pin: string): Promise<PinUitkomst>;
  pinVraagKlaar(): void;
  pinVraagAnnuleer(): void;
  pinInstellen: PinInstellenVerzoek | null;
  pinInstellenZichtbaar: boolean;
  pinInstellenKlaar(): void;
  pinInstellenAnnuleer(): void;
  // SlotLaag meldt of zijn Modal gemount is; useNaSlot wacht tot hij even weg is.
  meldSlotZichtbaar(zichtbaar: boolean): void;
  // onShow van de slot-Modal (of een nieuwe episode terwijl hij al lag): afdekking uit, splash weg.
  slotGetoond(): void;
}

const VergrendelContext = createContext<VergrendelContextWaarde | null>(null);
const SlotInternContext = createContext<SlotIntern | null>(null);
// Alleen bevestigIdentiteit (stabiel). Voor providers die geen hertekening per seconde willen als de
// hoofdcontext tijdens een wachttijd aftelt (PortfolioProvider).
const IdentiteitContext = createContext<VergrendelContextWaarde['bevestigIdentiteit'] | null>(null);
// Klein en apart, zodat de vijf Modal-wrappers alleen hertekenen als dit verandert.
const NaSlotContext = createContext<{
  vrij: boolean;
  naVoorgrondBeslissing: (cb: () => void) => void;
} | null>(null);

// ---------- Hulpjes ----------

function keurPin(pin: string): PinKeuring {
  if (!isGeldigePin(pin)) return 'ongeldig';
  if (isZwakkePin(pin)) return 'zwak';
  return 'ok';
}

// Na Kaders eigen systeemscherm (share-sheet, schermslot-activity onder API 30) telt de termijn,
// maar nooit korter dan 1 min: een kort uitstapje naar de share-sheet vergrendelt dan niet, een
// lange afwezigheid wel.
function termijnNaEigenScherm(termijn: SlotTermijn): SlotTermijn {
  return TERMIJN_MS[termijn] >= TERMIJN_MS['1m'] ? termijn : '1m';
}

function metTijdslimiet<T>(belofte: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('De beveiligde opslag reageert niet op tijd.')), ms);
    belofte.then(
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

// Eén poging opnieuw bij een mislukte schrijfactie van de teller.
async function bewaarPogingenMetHerkansing(stand: PogingenStand) {
  const eerste = await bewaarPogingen(stand);
  return eerste.soort === 'ok' ? eerste : bewaarPogingen(stand);
}

// De volle duur van de lopende trede, voor de weergave; bij een kapotte blokkade de rest.
function blokkadeDuur(stand: PogingenStand, rest: number): number {
  const duur = stand.blokkade?.duurMs;
  return typeof duur === 'number' && Number.isFinite(duur) && duur >= rest ? duur : rest;
}

function kluisBericht(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'De beveiligde opslag van dit toestel reageert niet.';
}

// Een waarde in state plus een ref die altijd meteen bijgewerkt is, voor de async acties.
function useStaatMetRef<T>(begin: T): [T, React.MutableRefObject<T>, (nieuw: T) => void] {
  const [waarde, setWaarde] = useState<T>(begin);
  const ref = useRef<T>(begin);
  const zet = useCallback((nieuw: T) => {
    ref.current = nieuw;
    setWaarde(nieuw);
  }, []);
  return [waarde, ref, zet];
}

interface Achtergrond {
  sinds: KlokStand;
  // Kader opende zelf een systeemscherm (share-sheet, schermslot-activity onder API 30).
  viaEigenScherm: boolean;
  // Er liep een prompt toen de app naar de achtergrond ging.
  tijdensPrompt: boolean;
}

// ---------- Provider ----------

export function VergrendelProvider({ children }: { children: React.ReactNode }) {
  const [slot, slotRef, zetSlotStaat] = useStaatMetRef<SlotStaat>({
    status: 'laden',
    kluisfout: false,
    openVia: null,
    episode: 0,
  });
  const [pincodeIngesteld, pincodeRef, zetPincode] = useStaatMetRef(false);
  const [etoroGekoppeld, etoroRef, zetEtoro] = useStaatMetRef(false);
  const [biometrieAan, biometrieAanRef, zetBiometrieAanStaat] = useStaatMetRef(false);
  const [biometrieBeschikbaar, beschikbaarRef, zetBeschikbaar] =
    useStaatMetRef<BiometrieBeschikbaarheid | null>(null);
  const [termijn, termijnRef, zetTermijnStaat] = useStaatMetRef<SlotTermijn>('1m');
  const [blokkade, setBlokkade] = useState<BlokkadeWeergave | null>(null);
  const [slotBezet, setSlotBezet] = useState(false);

  const pogingenRef = useRef<PogingenStand>({ ...LEGE_POGINGEN });
  // Na een geslaagde schermslot-bevestiging mag stelPinIn het bestaande record overschrijven.
  // Vervalt bij elke nieuwe vergrendeling, bij openen en bij annuleren van het instellen.
  const herstelToegestaan = useRef(false);
  // In een slot-flow (herstel of verplichte setup) is een pincode opgeslagen: de app opent pas als
  // de flow is afgerond (klaar-stap, biometrie-aanbod), niet al bij het opslaan.
  const slotInstelOpgeslagen = useRef(false);
  const eigenSysteemScherm = useRef(false);
  const achtergrond = useRef<Achtergrond | null>(null);
  // Telt elke keer dat de app naar de achtergrond ging, voor bevestigIdentiteit.
  const achtergrondTeller = useRef(0);
  const wachtOpPrompt = useRef<(() => void) | null>(null);
  const slotBezetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const biometrieBruikbaar =
    biometrieAan && !!biometrieBeschikbaar?.hardware && !!biometrieBeschikbaar?.ingeschreven;
  const bruikbaarRef = useRef(false);
  bruikbaarRef.current = biometrieBruikbaar;

  // ---------- Rij ----------

  // De rij staat op moduleniveau in slotOpslag.ts, zodat bewaarSleutels (etoroSleutels.ts) in
  // dezelfde rij loopt als zetSlotUit.
  const inRij = inSlotRij;

  // ---------- Status ----------

  const zetSlot = useCallback(
    (deel: Partial<SlotStaat>) => zetSlotStaat({ ...slotRef.current, ...deel }),
    [slotRef, zetSlotStaat],
  );

  const open = useCallback(
    (via: OpenVia) => {
      herstelToegestaan.current = false;
      slotInstelOpgeslagen.current = false;
      zetSlot({ status: 'open', kluisfout: false, openVia: via });
    },
    [zetSlot],
  );

  // ---------- Blokkade-weergave ----------

  const werkBlokkadeBij = useCallback(() => {
    const stand = pogingenRef.current;
    const rest = resterendeBlokkade(stand, klokNu());
    if (rest <= 0) {
      setBlokkade(null);
      return;
    }
    setBlokkade({ resterendMs: rest, duurMs: blokkadeDuur(stand, rest) });
  }, []);

  const zetPogingen = useCallback(
    (stand: PogingenStand) => {
      pogingenRef.current = stand;
      werkBlokkadeBij();
    },
    [werkBlokkadeBij],
  );

  // Leest de teller, herankert hem op de actuele klok en schrijft dat terug als het nodig was.
  const actuelePogingen = useCallback(async (): Promise<PogingenStand | null> => {
    const p = await leesPogingen();
    if (p.soort === 'kluisfout') return null;
    const oud = p.soort === 'ja' ? p.waarde : { ...LEGE_POGINGEN };
    const nieuw = herankerStand(oud, klokNu());
    if (nieuw !== oud) await bewaarPogingen(nieuw);
    return nieuw;
  }, []);

  const blokkadeLoopt = blokkade !== null;
  useEffect(() => {
    if (!blokkadeLoopt) return;
    const t = setInterval(werkBlokkadeBij, 1000);
    return () => clearInterval(t);
  }, [blokkadeLoopt, werkBlokkadeBij]);

  // ---------- Biometrie meten ----------

  const meetBiometrie = useCallback(async (): Promise<BiometrieBeschikbaarheid> => {
    const b = await biometrie.beschikbaarheid();
    zetBeschikbaar(b);
    return b;
  }, [zetBeschikbaar]);

  // ---------- Pincodevraag (bevestigIdentiteit) ----------

  const [pinVraag, setPinVraag] = useState<PinVraagVerzoek | null>(null);
  const [pinVraagZichtbaar, setPinVraagZichtbaar] = useState(false);
  const pinVraagResolve = useRef<((u: BevestigUitkomst) => void) | null>(null);
  const pinVraagMeta = useRef<{ episode: number; teller: number; ok: boolean } | null>(null);
  const verzoekId = useRef(0);

  const rondPinVraagAf = useCallback((u: BevestigUitkomst) => {
    const resolve = pinVraagResolve.current;
    pinVraagResolve.current = null;
    pinVraagMeta.current = null;
    resolve?.(u);
  }, []);

  // Het slot valt terwijl de pincodevraag open is: meteen 'geannuleerd' (de order gaat niet), en de
  // sheet pas even later dicht, zodat hij niet in dezelfde tick sluit als de slot-Modal opent.
  const verloopPinVraag = useCallback(() => {
    if (!pinVraagResolve.current) return;
    rondPinVraagAf('geannuleerd');
    setTimeout(() => setPinVraagZichtbaar(false), MODAL_SPREIDING_MS);
  }, [rondPinVraagAf]);

  // ---------- Vergrendelen ----------

  const vergrendel = useCallback(() => {
    herstelToegestaan.current = false;
    slotInstelOpgeslagen.current = false;
    zetSlot({ status: 'vergrendeld', kluisfout: false, openVia: null, episode: slotRef.current.episode + 1 });
    verloopPinVraag();
  }, [slotRef, verloopPinVraag, zetSlot]);

  // ---------- Kern van een pincodecontrole ----------

  // Niet zelf in de rij: de aanroepers (die wel in de rij lopen) roepen dit aan.
  const herhash = useCallback(async (pin: string, oud: PinRecord) => {
    try {
      const nu = await leesPinRecord();
      // Intussen gewijzigd of weg: dan niet met de oude pincode overschrijven.
      if (nu.soort !== 'ja' || nu.waarde.hash !== oud.hash) return;
      const record = await maakPinRecord(pin, nieuweSalt(), kdf);
      await bewaarPinRecord(record);
    } catch {
      // Lukt het niet, dan volgende keer opnieuw: het oude record blijft geldig.
    }
  }, []);

  const herbepaalNaVerdwenenRecord = useCallback(async () => {
    const hint = await laadHintIngesteld();
    const s = bepaalSlotStatus({
      pinRecord: { soort: 'nee' },
      etoroGekoppeld: etoroRef.current,
      koudeStart: false,
      hintIngesteld: hint,
    });
    // Met de hint aan is dit een kluisfout (vergrendeld): dan geldt er nog een pincode.
    zetPincode(s.kluisfout);
    if (s.status === 'open') open('anders');
    else zetSlot({ status: s.status, kluisfout: s.kluisfout });
  }, [etoroRef, open, zetPincode, zetSlot]);

  const controleerKern = useCallback(
    async (pin: string): Promise<PinUitkomst> => {
      const rec = await leesPinRecord();
      if (rec.soort === 'kluisfout') return { soort: 'kluisfout', bericht: rec.bericht };
      if (rec.soort === 'nee') {
        void herbepaalNaVerdwenenRecord();
        return { soort: 'kluisfout', bericht: MELDING_GEEN_PINCODE };
      }

      const p = await leesPogingen();
      // Zonder leesbare teller kan de fout niet eerst worden weggeschreven: dan niet verifiëren.
      if (p.soort === 'kluisfout') return { soort: 'kluisfout', bericht: p.bericht };
      const klok = klokNu();
      const oud = p.soort === 'ja' ? p.waarde : { ...LEGE_POGINGEN };
      const stand = herankerStand(oud, klok);
      const rest = resterendeBlokkade(stand, klok);
      if (rest > 0) {
        if (stand !== oud) await bewaarPogingen(stand);
        zetPogingen(stand);
        return { soort: 'geblokkeerd', resterendMs: rest };
      }

      // Eerst de fout wegschrijven, dan pas verifiëren.
      const naFout = registreerFout(stand, klok);
      const geschreven = await bewaarPogingen(naFout);
      if (geschreven.soort !== 'ok') return { soort: 'kluisfout', bericht: geschreven.bericht };
      // Alleen de ref: de wachtstaat mag pas verschijnen als vaststaat dat de pincode fout was.
      pogingenRef.current = naFout;

      let goed: boolean;
      try {
        goed = await controleerPin(pin, rec.waarde, kdf);
      } catch (e) {
        // De fout blijft geteld: zonder werkende KDF valt er niets te controleren.
        return { soort: 'kluisfout', bericht: kluisBericht(e) };
      }

      if (goed) {
        const leeg = registreerSucces();
        // Eén herkansing. Mislukt ook die, dan blijft er één fout te veel staan in de kluis; de
        // pincode was goed, dus de uitkomst blijft 'ok' en de volgende goede pincode ruimt hem op.
        await bewaarPogingenMetHerkansing(leeg);
        zetPogingen(leeg);
        if (moetHerhashen(rec.waarde)) void inRij(() => herhash(pin, rec.waarde));
        return { soort: 'ok' };
      }

      zetPogingen(naFout);
      return { soort: 'fout', fouten: naFout.fouten, resterendTotBlokkade: pogingenTotBlokkade(naFout) };
    },
    [herbepaalNaVerdwenenRecord, herhash, inRij, zetPogingen],
  );

  // ---------- eToro ----------

  // Fail-closed: een kluisfout bij de eToro-sleutel telt als gekoppeld (dan is het slot verplicht).
  const leesEtoro = useCallback(async (): Promise<boolean> => {
    const u = await sleutelUitkomst();
    const gekoppeld = u.soort !== 'geen';
    zetEtoro(gekoppeld);
    return gekoppeld;
  }, [zetEtoro]);

  useEffect(
    () =>
      opSleutelWijziging(() => {
        void (async () => {
          const gekoppeld = await leesEtoro();
          if (!gekoppeld || slotRef.current.status !== 'open') return;
          // Vangnet. bewaarSleutels weigert zonder pincode en loopt in dezelfde rij als zetSlotUit,
          // dus dit hoort niets te vinden. Niet op pincodeRef vertrouwen: de kluis zelf lezen.
          const rec = await leesPinRecord();
          if (slotRef.current.status !== 'open') return;
          const episode = slotRef.current.episode + 1;
          if (rec.soort === 'nee') {
            zetPincode(false);
            zetSlot({ status: 'setupVerplicht', kluisfout: false, openVia: null, episode });
          } else if (rec.soort === 'kluisfout') {
            zetSlot({ status: 'vergrendeld', kluisfout: true, openVia: null, episode });
          } else if (!pincodeRef.current) {
            // Er staat een pincode die de provider niet kende: onverklaard, dus op slot.
            zetPincode(true);
            vergrendel();
          }
        })();
      }),
    [leesEtoro, pincodeRef, slotRef, vergrendel, zetPincode, zetSlot],
  );

  // ---------- Koude start ----------

  useEffect(() => {
    let actief = true;
    const start = async () => {
      const [rec, hint, t, bioAan, gekoppeld] = await metTijdslimiet(
        Promise.all([
          leesPinRecord(),
          laadHintIngesteld(),
          laadTermijn(),
          laadBiometrieAan(),
          leesEtoro(),
          meetBiometrie(),
        ]),
        LEES_TIJDSLIMIET_MS,
      );
      if (!actief || slotRef.current.status !== 'laden') return;
      zetTermijnStaat(t);
      zetBiometrieAanStaat(bioAan);
      // De hint bijwerken als hij achterloopt. Alleen omhoog: 'geen record' met hint aan is juist het
      // geval dat als kluisfout telt (zie bepaalSlotStatus), dus die hint blijft staan.
      if (rec.soort === 'ja' && !hint) void bewaarHintIngesteld(true);

      const s = bepaalSlotStatus({ pinRecord: rec, etoroGekoppeld: gekoppeld, koudeStart: true, hintIngesteld: hint });
      zetPincode(rec.soort === 'ja' || s.kluisfout);
      if (s.status === 'open') open('anders');
      else zetSlot({ status: s.status, kluisfout: s.kluisfout, openVia: null, episode: slotRef.current.episode + 1 });

      if (rec.soort === 'ja') {
        const stand = await inRij(actuelePogingen);
        if (actief && stand) zetPogingen(stand);
      }
    };
    start().catch(() => {
      // Onverwachte fout of de kluis hangt: niet blijven hangen op 'laden', maar de veilige kant op.
      // "Opnieuw proberen" bepaalt de status daarna opnieuw (en opent als er niets te beschermen is).
      if (!actief || slotRef.current.status !== 'laden') return;
      zetPincode(true);
      zetSlot({ status: 'vergrendeld', kluisfout: true, openVia: null, episode: slotRef.current.episode + 1 });
      // De instellingen staan in AsyncStorage en zijn meestal wel te lezen.
      void laadTermijn().then(t => actief && zetTermijnStaat(t));
      void laadBiometrieAan().then(aan => actief && zetBiometrieAanStaat(aan));
      void meetBiometrie();
    });
    return () => {
      actief = false;
    };
    // Eén keer bij het mounten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open: splash weg en afdekking uit (behalve als de app op de achtergrond draait, bijvoorbeeld
  // gestart voor de widget; dan doet de terugkomst dat).
  useEffect(() => {
    if (slot.status !== 'open') return;
    verbergSplash();
    if (AppState.currentState !== 'background') zetAfgedekt(false);
  }, [slot.status]);

  // Recente apps afdekken zolang het slot aan staat. Bij elke wijziging; bij elke 'active' ook
  // (de activity kan herstart zijn), zie hieronder.
  // Ook een kluisfout-slot telt: dan weten we niet of er een pincode is, dus afdekken.
  const slotAan = pincodeIngesteld || etoroGekoppeld || slot.kluisfout;
  const slotAanRef = useRef(slotAan);
  slotAanRef.current = slotAan;
  const geladen = slot.status !== 'laden';
  useEffect(() => {
    if (geladen) zetRecentsAfbeelding(!slotAan);
  }, [geladen, slotAan]);

  // ---------- AppState ----------

  // Navigatie die binnenkomt terwijl de app nog op de achtergrond staat (een meldingstik komt vóór
  // AppState 'active'), wacht tot opVoorgrond over hervergrendelen heeft beslist. Anders wisselt de
  // tab terwijl de app nog 'open' is en valt het slot er pas daarna overheen.
  const voorgrondWachters = useRef<(() => void)[]>([]);
  const naVoorgrondBeslissing = useCallback((cb: () => void) => {
    voorgrondWachters.current.push(cb);
  }, []);

  useEffect(() => {
    const meldVoorgrondBeslist = () => {
      const wachtend = voorgrondWachters.current;
      voorgrondWachters.current = [];
      for (const cb of wachtend) {
        try {
          cb();
        } catch {
          // Een falende wachter mag de rest niet tegenhouden.
        }
      }
    };

    const beslis = (a: Achtergrond | null) => {
      const s = slotRef.current;
      const hervergrendelen =
        pincodeRef.current &&
        (s.status === 'open' ||
          (s.status === 'vergrendeld' && !s.kluisfout) ||
          // Verplichte setup waarin de pincode al is opgeslagen (klaar-stap of biometrie-aanbod):
          // er is nu een pincode, dus de termijn geldt.
          (s.status === 'setupVerplicht' && slotInstelOpgeslagen.current)) &&
        moetHervergrendelen({
          termijn: a?.viaEigenScherm ? termijnNaEigenScherm(termijnRef.current) : termijnRef.current,
          achtergrondSinds: a ? a.sinds : null,
          nu: klokNu(),
        });
      if (hervergrendelen) {
        // De afdekking blijft staan tot onShow van de slot-Modal (of de nieuwe episode).
        vergrendel();
      } else if (slotRef.current.status === 'open') {
        zetAfgedekt(false);
      }
      // In dezelfde synchrone beurt als vergrendel(): React bundelt de updates, dus een wachtende
      // navigatie ziet in één render al dat het slot er ligt.
      meldVoorgrondBeslist();
    };

    const opAchtergrond = () => {
      achtergrondTeller.current += 1;
      // De vlag geldt voor precies deze ene keer achtergrond: bij de volgende 'active' gaat hij uit,
      // zodat een vergeten meldEigenSysteemScherm(false) het slot nooit blijvend verzwakt.
      const viaEigenScherm = eigenSysteemScherm.current;
      const tijdensPrompt = biometrie.promptBezig();
      achtergrond.current = { sinds: klokNu(), viaEigenScherm, tijdensPrompt };
      if (viaEigenScherm) return;
      zetAfgedekt(true);
      // 'direct': meteen op slot, niet pas bij terugkomst. Niet tijdens een prompt: die beslissing
      // valt bij terugkomst, als de prompt klaar is.
      const st = slotRef.current.status;
      if (
        termijnRef.current === 'direct' &&
        pincodeRef.current &&
        (st === 'open' || (st === 'setupVerplicht' && slotInstelOpgeslagen.current)) &&
        !tijdensPrompt
      ) {
        vergrendel();
      }
    };

    const opVoorgrond = () => {
      eigenSysteemScherm.current = false;
      zetRecentsAfbeelding(!slotAanRef.current);
      void meetBiometrie();
      const a = achtergrond.current;
      achtergrond.current = null;
      if (!a) {
        // Geen achtergrond gezien (start op de achtergrond, of een gemiste gebeurtenis). Open met een
        // pincode: het tijdstip is onbekend, dus vergrendelen zoals moetHervergrendelen bij twijfel
        // doet (beslis(null)). Anders alleen de afdekking rechtzetten.
        if (slotRef.current.status === 'open' && pincodeRef.current) {
          beslis(null);
          return;
        }
        if (slotRef.current.status === 'open') zetAfgedekt(false);
        meldVoorgrondBeslist();
        return;
      }
      if (a.viaEigenScherm) {
        // Terug uit de share-sheet of de schermslot-activity: niet forceren (de prompt rondt zelf
        // af) en vergrendelen na max(termijn, 1 min).
        beslis(a);
        return;
      }
      if (biometrie.promptBezig()) {
        // Beslissen zodra de prompt klaar is. Kwam de app uit 'background' terug terwijl de prompt
        // nog loopt, dan hangt hij waarschijnlijk: forceren, dat meldt hem klaar.
        wachtOpPrompt.current?.();
        wachtOpPrompt.current = biometrie.opPromptKlaar(() => {
          wachtOpPrompt.current = null;
          beslis(a);
        });
        void biometrie.forceerPromptKlaar();
        return;
      }
      beslis(a);
    };

    const sub = AppState.addEventListener('change', volgende => {
      if (volgende === 'background') opAchtergrond();
      else if (volgende === 'active') opVoorgrond();
    });
    return () => {
      sub.remove();
      wachtOpPrompt.current?.();
      wachtOpPrompt.current = null;
    };
  }, [meetBiometrie, pincodeRef, slotRef, termijnRef, vergrendel]);

  // ---------- Acties ----------

  const ontgrendelMetPin = useCallback(
    (pin: string): Promise<PinUitkomst> =>
      inRij(async () => {
        if (slotRef.current.status !== 'vergrendeld' || slotRef.current.kluisfout) {
          return { soort: 'kluisfout', bericht: MELDING_NIET_VERGRENDELD };
        }
        const u = await controleerKern(pin);
        if (u.soort === 'ok' && slotRef.current.status === 'vergrendeld') open('slot');
        return u;
      }),
    [controleerKern, inRij, open, slotRef],
  );

  const ontgrendelMetBiometrie = useCallback(async (): Promise<BiometrieUitkomst> => {
    if (slotRef.current.status !== 'vergrendeld' || slotRef.current.kluisfout) return 'geannuleerd';
    if (!bruikbaarRef.current) return 'nietBeschikbaar';
    const u = await biometrie.vraagBiometrie(PROMPT_ONTGRENDEL);
    if (u === 'ok') {
      if (slotRef.current.status !== 'vergrendeld' || slotRef.current.kluisfout) return 'geannuleerd';
      open('slot');
      return 'ok';
    }
    if (u === 'uitgeschakeld' || u === 'nietBeschikbaar') void meetBiometrie();
    return u;
  }, [meetBiometrie, open, slotRef]);

  const herstelViaToestel = useCallback(async (): Promise<HerstelUitkomst> => {
    if (slotRef.current.status !== 'vergrendeld') return 'geannuleerd';
    const episode = slotRef.current.episode;
    if (SCHERMSLOT_IS_ACTIVITY) eigenSysteemScherm.current = true;
    let u: HerstelUitkomst;
    try {
      u = await biometrie.herstelViaToestel();
    } finally {
      if (SCHERMSLOT_IS_ACTIVITY) eigenSysteemScherm.current = false;
    }
    // Alleen geldig in dezelfde slot-episode.
    if (u === 'ok' && slotRef.current.status === 'vergrendeld' && slotRef.current.episode === episode) {
      herstelToegestaan.current = true;
    }
    return u;
  }, [slotRef]);

  const stelPinIn = useCallback(
    (pin: string): Promise<InstelUitkomst> =>
      inRij(async (): Promise<InstelUitkomst> => {
        const keuring = keurPin(pin);
        if (keuring !== 'ok') return { soort: keuring };
        const b = await meetBiometrie();
        // Zonder schermslot kan een vergeten pincode niet hersteld worden: dan niet instellen.
        if (!b.toestelBeveiligd) return { soort: 'geweigerd' };
        const rec = await leesPinRecord();
        const herstel = herstelToegestaan.current;
        if (rec.soort === 'ja' && !herstel) return { soort: 'geweigerd' };
        if (rec.soort === 'kluisfout' && !herstel) return { soort: 'kluisfout', bericht: rec.bericht };

        let record: PinRecord;
        try {
          record = await maakPinRecord(pin, nieuweSalt(), kdf);
        } catch (e) {
          return { soort: 'kluisfout', bericht: kluisBericht(e) };
        }

        // Volgorde: hint, teller, record. De hint eerst, zodat er nooit een record staat dat bij een
        // latere kluisfout als "nooit ingesteld" telt (dan zou de status 'open' worden). De teller
        // vóór het record: na een herstel moet de nieuwe pincode niet in een oude wachttijd vallen,
        // en het herstel (schermslot) rechtvaardigt het terugzetten al. Mislukt een van beide, dan
        // wordt er geen record geschreven.
        if (!(await bewaarHintIngesteld(true))) {
          return { soort: 'kluisfout', bericht: 'Kader kon de instelling van het slot niet opslaan.' };
        }
        // Stond er geen pincode en komt er ook geen, dan de hint terug uit. Anders telt 'geen record'
        // met hint aan bij de volgende start als kluisfout (zie bepaalSlotStatus). Niet na een
        // herstel: dan was 'geen record' met hint aan juist de kluisfout, en die blijft staan.
        const hintTerugBijMislukking = async () => {
          if (herstel || rec.soort !== 'nee') return;
          if ((await leesPinRecord()).soort === 'nee') await bewaarHintIngesteld(false);
        };
        const leeg = registreerSucces();
        const teller = await bewaarPogingenMetHerkansing(leeg);
        if (teller.soort !== 'ok') {
          await hintTerugBijMislukking();
          return teller;
        }
        zetPogingen(leeg);

        const w = await bewaarPinRecord(record);
        if (w.soort !== 'ok') {
          await hintTerugBijMislukking();
          return w;
        }

        herstelToegestaan.current = false;
        zetPincode(true);
        // In het slot (herstel, verplichte setup) gaat de app pas open na de klaar-stap en het
        // biometrie-aanbod: zie slotInstellen.onKlaar/onAnnuleer.
        const status = slotRef.current.status;
        if (status === 'setupVerplicht' || status === 'vergrendeld') slotInstelOpgeslagen.current = true;
        return { soort: 'ok' };
      }).finally(() => {
        // De widget toont zolang het slot aan staat alleen "Kader is vergrendeld", de dagelijkse
        // herinnering gaat naar het kanaal met slot, en meldingen met inhoud die al in de balk
        // stonden gaan weg (verbergMeldingenMetInhoud kijkt zelf of het slot nu aan staat). Ook na
        // een mislukking: de hint stond dan even aan.
        void tekenWidgetsNaSlotWijziging();
        void herplanDagelijkseMelding();
        void verbergMeldingenMetInhoud();
      }),
    [inRij, meetBiometrie, slotRef, zetPincode, zetPogingen],
  );

  const controleerHuidigePin = useCallback(
    (pin: string): Promise<PinUitkomst> => inRij(() => controleerKern(pin)),
    [controleerKern, inRij],
  );

  const wijzigPin = useCallback(
    (oud: string, nieuw: string): Promise<WijzigUitkomst> =>
      inRij(async () => {
        // Eerst de nieuwe keuren: een ongeldige nieuwe pincode kost geen poging.
        const keuring = keurPin(nieuw);
        if (keuring !== 'ok') return { soort: keuring };
        const c = await controleerKern(oud);
        if (c.soort !== 'ok') return c;
        let record: PinRecord;
        try {
          record = await maakPinRecord(nieuw, nieuweSalt(), kdf);
        } catch (e) {
          return { soort: 'kluisfout', bericht: kluisBericht(e) };
        }
        const w = await bewaarPinRecord(record);
        if (w.soort !== 'ok') return w;
        return { soort: 'ok' };
      }),
    [controleerKern, inRij],
  );

  const zetSlotUit = useCallback(
    (pin: string): Promise<UitzetUitkomst> =>
      inRij(async (): Promise<UitzetUitkomst> => {
        if (await leesEtoro()) return { soort: 'etoroGekoppeld' };
        const c = await controleerKern(pin);
        if (c.soort !== 'ok') return c;
        // Nog eens: er kan intussen gekoppeld zijn.
        if (await leesEtoro()) return { soort: 'etoroGekoppeld' };
        const w = await wisSlot();
        if (w.soort !== 'ok') return w;
        zetPincode(false);
        zetBiometrieAanStaat(false);
        zetPogingen({ ...LEGE_POGINGEN });
        return { soort: 'ok' };
      }).finally(() => {
        // Slot uit: de widget toont zijn cijfers weer en de dagelijkse herinnering gaat terug naar
        // het gewone kanaal (of beide blijven afgeschermd als het wissen mislukte).
        void tekenWidgetsNaSlotWijziging();
        void herplanDagelijkseMelding();
      }),
    [controleerKern, inRij, leesEtoro, zetBiometrieAanStaat, zetPincode, zetPogingen],
  );

  const zetBiometrie = useCallback(
    async (aan: boolean): Promise<BiometrieUitkomst> => {
      if (!aan) {
        await bewaarBiometrieAan(false);
        zetBiometrieAanStaat(false);
        return 'ok';
      }
      const b = await meetBiometrie();
      if (!b.hardware || !b.ingeschreven) return 'uitgeschakeld';
      const u = await biometrie.vraagBiometrie(PROMPT_BIOMETRIE_AAN);
      if (u === 'ok') {
        await bewaarBiometrieAan(true);
        zetBiometrieAanStaat(true);
      }
      return u;
    },
    [meetBiometrie, zetBiometrieAanStaat],
  );

  const zetTermijn = useCallback(
    async (nieuw: SlotTermijn) => {
      zetTermijnStaat(nieuw);
      await bewaarTermijn(nieuw);
    },
    [zetTermijnStaat],
  );

  const meldEigenSysteemScherm = useCallback((aan: boolean) => {
    eigenSysteemScherm.current = aan;
  }, []);

  const verwijderKoppelingEnOpen = useCallback(async () => {
    if (slotRef.current.status !== 'setupVerplicht') return;
    // Eerst de omgeving naar demo, dan de sleutels weg. Andersom vuurt wisSleutels via
    // opSleutelWijziging een verversing (PortfolioProvider) die de oude omgeving 'real' kan
    // teruglezen nadat demo al gezet is.
    // SlotScherm toont e.message, en dat moet altijd deze melding zijn. wisSleutels gooit hem al
    // zelf (met de oorzaak erin); alleen een fout van zetOmgeving wordt hier ingepakt.
    try {
      await zetOmgeving('demo');
    } catch (e) {
      throw new Error(MELDING_KOPPELING_NIET_WEG, { cause: e });
    }
    await wisSleutels();
    // Opnieuw lezen: mislukte het wissen (of is de kluis nu onleesbaar, dat telt als gekoppeld),
    // dan niet openen. De status blijft 'setupVerplicht' en SlotScherm toont de melding.
    if (await leesEtoro()) throw new Error(MELDING_KOPPELING_NIET_WEG);
    const [rec, hint] = await Promise.all([leesPinRecord(), laadHintIngesteld()]);
    const s = bepaalSlotStatus({ pinRecord: rec, etoroGekoppeld: false, koudeStart: false, hintIngesteld: hint });
    zetPincode(rec.soort === 'ja' || s.kluisfout);
    if (s.status === 'open') open('anders');
    else zetSlot({ status: s.status, kluisfout: s.kluisfout });
  }, [leesEtoro, open, slotRef, zetPincode, zetSlot]);

  const opnieuwProberen = useCallback(async () => {
    let gelezen: [Awaited<ReturnType<typeof leesPinRecord>>, boolean, boolean, SlotTermijn, boolean];
    try {
      gelezen = await metTijdslimiet(
        Promise.all([leesPinRecord(), laadHintIngesteld(), leesEtoro(), laadTermijn(), laadBiometrieAan()]),
        LEES_TIJDSLIMIET_MS,
      );
    } catch {
      // Hangt nog steeds: het kluisfout-scherm blijft staan.
      return;
    }
    const [rec, hint, gekoppeld, t, bioAan] = gelezen;
    if (slotRef.current.status !== 'vergrendeld' || !slotRef.current.kluisfout) return;
    zetTermijnStaat(t);
    zetBiometrieAanStaat(bioAan);
    void meetBiometrie();
    if (rec.soort === 'ja' && !hint) void bewaarHintIngesteld(true);
    const s = bepaalSlotStatus({ pinRecord: rec, etoroGekoppeld: gekoppeld, koudeStart: true, hintIngesteld: hint });
    zetPincode(rec.soort === 'ja' || s.kluisfout);
    if (s.status === 'open') open('anders');
    else zetSlot({ status: s.status, kluisfout: s.kluisfout });
    if (rec.soort === 'ja') {
      const stand = await inRij(actuelePogingen);
      if (stand) zetPogingen(stand);
    }
  }, [
    actuelePogingen,
    inRij,
    leesEtoro,
    meetBiometrie,
    open,
    slotRef,
    zetBiometrieAanStaat,
    zetPincode,
    zetPogingen,
    zetSlot,
    zetTermijnStaat,
  ]);

  // ---------- bevestigIdentiteit ----------

  const bevestigIdentiteit = useCallback(
    async (_reden: BevestigReden, opties: BevestigOpties = {}): Promise<BevestigUitkomst> => {
      if (slotRef.current.status !== 'open' || !pincodeRef.current) return 'geannuleerd';
      if (pinVraagResolve.current) return 'geannuleerd';
      const episode = slotRef.current.episode;
      const teller = achtergrondTeller.current;
      // Ging de app intussen naar de achtergrond of op slot, dan geen order en geen pincodevraag.
      const nogGeldig = () =>
        slotRef.current.status === 'open' &&
        slotRef.current.episode === episode &&
        achtergrondTeller.current === teller;

      if (!opties.alleenPincode && bruikbaarRef.current) {
        const u = await biometrie.vraagBiometrie({ ...PROMPT_ORDER, ondertitel: opties.detail });
        if (!nogGeldig()) return 'geannuleerd';
        if (u === 'ok') return 'ok';
        if (u === 'uitgeschakeld' || u === 'nietBeschikbaar') void meetBiometrie();
        // Elke andere uitkomst ('Gebruik pincode', niet herkend, geblokkeerd): de pincode.
      }

      const rest = resterendeBlokkade(pogingenRef.current, klokNu());
      return new Promise<BevestigUitkomst>(resolve => {
        pinVraagResolve.current = resolve;
        pinVraagMeta.current = { episode, teller, ok: false };
        verzoekId.current += 1;
        setPinVraag({
          id: verzoekId.current,
          titel: PINVRAAG_ORDER_TITEL,
          sub: opties.detail ?? PINVRAAG_ORDER_SUB,
          beginBlokkadeMs: rest > 0 ? rest : undefined,
          beginBlokkadeDuurMs: rest > 0 ? blokkadeDuur(pogingenRef.current, rest) : undefined,
        });
        setPinVraagZichtbaar(true);
      });
    },
    [meetBiometrie, pincodeRef, slotRef],
  );

  const pinVraagControleer = useCallback(
    async (pin: string): Promise<PinUitkomst> => {
      const u = await inRij(() => controleerKern(pin));
      if (u.soort === 'ok' && pinVraagMeta.current) pinVraagMeta.current.ok = true;
      // De fout die de wachttijd startte: PinVraagInhoud kent alleen een lokale wachtstaat vanuit
      // 'geblokkeerd', dus meteen die tonen.
      if (u.soort === 'fout' && u.resterendTotBlokkade === 0) {
        const rest = resterendeBlokkade(pogingenRef.current, klokNu());
        if (rest > 0) return { soort: 'geblokkeerd', resterendMs: rest };
      }
      return u;
    },
    [controleerKern, inRij],
  );

  const pinVraagKlaar = useCallback(() => {
    setPinVraagZichtbaar(false);
    const meta = pinVraagMeta.current;
    const geldig =
      !!meta &&
      meta.ok &&
      slotRef.current.status === 'open' &&
      slotRef.current.episode === meta.episode &&
      achtergrondTeller.current === meta.teller;
    rondPinVraagAf(geldig ? 'ok' : 'geannuleerd');
  }, [rondPinVraagAf, slotRef]);

  const pinVraagAnnuleer = useCallback(() => {
    setPinVraagZichtbaar(false);
    rondPinVraagAf('geannuleerd');
  }, [rondPinVraagAf]);

  // ---------- vraagPinInstellen ----------

  const [pinInstellen, setPinInstellen] = useState<PinInstellenVerzoek | null>(null);
  const [pinInstellenZichtbaar, setPinInstellenZichtbaar] = useState(false);
  const pinInstellenResolve = useRef<((ingesteld: boolean) => void) | null>(null);
  const pinInstellenOpgeslagen = useRef(false);

  const vraagPinInstellen = useCallback(
    async (reden: VraagPinReden): Promise<boolean> => {
      if (slotRef.current.status !== 'open' || pinInstellenResolve.current) return false;
      const rec = await leesPinRecord();
      if (reden === 'wijzigen') {
        if (rec.soort !== 'ja') return false;
      } else {
        if (rec.soort === 'ja') return true;
        if (rec.soort === 'kluisfout') return false;
      }
      const b = await meetBiometrie();
      if (slotRef.current.status !== 'open' || pinInstellenResolve.current) return false;
      pinInstellenOpgeslagen.current = false;
      const wijzigen = reden === 'wijzigen';
      const props: PinInstellenVerzoek['props'] = {
        reden,
        keurPin,
        onControleerHuidige: wijzigen ? controleerHuidigePin : undefined,
        onOpslaan: async (nieuw, huidige) => {
          const u = wijzigen ? await wijzigPin(huidige ?? '', nieuw) : await stelPinIn(nieuw);
          if (u.soort === 'ok') pinInstellenOpgeslagen.current = true;
          return u;
        },
        // Wijzigen is geen nieuw slot: dat mag ook als het schermslot intussen weg is.
        toestelBeveiligd: wijzigen ? true : b.toestelBeveiligd,
        biometrieAanbod:
          !wijzigen && b.hardware && b.ingeschreven && !biometrieAanRef.current
            ? { onZetAan: () => zetBiometrie(true) }
            : null,
      };
      return new Promise<boolean>(resolve => {
        pinInstellenResolve.current = resolve;
        verzoekId.current += 1;
        setPinInstellen({ id: verzoekId.current, props });
        setPinInstellenZichtbaar(true);
      });
    },
    [biometrieAanRef, controleerHuidigePin, meetBiometrie, slotRef, stelPinIn, wijzigPin, zetBiometrie],
  );

  // Klaar en annuleren komen allebei pas na de sluitanimatie (PodiumScherm.onSluiten). Annuleren na
  // het opslaan (terug tijdens 'klaar' of het aanbod) telt als ingesteld.
  const rondPinInstellenAf = useCallback(() => {
    setPinInstellenZichtbaar(false);
    const resolve = pinInstellenResolve.current;
    pinInstellenResolve.current = null;
    resolve?.(pinInstellenOpgeslagen.current);
  }, []);

  // ---------- Inline instellen in het slot (herstel, verplichte setup) ----------

  const rondSlotInstellenAf = useCallback(() => {
    if (!slotInstelOpgeslagen.current) return;
    const s = slotRef.current.status;
    if (s === 'setupVerplicht' || s === 'vergrendeld') open('anders');
    else slotInstelOpgeslagen.current = false;
  }, [open, slotRef]);

  const bioHardware = !!biometrieBeschikbaar?.hardware;
  const bioIngeschreven = !!biometrieBeschikbaar?.ingeschreven;
  const toestelBeveiligd = biometrieBeschikbaar?.toestelBeveiligd ?? true;
  const slotInstellen = useMemo<Omit<PinInstellenInhoudProps, 'reden'>>(
    () => ({
      keurPin,
      onOpslaan: nieuw => stelPinIn(nieuw),
      toestelBeveiligd,
      // Uit de ref en niet als afhankelijkheid: biometrie aanzetten in het aanbod mag het aanbod
      // zelf niet laten verdwijnen voor onKlaar komt.
      biometrieAanbod:
        bioHardware && bioIngeschreven && !biometrieAanRef.current ? { onZetAan: () => zetBiometrie(true) } : null,
      onKlaar: rondSlotInstellenAf,
      onAnnuleer: () => {
        if (slotInstelOpgeslagen.current) rondSlotInstellenAf();
        else herstelToegestaan.current = false;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bioHardware, bioIngeschreven, toestelBeveiligd, slot.episode, rondSlotInstellenAf, stelPinIn, zetBiometrie],
  );

  // ---------- SlotLaag-koppeling ----------

  const meldSlotZichtbaar = useCallback((zichtbaar: boolean) => {
    if (slotBezetTimer.current) {
      clearTimeout(slotBezetTimer.current);
      slotBezetTimer.current = null;
    }
    if (zichtbaar) {
      setSlotBezet(true);
      return;
    }
    slotBezetTimer.current = setTimeout(() => {
      slotBezetTimer.current = null;
      setSlotBezet(false);
    }, MODAL_SPREIDING_MS);
  }, []);

  useEffect(
    () => () => {
      if (slotBezetTimer.current) clearTimeout(slotBezetTimer.current);
    },
    [],
  );

  const slotGetoond = useCallback(() => {
    zetAfgedekt(false);
    verbergSplash();
  }, []);

  // ---------- Contextwaarden ----------

  const waarde = useMemo<VergrendelContextWaarde>(
    () => ({
      status: slot.status,
      kluisfout: slot.kluisfout,
      pincodeIngesteld,
      etoroGekoppeld,
      biometrieAan,
      biometrieBeschikbaar,
      biometrieBruikbaar,
      termijn,
      blokkade,
      ontgrendelMetPin,
      ontgrendelMetBiometrie,
      herstelViaToestel,
      stelPinIn,
      controleerHuidigePin,
      wijzigPin,
      zetSlotUit,
      zetBiometrie,
      zetTermijn,
      bevestigIdentiteit,
      vraagPinInstellen,
      meldEigenSysteemScherm,
      verwijderKoppelingEnOpen,
      opnieuwProberen,
    }),
    [
      slot.status,
      slot.kluisfout,
      pincodeIngesteld,
      etoroGekoppeld,
      biometrieAan,
      biometrieBeschikbaar,
      biometrieBruikbaar,
      termijn,
      blokkade,
      ontgrendelMetPin,
      ontgrendelMetBiometrie,
      herstelViaToestel,
      stelPinIn,
      controleerHuidigePin,
      wijzigPin,
      zetSlotUit,
      zetBiometrie,
      zetTermijn,
      bevestigIdentiteit,
      vraagPinInstellen,
      meldEigenSysteemScherm,
      verwijderKoppelingEnOpen,
      opnieuwProberen,
    ],
  );

  const intern = useMemo<SlotIntern>(
    () => ({
      episode: slot.episode,
      openVia: slot.openVia,
      slotInstellen,
      pinVraag,
      pinVraagZichtbaar,
      pinVraagControleer,
      pinVraagKlaar,
      pinVraagAnnuleer,
      pinInstellen,
      pinInstellenZichtbaar,
      pinInstellenKlaar: rondPinInstellenAf,
      pinInstellenAnnuleer: rondPinInstellenAf,
      meldSlotZichtbaar,
      slotGetoond,
    }),
    [
      slot.episode,
      slot.openVia,
      slotInstellen,
      pinVraag,
      pinVraagZichtbaar,
      pinVraagControleer,
      pinVraagKlaar,
      pinVraagAnnuleer,
      pinInstellen,
      pinInstellenZichtbaar,
      rondPinInstellenAf,
      meldSlotZichtbaar,
      slotGetoond,
    ],
  );

  const vrij = slot.status === 'open' && !slotBezet;
  const naSlot = useMemo(() => ({ vrij, naVoorgrondBeslissing }), [vrij, naVoorgrondBeslissing]);

  return (
    <VergrendelContext.Provider value={waarde}>
      <SlotInternContext.Provider value={intern}>
        <NaSlotContext.Provider value={naSlot}>
          <IdentiteitContext.Provider value={bevestigIdentiteit}>{children}</IdentiteitContext.Provider>
        </NaSlotContext.Provider>
      </SlotInternContext.Provider>
    </VergrendelContext.Provider>
  );
}

// ---------- Hooks ----------

export function useVergrendeling(): VergrendelContextWaarde {
  const waarde = useContext(VergrendelContext);
  if (!waarde) throw new Error('useVergrendeling() hoort binnen VergrendelProvider.');
  return waarde;
}

// Zelfde waarde, maar null buiten de provider in plaats van een fout. Voor componenten die ook
// buiten de boom kunnen staan (of in een self-check).
export function useVergrendelingOpt(): VergrendelContextWaarde | null {
  return useContext(VergrendelContext);
}

// bevestigIdentiteit zonder de rest van de context (die tijdens een wachttijd elke seconde
// wijzigt). null buiten de provider.
export function useBevestigIdentiteit(): VergrendelContextWaarde['bevestigIdentiteit'] | null {
  return useContext(IdentiteitContext);
}

// Alleen voor SlotLaag. null buiten de provider.
export function useSlotIntern(): SlotIntern | null {
  return useContext(SlotInternContext);
}

// Voor de Modal-wrappers (PodiumScherm, BottomSheet, KaderDialoog, SysteemMenu, WelkomFeest):
// mag de wrapper nu zichtbaar zijn?
// - Was hij al zichtbaar voor het slot kwam, dan blijft hij staan (onder het slot, state intact).
// - Wil hij openen terwijl het slot er staat (status niet 'open', of de slot-Modal is nog niet
//   helemaal weg), dan wacht hij daarop.
// - Buiten de provider: gewoon `zichtbaar`.
export function useNaSlot(zichtbaar: boolean): boolean {
  const ctx = useContext(NaSlotContext);
  const [getoond, setGetoond] = useState(false);
  const mag = ctx === null ? zichtbaar : zichtbaar && (getoond || ctx.vrij);
  // Afgeleide state tijdens de render (toegestaan patroon): onthoudt of hij al stond.
  if (mag !== getoond) setGetoond(mag);
  return mag;
}

// Is de app nu vrij (status 'open' en de slot-Modal helemaal weg)? Voor navigatie die niet via een
// Modal-wrapper loopt, zoals een meldingstik of een kader://-link die van tab wisselt: die wacht tot
// dit true is, zodat het doel pas na het ontgrendelen in beeld komt. Buiten de provider: true.
export function useSlotVrij(): boolean {
  const ctx = useContext(NaSlotContext);
  return ctx === null ? true : ctx.vrij;
}

// Roept cb aan zodra de provider bij de volgende AppState 'active' over hervergrendelen heeft
// beslist. Voor navigatie die binnenkomt terwijl de app nog op de achtergrond staat. Buiten de
// provider: null.
export function useNaVoorgrondBeslissing(): ((cb: () => void) => void) | null {
  return useContext(NaSlotContext)?.naVoorgrondBeslissing ?? null;
}
