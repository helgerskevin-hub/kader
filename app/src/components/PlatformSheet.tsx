// Wat het merkje rechtsboven op een tradekaart betekent, en bij welke providers je deze coin
// kunt kopen.
//
// De regel die dit scherm uitlegt is streng en met opzet: een merkje staat er ALLEEN als Kader de
// order zelf kan plaatsen. Moet je het bij de provider zelf doen, dan is er geen merkje. Anders
// zou het merkje "hier kun je terecht" beloven terwijl de koopknop niets doet, en dat is precies
// het soort halve belofte waar je geld op verliest.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { PlatformId, platformInfo } from '../engine/platforms';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { PlatformChip } from './PlatformChip';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  symbool: string;
  // De providers waar deze coin vanuit Kader te kopen is. Leeg zou betekenen dat er geen merkje
  // stond en deze sheet dus niet te openen was; de lege staat staat er toch, voor het geval de
  // koppeling wegvalt terwijl de sheet openstaat.
  platforms: PlatformId[];
}

export function PlatformSheet({ zichtbaar, onSluiten, symbool, platforms }: Props) {
  const { colors } = useTheme();

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={stijlen.vel}>
      <View style={stijlen.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]} accessibilityRole="header">
          {symbool} kopen
        </Text>
        <Pressable
          onPress={onSluiten}
          accessibilityLabel="Sluiten"
          accessibilityRole="button"
          style={stijlen.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      {platforms.length === 0 ? (
        <Text style={[Type.body, stijlen.tekst, { color: colors.tekstGedimd }]}>
          Kader kan {symbool} op dit moment nergens voor je kopen. Controleer je koppeling in
          Instellingen.
        </Text>
      ) : (
        <>
          <Text style={[Type.body, stijlen.tekst, { color: colors.tekstGedimd }]}>
            {platforms.length === 1
              ? `Deze coin kun je vanuit Kader kopen bij:`
              : `Deze coin kun je vanuit Kader kopen bij ${platforms.length} providers:`}
          </Text>

          <View style={stijlen.lijst}>
            {platforms.map(id => (
              <View
                key={id}
                style={[stijlen.regel, { borderColor: colors.rand }]}
                accessible
                accessibilityLabel={`${platformInfo(id).naam}: order gaat vanuit Kader, na jouw bevestiging.`}
              >
                <PlatformChip platform={id} maat={24} />
                <View style={stijlen.regelTekst}>
                  <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>
                    {platformInfo(id).naam}
                  </Text>
                  <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
                    Kader plaatst de order, altijd pas nadat je hem bevestigd hebt.
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={[stijlen.uitleg, { backgroundColor: colors.verhoogd }]}>
        <Text style={[Type.caption, stijlen.uitlegTekst, { color: colors.tekstGedimd }]}>
          Staat er op een kaart geen merkje, dan kan Kader die coin nergens voor je kopen. Dat
          betekent niet dat hij nergens te koop is: je kunt hem dan nog steeds bij een provider zelf
          kopen, Kader doet het alleen niet voor je.
        </Text>
      </View>
    </BottomSheet>
  );
}

const stijlen = StyleSheet.create({
  vel: {
    maxHeight: '80%',
  },
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  tekst: { lineHeight: 22 },
  lijst: { marginTop: spacing.md, gap: spacing.sm },
  regel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
  },
  regelTekst: { flex: 1, gap: 2 },
  uitleg: {
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: radii.veld,
  },
  uitlegTekst: { lineHeight: 18 },
});
