import React, { useEffect, useState } from 'react';
import {
  Modal, ScrollView, View, Text, Pressable, TextInput, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X, ArrowRight, Eye, EyeOff, CheckCircle, XCircle, Link2, ShieldCheck, Trash2,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useModalKopruimte } from '../theme/useModalKopruimte';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { EtoroOmgeving, EtoroSleutels, haalAccountInfo, haalEtoroPortfolio, magHandelenVolgensScopes } from '../engine/etoro';
import { bewaarSleutels, haalSleutels, wisSleutels, Sleutelpaar } from '../state/etoroSleutels';
import { userKeyBijApiKeyWijziging } from '../engine/sleutelKeuze';
import { StapOvergang } from './StapOvergang';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  onOpgeslagen?: () => void;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'fout';

const HOE_STAPPEN = [
  'Log in op eToro (web) en ga naar Settings > Trading > API Key Management.',
  'Maak een sleutel aan en kies Read of Write. Met Read kan Kader alleen je posities ophalen; Write is nodig om vanuit Kader te kunnen handelen.',
  'Voer de verificatiecode in die je per sms op je telefoon ontvangt.',
  'eToro toont daarna twee sleutels: een publieke sleutel (Public API Key) en een privésleutel (User Key). De User Key krijg je maar één keer te zien, dus kopieer hem meteen.',
  'Je kiest bij het aanmaken geen omgeving: dezelfde sleutel werkt voor demo en voor echt. Je vult hem dus maar één keer in.',
];

const AANTAL_STAPPEN = 4;

// Uitkomst van de portfolio-toets per omgeving. Het portfolio heeft, anders dan /me, wél een eigen
// demo-pad, dus dit is de enige manier om te zien of een sleutel het in een omgeving echt doet.
interface OmgevingUitslag {
  ok: boolean;
  fout: string;
}

const GEEN_SCHRIJFRECHT: Record<EtoroOmgeving, boolean> = { real: false, demo: false };

