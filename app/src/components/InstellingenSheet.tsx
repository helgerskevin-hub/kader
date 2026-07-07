import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TextInput } from 'react-native';
import { X, Smartphone, Sun, Moon, FileText, Link2, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react-native';
import { useTheme, ThemaModus } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { ChangelogSheet } from './ChangelogSheet';
import { laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import { haalEtoroPortfolio } from '../engine/etoro';
import { useToetsenbordHoogte } from '../theme/useToetsenbordHoogte';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
}

const OPTIES: { modus: ThemaModus; label: string; Icon: typeof Sun }[] = [
  { modus: 'systeem', label: 'Systeem', Icon: Smartphone },
  { modus: 'licht', label: 'Licht', Icon: Sun },
  { modus: 'donker', label: 'Donker', Icon: Moon },
];

export function InstellingenSheet({ zichtbaar, onSluiten }: Props) {
  const { colors, modus, setModus } = useTheme();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const toetsenbordHoogte = useToetsenbordHoogte();

  return (
    <>
    <Modal visible={zichtbaar && !changelogOpen} animationType="slide" transparent onRequestClose={onSluiten}>
      <View style={styles.overlay}>
        <View style={[
          styles.vel, shadow.modal,
          { backgroundColor: colors.kaart, paddingBottom: Math.max(spacing.xl, toetsenbordHoogte) },
        ]}>
          <View style={styles.titelRij}>
            <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Instellingen</Text>
            <Pressable
              onPress={onSluiten}
              accessibilityLabel="Sluiten"
              accessibilityRole="button"
              style={styles.sluitKnop}
            >
              <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
            </Pressable>
          </View>

          <Text style={[Type.overline, styles.label, { color: colors.tekstGedimd }]}>WEERGAVE</Text>
          <View style={styles.opties}>
            {OPTIES.map(({ modus: optieModus, label, Icon }) => {
              const actief = modus === optieModus;
              return (
                <Pressable
                  key={optieModus}
                  onPress={() => setModus(optieModus)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actief }}
                  accessibilityLabel={label}
                  style={[
                    styles.optie,
                    {
                      backgroundColor: actief ? colors.cta + '1A' : colors.verhoogd,
                      borderColor: actief ? colors.cta : colors.rand,
                    },
                  ]}
                >
                  <Icon size={20} color={actief ? colors.cta : colors.tekstGedimd} strokeWidth={1.75} />
                  <Text style={[Type.caption, { color: actief ? colors.cta : colors.tekstGedimd, marginTop: spacing.xs }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <EtoroKoppelingSectie />

          <View style={[styles.menuGroep, { borderTopColor: colors.rand }]}>
            <Pressable
              onPress={() => setChangelogOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Wijzigingen"
              style={styles.menuKnop}
            >
              <FileText size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
              <Text style={[Type.body, { color: colors.tekstPrimair }]}>Wijzigingen</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    <ChangelogSheet zichtbaar={changelogOpen} onSluiten={() => setChangelogOpen(false)} />
    </>
  );
}

const ETORO_STAPPEN = [
  'Log in op eToro (web) en ga naar Settings > Trading > API Key Management.',
  'Maak een sleutel aan: kies Read (niet Write) en Real (niet Demo).',
  'Voer de verificatiecode in die je op je telefoon ontvangt.',
  'eToro toont daarna twee sleutels: een publieke sleutel (Public API Key) en een privésleutel (User Key). Plak ze hieronder bij het bijpassende veld.',
];

function EtoroKoppelingSectie() {
  const { colors } = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [userKey, setUserKey] = useState('');
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [bewerken, setBewerken] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fout'>('idle');
  const [testFout, setTestFout] = useState('');
  const [toonSleutels, setToonSleutels] = useState(false);

  useEffect(() => {
    Promise.all([
      laadTekst(SLEUTELS.etoroApiKey, ''),
      laadTekst(SLEUTELS.etoroUserKey, ''),
    ]).then(([a, u]) => {
      setApiKey(a);
      setUserKey(u);
      setOpgeslagen(Boolean(a && u));
    });
  }, []);

  async function opslaan() {
    await bewaarTekst(SLEUTELS.etoroApiKey, apiKey.trim());
    await bewaarTekst(SLEUTELS.etoroUserKey, userKey.trim());
    setOpgeslagen(true);
    setBewerken(false);
    setTestStatus('idle');
  }

  async function testVerbinding() {
    setTestStatus('testing');
    try {
      await haalEtoroPortfolio({ apiKey: apiKey.trim(), userKey: userKey.trim() });
      setTestStatus('ok');
    } catch (e) {
      setTestFout(e instanceof Error ? e.message : 'Onbekende fout bij verbinden.');
      setTestStatus('fout');
    }
  }

  const inputStyle = [etoroStyles.input, {
    backgroundColor: colors.verhoogd,
    borderColor: colors.rand,
    color: colors.tekstPrimair,
  }];

  const toonFormulier = bewerken || !opgeslagen;

  return (
    <View style={[etoroStyles.groep, { borderTopColor: colors.rand }]}>
      <View style={etoroStyles.titelRij}>
        <Link2 size={16} color={colors.tekstGedimd} strokeWidth={1.75} />
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>ETORO-KOPPELING</Text>
      </View>

      {toonFormulier ? (
        <>
          {ETORO_STAPPEN.map((stap, i) => (
            <Text key={i} style={[Type.caption, etoroStyles.stap, { color: colors.tekstGedimd }]}>
              {i + 1}. {stap}
            </Text>
          ))}

          <Text style={[Type.overline, etoroStyles.label, { color: colors.tekstGedimd }]}>PRIVÉSLEUTEL (USER KEY)</Text>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Aan jouw account gekoppeld, door eToro "User Key" of "privésleutel" genoemd.</Text>
          <View style={etoroStyles.inputRij}>
            <TextInput
              style={[inputStyle, etoroStyles.inputMetOog]}
              value={userKey}
              onChangeText={setUserKey}
              placeholder="plak hier je privésleutel / user key"
              placeholderTextColor={colors.tekstGedimd}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!toonSleutels}
            />
            <Pressable
              onPress={() => setToonSleutels(v => !v)}
              accessibilityRole="button"
              accessibilityLabel={toonSleutels ? 'Sleutels verbergen' : 'Sleutels tonen'}
              style={etoroStyles.oogKnop}
            >
              {toonSleutels
                ? <EyeOff size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
                : <Eye size={18} color={colors.tekstGedimd} strokeWidth={1.75} />}
            </Pressable>
          </View>

          <Text style={[Type.overline, etoroStyles.label, { color: colors.tekstGedimd }]}>PUBLIEKE SLEUTEL (API KEY)</Text>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>App-niveau sleutel, door eToro "Public API Key" of "publieke sleutel" genoemd.</Text>
          <TextInput
            style={inputStyle}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="plak hier je publieke sleutel / api key"
            placeholderTextColor={colors.tekstGedimd}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!toonSleutels}
          />

          <Pressable
            style={[etoroStyles.knop, { backgroundColor: colors.cta }]}
            onPress={opslaan}
            disabled={!apiKey.trim() || !userKey.trim()}
            accessibilityRole="button"
          >
            <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Sleutel opslaan</Text>
          </Pressable>
        </>
      ) : (
        <View style={etoroStyles.statusRij}>
          <Text style={[Type.body, { color: colors.tekstPrimair }]}>Sleutel opgeslagen</Text>
          <Pressable onPress={() => setBewerken(true)} accessibilityRole="button" style={etoroStyles.statusKnop}>
            <Text style={[Type.caption, { color: colors.cta }]}>Wijzig</Text>
          </Pressable>
          <Pressable onPress={testVerbinding} accessibilityRole="button" style={etoroStyles.statusKnop}>
            <Text style={[Type.caption, { color: colors.cta }]}>Test verbinding</Text>
          </Pressable>
        </View>
      )}

      {testStatus === 'testing' && (
        <Text style={[Type.caption, etoroStyles.testTekst, { color: colors.tekstGedimd }]}>Verbinden...</Text>
      )}
      {testStatus === 'ok' && (
        <View style={etoroStyles.testRij}>
          <CheckCircle size={14} color={colors.winst} strokeWidth={1.75} />
          <Text style={[Type.caption, { color: colors.winst }]}>Verbinding OK</Text>
        </View>
      )}
      {testStatus === 'fout' && (
        <View style={etoroStyles.testRij}>
          <XCircle size={14} color={colors.verlies} strokeWidth={1.75} />
          <Text style={[Type.caption, { color: colors.verlies }]}>{testFout}</Text>
        </View>
      )}
    </View>
  );
}

const etoroStyles = StyleSheet.create({
  groep: {
    marginTop: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  titelRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  inputRij: { position: 'relative', justifyContent: 'center' },
  inputMetOog: { paddingRight: 44 },
  oogKnop: { position: 'absolute', right: 4, minHeight: 44, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  stap: { lineHeight: 18, marginBottom: 4 },
  label: { marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radii.veld,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    minHeight: 44,
  },
  knop: {
    marginTop: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    alignItems: 'center',
    minHeight: 44,
  },
  statusRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  statusKnop: { minHeight: 44, justifyContent: 'center' },
  testRij: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  testTekst: { marginTop: spacing.sm },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  vel: {
    borderTopLeftRadius: radii.kaart,
    borderTopRightRadius: radii.kaart,
    padding: spacing.base,
    paddingBottom: spacing.xl,
  },
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  label: { marginBottom: spacing.sm },
  opties: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optie: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radii.knop,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  menuGroep: {
    marginTop: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xs,
  },
  menuKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
});
