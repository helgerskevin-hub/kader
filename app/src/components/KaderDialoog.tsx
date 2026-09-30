// De gecentreerde dialoog van Kader, de vervanger van Alert.alert.
//
// Gecentreerd en niet als bottom sheet: dit is een stop-en-beslis-moment, geen paneel dat je opzij
// schuift. De onderrand van het scherm is in Kader al van de sheets, en een sheet boven op een sheet
// leest als een stapel.
//
// Wordt alleen door DialoogProvider gemount. Roep hem nergens anders aan, anders komt de Modal weer
// op meerdere plekken tegelijk te staan.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import Animated, {
  ReduceMotion, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { AlertTriangle, Check, CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { fmtPct, fmtResultaatUsd } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, shadow, spacing } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { curve, duur, veer, vervaag } from '../theme/beweging';
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

// De kaart komt uit iets kleiner op en veert naar zijn maat, zoals een iOS-alert. Weg gaat hij
// sneller en minder ver: er is besloten, daar hoeft niemand nog naar te kijken.
const SCHAAL_IN = 0.94;
const SCHAAL_UIT = 0.97;

// Beginsnelheid van de schijf bij een geslaagde actie. Vanuit rust op 1 geeft dat met veer.speels
// één zachte uitslag tot ongeveer 1,06 en terug: dezelfde puls als de vroegere twee stappen van
// 130ms, maar als één doorlopende beweging.
const PULS_SNELHEID = 2.2;

interface Props {
  inhoud: DialoogInhoud | null;
  zichtbaar: boolean;
  onSluiten: () => void;
}

