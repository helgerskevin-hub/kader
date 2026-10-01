import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View, findNodeHandle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  X, ChevronLeft, ChevronRight, Eye, EyeOff, ShoppingCart, Lock, ExternalLink, ClipboardPaste,
  Check, Info, Clock, Minus, Trash2, ShieldCheck,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts, Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { duur, veer, vervaag, staggerVertraging } from '../theme/beweging';
import { useReduceMotion } from '../theme/useReduceMotion';
import { useToetsenbordHoogte } from '../theme/useToetsenbordHoogte';
import { haptiek } from '../theme/haptiek';
import { EtoroOmgeving, EtoroSleutels, haalAccountInfo, haalEtoroPortfolio, magHandelenVolgensScopes } from '../engine/etoro';
import { bewaarSleutels, haalOmgeving, haalSleutels, wisSleutels, Sleutelpaar } from '../state/etoroSleutels';
import { userKeyBijApiKeyWijziging } from '../engine/sleutelKeuze';
import { beoordeelGeplakteSleutel } from '../engine/sleutelVorm';
import { bouwKoppelBeeld, KoppelUitslag, OmgevingToets, RijStaat, TestRij } from '../engine/koppelTest';
import { useDialoog } from '../state/DialoogProvider';
import { useNavigatie } from '../state/navigatie';
import { PodiumScherm, type Sluit } from './PodiumScherm';
import { StapOvergang } from './StapOvergang';
import { PilKnop } from './PilKnop';
import { Drukbaar } from './Drukbaar';
import { VoortgangsBalk } from './VoortgangsBalk';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  onOpgeslagen?: () => void;
  // Alleen vanuit de uitnodiging. Vanuit Instellingen zou een tabwissel de Instellingen-sheet
  // meteen weer bovenop openen, dus daar is Klaar de enige knop.
  toonNaarPortfolio?: boolean;
}

// Stappen tellen vanaf 0 in de code, op het scherm vanaf 1.
const AANTAL_STAPPEN = 5;
const STAP_KEUZE = 0;
const STAP_MAKEN = 1;
const STAP_PLAKKEN = 2;
const STAP_TESTEN = 3;
const STAP_KLAAR = 4;

// Wat je van plan bent. Dit verandert alleen de uitleg: wat er bewaard wordt, ook of Kader mag
// handelen, komt altijd uit de scopes die eToro bij de test teruggeeft.
type Keuze = 'lezen' | 'schrijven';

type TestStatus = 'idle' | 'testing' | 'klaar';

// Wat onder een sleutelveld staat na een tik op Plak. Nooit de sleutel zelf, alleen het aantal tekens.
interface PlakInfo {
  tekens: number;
  hint: string | null;
}

// De rijen zoals ze er vóór de test staan: alleen de titels, met een klokje.
const WACHT_TITELS = [
  'Sleutel geldig',
  'Demo: posities ophalen',
  'Echt: posities ophalen',
  'Handelen in demo',
  'Handelen in echt',
];

// Wat een schermlezer hoort als de test klaar is. Nooit iets van de sleutel zelf.
function testSamenvatting(uitslag: KoppelUitslag): string {
  const beeld = bouwKoppelBeeld(uitslag);
  if (beeld.foutstaat || uitslag.soort !== 'getest') return 'Test klaar. De sleutel werkt niet.';
  const omgeving = (naam: string, toets: OmgevingToets) => (toets.ok
    ? `${naam}: ${toets.posities === 1 ? '1 positie' : `${toets.posities} posities`}.`
    : `${naam}: werkt niet.`);
  const mag = (id: TestRij['id']) => (beeld.rijen.some(r => r.id === id && r.staat === 'ok') ? 'mag' : 'mag niet');
  return `Test klaar. ${omgeving('Demo', uitslag.omgeving.demo)} ${omgeving('Echt', uitslag.omgeving.real)} `
    + `Handelen in demo ${mag('schrijfDemo')}, in echt ${mag('schrijfReal')}.`;
}

// De regel onder een sleutelveld na een plak, ook voor de schermlezer. Alleen het aantal tekens.
function plakRegel(info: PlakInfo): string {
  return info.hint ?? `Geplakt, ${info.tekens} tekens`;
}

