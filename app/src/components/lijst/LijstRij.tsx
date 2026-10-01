import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Drukbaar } from '../Drukbaar';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { spacing, radii } from '../../theme/tokens';

export interface LijstRijProps {
  icoon?: LucideIcon;
  // Tintkleur van de tegel en het icoon (hex). Zonder: neutrale tegel met gedimd icoon.
  icoonKleur?: string;
  titel: string;
  sub?: string;
  // 'pijl' toont een chevron; een node komt rechts als schakelaar, badge enzovoort.
  rechts?: 'pijl' | ReactNode;
  // Korte waarde rechts, vóór de pijl.
  waarde?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  nieuw?: boolean;
  gevaar?: boolean;
  // Alleen relevant buiten een LijstGroep: zonder eerste krijgt de rij een haarlijn erboven.
  eerste?: boolean;
}

// Eén rij in een iOS-Instellingen-achtige lijst. Tekst wraps altijd (geen numberOfLines) en de
// rechterkant krimpt niet, dus een lange titel duwt de pijl of waarde nooit weg.
export function LijstRij({
  icoon: Icoon,
  icoonKleur,
  titel,
  sub,
  rechts,
  waarde,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  nieuw,
  gevaar,
  eerste = true,
}: LijstRijProps) {
  const { colors } = useTheme();
  const tint = gevaar ? colors.verlies : icoonKleur;
  const tegelKleur = tint ? `${tint}1F` : colors.verhoogd;
  const iconKleur = tint ?? colors.tekstGedimd;

  const inhoud = (
    <>
      {Icoon ? (
        <View style={[styles.tegel, { backgroundColor: tegelKleur }]}>
          <Icoon size={17} color={iconKleur} strokeWidth={1.75} />
        </View>
      ) : null}
      <View style={styles.tekst}>
        <View style={styles.titelRij}>
          <Text
            style={[
              Type.body,
              styles.titel,
              { color: gevaar ? colors.verlies : colors.tekstPrimair },
            ]}
          >
            {titel}
          </Text>
          {nieuw ? (
            <View style={[styles.nieuw, { backgroundColor: colors.cta }]}>
              <Text style={[Type.overline, styles.nieuwTekst]}>NIEUW</Text>
            </View>
          ) : null}
        </View>
        {sub ? <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{sub}</Text> : null}
      </View>
      {waarde || rechts ? (
        <View style={styles.rechts}>
          {waarde ? <Text style={[Type.body, { color: colors.tekstGedimd }]}>{waarde}</Text> : null}
          {rechts === 'pijl' ? (
            <ChevronRight size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
          ) : (
            rechts
          )}
        </View>
      ) : null}
    </>
  );

  const rijStijl = [
    styles.rij,
    !eerste && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rand },
  ];

  if (!onPress) {
    return (
      <View
        style={rijStijl}
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
      >
        {inhoud}
      </View>
    );
  }

  return (
    <Drukbaar
      onPress={onPress}
      haptiek="tik"
      schaal={0.98}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (sub ? `${titel}, ${sub}` : titel)}
      accessibilityHint={accessibilityHint}
      style={rijStijl}
    >
      {inhoud}
    </Drukbaar>
  );
}

const styles = StyleSheet.create({
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  tegel: {
    width: 30,
    height: 30,
    borderRadius: radii.veld,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tekst: {
    flex: 1,
    flexShrink: 1,
  },
  titelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titel: {
    flexShrink: 1,
    fontWeight: '600',
  },
  nieuw: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
  },
  nieuwTekst: {
    color: '#FFFFFF',
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  rechts: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
