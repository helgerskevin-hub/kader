// Ronde avatar van een eToro-belegger. eToro's eigen foto als die er is, anders de eerste letter
// van de gebruikersnaam op een rustig vlak. Geen kleur per persoon: kleur betekent in Kader iets.
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts } from '../../theme/typography';

interface Props {
  username: string;
  url?: string | null;
  grootte?: number;
}

export function TraderAvatar({ username, url, grootte = 40 }: Props) {
  const { colors } = useTheme();
  const [fout, setFout] = useState(false);
  const rond = { width: grootte, height: grootte, borderRadius: grootte / 2 };

  if (url && !fout) {
    return (
      <Image
        source={{ uri: url }}
        style={[rond, { backgroundColor: colors.verhoogd }]}
        onError={() => setFout(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[rond, styles.vlak, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}>
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: grootte * 0.42, color: colors.primair }}>
        {username.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  vlak: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
