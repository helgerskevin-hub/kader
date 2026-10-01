import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
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
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { FoutGrens } from './src/components/FoutGrens';
import { Tab, BottomNav, TAB_VOLGORDE, type TabPagerStand } from './src/components/BottomNav';
import { MarktScreen } from './src/screens/MarktScreen';
import { KansenScreen } from './src/screens/KansenScreen';
import { PortfolioScreen } from './src/screens/PortfolioScreen';
import { TradersScreen } from './src/screens/TradersScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { laadVlag, bewaarVlag, laadTekst, bewaarTekst, SLEUTELS } from './src/storage/opslag';
import { haalOmgeving, heeftEnigeSleutel } from './src/state/etoroSleutels';
import { stelDagelijkseMeldingIn } from './src/notifications/meldingen';
import { meldingenAan } from './src/state/meldingVoorkeur';
// Importeert tegelijk de TaskManager-taakdefinitie op module-niveau: die moet bestaan zodra Android
// de app wakker maakt voor de achtergrondcheck, niet pas als een component gemount is.
import { registreerAchtergrondtaak } from './src/notifications/achtergrondtaak';
import { MarktProvider, useMarkt } from './src/state/MarktProvider';
import { KansenProvider } from './src/state/KansenProvider';
import { laadValutaBijStart } from './src/state/useValuta';
import { PortfolioProvider } from './src/state/PortfolioProvider';
import { DialoogProvider } from './src/state/DialoogProvider';
import { NavigatieProvider } from './src/state/navigatie';
import { ChangelogSheet } from './src/components/ChangelogSheet';
import { WelkomFeest } from './src/components/WelkomFeest';
import { EtoroPromptSheet } from './src/components/EtoroPromptSheet';
import { EtoroKoppelingWizard } from './src/components/EtoroKoppelingWizard';
import { CHANGELOG, nieuwsteVersie } from './src/changelog';
import { useBeweging } from './src/theme/useReduceMotion';
import { duur, veer, vervaag } from './src/theme/beweging';
import { usePortfolio } from './src/state/PortfolioProvider';
import { TabZichtbaarContext } from './src/state/tabZichtbaar';

// Geen props, dus React.memo houdt deze schermen volledig stil als AppInhoud hertekent door
// bijvoorbeeld de prijzen-poll in PortfolioProvider (elke 60s), ook tijdens een tabwissel.
const MarktScherm = React.memo(MarktScreen);
const KansenScherm = React.memo(KansenScreen);
const PortfolioScherm = React.memo(PortfolioScreen);
const TradersScherm = React.memo(TradersScreen);

const LAATSTE = TAB_VOLGORDE.length - 1;

// Pas vanaf 20dp horizontaal wordt een veeg een tabwissel, en 12dp verticaal eerst maakt er een
// scroll van. Zo wint scrollen door een lijst altijd, want die neemt de aanraking al bij 8dp.
const SWIPE_DREMPEL_X = 20;
const SWIPE_AFBREEK_Y = 12;
// Boven deze loslaatsnelheid (pt/s) gaat een korte veeg toch door naar de volgende tab.
const SWIPE_SNELHEID = 500;

// Weerstand voorbij de eerste en laatste tab, de rubberband van iOS, in pagina's gerekend.
function rubberband(overschot: number): number {
  'worklet';
  return 1 - 1 / (overschot * 0.55 + 1);
}

function begrens(waarde: number): number {
  'worklet';
  return Math.min(LAATSTE, Math.max(0, waarde));
}

// Alle stand van de pager, op de UI-thread. `sprongVan`/`sprongNaar` zijn gezet tijdens een tik
// naar een tab die niet naast de huidige ligt; `vervaagt` tijdens de cross-fade onder Minder
// beweging.
interface PagerWaarden extends TabPagerStand {
  breedte: SharedValue<number>;
  sprongVan: SharedValue<number>;
  sprongNaar: SharedValue<number>;
  vervaagt: SharedValue<boolean>;
  dekking: SharedValue<number>;
}

