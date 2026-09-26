import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { useBeweging } from '../theme/useReduceMotion';
import { Richting } from '../state/portfolioTypes';

interface Props {
  stop: number;
  entry: number;
  doel: number;
  live: number | undefined;
  kleur: string;
  // Ontbreekt = 'long', zodat bestaande aanroepen blijven werken. Bij een short liggen stop en doel
  // andersom (stop boven de entry, doel eronder), dus range wordt anders negatief en klopt de balk niet.
  richting?: Richting;
}

// Kale balk van stop tot doel, met een markering op de live-prijs. Geen labels of prijzen,
// bedoeld voor de compacte tradelijst waar de volledige LevelRow te hoog is.
//
// Beweging loopt via transform (scaleX voor het lage stuk, translateX voor de markering) en nooit
// via width of left: dat zijn layout-eigenschappen, en die per frame omzetten laat de hele rij
// opnieuw meten. Een transform schuift alleen wat er al getekend is.
export function PositieBalk({ stop, entry, doel, live, kleur, richting = 'long' }: Props) {
  const { colors } = useTheme();
  const { reduceMotion, naar } = useBeweging();
  const [breedte, setBreedte] = useState(0);

  // De balk loopt altijd van lage naar hoge prijs. Bij long is dat stop→doel, bij short doel→stop:
  // zo blijft de fractieberekening positief in plaats van dat "doel - stop" negatief wordt.
  const isShort = richting === 'short';
  const laag = isShort ? doel : stop;
  const hoog = isShort ? stop : doel;
  const range = hoog - laag;

  const entryFractie = range > 0 ? (entry - laag) / range : 0.5;
  const entryDeel = Math.round(Math.min(Math.max(entryFractie, 0.02), 0.98) * 100) / 100;

  const liveFractie = live !== undefined && range > 0 ? (live - laag) / range : 0.5;
  const liveDeel = Math.min(Math.max(liveFractie, 0.01), 0.99);

  const vulling = useSharedValue(0);
  const markerX = useSharedValue(0);
  const geplaatstRef = useRef(false);

  useEffect(() => {
    if (breedte <= 0) return;
    const doelX = liveDeel * breedte;
    if (!geplaatstRef.current) {
      // Bij verschijnen vult het lage stuk zich vanaf links; de markering staat meteen goed, want
      // een markering die binnenschuift suggereert een koersbeweging die er niet was.
      geplaatstRef.current = true;
      markerX.value = doelX;
      vulling.value = reduceMotion ? entryDeel : naar(entryDeel, 'standaard');
      return;
    }
    // Minder beweging: gewoon op de nieuwe plek, niet eens kort schuiven.
    markerX.value = reduceMotion ? doelX : naar(doelX, 'standaard');
    vulling.value = reduceMotion ? entryDeel : naar(entryDeel, 'standaard');
  }, [breedte, liveDeel, entryDeel, reduceMotion]); // naar volgt reduceMotion

  const vulStijl = useAnimatedStyle(() => ({ transform: [{ scaleX: vulling.value }] }));
  const markerStijl = useAnimatedStyle(() => ({ transform: [{ translateX: markerX.value }] }));

  if (stop <= 0 || doel <= 0 || live === undefined) return null;

  // Welke kleur bij het lage en het hoge uiteinde hoort, wisselt mee met de richting: bij long is
  // laag de stop (rood) en hoog het doel (groen); bij short is het net andersom.
  const laagKleur = isShort ? colors.winst : colors.verlies;
  const hoogKleur = isShort ? colors.verlies : colors.winst;

  return (
    <View
      style={styles.balkContainer}
      onLayout={(e: LayoutChangeEvent) => setBreedte(e.nativeEvent.layout.width)}
    >
      {/* De spoorbaan knipt de gekleurde stukken af op de ronde hoeken. Hij ligt los van de
          markering, want die steekt boven en onder de balk uit en mag niet mee geknipt worden. */}
      <View style={[styles.spoor, { backgroundColor: hoogKleur }]}>
        <Animated.View style={[styles.laagStuk, { backgroundColor: laagKleur }, vulStijl]} />
      </View>
      {breedte > 0 && (
        <Animated.View style={[styles.liveMarker, { backgroundColor: kleur }, markerStijl]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  balkContainer: {
    height: 4,
    position: 'relative',
  },
  spoor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 2,
    overflow: 'hidden',
  },
  laagStuk: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    transformOrigin: 'left',
  },
  liveMarker: {
    position: 'absolute',
    top: -2,
    left: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
});
