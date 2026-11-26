import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { KaderLogo } from '../KaderLogo';
import { useTheme } from '../../theme/ThemeProvider';
import { duur, vervaag } from '../../theme/beweging';
import { useAfgedekt } from '../../state/afdekking';

interface Props {
  // Of de inhoud afgedekt moet zijn (de store-hook useAfgedekt() geeft dit door).
  zichtbaar: boolean;
}

// Na deze tijd is de vervagende laag weg uit de boom, ook als de fade niet afliep. Ruim boven
// duur.kort, en ruim onder de twee seconden waarna Reanimated zijn eindwaarde vergeet (zie onder).
const VERVAAG_WEG_MS = duur.kort + 200;

// Een absolute, volledig dekkende laag met alleen de achtergrondkleur en het logo, geen inhoud.
// Hij staat in de root-View en als laatste kind van de Modal-wrappers, zodat Recente apps en de
// eerste frames na terugkomst nooit saldo of posities laten zien.
//
// Aan is een gewone View met volle dekking: die dekt in dezelfde commit, zonder te wachten op een
// effect of op de UI-thread van Reanimated (een fade-in zou juist inhoud laten doorschemeren op
// het moment dat afdekken moet). Zolang hij zichtbaar is, vangt hij alle aanrakingen op.
//
// Uit vervaagt kort en verdwijnt daarna helemaal uit de boom. Dat laatste is de eigenlijke garantie,
// niet de fade. Reanimated 4.3 (FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS) houdt de eindwaarde van
// een animatie maar twee seconden vast in zijn props-register; binnen die tijd moet een JS-interval
// hem terugzetten in de React-props. Mist dat interval het venster (JS-timers staan stil terwijl de
// biometrie- of schermslotprompt de activity pauzeert, de JS-thread is bezig bij een koude start, of
// het interval staat uit omdat zijn tellerstand scheefloopt bij het sluiten van een GestureDetector
// om een Animated.View, zoals in BottomSheet en PodiumScherm), dan vervalt de waarde. De eerstvolgende
// React-commit zette de laag daarna terug op zijn begin-opacity 1: het logo stond weer over de app,
// met pointerEvents none, dus aanrakingen gingen er dwars doorheen. Een laag die niet meer bestaat
// kan niet terugkomen.
export function AfdekLaag({ zichtbaar }: Props) {
  const { colors, donkerActief } = useTheme();
  // Of de uit-laag nog vervaagt. Begint uit: mount de laag als uit (een Modal die opent terwijl de
  // app al open is), dan is er niets te vervagen en staat er dus niets.
  const [vorige, setVorige] = useState(zichtbaar);
  const [vervaagt, setVervaagt] = useState(false);
  // Afgeleide state tijdens de render (toegestaan patroon, zie useNaSlot): bij aan -> uit begint
  // een fade, bij uit -> aan stopt hij meteen.
  if (zichtbaar !== vorige) {
    setVorige(zichtbaar);
    setVervaagt(!zichtbaar);
  }

  useEffect(() => {
    if (!vervaagt) return;
    // Een JS-timer, geen callback van de animatie: die zou in hetzelfde Reanimated-pad vallen. Staan
    // de JS-timers even stil, dan vuurt hij bij de eerste beurt daarna.
    const t = setTimeout(() => setVervaagt(false), VERVAAG_WEG_MS);
    return () => clearTimeout(t);
  }, [vervaagt]);

  const basis = [StyleSheet.absoluteFill, styles.laag, { backgroundColor: colors.achtergrond }];
  const logo = <KaderLogo size={56} variant={donkerActief ? 'donker' : 'licht'} />;

  if (zichtbaar) {
    return (
      <View
        pointerEvents="auto"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={basis}
      >
        {logo}
      </View>
    );
  }
  if (!vervaagt) return null;
  return (
    <VervagendeLaag stijl={basis}>
      {logo}
    </VervagendeLaag>
  );
}

// Bij elke fade een nieuw exemplaar (hij ontkoppelt tussendoor), dus een verse gedeelde waarde en
// een begin-opacity 1 die bij deze fade hoort. Een ander element dan de aan-laag: een vaste opacity
// op dezelfde Animated.View zou React overslaan als zijn eigen props al 1 zeiden, terwijl Reanimated
// de native view intussen op 0 had gezet.
function VervagendeLaag({
  stijl,
  children,
}: {
  stijl: React.ComponentProps<typeof View>['style'];
  children: React.ReactNode;
}) {
  const dekking = useSharedValue(1);
  useEffect(() => {
    dekking.value = vervaag(0, duur.kort);
  }, [dekking]);
  const animatie = useAnimatedStyle(() => ({ opacity: dekking.value }));
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[stijl, animatie]}
    >
      {children}
    </Animated.View>
  );
}

// De afdeklaag met de store erin. Een eigen component, zodat alleen deze laag hertekent als de
// afdekking wisselt, en niet de Modal-wrapper (of de root) waar hij in staat.
export function WrapperAfdekking() {
  return <AfdekLaag zichtbaar={useAfgedekt()} />;
}

const styles = StyleSheet.create({
  laag: { alignItems: 'center', justifyContent: 'center' },
});