export function EtoroKoppelingWizard({ zichtbaar, onSluiten, onOpgeslagen, toonNaarPortfolio = false }: Props) {
  const { colors } = useTheme();
  const { toonDialoog } = useDialoog();
  const { gaNaar } = useNavigatie();
  const insets = useSafeAreaInsets();
  const toetsenbordHoogte = useToetsenbordHoogte();
  const [stap, setStap] = useState(STAP_KEUZE);
  const [keuze, setKeuze] = useState<Keuze>('schrijven');
  const [apiKey, setApiKey] = useState('');
  const [userKey, setUserKey] = useState('');
  const [toonApiKey, setToonApiKey] = useState(false);
  const [toonUserKey, setToonUserKey] = useState(false);
  const [plakApi, setPlakApi] = useState<PlakInfo | null>(null);
  const [plakUser, setPlakUser] = useState<PlakInfo | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [bezigOpslaan, setBezigOpslaan] = useState(false);
  const [bestondKoppeling, setBestondKoppeling] = useState(false);
  // Het paar zoals het bij het openen op het toestel stond. Nodig om te zien of iemand een NIEUWE
  // publieke sleutel plakt, want dan hoort de opgeslagen User Key er niet meer bij.
  const [geladen, setGeladen] = useState<Sleutelpaar | null>(null);
  // Is de voorgevulde User Key weggehaald omdat de publieke sleutel veranderde? Dan moet stap 3
  // uitleggen waarom het veld ineens leeg is, anders lijkt het een bug.
  const [userKeyGewist, setUserKeyGewist] = useState(false);
  // Uitslag van de verbindingstest, met daarin ook wat de sleutel volgens eToro mag (de scopes van
  // /api/v1/me, per omgeving, want één sleutel kan schrijfrecht op de ene omgeving dragen en alleen
  // leesrecht op de andere). null zolang er niet getest is, en zodra een sleutel na de test wijzigt.
  const [uitslag, setUitslag] = useState<KoppelUitslag | null>(null);
  // De omgeving waar Kader na het opslaan op staat, voor de tekst op het laatste scherm.
  const [omgevingNu, setOmgevingNu] = useState<EtoroOmgeving>('demo');
  // De uitslag zoals hij was op het moment van opslaan. Het laatste scherm leest alleen deze, zodat
  // een wijziging tijdens het opslaan dat scherm niet kan veranderen.
  const [klaarUitslag, setKlaarUitslag] = useState<KoppelUitslag | null>(null);
  // Tegen dubbel tikken: state is pas na de volgende render bij, een ref meteen.
  const opslaanBezig = useRef(false);
  const testBezig = useRef(false);
  // Telt het openen, zodat een haalSleutels() van een eerdere opening niets meer invult.
  const openTeller = useRef(0);
  // De titel van de huidige stap, voor de focus van de schermlezer na een stapwissel.
  const titelRef = useRef<Text>(null);
  // Elke test krijgt een nummer. Wijzigt er intussen een sleutel, dan hoort een uitslag die daarna
  // nog binnenkomt bij een paar dat niet meer in de velden staat, en die gooien we weg.
  const testNummer = useRef(0);

  // Laad bestaande sleutels en reset naar stap 1 telkens als de wizard opent.
  useEffect(() => {
    if (!zichtbaar) return;
    const opening = ++openTeller.current;
    testNummer.current += 1;
    opslaanBezig.current = false;
    testBezig.current = false;
    setStap(STAP_KEUZE);
    setKeuze('schrijven');
    setTestStatus('idle');
    setUitslag(null);
    setBezigOpslaan(false);
    setToonApiKey(false);
    setToonUserKey(false);
    setPlakApi(null);
    setPlakUser(null);
    setUserKeyGewist(false);
    setOmgevingNu('demo');
    setKlaarUitslag(null);
    setApiKey('');
    setUserKey('');
    setGeladen(null);
    haalSleutels().then(s => {
      // Intussen gesloten of opnieuw geopend: dit antwoord hoort bij een oudere opening.
      if (opening !== openTeller.current) return;
      // Alleen lege velden invullen: wie al begon te typen of plakken, verliest dat niet. geladen
      // wel altijd zetten, anders ziet userKeyBijApiKeyWijziging een nieuwe publieke sleutel niet.
      setApiKey(v => (v === '' ? s?.apiKey ?? '' : v));
      setUserKey(v => (v === '' ? s?.userKey ?? '' : v));
      setBestondKoppeling(s !== null);
      setGeladen(s);
    });
  }, [zichtbaar]);

  // Eén keer een tik van succes als het laatste scherm verschijnt.
  useEffect(() => {
    if (stap === STAP_KLAAR) haptiek('succes');
  }, [stap]);

  const beeld = useMemo(() => (uitslag ? bouwKoppelBeeld(uitslag) : null), [uitslag]);
  const foutScherm = stap === STAP_TESTEN && testStatus === 'klaar' && beeld?.foutstaat != null;

  // Na een stapwissel de schermlezer naar de titel van de nieuwe stap, pas als de overgang klaar
  // is: anders landt de focus op inhoud die nog binnenkomt.
  useEffect(() => {
    if (!zichtbaar) return;
    const t = setTimeout(() => {
      const node = titelRef.current ? findNodeHandle(titelRef.current) : null;
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, duur.lang);
    return () => clearTimeout(t);
  }, [stap, foutScherm, zichtbaar]);

  // Een getest paar geldt alleen voor precies die twee sleutels. Verandert er één teken, dan weten
  // we niets meer, en mag er niets bewaard worden tot er opnieuw getest is.
  function vergeetTest() {
    testNummer.current += 1;
    testBezig.current = false;
    setUitslag(null);
    setTestStatus('idle');
  }

  // Plak je een andere publieke sleutel dan die er stond, dan hoort de opgeslagen User Key daar niet
  // meer bij: eToro geeft bij een nieuwe sleutel ook een nieuwe User Key, en toont die precies één
  // keer. Tot nu toe bleef de oude User Key gewoon voorgevuld staan, gemaskeerd als bolletjes, dus
  // het veld zag er ingevuld uit en je klikte eroverheen. Het resultaat was een nieuwe api-sleutel
  // naast een oude User Key, en dus een 401 die pas bij de verbindingstest opdook met een melding
  // die je vertelde te doen wat je net gedaan dacht te hebben. Nu maakt de app het veld leeg.
  function wijzigApiKey(waarde: string) {
    vergeetTest();
    setApiKey(waarde);
    const wissel = userKeyBijApiKeyWijziging(geladen, waarde, userKey, userKeyGewist);
    if (wissel.userKey !== userKey) setPlakUser(null);
    setUserKey(wissel.userKey);
    setUserKeyGewist(wissel.gewist);
  }

  function wijzigUserKey(waarde: string) {
    vergeetTest();
    setUserKey(waarde);
  }

  // Zelf typen blijft altijd kunnen. De regel van de laatste plak klopt dan niet meer, dus die gaat weg.
  function typApiKey(waarde: string) {
    setPlakApi(null);
    wijzigApiKey(waarde);
  }
  function typUserKey(waarde: string) {
    setPlakUser(null);
    wijzigUserKey(waarde);
  }

  // Leest het klembord en zet het resultaat via dezelfde weg als typen in het veld, zodat de
  // User Key-regel hierboven ook bij plakken geldt. Een leeg klembord laat het veld staan: anders
  // zou een tik op Plak een sleutel wissen die er al stond. De hint blokkeert nooit.
  async function plak(veld: 'api' | 'user') {
    let tekst = '';
    try {
      tekst = await Clipboard.getStringAsync();
    } catch {
      tekst = '';
    }
    const b = beoordeelGeplakteSleutel(tekst);
    const info: PlakInfo = { tekens: b.tekens, hint: b.hint };
    if (veld === 'api') {
      if (b.tekens > 0) wijzigApiKey(b.schoon);
      setPlakApi(info);
    } else {
      if (b.tekens > 0) wijzigUserKey(b.schoon);
      setPlakUser(info);
    }
    AccessibilityInfo.announceForAccessibility(plakRegel(info));
  }

  // Beide omgevingen langs, met opzet. /api/v1/me geeft de scopes van demo én echt in één antwoord,
  // maar dat pad is identiek in beide omgevingen (zie DEMO_PADEN), dus het zegt niets over de vraag
  // of je sleutel het in een omgeving daadwerkelijk doet. Alleen daarop testen gaf een groene
  // "verbinding OK" voor een sleutel die op elk demo-endpoint een 401 geeft, en dan viel het pas om
  // bij de eerste synchronisatie. Het portfolio staat wel op een eigen demo-pad en is dus de echte
  // proef op de som, per omgeving.
  //
  // Allebei toetsen in plaats van alleen de actieve omgeving, want de sleutel is gedeeld: als er één
  // omgeving weigert wil je dat hier zien staan en niet pas dagen later bij het omschakelen.
  async function toetsOmgeving(paar: Sleutelpaar, omgeving: EtoroOmgeving): Promise<OmgevingToets> {
    try {
      const res = await haalEtoroPortfolio({ ...paar, omgeving } as EtoroSleutels);
      return { ok: true, posities: res.clientPortfolio?.positions?.length ?? 0 };
    } catch (e) {
      return { ok: false, fout: e instanceof Error ? e.message : 'Onbekende fout bij verbinden.' };
    }
  }

  async function testVerbinding() {
    if (testBezig.current) return;
    testBezig.current = true;
    const nummer = ++testNummer.current;
    try {
      await voerTestUit(nummer);
    } finally {
      // Een test die intussen vergeten is, is zijn vlag al kwijt, en mag die van een nieuwere test
      // niet vrijgeven.
      if (nummer === testNummer.current) testBezig.current = false;
    }
  }

  async function voerTestUit(nummer: number) {
    setTestStatus('testing');
    setUitslag(null);
    const paar: Sleutelpaar = { apiKey: apiKey.trim(), userKey: userKey.trim() };

    let magSchrijven: Record<EtoroOmgeving, boolean>;
    try {
      const account = await haalAccountInfo({ ...paar, omgeving: 'real' });
      magSchrijven = {
        real: magHandelenVolgensScopes(account.scopes, 'real'),
        demo: magHandelenVolgensScopes(account.scopes, 'demo'),
      };
    } catch (e) {
      // /me weigeren betekent dat de sleutel zelf niet klopt; dan hoeft de rest niet meer.
      if (nummer !== testNummer.current) return;
      const fout: KoppelUitslag = { soort: 'meFout', fout: e instanceof Error ? e.message : 'Onbekende fout bij verbinden.' };
      setUitslag(fout);
      setTestStatus('klaar');
      AccessibilityInfo.announceForAccessibility(testSamenvatting(fout));
      return;
    }

    const [real, demo] = await Promise.all([toetsOmgeving(paar, 'real'), toetsOmgeving(paar, 'demo')]);
    if (nummer !== testNummer.current) return;
    // Werkt er geen enkele omgeving, dan maakt bouwKoppelBeeld er het foutscherm van, met de fout
    // van allebei: één regel las als een probleem met één omgeving terwijl ze allebei weigerden.
    const nieuw: KoppelUitslag = { soort: 'getest', magSchrijven, omgeving: { real, demo } };
    setUitslag(nieuw);
    setTestStatus('klaar');
    AccessibilityInfo.announceForAccessibility(testSamenvatting(nieuw));
  }

  async function opslaan() {
    // Alleen een paar dat net getest is en ergens werkt. De velden kunnen hier niet anders zijn dan
    // bij de test: elke wijziging zet de uitslag terug op null.
    if (opslaanBezig.current) return;
    // Vastleggen vóór de await: alles hieronder werkt met deze uitslag, niet met wat de state
    // intussen is.
    const getest = uitslag;
    if (!getest || getest.soort !== 'getest' || !beeld?.kanOpslaan) return;
    opslaanBezig.current = true;
    setBezigOpslaan(true);
    try {
      // Een leessleutel wordt gewoon bewaard, hij ontgrendelt alleen het handelen niet.
      await bewaarSleutels({ apiKey: apiKey.trim(), userKey: userKey.trim(), magSchrijven: getest.magSchrijven });
    } catch (e) {
      // De sleutelkluis kan weigeren (toestel zonder schermvergrendeling, kapotte keystore). Dan is
      // er niets opgeslagen, en dat moet je weten: anders blijft de knop draaien en denk je dat het
      // gelukt is terwijl de koppeling er niet is.
      opslaanBezig.current = false;
      setBezigOpslaan(false);
      toonDialoog({
        variant: 'fout',
        titel: 'Opslaan mislukt',
        tekst: 'Je sleutels konden niet veilig op dit toestel worden opgeslagen.',
        details: e instanceof Error ? e.message : undefined,
        knoppen: [{ label: 'Oké' }],
      });
      return;
    }
    // Alleen lezen voor de tekst op het laatste scherm. Het verversen van schrijfrecht en posities
    // doet de aanroeper in onOpgeslagen (Instellingen en App.tsx allebei via setOmgeving), zodat er
    // één sync loopt en je daar niet op hoeft te wachten.
    try {
      setOmgevingNu(await haalOmgeving());
    } catch {
      // Dan blijft de tekst op demo staan, de standaard na een eerste koppeling.
    }
    opslaanBezig.current = false;
    setBezigOpslaan(false);
    setKlaarUitslag(getest);
    onOpgeslagen?.();
    setStap(STAP_KLAAR);
  }

  function verwijderKoppeling() {
    toonDialoog({
      variant: 'fout',
      titel: 'Koppeling verwijderen',
      tekst: 'Weet je zeker dat je je opgeslagen eToro-sleutel van dit toestel wilt wissen? Kader importeert en handelt daarna niets meer, niet in demo en niet in echt, tot je opnieuw koppelt.',
      knoppen: [
        {
          label: 'Verwijderen',
          soort: 'destructief',
          onDruk: async () => {
            await wisSleutels();
            setApiKey('');
            setUserKey('');
            setBestondKoppeling(false);
            setTestStatus('idle');
            onOpgeslagen?.();
            onSluiten();
          },
        },
        { label: 'Annuleren', soort: 'secundair' },
      ],
    });
  }

  function vorige() {
    // Tijdens het opslaan blijft alles staan: de kluis schrijft nog.
    if (bezigOpslaan) return;
    if (stap === STAP_TESTEN) {
      // Terug naar de sleutels is terug naar ongetest, ook vanaf het foutscherm.
      vergeetTest();
      setStap(STAP_PLAKKEN);
      return;
    }
    if (stap > STAP_KEUZE) setStap(stap - 1);
  }

  const kanVerderPlakken = apiKey.trim().length > 0 && userKey.trim().length > 0;

  function kop(titel: string, tekst: string) {
    return (
      <View style={styles.kop}>
        <Text style={[Type.overline, { color: colors.cta }]}>{`STAP ${stap + 1} VAN ${AANTAL_STAPPEN}`}</Text>
        <Text ref={titelRef} style={[styles.kopTitel, { color: colors.tekstPrimair }]} accessibilityRole="header">{titel}</Text>
        <Text style={[styles.kopTekst, { color: colors.tekstGedimd }]}>{tekst}</Text>
      </View>
    );
  }

  function inhoud() {
    if (stap === STAP_KEUZE) {
      return (
        <>
          {kop('Wat wil je met eToro doen?', 'Dit bepaalt welk soort sleutel je zo bij eToro aanmaakt. Je kunt het later wijzigen door een nieuwe sleutel te koppelen.')}
          <View accessibilityRole="radiogroup" style={styles.keuzes}>
          <KeuzeKaart
            gekozen={keuze === 'lezen'}
            onKies={() => setKeuze('lezen')}
            icoon={Eye}
            titel="Meekijken"
            tekst="Kader haalt je open posities en je historie op. Handelen vanuit Kader blijft uit. Sleutel: "
            sleutelSoort="Read"
          />
          <KeuzeKaart
            gekozen={keuze === 'schrijven'}
            onKies={() => setKeuze('schrijven')}
            icoon={ShoppingCart}
            titel="Meekijken en handelen"
            tekst="Kader kan ook orders plaatsen, maar alleen nadat jij elke order bevestigt. Je begint in demo. Sleutel: "
            sleutelSoort="Write"
          />
          </View>
          <View style={styles.kluis}>
            <Lock size={16} color={colors.winst} strokeWidth={1.75} style={styles.kluisIcoon} />
            <Text style={[Type.caption, styles.flexTekst, { color: colors.tekstGedimd }]}>
              De sleutel blijft op dit toestel, in de beveiligde opslag. Kader gebruikt hem alleen voor verzoeken aan eToro.
            </Text>
          </View>
          {bestondKoppeling && (
            <Drukbaar
              onPress={verwijderKoppeling}
              accessibilityRole="button"
              accessibilityLabel="Koppeling verwijderen"
              style={styles.verwijderKnop}
            >
              <Trash2 size={16} color={colors.verlies} strokeWidth={1.75} />
              <Text style={[Type.caption, { color: colors.verlies, fontWeight: '600' }]}>Koppeling verwijderen</Text>
            </Drukbaar>
          )}
        </>
      );
    }

    if (stap === STAP_MAKEN) {
      return (
        <>
          {kop('Maak een sleutel bij eToro', 'Dit doe je één keer, op de website van eToro. Houd dit scherm open, je komt hier terug.')}
          <View>
            <GenummerdeStap nummer={1} titel="Open API Key Management" tekst="Log in op eToro in je browser.">
              <View style={styles.pad}>
                {['Settings', 'Trading', 'API Key Management'].map((deel, i) => (
                  <React.Fragment key={deel}>
                    {i > 0 && <ChevronRight size={12} color={colors.tekstGedimd} strokeWidth={2} />}
                    <Text style={[styles.padDeel, { backgroundColor: colors.verhoogd, color: colors.tekstPrimair }]}>{deel}</Text>
                  </React.Fragment>
                ))}
              </View>
            </GenummerdeStap>
            <GenummerdeStap
              nummer={2}
              titel={keuze === 'schrijven' ? 'Maak een sleutel met Write' : 'Maak een sleutel met Read'}
              tekst={keuze === 'schrijven'
                ? 'Je koos meekijken en handelen. Een omgeving kies je niet: de sleutel werkt voor demo en echt.'
                : 'Je koos meekijken. Een omgeving kies je niet: de sleutel werkt voor demo en echt.'}
            />
            <GenummerdeStap nummer={3} titel="Voer de sms-code in" tekst="eToro stuurt een verificatiecode naar je telefoon." />
            <GenummerdeStap
              nummer={4}
              titel="Kopieer beide sleutels"
              tekst="De User Key toont eToro maar één keer. Kopieer hem meteen, anders moet je een nieuwe sleutel maken."
              tekstKleur={colors.letOp}
            />
          </View>
        </>
      );
    }

    if (stap === STAP_PLAKKEN) {
      return (
        <>
          {kop('Plak je sleutels', 'Kopieer ze bij eToro en tik op Plak. Kader controleert of het er als een sleutel uitziet.')}
          <SleutelKaart
            titel="Publieke sleutel"
            sub="Public API Key"
            waarde={apiKey}
            onChange={typApiKey}
            onPlak={() => plak('api')}
            zichtbaar={toonApiKey}
            onToggle={() => setToonApiKey(v => !v)}
            plakInfo={plakApi}
          />
          <SleutelKaart
            titel="Privésleutel"
            sub="User Key"
            waarde={userKey}
            onChange={typUserKey}
            onPlak={() => plak('user')}
            zichtbaar={toonUserKey}
            onToggle={() => setToonUserKey(v => !v)}
            plakInfo={plakUser}
            band={userKeyGewist ? 'Je plakte een nieuwe publieke sleutel, dus de oude User Key is weggehaald. Plak de User Key die bij deze sleutel hoort.' : null}
          />
        </>
      );
    }

    if (stap === STAP_TESTEN && foutScherm && beeld?.foutstaat) {
      const regels = beeld.foutstaat;
      return (
        <>
          {kop(
            'Deze sleutel werkt niet',
            uitslag?.soort === 'meFout'
              ? 'eToro herkent de sleutel niet. Meestal hoort de User Key bij een andere publieke sleutel.'
              : 'Geen van beide omgevingen accepteert hem. Meestal hoort de User Key bij een andere publieke sleutel.',
          )}
          <View style={[styles.testLijst, shadow.kaart, { backgroundColor: colors.kaart }]}>
            {regels.map((r, i) => (
              <TestRijWeergave
                key={`fout-${r.naam}`}
                index={i}
                laatste={i === regels.length - 1}
                staat="fout"
                titel={r.naam}
                sub={r.fout}
                waarde={null}
              />
            ))}
          </View>
          <View>
            <GenummerdeStap nummer={1} titel="Plak de User Key opnieuw" tekst="Van dezelfde sleutel als de publieke sleutel." />
            <GenummerdeStap nummer={2} titel="Geen User Key meer?" tekst="Maak bij eToro een nieuwe sleutel en kopieer beide velden meteen." />
          </View>
        </>
      );
    }

    if (stap === STAP_TESTEN) {
      const rijen = testStatus === 'klaar' && beeld ? beeld.rijen : null;
      const kanHandelen = rijen?.some(
        r => (r.id === 'schrijfDemo' || r.id === 'schrijfReal') && r.staat === 'ok',
      ) ?? false;
      return (
        <>
          {kop('We testen je sleutel', 'Kader probeert je posities op te halen in demo en in echt, en kijkt wat de sleutel mag.')}
          {/* Eén sleutel, twee deuren. Hier zie je per omgeving of hij opengaat, zodat een
              weigering aan één kant meteen zichtbaar is in plaats van pas bij het omschakelen. */}
          <View style={[styles.testLijst, shadow.kaart, { backgroundColor: colors.kaart }]}>
            {rijen
              ? rijen.map((r: TestRij, i) => (
                <TestRijWeergave
                  key={`uitslag-${r.id}`}
                  index={i}
                  laatste={i === rijen.length - 1}
                  staat={r.staat}
                  titel={r.titel}
                  sub={r.sub}
                  waarde={r.waarde}
                />
              ))
              : WACHT_TITELS.map((t, i) => (
                <TestRijWeergave
                  key={`wacht-${t}`}
                  index={i}
                  laatste={i === WACHT_TITELS.length - 1}
                  staat="wacht"
                  titel={t}
                  sub={null}
                  waarde={null}
                />
              ))}
          </View>
          {rijen && keuze === 'schrijven' && !kanHandelen && (
            <View style={styles.kluis}>
              <Info size={16} color={colors.tekstGedimd} strokeWidth={1.75} style={styles.kluisIcoon} />
              <Text style={[Type.caption, styles.flexTekst, { color: colors.tekstGedimd }]}>
                Deze sleutel mag alleen lezen. Wil je handelen, maak dan bij eToro een sleutel met Write.
              </Text>
            </View>
          )}
        </>
      );
    }

    // Laatste scherm: gekoppeld. Handelen volgt dezelfde regel als de testlijst: alleen in een
    // omgeving die werkt en waar de scope het toestaat.
    const toetsen = klaarUitslag?.soort === 'getest' ? klaarUitslag.omgeving : null;
    const klaarBeeld = klaarUitslag ? bouwKoppelBeeld(klaarUitslag) : null;
    const mag = (id: TestRij['id']) => klaarBeeld?.rijen.some(r => r.id === id && r.staat === 'ok') ?? false;
    const magDemo = mag('schrijfDemo');
    const magEcht = mag('schrijfReal');
    const handelTitel = magDemo && magEcht
      ? 'Handelen in demo en echt'
      : magDemo ? 'Handelen in demo' : magEcht ? 'Handelen in echt' : 'Alleen meekijken';
    return (
      <>
        <View style={styles.gekoppeld}>
          <GekoppeldVinkje />
          <Text ref={titelRef} style={[styles.kopTitel, styles.midden, { color: colors.tekstPrimair }]} accessibilityRole="header">
            eToro is gekoppeld
          </Text>
          <Text style={[styles.kopTekst, styles.midden, { color: colors.tekstGedimd }]}>
            {omgevingNu === 'demo'
              ? 'Kader haalt je posities nu op. Je staat op Demo; naar Echt wissel je in Instellingen.'
              : 'Kader haalt je posities nu op. Je staat op Echt.'}
          </Text>
        </View>
        <View style={styles.vondst}>
          <Vondst label="DEMO" naam="Demo" toets={toetsen?.demo ?? null} />
          <Vondst label="ECHT" naam="Echt" toets={toetsen?.real ?? null} />
        </View>
        <View style={[styles.groep, shadow.kaart, { backgroundColor: colors.kaart }]}>
          <View style={[styles.groepTegel, { backgroundColor: colors.verhoogd }]}>
            <ShieldCheck size={17} color={colors.tekstPrimair} strokeWidth={1.75} />
          </View>
          <View style={styles.flexTekst}>
            <Text style={[styles.rijTitel, { color: colors.tekstPrimair }]}>{handelTitel}</Text>
            {(magDemo || magEcht) && (
              <Text style={[styles.rijSub, { color: colors.tekstGedimd }]}>Elke order vraagt jouw bevestiging</Text>
            )}
          </View>
        </View>
      </>
    );
  }

  function voet(sluit: Sluit) {
    if (stap === STAP_KEUZE) {
      return <GrootKnop label="Verder" onPress={() => setStap(STAP_MAKEN)} />;
    }
    if (stap === STAP_MAKEN) {
      return (
        <>
          <GrootKnop
            label="Open eToro in je browser"
            variant="tweede"
            icoon={ExternalLink}
            onPress={() => { Linking.openURL('https://www.etoro.com').catch(() => {}); }}
          />
          <GrootKnop label="Ik heb mijn sleutels" onPress={() => setStap(STAP_PLAKKEN)} />
        </>
      );
    }
    if (stap === STAP_PLAKKEN) {
      return <GrootKnop label="Verder" uit={!kanVerderPlakken} onPress={() => setStap(STAP_TESTEN)} />;
    }
    if (stap === STAP_TESTEN) {
      if (foutScherm) return <GrootKnop label="Terug naar sleutels" onPress={vorige} />;
      if (testStatus === 'testing') return <GrootKnop label="Bezig met testen" uit onPress={() => {}} />;
      if (testStatus === 'klaar' && beeld?.kanOpslaan) {
        return <GrootKnop label="Opslaan" uit={bezigOpslaan} onPress={opslaan} />;
      }
      return <GrootKnop label="Test verbinding" onPress={testVerbinding} />;
    }
    if (!toonNaarPortfolio) return <GrootKnop label="Klaar" onPress={() => sluit()} />;
    return (
      <>
        <GrootKnop
          label="Naar portfolio"
          onPress={() => {
            // Niet terug de knop in: na het sluiten volgt een tabwissel.
            sluit({ naarBron: false });
            gaNaar({ soort: 'portfolio' });
          }}
        />
        <GrootKnop label="Klaar" variant="tweede" onPress={() => sluit()} />
      </>
    );
  }

  // Op het eerste en het laatste scherm is er geen vorige stap om naar terug te gaan: daar sluit
  // de knop linksboven. Op het laatste scherm is alles al bewaard.
  const metSluitKnop = stap === STAP_KEUZE || stap === STAP_KLAAR;
  // Het toetsenbord ligt over de voet heen; deze ruimte duwt de knoppen erboven. De onderste
  // veilige zone zit al in PodiumScherm, dus die gaat eraf.
  const toetsenbordRuimte = Math.max(0, toetsenbordHoogte - insets.bottom);

  return (
    <PodiumScherm
      zichtbaar={zichtbaar}
      onSluiten={onSluiten}
      // Android-terug doet hetzelfde als de knop linksboven: een stap terug, en alleen op de eerste
      // en laatste stap sluiten. Tijdens het opslaan gebeurt er niets, de kluis schrijft nog.
      onTerug={() => {
        if (bezigOpslaan) return true;
        if (metSluitKnop) return false;
        vorige();
        return true;
      }}
    >
      {(sluit) => (
        <View style={styles.root}>
          <View style={styles.top}>
            <Drukbaar
              onPress={() => {
                if (bezigOpslaan) return;
                if (metSluitKnop) sluit();
                else vorige();
              }}
              disabled={bezigOpslaan}
              accessibilityRole="button"
              accessibilityLabel={metSluitKnop ? 'Sluiten' : 'Vorige stap'}
              accessibilityState={{ disabled: bezigOpslaan }}
              style={styles.topKnop}
              schaal={0.9}
            >
              {metSluitKnop
                ? <X size={20} color={colors.tekstGedimd} strokeWidth={2} />
                : <ChevronLeft size={20} color={colors.tekstGedimd} strokeWidth={2} />}
            </Drukbaar>
            <VoortgangsBalk stap={stap + 1} aantal={AANTAL_STAPPEN} klaar={stap === STAP_KLAAR} />
            {/* De voortgangsbalk zegt de stap al hardop; dit label zou hem dubbel voorlezen. */}
            <Text
              style={[styles.topTeller, { color: colors.tekstGedimd }]}
              importantForAccessibility="no"
              accessibilityElementsHidden
            >
              {stap === STAP_KLAAR ? 'klaar' : `${stap + 1}/${AANTAL_STAPPEN}`}
            </Text>
          </View>

          <ScrollView
            style={styles.vul}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <StapOvergang stapIndex={stap * 2 + (foutScherm ? 1 : 0)} style={styles.stapInhoud}>
              {inhoud()}
            </StapOvergang>
          </ScrollView>

          <View style={[styles.voet, { backgroundColor: colors.achtergrond }]}>
            {voet(sluit)}
          </View>
          {toetsenbordRuimte > 0 && <View style={{ height: toetsenbordRuimte }} />}
        </View>
      )}
    </PodiumScherm>
  );
}

type Icoon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// De brede knop onderin. Uit is grijs en niet te bedienen, en dat hoort een schermlezer ook.
function GrootKnop({ label, onPress, variant = 'cta', uit = false, icoon: IcoonComp }: {
  label: string;
  onPress: () => void;
  variant?: 'cta' | 'tweede';
  uit?: boolean;
  icoon?: Icoon;
}) {
  const { colors } = useTheme();
  const tekstKleur = uit ? colors.tekstGedimd : variant === 'cta' ? '#FFFFFF' : colors.cta;
  return (
    <Drukbaar
      onPress={onPress}
      disabled={uit}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: uit }}
      style={[
        styles.grootKnop,
        uit
          ? { backgroundColor: colors.rand }
          : variant === 'cta'
            ? { backgroundColor: colors.cta }
            : { borderWidth: 1.5, borderColor: colors.cta },
      ]}
    >
      {IcoonComp && <IcoonComp size={17} color={tekstKleur} strokeWidth={2} />}
      <Text style={[styles.grootKnopLabel, { color: tekstKleur }]}>{label}</Text>
    </Drukbaar>
  );
}

