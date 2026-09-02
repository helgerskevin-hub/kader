import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import {
  X, Smartphone, Sun, Moon, FileText, Link2, ChevronRight, FlaskConical, Wallet,
  DollarSign, Euro, Bell, BellOff,
} from 'lucide-react-native';
import { useTheme, ThemaModus } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { ChangelogSheet } from './ChangelogSheet';
import { EtoroKoppelingWizard } from './EtoroKoppelingWizard';
import { heeftSleutels } from '../state/etoroSleutels';
import { usePortfolio } from '../state/PortfolioProvider';
import { EtoroOmgeving } from '../engine/etoro';
import { SLEUTELS, laadVlag } from '../storage/opslag';
import { useValuta } from '../state/useValuta';
import { Valuta } from '../engine/valuta';
import { meldingenAan } from '../state/meldingVoorkeur';
import { zetMeldingen } from '../state/meldingSchakelaar';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
}

const OPTIES: { modus: ThemaModus; label: string; Icon: typeof Sun }[] = [
  { modus: 'systeem', label: 'Systeem', Icon: Smartphone },
  { modus: 'licht', label: 'Licht', Icon: Sun },
  { modus: 'donker', label: 'Donker', Icon: Moon },
];

const VALUTAS: { valuta: Valuta; label: string; Icon: typeof Sun }[] = [
  { valuta: 'USD', label: 'Dollar', Icon: DollarSign },
  { valuta: 'EUR', label: 'Euro', Icon: Euro },
];

const MELDINGKEUZES: { aan: boolean; label: string; Icon: typeof Sun }[] = [
  { aan: true, label: 'Aan', Icon: Bell },
  { aan: false, label: 'Uit', Icon: BellOff },
];

const OMGEVINGEN: { omgeving: EtoroOmgeving; label: string; Icon: typeof Sun }[] = [
  { omgeving: 'demo', label: 'Demo', Icon: FlaskConical },
  { omgeving: 'real', label: 'Echt', Icon: Wallet },
];

type SleutelStatus =
  | 'Niet ingesteld'
  | 'Alleen lezen'
  | 'Handelen in demo'
  | 'Handelen in echt'
  | 'Handelen in demo en echt';

const SCHRIJFVLAG: Record<EtoroOmgeving, string> = {
  real: SLEUTELS.etoroRealSchrijven,
  demo: SLEUTELS.etoroDemoSchrijven,
};

// Eén sleutel, dus één status. Het handelsrecht blijft wél per omgeving, want eToro kan je sleutel
// in demo wel en in echt geen schrijfrecht geven, en dat verschil hoort zichtbaar te blijven.
async function bepaalStatus(): Promise<SleutelStatus> {
  if (!(await heeftSleutels())) return 'Niet ingesteld';
  const [real, demo] = await Promise.all([laadVlag(SCHRIJFVLAG.real), laadVlag(SCHRIJFVLAG.demo)]);
  if (real && demo) return 'Handelen in demo en echt';
  if (demo) return 'Handelen in demo';
  if (real) return 'Handelen in echt';
  return 'Alleen lezen';
}

