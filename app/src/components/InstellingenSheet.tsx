import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { X, Smartphone, Sun, Moon, FileText, Link2, ChevronRight } from 'lucide-react-native';
import { useTheme, ThemaModus } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { ChangelogSheet } from './ChangelogSheet';
import { EtoroKoppelingWizard } from './EtoroKoppelingWizard';
import { laadTekst, SLEUTELS } from '../storage/opslag';
import { usePortfolio } from '../state/PortfolioProvider';

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
  // Meteen ophalen zodra de koppeling is opgeslagen, niet pas bij de volgende app-start.
  const { synchroniseer } = usePortfolio();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [gekoppeld, setGekoppeld] = useState(false);

  async function ververGekoppeld() {
    const [a, u] = await Promise.all([
      laadTekst(SLEUTELS.etoroApiKey, ''),
      laadTekst(SLEUTELS.etoroUserKey, ''),
    ]);
    setGekoppeld(Boolean(a && u));
  }

  useEffect(() => {
    if (zichtbaar) ververGekoppeld();
  }, [zichtbaar]);

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

      <View style={[styles.menuGroep, { borderTopColor: colors.rand }]}>
        <Pressable
          onPress={() => setWizardOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="eToro-koppeling instellen"
          style={styles.menuKnop}
        >
          <Link2 size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
          <Text style={[Type.body, styles.menuTekst, { color: colors.tekstPrimair }]}>eToro-koppeling</Text>
          <Text style={[Type.caption, { color: gekoppeld ? colors.winst : colors.tekstGedimd }]}>
            {gekoppeld ? 'Gekoppeld' : 'Niet ingesteld'}
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
      onOpgeslagen={() => { ververGekoppeld(); synchroniseer(); }}
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
