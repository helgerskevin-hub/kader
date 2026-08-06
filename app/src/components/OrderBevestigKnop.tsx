// De enige knop in de app die geld beweegt. Bewust één component voor alle drie de order-sheets,
// zodat kopen, verkopen en niveaus wijzigen zich identiek gedragen en er geen variant ontstaat die
// net iets makkelijker per ongeluk af te vuren is.
//
// In demo is het een gewone tik. In echt is de knop rood, staat er expliciet bij dat het om echt
// geld gaat, en moet je 'm ingedrukt houden: een losse tik doet dan niets.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { EtoroOmgeving } from '../engine/etoro';

// Lang genoeg dat het een bewuste handeling is, kort genoeg dat het niet gaat irriteren.
const HOUD_VAST_MS = 800;

interface Props {
  label: string;
  omgeving: EtoroOmgeving;
  bezig: boolean;
  uitgeschakeld: boolean;
  onBevestig: () => void;
  // Overschrijft de standaardtekst boven de knop in echt-modus.
  echtWaarschuwing?: string;
}

export function OrderBevestigKnop({ label, omgeving, bezig, uitgeschakeld, onBevestig, echtWaarschuwing }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const isEcht = omgeving === 'real';
  const [houdtVast, setHoudtVast] = useState(false);
  const voortgang = useRef(new Animated.Value(0)).current;
  const wekker = useRef<ReturnType<typeof setTimeout> | null>(null);

  const geblokkeerd = uitgeschakeld || bezig;

  // Een lopende timer moet weg als de component verdwijnt, anders vuurt de order af nadat de sheet
  // al gesloten is.
  useEffect(() => () => {
    if (wekker.current !== null) clearTimeout(wekker.current);
  }, []);

  function stopVasthouden() {
    if (wekker.current !== null) {
      clearTimeout(wekker.current);
      wekker.current = null;
    }
    setHoudtVast(false);
    voortgang.setValue(0);
  }

  function startVasthouden() {
    if (geblokkeerd) return;
    setHoudtVast(true);
    if (!reduceMotion) {
      Animated.timing(voortgang, {
        toValue: 1,
        duration: HOUD_VAST_MS,
        easing: Easing.linear,
        // De balk vult de breedte, en die kan niet op de native thread.
        useNativeDriver: false,
      }).start();
    }
    wekker.current = setTimeout(() => {
      wekker.current = null;
      setHoudtVast(false);
      voortgang.setValue(0);
      onBevestig();
    }, HOUD_VAST_MS);
  }

  function tik() {
    // In echt doet een losse tik met opzet niets: daar geldt alleen ingedrukt houden.
    if (isEcht || geblokkeerd) return;
    onBevestig();
  }

  const knopKleur = geblokkeerd ? colors.rand : isEcht ? colors.verlies : colors.cta;

  return (
    <View>
      {isEcht && (
        <View style={[styles.waarschuwing, { backgroundColor: colors.verlies + '1A' }]}>
          <AlertTriangle size={16} color={colors.verlies} strokeWidth={1.75} />
          <Text style={[Type.caption, { color: colors.verlies, flex: 1, lineHeight: 18 }]}>
            {echtWaarschuwing ?? 'Dit is een echte order met echt geld. Houd de knop ingedrukt om te bevestigen.'}
          </Text>
        </View>
      )}

      <Pressable
        onPress={tik}
        onPressIn={isEcht ? startVasthouden : undefined}
        onPressOut={isEcht ? stopVasthouden : undefined}
        disabled={geblokkeerd}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={isEcht ? 'Houd ingedrukt om deze echte order te bevestigen' : undefined}
        accessibilityState={{ disabled: geblokkeerd, busy: bezig }}
        style={[styles.knop, { backgroundColor: knopKleur }]}
      >
        {/* Vulbalk die meeloopt met het ingedrukt houden, zodat je ziet dat er iets gebeurt. */}
        {houdtVast && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(255,255,255,0.28)',
                width: voortgang.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        )}
        {bezig
          ? <ActivityIndicator size="small" color="white" />
          : (
            <Text style={[Type.body, { color: geblokkeerd ? colors.tekstGedimd : 'white', fontWeight: '600' }]}>
              {isEcht && !houdtVast ? `${label} (ingedrukt houden)` : label}
            </Text>
          )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  waarschuwing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.veld,
    marginBottom: spacing.md,
  },
  knop: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
  },
});