function KeuzeKaart({ gekozen, onKies, icoon: IcoonComp, titel, tekst, sleutelSoort }: {
  gekozen: boolean;
  onKies: () => void;
  icoon: Icoon;
  titel: string;
  tekst: string;
  sleutelSoort: string;
}) {
  const { colors } = useTheme();
  return (
    <Drukbaar
      onPress={() => { if (!gekozen) onKies(); }}
      haptiek={gekozen ? undefined : 'tik'}
      accessibilityRole="radio"
      accessibilityState={{ checked: gekozen }}
      accessibilityLabel={`${titel}. ${tekst}${sleutelSoort}.`}
      style={[
        styles.keus,
        shadow.kaart,
        { backgroundColor: colors.kaart, borderColor: gekozen ? colors.cta : 'transparent' },
      ]}
    >
      <View style={[styles.keusTegel, { backgroundColor: gekozen ? colors.cta + '1F' : colors.verhoogd }]}>
        <IcoonComp size={20} color={gekozen ? colors.cta : colors.tekstPrimair} strokeWidth={1.75} />
      </View>
      <View style={styles.flexTekst}>
        <Text style={[styles.keusTitel, { color: colors.tekstPrimair }]}>{titel}</Text>
        <Text style={[styles.keusTekst, { color: colors.tekstGedimd }]}>
          {tekst}
          <Text style={[styles.keusSleutel, { color: colors.tekstPrimair }]}>{sleutelSoort}</Text>
          {'.'}
        </Text>
      </View>
      <View
        style={[
          styles.radio,
          { borderColor: gekozen ? colors.cta : colors.rand, borderWidth: gekozen ? 7 : 2 },
        ]}
      />
    </Drukbaar>
  );
}

