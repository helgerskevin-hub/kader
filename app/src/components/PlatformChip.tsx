// Het merkje van een platform: een rond chipje met één letter.
//
// Bewust geen nagemaakt merklogo. Die zijn niet van ons, er zit er ook geen in de repo, en een
// zelfgetekende benadering van andermans logo is erger dan een eigen vorm. Een monogram in de
// merkkleur is herkenbaar zodra je het twee keer gezien hebt, en er passen er zes naast elkaar
// zonder dat er iets nagemaakt hoeft te worden.
//
// Let op wat een chip op twee plekken betekent: op een tradekaart is het "hier kun je deze coin
// kopen", op het verdelingsscherm "hier staat je positie". Dat verschil zit in de schermlezerlabels
// van de aanroepers, niet in de chip zelf.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts } from '../theme/typography';
import { radii } from '../theme/tokens';
import { PlatformId, platformInfo } from '../engine/platforms';

export type ChipMaat = 16 | 20 | 24;

// Meer dan drie merkjes naast elkaar is geen rij meer maar een balk. Vanaf vier tonen we er twee
// plus een telling.
const MAX_ZICHTBAAR = 3;

interface ChipProps {
  platform: PlatformId;
  maat?: ChipMaat;
}

export function PlatformChip({ platform, maat = 20 }: ChipProps) {
  const { colors, donkerActief } = useTheme();
  const info = platformInfo(platform);
  const neutraal = info.kleurIndex < 0 || info.kleurIndex >= colors.verdeling.length;
  const vulling = neutraal ? colors.verhoogd : colors.verdeling[info.kleurIndex];
  // Dezelfde regel als in AdviceBadge: de donkere reeks in colors.verdeling is licht, en witte
  // letters daarop halen geen AA.
  const letterKleur = neutraal ? colors.tekstGedimd : donkerActief ? colors.achtergrond : '#FFFFFF';

  return (
    <View
      style={[
        stijlen.chip,
        {
          width: maat,
          height: maat,
          backgroundColor: vulling,
          borderWidth: neutraal ? 1 : 0,
          borderColor: colors.rand,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[stijlen.letter, { fontSize: maat === 16 ? 9 : 11, color: letterKleur }]}>
        {info.monogram}
      </Text>
    </View>
  );
}

interface RijProps {
  platforms: PlatformId[];
  maat?: ChipMaat;
  // De hele rij krijgt één label; de losse chips zijn voor de schermlezer verborgen. Zonder label
  // hoort de rij helemaal niet in de voorleesvolgorde thuis.
  label?: string;
}

export function PlatformChips({ platforms, maat = 20, label }: RijProps) {
  const { colors } = useTheme();

  // Niets bekend betekent niets tekenen: een lege plek is eerlijk, een grijze chip zou beweren dat
  // er een platform is.
  if (platforms.length === 0) return null;

  const teveel = platforms.length > MAX_ZICHTBAAR;
  const zichtbaar = teveel ? platforms.slice(0, MAX_ZICHTBAAR - 1) : platforms;
  const rest = platforms.length - zichtbaar.length;

  return (
    <View
      style={[stijlen.rij, { gap: maat === 16 ? 3 : 4 }]}
      accessible={label !== undefined}
      accessibilityLabel={label}
    >
      {zichtbaar.map(p => <PlatformChip key={p} platform={p} maat={maat} />)}
      {rest > 0 && (
        <View
          style={[
            stijlen.chip,
            stijlen.rest,
            { height: maat, backgroundColor: colors.verhoogd, borderColor: colors.rand },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={[stijlen.letter, { fontSize: maat === 16 ? 9 : 11, color: colors.tekstGedimd }]}>
            +{rest}
          </Text>
        </View>
      )}
    </View>
  );
}

const stijlen = StyleSheet.create({
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Een telling is twee tekens breed, dus die chip mag geen cirkel zijn.
  rest: {
    paddingHorizontal: 5,
    borderWidth: 1,
  },
  letter: {
    fontFamily: Fonts.sansSemiBold,
    fontWeight: '600',
    letterSpacing: 0,
    // Zonder dit staat de letter op Android net iets te laag in de cirkel.
    includeFontPadding: false,
    textAlign: 'center',
  },
});
