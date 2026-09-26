import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard, LayoutChangeEvent, Modal, Pressable, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { radii, shadow, spacing } from '../theme/tokens';
import { useToetsenbordHoogte } from '../theme/useToetsenbordHoogte';
import { useBeweging } from '../theme/useReduceMotion';
import { curve, duur, veer, vervaag } from '../theme/beweging';

// Het vel is zelf de geanimeerde component, niet een wrapper eromheen. Vijf sheets zetten een
// maxHeight in procenten op hun velStijl, en een percentage rekent tegen de hoogte van de ouder:
// met een tussenliggende wrapper zonder eigen hoogte valt die maxHeight weg en groeit een lange
// sheet voorbij het scherm. Om dezelfde reden hangt de GestureDetector direct om het vel en niet
// om een extra View.

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  children: React.ReactNode;
  velStijl?: StyleProp<ViewStyle>;
}

// Alleen vanuit de bovenrand van het vel is het dicht te slepen: het greepje plus ruwweg de
// titelrij die elke sheet bovenaan heeft. Bewust niet het hele vel. Een lijst in een sheet (de
// changelog, de meldingen) moet gewoon scrollen, en of een veeg naar beneden "scroll terug" of
// "sluit" betekent hangt af van de scrollstand van een ScrollView die we hier niet kennen. Op
// Android kwam een snelle veeg in de lijst dan soms bij het vel uit in plaats van bij de lijst.
// Binnen deze zone winnen we wel altijd: we activeren na 6dp, vóór de 8dp waarop een ScrollView
// de aanraking zelf opeist.
const SLEEPZONE = spacing.base + 48;
const ACTIVEER_NA = 6;

// Dicht bij meer dan 30 procent van de hoogte omlaag, of bij een flinke veeg (pt/s), ook al is hij
// kort. Een veeg omhoog aan het eind houdt de sheet open, ook voorbij de 30 procent.
const DICHT_DEEL = 0.3;
const DICHT_SNELHEID = 800;

// Sluiten gaat sneller dan openen, zoals bij Apple: het oog hoeft een vertrekkend vel niet te
// volgen. Ook een harde grens, want DialoogProvider opent een dialoog 260ms nadat de sheet is
// gaan sluiten, en die Modal mag niet in dezelfde tick verschijnen als deze Modal verdwijnt (zie
// de uitleg daar). Met 180ms animatie plus een render is deze Modal op tijd weg.
const SLUIT_MS = 180;
const SLUIT_MIN_MS = 110;

// Uitloop voor een veeg: begint op dezelfde snelheid als de vinger (de helling van deze curve op
// t = 0 is 2) en remt dan af, zodat het vel niet eerst inhoudt en dan pas vertrekt.
const UITLOOP = Easing.out(Easing.quad);

// Weerstand bij omhoog trekken, de rubberband van iOS: hoe verder je trekt, hoe minder het vel
// nog meekomt, en nooit meer dan een fractie van zijn hoogte.
function rubberband(afstand: number, maat: number): number {
  'worklet';
  if (maat <= 0) return 0;
  return (1 - 1 / ((afstand * 0.55) / maat + 1)) * maat;
}

