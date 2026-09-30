import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent, type AccessibilityActionEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts } from '../../theme/typography';
import { radii } from '../../theme/tokens';
import { useBeweging } from '../../theme/useReduceMotion';
import { haptiekVanUI } from '../../theme/haptiek';
import { klem, opStap, type Bereik } from '../../engine/planInGeld';

interface Props {
  // Het zichtbare prijsbereik van de baan; de ouder rekent het uit.
  min: number;
  max: number;
  // Streepjes op de baan: ENTRY (gedimd) en NU (blauw).
  entry: number;
  live?: number;
  // null = greep weg, bijvoorbeeld als de stop is weggehaald.
  stop: number | null;
  doel: number | null;
  // Hoe ver je mag slepen (zie greepBereik). null = de greep staat stil en wordt gedimd getoond.
  stopBereik: Bereik | null;
  doelBereik: Bereik | null;
  // Stapgrootte: slepen rast op een halve stap, TalkBack schuift een hele stap.
  stap: number;
  // Op de JS-thread, elke keer dat de geraste waarde verandert en nog een keer bij loslaten.
  onStop: (w: number) => void;
  onDoel: (w: number) => void;
  formatPrijs: (n: number) => string;
  // Alleen voor de kleur van de vlakken: verlies ligt tussen stop en entry, winst tussen entry en doel.
  richting: 'long' | 'short';
}

const HOOGTE = 72;
const BAAN_HOOGTE = 6;
const BAAN_TOP = 30;
const GREEP = 24;
const GREEP_TOP = BAAN_TOP + BAAN_HOOGTE / 2 - GREEP / 2;
// 24 + 2 x 10 = 44dp aanraakvlak, de ondergrens voor iets dat je met een duim pakt.
const GREEP_MARGE = 10;
// Ruimte links en rechts, zodat een greep op de uiterste rand van de baan niet half buiten beeld
// valt en zijn aanraakvlak nog binnen het component ligt (Android levert aanrakingen buiten de
// ouder niet af).
const RAND = 12;
const MARK_TOP = 24;
const MARK_HOOGTE = 18;
const MARK_LABEL_BREEDTE = 56;
// Staan entry en koers dichter bij elkaar dan dit, dan zouden ENTRY en NU over elkaar vallen. Het
// NU-streepje blijft dan staan, alleen het woord valt weg.
const MARK_LABEL_AFSTAND = 44;
const GEDIMD = 0.45;
// Dekking van het verlies- en winstvlak: de lijn zelf mag kleur hebben, maar gedempt.
// Basisbreedte van een zonevlak. Niet 1: een vlak van 1 dp wordt op hele pixels afgerond (bij
// 420 dpi 2 px in plaats van 2,625), en dan schaalt elk vlak een kwart te kort.
const ZONE_BASIS = 100;
const ZONE_DEKKING = 0.55;

// Worklet-kopie van opStap uit planInGeld: die functie draait op de JS-thread en mag niet in een
// gesture-callback. Houd de twee gelijk.
function opStapW(waarde: number, stap: number): number {
  'worklet';
  if (!(stap > 0) || !isFinite(stap)) return waarde;
  const decimalen = Math.max(0, -Math.floor(Math.log10(stap)) + 1);
  return Number((Math.round(waarde / stap) * stap).toFixed(decimalen));
}

// Waar een prijs op de baan staat, in dp vanaf de linkerkant. Buiten het bereik plakt hij aan de rand.
function xVan(prijs: number, min: number, max: number, breedte: number): number {
  'worklet';
  const span = max - min;
  if (!(span > 0) || !(breedte > 0)) return 0;
  return Math.min(1, Math.max(0, (prijs - min) / span)) * breedte;
}

// Het deel van het greepbereik dat ook op de baan valt. null als er niets te slepen is.
function effectiefBereik(bereik: Bereik | null, min: number, max: number): Bereik | null {
  if (!bereik) return null;
  const lo = Math.max(bereik.min, min);
  const hi = Math.min(bereik.max, max);
  return lo <= hi ? { min: lo, max: hi } : null;
}

