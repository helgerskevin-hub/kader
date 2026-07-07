import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, Target, Users, Shield, ArrowRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { KaderLogo } from '../components/KaderLogo';
import { StapOvergang } from '../components/StapOvergang';

interface Stap {
  Icon?: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  isWelkom?: boolean;
  titel: string;
  body: string;
}

const STAPPEN: Stap[] = [
  {
    isWelkom: true,
    titel: 'Welkom bij Kader',
    body: 'Structuur in crypto. Analyseer de markt met technische indicatoren en ontdek kansrijke trades met duidelijke stop-loss en take-profit niveaus.',
  },
  {
    Icon: TrendingUp as React.ComponentType<{ size: number; color: string; strokeWidth?: number }>,
    titel: 'Hoe werkt\nde analyse?',
    body: 'De app gebruikt RSI, voortschrijdende gemiddelden (EMA) en ATR om de markt te scannen. Coins met score ≥ 75 zijn "high conviction", meerdere indicatoren wijzen tegelijk op een kans.',
  },
  {
    Icon: Target as React.ComponentType<{ size: number; color: string; strokeWidth?: number }>,
    titel: 'Stop, entry\nen doel',
    body: 'Bij elk signaal zie je drie niveaus:\n\n· Stop-loss: maximaal verlies (1,5× ATR)\n· Entry: instapprijs\n· Doel: take-profit (3× ATR)\n\nDe risk/reward is altijd minimaal 1:2.',
  },
  {
    Icon: Users as React.ComponentType<{ size: number; color: string; strokeWidth?: number }>,
    titel: 'eToro-trader\nbeoordelen',
    body: 'Kopieer je een Popular Investor? Vul zijn statistieken in op het Traders-tabblad en krijg een GROEN/GEEL/ROOD oordeel met een aanbevolen Copy Stop Loss percentage.',
  },
  {
    Icon: Shield as React.ComponentType<{ size: number; color: string; strokeWidth?: number }>,
    titel: 'Disclaimer',
    body: 'Deze app geeft technische signalen op basis van historische koersdata, geen financieel advies.\n\nControleer altijd de live koers op eToro vóór je een trade plaatst.',
  },
];

interface Props {
  onKlaar: () => void;
}

export function OnboardingScreen({ onKlaar }: Props) {
  const { colors } = useTheme();
  const [actieveStap, setActieveStap] = useState(0);
  const stap = STAPPEN[actieveStap];
  const isLaatsteStap = actieveStap === STAPPEN.length - 1;

  function volgende() {
    if (isLaatsteStap) {
      onKlaar();
    } else {
      setActieveStap(v => v + 1);
    }
  }

  function vorige() {
    if (actieveStap > 0) setActieveStap(v => v - 1);
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.achtergrond }]}>
      {/* Sla over */}
      <View style={styles.titelBalk}>
        <View />
        {!isLaatsteStap && (
          <Pressable
            onPress={onKlaar}
            accessibilityRole="button"
            accessibilityLabel="Sla onboarding over"
            style={styles.slaOverKnop}
          >
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Sla over</Text>
          </Pressable>
        )}
      </View>

      {/* Stap-indicator */}
      <View style={styles.dots}>
        {STAPPEN.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === actieveStap ? colors.cta : colors.rand,
                width: i === actieveStap ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Inhoud */}
      <StapOvergang stapIndex={actieveStap} style={styles.inhoud}>
        {stap.isWelkom ? (
          <>
            <View style={styles.logoContainer}>
              <KaderLogo size={80} />
            </View>
            <Text style={[Type.display, styles.titel, { color: colors.tekstPrimair }]}>
              Welkom bij Kader
            </Text>
            <Text style={[Type.sectiekop, styles.slogan, { color: colors.primair }]}>
              Structuur in crypto.
            </Text>
            <Text style={[Type.body, styles.body, { color: colors.tekstGedimd }]}>
              {stap.body}
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.iconContainer, { backgroundColor: colors.verhoogd }]}>
              {stap.Icon && <stap.Icon size={36} color={colors.cta} strokeWidth={1.5} />}
            </View>
            <Text style={[Type.display, styles.titel, { color: colors.tekstPrimair }]}>
              {stap.titel}
            </Text>
            <Text style={[Type.body, styles.body, { color: colors.tekstGedimd }]}>
              {stap.body}
            </Text>
          </>
        )}
      </StapOvergang>

      {/* Navigatie */}
      <View style={styles.navigatie}>
        {actieveStap > 0 ? (
          <Pressable
            style={[styles.vorigeKnop, { borderColor: colors.rand }]}
            onPress={vorige}
            accessibilityRole="button"
            accessibilityLabel="Vorige stap"
          >
            <Text style={[Type.body, { color: colors.tekstGedimd }]}>Vorige</Text>
          </Pressable>
        ) : (
          <View />
        )}

        <Pressable
          style={[
            styles.volgendKnop,
            { backgroundColor: isLaatsteStap ? colors.winst : colors.cta },
          ]}
          onPress={volgende}
          accessibilityRole="button"
          accessibilityLabel={isLaatsteStap ? 'Begin met de app' : 'Volgende stap'}
        >
          <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>
            {isLaatsteStap ? 'Begin' : 'Volgende'}
          </Text>
          <ArrowRight size={16} color="white" strokeWidth={2} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titelBalk: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  slaOverKnop: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: radii.pill,
  },
  inhoud: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  titel: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  slogan: {
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  body: {
    textAlign: 'center',
    lineHeight: 26,
  },
  navigatie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
    paddingTop: spacing.base,
  },
  vorigeKnop: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    borderWidth: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volgendKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    minHeight: 44,
  },
});