// Gedeelde bottom-sheet-wrapper: Modal + halftransparante achtergrond + het witte vel. Tikken op de
// achtergrond sluit de sheet (standaard bottom-sheet-gedrag), tikken op het vel zelf niet. Houdt ook
// meteen rekening met het toetsenbord en de veilige zone onderaan (Android-gesturebalk), zodat de
// onderste knop nooit meer verstopt zit.
//
// Beweging: het vel komt met een veer van onder het scherm omhoog, de achtergrond dimt mee met hoe
// ver het vel in beeld is, en het vel is aan de bovenrand dicht te slepen. De ouder blijft de baas
// over open en dicht (zichtbaar), dus zakt zichtbaar naar false, dan blijft de Modal nog even staan
// tot het vel weg is. Sluit de gebruiker zelf (achtergrond, terugknop, slepen), dan roepen we
// onSluiten meteen aan en loopt dezelfde uitgang: er is maar één manier van verdwijnen, dus nooit
// een dubbele animatie.
//
// Minder beweging: geen glijden en geen veer, alleen een korte fade. Slepen blijft werken, want
// dat doet de gebruiker zelf.
export function BottomSheet({ zichtbaar, onSluiten, children, velStijl }: Props) {
  const { colors } = useTheme();
  const toetsenbordHoogte = useToetsenbordHoogte();
  const insets = useSafeAreaInsets();
  const { reduceMotion, naar } = useBeweging();
  const { height: schermHoogte } = useWindowDimensions();

  // De Modal zelf staat los van zichtbaar, zodat hij tijdens het wegschuiven nog getekend wordt.
  const [modalOpen, setModalOpen] = useState(false);

  // y: hoe ver het vel omlaag geschoven is (0 = open). zicht: fade van vel en achtergrond, alleen
  // onder Minder beweging anders dan 1. hoogte: gemeten hoogte van het vel.
  const y = useSharedValue(schermHoogte);
  const zicht = useSharedValue(0);
  const hoogte = useSharedValue(0);
  const sleepStart = useSharedValue(0);
  const aanrakingY = useSharedValue(0);
  const aanrakingX = useSharedValue(0);
  // Op de UI-thread, zodat een sleepgebaar een lopende uitgang niet kan afbreken: dan zou de
  // afronding nooit komen en bleef een onzichtbare Modal het scherm blokkeren.
  const sluitendUI = useSharedValue(false);

  // Refs voor wat de callbacks hieronder nodig hebben, zodat die stabiel blijven en een gebaar of
  // animatie die over een render heen loopt nooit een verouderde versie aanroept.
  const zichtbaarRef = useRef(zichtbaar);
  zichtbaarRef.current = zichtbaar;
  const onSluitenRef = useRef(onSluiten);
  onSluitenRef.current = onSluiten;
  const reduceRef = useRef(reduceMotion);
  reduceRef.current = reduceMotion;
  const sluitendRef = useRef(false);
  const wachtOpMaat = useRef(false);

  // Tijdens het wegschuiven houden we de laatste inhoud vast. Veel sheets halen hun inhoud uit iets
  // dat bij het sluiten meteen null wordt (TradeActiesSheet toont `trade`), en dan zou het vel
  // halverwege de uitgang leeglopen en inzakken.
  const laatsteKinderen = useRef(children);
  if (zichtbaar) laatsteKinderen.current = children;

  const startOpen = useCallback(() => {
    sluitendRef.current = false;
    sluitendUI.value = false;
    if (reduceRef.current) {
      y.value = 0;
      zicht.value = vervaag(1, duur.midden);
      return;
    }
    zicht.value = 1;
    y.value = withSpring(0, veer.standaard);
  }, [y, zicht, sluitendUI]);

  const naSluiten = useCallback(() => {
    const afronden = () => {
      // De ouder hield de sheet open (onSluiten zette zichtbaar niet op false): terug omhoog.
      if (zichtbaarRef.current) {
        startOpen();
        return;
      }
      sluitendRef.current = false;
      setModalOpen(false);
    };
    // Staat zichtbaar nog op true, dan kan het ook zijn dat de render na onSluiten er nog niet
    // was, omdat de JS-thread druk was terwijl het vel wegschoof. Eén tik later weten we het zeker,
    // en anders zou het vel voor niets eerst weer omhoog komen.
    if (zichtbaarRef.current) setTimeout(afronden, 0);
    else afronden();
  }, [startOpen]);

  // Draait op de UI-thread (vanuit het sleepgebaar) en op de JS-thread (achtergrond, terugknop,
  // zichtbaar naar false). snelheid is de loslaatsnelheid in pt/s, 0 als er niet gesleept is.
  const animeerWeg = useCallback((snelheid: number) => {
    'worklet';
    sluitendUI.value = true;
    const klaar = (afgerond?: boolean) => {
      'worklet';
      if (afgerond) scheduleOnRN(naSluiten);
    };
    if (reduceMotion) {
      zicht.value = vervaag(0, duur.kort, klaar);
      return;
    }
    const doel = hoogte.value > 0 ? hoogte.value : schermHoogte;
    const rest = Math.max(0, doel - y.value);
    const veeg = snelheid > 200;
    const duurMs = veeg
      ? Math.min(SLUIT_MS, Math.max(SLUIT_MIN_MS, ((2 * rest) / snelheid) * 1000))
      : SLUIT_MS;
    y.value = withTiming(
      doel,
      { duration: duurMs, easing: veeg ? UITLOOP : curve.weg, reduceMotion: ReduceMotion.Never },
      klaar,
    );
  }, [reduceMotion, schermHoogte, naSluiten, y, zicht, hoogte, sluitendUI]);

  // Achtergrond, terugknop en loslaten na slepen komen hier samen.
  const sluitDoorGebruiker = useCallback((alBezig: boolean) => {
    if (sluitendRef.current) return;
    sluitendRef.current = true;
    Keyboard.dismiss();
    if (!alBezig) animeerWeg(0);
    onSluitenRef.current();
  }, [animeerWeg]);

  useEffect(() => {
    if (zichtbaar) {
      if (!modalOpen) {
        // Het vel begint onder het scherm. Omhoog gaat pas als zijn hoogte gemeten is (opLayout),
        // anders weten we niet vanaf waar hij moet komen.
        cancelAnimation(y);
        cancelAnimation(zicht);
        y.value = schermHoogte;
        zicht.value = 0;
        wachtOpMaat.current = true;
        setModalOpen(true);
        return;
      }
      // Weer open terwijl hij nog aan het wegschuiven was: vanaf waar hij nu is terug omhoog.
      if (sluitendRef.current) startOpen();
      return;
    }
    if (!modalOpen || sluitendRef.current) return;
    sluitendRef.current = true;
    // Vroeger verdween de inhoud met de Modal meteen, en daarmee het toetsenbord. Nu blijft de
    // inhoud nog even staan tijdens het wegschuiven, dus halen we het toetsenbord zelf weg.
    Keyboard.dismiss();
    animeerWeg(0);
    // Bewust alleen zichtbaar en modalOpen: animeerWeg verandert mee met reduceMotion, en een
    // nieuwe versie ervan is geen reden om opnieuw te openen of te sluiten.
  }, [zichtbaar, modalOpen]);

  function opLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    hoogte.value = h;
    if (!wachtOpMaat.current) return;
    wachtOpMaat.current = false;
    // Al weer dicht voordat hij gemeten was: dan loopt de uitgang al en hoort hij niet op te komen.
    if (!zichtbaarRef.current) return;
    if (!reduceRef.current) y.value = h;
    startOpen();
  }

  const sleep = useMemo(() => Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e, beheer) => {
      if (e.numberOfTouches !== 1) return;
      const aanraking = e.allTouches[0];
      if (sluitendUI.value || !aanraking || aanraking.y > SLEEPZONE) {
        beheer.fail();
        return;
      }
      aanrakingY.value = aanraking.absoluteY;
      aanrakingX.value = aanraking.absoluteX;
    })
    .onTouchesMove((e, beheer) => {
      const aanraking = e.allTouches[0];
      if (!aanraking) return;
      const dy = aanraking.absoluteY - aanrakingY.value;
      const dx = aanraking.absoluteX - aanrakingX.value;
      if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy)) {
        beheer.fail();
        return;
      }
      if (Math.abs(dy) > ACTIVEER_NA) beheer.activate();
    })
    .onStart(() => {
      // Een vel dat nog omhoog veert kun je gewoon vastpakken.
      cancelAnimation(y);
      sleepStart.value = y.value;
    })
    .onUpdate(e => {
      const nieuw = sleepStart.value + e.translationY;
      y.value = nieuw >= 0 ? nieuw : -rubberband(-nieuw, hoogte.value);
    })
    .onEnd(e => {
      const maat = hoogte.value > 0 ? hoogte.value : schermHoogte;
      const dicht = (y.value > maat * DICHT_DEEL && e.velocityY > -300) || e.velocityY > DICHT_SNELHEID;
      if (dicht) {
        animeerWeg(e.velocityY);
        scheduleOnRN(sluitDoorGebruiker, true);
        return;
      }
      y.value = naar(0, 'standaard', { snelheid: e.velocityY });
    }), [animeerWeg, naar, sluitDoorGebruiker, schermHoogte, y, hoogte, sleepStart, aanrakingX, aanrakingY, sluitendUI]);

  const achtergrondStijl = useAnimatedStyle(() => {
    const h = hoogte.value;
    const inBeeld = h > 0 ? Math.min(1, Math.max(0, 1 - y.value / h)) : 0;
    return { opacity: zicht.value * inBeeld };
  });

  const velBeweging = useAnimatedStyle(() => ({
    opacity: zicht.value,
    transform: [{ translateY: y.value }],
  }));

  const sluitend = modalOpen && !zichtbaar;

  return (
    <Modal visible={modalOpen} animationType="none" transparent onRequestClose={() => sluitDoorGebruiker(false)}>
      {/* Een Modal is een eigen native venster, buiten de GestureHandlerRootView van App.tsx. Zonder
          deze eigen root hoort het sleepgebaar hierbinnen niets. */}
      <GestureHandlerRootView style={styles.overlay} pointerEvents={sluitend ? 'none' : 'auto'}>
        {/* De achtergrond is een BROER van het vel en geen ouder ervan. Dat is geen stijlkeuze maar
            de reden dat een lijst in een sheet überhaupt scrollt: als het vel binnen een Pressable
            zat, greep die de aanraking op Android en kwam een veeg nooit bij de ScrollView aan. De
            changeloglijst stond daardoor stil, ook nadat hij netjes binnen het venster paste.

            Een broer werkt omdat een aanraking niet naar een broer doorvalt: het bovenste vlak op
            dat punt vangt hem. Op het vel is dat het vel zelf (het heeft een achtergrondkleur),
            ernaast deze laag, en die sluit. Precies het gedrag van hiervoor, zonder de greep. */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.dimlaag, achtergrondStijl]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => sluitDoorGebruiker(false)}
            accessibilityLabel="Sluiten"
            accessibilityRole="button"
          />
        </Animated.View>
        <GestureDetector gesture={sleep}>
          <Animated.View
            onLayout={opLayout}
            style={[
              styles.vel,
              shadow.modal,
              {
                backgroundColor: colors.kaart,
                // Bij een open toetsenbord een extra marge boven op de gemelde hoogte. Android meldt
                // de hoogte van het toetsenbord zelf, zonder de werkbalk met suggesties erboven, en
                // precies die strook viel over de onderste knop heen: die was dan niet aan te tikken
                // zonder eerst het toetsenbord weg te halen. Gemeten op een Pixel 8 met Gboard.
                paddingBottom: Math.max(
                  spacing.xl,
                  toetsenbordHoogte > 0 ? toetsenbordHoogte + spacing.xl : 0,
                  insets.bottom,
                ),
              },
              velBeweging,
              velStijl,
            ]}
          >
            {sluitend ? laatsteKinderen.current : children}
            {/* Het greepje: zegt zonder woorden dat het vel te slepen is. Absoluut, zodat geen
                enkele sheet er een pixel layout door verschuift. */}
            <View style={styles.greepVak} pointerEvents="none">
              <View style={[styles.greep, { backgroundColor: colors.rand }]} />
            </View>
            {/* Een strook in de kleur van het vel eronder. Veert het vel bij openen een fractie
                door, of trek je het omhoog, dan kijk je hierop en niet door een kier naar de
                achtergrond. */}
            <View
              style={[styles.onderrok, { backgroundColor: colors.kaart }]}
              pointerEvents="none"
            />
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dimlaag: {
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  vel: {
    borderTopLeftRadius: radii.kaart,
    borderTopRightRadius: radii.kaart,
    padding: spacing.base,
  },
  greepVak: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greep: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
  },
  onderrok: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    height: 120,
  },
});