export function EtoroKoppelingWizard({ zichtbaar, onSluiten, onOpgeslagen }: Props) {
  const { colors } = useTheme();
  const extraKopruimte = useModalKopruimte();
  const [stap, setStap] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [userKey, setUserKey] = useState('');
  const [toonApiKey, setToonApiKey] = useState(false);
  const [toonUserKey, setToonUserKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testFout, setTestFout] = useState('');
  const [bezigOpslaan, setBezigOpslaan] = useState(false);
  const [bestondKoppeling, setBestondKoppeling] = useState(false);
  // Het paar zoals het bij het openen op het toestel stond. Nodig om te zien of iemand een NIEUWE
  // publieke sleutel plakt, want dan hoort de opgeslagen User Key er niet meer bij.
  const [geladen, setGeladen] = useState<Sleutelpaar | null>(null);
  // Is de voorgevulde User Key weggehaald omdat de publieke sleutel veranderde? Dan moet stap 2
  // uitleggen waarom het veld ineens leeg is, anders lijkt het een bug.
  const [userKeyGewist, setUserKeyGewist] = useState(false);
  // Wat de sleutel volgens eToro mag, uit de scopes van /api/v1/me. Per omgeving, want één sleutel
  // kan schrijfrecht op de ene omgeving dragen en alleen leesrecht op de andere. Pas bekend na een
  // geslaagde test.
  const [magSchrijven, setMagSchrijven] = useState<Record<EtoroOmgeving, boolean>>(GEEN_SCHRIJFRECHT);
  // Per omgeving of het portfolio opgehaald kon worden. null zolang er niet getest is.
  const [uitslag, setUitslag] = useState<Record<EtoroOmgeving, OmgevingUitslag> | null>(null);

  // Laad bestaande sleutels en reset naar stap 0 telkens als de wizard opent.
  useEffect(() => {
    if (!zichtbaar) return;
    setStap(0);
    setTestStatus('idle');
    setTestFout('');
    setMagSchrijven(GEEN_SCHRIJFRECHT);
    setUitslag(null);
    setToonApiKey(false);
    setToonUserKey(false);
    setUserKeyGewist(false);
    haalSleutels().then(s => {
      setApiKey(s?.apiKey ?? '');
      setUserKey(s?.userKey ?? '');
      setBestondKoppeling(s !== null);
      setGeladen(s);
    });
  }, [zichtbaar]);

  // Plak je een andere publieke sleutel dan die er stond, dan hoort de opgeslagen User Key daar niet
  // meer bij: eToro geeft bij een nieuwe sleutel ook een nieuwe User Key, en toont die precies één
  // keer. Tot nu toe bleef de oude User Key gewoon voorgevuld staan, gemaskeerd als bolletjes, dus
  // stap 2 zag er ingevuld uit en je klikte eroverheen. Het resultaat was een nieuwe api-sleutel
  // naast een oude User Key, en dus een 401 die pas bij de verbindingstest opdook met een melding
  // die je vertelde te doen wat je net gedaan dacht te hebben. Nu maakt de app het veld leeg.
  function wijzigApiKey(waarde: string) {
    setApiKey(waarde);
    const wissel = userKeyBijApiKeyWijziging(geladen, waarde, userKey, userKeyGewist);
    setUserKey(wissel.userKey);
    setUserKeyGewist(wissel.gewist);
  }

  const isLaatste = stap === AANTAL_STAPPEN - 1;
  const kanVolgende =
    (stap === 1 && apiKey.trim().length > 0) ||
    (stap === 2 && userKey.trim().length > 0) ||
    stap === 0;

  function volgende() {
    if (!isLaatste) setStap(v => v + 1);
  }
  function vorige() {
    if (stap > 0) setStap(v => v - 1);
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
  async function toetsOmgeving(paar: Sleutelpaar, omgeving: EtoroOmgeving): Promise<OmgevingUitslag> {
    try {
      await haalEtoroPortfolio({ ...paar, omgeving } as EtoroSleutels);
      return { ok: true, fout: '' };
    } catch (e) {
      return { ok: false, fout: e instanceof Error ? e.message : 'Onbekende fout bij verbinden.' };
    }
  }

  async function testVerbinding() {
    setTestStatus('testing');
    setTestFout('');
    setUitslag(null);
    const paar: Sleutelpaar = { apiKey: apiKey.trim(), userKey: userKey.trim() };

    try {
      const account = await haalAccountInfo({ ...paar, omgeving: 'real' });
      setMagSchrijven({
        real: magHandelenVolgensScopes(account.scopes, 'real'),
        demo: magHandelenVolgensScopes(account.scopes, 'demo'),
      });
    } catch (e) {
      // /me weigeren betekent dat de sleutel zelf niet klopt; dan hoeft de rest niet meer.
      setMagSchrijven(GEEN_SCHRIJFRECHT);
      setTestFout(e instanceof Error ? e.message : 'Onbekende fout bij verbinden.');
      setTestStatus('fout');
      return;
    }

    const [real, demo] = await Promise.all([toetsOmgeving(paar, 'real'), toetsOmgeving(paar, 'demo')]);
    setUitslag({ real, demo });

    // Werkt er geen enkele omgeving, dan is er niets om op te slaan. Toon dat het er ook echt twee
    // waren: hiervoor stond hier alleen real.fout, en die tekst noemt je "echte account" en zegt dat
    // het niet aan de schakelaar ligt. Dat las als een probleem met één omgeving terwijl allebei
    // weigerden, en het verzweeg een demo-fout die iets anders kon zeggen dan de echte.
    if (!real.ok && !demo.ok) {
      const zelfde = real.fout === demo.fout;
      setTestFout(
        zelfde
          ? `Geen van beide omgevingen accepteert deze sleutel. ${real.fout}`
          : `Geen van beide omgevingen accepteert deze sleutel.\n\nEcht: ${real.fout}\n\nDemo: ${demo.fout}`,
      );
      setTestStatus('fout');
      return;
    }
    setTestStatus('ok');
  }

  async function opslaanEnKlaar() {
    setBezigOpslaan(true);
    try {
      // Een leessleutel wordt gewoon bewaard, hij ontgrendelt alleen het handelen niet.
      await bewaarSleutels({ apiKey: apiKey.trim(), userKey: userKey.trim(), magSchrijven });
    } catch (e) {
      // De sleutelkluis kan weigeren (toestel zonder schermvergrendeling, kapotte keystore). Dan is
      // er niets opgeslagen, en dat moet je weten: anders blijft de knop draaien en denk je dat het
      // gelukt is terwijl de koppeling er niet is.
      setBezigOpslaan(false);
      Alert.alert(
        'Opslaan mislukt',
        `Je sleutels konden niet veilig op dit toestel worden opgeslagen. ${e instanceof Error ? e.message : ''}`.trim(),
      );
      return;
    }
    setBezigOpslaan(false);
    onOpgeslagen?.();
    onSluiten();
  }

  function verwijderKoppeling() {
    Alert.alert(
      'Koppeling verwijderen',
      'Weet je zeker dat je je opgeslagen eToro-sleutel van dit toestel wilt wissen? Kader importeert en handelt daarna niets meer, niet in demo en niet in echt, tot je opnieuw koppelt.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            await wisSleutels();
            setApiKey('');
            setUserKey('');
            setBestondKoppeling(false);
            setTestStatus('idle');
            onOpgeslagen?.();
            onSluiten();
          },
        },
      ],
    );
  }

  return (
    <Modal visible={zichtbaar} animationType="slide" onRequestClose={onSluiten} presentationStyle="fullScreen">
      <SafeAreaView style={[styles.root, { backgroundColor: colors.achtergrond }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.rand, paddingTop: spacing.base + extraKopruimte }]}>
          <View style={styles.headerLinks}>
            <Link2 size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
            <Text style={[Type.titel, { color: colors.tekstPrimair }]}>eToro-koppeling</Text>
          </View>
          <Pressable
            onPress={onSluiten}
            style={styles.sluitKnop}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
            hitSlop={8}
          >
            <X size={22} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        </View>

        {/* Stap-indicator */}
        <View style={styles.dots}>
          {Array.from({ length: AANTAL_STAPPEN }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === stap ? colors.cta : colors.rand,
                  width: i === stap ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StapOvergang stapIndex={stap}>
          {stap === 0 && (
            <>
              <Text style={[Type.sectiekop, styles.kop, { color: colors.tekstPrimair }]}>Wat doet deze koppeling?</Text>
              <Text style={[Type.body, styles.body, { color: colors.tekstGedimd }]}>
                Kader haalt met één API-sleutel je open crypto-posities op uit eToro. Dezelfde sleutel werkt voor
                je oefenaccount en voor je echte account; welke van de twee Kader gebruikt kies je zelf bij
                Instellingen, onder Handelsomgeving. De sleutel blijft alleen op dit toestel, in de beveiligde
                opslag.
              </Text>
              <View style={[styles.infoBlok, { backgroundColor: colors.verhoogd }]}>
                <ShieldCheck size={18} color={colors.winst} strokeWidth={1.75} />
                <Text style={[Type.caption, { color: colors.tekstGedimd, flex: 1, lineHeight: 18 }]}>
                  Met een Write-sleutel kan Kader ook orders plaatsen, maar alleen nadat jij per order op
                  bevestigen drukt. De app staat standaard in demo. Wil je dat niet, kies dan Read: dan
                  blijft het bij meekijken.
                </Text>
              </View>
              <Text style={[Type.overline, styles.label, { color: colors.tekstGedimd }]}>ZO VIND JE JE SLEUTELS</Text>
              {HOE_STAPPEN.map((s, i) => (
                <Text key={i} style={[Type.caption, styles.hoeStap, { color: colors.tekstGedimd }]}>
                  {i + 1}. {s}
                </Text>
              ))}

              {bestondKoppeling && (
                <Pressable
                  onPress={verwijderKoppeling}
                  accessibilityRole="button"
                  accessibilityLabel="Koppeling verwijderen"
                  style={styles.verwijderKnop}
                >
                  <Trash2 size={16} color={colors.verlies} strokeWidth={1.75} />
                  <Text style={[Type.caption, { color: colors.verlies, fontWeight: '600' }]}>Koppeling verwijderen</Text>
                </Pressable>
              )}
            </>
          )}

          {stap === 1 && (
            <>
              <Text style={[Type.sectiekop, styles.kop, { color: colors.tekstPrimair }]}>Publieke sleutel</Text>
              <Text style={[Type.body, styles.body, { color: colors.tekstGedimd }]}>
                De app-niveau sleutel, door eToro "Public API Key" of "publieke sleutel" genoemd. Plak hem hieronder.
              </Text>
              <SleutelVeld
                waarde={apiKey}
                onChange={wijzigApiKey}
                placeholder="plak hier je publieke sleutel / api key"
                zichtbaar={toonApiKey}
                onToggle={() => setToonApiKey(v => !v)}
              />
            </>
          )}

          {stap === 2 && (
            <>
              <Text style={[Type.sectiekop, styles.kop, { color: colors.tekstPrimair }]}>Privésleutel</Text>
              <Text style={[Type.body, styles.body, { color: colors.tekstGedimd }]}>
                Aan jouw account gekoppeld, door eToro "User Key" of "privésleutel" genoemd. Plak hem hieronder.
              </Text>
              {userKeyGewist && (
                <View style={[styles.infoBlok, { backgroundColor: colors.verhoogd }]}>
                  <ShieldCheck size={18} color={colors.cta} strokeWidth={1.75} />
                  <Text style={[Type.caption, { color: colors.tekstGedimd, flex: 1, lineHeight: 18 }]}>
                    Je hebt een andere publieke sleutel ingevuld, dus je oude User Key is weggehaald: die
                    hoort bij de vorige sleutel. Plak de User Key die eToro liet zien toen je deze sleutel
                    aanmaakte. Heb je hem niet bewaard, maak dan bij eToro een nieuwe sleutel aan en
                    kopieer beide velden meteen.
                  </Text>
                </View>
              )}
              <SleutelVeld
                waarde={userKey}
                onChange={setUserKey}
                placeholder="plak hier je privésleutel / user key"
                zichtbaar={toonUserKey}
                onToggle={() => setToonUserKey(v => !v)}
              />
            </>
          )}

          {stap === 3 && (
            <>
              <Text style={[Type.sectiekop, styles.kop, { color: colors.tekstPrimair }]}>Testen en bevestigen</Text>
              <Text style={[Type.body, styles.body, { color: colors.tekstGedimd }]}>
                Controleer de verbinding met eToro voordat je opslaat. Zo weet je zeker dat de sleutels kloppen.
              </Text>

              <Pressable
                style={[styles.testKnop, { borderColor: colors.cta }]}
                onPress={testVerbinding}
                disabled={testStatus === 'testing'}
                accessibilityRole="button"
                accessibilityLabel="Test verbinding"
              >
                {testStatus === 'testing'
                  ? <ActivityIndicator size="small" color={colors.cta} />
                  : <Text style={[Type.body, { color: colors.cta, fontWeight: '600' }]}>Test verbinding</Text>}
              </Pressable>

              {testStatus === 'ok' && (
                <>
                  <View style={styles.testRij}>
                    <CheckCircle size={16} color={colors.winst} strokeWidth={1.75} />
                    <Text style={[Type.caption, { color: colors.winst, flex: 1 }]}>Verbinding OK, je sleutel werkt.</Text>
                  </View>

                  {/* Eén sleutel, twee deuren. Hier zie je per omgeving of hij opengaat, zodat een
                      weigering aan één kant meteen zichtbaar is in plaats van pas bij het omschakelen. */}
                  {uitslag && (['demo', 'real'] as EtoroOmgeving[]).map(o => {
                    const naam = o === 'demo' ? 'Demo' : 'Echt';
                    const werkt = uitslag[o].ok;
                    return (
                      <View key={o} style={styles.testRij}>
                        {werkt
                          ? <CheckCircle size={16} color={colors.winst} strokeWidth={1.75} />
                          : <XCircle size={16} color={colors.letOp} strokeWidth={1.75} />}
                        <Text style={[Type.caption, { color: colors.tekstGedimd, flex: 1, lineHeight: 18 }]}>
                          {werkt
                            ? `${naam}: je posities ophalen werkt, ${magSchrijven[o] ? 'en handelen mag' : 'handelen mag niet'}.`
                            : `${naam}: eToro geeft hier niets terug. ${uitslag[o].fout}`}
                        </Text>
                      </View>
                    );
                  })}

                  <View style={styles.testRij}>
                    <ShieldCheck
                      size={16}
                      color={magSchrijven.real || magSchrijven.demo ? colors.letOp : colors.tekstGedimd}
                      strokeWidth={1.75}
                    />
                    <Text style={[Type.caption, { color: colors.tekstGedimd, flex: 1, lineHeight: 18 }]}>
                      {magSchrijven.real || magSchrijven.demo
                        ? 'Kader plaatst alleen een order nadat jij die bevestigt.'
                        : 'Deze sleutel mag alleen lezen. Je posities komen binnen, maar handelen vanuit Kader blijft uit.'}
                    </Text>
                  </View>
                </>
              )}
              {testStatus === 'fout' && (
                <View style={styles.testRij}>
                  <XCircle size={16} color={colors.verlies} strokeWidth={1.75} />
                  <Text style={[Type.caption, { color: colors.verlies, flex: 1 }]}>{testFout}</Text>
                </View>
              )}

              <Pressable
                style={[
                  styles.opslaanKnop,
                  { backgroundColor: testStatus === 'ok' ? colors.winst : colors.rand },
                ]}
                onPress={opslaanEnKlaar}
                disabled={testStatus !== 'ok' || bezigOpslaan}
                accessibilityRole="button"
                accessibilityLabel="Opslaan en klaar"
              >
                {bezigOpslaan
                  ? <ActivityIndicator size="small" color="white" />
                  : (
                    <Text style={[Type.body, { color: testStatus === 'ok' ? 'white' : colors.tekstGedimd, fontWeight: '600' }]}>
                      Opslaan & klaar
                    </Text>
                  )}
              </Pressable>
              {testStatus !== 'ok' && (
                <Text style={[Type.caption, styles.hint, { color: colors.tekstGedimd }]}>
                  Test eerst de verbinding om op te kunnen slaan.
                </Text>
              )}
            </>
          )}
          </StapOvergang>
        </ScrollView>

        {/* Navigatie */}
        <View style={[styles.navigatie, { borderTopColor: colors.rand }]}>
          {stap > 0 ? (
            <Pressable
              style={[styles.vorigeKnop, { borderColor: colors.rand }]}
              onPress={vorige}
              accessibilityRole="button"
              accessibilityLabel="Vorige stap"
            >
              <Text style={[Type.body, { color: colors.tekstGedimd }]}>Vorige</Text>
            </Pressable>
          ) : (
            <View />
          )}

          {!isLaatste ? (
            <Pressable
              style={[styles.volgendKnop, { backgroundColor: kanVolgende ? colors.cta : colors.rand }]}
              onPress={volgende}
              disabled={!kanVolgende}
              accessibilityRole="button"
              accessibilityLabel="Volgende stap"
            >
              <Text style={[Type.body, { color: kanVolgende ? 'white' : colors.tekstGedimd, fontWeight: '600' }]}>Volgende</Text>
              <ArrowRight size={16} color={kanVolgende ? 'white' : colors.tekstGedimd} strokeWidth={2} />
            </Pressable>
          ) : (
            <View />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function SleutelVeld({ waarde, onChange, placeholder, zichtbaar, onToggle }: {
  waarde: string;
  onChange: (t: string) => void;
  placeholder: string;
  zichtbaar: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.inputRij}>
      <TextInput
        style={[styles.input, styles.inputMetOog, {
          backgroundColor: colors.verhoogd,
          borderColor: colors.rand,
          color: colors.tekstPrimair,
        }]}
        value={waarde}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.tekstGedimd}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={!zichtbaar}
      />
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={zichtbaar ? 'Sleutel verbergen' : 'Sleutel tonen'}
        style={styles.oogKnop}
      >
        {zichtbaar
          ? <EyeOff size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
          : <Eye size={18} color={colors.tekstGedimd} strokeWidth={1.75} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  dot: { height: 8, borderRadius: radii.pill },
  scroll: { paddingHorizontal: spacing.base, paddingBottom: spacing.xl },
  kop: { marginBottom: spacing.sm },
  body: { lineHeight: 24, marginBottom: spacing.base },
  infoBlok: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.veld,
    marginBottom: spacing.base,
  },
  label: { marginTop: spacing.sm, marginBottom: spacing.sm },
  hoeStap: { lineHeight: 20, marginBottom: spacing.sm },
  inputRij: { position: 'relative', justifyContent: 'center' },
  inputMetOog: { paddingRight: 44 },
  input: {
    borderWidth: 1,
    borderRadius: radii.veld,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    minHeight: 44,
  },
  oogKnop: { position: 'absolute', right: 4, minHeight: 44, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  testKnop: {
    borderWidth: 1.5,
    borderRadius: radii.knop,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  testRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  opslaanKnop: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  hint: { textAlign: 'center', marginTop: spacing.sm },
  verwijderKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  navigatie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  vorigeKnop: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    borderWidth: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volgendKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    minHeight: 44,
  },
});
