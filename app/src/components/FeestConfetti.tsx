import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../theme/useReduceMotion';

interface Props {
  actief: boolean;
  onKlaar?: () => void;
  aantal?: number;
}

type Soort = 'munt' | 'snipper';

interface DeeltjeConfig {
  id: number;
  soort: Soort;
  x: number;
  grootte: number;   // munt: diameter; snipper: hoogte
  breedte: number;   // alleen snipper
  kleur: string;
  vertraging: number;
  duur: number;
  spins: number;
  drift: number;
  richting: 1 | -1;
}

const BURST_DUUR = 3200;

export function FeestConfetti({ actief, onKlaar, aantal = 70 }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const width = Dimensions.get('window').width;
  const height = Dimensions.get('window').height;

  const palet = useMemo(
    () => [colors.cta, colors.winst, colors.letOp, colors.primair, colors.verlies, colors.goud],
    [colors],
  );

  const deeltjes = useMemo<DeeltjeConfig[]>(() => {
    return Array.from({ length: aantal }, (_, id) => {
      const soort: Soort = Math.random() < 0.45 ? 'munt' : 'snipper';
      return {
        id,
        soort,
        x: Math.random() * width,
        grootte: soort === 'munt' ? 12 + Math.random() * 16 : 8 + Math.random() * 10,
        breedte: 5 + Math.random() * 5,
        kleur: palet[Math.floor(Math.random() * palet.length)],
        vertraging: Math.random() * 700,
        duur: 2200 + Math.random() * 1900,
        spins: 1 + Math.floor(Math.random() * 4),
        drift: 20 + Math.random() * 50,
        richting: Math.random() > 0.5 ? 1 : -1,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aantal, width]);

  useEffect(() => {
    if (!actief || reduceMotion) return;
    const t = setTimeout(() => onKlaar?.(), BURST_DUUR);
    return () => clearTimeout(t);
  }, [actief, reduceMotion, onKlaar]);

  if (!actief || reduceMotion) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {deeltjes.map(d => (
        <Deeltje key={d.id} config={d} goud={colors.goud} schermHoogte={height} />
      ))}
    </View>
  );
}

function Deeltje({ config, goud, schermHoogte }: {
  config: DeeltjeConfig;
  goud: string;
  schermHoogte: number;
}) {
  const voortgang = useSharedValue(0);

  useEffect(() => {
    voortgang.value = 0;
    voortgang.value = withDelay(
      config.vertraging,
      withTiming(1, { duration: config.duur, easing: Easing.linear }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stijl = useAnimatedStyle(() => {
    const v = voortgang.value;
    const translateY = interpolate(
      v, [0, 1], [-config.grootte - 40, schermHoogte + config.grootte], Extrapolation.CLAMP,
    );
    const translateX = interpolate(
      v, [0, 0.25, 0.5, 0.75, 1],
      [0, config.drift * config.richting, 0, -config.drift * config.richting, 0],
      Extrapolation.CLAMP,
    );
    const rotate = interpolate(v, [0, 1], [0, 360 * config.spins * config.richting], Extrapolation.CLAMP);
    const opacity = interpolate(v, [0, 0.08, 0.9, 1], [0, 1, 1, 0], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateY }, { translateX }, { rotate: `${rotate}deg` }],
    };
  });

  if (config.soort === 'munt') {
    return (
      <Animated.View
        style={[
          styles.munt,
          {
            left: config.x,
            width: config.grootte,
            height: config.grootte,
            borderRadius: config.grootte / 2,
            backgroundColor: goud,
          },
          stijl,
        ]}
      >
        <Text style={[styles.teken, { fontSize: config.grootte * 0.62 }]}>₿</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.snipper,
        {
          left: config.x,
          width: config.breedte,
          height: config.grootte,
          backgroundColor: config.kleur,
        },
        stijl,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  munt: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teken: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  snipper: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
});
