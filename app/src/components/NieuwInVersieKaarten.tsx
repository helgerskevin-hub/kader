import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type AccessibilityActionEvent,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../theme/useReduceMotion';
import { haptiek } from '../theme/haptiek';
import { Fonts, Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { PilKnop } from './PilKnop';
import { InfoVisualisatie } from './informatie/InfoVisualisatie';
import type { ChangelogEntry } from '../changelog';

type Hoogtepunt = NonNullable<ChangelogEntry['hoogtepunten']>[number];

interface Props {
  titel: string;
  hoogtepunten: Hoogtepunt[];
  onSluiten: () => void;
  onAlles: () => void;
}

// Ruimte tussen twee kaarten tijdens het vegen, zodat ze niet tegen elkaar aan schuiven.
const TUSSENRUIMTE = spacing.base;

// Het vel mag 80% van het scherm vullen (velStijl in ChangelogSheet). Op 360 dp met systeemletter
// 1,3 is een kaart met de langste animatie hoger dan wat er overblijft naast de kop en de knoppen.
// Dan scrollt de kaartstrook verticaal, binnen een uitgerekende hoogte: kop en knoppen blijven
// staan. Zonder eigen maxHeight zou de ScrollView niet krimpen (zie ChangelogSheet).
const VEL_DEEL_VAN_SCHERM = 0.8;
const STROOK_MINIMUM = 200;

// De "nieuw in deze versie"-melding als veegbare kaarten: per hoogtepunt de animatie uit Informatie,
// een titel en één zin. Patroon van KansenTop3: horizontale ScrollView met snapToInterval op de
// werkelijke kaartstap, puntjes eronder. Een kaart speelt zijn animatie af zodra hij in beeld komt;
// daarvoor staat de eindstand er stil, zodat de hoogte van het vel niet verspringt.
export function NieuwInVersieKaarten({ titel, hoogtepunten, onSluiten, onAlles }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const scrollRef = useRef<ScrollView>(null);
  const strookRef = useRef<ScrollView>(null);
  const { height: schermHoogte, width: schermBreedte } = useWindowDimensions();
  // Schatting tot onLayout de echte breedte geeft, zodat het vel niet in een frame groeit.
  const [breedte, setBreedte] = useState(Math.max(0, schermBreedte - 2 * spacing.base));
  const insets = useSafeAreaInsets();
  const [kopHoogte, setKopHoogte] = useState(0);
  const [voetHoogte, setVoetHoogte] = useState(0);
  // Padding van het vel: boven spacing.base, onder minstens spacing.xl of de gesturebalk.
  const velPadding = spacing.base + Math.max(spacing.xl, insets.bottom);
  const strookHoogte = Math.max(
    STROOK_MINIMUM,
    schermHoogte * VEL_DEEL_VAN_SCHERM - velPadding - kopHoogte - voetHoogte,
  );
  const [actief, setActief] = useState(0);
  const laatste = useRef(0);
  // Per kaart een teller: 0 = nog niet in beeld geweest, elke verhoging speelt de animatie af.
  const [sleutels, setSleutels] = useState<number[]>(() => hoogtepunten.map((_, i) => (i === 0 ? 1 : 0)));

  const aantal = hoogtepunten.length;
  const stap = breedte + TUSSENRUIMTE;
  const isLaatste = actief === aantal - 1;

  const opPagina = useCallback((pagina: number) => {
    if (pagina === laatste.current || pagina < 0 || pagina >= aantal) return;
    laatste.current = pagina;
    setActief(pagina);
    setSleutels(s => s.map((w, i) => (i === pagina ? w + 1 : w)));
    haptiek('tik');
    strookRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
  }, [aantal, reduceMotion]);

  const paginaBij = (x: number) => Math.min(aantal - 1, Math.max(0, Math.round(x / stap)));

  // Tijdens het vegen alleen de puntjes bijwerken; afspelen en haptiek pas als de pagina vaststaat.
  function opScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (stap <= TUSSENRUIMTE) return;
    setActief(paginaBij(e.nativeEvent.contentOffset.x));
  }

  function opScrollEinde(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (stap <= TUSSENRUIMTE) return;
    opPagina(paginaBij(e.nativeEvent.contentOffset.x));
  }

  // Een sleep zonder momentum eindigt zonder momentum-event; alleen als hij al op een pagina staat.
  function opSleepEinde(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (stap <= TUSSENRUIMTE) return;
    const x = e.nativeEvent.contentOffset.x;
    if (Math.abs(x - paginaBij(x) * stap) < 1) opPagina(paginaBij(x));
  }

  // Bij een breedtewissel (draaien, vensterformaat) opnieuw vastklikken op de huidige pagina.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: laatste.current * stap, animated: false });
  }, [stap]);

  function naar(pagina: number) {
    if (pagina < 0 || pagina >= aantal) return;
    scrollRef.current?.scrollTo({ x: pagina * stap, animated: !reduceMotion });
    // Geanimeerd zet onMomentumScrollEnd de pagina; zonder animatie komt dat event niet.
    if (reduceMotion) opPagina(pagina);
  }

  function opToegankelijkheid(e: AccessibilityActionEvent) {
    if (e.nativeEvent.actionName === 'increment') naar(actief + 1);
    if (e.nativeEvent.actionName === 'decrement') naar(actief - 1);
  }

  return (
    <View>
      <View style={styles.kopRij} onLayout={(e: LayoutChangeEvent) => setKopHoogte(e.nativeEvent.layout.height + spacing.base)}>
        <View style={styles.kopTekst}>
          <Text style={[Type.overline, { color: colors.cta }]}>NIEUW IN KADER</Text>
          <Text accessibilityRole="header" style={[styles.titel, { color: colors.tekstPrimair }]}>{titel}</Text>
        </View>
        <Pressable
          onPress={onSluiten}
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
          hitSlop={4}
          style={styles.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView
        ref={strookRef}
        style={{ maxHeight: strookHoogte }}
        showsVerticalScrollIndicator
        nestedScrollEnabled
        onLayout={(e: LayoutChangeEvent) => setBreedte(e.nativeEvent.layout.width)}
      >
        {breedte > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            snapToInterval={stap}
            snapToAlignment="start"
            disableIntervalMomentum
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={opScroll}
            onMomentumScrollEnd={opScrollEinde}
            onScrollEndDrag={opSleepEinde}
            scrollEventThrottle={16}
            contentContainerStyle={styles.spoor}
          >
            {hoogtepunten.map((h, i) => (
              <View
                key={h.titel}
                style={[styles.kaart, { width: breedte }]}
                // Kaarten buiten beeld niet voorlezen; de puntjes zeggen waar je bent.
                importantForAccessibility={i === actief ? 'auto' : 'no-hide-descendants'}
                accessibilityElementsHidden={i !== actief}
              >
                {/* Titel en zin eerst: op een klein scherm met grote letters scrollt de strook, en dan
                    moet de boodschap in beeld staan, niet de onderkant van de animatie. */}
                <Text accessibilityRole="header" style={[Type.titel, { color: colors.tekstPrimair }]}>
                  {h.titel}
                </Text>
                <Text style={[Type.body, { color: colors.tekstGedimd }]}>{h.tekst}</Text>
                {h.vis ? (
                  <View style={styles.vis}>
                    <InfoVisualisatie id={h.vis} speelSignaal={sleutels[i]} />
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </ScrollView>

      <View onLayout={(e: LayoutChangeEvent) => setVoetHoogte(e.nativeEvent.layout.height)}>
        <View
          style={styles.puntenRij}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Hoogtepunten"
          accessibilityValue={{ text: `Kaart ${actief + 1} van ${aantal}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={opToegankelijkheid}
        >
          {hoogtepunten.map((h, i) => (
            <View
              key={h.titel}
              style={[
                styles.punt,
                { backgroundColor: i === actief ? colors.primair : colors.rand },
                i === actief && styles.puntActief,
              ]}
            />
          ))}
        </View>

        <PilKnop
          label={isLaatste ? 'Begrepen' : 'Volgende'}
          variant="cta"
          onPress={isLaatste ? onSluiten : () => naar(actief + 1)}
          accessibilityLabel={isLaatste ? 'Begrepen, sluiten' : `Volgende, kaart ${actief + 2} van ${aantal}`}
        />
        {/* Altijd aanwezig zodat het vel niet verspringt; alleen op de laatste kaart zichtbaar en
            aantikbaar. */}
        <View
          style={[styles.linkRij, !isLaatste && styles.verborgen]}
          pointerEvents={isLaatste ? 'auto' : 'none'}
          importantForAccessibility={isLaatste ? 'auto' : 'no-hide-descendants'}
          accessibilityElementsHidden={!isLaatste}
        >
          <PilKnop label="Alle wijzigingen" variant="link" onPress={onAlles} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kopRij: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.base },
  kopTekst: { flex: 1, minWidth: 0 },
  titel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 2 },
  spoor: { gap: TUSSENRUIMTE },
  kaart: { gap: spacing.sm },
  vis: { marginTop: spacing.sm },
  puntenRij: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
    marginVertical: spacing.sm,
  },
  punt: { width: 6, height: 6, borderRadius: 3 },
  puntActief: { width: 18 },
  linkRij: { alignItems: 'center', marginTop: spacing.xs },
  verborgen: { opacity: 0 },
});
