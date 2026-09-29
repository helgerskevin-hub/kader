import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { SvgAst, parse } from 'react-native-svg';
import { vanEtoroSymbool } from '../engine/etoroSymbolen';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts } from '../theme/typography';
import { duur, curve } from '../theme/beweging';
import { useReduceMotion } from '../theme/useReduceMotion';
import { COIN_LOGOS } from './coinLogos';

// Rond coinlogo met een monogram eronder: heeft Kader van een coin geen logo, dan blijft de
// afkorting in een gekleurd rondje over. De scorering in fase 3 gebruikt dit component ook.
//
// De logo's zitten in de app zelf en zijn dus direct klaar, maar in een lijst rendert elke rij
// steeds opnieuw. Een fade per render zou dan knipperen, daarom fadet elk symbool maar één keer
// per app-sessie in.
const alGetoond = new Set<string>();

// SvgXml parseert bij elke mount opnieuw. Historie zet alle gesloten trades onder elkaar, dus
// parsen we elk logo één keer per sessie. null: parsen mislukt, dan blijft het monogram staan.
const ontleed = new Map<string, ReturnType<typeof parse>>();

function astVan(sleutel: string, xml: string): ReturnType<typeof parse> {
  if (!ontleed.has(sleutel)) {
    try {
      ontleed.set(sleutel, parse(xml));
    } catch {
      ontleed.set(sleutel, null);
    }
  }
  return ontleed.get(sleutel) ?? null;
}

// Zelfde volgorde als in het ontwerp (mg()): de grote coins hebben een vaste kleur, de rest
// krijgt er een uit de tekencodes, zodat een coin overal dezelfde kleur houdt.
const VASTE_KLEUR: Record<string, number> = { BTC: 5, ETH: 3, SOL: 4, LINK: 1, AVAX: 2, XRP: 0, NEAR: 2, INJ: 0 };

function kleurIndex(sleutel: string): number {
  const vast = VASTE_KLEUR[sleutel];
  if (vast !== undefined) return vast;
  let som = 0;
  for (let i = 0; i < sleutel.length; i++) som += sleutel.charCodeAt(i);
  return som % 6;
}

interface Props {
  symbool: string;
  grootte?: number;
}

// Een key per symbool: krijgt dezelfde plek een andere coin, dan begint die met een eigen fade.
export const CoinLogo = React.memo(function CoinLogo({ symbool, grootte = 40 }: Props) {
  const sleutel = vanEtoroSymbool(symbool);
  return <CoinLogoVoor key={sleutel} sleutel={sleutel} grootte={grootte} />;
});

function CoinLogoVoor({ sleutel, grootte }: { sleutel: string; grootte: number }) {
  const { colors, donkerActief } = useTheme();
  const reduceMotion = useReduceMotion();
  const xml = COIN_LOGOS[sleutel];
  const logo = xml ? astVan(sleutel, xml) : null;

  // Alleen bij de eerste render van dit component bepalen of er nog gefadet moet worden; de
  // Set wordt pas in het effect bijgewerkt zodat een tweede instantie in dezelfde render ook fadet.
  const moetFaden = useRef(!alGetoond.has(sleutel) && !reduceMotion).current;
  const opacity = useSharedValue(moetFaden ? 0 : 1);

  useEffect(() => {
    if (!logo) return;
    alGetoond.add(sleutel);
    if (moetFaden) opacity.value = withTiming(1, { duration: duur.midden, easing: curve.fade });
  }, [logo, sleutel, moetFaden, opacity]);

  const logoStijl = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const kleur = colors.verdeling[kleurIndex(sleutel)];
  const rond = { width: grootte, height: grootte, borderRadius: grootte / 2 };
  const fontSize = sleutel.length > 3 ? 9.5 : grootte < 36 ? 10 : 11;

  return (
    <View
      style={rond}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.vul, rond, { backgroundColor: `${kleur}24` }]}>
        <Text style={[styles.monogram, { color: kleur, fontSize }]} numberOfLines={1} allowFontScaling={false}>{sleutel.slice(0, 4)}</Text>
      </View>
      {logo ? (
        <>
          <Animated.View style={[styles.vul, rond, styles.afgesneden, logoStijl]}>
            <SvgAst ast={logo} override={{ width: grootte, height: grootte }} />
          </Animated.View>
          {/* Aparte laag bovenop, zodat de rand de tekening niet kleiner maakt. Zonder rand vallen
              de donkere logo's (XRP, NEAR) weg tegen een donkere achtergrond. */}
          <View
            pointerEvents="none"
            style={[
              styles.vul,
              rond,
              {
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: donkerActief ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.10)',
              },
            ]}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  vul: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  afgesneden: { overflow: 'hidden' },
  monogram: { fontFamily: Fonts.sansBold, letterSpacing: 0.2 },
});
