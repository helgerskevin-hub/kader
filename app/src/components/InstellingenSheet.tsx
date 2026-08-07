import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import {
  X, Smartphone, Sun, Moon, FileText, Link2, ChevronRight, FlaskConical, Wallet,
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

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
}

const OPTIES: { modus: ThemaModus; label: string; Icon: typeof Sun }[] = [
  { modus: 'systeem', label: 'Systeem', Icon: Smartphone },
  { modus: 'licht', label: 'Licht', Icon: Sun },
  { modus: 'donker', label: 'Donker', Icon: Moon },
];

const OMGEVINGEN: { omgeving: EtoroOmgeving; label: string; Icon: typeof Sun }[] = [
  { omgeving: 'demo', label: 'Demo', Icon: FlaskConical },
  { omgeving: 'real', label: 'Echt', Icon: Wallet },
];

type SleutelStatus = 'Niet ingesteld' | 'Alleen lezen' | 'Lezen en handelen';

const SCHRIJFVLAG: Record<EtoroOmgeving, string> = {
  real: SLEUTELS.etoroRealSchrijven,
  demo: SLEUTELS.etoroDemoSchrijven,
};

async function statusVan(omgeving: EtoroOmgeving): Promise<SleutelStatus> {
  if (!(await heeftSleutels(omgeving))) return 'Niet ingesteld';
  return (await laadVlag(SCHRIJFVLAG[omgeving])) ? 'Lezen en handelen' : 'Alleen lezen';
}

export function InstellingenSheet({ zichtbaar, onSluiten }: Props) {
  const { colors, modus, setModus } = useTheme();
  // Meteen ophalen zodra de koppeling is opgeslagen, niet pas bij de volgende app-start.
  const { omgeving, setOmgeving } = usePortfolio();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [wizardOmgeving, setWizardOmgeving] = useState<EtoroOmgeving | null>(null);
  const [statussen, setStatussen] = useState<Record<EtoroOmgeving, SleutelStatus>>({
    demo: 'Niet ingesteld',
    real: 'Niet ingesteld',
  });
  const [bezigWisselen, setBezigWisselen] = useState(false);

  async function ververStatussen() {
    const [demo, real] = await Promise.all([statusVan('demo'), statusVan('real')]);
    setStatussen({ demo, real });
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
    // de koopknop pas na een herstart) en synchroniseert meteen. Het legt de omgeving ook vast, zodat
    // het koppelen van een tweede sleutelpaar je niet stilzwijgend naar de andere omgeving verschuift.
    setOmgeving(omgeving);
  }

  return (
    <>
    <BottomSheet zichtbaar={zichtbaar && !changelogOpen && wizardOmgeving === null} onSluiten={onSluiten}>
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
        {OMGEVINGEN.map(({ omgeving: rijOmgeving, label }) => {
          const status = statussen[rijOmgeving];
          const kleur = status === 'Lezen en handelen'
            ? colors.winst
            : status === 'Alleen lezen' ? colors.tekstPrimair : colors.tekstGedimd;
          return (
            <Pressable
              key={rijOmgeving}
              onPress={() => setWizardOmgeving(rijOmgeving)}
              accessibilityRole="button"
              accessibilityLabel={`eToro-sleutel voor ${label.toLowerCase()} instellen, nu ${status.toLowerCase()}`}
              style={styles.menuKnop}
            >
              <Link2 size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
              <Text style={[Type.body, styles.menuTekst, { color: colors.tekstPrimair }]}>
                {rijOmgeving === 'demo' ? 'eToro-sleutel demo' : 'eToro-sleutel echt'}
              </Text>
              <Text style={[Type.caption, { color: kleur }]}>{status}</Text>
              <ChevronRight size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
            </Pressable>
          );
        })}

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
      zichtbaar={wizardOmgeving !== null}
      omgeving={wizardOmgeving ?? 'real'}
      onSluiten={() => setWizardOmgeving(null)}
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
