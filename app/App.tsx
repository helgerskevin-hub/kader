import React, { useState, useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { FoutGrens } from './src/components/FoutGrens';
import { Tab, BottomNav } from './src/components/BottomNav';
import { MarktScreen } from './src/screens/MarktScreen';
import { KansenScreen } from './src/screens/KansenScreen';
import { PortfolioScreen } from './src/screens/PortfolioScreen';
import { TradersScreen } from './src/screens/TradersScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { laadVlag, bewaarVlag, laadTekst, bewaarTekst, SLEUTELS } from './src/storage/opslag';
import { stelDagelijkseMeldingIn } from './src/notifications/meldingen';
import { MarktProvider } from './src/state/MarktProvider';
import { PortfolioProvider } from './src/state/PortfolioProvider';
import { ChangelogSheet } from './src/components/ChangelogSheet';
import { nieuwsteVersie } from './src/changelog';
import { useReduceMotion } from './src/theme/useReduceMotion';

function AppInhoud() {
  const { colors, donkerActief } = useTheme();
  const reduceMotion = useReduceMotion();
  const [onboardingKlaar, setOnboardingKlaar] = useState(false);
  const [onboardingGeladen, setOnboardingGeladen] = useState(false);
  const [actieveTab, setActieveTab] = useState<Tab>('markt');
  const [nieuwInVersie, setNieuwInVersie] = useState(false);
  const schermFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    schermFade.setValue(0);
    Animated.timing(schermFade, {
      toValue: 1,
      duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [actieveTab, reduceMotion, schermFade]);

  useEffect(() => {
    laadVlag(SLEUTELS.onboarding).then(klaar => {
      setOnboardingKlaar(klaar);
      setOnboardingGeladen(true);
      if (klaar) stelDagelijkseMeldingIn();
    });
  }, []);

  useEffect(() => {
    if (!onboardingGeladen || !onboardingKlaar) return;
    laadTekst(SLEUTELS.changelogVersie, '').then(gezien => {
      const nieuwste = nieuwsteVersie();
      if (gezien !== nieuwste) setNieuwInVersie(true);
    });
  }, [onboardingGeladen, onboardingKlaar]);

  function sluitNieuwInVersie() {
    setNieuwInVersie(false);
    bewaarTekst(SLEUTELS.changelogVersie, nieuwsteVersie());
  }

  if (!onboardingGeladen) {
    return <View style={[styles.root, { backgroundColor: colors.achtergrond }]} />;
  }

  if (!onboardingKlaar) {
    return (
      <OnboardingScreen
        onKlaar={() => {
          setOnboardingKlaar(true);
          bewaarVlag(SLEUTELS.onboarding, true);
          stelDagelijkseMeldingIn();
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.schermen,
          {
            opacity: schermFade,
            transform: [{
              translateY: schermFade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
            }],
          },
        ]}
      >
        <FoutGrens>
          {actieveTab === 'markt' && <MarktScreen />}
          {actieveTab === 'kansen' && <KansenScreen />}
          {actieveTab === 'portfolio' && <PortfolioScreen />}
          {actieveTab === 'traders' && <TradersScreen />}
        </FoutGrens>
      </Animated.View>
      <BottomNav actief={actieveTab} onWissel={setActieveTab} />
      <StatusBar style={donkerActief ? 'light' : 'dark'} />
      <ChangelogSheet zichtbaar={nieuwInVersie} onSluiten={sluitNieuwInVersie} alleenNieuwste />
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  if (!fontsLoaded && !fontError) {
    return <View style={[styles.root, { backgroundColor: '#F8FAFC' }]} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MarktProvider>
          <PortfolioProvider>
            <AppInhoud />
          </PortfolioProvider>
        </MarktProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  schermen: { flex: 1 },
});