// Eén pagina van de pager. Elke pagina rekent zijn eigen verschuiving uit de gedeelde positie, dus
// tijdens een swipe of wissel tekent React niets: alleen de UI-thread schuift.
function TabPagina({ index, pager, actief, getoond, inBeeld, children }: {
  index: number;
  pager: PagerWaarden;
  actief: boolean;
  getoond: boolean;
  // Echt in beeld (actief, wegschuivend of de buur waar een veeg naartoe gaat), niet alleen klaar
  // gezet naast het scherm. Daarop pauzeren eindeloze animaties, zie tabZichtbaar.ts.
  inBeeld: boolean;
  children: React.ReactNode;
}) {
  const stijl = useAnimatedStyle(() => {
    const w = pager.breedte.value;
    const p = pager.positie.value;
    let x = (index - p) * w;
    let opacity = 1;
    const van = pager.sprongVan.value;
    const naar = pager.sprongNaar.value;
    if (van >= 0 && naar >= 0 && van !== naar) {
      if (pager.vervaagt.value) {
        // Cross-fade: de oude pagina blijft staan, de nieuwe (al op zijn plek) fadet erover.
        if (index === van) x = 0;
        if (index === naar) opacity = pager.dekking.value;
      } else {
        // Sprong over meer dan één tab: alleen de oude en de nieuwe pagina schuiven, als buren,
        // in plaats van dat alle tabs ertussen voorbij flitsen.
        const richting = naar > van ? 1 : -1;
        const t = (p - van) / (naar - van);
        if (index === van) x = -richting * t * w;
        else if (index === naar) x = richting * (1 - t) * w;
        else x = 2 * w;
      }
    }
    return { opacity, transform: [{ translateX: x }] };
  });

  return (
    <Animated.View
      pointerEvents={actief ? 'auto' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        { zIndex: actief ? 2 : 1 },
        stijl,
        !getoond && styles.verborgen,
      ]}
    >
      <TabZichtbaarContext.Provider value={inBeeld}>{children}</TabZichtbaarContext.Provider>
    </Animated.View>
  );
}

// Luistert in zijn eentje naar de marktscan, zodat niet heel AppInhoud bij elk voortgangstikje
// opnieuw tekent: AppInhoud hoort alleen wanneer de scan begint of stopt.
function ScanWachter({ onWissel }: { onWissel: (bezig: boolean) => void }) {
  const { state } = useMarkt();
  const bezig = state.status === 'loading';
  useEffect(() => {
    onWissel(bezig);
  }, [bezig, onWissel]);
  return null;
}

