import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  Extrapolation,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  LinearGradient,
  Path,
  Skia,
  interpolateColors,
  vec,
} from '@shopify/react-native-skia';
import { Candle } from '../engine/types';
import { fmtPrijs } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useValutaStand } from '../state/useValuta';
import { BereikId, STANDAARD_BEREIK, beschikbareBereiken, geldigBereik, reeksVoorBereik } from '../engine/grafiekBereik';
import { curve, duur, veer, staggerVertraging, vervaag } from '../theme/beweging';
import { useBeweging } from '../theme/useReduceMotion';
import { useTabZichtbaar } from '../state/tabZichtbaar';
import { haptiek, haptiekVanUI } from '../theme/haptiek';
import { bemonster, fractiesVoor, metAlfa, unieFracties } from './grafiek/morph';

interface Niveau {
  waarde: number;
  kleur: string;
}

interface Props {
  candles: Candle[];
  niveaus?: Niveau[];
  hoogte?: number;
  // Uit voor de voorbeeldgrafiek onder het informatie-scherm: dat is een plaatje bij een uitleg,
  // geen coin waar je doorheen wilt bladeren.
  toonPeriodes?: boolean;
}

const PAD = 10;
// Ruimte rechts van de lijn. De laatste stip met zijn halo stond anders half buiten het doek.
const RECHTS = 8;
const TOOLTIP_BREEDTE = 130;
// Het intekenen bij openen. Lang genoeg om de lijn te zien groeien, kort genoeg dat je er niet op
// wacht.
const TEKEN_DUUR = 700;
// Hoe lang je stil moet houden voordat de aanwijzer verschijnt zonder dat je al zijwaarts beweegt.
const VASTHOUDEN_MS = 150;

// Wat de UI-thread nodig heeft om de lijn te tekenen: één x-raster (fracties 0..1) met de y's van
// waar de morph vandaan komt en waar hij heen gaat, in schermpixels.
interface Vorm {
  xs: number[];
  van: number[];
  naar: number[];
  niveauVan: number[];
  niveauNaar: number[];
  kleurVan: string;
  kleurNaar: string;
  vlakVan: string;
  vlakNaar: string;
}

// Wat het scrubben nodig heeft: de getoonde reeks zelf, niet de morph-tussenstand.
interface Punten {
  ys: number[];
  hoogsteI: number;
  laagsteI: number;
}