// Een baan met twee grepen voor de stop en het doel van een open positie. Alles wat tijdens het
// slepen beweegt (grepen, labels, vlakken) leest alleen shared values, nooit React-state: onder
// Minder beweging past Reanimated een stijl die op gewone state leunt niet altijd opnieuw toe.
export function NiveauBaan({
  min, max, entry, live, stop, doel, stopBereik, doelBereik, stap, onStop, onDoel, formatPrijs, richting,
}: Props) {
  const { colors } = useTheme();
  const [breedte, setBreedte] = useState(0);

  const breedteW = useSharedValue(0);
  const minW = useSharedValue(min);
  const maxW = useSharedValue(max);
  const entryW = useSharedValue(entry);
  const tekenW = useSharedValue(richting === 'short' ? -1 : 1);
  const stapW = useSharedValue(stap);
  // NaN = geen greep; de vlakken verdwijnen dan vanzelf.
  const stopW = useSharedValue(stop ?? NaN);
  const doelW = useSharedValue(doel ?? NaN);

  useEffect(() => {
    minW.value = min;
    maxW.value = max;
    entryW.value = entry;
    tekenW.value = richting === 'short' ? -1 : 1;
    stapW.value = stap;
  }, [min, max, entry, richting, stap, minW, maxW, entryW, tekenW, stapW]);

  function opLayout(e: LayoutChangeEvent) {
    const b = e.nativeEvent.layout.width;
    breedteW.value = b;
    setBreedte(b);
  }

  const stopEff = effectiefBereik(stopBereik, min, max);
  const doelEff = effectiefBereik(doelBereik, min, max);

  // Verlies: tussen stop en entry, maar alleen als de stop aan de verlieskant ligt. Staat de stop
  // al voorbij de entry, dan staat er winst vast en is er geen verliesvlak.
  const verliesStijl = useAnimatedStyle(() => {
    const b = breedteW.value;
    const s = stopW.value;
    const e = entryW.value;
    if (!(b > 0) || !isFinite(s) || (e - s) * tekenW.value <= 0) return { opacity: 0, transform: [{ translateX: 0 }, { scaleX: 0 }] };
    const xs = xVan(s, minW.value, maxW.value, b);
    const xe = xVan(e, minW.value, maxW.value, b);
    return { opacity: ZONE_DEKKING, transform: [{ translateX: Math.min(xs, xe) }, { scaleX: Math.abs(xe - xs) / ZONE_BASIS }] };
  });

  const winstStijl = useAnimatedStyle(() => {
    const b = breedteW.value;
    const d = doelW.value;
    const e = entryW.value;
    if (!(b > 0) || !isFinite(d) || (d - e) * tekenW.value <= 0) return { opacity: 0, transform: [{ translateX: 0 }, { scaleX: 0 }] };
    const xd = xVan(d, minW.value, maxW.value, b);
    const xe = xVan(e, minW.value, maxW.value, b);
    return { opacity: ZONE_DEKKING, transform: [{ translateX: Math.min(xd, xe) }, { scaleX: Math.abs(xd - xe) / ZONE_BASIS }] };
  });

  // De streepjes bewegen niet tijdens het slepen, dus die mogen gewoon uit de props komen.
  const xEntry = xVan(entry, min, max, breedte);
  const heeftLive = typeof live === 'number' && isFinite(live) && live > 0;
  const xLive = heeftLive ? xVan(live, min, max, breedte) : 0;
  const markLabelLinks = (x: number) =>
    Math.min(Math.max(x - MARK_LABEL_BREEDTE / 2, -RAND), breedte + RAND - MARK_LABEL_BREEDTE);

  const gedeeld = { breedteW, minW, maxW, stapW, formatPrijs };

  return (
    <View style={styles.container}>
      <View style={styles.spoor} onLayout={opLayout}>
        {/* De baan knipt de vlakken af, zo krijgen ze aan de buitenkant vanzelf de ronde hoek zonder
            dat een geschaald vlak zijn eigen rondingen platdrukt. */}
        <View pointerEvents="none" style={[styles.baan, { backgroundColor: colors.rand }]}>
          <Animated.View style={[styles.zone, { backgroundColor: colors.verlies }, verliesStijl]} />
          <Animated.View style={[styles.zone, { backgroundColor: colors.winst }, winstStijl]} />
        </View>

        {breedte > 0 && (
          <>
            <View pointerEvents="none" style={[styles.mark, { left: xEntry - 1, backgroundColor: colors.tekstGedimd }]} />
            <View pointerEvents="none" style={[styles.markLabel, { left: markLabelLinks(xEntry) }]}>
              <Text style={[styles.markTekst, { color: colors.tekstGedimd }]} numberOfLines={1}>ENTRY</Text>
            </View>
            {heeftLive && (
              <>
                <View pointerEvents="none" style={[styles.mark, { left: xLive - 1, backgroundColor: colors.cta }]} />
                {Math.abs(xLive - xEntry) >= MARK_LABEL_AFSTAND && (
                  <View pointerEvents="none" style={[styles.markLabel, { left: markLabelLinks(xLive) }]}>
                    <Text style={[styles.markTekst, { color: colors.cta }]} numberOfLines={1}>NU</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {stop !== null && (
          <Greep
            {...gedeeld}
            waarde={stop}
            waardeW={stopW}
            bereik={stopEff}
            stap={stap}
            kleur={colors.verlies}
            vulling={colors.kaart}
            label="Stop-loss"
            onWaarde={onStop}
          />
        )}
        {doel !== null && (
          <Greep
            {...gedeeld}
            waarde={doel}
            waardeW={doelW}
            bereik={doelEff}
            stap={stap}
            kleur={colors.winst}
            vulling={colors.kaart}
            label="Doel"
            onWaarde={onDoel}
          />
        )}
      </View>
    </View>
  );
}

interface GreepProps {
  waarde: number;
  waardeW: SharedValue<number>;
  // Al doorsneden met het bereik van de baan. null = niet te slepen.
  bereik: Bereik | null;
  stap: number;
  kleur: string;
  vulling: string;
  label: string;
  onWaarde: (w: number) => void;
  formatPrijs: (n: number) => string;
  breedteW: SharedValue<number>;
  minW: SharedValue<number>;
  maxW: SharedValue<number>;
  stapW: SharedValue<number>;
}

function Greep({
  waarde, waardeW, bereik, stap, kleur, vulling, label, onWaarde, formatPrijs, breedteW, minW, maxW, stapW,
}: GreepProps) {
  const { naar } = useBeweging();
  const sleepbaar = bereik !== null;

  const loW = useSharedValue(bereik?.min ?? 0);
  const hiW = useSharedValue(bereik?.max ?? 0);
  useEffect(() => {
    loW.value = bereik?.min ?? 0;
    hiW.value = bereik?.max ?? 0;
  }, [bereik?.min, bereik?.max, loW, hiW]);

  const schaal = useSharedValue(1);
  const actief = useSharedValue(0);
  const startW = useSharedValue(0);
  const labelBreedte = useSharedValue(0);
  // Gedimd als er niets te slepen is. Als shared value, want de labelstijl rekent de dekking al.
  const dimW = useSharedValue(sleepbaar ? 1 : GEDIMD);
  useEffect(() => {
    dimW.value = sleepbaar ? 1 : GEDIMD;
  }, [sleepbaar, dimW]);

  // Of er gesleept wordt, bijgehouden op de JS-thread. Tijdens het slepen is de greep de bron van
  // de waarde en niet de prop, anders trekt een trage re-render van de ouder hem terug.
  const sleeptRef = useRef(false);
  // Na het loslaten één keer opnieuw gelijktrekken met de prop, voor als de ouder de laatste
  // waarde niet (of anders) heeft overgenomen.
  const [losgelaten, setLosgelaten] = useState(0);
  useEffect(() => {
    if (!sleeptRef.current) waardeW.value = waarde;
  }, [waarde, losgelaten, waardeW]);

  // De callback van de ouder verandert bij elke render; via een ref blijven de functies die de
  // worklets aanroepen stabiel, zodat het gebaar niet midden in een sleep opnieuw gebouwd wordt.
  const onWaardeRef = useRef(onWaarde);
  useEffect(() => {
    onWaardeRef.current = onWaarde;
  }, [onWaarde]);

  const begin = useCallback(() => {
    sleeptRef.current = true;
  }, []);
  const meld = useCallback((w: number) => {
    onWaardeRef.current(w);
  }, []);
  const einde = useCallback((w: number) => {
    sleeptRef.current = false;
    onWaardeRef.current(w);
    setLosgelaten(n => n + 1);
  }, []);

  const pan = useMemo(() => Gesture.Pan()
    .enabled(sleepbaar)
    // Zijwaarts na 6dp actief; eerst 12dp verticaal en het gebaar geeft op, zodat het vel nog
    // gewoon omlaag te slepen of te scrollen is (zelfde drempels als het scrubben in PrijsGrafiek).
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .hitSlop({ horizontal: GREEP_MARGE, vertical: GREEP_MARGE })
    .shouldCancelWhenOutside(false)
    .onStart(() => {
      'worklet';
      actief.value = 1;
      startW.value = waardeW.value;
      schaal.value = naar(1.15, 'snel');
      scheduleOnRN(begin);
    })
    .onUpdate(e => {
      'worklet';
      const b = breedteW.value;
      const span = maxW.value - minW.value;
      if (!(b > 0) || !(span > 0)) return;
      const ruw = startW.value + (e.translationX / b) * span;
      // Eerst rasteren en dan klemmen: andersom kan de afronding net buiten eToro's grens vallen.
      const w = Math.min(hiW.value, Math.max(loW.value, opStapW(ruw, stapW.value / 2)));
      if (w === waardeW.value) return;
      waardeW.value = w;
      haptiekVanUI('tik');
      scheduleOnRN(meld, w);
    })
    .onFinalize(() => {
      'worklet';
      // Finalize komt ook als het gebaar nooit actief werd (een tik, of verticaal weggegleden).
      if (!actief.value) return;
      actief.value = 0;
      schaal.value = naar(1, 'snel');
      scheduleOnRN(einde, waardeW.value);
    }), [sleepbaar, naar, begin, meld, einde, actief, startW, waardeW, schaal, breedteW, minW, maxW, loW, hiW, stapW]);

  const greepStijl = useAnimatedStyle(() => {
    const b = breedteW.value;
    return {
      opacity: b > 0 ? 1 : 0,
      transform: [
        { translateX: xVan(waardeW.value, minW.value, maxW.value, b) - GREEP / 2 },
        { scale: schaal.value },
      ],
    };
  });

  // Het label staat boven de greep, maar blijft binnen de baan (plus de rand): bij een greep op de
  // uiterste rand schuift het naar binnen in plaats van half buiten beeld te vallen.
  const labelStijl = useAnimatedStyle(() => {
    const b = breedteW.value;
    const lb = labelBreedte.value;
    const x = xVan(waardeW.value, minW.value, maxW.value, b);
    const links = Math.min(Math.max(x - lb / 2, -RAND), b + RAND - lb);
    return { opacity: b > 0 && lb > 0 ? dimW.value : 0, transform: [{ translateX: links }] };
  });

  function opAccessibilityAction(e: AccessibilityActionEvent) {
    if (!bereik) return;
    const richting = e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0;
    if (richting === 0) return;
    const nieuw = klem(opStap(waarde + richting * stap, stap), bereik);
    if (nieuw !== waarde) onWaarde(nieuw);
  }

  const dim = sleepbaar ? 1 : GEDIMD;

  return (
    <>
      <Animated.Text
        pointerEvents="none"
        numberOfLines={1}
        importantForAccessibility="no"
        onLayout={e => { labelBreedte.value = e.nativeEvent.layout.width; }}
        style={[styles.greepLabel, { color: kleur }, labelStijl]}
      >
        {formatPrijs(waarde)}
      </Animated.Text>
      <GestureDetector gesture={pan}>
        <Animated.View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: formatPrijs(waarde) }}
          accessibilityState={{ disabled: !sleepbaar }}
          accessibilityActions={sleepbaar ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
          onAccessibilityAction={opAccessibilityAction}
          style={[styles.greep, greepStijl]}
        >
          <View style={[styles.greepRond, { backgroundColor: vulling, borderColor: kleur, opacity: dim }]} />
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  container: { height: HOOGTE, paddingHorizontal: RAND },
  spoor: { flex: 1 },
  baan: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: BAAN_TOP,
    height: BAAN_HOOGTE,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  // ZONE_BASIS breed, links op 0 en vanuit links geschaald: translateX zet het vlak op zijn plek en
  // scaleX geeft het de breedte tussen de grepen. Zo animeert alleen transform.
  zone: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: ZONE_BASIS,
    height: BAAN_HOOGTE,
    transformOrigin: 'left',
  },
  mark: {
    position: 'absolute',
    top: MARK_TOP,
    width: 2,
    height: MARK_HOOGTE,
    borderRadius: 1,
  },
  markLabel: {
    position: 'absolute',
    top: MARK_TOP + MARK_HOOGTE + 4,
    width: MARK_LABEL_BREEDTE,
    alignItems: 'center',
  },
  markTekst: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  greepLabel: {
    position: 'absolute',
    left: 0,
    top: 0,
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
  },
  greep: {
    position: 'absolute',
    left: 0,
    top: GREEP_TOP,
    width: GREEP,
    height: GREEP,
  },
  greepRond: {
    width: GREEP,
    height: GREEP,
    borderRadius: GREEP / 2,
    borderWidth: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
});
