import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { X, Smartphone, Sun, Moon, FileText, BookOpen } from 'lucide-react-native';
import { useTheme, ThemaModus } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { ChangelogSheet } from './ChangelogSheet';
import { AchtergrondScherm } from './AchtergrondScherm';

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
  const [uitlegOpen, setUitlegOpen] = useState(false);

  return (
    <>
    <Modal visible={zichtbaar && !changelogOpen && !uitlegOpen} animationType="slide" transparent onRequestClose={onSluiten}>
      <View style={styles.overlay}>
        <View style={[styles.vel, shadow.modal, { backgroundColor: colors.kaart }]}>
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
              onPress={() => setUitlegOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Achtergrondinformatie"
              style={styles.menuKnop}
            >
              <BookOpen size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
              <Text style={[Type.body, { color: colors.tekstPrimair }]}>Achtergrondinformatie</Text>
            </Pressable>
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
    <AchtergrondScherm zichtbaar={uitlegOpen} onSluiten={() => setUitlegOpen(false)} />
    </>
  );
}

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