export function InstellingenSheet({ zichtbaar, onSluiten }: Props) {
  const { colors, modus, setModus } = useTheme();
  const { valuta, eurPerUsd, koersOntbreekt, kiesValuta } = useValuta();
  // Meteen ophalen zodra de koppeling is opgeslagen, niet pas bij de volgende app-start.
  const { omgeving, setOmgeving } = usePortfolio();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [sleutelStatus, setSleutelStatus] = useState<SleutelStatus>('Niet ingesteld');
  const [bezigWisselen, setBezigWisselen] = useState(false);
  const [meldingen, setMeldingen] = useState(true);
  const [bezigMeldingen, setBezigMeldingen] = useState(false);

  async function ververStatussen() {
    const [status, aan] = await Promise.all([bepaalStatus(), meldingenAan()]);
    setSleutelStatus(status);
    setMeldingen(aan);
  }

  // De schakelaar doet meteen wat hij belooft: uit wist de geplande dagelijkse herinnering en
  // schrijft de achtergrondtaak uit. Mislukt dat, dan zetten we de knop terug in plaats van een
  // stand te tonen die niet klopt.
  async function kiesMeldingen(aan: boolean) {
    if (aan === meldingen || bezigMeldingen) return;
    setBezigMeldingen(true);
    setMeldingen(aan);
    try {
      await zetMeldingen(aan);
    } catch {
      setMeldingen(!aan);
    } finally {
      setBezigMeldingen(false);
    }
  }

  useEffect(() => {
    if (zichtbaar) ververStatussen();
  }, [zichtbaar]);

  async function wissel(nieuw: EtoroOmgeving) {
    setBezigWisselen(true);
    try {
      await setOmgeving(nieuw);
    } finally {
      setBezigWisselen(false);
    }
  }

  // Naar demo mag zonder vragen: dat kan geen geld kosten. Naar echt is de stap die je per ongeluk
  // zet en pas merkt bij je eerste order, dus daar staat een bevestiging voor.
  function kiesOmgeving(nieuw: EtoroOmgeving) {
    if (nieuw === omgeving || bezigWisselen) return;
    if (nieuw === 'demo') {
      wissel('demo');
      return;
    }
    Alert.alert(
      'Overschakelen naar echt',
      'Orders die je hierna bevestigt gaan naar je echte eToro-account, met je eigen geld. Je portfolio in Kader toont vanaf dan alleen je echte posities.',
      [
        { text: 'Annuleren', style: 'cancel' },
        { text: 'Naar echt', style: 'destructive', onPress: () => wissel('real') },
      ],
    );
  }

  function naOpslaan() {
    ververStatussen();
    // Zet de actieve omgeving opnieuw: dat leest het schrijfrecht vers van schijf (anders verschijnt
    // de koopknop pas na een herstart), legt de omgeving vast en synchroniseert meteen.
    setOmgeving(omgeving);
  }

  return (
    <>
    <BottomSheet zichtbaar={zichtbaar && !changelogOpen && !wizardOpen} onSluiten={onSluiten}>
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

      <Text style={[Type.overline, styles.label, styles.labelRuim, { color: colors.tekstGedimd }]}>
        VALUTA
      </Text>
      <View style={styles.opties}>
        {VALUTAS.map(({ valuta: optieValuta, label, Icon }) => {
          const actief = valuta === optieValuta;
          return (
            <Pressable
              key={optieValuta}
              onPress={() => kiesValuta(optieValuta)}
              accessibilityRole="button"
              accessibilityState={{ selected: actief }}
              accessibilityLabel={`Bedragen in ${label.toLowerCase()}`}
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
      <Text style={[Type.caption, styles.uitleg, { color: koersOntbreekt ? colors.letOp : colors.tekstGedimd }]}>
        {koersOntbreekt
          ? 'De wisselkoers is nog niet opgehaald, dus bedragen staan voorlopig in dollars. Zodra er internet is pakt de app dit vanzelf op.'
          : valuta === 'EUR' && eurPerUsd !== null
            ? `Koersen en bedragen worden omgerekend tegen €${eurPerUsd.toFixed(4)} per dollar. Orders reken je bij eToro in dollars af, dus die schermen blijven in dollars.`
            : 'Marktdata en eToro rekenen allebei in dollars. Kies euro als je liever ziet wat een bedrag in je eigen valuta is.'}
      </Text>

      <Text style={[Type.overline, styles.label, styles.labelRuim, { color: colors.tekstGedimd }]}>
        MELDINGEN
      </Text>
      <View style={styles.opties}>
        {MELDINGKEUZES.map(({ aan, label, Icon }) => {
          const actief = meldingen === aan;
          return (
            <Pressable
              key={label}
              onPress={() => kiesMeldingen(aan)}
              disabled={bezigMeldingen}
              accessibilityRole="button"
              accessibilityState={{ selected: actief, disabled: bezigMeldingen }}
              accessibilityLabel={aan ? 'Meldingen aan' : 'Meldingen uit'}
              style={[
                styles.optie,
                {
                  backgroundColor: actief ? colors.cta + '1A' : colors.verhoogd,
                  borderColor: actief ? colors.cta : colors.rand,
                  opacity: bezigMeldingen ? 0.6 : 1,
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
      <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>
        {meldingen
          ? 'Kader stuurt een dagelijkse herinnering, meldt het als een open trade aandacht vraagt of het marktklimaat omslaat, en waarschuwt je bij een prijsalert die je zelf hebt gezet.'
          : 'Kader stuurt geen enkele melding meer, ook geen prijsalerts. Je alerts blijven staan en gaan weer werken zodra je dit aanzet.'}
      </Text>

      <Text style={[Type.overline, styles.label, styles.labelRuim, { color: colors.tekstGedimd }]}>
        HANDELSOMGEVING
      </Text>
      <View style={styles.opties}>
        {OMGEVINGEN.map(({ omgeving: optieOmgeving, label, Icon }) => {
          const actief = omgeving === optieOmgeving;
          return (
            <Pressable
              key={optieOmgeving}
              onPress={() => kiesOmgeving(optieOmgeving)}
              disabled={bezigWisselen}
              accessibilityRole="button"
              accessibilityState={{ selected: actief, disabled: bezigWisselen }}
              accessibilityLabel={label}
              style={[
                styles.optie,
                {
                  backgroundColor: actief ? colors.cta + '1A' : colors.verhoogd,
                  borderColor: actief ? colors.cta : colors.rand,
                  opacity: bezigWisselen ? 0.6 : 1,
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
      <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>
        In demo gaan orders naar je oefenaccount bij eToro. In echt gaan ze met je eigen geld. Kader
        gebruikt in allebei dezelfde sleutel; alleen het adres waar de order heen gaat verschilt.
      </Text>

      <View style={[styles.menuGroep, { borderTopColor: colors.rand }]}>
        <Pressable
          onPress={() => setWizardOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`eToro-sleutel instellen, nu ${sleutelStatus.toLowerCase()}`}
          style={styles.menuKnop}
        >
          <Link2 size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
          <Text style={[Type.body, styles.menuTekst, { color: colors.tekstPrimair }]}>eToro-sleutel</Text>
          <Text
            style={[
              Type.caption,
              {
                color: sleutelStatus === 'Niet ingesteld'
                  ? colors.tekstGedimd
                  : sleutelStatus === 'Alleen lezen' ? colors.tekstPrimair : colors.winst,
              },
            ]}
          >
            {sleutelStatus}
          </Text>
          <ChevronRight size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>

        <Pressable
          onPress={() => setChangelogOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Wijzigingen"
          style={styles.menuKnop}
        >
          <FileText size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
          <Text style={[Type.body, styles.menuTekst, { color: colors.tekstPrimair }]}>Wijzigingen</Text>
          <ChevronRight size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>
    </BottomSheet>

    <ChangelogSheet zichtbaar={changelogOpen} onSluiten={() => setChangelogOpen(false)} />
    <EtoroKoppelingWizard
      zichtbaar={wizardOpen}
      onSluiten={() => setWizardOpen(false)}
      onOpgeslagen={naOpslaan}
    />
    </>
  );
}

const styles = StyleSheet.create({
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  label: { marginBottom: spacing.sm },
  labelRuim: { marginTop: spacing.lg },
  uitleg: { marginTop: spacing.sm, lineHeight: 18 },
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
  menuTekst: { flex: 1 },
});