function GenummerdeStap({ nummer, titel, tekst, tekstKleur, children }: {
  nummer: number;
  titel: string;
  tekst: string;
  tekstKleur?: string;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stapRij, { borderTopColor: colors.rand }]}>
      <View style={[styles.stapNummer, { backgroundColor: colors.verhoogd }]}>
        <Text style={[styles.stapNummerTekst, { color: colors.tekstPrimair }]}>{nummer}</Text>
      </View>
      <View style={styles.flexTekst}>
        <Text style={[styles.rijTitel, { color: colors.tekstPrimair }]}>{titel}</Text>
        <Text style={[styles.stapTekst, { color: tekstKleur ?? colors.tekstGedimd }]}>{tekst}</Text>
        {children}
      </View>
    </View>
  );
}

function SleutelKaart({ titel, sub, waarde, onChange, onPlak, zichtbaar, onToggle, plakInfo, band = null }: {
  titel: string;
  sub: string;
  waarde: string;
  onChange: (t: string) => void;
  onPlak: () => void;
  zichtbaar: boolean;
  onToggle: () => void;
  plakInfo: PlakInfo | null;
  band?: string | null;
}) {
  const { colors } = useTheme();
  const leeg = waarde.length === 0;
  return (
    <View style={[styles.sleutel, shadow.kaart, { backgroundColor: colors.kaart }]}>
      <View style={styles.sleutelKop}>
        <Text style={[styles.sleutelTitel, { color: colors.tekstPrimair }]}>{titel}</Text>
        <Text style={[Type.caption, styles.sleutelSub, { color: colors.tekstGedimd }]}>{sub}</Text>
      </View>
      {band && (
        <View style={[styles.band, { backgroundColor: colors.cta + '14' }]}>
          <Info size={16} color={colors.cta} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.flexTekst, { color: colors.cta }]}>{band}</Text>
        </View>
      )}
      <View style={[styles.veld, { backgroundColor: colors.verhoogd }]}>
        <TextInput
          style={[styles.invoer, { color: colors.tekstPrimair }]}
          value={waarde}
          onChangeText={onChange}
          placeholder="Nog niet geplakt"
          placeholderTextColor={colors.tekstGedimd}
          autoCapitalize="none"
          autoCorrect={false}
          importantForAutofill="no"
          secureTextEntry={!zichtbaar}
          // Zichtbaar zou Gboard de sleutel leren als woord; visible-password schakelt dat uit.
          keyboardType={zichtbaar && Platform.OS === 'android' ? 'visible-password' : 'default'}
          accessibilityLabel={titel}
        />
        <Drukbaar
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={zichtbaar ? `${titel} verbergen` : `${titel} tonen`}
          style={styles.oogKnop}
          schaal={0.9}
        >
          {zichtbaar
            ? <EyeOff size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
            : <Eye size={18} color={colors.tekstGedimd} strokeWidth={1.75} />}
        </Drukbaar>
        <PilKnop
          label="Plak"
          icoon={ClipboardPaste}
          variant={leeg ? 'cta' : 'tweede'}
          onPress={onPlak}
          accessibilityLabel={`${titel} plakken`}
        />
      </View>
      {plakInfo && (
        plakInfo.hint === null ? (
          <View style={styles.plakRegel} accessibilityLiveRegion="polite">
            <Check size={14} color={colors.winst} strokeWidth={2.5} />
            <Text style={[Type.caption, styles.flexTekst, { color: colors.tekstGedimd }]}>
              {plakRegel(plakInfo)}
            </Text>
          </View>
        ) : (
          <Text style={[Type.caption, { color: colors.tekstGedimd }]} accessibilityLiveRegion="polite">
            {plakRegel(plakInfo)}
          </Text>
        )
      )}
    </View>
  );
}

