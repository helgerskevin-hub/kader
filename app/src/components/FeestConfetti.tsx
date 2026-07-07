import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, Text, Dimensions } from 'react-native';
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
  const voortgang = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    voortgang.setValue(0);
    const animatie = Animated.timing(voortgang, {
      toValue: 1,
      duration: config.duur,
      delay: config.vertraging,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animatie.start();
    return () => animatie.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = voortgang.interpolate({
    inputRange: [0, 1],
    outputRange: [-config.grootte - 40, schermHoogte + config.grootte],
  });
  const translateX = voortgang.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, config.drift * config.richting, 0, -config.drift * config.richting, 0],
  });
  const rotate = voortgang.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${360 * config.spins * config.richting}deg`],
  });
  const opacity = voortgang.interpolate({
    inputRange: [0, 0.08, 0.9, 1],
    outputRange: [0, 1, 1, 0],
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
            opacity,
            transform: [{ translateY }, { translateX }, { rotate }],
          },
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
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
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