function AppInhoud() {
  const { colors, donkerActief } = useTheme();
  // Zodra er sleutels zijn opgeslagen alsnog synchroniseren: de sync bij het openen van de app
  // draaide toen nog zonder koppeling en zou anders pas na een herstart iets ophalen. Via
  // setOmgeving met de bewaarde omgeving, net als Instellingen: dat ververst ook het schrijfrecht en
  // synchroniseert daarna, en wisselt nooit van omgeving.
  const { setOmgeving } = usePortfolio();
  const naKoppelen = useCallback(() => {
    haalOmgeving().then(setOmgeving).catch(() => {});
  }, [setOmgeving]);
  const { reduceMotion, naar } = useBeweging();
  const { width: schermBreedte } = useWindowDimensions();
  const [onboardingKlaar, setOnboardingKlaar] = useState(false);
  const [onboardingGeladen, setOnboardingGeladen] = useState(false);
  const [actieveTab, setActieveTab] = useState<Tab>('markt');
  const [nieuwInVersie, setNieuwInVersie] = useState(false);
  const [welkomOpen, setWelkomOpen] = useState(false);
  const [etoroPromptOpen, setEtoroPromptOpen] = useState(false);
  const [etoroSetupOpen, setEtoroSetupOpen] = useState(false);
  // De tabs zijn pagina's naast elkaar, en één gedeelde positie op de UI-thread bepaalt waar ze
  // staan: een tik laat die naar de nieuwe tab veren, een swipe laat hem de vinger volgen. De
  // tabbalk leest dezelfde positie, zodat de pil onder je vinger meeloopt.
  //
  // Elk scherm dat ooit bezocht is blijft gemount (state/scrollpositie/filters blijven behouden).
  // Een nieuw scherm mount in dezelfde render die het actief maakt, en de beweging start pas in het
  // layout-effect daarna: de oude pagina blijft dus staan tot de nieuwe er is, er is nooit een
  // leeg frame en dus geen flits.
  //
  // Nooit bezochte tabs mounten we vooruit, maar pas als de app na het opstarten stil is, en één
  // per keer (zie het effect hieronder). Eerst deden we dat pas bij de eerste swipe erheen, maar
  // dan lag er op de emulator 0,3 s (Kansen) tot 0,6 s (Portfolio, dat al je trades tekent) een
  // lege pagina onder je vinger. Geen scherm doet bij het mounten iets duurs over het netwerk (de
  // Kansen-scan start pas als dat scherm echt in beeld komt, zie useTabZichtbaar in KansenScreen;
  // de marktanalyse zit in MarktProvider), dus het enige wat het kost is die JS-tijd, en die valt
  // nu in een moment waarop niemand iets doet. Swipe je
  // eerder dan dat, dan mount de buur alsnog meteen bij het begin van de swipe.
  // "Stil" betekent ook: er loopt geen marktscan. Tijdens de scan tekent elke useMarkt-gebruiker bij
  // elk voortgangstikje opnieuw, en een vooruit gemount Portfolio deed dat dan onzichtbaar mee.
  const [bezochteTabs, setBezochteTabs] = useState<Tab[]>(['markt']);
  const [scanBezig, setScanBezig] = useState(false);
  const bezochteTabsRef = useRef(bezochteTabs);
  bezochteTabsRef.current = bezochteTabs;
  // Het scherm dat nog getoond moet blijven terwijl de nieuwe tab binnenkomt.
  const [overgangTab, setOvergangTab] = useState<Tab | null>(null);
  // De buur waar een swipe naartoe trekt, ook als die niet naast de vastgelegde tab ligt.
  const [sleepBuur, setSleepBuur] = useState<Tab | null>(null);
  // De beweging zelf start in een layout-effect, na de render die het doelscherm mount maar vóór
  // de paint. wisselRef geeft door welke wissel er moet starten; de teller zorgt dat het effect
  // ook draait als actieveTab gelijk blijft (een tik terwijl een swipe nog uitloopt).
  const wisselRef = useRef<{ van: number; naar: number } | null>(null);
  const [wisselNr, setWisselNr] = useState(0);

  const positie = useSharedValue(0);
  const doel = useSharedValue(0);
  const sleept = useSharedValue(false);
  const breedte = useSharedValue(schermBreedte);
  const sprongVan = useSharedValue(-1);
  const sprongNaar = useSharedValue(-1);
  const vervaagt = useSharedValue(false);
  const dekking = useSharedValue(1);
  const sleepStart = useSharedValue(0);
  // Eén stabiel object, zodat de pagina's en de tabbalk niet bij elke render een nieuwe prop zien.
  const pager = useMemo<PagerWaarden>(
    () => ({ positie, doel, sleept, breedte, sprongVan, sprongNaar, vervaagt, dekking }),
    [positie, doel, sleept, breedte, sprongVan, sprongNaar, vervaagt, dekking],
  );

  // Een beweging is geland. Alleen vastleggen als er intussen niet alweer een andere wissel of
  // swipe is begonnen, anders zetten we de tab terug naar een oud doel.
  function opBestemming(index: number) {
    if (pager.doel.value !== index) return;
    const tab = TAB_VOLGORDE[index];
    setBezochteTabs(prev => (prev.includes(tab) ? prev : [...prev, tab]));
    setActieveTab(tab);
    setOvergangTab(null);
    setSleepBuur(null);
  }

  // Zie het commentaar bij bezochteTabs. De eerste pauze laat de marktanalyse en de eerste paint
  // voorgaan; daarna telkens op een stil moment de volgende tab, zodat er nooit één lange hapering
  // ontstaat.
  useEffect(() => {
    if (scanBezig) return;
    let gestopt = false;
    let klok: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    const volgende = () => {
      if (gestopt) return;
      idle = requestIdleCallback(() => {
        if (gestopt) return;
        // Uit de ref en niet uit een updater-functie: die draait pas bij de volgende render, dus
        // daarin kunnen we hier nog niet zien of er na deze tab nog een volgt.
        const ontbreekt = TAB_VOLGORDE.filter(t => !bezochteTabsRef.current.includes(t));
        if (ontbreekt.length === 0) return;
        setBezochteTabs(prev => (prev.includes(ontbreekt[0]) ? prev : [...prev, ontbreekt[0]]));
        if (ontbreekt.length > 1) klok = setTimeout(volgende, 400);
      });
    };
    klok = setTimeout(volgende, 1500);
    return () => {
      gestopt = true;
      if (klok) clearTimeout(klok);
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, [scanBezig]);

  function zorgGemount(index: number) {
    const tab = TAB_VOLGORDE[index];
    setBezochteTabs(prev => (prev.includes(tab) ? prev : [...prev, tab]));
    setSleepBuur(tab);
  }

  function wisselTab(tab: Tab) {
    const naarIndex = TAB_VOLGORDE.indexOf(tab);
    if (tab === actieveTab && pager.doel.value === naarIndex && !pager.sleept.value) return;
    // De pagina die nu het meest in beeld is, is waar de wissel vandaan komt.
    const vanIndex = begrens(Math.round(pager.positie.value));
    pager.doel.value = naarIndex;

    // Alles wat de zichtbaarheid bepaalt in één gebatchte update: zo bestaat er geen frame
    // waarin het oude scherm al verborgen is en het nieuwe nog niet gemount.
    setBezochteTabs(prev => (prev.includes(tab) ? prev : [...prev, tab]));
    setOvergangTab(vanIndex !== naarIndex ? TAB_VOLGORDE[vanIndex] : null);
    setActieveTab(tab);
    wisselRef.current = { van: vanIndex, naar: naarIndex };
    setWisselNr(n => n + 1);
  }

  useLayoutEffect(() => {
    const wissel = wisselRef.current;
    if (!wissel) return;
    wisselRef.current = null;
    const { van, naar: doelIndex } = wissel;
    const klaar = (afgerond?: boolean) => {
      'worklet';
      if (!afgerond) return;
      pager.sprongVan.value = -1;
      pager.sprongNaar.value = -1;
      pager.vervaagt.value = false;
      scheduleOnRN(opBestemming, doelIndex);
    };

    if (reduceMotion) {
      // Minder beweging: geen glijden, de nieuwe pagina staat meteen op zijn plek en fadet over de
      // oude heen, net als de cross-fade van vroeger.
      cancelAnimation(pager.positie);
      pager.sprongVan.value = van;
      pager.sprongNaar.value = doelIndex;
      pager.vervaagt.value = van !== doelIndex;
      pager.dekking.value = 0;
      pager.positie.value = doelIndex;
      pager.dekking.value = vervaag(1, duur.midden, klaar);
      return;
    }

    const sprong = Math.abs(doelIndex - van) > 1;
    pager.sprongVan.value = sprong ? van : -1;
    pager.sprongNaar.value = sprong ? doelIndex : -1;
    pager.vervaagt.value = false;
    pager.dekking.value = 1;
    pager.positie.value = withSpring(doelIndex, veer.zacht, klaar);
    // Alleen per wissel; de rest leest het effect op het moment zelf.
  }, [wisselNr]);

  const swipe = useMemo(() => Gesture.Pan()
    .activeOffsetX([-SWIPE_DREMPEL_X, SWIPE_DREMPEL_X])
    .failOffsetY([-SWIPE_AFBREEK_Y, SWIPE_AFBREEK_Y])
    .onStart(e => {
      // Onderbreekbaar: een lopende wissel stopt waar hij is en de vinger neemt het over.
      cancelAnimation(pager.positie);
      cancelAnimation(pager.dekking);
      if (pager.sprongVan.value >= 0) {
        // Een sprong over meer tabs of een cross-fade laat zich niet als gewone positie
        // voortzetten. We landen op de pagina die het meest in beeld was en gaan vanaf daar.
        if (!pager.vervaagt.value) {
          const van = pager.sprongVan.value;
          const t = (pager.positie.value - van) / (pager.sprongNaar.value - van);
          pager.positie.value = t < 0.5 ? van : pager.sprongNaar.value;
        }
        pager.sprongVan.value = -1;
        pager.sprongNaar.value = -1;
        pager.vervaagt.value = false;
        pager.dekking.value = 1;
      }
      pager.sleept.value = true;
      sleepStart.value = pager.positie.value;
      const buur = Math.round(pager.positie.value) + (e.translationX < 0 ? 1 : -1);
      if (buur >= 0 && buur <= LAATSTE) scheduleOnRN(zorgGemount, buur);
    })
    .onUpdate(e => {
      const w = pager.breedte.value;
      if (w <= 0) return;
      let p = sleepStart.value - e.translationX / w;
      if (p < 0) p = -rubberband(-p);
      else if (p > LAATSTE) p = LAATSTE + rubberband(p - LAATSTE);
      pager.positie.value = p;
      pager.doel.value = begrens(Math.round(p));
    })
    .onEnd(e => {
      const w = pager.breedte.value;
      const p = pager.positie.value;
      // Zoals iOS: een snelle veeg telt ook als hij kort was, anders wint de dichtstbijzijnde pagina.
      let doelIndex = Math.round(p);
      if (e.velocityX < -SWIPE_SNELHEID) doelIndex = Math.ceil(p);
      else if (e.velocityX > SWIPE_SNELHEID) doelIndex = Math.floor(p);
      // Nooit meer dan één tab per veeg.
      const basis = Math.round(sleepStart.value);
      doelIndex = begrens(Math.min(basis + 1, Math.max(basis - 1, doelIndex)));
      pager.doel.value = doelIndex;
      pager.sleept.value = false;
      // naar() geeft de veer de vaart van de vinger mee, of onder Minder beweging een korte timing.
      pager.positie.value = naar(doelIndex, 'zacht', {
        snelheid: w > 0 ? -e.velocityX / w : 0,
        klaar: afgerond => {
          'worklet';
          if (afgerond) scheduleOnRN(opBestemming, doelIndex);
        },
      });
    }),
  // opBestemming en zorgGemount lezen alleen setters en shared values, dus de versie van de eerste
  // render blijft goed; naar verandert mee met Minder beweging.
  [naar]);

  function opSchermenLayout(e: LayoutChangeEvent) {
    pager.breedte.value = e.nativeEvent.layout.width;
  }

  // De bewaarde valutakeuze en de gecachete wisselkoers moeten er zijn voordat er een bedrag op
  // het scherm komt, anders flitst alles even in dollars voorbij.
  useEffect(() => {
    laadValutaBijStart();
  }, []);

  useEffect(() => {
    laadVlag(SLEUTELS.onboarding).then(klaar => {
      setOnboardingKlaar(klaar);
      setOnboardingGeladen(true);
      // Alleen als de gebruiker meldingen aan heeft staan. Zonder deze controle zou elke app-start
      // de dagelijkse herinnering opnieuw inplannen en de achtergrondtaak weer registreren, en dan
      // is de knop in Instellingen tot de volgende start uit en daarna weer aan.
      if (klaar) meldingenAan().then(aan => {
        if (!aan) return;
        stelDagelijkseMeldingIn();
        registreerAchtergrondtaak();
      });
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
    // Al gekoppeld in welke omgeving dan ook: dan is de verwijzing overbodig.
    if (await heeftEnigeSleutel()) return;
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
    // Binnen AppInhoud en niet daarbuiten, want de provider heeft wisselTab nodig. Alles wat een
    // melding kan aantikken (ScreenHeader staat op elk scherm) zit hierbinnen.
    <NavigatieProvider wisselTab={wisselTab}>
    <ScanWachter onWissel={setScanBezig} />
    <View style={[styles.root, { backgroundColor: colors.achtergrond }]}>
      {/* Het swipegebaar ligt over alle pagina's. Verticaal scrollen wint altijd (zie de drempels
          bovenaan), en een horizontale ScrollView in een scherm (de koopkansen in WatKopenNu) ook:
          die neemt de aanraking native al bij 8dp, en dan breekt gesture-handler dit gebaar af. */}
      <GestureDetector gesture={swipe}>
      <View style={styles.schermen} onLayout={opSchermenLayout}>
        {bezochteTabs.map(tab => {
          const index = TAB_VOLGORDE.indexOf(tab);
          const isActief = tab === actieveTab;
          // Getoond: de actieve pagina, de pagina die nog wegschuift, en de directe buren, zodat
          // die er al staan zodra een swipe begint. De rest krijgt display: none en kost niets.
          const getoond = isActief
            || tab === overgangTab
            || tab === sleepBuur
            || Math.abs(index - TAB_VOLGORDE.indexOf(actieveTab)) === 1;
          return (
            <TabPagina
              key={tab}
              index={index}
              pager={pager}
              actief={isActief}
              getoond={getoond}
              inBeeld={isActief || tab === overgangTab || tab === sleepBuur}
            >
              <FoutGrens>
                {tab === 'markt' && <MarktScherm />}
                {tab === 'kansen' && <KansenScherm />}
                {tab === 'portfolio' && <PortfolioScherm />}
                {tab === 'traders' && <TradersScherm />}
              </FoutGrens>
            </TabPagina>
          );
        })}
      </View>
      </GestureDetector>
      <BottomNav actief={actieveTab} onWissel={wisselTab} pager={pager} />
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
        onOpgeslagen={naKoppelen}
        toonNaarPortfolio
      />
    </View>
    </NavigatieProvider>
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
    // Helemaal buitenaan: gesture-handler herkent alleen gebaren binnen deze root, en elk gebaar
    // (swipe-terug, sheet dichtslepen, grafiek scrubben) moet overal in de app kunnen werken.
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <MarktProvider>
            <KansenProvider>
              <PortfolioProvider>
                {/* Binnen PortfolioProvider, zodat elk scherm en elke sheet een dialoog kan opvragen. */}
                <DialoogProvider>
                  <AppInhoud />
                </DialoogProvider>
              </PortfolioProvider>
            </KansenProvider>
          </MarktProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // overflow hidden: pagina's die naast het scherm geschoven staan hoeven niet getekend te worden.
  schermen: { flex: 1, overflow: 'hidden' },
  verborgen: { display: 'none' },
});
