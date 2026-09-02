import React, { useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { infoVoor } from '../engine/coinInfo';
import { fmtPrijs } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useValutaStand } from '../state/useValuta';

interface Props {
  trades: Trade[];
  onOpenDetail: (trade: Trade) => void;
}

// Hoeveel kandidaten er maximaal in de carrousel komen. Meer dan dit swipen is geen overzicht meer,
// en de lijst eronder toont ze toch allemaal.
const MAX_KAARTEN = 5;

export function WatKopenNu({ trades, onOpenDetail }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [actief, setActief] = useState(0);
  // De laatst gemelde pagina, zodat een scroll-event dat dezelfde pagina oplevert geen setState doet.
  const laatste = useRef(0);

  // Alleen high conviction: gemeten +0,16 R gemiddeld, de sterkste bucket uit de backtest.
  // Een lagere score kan hier ook nog KOOP zijn, maar is niet sterk genoeg voor dit uitgelichte advies.
  const kandidaten = [...trades]
    .filter(t => t.signaal === 'KOOP' && t.highConviction)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_KAARTEN);

  if (kandidaten.length === 0) {
    return (
      <View style={[styles.wrapper, styles.leeg, { backgroundColor: colors.kaart }]}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>WAT MOET IK NU KOPEN?</Text>
        <Text style={[Type.body, { color: colors.tekstGedimd }]}>
          Nu geen duidelijke koopkans. Wacht op een sterker signaal.
        </Text>
      </View>
    );
  }

  // Eén kandidaat: dan is er niets te swipen en hoeft er ook geen puntenrij onder te staan.
  if (kandidaten.length === 1) {
    return (
      <View style={styles.wrapper}>
        <Kaart trade={kandidaten[0]} onOpenDetail={onOpenDetail} breedte={width - spacing.base * 2} />
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
        {kandidaten.map(trade => (
          <Kaart
            key={trade.symbool}
            trade={trade}
            onOpenDetail={onOpenDetail}
            breedte={kaartBreedte}
          />
        ))}
      </ScrollView>

      {/* De puntjes zeggen twee dingen tegelijk: er zijn er meer, en je bent bij de zoveelste. */}
      <View
        style={styles.puntenRij}
        accessibilityRole="adjustable"
        accessibilityLabel={`Koopkans ${actief + 1} van ${kandidaten.length}`}
      >
        {kandidaten.map((trade, i) => (
          <View
            key={trade.symbool}
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

function Kaart({ trade, onOpenDetail, breedte }: {
  trade: Trade;
  onOpenDetail: (trade: Trade) => void;
  breedte: number;
}) {
  const naam = infoVoor(trade.symbool).naam;
  const reden = trade.redenen[0] ?? `sterk signaal (score ${Math.round(trade.score)})`;
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => onOpenDetail(trade)}
      style={[styles.kaart, { width: breedte, backgroundColor: colors.primair }]}
      accessibilityRole="button"
      accessibilityLabel={`Bekijk ${trade.symbool}, aanbevolen koopkans: ${reden}`}
    >
      <Text style={[Type.overline, styles.kopWit]}>WAT MOET IK NU KOPEN?</Text>
      <View style={styles.rij}>
        <Text style={[Type.titel, styles.symbool]}>{trade.symbool}</Text>
        <Text style={[Type.caption, styles.naam]} numberOfLines={1}>{naam}</Text>
        <Text style={[Type.prijs, styles.prijs]}>{fmtPrijs(trade.prijs)}</Text>
      </View>
      <Text style={[Type.body, styles.reden]} numberOfLines={2}>{reden}</Text>
      <View style={styles.hintRij}>
        <Text style={[Type.caption, styles.hintTekst]}>Tik voor meer info</Text>
        <ChevronRight size={13} color="rgba(255,255,255,0.75)" strokeWidth={2} />
      </View>
    </Pressable>
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
