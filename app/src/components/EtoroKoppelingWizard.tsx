import React, { useEffect, useState } from 'react';
import {
  Modal, ScrollView, View, Text, Pressable, TextInput, StyleSheet,
  ActivityIndicator, Platform, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X, ArrowRight, Eye, EyeOff, CheckCircle, XCircle, Link2, ShieldCheck, Trash2,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { laadTekst, bewaarTekst, verwijderSleutel, SLEUTELS } from '../storage/opslag';
import { haalEtoroPortfolio } from '../engine/etoro';
import { StapOvergang } from './StapOvergang';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  onOpgeslagen?: () => void;
}

// SafeAreaView krijgt geen correcte top-inset binnen een full-screen Modal op Android,
// dus vullen we die hier handmatig aan met de status bar-hoogte.
const androidStatusBarPadding = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

type TestStatus = 'idle' | 'testing' | 'ok' | 'fout';

const HOE_STAPPEN = [
  'Log in op eToro (web) en ga naar Settings > Trading > API Key Management.',
  'Maak een sleutel aan: kies Read (niet Write) en Real (niet Demo).',
  'Voer de verificatiecode in die je op je telefoon ontvangt.',
  'eToro toont daarna twee sleutels: een publieke sleutel (Public API Key) en een privésleutel (User Key).',
];

const AANTAL_STAPPEN = 4;

export function EtoroKoppelingWizard({ zichtbaar, onSluiten, onOpgeslagen }: Props) {
  const { colors } = useTheme();
  const [stap, setStap] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [userKey, setUserKey] = useState('');
  const [toonApiKey, setToonApiKey] = useState(false);
  const [toonUserKey, setToonUserKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testFout, setTestFout] = useState('');
  const [bezigOpslaan, setBezigOpslaan] = useState(false);
  const [bestondKoppeling, setBestondKoppeling] = useState(false);

  // Laad bestaande sleutels en reset naar stap 0 telkens als de wizard opent.
  useEffect(() => {
    if (!zichtbaar) return;
    setStap(0);
    setTestStatus('idle');
    setTestFout('');
    setToonApiKey(false);
    setToonUserKey(false);
    Promise.all([
      laadTekst(SLEUTELS.etoroApiKey, ''),
      laadTekst(SLEUTELS.etoroUserKey, ''),
    ]).then(([a, u]) => {
      setApiKey(a);
      setUserKey(u);
      setBestondKoppeling(Boolean(a && u));
    });
  }, [zichtbaar]);

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

  async function testVerbinding() {
    setTestStatus('testing');
    setTestFout('');
    try {
      await haalEtoroPortfolio({ apiKey: apiKey.trim(), userKey: userKey.trim() });
      setTestStatus('ok');
    } catch (e) {
      setTestFout(e instanceof Error ? e.message : 'Onbekende fout bij verbinden.');
      setTestStatus('fout');
    }
  }

  async function opslaanEnKlaar() {
    setBezigOpslaan(true);
    await bewaarTekst(SLEUTELS.etoroApiKey, apiKey.trim());
    await bewaarTekst(SLEUTELS.etoroUserKey, userKey.trim());
    setBezigOpslaan(false);
    onOpgeslagen?.();
    onSluiten();
  }

  function verwijderKoppeling() {
    Alert.alert(
      'Koppeling verwijderen',
      'Weet je zeker dat je de opgeslagen eToro-sleutels van dit toestel wilt wissen? Je importeert daarna niets meer tot je opnieuw koppelt.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            await Promise.all([
              verwijderSleutel(SLEUTELS.etoroApiKey),
              verwijderSleutel(SLEUTELS.etoroUserKey),
            ]);
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
        <View style={[styles.header, { borderBottomColor: colors.rand, paddingTop: spacing.base + androidStatusBarPadding }]}>
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
                Kader haalt met een alleen-lezen API-sleutel je open crypto-posities op uit eToro. Kader kan niets kopen, verkopen of wijzigen. De sleutels blijven alleen op dit toestel.
              </Text>
              <View style={[styles.infoBlok, { backgroundColor: colors.verhoogd }]}>
                <ShieldCheck size={18} color={colors.winst} strokeWidth={1.75} />
                <Text style={[Type.caption, { color: colors.tekstGedimd, flex: 1, lineHeight: 18 }]}>
                  Kies bij het aanmaken bewust "Read" en "Real", niet "Write".
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
                onChange={setApiKey}
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
                <View style={styles.testRij}>
                  <CheckCircle size={16} color={colors.winst} strokeWidth={1.75} />
                  <Text style={[Type.caption, { color: colors.winst }]}>Verbinding OK, je sleutels werken.</Text>
                </View>
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
