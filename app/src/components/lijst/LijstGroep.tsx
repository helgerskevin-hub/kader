import React, { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { spacing, radii, shadow } from '../../theme/tokens';

interface Props {
  titel?: string;
  voetnoot?: ReactNode | string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  // Waar de scheidingslijn begint, vanaf de linkerrand van de kaart. Standaard voorbij de icoontegel
  // van een LijstRij (16 padding + 30 tegel + 12 tussenruimte). 0 voor rijen zonder icoon.
  lijnInspringing?: number;
}

// iOS-Instellingen-achtige groep: optionele kop, een kaart met rijen gescheiden door haarlijnen,
// en een voetnoot eronder. Kinderen mogen LijstRij zijn of losse views.
export function LijstGroep({ titel, voetnoot, children, style, lijnInspringing = 58 }: Props) {
  const { colors } = useTheme();
  const kinderen = Children.toArray(children).filter(
    (k) => k !== null && k !== undefined && typeof k !== 'boolean',
  );

  return (
    <View style={style}>
      {titel ? (
        <Text
          accessibilityRole="header"
          style={[Type.overline, styles.titel, { color: colors.tekstGedimd }]}
        >
          {titel.toUpperCase()}
        </Text>
      ) : null}
      <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
        {kinderen.map((kind, i) => (
          <Fragment key={isValidElement(kind) && kind.key != null ? kind.key : i}>
            {i > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  marginLeft: lijnInspringing,
                  backgroundColor: colors.rand,
                }}
              />
            ) : null}
            {kind}
          </Fragment>
        ))}
      </View>
      {voetnoot ? (
        typeof voetnoot === 'string' ? (
          <Text style={[Type.caption, styles.voetnoot, { color: colors.tekstGedimd }]}>
            {voetnoot}
          </Text>
        ) : (
          <View style={styles.voetnoot}>{voetnoot}</View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titel: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  kaart: {
    borderRadius: radii.kaart,
    overflow: 'hidden',
  },
  voetnoot: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.sm,
  },
});
