// De gecentreerde dialoog van Kader, de vervanger van Alert.alert.
//
// Gecentreerd en niet als bottom sheet: dit is een stop-en-beslis-moment, geen paneel dat je opzij
// schuift. De onderrand van het scherm is in Kader al van de sheets, en een sheet boven op een sheet
// leest als een stapel.
//
// Wordt alleen door DialoogProvider gemount. Roep hem nergens anders aan, anders komt de Modal weer
// op meerdere plekken tegelijk te staan.
import React, { useEffect, useRef } from 'react';
import {
  Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { fmtPct, fmtResultaatUsd } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, shadow, spacing } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import type { DialoogInhoud, DialoogKnop } from '../state/DialoogProvider';

const IKONEN = {
  informatie: Info,
  gelukt: CheckCircle2,
  waarschuwing: AlertTriangle,
  fout: XCircle,
} as const;

// Vast in beide thema's. De donkere colors.verlies (#EF4444) haalt met witte tekst geen AA,
// #DC2626 wel, en een knop die je posities wist mag niet net onder de leesbaarheidsgrens vallen.
const DESTRUCTIEF = '#DC2626';

// Meer dan zes regels detailtekst duwt de knoppen van het scherm; vanaf daar mag het blok scrollen.
const MAX_DETAILREGELS = 6;

interface Props {
  inhoud: DialoogInhoud | null;
  zichtbaar: boolean;
  onSluiten: () => void;
}

