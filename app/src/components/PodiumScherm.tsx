import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../theme/useReduceMotion';
import { duur, veer, vervaag } from '../theme/beweging';
import { haptiekVanUI } from '../theme/haptiek';
import { radii } from '../theme/tokens';
import { neemBron, type BronRect } from '../state/bronRect';

// De gedeelde schil voor elk full-screen scherm (coin-detail, historie, verdeling, uitleg).
//
// Het blijft een React Native Modal, maar transparant en zonder eigen animatie: de beweging doen we
// hier zelf op de UI-thread. Een Modal houdt drie dingen die een eigen overlay opnieuw zou moeten
// uitvinden: de Android-terugknop (onRequestClose), BottomSheets die als eigen Modal netjes boven
// dit scherm komen te liggen, en venstercoördinaten die gelijklopen met measureInWindow op de kaart
// eronder. Met edge-to-edge aan ligt de Modal over het hele scherm, statusbalk inbegrepen, dus de
// veilige zones vullen we hier zelf in.
//
// Drie manieren van binnenkomen:
// - uit een kaart (bronRect vastgelegd bij de tik): het vlak groeit uit de kaart tot het hele
//   scherm, de inhoud komt er in de eerste 40% overheen. Sluiten krimpt terug de kaart in.
// - zonder kaart (melding, knop): van rechts binnenschuiven op een veer.
// - Minder beweging: alleen een korte cross-fade, geen schaal of glijden.
//
// Swipe-terug vanaf de linkerrand volgt de vinger, is onderbreekbaar, en loslaten beslist op
// afstand en snelheid.

const MODUS_BRON = 0;
const MODUS_SCHUIF = 1;
const MODUS_FADE = 2;

// Hoe donker de tab eronder wordt als het scherm helemaal open is.
const DIM_MAX = 0.3;
// Alleen een veeg die binnen deze strook begint is een swipe-terug. Breder zou horizontaal
// scrubben in de koersgrafiek (die op 16 punten van de rand begint) te vaak kapen.
const RAND_BREEDTE = 30;
// Zo klein wordt het scherm aan het eind van een swipe, zoals een kaart op iOS.
const SWIPE_SCHAAL = 0.94;
// Losgelaten voorbij dit deel van de breedte, of sneller dan dit (punten per seconde) naar rechts:
// dan gaat hij dicht. Een duidelijke beweging terug naar links wint altijd.
const DREMPEL_AFSTAND = 0.35;
const DREMPEL_SNELHEID = 800;
const TERUG_SNELHEID = -200;
// Tot hier in de overgang komt de inhoud over het kaartvlak heen.
const INHOUD_FADE_TOT = 0.4;
// Als onShow van de Modal uitblijft, beginnen we toch. Anders ligt er een onzichtbaar venster dat
// elke aanraking opslokt en lijkt de app bevroren.
const START_TERUGVAL_MS = 250;

// Een veer die naar 0 gaat komt asymptotisch tot stilstand; de standaarddrempel wacht tot de
// laatste fractie van een pixel en houdt de Modal dan nog honderden ms boven een tab die al vrij
// lijkt. Bij 1e-4 van de beginenergie is het vlak op een procent na op zijn plek, en dat laatste
// procent valt samen met de kaart eronder.
const SLUIT_VEER = { ...veer.standaard, energyThreshold: 1e-4 };
// Ook met die drempel duurde het op de emulator nog zo'n 0,7 s voor de Modal echt weg was, en al
// die tijd lag het ondoorzichtige kaartvlak over de echte kaart: de lijst leek leeg. Daarom vervaagt
// het vlak in dit laatste stuk van de voortgang naar de kaart eronder, en melden we het scherm al
// dicht zodra het zo goed als in de kaart zit, in plaats van op de staart van de veer te wachten.
const KAART_OVERNAME_VANAF = 0.12;
const DICHT_BIJ = 0.02;

export interface SluitOpties {
  // false = niet terug de kaart in maar kort uitfaden, voor als er na het sluiten een tabwissel
  // volgt: die kaart ligt dan straks op een tab die niemand meer ziet.
  naarBron?: boolean;
}
export type Sluit = (opties?: SluitOpties) => void;