export function KaderDialoog({ inhoud, zichtbaar, onSluiten }: Props) {
  const { colors, donkerActief } = useTheme();
  const reduceMotion = useReduceMotion();

  // De Modal blijft staan tot de kaart weg is; zichtbaar zegt alleen welke kant het op gaat.
  const [modalOpen, setModalOpen] = useState(false);
  const zichtbaarRef = useRef(zichtbaar);
  zichtbaarRef.current = zichtbaar;
  const achtergrondDekking = useSharedValue(0);
  const kaartDekking = useSharedValue(0);
  const kaartSchaal = useSharedValue(SCHAAL_IN);
  const schijfSchaal = useSharedValue(1);

  const resultaat = inhoud?.resultaat;
  const verliesGetoond = resultaat !== undefined && resultaat.soort === 'bedrag' && resultaat.bedragUsd < 0;
  // Je feliciteert niemand met een verlies, dus de puls slaat over zodra het bedrag negatief is.
  const pulseren = zichtbaar && inhoud?.variant === 'gelukt' && !verliesGetoond && !reduceMotion;

  // Pas als de kaart helemaal weg is gaat de Modal dicht, en dan zetten we de beginstand voor de
  // volgende keer klaar terwijl er toch niets in beeld is.
  const verberg = useCallback(() => {
    if (zichtbaarRef.current) return;
    kaartSchaal.value = SCHAAL_IN;
    kaartDekking.value = 0;
    achtergrondDekking.value = 0;
    setModalOpen(false);
  }, [kaartSchaal, kaartDekking, achtergrondDekking]);

  const open = zichtbaar && inhoud !== null;
  const modalOpenRef = useRef(modalOpen);
  modalOpenRef.current = modalOpen;

  useEffect(() => {
    if (open) {
      setModalOpen(true);
      // Onder Minder beweging alleen de fades, geen schaal. Komt hij terug terwijl hij nog aan het
      // wegfaden was, dan gaat alles vanaf de huidige stand weer terug.
      kaartSchaal.value = reduceMotion ? 1 : withSpring(1, veer.standaard);
      kaartDekking.value = vervaag(1, duur.kort);
      achtergrondDekking.value = vervaag(1, duur.midden);
      return;
    }
    if (!modalOpenRef.current) return;
    if (!reduceMotion) {
      kaartSchaal.value = withTiming(SCHAAL_UIT, {
        duration: duur.kort, easing: curve.weg, reduceMotion: ReduceMotion.Never,
      });
    }
    achtergrondDekking.value = vervaag(0, duur.kort);
    kaartDekking.value = vervaag(0, duur.kort, afgerond => {
      'worklet';
      if (afgerond) scheduleOnRN(verberg);
    });
    // Alleen op open en dicht reageren. Een omschakeling van Minder beweging halverwege is geen
    // reden om een binnenkomst of vertrek opnieuw te starten.
  }, [open]);

  useEffect(() => {
    cancelAnimation(schijfSchaal);
    schijfSchaal.value = 1;
    if (!pulseren) return;
    // Even wachten tot de kaart grotendeels staat, anders gaat de puls op in de binnenkomst.
    schijfSchaal.value = withDelay(80, withSpring(1, { ...veer.speels, velocity: PULS_SNELHEID }));
  }, [pulseren, schijfSchaal]);

  const achtergrondStijl = useAnimatedStyle(() => ({ opacity: achtergrondDekking.value }));
  const kaartStijl = useAnimatedStyle(() => ({
    opacity: kaartDekking.value,
    transform: [{ scale: kaartSchaal.value }],
  }));
  const schijfStijl = useAnimatedStyle(() => ({ transform: [{ scale: schijfSchaal.value }] }));

  const knoppen = inhoud?.knoppen ?? [];
  const enkeleKnop = knoppen.length <= 1;
  // Alleen een knop die zichzelf secundair noemt telt als "afbreken". De terugval op de laatste
  // knop is eruit: bij twee knoppen die allebei iets doen (Oké naast Naar portfolio) voerde de
  // Android-terugknop daarmee de laatste actie uit in plaats van de dialoog weg te halen.
  const secundaireKnop = knoppen.find(k => k.soort === 'secundair');

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
    if (!enkeleKnop && secundaireKnop !== undefined) druk(secundaireKnop);
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
  // Het grote rondje bij een orderuitkomst: groen bij gelukt, oranje als we het niet weten. Altijd
  // 14 procent dekking, zoals in het ontwerp.
  const rondje = inhoud?.rondje;
  const rondjeKleur = rondje === 'gelukt' ? colors.winst : colors.letOp;

  const detailRegels = inhoud?.details ? inhoud.details.split('\n').length : 0;
  const detailScrollt = detailRegels > MAX_DETAILREGELS;

  return (
    <Modal
      visible={modalOpen && inhoud !== null}
      transparent
      animationType="none"
      onRequestClose={opTerugknop}
    >
      {/* Tijdens het wegfaden reageert niets meer: een tweede tik op dezelfde knop zou zijn actie
          anders nog een keer uitvoeren. */}
      <View style={stijlen.vlak} pointerEvents={zichtbaar ? 'auto' : 'none'}>
      {/* De dimlaag staat los van de kaart, zodat die twee elk hun eigen tempo hebben. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: donkerActief ? 'rgba(0,0,0,0.6)' : 'rgba(15,23,42,0.5)' },
          achtergrondStijl,
        ]}
        pointerEvents="none"
      />
      <Pressable
        style={stijlen.achtergrond}
        onPress={opAchtergrond}
        accessibilityLabel={enkeleKnop ? 'Sluiten' : undefined}
      >
        {inhoud !== null ? (
          <Animated.View style={[stijlen.kaartHouder, kaartStijl]}>
          <Pressable
            style={[stijlen.kaart, shadow.modal, { backgroundColor: colors.kaart }]}
            onPress={() => {}}
            accessibilityViewIsModal
          >
            {rondje !== undefined ? (
              <Animated.View
                style={[
                  stijlen.rondje,
                  { backgroundColor: rondjeKleur + '24' },
                  schijfStijl,
                ]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {rondje === 'gelukt'
                  ? <Check size={30} color={rondjeKleur} strokeWidth={2.5} />
                  : <AlertTriangle size={28} color={rondjeKleur} strokeWidth={2.25} />}
              </Animated.View>
            ) : (
              <Animated.View
                style={[
                  stijlen.schijf,
                  { backgroundColor: schijfVulling },
                  schijfStijl,
                ]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Icoon size={20} color={variantKleur} strokeWidth={1.75} />
              </Animated.View>
            )}

            <Text
              style={[Type.titel, stijlen.titel, rondje !== undefined && stijlen.midden, { color: colors.tekstPrimair }]}
              accessibilityRole="header"
            >
              {inhoud.titel}
            </Text>
            <Text style={[Type.body, stijlen.tekst, rondje !== undefined && stijlen.midden, { color: colors.tekstGedimd }]}>
              {inhoud.tekst}
            </Text>

            {resultaat !== undefined ? (
              <ResultaatBlok resultaat={resultaat} alsBand={rondje !== undefined} />
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
                // 'omlijnd' houdt het vlak van de kaart (wit in licht thema) en zet de CTA-kleur in
                // de rand en de tekst. Zo staat hij als gelijkwaardige tweede keuze naast de
                // primaire knop zonder er twee gevulde blauwe blokken van te maken.
                const vulling = soort === 'primair' ? colors.cta
                  : soort === 'destructief' ? DESTRUCTIEF
                    : soort === 'omlijnd' ? colors.kaart
                      : 'transparent';
                const tekstKleur = soort === 'secundair' ? colors.tekstGedimd
                  : soort === 'omlijnd' ? colors.cta
                    : '#FFFFFF';
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
                      soort === 'omlijnd' && { borderWidth: 1.5, borderColor: colors.cta },
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
          </Animated.View>
        ) : null}
      </Pressable>
      </View>
    </Modal>
  );
}

// Het blok tussen de tekst en de knoppen. Zit apart zodat de drie vormen naast elkaar leesbaar zijn.
// alsBand: bij een orderuitkomst met rondje staat de waarschuwing als gevulde band met icoon.
function ResultaatBlok({ resultaat, alsBand }: { resultaat: NonNullable<DialoogInhoud['resultaat']>; alsBand: boolean }) {
  const { colors } = useTheme();

  if (resultaat.soort === 'waarschuwing' && alsBand) {
    return (
      <View style={[stijlen.band, { backgroundColor: colors.letOp + '1A' }]}>
        <AlertTriangle size={16} color={colors.letOp} strokeWidth={1.75} />
        <Text style={[stijlen.bandTekst, { color: colors.letOp }]}>{resultaat.tekst}</Text>
      </View>
    );
  }

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
  vlak: { flex: 1 },
  achtergrond: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  kaartHouder: {
    width: '100%',
    maxWidth: 342,
  },
  kaart: {
    width: '100%',
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
  rondje: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  midden: { textAlign: 'center' },
  band: {
    marginTop: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  bandTekst: {
    flexShrink: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
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
