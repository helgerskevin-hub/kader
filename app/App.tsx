import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
// Importeert tegelijk de TaskManager-taakdefinitie op module-niveau: die moet bestaan zodra Android
// de app wakker maakt voor de achtergrondcheck, niet pas als een component gemount is.
import { registreerAchtergrondtaak } from './src/notifications/achtergrondtaak';
import { MarktProvider } from './src/state/MarktProvider';
import { PortfolioProvider } from './src/state/PortfolioProvider';
import { ChangelogSheet } from './src/components/ChangelogSheet';
import { WelkomFeest } from './src/components/WelkomFeest';
import { EtoroPromptSheet } from './src/components/EtoroPromptSheet';
import { EtoroKoppelingWizard } from './src/components/EtoroKoppelingWizard';
import { CHANGELOG, nieuwsteVersie } from './src/changelog';
import { useReduceMotion } from './src/theme/useReduceMotion';
import { usePortfolio } from './src/state/PortfolioProvider';

// Geen props, dus React.memo houdt deze schermen volledig stil als AppInhoud hertekent door
// bijvoorbeeld de prijzen-poll in PortfolioProvider (elke 60s), ook tijdens de cross-fade.
const MarktScherm = React.memo(MarktScreen);
const KansenScherm = React.memo(KansenScreen);
const PortfolioScherm = React.memo(PortfolioScreen);
const TradersScherm = React.memo(TradersScreen);

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
  // Het scherm dat nog zichtbaar moet blijven onder de nieuwe tab tot de fade-in klaar is.
  const [overgangTab, setOvergangTab] = useState<Tab | null>(null);
  // De fade zelf start in een layout-effect, na deze render maar vóór de paint. wisselRef geeft
  // dat effect door welke wissel er nog moet starten (of null als reduceMotion 'm al afhandelde).
  const wisselRef = useRef<{ van: Tab; naar: Tab } | null>(null);

  function wisselTab(tab: Tab) {
    const vorige = actieveTab;
    if (tab === vorige) return;

    // Een afgebroken fade kan een opacity op een tussenwaarde hebben laten staan; hard
    // terugzetten vóór de render die dit scherm toont, anders doemt het even vol op.
    fadeWaarden[tab].stopAnimation();
    fadeWaarden[tab].setValue(reduceMotion ? 1 : 0);
    fadeWaarden[vorige].stopAnimation();
    fadeWaarden[vorige].setValue(1);

    // Alles wat de zichtbaarheid bepaalt in één gebatchte update: zo bestaat er geen frame
    // waarin het oude scherm al verborgen is en het nieuwe nog niet gemount.
    setBezochteTabs(prev => (prev.includes(tab) ? prev : [...prev, tab]));
    setOvergangTab(reduceMotion ? null : vorige);
    setActieveTab(tab);

    wisselRef.current = reduceMotion ? null : { van: vorige, naar: tab };
  }

  useLayoutEffect(() => {
    const wissel = wisselRef.current;
    if (!wissel) return;
    wisselRef.current = null;
    Animated.timing(fadeWaarden[wissel.naar], {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      // Alleen opruimen als er niet ondertussen alweer een nieuwere wissel is gestart,
      // anders verbergen we per ongeluk het scherm van die nieuwere overgang.
      setOvergangTab(huidig => (huidig === wissel.van ? null : huidig));
    });
  }, [actieveTab, fadeWaarden]);

  useEffect(() => {
    laadVlag(SLEUTELS.onboarding).then(klaar => {
      setOnboardingKlaar(klaar);
      setOnboardingGeladen(true);
      if (klaar) {
        stelDagelijkseMeldingIn();
        registreerAchtergrondtaak();
      }
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
          registreerAchtergrondtaak();
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
                {tab === 'markt' && <MarktScherm />}
                {tab === 'kansen' && <KansenScherm />}
                {tab === 'portfolio' && <PortfolioScherm />}
                {tab === 'traders' && <TradersScherm />}
              </FoutGrens>
            </Animated.View>
          );
        })}
      </View>
      <BottomNav actief={actieveTab} onWissel={wisselTab} />
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
