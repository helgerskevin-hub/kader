import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { CHANGELOG } from '../changelog';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  // Toont alleen de nieuwste versie, voor de "nieuw in deze versie"-melding bij opstarten
  alleenNieuwste?: boolean;
}

// Tussen twee releases staat er "Nog niet uitgebracht" in plaats van een nummer, en daar hoort geen
// v voor: "vNog niet uitgebracht" leest als een fout in de app.
const versieLabel = (versie: string) => (/^\d/.test(versie) ? `v${versie}` : versie);

// Hoeveel van het scherm het vel mag vullen, en wat de titelrij, de Begrepen-knop en de padding
// van het vel daarvan opeten. Die twee samen geven de hoogte die de lijst zelf overhoudt.
//
// Waarom een uitgerekende hoogte in punten en geen flex: de lijst stond hier eerst zonder eigen
// hoogte in een vel met `maxHeight: '80%'`, en flexShrink is in React Native standaard 0. De lijst
// groeide dus tot zijn volle inhoud en liep onder het vel door, waar hij werd afgekapt: er viel
// niets te scrollen omdat de ScrollView zelf nooit te klein werd. Eerder is hier `flexShrink: 1`
// geprobeerd en dat hielp op het toestel niet (zie 0.1.18 in de changelog). Een expliciete
// maxHeight hoeft niets te onderhandelen: de ScrollView is dan gewoon kleiner dan zijn inhoud en
// scrollt.
const VEL_DEEL_VAN_SCHERM = 0.8;
const RUIMTE_OM_DE_LIJST = 180;
const LIJST_MINIMUM = 160;

export function ChangelogSheet({ zichtbaar, onSluiten, alleenNieuwste }: Props) {
  const { colors } = useTheme();
  const { height: schermHoogte } = useWindowDimensions();
  const lijstHoogte = Math.max(LIJST_MINIMUM, schermHoogte * VEL_DEEL_VAN_SCHERM - RUIMTE_OM_DE_LIJST);
  const entries = alleenNieuwste ? CHANGELOG.slice(0, 1) : CHANGELOG;
  const titel = alleenNieuwste ? `Nieuw: ${versieLabel(CHANGELOG[0]?.versie ?? '')}` : 'Wijzigingen';

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={styles.vel}>
      <View style={styles.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{titel}</Text>
        <Pressable
          onPress={onSluiten}
          accessibilityLabel="Sluiten"
          accessibilityRole="button"
          style={styles.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator style={{ maxHeight: lijstHoogte }}>
        {entries.map(entry => (
          <View key={entry.versie} style={styles.entry}>
            <View style={styles.entryKop}>
              <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{versieLabel(entry.versie)}</Text>
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{entry.datum}</Text>
            </View>
            {entry.punten.map((punt, i) => (
              <Text key={i} style={[Type.caption, styles.punt, { color: colors.tekstGedimd }]}>• {punt}</Text>
            ))}
          </View>
        ))}
      </ScrollView>

      {alleenNieuwste && (
        <Pressable
          style={[styles.begrepenKnop, { backgroundColor: colors.cta }]}
          onPress={onSluiten}
          accessibilityRole="button"
        >
          <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Begrepen</Text>
        </Pressable>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  vel: {
    maxHeight: '80%',
  },
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  entry: { marginBottom: spacing.base },
  entryKop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  punt: { lineHeight: 18, marginBottom: 2 },
  begrepenKnop: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    alignItems: 'center',
    minHeight: 44,
  },
});