// Een rij in de testlijst. Nieuwe rijen komen gestaffeld binnen; onder Minder beweging staan ze er
// meteen.
function TestRijWeergave({ index, laatste, staat, titel, sub, waarde }: {
  index: number;
  laatste: boolean;
  staat: RijStaat | 'wacht';
  titel: string;
  sub: string | null;
  waarde: string | null;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const zicht = useSharedValue(reduceMotion ? 1 : 0);
  const schuif = useSharedValue(reduceMotion ? 0 : 8);

  useEffect(() => {
    if (reduceMotion) {
      zicht.value = 1;
      schuif.value = 0;
      return;
    }
    const wacht = staggerVertraging(index);
    zicht.value = withDelay(wacht, vervaag(1, duur.midden));
    schuif.value = withDelay(wacht, withSpring(0, veer.standaard));
    // Alleen bij het binnenkomen van de rij.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stijl = useAnimatedStyle(() => ({
    opacity: zicht.value,
    transform: [{ translateY: schuif.value }],
  }));

  const icoon = (() => {
    switch (staat) {
      case 'ok': return { Comp: Check, kleur: colors.winst, vlak: colors.winst + '24' };
      case 'fout': return { Comp: X, kleur: colors.verlies, vlak: colors.verlies + '24' };
      case 'nee': return { Comp: Minus, kleur: colors.tekstGedimd, vlak: colors.verhoogd };
      default: return { Comp: Clock, kleur: colors.tekstGedimd, vlak: colors.verhoogd };
    }
  })();
  const StatusIcoon = icoon.Comp;
  const toestand = staat === 'ok' ? 'gelukt' : staat === 'fout' ? 'mislukt' : staat === 'nee' ? 'niet toegestaan' : 'nog niet getest';

  return (
    <Animated.View
      style={[
        styles.testRij,
        !laatste && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rand },
        stijl,
      ]}
      accessible
      accessibilityLabel={[titel, toestand, sub, waarde].filter(Boolean).join(', ')}
    >
      <View style={[styles.statusIcoon, { backgroundColor: icoon.vlak }]}>
        <StatusIcoon size={14} color={icoon.kleur} strokeWidth={2.75} />
      </View>
      <View style={styles.flexTekst}>
        <Text style={[styles.rijTitel, { color: colors.tekstPrimair }]}>{titel}</Text>
        {sub !== null && <Text style={[styles.rijSub, { color: colors.tekstGedimd }]}>{sub}</Text>}
      </View>
      {waarde !== null && (
        <Text style={[styles.rijWaarde, { color: waarde === 'mag niet' ? colors.tekstGedimd : colors.tekstPrimair }]}>
          {waarde}
        </Text>
      )}
    </Animated.View>
  );
}

