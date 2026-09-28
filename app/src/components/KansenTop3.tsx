import React, { memo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { fmtPrijs } from '../engine/format';
import { KansMetRang } from '../state/KansenProvider';
import { useValutaStand } from '../state/useValuta';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { AdviceBadge } from './AdviceBadge';
import { Drukbaar } from './Drukbaar';
import { Sparkline } from './Sparkline';
import { RangLabel } from './KansKaart';
import { afstandLabel } from './MomentumBalken';

interface Props {
  // De kaarten die in de carrousel komen, al gesorteerd op momentum. Het scherm kiest er drie.
  kansen: KansMetRang[];
  onOpenDetail: (kans: KansMetRang) => void;
}

// Een kaart is breed genoeg voor symbool, prijs en sparkline, en smal genoeg dat de volgende
// zichtbaar aanstaat: zo is te zien dat er meer is.
const BREEDTE_FACTOR = 0.72;

// Patroon van WatKopenNu: horizontale ScrollView met snapToInterval op de werkelijke kaartstap.
// pagingEnabled zou op veelvouden van de schermbreedte klikken en de kaarten uit de maat trekken.
export function KansenTop3({ kansen, onOpenDetail }: Props) {
  const { width } = useWindowDimensions();
  const [actief, setActief] = useState(0);
  // De laatst gemelde pagina, zodat een scroll-event met dezelfde pagina geen setState doet.
  const laatste = useRef(0);
  const { colors } = useTheme();

  const kaartBreedte = Math.round((width - spacing.base * 2) * BREEDTE_FACTOR + spacing.base);
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
      <Text style={[Type.overline, styles.kop, { color: colors.tekstGedimd }]}>
        TOP {kansen.length} OP MOMENTUM
      </Text>
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
        {kansen.map((kans, i) => (
          <MiniKaart
            key={kans.symbool}
            kans={kans}
            volgorde={i}
            breedte={kaartBreedte}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </ScrollView>
      <View
        style={styles.puntenRij}
        accessibilityRole="adjustable"
        accessibilityLabel={`Kans ${actief + 1} van ${kansen.length}`}
      >
        {kansen.map((kans, i) => (
          <View
            key={kans.symbool}
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

const MiniKaart = memo(function MiniKaart({ kans, volgorde, breedte, onOpenDetail }: {
  kans: KansMetRang;
  volgorde: number;
  breedte: number;
  onOpenDetail: (kans: KansMetRang) => void;
}) {
  useValutaStand();
  const { colors } = useTheme();
  const afstand = kans.ingredienten.afstandHigh90d;

  return (
    <Drukbaar
      onPress={() => onOpenDetail(kans)}
      bron={{ kleur: colors.kaart, radius: radii.kaart }}
      style={[styles.kaart, shadow.kaart, { width: breedte, backgroundColor: colors.kaart }]}
      accessibilityRole="button"
      accessibilityLabel={`Bekijk ${kans.symbool}, momentumscore ${Math.round(kans.momentumScore)}`}
    >
      <View style={styles.kaartKop}>
        <AdviceBadge advies={kans.signaal} score={kans.momentumScore} />
        <RangLabel verschil={kans.rangVerschil} />
      </View>
      <View style={styles.rij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{kans.symbool}</Text>
        <Text style={[Type.caption, styles.naam, { color: colors.tekstGedimd }]} numberOfLines={1}>
          {kans.naam}
        </Text>
      </View>
      <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtPrijs(kans.prijs)}</Text>
      <Sparkline reeks={kans.sparkline} hoogte={32} volgorde={volgorde} />
      {afstand !== null && (
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{afstandLabel(afstand)}</Text>
      )}
    </Drukbaar>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.sm },
  kop: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm },
  spoor: { paddingHorizontal: spacing.base, paddingBottom: spacing.xs, gap: spacing.sm },
  kaart: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.sm,
  },
  kaartKop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rij: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  naam: { flex: 1 },
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