function fmtDatumKort(tijd?: number): string {
  if (!tijd) return '';
  return new Date(tijd).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export function PrijsGrafiek({ candles, niveaus = [], hoogte = 180, toonPeriodes = true }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const { reduceMotion, naar } = useBeweging();
  const [breedte, setBreedte] = useState(0);
  const [periode, setPeriode] = useState<BereikId>(STANDAARD_BEREIK);

  const periodes = toonPeriodes ? beschikbareBereiken(candles) : [];
  // Niet op de keuze zelf markeren maar op wat er echt getoond wordt: heeft deze coin te weinig
  // historie voor de gekozen periode, dan valt hij terug op Alles en hoort die knop op te lichten.
  const actievePeriode = geldigBereik(candles, periode);
  const reeks = useMemo(() => reeksVoorBereik(candles, periode), [candles, periode]);
  const sluitkoersen = useMemo(() => reeks.map(c => c.close), [reeks]);

  // De aanroepers bouwen `niveaus` bij elke render opnieuw als array. Op de waarden sleutelen
  // voorkomt dat elke render een morph naar exact dezelfde lijn start.
  const niveauSleutel = niveaus.map(n => n.waarde).join('|');

  // Alles in schermpixels, één keer per reeks. Het gebaar en de animatie lezen hier alleen uit.
  const geometrie = useMemo(() => {
    if (sluitkoersen.length < 2) return null;
    const niveauWaarden = niveaus.map(n => n.waarde);
    const alleWaarden = [...sluitkoersen, ...niveauWaarden];
    const min = Math.min(...alleWaarden);
    const max = Math.max(...alleWaarden);
    const bereik = max - min || 1;
    const yVoor = (v: number) => hoogte - PAD - ((v - min) / bereik) * (hoogte - PAD * 2);

    let hoogsteI = 0;
    let laagsteI = 0;
    sluitkoersen.forEach((c, i) => {
      if (c > sluitkoersen[hoogsteI]) hoogsteI = i;
      if (c < sluitkoersen[laagsteI]) laagsteI = i;
    });

    return {
      min,
      max,
      xs: fractiesVoor(sluitkoersen.length),
      ys: sluitkoersen.map(yVoor),
      niveauYs: niveauWaarden.map(yVoor),
      hoogsteI,
      laagsteI,
      stijgend: sluitkoersen[sluitkoersen.length - 1] >= sluitkoersen[0],
    };
    // niveaus zit via niveauSleutel in de afhankelijkheden, zie hierboven.
  }, [sluitkoersen, niveauSleutel, hoogte]);

  const lijnKleur = geometrie?.stijgend === false ? colors.verlies : colors.winst;

  const breedteSV = useSharedValue(0);
  const vorm = useSharedValue<Vorm | null>(null);
  const punten = useSharedValue<Punten | null>(null);
  const morph = useSharedValue(1);
  const teken = useSharedValue(0);
  const zicht = useSharedValue(1);
  const puls = useSharedValue(1);
  const scrubI = useSharedValue(-1);
  const scrubZicht = useSharedValue(0);
  const groei = useSharedValue(1);

  // Wat er nu op de UI-thread staat, gespiegeld op de JS-thread. Zo kan een nieuwe morph vanuit de
  // huidige tussenstand vertrekken zonder de hele vorm terug te lezen van de UI-thread.
  const vormRef = useRef<Vorm | null>(null);
  const vorigDoelRef = useRef<{ xs: number[]; ys: number[] } | null>(null);
  const getekendRef = useRef(false);

  function opLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    setBreedte(w);
    breedteSV.value = w;
  }

  // Nieuwe reeks, nieuwe schaal of andere kleur: vanaf wat er nu staat naar de nieuwe lijn morphen.
  // Omdat we schermpunten interpoleren, loopt de y-schaal vanzelf mee.
  useEffect(() => {
    if (!geometrie) return;
    const vorige = vormRef.current;
    const doel: Vorm = {
      xs: geometrie.xs,
      van: geometrie.ys,
      naar: geometrie.ys,
      niveauVan: geometrie.niveauYs,
      niveauNaar: geometrie.niveauYs,
      kleurVan: lijnKleur,
      kleurNaar: lijnKleur,
      vlakVan: metAlfa(lijnKleur, 0),
      vlakNaar: metAlfa(lijnKleur, 0),
    };

    let nieuw = doel;
    const morphen = vorige !== null && !reduceMotion;
    if (vorige && morphen) {
      const m = morph.value;
      // Staat de vorige morph stil, dan is wat er staat precies de vorige reeks op zijn eigen
      // raster. Daarvan uitgaan houdt het raster klein; anders groeit het bij elke wissel met de
      // vereniging van alle eerdere rasters mee.
      const bron = m >= 0.999 && vorigDoelRef.current
        ? vorigDoelRef.current
        : { xs: vorige.xs, ys: vorige.van.map((v, i) => v + (vorige.naar[i] - v) * m) };
      const xs = unieFracties(bron.xs, doel.xs);
      const niveauNu = vorige.niveauVan.length === doel.niveauNaar.length
        ? vorige.niveauVan.map((v, i) => v + (vorige.niveauNaar[i] - v) * m)
        : doel.niveauNaar;
      const halverwege = m >= 0.5;
      nieuw = {
        xs,
        van: bemonster(bron.xs, bron.ys, xs),
        naar: bemonster(doel.xs, doel.naar, xs),
        niveauVan: niveauNu,
        niveauNaar: doel.niveauNaar,
        kleurVan: halverwege ? vorige.kleurNaar : vorige.kleurVan,
        kleurNaar: lijnKleur,
        vlakVan: halverwege ? vorige.vlakNaar : vorige.vlakVan,
        vlakNaar: doel.vlakNaar,
      };
    }
    // De volgende wissel leest de tussenstand hieruit samen met `morph`.
    vormRef.current = nieuw;
    vorigDoelRef.current = { xs: doel.xs, ys: doel.naar };

    const nieuwePunten: Punten = { ys: geometrie.ys, hoogsteI: geometrie.hoogsteI, laagsteI: geometrie.laagsteI };
    const vervagen = vorige !== null && reduceMotion;
    // In één worklet, zodat de UI-thread nooit een frame tekent met de nieuwe vorm op de oude
    // morph-stand (dan flitst de eindlijn even voor de animatie begint).
    scheduleOnUI(() => {
      'worklet';
      vorm.value = nieuw;
      punten.value = nieuwePunten;
      if (morphen) {
        morph.value = 0;
        morph.value = withSpring(1, veer.zacht);
      } else {
        morph.value = 1;
      }
      // Minder beweging: geen morph maar een korte cross-fade naar de nieuwe lijn.
      if (vervagen) {
        zicht.value = 0;
        zicht.value = vervaag(1, duur.midden);
      }
    });
  }, [geometrie, lijnKleur, reduceMotion]);

  // Intekenen bij de eerste keer dat er een lijn en een breedte is. Bij Minder beweging vervaagt de
  // hele grafiek in plaats van te groeien.
  const klaarVoorTekenen = breedte > 0 && geometrie !== null;
  useEffect(() => {
    if (!klaarVoorTekenen || getekendRef.current) return;
    getekendRef.current = true;
    if (reduceMotion) {
      teken.value = 1;
      zicht.value = 0;
      zicht.value = vervaag(1, duur.lang);
    } else {
      teken.value = 0;
      teken.value = withTiming(1, { duration: TEKEN_DUUR, easing: curve.binnen });
    }
  }, [klaarVoorTekenen]);

  // Rustig ademende halo om de laatste koers: twee seconden per slag, uit bij Minder beweging en
  // op een tab die niet in beeld is.
  const inBeeld = useTabZichtbaar();
  useEffect(() => {
    if (reduceMotion || !inBeeld) {
      cancelAnimation(puls);
      puls.value = 1;
      return;
    }
    puls.value = 0;
    puls.value = withRepeat(withTiming(1, { duration: 2000, easing: curve.binnen }), -1, false);
    return () => cancelAnimation(puls);
  }, [reduceMotion, inBeeld]);

  // ---------- Paden, op de UI-thread ----------

  const lijnPad = useDerivedValue(() => {
    const b = Skia.PathBuilder.Make();
    const v = vorm.value;
    if (!v) return b.detach();
    const m = morph.value;
    const w = Math.max(breedteSV.value - RECHTS, 0);
    for (let i = 0; i < v.xs.length; i++) {
      const y = v.van[i] + (v.naar[i] - v.van[i]) * m;
      if (i === 0) b.moveTo(v.xs[0] * w, y);
      else b.lineTo(v.xs[i] * w, y);
    }
    return b.detach();
  });

  const vlakPad = useDerivedValue(() => {
    const b = Skia.PathBuilder.Make();
    const v = vorm.value;
    if (!v) return b.detach();
    const m = morph.value;
    const w = Math.max(breedteSV.value - RECHTS, 0);
    b.moveTo(0, hoogte);
    for (let i = 0; i < v.xs.length; i++) {
      b.lineTo(v.xs[i] * w, v.van[i] + (v.naar[i] - v.van[i]) * m);
    }
    b.lineTo(w, hoogte);
    b.close();
    return b.detach();
  });

  // De kleur loopt mee met de morph, zodat groen naar rood geen harde wissel is.
  const lijnKleurSV = useDerivedValue(() => {
    const v = vorm.value;
    if (!v) return [0, 0, 0, 0];
    return interpolateColors(morph.value, [0, 1], [v.kleurVan, v.kleurNaar]);
  });
  const vlakKleuren = useDerivedValue(() => {
    const v = vorm.value;
    if (!v) return [[0, 0, 0, 0], [0, 0, 0, 0]];
    const m = morph.value;
    return [
      interpolateColors(m, [0, 1], [v.kleurVan, v.kleurNaar]),
      interpolateColors(m, [0, 1], [v.vlakVan, v.vlakNaar]),
    ];
  });
  // Het vlak komt achter de lijn aan: het wordt pas zichtbaar als de lijn al een stuk getekend is.
  // 0,25 is de bovenste dekking die het verloop altijd al had.
  const vlakDekking = useDerivedValue(() =>
    0.25 * interpolate(teken.value, [0.15, 1], [0, 1], Extrapolation.CLAMP));

  // ---------- Laatste koers ----------

  const laatstePunt = useDerivedValue(() => {
    const v = vorm.value;
    const w = Math.max(breedteSV.value - RECHTS, 0);
    if (!v) return vec(w, 0);
    const i = v.xs.length - 1;
    return vec(w, v.van[i] + (v.naar[i] - v.van[i]) * morph.value);
  });
  // Verschijnt als de lijn hem bereikt, en maakt plaats voor de aanwijzer tijdens het scrubben.
  const stipDekking = useDerivedValue(() =>
    interpolate(teken.value, [0.85, 1], [0, 1], Extrapolation.CLAMP) * (1 - scrubZicht.value));
  const haloStraal = useDerivedValue(() => 3.5 + 6 * puls.value);
  const haloDekking = useDerivedValue(() => 0.3 * (1 - puls.value) * stipDekking.value);

  // ---------- Scrubben ----------

  const cursorX = useDerivedValue(() => {
    const p = punten.value;
    const i = scrubI.value;
    if (!p || i < 0 || p.ys.length < 2) return 0;
    return (i / (p.ys.length - 1)) * Math.max(breedteSV.value - RECHTS, 0);
  });
  const cursorBoven = useDerivedValue(() => vec(cursorX.value, 0));
  const cursorOnder = useDerivedValue(() => vec(cursorX.value, hoogte));
  const cursorPunt = useDerivedValue(() => {
    const p = punten.value;
    const i = scrubI.value;
    if (!p || i < 0 || i >= p.ys.length) return vec(cursorX.value, 0);
    return vec(cursorX.value, p.ys[i]);
  });
  const cursorRing = useDerivedValue(() => 5.5 * groei.value);
  const cursorKern = useDerivedValue(() => 3.5 * groei.value);

  const scrub = useMemo(() => {
    function indexVoor(x: number): number {
      'worklet';
      const p = punten.value;
      const w = breedteSV.value - RECHTS;
      if (!p || p.ys.length < 2 || w <= 0) return -1;
      const fractie = Math.min(Math.max(x / w, 0), 1);
      return Math.round(fractie * (p.ys.length - 1));
    }

    function pakOp(x: number) {
      'worklet';
      const i = indexVoor(x);
      if (i < 0) return;
      scrubI.value = i;
      scrubZicht.value = vervaag(1, duur.kort);
      groei.value = 0.4;
      groei.value = naar(1.2, 'speels');
      haptiekVanUI('tik');
    }

    function beweeg(x: number) {
      'worklet';
      const i = indexVoor(x);
      const vorig = scrubI.value;
      if (i < 0 || i === vorig) return;
      const p = punten.value;
      if (p && vorig >= 0) {
        // Een snelle veeg slaat punten over, dus we kijken of het uiterste tussen de vorige en de
        // nieuwe positie ligt en niet alleen of je er precies op landt.
        const laag = Math.min(vorig, i);
        const hoog = Math.max(vorig, i);
        const passeert = (uiterste: number) => uiterste !== vorig && uiterste >= laag && uiterste <= hoog;
        if (passeert(p.hoogsteI) || passeert(p.laagsteI)) haptiekVanUI('drempel');
      }
      scrubI.value = i;
    }

    function laatLos() {
      'worklet';
      groei.value = naar(1, 'snel');
      scrubZicht.value = vervaag(0, duur.kort, klaar => {
        'worklet';
        // Alleen als de fade echt afliep: pak je meteen weer op, dan hoort de index te blijven.
        if (klaar) scrubI.value = -1;
      });
    }

    // Twee manieren om de aanwijzer op te pakken, en de eerste die zeker is wint:
    // - zijwaarts slepen: na 6dp horizontaal meteen actief. Beweegt de vinger eerst 12dp verticaal,
    //   dan geeft dit gebaar op en scrollt de pagina gewoon. De swipe-terug van het detailscherm
    //   en de tab-pager hebben een grotere drempel, dus binnen de grafiek wint het scrubben.
    // - stilhouden: na 150ms zonder te bewegen, voor wie een punt wil bekijken zonder te slepen.
    // Een korte tik doet niets, net als in Aandelen van Apple.
    const slepen = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .shouldCancelWhenOutside(false)
      .onStart(e => { 'worklet'; pakOp(e.x); })
      .onUpdate(e => { 'worklet'; beweeg(e.x); })
      .onEnd(() => { 'worklet'; laatLos(); });
    const vasthouden = Gesture.Pan()
      .activateAfterLongPress(VASTHOUDEN_MS)
      .shouldCancelWhenOutside(false)
      .onStart(e => { 'worklet'; pakOp(e.x); })
      .onUpdate(e => { 'worklet'; beweeg(e.x); })
      .onEnd(() => { 'worklet'; laatLos(); });
    return Gesture.Race(slepen, vasthouden);
  }, [naar]);

  // ---------- Periodeknoppen ----------

  const [knopMaten, setKnopMaten] = useState<Partial<Record<BereikId, { x: number; w: number }>>>({});
  const pilX = useSharedValue(0);
  const pilW = useSharedValue(0);
  const pilGeplaatstRef = useRef(false);

  useEffect(() => {
    const maat = knopMaten[actievePeriode];
    if (!maat) return;
    if (!pilGeplaatstRef.current) {
      // De eerste keer direct op zijn plek, anders schuift de pil bij openen vanaf links binnen.
      pilGeplaatstRef.current = true;
      pilX.value = maat.x;
      pilW.value = maat.w;
      return;
    }
    pilX.value = naar(maat.x, 'stevig');
    pilW.value = naar(maat.w, 'stevig');
  }, [actievePeriode, knopMaten]);

  const pilStijl = useAnimatedStyle(() => ({
    width: pilW.value,
    transform: [{ translateX: pilX.value }],
    opacity: pilW.value > 0 ? 1 : 0,
  }));

  function kiesPeriode(id: BereikId) {
    if (id !== actievePeriode) haptiek('tik');
    scrubI.value = -1;
    scrubZicht.value = 0;
    setPeriode(id);
  }

  if (!geometrie) {
    return <View style={[styles.leeg, { height: hoogte, backgroundColor: colors.verhoogd }]} onLayout={opLayout} />;
  }

  return (
    <View>
      {/* Een eigen root voor gesture-handler. Binnen de app-root of een scherm dat er zelf één
          heeft doet deze niets (gesture-handler slaat geneste roots over), maar in een kale Modal
          zouden de gebaren zonder hem niet aankomen. */}
      <GestureHandlerRootView style={{ height: hoogte }}>
        <GestureDetector gesture={scrub}>
          <View style={{ height: hoogte }} onLayout={opLayout}>
            {breedte > 0 && (
              <Canvas style={{ width: breedte, height: hoogte }} pointerEvents="none">
                <Group opacity={zicht}>
                  <Path path={vlakPad} opacity={vlakDekking}>
                    <LinearGradient start={vec(0, 0)} end={vec(0, hoogte)} colors={vlakKleuren} />
                  </Path>
                  {niveaus.map((n, i) => (
                    <NiveauLijn
                      key={i}
                      index={i}
                      kleur={n.kleur}
                      vorm={vorm}
                      morph={morph}
                      breedte={breedteSV}
                      reduceMotion={reduceMotion}
                    />
                  ))}
                  <Path
                    path={lijnPad}
                    style="stroke"
                    strokeWidth={2}
                    strokeCap="round"
                    strokeJoin="round"
                    color={lijnKleurSV}
                    start={0}
                    end={teken}
                  />
                  <Circle c={laatstePunt} r={haloStraal} color={lijnKleurSV} opacity={haloDekking} />
                  <Circle c={laatstePunt} r={3.5} color={lijnKleurSV} opacity={stipDekking} />
                </Group>
                <Group opacity={scrubZicht}>
                  <Line p1={cursorBoven} p2={cursorOnder} color={colors.tekstGedimd} style="stroke" strokeWidth={1}>
                    <DashPathEffect intervals={[2, 3]} />
                  </Line>
                  <Circle c={cursorPunt} r={cursorRing} color={colors.kaart} />
                  <Circle c={cursorPunt} r={cursorKern} color={colors.cta} />
                </Group>
              </Canvas>
            )}

            {/* Achtergrondpil onder de tekst: zonder die dekking loopt een niveaulijn die toevallig
                op de hoogste of laagste koers uitkomt dwars door de cijfers heen. */}
            <Text style={[Type.label, styles.prijsLabelBoven, { color: colors.tekstGedimd, backgroundColor: colors.achtergrond }]}>{fmtPrijs(geometrie.max)}</Text>
            <Text style={[Type.label, styles.prijsLabelOnder, { color: colors.tekstGedimd, backgroundColor: colors.achtergrond }]}>{fmtPrijs(geometrie.min)}</Text>

            <ScrubLabel
              reeks={reeks}
              scrubI={scrubI}
              scrubZicht={scrubZicht}
              cursorX={cursorX}
              breedte={breedteSV}
            />
          </View>
        </GestureDetector>
      </GestureHandlerRootView>

      <View style={styles.datumRij}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{fmtDatumKort(reeks[0].tijd)}</Text>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{fmtDatumKort(reeks[reeks.length - 1].tijd)}</Text>
      </View>

      {/* Alleen tonen als er iets te kiezen valt: bij een bron die maar een maand teruggaat zou elke
          knop dezelfde grafiek geven, en dat leest als een kapotte app. */}
      {periodes.length > 0 && (
        <View style={styles.bereikHouder}>
          {/* Drie lagen: de grijze pillen, de blauwe keuzepil die ertussen schuift, en de knoppen
              met hun tekst bovenop. De keuzepil moet boven het grijs en onder de tekst liggen, en
              dat kan alleen als die drie los van elkaar liggen. De twee rijen hebben dezelfde
              inhoud en stijl, dus ze vallen exact over elkaar. */}
          <View
            style={styles.bereikRij}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {periodes.map(b => (
              <View key={b.id} style={[styles.bereikPil, { backgroundColor: colors.verhoogd }]}>
                <Text style={[Type.caption, styles.bereikTekst, { color: 'transparent' }]}>{b.label}</Text>
              </View>
            ))}
          </View>
          <Animated.View
            pointerEvents="none"
            style={[styles.keuzePil, { backgroundColor: colors.cta }, pilStijl]}
          />
          <View style={[styles.bereikRij, StyleSheet.absoluteFill]}>
            {periodes.map(b => {
              const aan = b.id === actievePeriode;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => kiesPeriode(b.id)}
                  onLayout={e => {
                    const { x, width } = e.nativeEvent.layout;
                    setKnopMaten(m => (m[b.id]?.x === x && m[b.id]?.w === width ? m : { ...m, [b.id]: { x, w: width } }));
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: aan }}
                  accessibilityLabel={`Toon ${b.label}`}
                  style={styles.bereikPil}
                >
                  <Text style={[Type.caption, styles.bereikTekst, { color: aan ? 'white' : colors.tekstGedimd }]}>
                    {b.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

interface NiveauLijnProps {
  index: number;
  kleur: string;
  vorm: SharedValue<Vorm | null>;
  morph: SharedValue<number>;
  breedte: SharedValue<number>;
  reduceMotion: boolean;
}

// Eén stippellijn voor stop, entry of doel. Glijdt bij openen een stukje van boven op zijn plek,
// gestaffeld na de andere, en loopt bij een periodewissel mee met de nieuwe schaal.
function NiveauLijn({ index, kleur, vorm, morph, breedte, reduceMotion }: NiveauLijnProps) {
  const binnen = useSharedValue(0);
  const verschuiving = reduceMotion ? 0 : -10;

  useEffect(() => {
    // Wacht tot de lijn een eind op weg is, dan komen de niveaus er één voor één bij. Twee
    // stagger-stappen per lijn: met één lezen drie lijnen als één beweging.
    const wacht = TEKEN_DUUR / 3 + staggerVertraging(index * 2);
    binnen.value = reduceMotion
      ? withDelay(wacht, vervaag(1, duur.midden))
      : withDelay(wacht, withSpring(1, veer.standaard));
  }, []);

  const y = useDerivedValue(() => {
    const v = vorm.value;
    if (!v) return 0;
    const doel = v.niveauNaar[index] ?? 0;
    const van = v.niveauVan[index] ?? doel;
    return van + (doel - van) * morph.value;
  });
  const p1 = useDerivedValue(() => vec(0, y.value));
  const p2 = useDerivedValue(() => vec(breedte.value, y.value));
  const dekking = useDerivedValue(() => Math.min(Math.max(binnen.value, 0), 1));
  const transform = useDerivedValue(() => [{ translateY: (1 - binnen.value) * verschuiving }]);

  return (
    <Group opacity={dekking} transform={transform}>
      <Line p1={p1} p2={p2} color={kleur} style="stroke" strokeWidth={1}>
        <DashPathEffect intervals={[4, 4]} />
      </Line>
    </Group>
  );
}

interface ScrubLabelProps {
  reeks: Candle[];
  scrubI: SharedValue<number>;
  scrubZicht: SharedValue<number>;
  cursorX: SharedValue<number>;
  breedte: SharedValue<number>;
}

// De datum en koers bovenin de grafiek tijdens het scrubben. Plaats en zichtbaarheid lopen op de
// UI-thread mee met de vinger; alleen de tekst gaat via React, en dan uitsluitend als de vinger
// een ander punt aanwijst. Dat zijn er hooguit een paar honderd per veeg, niet één per frame, en
// alleen dit kleine label rendert opnieuw, niet de hele grafiek.
function ScrubLabel({ reeks, scrubI, scrubZicht, cursorX, breedte }: ScrubLabelProps) {
  const { colors } = useTheme();
  const [actief, setActief] = useState<number | null>(null);

  useAnimatedReaction(
    () => scrubI.value,
    (i, vorig) => {
      if (i !== vorig && i >= 0) scheduleOnRN(setActief, i);
    },
  );

  const stijl = useAnimatedStyle(() => {
    const links = Math.min(
      Math.max(cursorX.value - TOOLTIP_BREEDTE / 2, 0),
      Math.max(breedte.value - TOOLTIP_BREEDTE, 0),
    );
    return { opacity: scrubZicht.value, transform: [{ translateX: links }] };
  });

  // De aanwijzer wijst een index in `reeks` aan, en die reeks krimpt als je een korter bereik kiest.
  // Zonder deze grens leest de tooltip na het wisselen buiten de rij en valt het scherm om.
  const actiefVeilig = actief !== null && actief < reeks.length ? actief : null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.tooltip, { backgroundColor: colors.kaart, borderColor: colors.rand }, stijl]}
    >
      {actiefVeilig !== null && (
        <>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{fmtDatumKort(reeks[actiefVeilig].tijd)}</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtPrijs(reeks[actiefVeilig].close)}</Text>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  leeg: { borderRadius: 8 },
  prijsLabelBoven: { position: 'absolute', top: 2, right: 4, paddingHorizontal: 4, borderRadius: 4 },
  prijsLabelOnder: { position: 'absolute', bottom: 2, right: 4, paddingHorizontal: 4, borderRadius: 4 },
  tooltip: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: TOOLTIP_BREEDTE,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignItems: 'center',
    gap: 1,
  },
  datumRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  bereikHouder: {
    marginTop: spacing.sm,
  },
  bereikRij: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  bereikPil: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    minHeight: 32,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bereikTekst: { fontWeight: '600' },
  keuzePil: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.pill,
  },
});
