import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ChevronRight } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { infoVoor } from '../engine/coinInfo';
import { fmtPrijs } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { Drukbaar } from './Drukbaar';
import { useValutaStand } from '../state/useValuta';
import { useNaloopBoek } from '../state/naloopBoek';
import { latStatus, NALOOP_PLEKKEN, type NaloopPositie } from '../engine/naloopRustig';

interface Props {
  trades: Trade[];
  klimaatOpen: boolean;
  onOpenDetail: (trade: Trade) => void;
}

const fmtDag = (ms: number) => new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

// Het Kader-mandje: het enige koopadvies in Kader (docs/mandje-lat.md). Wat hier staat is wat de
// papieren naloop van regel C (engine/naloopRustig.ts) nu vasthoudt: bij open klimaat de 5
// rustigste coins, geen doel, een stop die meeschuift. Zo is het advies precies wat de lat meet.
export function WatKopenNu({ trades, klimaatOpen, onOpenDetail }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [actief, setActief] = useState(0);
  // De laatst gemelde pagina, zodat een scroll-event dat dezelfde pagina oplevert geen setState doet.
  const laatste = useRef(0);
  const strookGebaar = useMemo(() => Gesture.Native().disallowInterruption(true), []);

  const boek = useNaloopBoek(true);
  if (!boek) return null;
  const lat = latStatus(boek, Date.now());
  const perSymbool = new Map(trades.map(t => [t.symbool, t]));
  const kandidaten = boek.posities
    .filter(p => p.uitkomst === 'open')
    .sort((a, b) => a.tijd - b.tijd)
    .map(p => ({ p, trade: perSymbool.get(p.symbool) }));

  if (!lat.actief || kandidaten.length === 0) {
    const tekst = !lat.actief
      ? `Het mandje staat uit: ${lat.reden}. Kader volgt het op papier verder, maar geeft er geen koopadvies meer uit tot een nieuwe meting het bewijst.`
      : klimaatOpen
        ? 'Het mandje vult zich bij de volgende scan met de rustigste coins.'
        : 'Het klimaat is niet gunstig, dus het mandje koopt nu niets. Wachten is hier het advies.';
    return (
      <View style={[styles.wrapper, styles.leeg, { backgroundColor: colors.kaart }]}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>KADER-MANDJE</Text>
        <Text style={[Type.body, { color: colors.tekstPrimair }]}>{tekst}</Text>
      </View>
    );
  }

  // Eén kandidaat: dan is er niets te swipen en hoeft er ook geen puntenrij onder te staan. De
  // kaart zelf krijgt hier dezelfde marges als in de carrousel: die zit in een ScrollView met
  // paddingHorizontal, hier moet de wrapper die marge zelf leveren, anders plakt de kaart links
  // tegen de rand terwijl hij wel op de breedte van de carrousel-kaart is berekend.
  if (kandidaten.length === 1) {
    return (
      <View style={[styles.wrapper, styles.enkele]}>
        <Kaart p={kandidaten[0].p} trade={kandidaten[0].trade} plek={1} onOpenDetail={onOpenDetail} breedte={width - spacing.base * 2} />
      </View>
    );
  }

  // Een kaart is zo breed als het scherm min de zijmarges. pagingEnabled zou hier niet werken: dat
  // klikt op veelvouden van de SCHERMbreedte, en dan loopt elke volgende kaart de marge plus de tussen-
  // ruimte uit beeld. snapToInterval klikt op de werkelijke kaartstap.
  const kaartBreedte = width - spacing.base * 2;
  const stap = kaartBreedte + spacing.sm;

  function opScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const pagina = Math.round(e.nativeEvent.contentOffset.x / stap);
    if (pagina !== laatste.current) {
      laatste.current = pagina;
      setActief(pagina);
    }
  }

  return (
    <View style={styles.wrapper}>
      {/* De strook is een RNGH-gebaar dat niet te onderbreken is: zonder dit wint de tab-pager in
          App.tsx bij een snelle veeg en schiet je naar de buurtab in plaats van naar de volgende kaart. */}
      <GestureDetector gesture={strookGebaar}>
        <ScrollView
          horizontal
          snapToInterval={stap}
          snapToAlignment="start"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          onScroll={opScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          contentContainerStyle={styles.spoor}
        >
          {kandidaten.map(({ p, trade }, i) => (
            <Kaart
              key={p.id}
              p={p}
              trade={trade}
              plek={i + 1}
              onOpenDetail={onOpenDetail}
              breedte={kaartBreedte}
            />
          ))}
        </ScrollView>
      </GestureDetector>

      {/* De puntjes zeggen twee dingen tegelijk: er zijn er meer, en je bent bij de zoveelste. */}
      <View
        style={styles.puntenRij}
        accessibilityRole="adjustable"
        accessibilityLabel={`Mandje-coin ${actief + 1} van ${kandidaten.length}`}
      >
        {kandidaten.map(({ p }, i) => (
          <View
            key={p.id}
            style={[
              styles.punt,
              { backgroundColor: i === actief ? colors.primair : colors.rand },
              i === actief && styles.puntActief,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function Kaart({ p, trade, plek, onOpenDetail, breedte }: {
  p: NaloopPositie;
  trade: Trade | undefined;
  plek: number;
  onOpenDetail: (trade: Trade) => void;
  breedte: number;
}) {
  const naam = infoVoor(p.symbool).naam;
  const { colors } = useTheme();
  const prijs = trade?.prijs;
  const tekst = `Stop ${fmtPrijs(p.stop)}, schuift elke dag mee naar het laagste punt van 20 dagen. Geen doel.`;

  return (
    <Drukbaar
      onPress={() => trade && onOpenDetail(trade)}
      disabled={!trade}
      bron={{ kleur: colors.primair, radius: radii.kaart }}
      style={[styles.kaart, { width: breedte, backgroundColor: colors.primair }]}
      accessibilityRole="button"
      accessibilityLabel={`Kader-mandje, plek ${plek} van ${NALOOP_PLEKKEN}: ${p.symbool}. ${tekst}`}
    >
      <Text style={[Type.overline, styles.kopWit]}>KADER-MANDJE · {plek} VAN {NALOOP_PLEKKEN}</Text>
      <View style={styles.rij}>
        <Text style={[Type.titel, styles.symbool]}>{p.symbool}</Text>
        <Text style={[Type.caption, styles.naam]} numberOfLines={1}>{naam}</Text>
        {prijs !== undefined && <Text style={[Type.prijs, styles.prijs]}>{fmtPrijs(prijs)}</Text>}
      </View>
      <Text style={[Type.body, styles.reden]} numberOfLines={3}>{tekst}</Text>
      <View style={styles.hintRij}>
        <Text style={[Type.caption, styles.hintTekst]}>In het mandje sinds {fmtDag(p.tijd)}</Text>
        {trade && <ChevronRight size={13} color="rgba(255,255,255,0.75)" strokeWidth={2} />}
      </View>
    </Drukbaar>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  // De lege staat is geen kaart in een carrousel, dus die houdt zijn eigen marges en padding.
  leeg: {
    marginHorizontal: spacing.base,
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.sm,
  },
  // Zelfde marge als de carrousel z'n ScrollView-padding, voor de kaart bij precies één kandidaat.
  enkele: {
    marginHorizontal: spacing.base,
  },
  spoor: { paddingHorizontal: spacing.base, gap: spacing.sm },
  kaart: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.sm,
  },
  kopWit: { color: 'rgba(255,255,255,0.85)' },
  rij: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  symbool: { color: 'white' },
  naam: { color: 'rgba(255,255,255,0.75)', flex: 1 },
  prijs: { color: 'white' },
  reden: { color: 'rgba(255,255,255,0.92)', minHeight: 44 },
  hintRij: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 2,
  },
  hintTekst: {
    color: 'rgba(255,255,255,0.75)',
  },
  puntenRij: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.sm,
  },
  punt: { width: 6, height: 6, borderRadius: 3 },
  puntActief: { width: 18 },
});
