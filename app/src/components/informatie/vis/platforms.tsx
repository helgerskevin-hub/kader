import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useTheme } from '../../../theme/ThemeProvider';
import { Type } from '../../../theme/typography';
import { duur, vervaag } from '../../../theme/beweging';
import { radii, spacing } from '../../../theme/tokens';
import type { VisProps } from './types';

// Statisch: twee kleine kaarten naast elkaar (onder elkaar op smal scherm), alleen een fade-in.
export function VisPlatforms({ speelSleutel, reduceMotion }: VisProps) {
  const dekking = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      dekking.value = 1;
      return;
    }
    dekking.value = 0;
    dekking.value = vervaag(1, duur.lang);
  }, [speelSleutel, reduceMotion]);

  const stijl = useAnimatedStyle(() => ({ opacity: dekking.value }));

  return (
    <Animated.View style={[styles.rij, stijl]}>
      <Mini titel="Met leessleutel" koop={false} />
      <Mini titel="Met Write-sleutel" koop />
    </Animated.View>
  );
}

function Mini({ titel, koop }: { titel: string; koop: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.mini}>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{titel}</Text>
      <View style={[styles.kaart, { backgroundColor: colors.kaart, borderColor: colors.rand }]}>
        <View style={styles.kop}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>SOL</Text>
          <Text style={[Type.prijs, { color: colors.winst }]}>1 : 3.0</Text>
        </View>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Sterke koop</Text>
        {koop && (
          <View style={[styles.koop, { backgroundColor: colors.cta }]}>
            <Text style={[Type.caption, { color: '#FFFFFF' }]}>Koop</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rij: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  mini: { flexGrow: 1, flexBasis: 140, gap: spacing.xs },
  kaart: { borderWidth: 1, borderRadius: radii.kaart, padding: spacing.md, gap: spacing.xs },
  kop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  koop: { alignSelf: 'flex-start', borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 2, marginTop: spacing.xs },
});