// Het vinkje op het laatste scherm popt binnen; onder Minder beweging vervaagt het alleen.
function GekoppeldVinkje() {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const zicht = useSharedValue(0);
  const schaal = useSharedValue(reduceMotion ? 1 : 0.6);

  useEffect(() => {
    zicht.value = vervaag(1, reduceMotion ? duur.midden : duur.kort);
    if (!reduceMotion) schaal.value = withSpring(1, veer.speels);
    // Alleen bij het verschijnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stijl = useAnimatedStyle(() => ({
    opacity: zicht.value,
    transform: [{ scale: schaal.value }],
  }));

  return (
    <Animated.View style={[styles.rondje, { backgroundColor: colors.winst + '24' }, stijl]}>
      <Check size={40} color={colors.winst} strokeWidth={2.5} />
    </Animated.View>
  );
}

// Eén vak met het aantal posities dat de test in een omgeving vond.
function Vondst({ label, naam, toets }: { label: string; naam: string; toets: OmgevingToets | null }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.vondstVak, shadow.kaart, { backgroundColor: colors.kaart }]}
      accessible
      accessibilityLabel={toets?.ok ? `${naam}: ${toets.posities} open posities` : `${naam}: werkt niet`}
    >
      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{label}</Text>
      <Text style={[styles.vondstGetal, { color: colors.tekstPrimair }]}>
        {toets?.ok ? String(toets.posities) : '-'}
      </Text>
      <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{toets?.ok ? 'open posities' : 'werkt niet'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  vul: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  topKnop: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  topTeller: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'right',
    paddingRight: spacing.md,
    flexShrink: 0,
  },
  scroll: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.base },
  stapInhoud: { gap: spacing.base },
  kop: { gap: 6, paddingTop: spacing.xs },
  kopTitel: {
    fontFamily: Fonts.sansSemiBold,
    fontWeight: '600',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  kopTekst: { fontFamily: Fonts.sansRegular, fontSize: 15, lineHeight: 22 },
  midden: { textAlign: 'center' },
  flexTekst: { flex: 1, flexShrink: 1 },
  keuzes: { gap: spacing.base },
  keus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    minHeight: 44,
  },
  keusTegel: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  keusTitel: { fontFamily: Fonts.sansSemiBold, fontWeight: '600', fontSize: 16, lineHeight: 22 },
  keusTekst: { fontFamily: Fonts.sansMedium, fontSize: 13, lineHeight: 19 },
  keusSleutel: { fontFamily: Fonts.sansSemiBold, fontWeight: '600' },
  radio: { width: 22, height: 22, borderRadius: 11, marginTop: 9 },
  kluis: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: spacing.xs },
  kluisIcoon: { marginTop: 1 },
  verwijderKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  stapRij: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stapNummer: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stapNummerTekst: { fontFamily: Fonts.monoMedium, fontSize: 13 },
  stapTekst: { fontFamily: Fonts.sansMedium, fontSize: 13, lineHeight: 19 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: 6 },
  padDeel: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11.5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  sleutel: { borderRadius: 18, padding: 14, gap: 10 },
  sleutelKop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  sleutelTitel: { fontFamily: Fonts.sansSemiBold, fontWeight: '600', fontSize: 15, flexShrink: 1 },
  sleutelSub: { flexShrink: 1, textAlign: 'right' },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
  },
  veld: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.knop,
    minHeight: 48,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  invoer: {
    flex: 1,
    minHeight: 44,
    fontFamily: Fonts.monoRegular,
    fontSize: 14,
    paddingVertical: spacing.sm,
  },
  oogKnop: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  plakRegel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  testLijst: { borderRadius: 18, paddingVertical: spacing.xs, paddingHorizontal: 14 },
  testRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  statusIcoon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rijTitel: { fontFamily: Fonts.sansSemiBold, fontWeight: '600', fontSize: 14, lineHeight: 19 },
  rijSub: { fontFamily: Fonts.sansMedium, fontSize: 12.5, lineHeight: 17 },
  rijWaarde: { fontFamily: Fonts.monoMedium, fontSize: 13, fontVariant: ['tabular-nums'], flexShrink: 0 },
  gekoppeld: { alignItems: 'center', gap: 10, paddingTop: 28 },
  rondje: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  vondst: { flexDirection: 'row', gap: spacing.sm },
  vondstVak: { flex: 1, borderRadius: 16, padding: 14, gap: 2 },
  vondstGetal: { fontFamily: Fonts.monoMedium, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'] },
  groep: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 18, padding: 14 },
  groepTegel: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  voet: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.base, gap: spacing.sm },
  grootKnop: {
    minHeight: 52,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  grootKnopLabel: { fontFamily: Fonts.sansSemiBold, fontWeight: '600', fontSize: 16, textAlign: 'center', flexShrink: 1 },
});
