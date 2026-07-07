import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { KaderLogo } from './KaderLogo';
import { FeestConfetti } from './FeestConfetti';

interface Props {
  zichtbaar: boolean;
  onVerder: () => void;
}

export function WelkomFeest({ zichtbaar, onVerder }: Props) {
  const { colors } = useTheme();

  return (
    <Modal visible={zichtbaar} animationType="fade" onRequestClose={onVerder} presentationStyle="fullScreen">
      <SafeAreaView style={[styles.root, { backgroundColor: colors.achtergrond }]}>
        <View style={styles.inhoud}>
          <View style={styles.logo}>
            <KaderLogo size={96} variant="donker" />
          </View>
          <Text style={[styles.titel, { color: colors.tekstPrimair }]}>Welkom bij v0.1!</Text>
          <Text style={[Type.sectiekop, styles.subtitel, { color: colors.primair }]}>
            De grootste update tot nu toe.
          </Text>
          <Text style={[Type.body, styles.body, { color: colors.tekstGedimd }]}>
            Scherpere trades, een frisser portfolio met live waarde, een aparte historie en een directe koppeling met eToro. Tijd om het te vieren met een regen aan bitcoins.
          </Text>
        </View>

        <View style={styles.voet}>
          <Pressable
            style={[styles.knop, { backgroundColor: colors.cta }]}
            onPress={onVerder}
            accessibilityRole="button"
            accessibilityLabel="Bekijk wat er nieuw is"
          >
            <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Bekijk wat er nieuw is</Text>
            <ArrowRight size={16} color="white" strokeWidth={2} />
          </Pressable>
        </View>

        <FeestConfetti actief={zichtbaar} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inhoud: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logo: { marginBottom: spacing.xl },
  titel: {
    fontSize: 38,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitel: { textAlign: 'center', marginBottom: spacing.base },
  body: { textAlign: 'center', lineHeight: 26 },
  voet: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
    paddingTop: spacing.base,
  },
  knop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    minHeight: 48,
  },
});