export function KaderDialoog({ inhoud, zichtbaar, onSluiten }: Props) {
  const { colors, donkerActief } = useTheme();
  const reduceMotion = useReduceMotion();
  const schaal = useRef(new Animated.Value(1)).current;

  const resultaat = inhoud?.resultaat;
  const verliesGetoond = resultaat !== undefined && resultaat.soort === 'bedrag' && resultaat.bedragUsd < 0;
  // Je feliciteert niemand met een verlies, dus de puls slaat over zodra het bedrag negatief is.
  const pulseren = zichtbaar && inhoud?.variant === 'gelukt' && !verliesGetoond && !reduceMotion;

  useEffect(() => {
    schaal.setValue(1);
    if (!pulseren) return;
    Animated.sequence([
      Animated.timing(schaal, {
        toValue: 1.06,
        duration: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(schaal, {
        toValue: 1,
        duration: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulseren, schaal]);

  const knoppen = inhoud?.knoppen ?? [];
  const enkeleKnop = knoppen.length <= 1;
  const secundaireKnop = knoppen.find(k => k.soort === 'secundair') ?? knoppen[knoppen.length - 1];

  function druk(knop: DialoogKnop) {
    onSluiten();
    knop.onDruk?.();
  }

  // Eén knop: er valt niets te beslissen, dus naast de kaart tikken sluit gewoon. Twee knoppen: dan
  // doet een tik naast de kaart niets, want een bevestiging mag niet per ongeluk wegvallen.
  function opAchtergrond() {
    if (enkeleKnop) onSluiten();
  }

  function opTerugknop() {
    if (!enkeleKnop && secundaireKnop) druk(secundaireKnop);
    else onSluiten();
  }

  const variant = inhoud?.variant ?? 'informatie';
  const Icoon = IKONEN[variant];
  const variantKleur =
    variant === 'gelukt' ? colors.winst
      : variant === 'waarschuwing' ? colors.letOp
        : variant === 'fout' ? colors.verlies
          : colors.cta;
  // 10 procent dekking in licht, 14 in donker: op een donkere kaart verdwijnt 10 procent te veel.
  const schijfVulling = variantKleur + (donkerActief ? '24' : '1A');

  const detailRegels = inhoud?.details ? inhoud.details.split('\n').length : 0;
  const detailScrollt = detailRegels > MAX_DETAILREGELS;

  return (
    <Modal
      visible={zichtbaar && inhoud !== null}
      transparent
      animationType="fade"
      onRequestClose={opTerugknop}
    >
      <Pressable
        style={[
          stijlen.achtergrond,
          { backgroundColor: donkerActief ? 'rgba(0,0,0,0.6)' : 'rgba(15,23,42,0.5)' },
        ]}
        onPress={opAchtergrond}
        accessibilityLabel={enkeleKnop ? 'Sluiten' : undefined}
      >
        {inhoud !== null ? (
          <Pressable
            style={[stijlen.kaart, shadow.modal, { backgroundColor: colors.kaart }]}
            onPress={() => {}}
            accessibilityViewIsModal
          >
            <Animated.View
              style={[
                stijlen.schijf,
                { backgroundColor: schijfVulling, transform: [{ scale: schaal }] },
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Icoon size={20} color={variantKleur} strokeWidth={1.75} />
            </Animated.View>

            <Text
              style={[Type.titel, stijlen.titel, { color: colors.tekstPrimair }]}
              accessibilityRole="header"
            >
              {inhoud.titel}
            </Text>
            <Text style={[Type.body, stijlen.tekst, { color: colors.tekstGedimd }]}>
              {inhoud.tekst}
            </Text>

            {resultaat !== undefined ? (
              <ResultaatBlok resultaat={resultaat} />
            ) : null}

            {inhoud.details ? (
              detailScrollt ? (
                <ScrollView
                  style={[stijlen.detailBlok, stijlen.detailScroll, { backgroundColor: colors.verhoogd }]}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{inhoud.details}</Text>
                </ScrollView>
              ) : (
                <View style={[stijlen.detailBlok, { backgroundColor: colors.verhoogd }]}>
                  <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{inhoud.details}</Text>
                </View>
              )
            ) : null}

            <View style={stijlen.knoppen}>
              {knoppen.map(knop => {
                const soort = knop.soort ?? 'primair';
                const vulling = soort === 'primair' ? colors.cta
                  : soort === 'destructief' ? DESTRUCTIEF
                    : 'transparent';
                const tekstKleur = soort === 'secundair' ? colors.tekstGedimd : '#FFFFFF';
                return (
                  <Pressable
                    key={knop.label}
                    onPress={() => druk(knop)}
                    accessibilityRole="button"
                    accessibilityLabel={knop.label}
                    style={[
                      stijlen.knop,
                      { backgroundColor: vulling },
                      soort === 'secundair' && { borderWidth: 1, borderColor: colors.rand },
                    ]}
                  >
                    <Text style={[Type.body, stijlen.knopLabel, { color: tekstKleur }]}>
                      {knop.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

// Het blok tussen de tekst en de knoppen. Zit apart zodat de drie vormen naast elkaar leesbaar zijn.
function ResultaatBlok({ resultaat }: { resultaat: NonNullable<DialoogInhoud['resultaat']> }) {
  const { colors } = useTheme();

  if (resultaat.soort === 'waarschuwing') {
    return (
      <View style={[stijlen.resultaatBlok, stijlen.letOpBlok, { borderColor: colors.letOp }]}>
        <Text style={[Type.caption, { color: colors.letOp }]}>{resultaat.tekst}</Text>
      </View>
    );
  }

  if (resultaat.soort === 'onbekend') {
    return (
      <>
        <View style={[stijlen.resultaatBlok, { backgroundColor: colors.verhoogd }]}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>RESULTAAT</Text>
          <Text style={[Type.prijsGroot, stijlen.bedrag, { color: colors.tekstGedimd }]}>
            Nog onbekend
          </Text>
        </View>
        <Text style={[Type.caption, stijlen.toelichting, { color: colors.tekstGedimd }]}>
          {resultaat.toelichting}
        </Text>
      </>
    );
  }

  const kleur = resultaat.bedragUsd >= 0 ? colors.winst : colors.verlies;
  return (
    <>
      <View style={[stijlen.resultaatBlok, { backgroundColor: colors.verhoogd }]}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>GESCHAT RESULTAAT</Text>
        <View style={stijlen.bedragRij}>
          <Text style={[Type.prijsGroot, { color: kleur }]}>
            {fmtResultaatUsd(resultaat.bedragUsd)}
          </Text>
          <Text style={[Type.prijs, { color: kleur }]}>({fmtPct(resultaat.procent)})</Text>
        </View>
        {resultaat.detail ? (
          <View style={[stijlen.scheiding, { borderTopColor: colors.rand }]}>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{resultaat.detail}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[Type.caption, stijlen.toelichting, { color: colors.tekstGedimd }]}>
        {resultaat.toelichting}
      </Text>
    </>
  );
}

const stijlen = StyleSheet.create({
  achtergrond: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  kaart: {
    width: '100%',
    maxWidth: 342,
    borderRadius: radii.kaart,
    padding: spacing.lg,
  },
  schijf: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titel: { marginTop: spacing.md },
  tekst: { marginTop: spacing.sm },
  resultaatBlok: {
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: radii.veld,
  },
  letOpBlok: { borderWidth: 1 },
  bedrag: { marginTop: 4 },
  bedragRij: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: 4,
  },
  scheiding: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toelichting: { marginTop: spacing.sm },
  detailBlok: {
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: radii.veld,
  },
  detailScroll: { maxHeight: 160 },
  knoppen: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  // Onder elkaar en niet naast elkaar: labels als "Koppeling verwijderen" breken naast een
  // "Annuleren" af op een kaart van 342px.
  knop: {
    height: 48,
    borderRadius: radii.knop,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  knopLabel: { fontWeight: '600' },
});
