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
import { WelkomFeest } from './src/components/WelkomFeest';
import { EtoroPromptSheet } from './src/components/EtoroPromptSheet';
import { EtoroKoppelingWizard } from './src/components/EtoroKoppelingWizard';
import { CHANGELOG, nieuwsteVersie } from './src/changelog';
import { useReduceMotion } from './src/theme/useReduceMotion';
import { usePortfolio } from './src/state/PortfolioProvider';

function AppInhoud() {
  const { colors, donkerActief } = useTheme();
  // Zodra er sleutels zijn opgeslagen alsnog synchroniseren: de sync bij het openen van de app
  // draaide toen nog zonder koppeling en zou anders pas na een herstart iets ophalen.
  const { synchroniseer } = usePortfolio();
  const reduceMotion = useReduceMotion();
  const [onboardingKlaar, setOnboardingKlaar] = useState(false);
  const [onboardingGeladen, setOnboardingGeladen] = useState(false);
  const [actieveTab, setActieveTab] = useState<Tab>('markt');
  const [nieuwInVersie, setNieuwInVersie] = useState(false);
  const [welkomOpen, setWelkomOpen] = useState(false);
  const [etoroPromptOpen, setEtoroPromptOpen] = useState(false);
  const [etoroSetupOpen, setEtoroSetupOpen] = useState(false);
  // Elk scherm dat ooit bezocht is blijft gemount (state/scrollpositie/filters blijven behouden)
  // en krijgt een eigen opacity-waarde. Bij een tabwissel faden we het nieuwe scherm over het
  // vorige heen in plaats van eerst uit te faden: zo is er nooit een leeg frame en dus geen flits.
  const [bezochteTabs, setBezochteTabs] = useState<Tab[]>(['markt']);
  const fadeWaarden = useRef<Record<Tab, Animated.Value>>({
    markt: new Animated.Value(1),
    kansen: new Animated.Value(0),
    portfolio: new Animated.Value(0),
    traders: new Animated.Value(0),
  }).current;
  const vorigeTabRef = useRef<Tab>('markt');
  // Het scherm dat nog zichtbaar moet blijven onder de nieuwe tab tot de fade-in klaar is.
  const [overgangTab, setOvergangTab] = useState<Tab | null>(null);
  const overgangTabRef = useRef<Tab | null>(null);
  function zetOvergangTab(tab: Tab | null) {
    overgangTabRef.current = tab;
    setOvergangTab(tab);
  }

  useEffect(() => {
    const vorige = vorigeTabRef.current;
    if (vorige === actieveTab) return;
    vorigeTabRef.current = actieveTab;
    setBezochteTabs(prev => (prev.includes(actieveTab) ? prev : [...prev, actieveTab]));

    if (reduceMotion) {
      fadeWaarden[vorige].setValue(0);
      fadeWaarden[actieveTab].setValue(1);
      zetOvergangTab(null);
      return;
    }

    zetOvergangTab(vorige);
    fadeWaarden[actieveTab].setValue(0);
    Animated.timing(fadeWaarden[actieveTab], {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      fadeWaarden[vorige].setValue(0);
      // Alleen opruimen als er niet ondertussen alweer een nieuwere wissel is gestart,
      // anders verbergen we per ongeluk het scherm van die nieuwere overgang.
      if (overgangTabRef.current === vorige) zetOvergangTab(null);
    });
  }, [actieveTab, reduceMotion, fadeWaarden]);

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
      if (gezien === nieuwste) return;
      // Mijlpaal-release: eerst het feestelijke welkomscherm, daarna pas de release-notes.
      if (CHANGELOG[0]?.feest) setWelkomOpen(true);
      else setNieuwInVersie(true);
    });
  }, [onboardingGeladen, onboardingKlaar]);

  function sluitNieuwInVersie() {
    setNieuwInVersie(false);
    bewaarTekst(SLEUTELS.changelogVersie, nieuwsteVersie());
    verwijsNaarEtoroIndienNodig();
  }

  // Eenmalige verwijzing naar de eToro-koppeling na de release-notes, maar alleen als er
  // nog geen sleutels zijn ingesteld en we er nog niet naar vroegen. In-app popup (huisstijl).
  async function verwijsNaarEtoroIndienNodig() {
    const alGevraagd = await laadVlag(SLEUTELS.etoroSetupGevraagd);
    if (alGevraagd) return;
    const [apiKey, userKey] = await Promise.all([
      laadTekst(SLEUTELS.etoroApiKey, ''),
      laadTekst(SLEUTELS.etoroUserKey, ''),
    ]);
    if (apiKey && userKey) return;
    bewaarVlag(SLEUTELS.etoroSetupGevraagd, true);
    setTimeout(() => setEtoroPromptOpen(true), 350);
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
    <View style={[styles.root, { backgroundColor: colors.achtergrond }]}>
      <View style={styles.schermen}>
        {bezochteTabs.map(tab => {
          const isActief = tab === actieveTab;
          const isOvergang = tab === overgangTab;
          const zichtbaar = isActief || isOvergang;
          return (
            <Animated.View
              key={tab}
              pointerEvents={isActief ? 'auto' : 'none'}
              style={[
                StyleSheet.absoluteFill,
                { opacity: fadeWaarden[tab], zIndex: isActief ? 2 : 1 },
                !zichtbaar && styles.verborgen,
              ]}
            >
              <FoutGrens>
                {tab === 'markt' && <MarktScreen />}
                {tab === 'kansen' && <KansenScreen />}
                {tab === 'portfolio' && <PortfolioScreen />}
                {tab === 'traders' && <TradersScreen />}
              </FoutGrens>
            </Animated.View>
          );
        })}
      </View>
      <BottomNav actief={actieveTab} onWissel={setActieveTab} />
      <StatusBar style={donkerActief ? 'light' : 'dark'} />
      <WelkomFeest
        zichtbaar={welkomOpen}
        onVerder={() => { setWelkomOpen(false); setNieuwInVersie(true); }}
      />
      <ChangelogSheet zichtbaar={nieuwInVersie} onSluiten={sluitNieuwInVersie} alleenNieuwste />
      <EtoroPromptSheet
        zichtbaar={etoroPromptOpen}
        onLater={() => setEtoroPromptOpen(false)}
        onNuInstellen={() => { setEtoroPromptOpen(false); setEtoroSetupOpen(true); }}
      />
      <EtoroKoppelingWizard
        zichtbaar={etoroSetupOpen}
        onSluiten={() => setEtoroSetupOpen(false)}
        onOpgeslagen={synchroniseer}
      />
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
  verborgen: { display: 'none' },
});