interface Props {
  zichtbaar: boolean;
  // Wordt pas aangeroepen als de sluitanimatie klaar is, na een eigen sluiting (X, terugknop,
  // swipe). Gaat zichtbaar van buitenaf naar false, dan speelt de animatie ook, maar volgt er
  // geen onSluiten: de ouder wist het al.
  onSluiten: () => void;
  // Als functie krijg je sluit() mee. Gebruik die voor de X en andere sluitknoppen in het scherm,
  // zodat ze eerst wegbewegen en pas daarna onSluiten aanroepen.
  children: React.ReactNode | ((sluit: Sluit) => React.ReactNode);
}

export function PodiumScherm({ zichtbaar, onSluiten, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const [gemount, setGemount] = useState(false);
  const [plaatsKleur, setPlaatsKleur] = useState(colors.achtergrond);

  // 0 = dicht (in de kaart, rechts buiten beeld of onzichtbaar), 1 = helemaal open.
  const voortgang = useSharedValue(0);
  // Hoe ver de vinger het scherm naar rechts heeft gesleept, in punten.
  const sleep = useSharedValue(0);
  const modus = useSharedValue(MODUS_SCHUIF);
  const bron = useSharedValue<BronRect | null>(null);
  const sluitendUI = useSharedValue(false);
  // Werkelijke maat van de Modal, voor de kaart-naar-scherm-rekensom. Eerst de schermmaat als
  // gok; onLayout zet de echte zodra hij er is.
  const maatB = useSharedValue(Dimensions.get('screen').width);
  const maatH = useSharedValue(Dimensions.get('screen').height);

  // Staat die alleen de JS-kant nodig heeft, in refs: een render per frame of per stap zou de
  // animatie laten haperen.
  const modusRef = useRef(MODUS_SCHUIF);
  const sluitendRef = useRef(false);
  const interneSluiting = useRef(false);
  const gestart = useRef(false);
  const onSluitenRef = useRef(onSluiten);
  useEffect(() => {
    onSluitenRef.current = onSluiten;
  }, [onSluiten]);

  const rondAf = useCallback(() => {
    // Intussen heropend: dan is dit het einde van een onderbroken sluiting, niet van het scherm.
    if (!sluitendRef.current) return;
    const intern = interneSluiting.current;
    sluitendRef.current = false;
    interneSluiting.current = false;
    gestart.current = false;
    setGemount(false);
    if (intern) onSluitenRef.current();
  }, []);

  const startOpenen = useCallback(() => {
    if (gestart.current || sluitendRef.current) return;
    gestart.current = true;
    sluitendUI.value = false;
    voortgang.value = modusRef.current === MODUS_FADE
      ? vervaag(1, duur.midden)
      : withSpring(1, veer.zacht);
  }, [sluitendUI, voortgang]);

  const startSluiten = useCallback((naarBron: boolean) => {
    sluitendRef.current = true;
    sluitendUI.value = true;
    const klaar = (af?: boolean) => {
      'worklet';
      if (af) scheduleOnRN(rondAf);
    };
    // Niet terug de kaart in, maar het scherm staat nog (vrijwel) helemaal open: dan stapt het
    // naadloos over op een fade, want bij volle voortgang zien alle modi er hetzelfde uit.
    // Halverwege het uitgroeien zou die wissel een sprong geven, dan toch terug de kaart in.
    if (modusRef.current === MODUS_BRON && !naarBron && voortgang.value > 0.98) {
      modusRef.current = MODUS_FADE;
      modus.value = MODUS_FADE;
    }
    voortgang.value = modusRef.current === MODUS_FADE
      ? vervaag(0, duur.midden, klaar)
      : withSpring(0, SLUIT_VEER, klaar);
  }, [modus, rondAf, sluitendUI, voortgang]);

  // Eigen sluiting: X, terugknop, of een knop in het scherm die ergens anders heen gaat.
  const sluit = useCallback<Sluit>((opties) => {
    if (sluitendRef.current) return;
    interneSluiting.current = true;
    startSluiten(opties?.naarBron !== false);
  }, [startSluiten]);

  // Swipe-terug is voorbij het punt van terugkeer: vanaf nu is het een eigen sluiting, ook als de
  // ouder intussen iets anders doet of de terugknop nog wordt ingedrukt.
  const markeerSwipeSluiting = useCallback(() => {
    sluitendRef.current = true;
    interneSluiting.current = true;
  }, []);

  useEffect(() => {
    if (zichtbaar) {
      if (!gemount) {
        // Eerst alles klaarzetten op "dicht", dan pas de Modal tonen: het eerste frame moet er
        // precies uitzien als de kaart (of leeg zijn), niet als een half open scherm.
        const rect = neemBron();
        const m = reduceMotion ? MODUS_FADE : rect ? MODUS_BRON : MODUS_SCHUIF;
        modusRef.current = m;
        modus.value = m;
        bron.value = rect;
        voortgang.value = 0;
        sleep.value = 0;
        sluitendUI.value = false;
        sluitendRef.current = false;
        interneSluiting.current = false;
        gestart.current = false;
        setPlaatsKleur(rect?.kleur ?? colors.achtergrond);
        setGemount(true);
        return;
      }
      if (sluitendRef.current) {
        // Heropend terwijl hij wegging: vanaf de huidige stand terug naar open, zonder opnieuw te
        // mounten. De lopende sluitanimatie wordt overschreven en meldt zich dan niet meer.
        sluitendRef.current = false;
        interneSluiting.current = false;
        gestart.current = false;
        sleep.value = modusRef.current === MODUS_FADE ? vervaag(0, duur.kort) : withSpring(0, veer.standaard);
        startOpenen();
      }
      return;
    }
    if (gemount && !sluitendRef.current) startSluiten(true);
    // Bewust alleen op zichtbaar: de rest wordt op het moment van openen of sluiten gelezen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zichtbaar]);

  // Terugval voor als onShow uitblijft, zie START_TERUGVAL_MS.
  useEffect(() => {
    if (!gemount) return;
    const t = setTimeout(startOpenen, START_TERUGVAL_MS);
    return () => clearTimeout(t);
  }, [gemount, startOpenen]);

  const swipe = useMemo(() => Gesture.Pan()
    // Alleen vanaf de linkerrand, en pas bij een duidelijke beweging naar rechts. Wie verticaal
    // begint, scrollt: dan faalt dit gebaar en krijgt de ScrollView de vinger.
    .hitSlop({ left: 0, width: RAND_BREEDTE })
    .activeOffsetX(10)
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      if (sluitendUI.value) return;
      sleep.value = Math.max(0, e.translationX);
    })
    .onEnd((e) => {
      if (sluitendUI.value) return;
      const breedte = maatB.value;
      const ver = sleep.value > breedte * DREMPEL_AFSTAND;
      const snel = e.velocityX > DREMPEL_SNELHEID;
      if ((ver || snel) && e.velocityX > TERUG_SNELHEID) {
        sluitendUI.value = true;
        haptiekVanUI('tik');
        scheduleOnRN(markeerSwipeSluiting);
        const klaar = (af?: boolean) => {
          'worklet';
          if (af) scheduleOnRN(rondAf);
        };
        if (modus.value === MODUS_FADE) {
          // Minder beweging: de vinger mag het scherm verschuiven (dat is directe bediening, geen
          // animatie), maar weg gaat het met een fade.
          voortgang.value = vervaag(0, duur.midden, klaar);
        } else {
          // De vaart van de vinger loopt door tot het scherm uit beeld is. Clampen, anders wacht
          // de veer nog op een uitdoving die buiten beeld toch niemand ziet.
          sleep.value = withSpring(
            breedte,
            { ...veer.zacht, velocity: e.velocityX, overshootClamping: true },
            klaar,
          );
        }
        return;
      }
      sleep.value = modus.value === MODUS_FADE
        ? vervaag(0, duur.kort)
        : withSpring(0, { ...veer.standaard, velocity: e.velocityX });
    }), [markeerSwipeSluiting, maatB, modus, rondAf, sleep, sluitendUI, voortgang]);

  // Zie DICHT_BIJ. Alleen voor terug-de-kaart-in: bij schuiven en vervagen is het laatste stukje
  // gewoon nog zichtbaar. rondAf vangt zelf af dat de veer daarna nog een keer klaar meldt.
  useAnimatedReaction(
    () => sluitendUI.value && modus.value === MODUS_BRON && voortgang.value < DICHT_BIJ,
    (dicht, vorige) => {
      if (dicht && !vorige) scheduleOnRN(rondAf);
    },
  );

  const dimStijl = useAnimatedStyle(() => {
    const swipeDeel = Math.min(Math.max(sleep.value / maatB.value, 0), 1);
    const p = Math.min(Math.max(voortgang.value, 0), 1);
    return { opacity: DIM_MAX * p * (1 - swipeDeel) };
  });

  const schermStijl = useAnimatedStyle(() => {
    const swipeDeel = Math.min(Math.max(sleep.value / maatB.value, 0), 1);
    const p = Math.min(Math.max(voortgang.value, 0), 1);
    const schuif = modus.value === MODUS_SCHUIF ? (1 - p) * maatB.value : 0;
    return {
      opacity: modus.value === MODUS_FADE ? p : 1,
      transform: [
        { translateX: sleep.value + schuif },
        { scale: 1 - (1 - SWIPE_SCHAAL) * swipeDeel },
      ],
    };
  });

  // Het uitsnijvlak. In de kaart-modus loopt het van de rechthoek van de kaart naar het hele
  // scherm. Via left/top/right/bottom en niet via breedte en hoogte: bij volle voortgang staan
  // die dan precies op 0, ongeacht of onze schatting van de schermmaat klopte.
  const clipStijl = useAnimatedStyle(() => {
    const swipeDeel = Math.min(Math.max(sleep.value / maatB.value, 0), 1);
    // Tijdens het vegen krijgt het scherm snel ronde hoeken, zoals een kaart die je vastpakt.
    const swipeRadius = Math.min(swipeDeel * 4, 1) * radii.kaart;
    const r = bron.value;
    if (modus.value !== MODUS_BRON || !r) {
      return { left: 0, top: 0, right: 0, bottom: 0, borderRadius: swipeRadius };
    }
    const rest = 1 - Math.min(Math.max(voortgang.value, 0), 1);
    return {
      opacity: interpolate(voortgang.value, [0, KAART_OVERNAME_VANAF], [0, 1], Extrapolation.CLAMP),
      left: r.x * rest,
      top: r.y * rest,
      right: Math.max(maatB.value - r.x - r.breedte, 0) * rest,
      bottom: Math.max(maatH.value - r.y - r.hoogte, 0) * rest,
      borderRadius: Math.max(r.radius * rest, swipeRadius),
    };
  });

  // De inhoud heeft altijd de volle schermmaat en hangt aan de linkerbovenhoek van het
  // uitsnijvlak. Zo hoeft er tijdens de overgang niets opnieuw opgemaakt te worden: alleen het
  // venster erop wordt groter.
  const inhoudStijl = useAnimatedStyle(() => ({
    width: maatB.value,
    height: maatH.value,
    opacity: modus.value === MODUS_BRON
      ? interpolate(voortgang.value, [0, INHOUD_FADE_TOT], [0, 1], Extrapolation.CLAMP)
      : 1,
  }));

  function bijLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      maatB.value = width;
      maatH.value = height;
    }
  }

  // Gaat het scherm van buitenaf dicht, dan laten we tijdens het wegbewegen de laatste inhoud
  // staan. De ouder heeft zijn gegevens dan vaak al leeggemaakt, en een scherm dat tijdens het
  // sluiten leegloopt ziet eruit als een fout.
  const laatsteInhoud = useRef<React.ReactNode>(null);
  if (zichtbaar) {
    laatsteInhoud.current = typeof children === 'function' ? children(sluit) : children;
  }

  if (!gemount) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => sluit()}
      onShow={startOpenen}
    >
      {/* Binnen een Modal ziet de GestureHandlerRootView om de app niets: een Modal is een eigen
          venster, dus hier een eigen root voor de swipe-terug. */}
      <GestureHandlerRootView style={styles.vul} onLayout={bijLayout}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimStijl]} />
        <GestureDetector gesture={swipe}>
          <Animated.View style={[StyleSheet.absoluteFill, schermStijl]}>
            <Animated.View style={[styles.clip, clipStijl]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: plaatsKleur }]} />
              <Animated.View
                style={[
                  styles.inhoud,
                  {
                    backgroundColor: colors.achtergrond,
                    paddingTop: insets.top,
                    paddingBottom: insets.bottom,
                    paddingLeft: insets.left,
                    paddingRight: insets.right,
                  },
                  inhoudStijl,
                ]}
              >
                {laatsteInhoud.current}
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  vul: { flex: 1 },
  dim: { backgroundColor: '#000' },
  clip: { position: 'absolute', overflow: 'hidden' },
  inhoud: { position: 'absolute', left: 0, top: 0 },
});
