import React, { memo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { fmtPrijs } from '../engine/format';
import { StopLossLimiet } from '../engine/etoroLimieten';
import { effectiefSignaal } from '../engine/opportunities';
import { limietVoor } from '../state/useStopLossLimiet';
import { KansMetRang } from '../state/KansenProvider';
import { useValutaStand } from '../state/useValuta';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { AdviceBadge } from './AdviceBadge';
import { Drukbaar } from './Drukbaar';
import { KaderLogo } from './KaderLogo';
import { ScoreRing } from './ScoreRing';
import { Sparkline } from './Sparkline';
import { RangLabel } from './KansKaart';
import { afstandLabel } from './MomentumBalken';

interface Props {
  // De kaarten die in de carrousel komen, al gesorteerd op momentum. Het scherm kiest er drie.
  kansen: KansMetRang[];
  onOpenDetail: (kans: KansMetRang) => void;
  // De stop-loss-grenzen van eToro, zodat de badge hier hetzelfde signaal toont als de kaart eronder
  // (zie effectiefSignaal in opportunities.ts).
  stopLimieten: Record<string, StopLossLimiet> | null;
}

// Een kaart is breed genoeg voor symbool, prijs en sparkline, en smal genoeg dat de volgende
// zichtbaar aanstaat: zo is te zien dat er meer is.
const BREEDTE_FACTOR = 0.72;

// Patroon van WatKopenNu: horizontale ScrollView met snapToInterval op de werkelijke kaartstap.
// pagingEnabled zou op veelvouden van de schermbreedte klikken en de kaarten uit de maat trekken.
export function KansenTop3({ kansen, onOpenDetail, stopLimieten }: Props) {
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
      <View style={styles.kop}>
        <KaderLogo size={22} variant="outline" />
        <View>
          <Text style={[Type.sectiekop, styles.kopTitel, { color: colors.tekstPrimair }]}>In het kader</Text>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
            {kansen.length >= 3
              ? 'De drie sterkste op de radar'
              : kansen.length === 2
                ? 'De twee sterkste op de radar'
                : 'De sterkste op de radar'}
          </Text>
        </View>
      </View>
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
            signaal={effectiefSignaal(kans, limietVoor(stopLimieten, kans.symbool)).signaal}
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

const MiniKaart = memo(function MiniKaart({ kans, signaal, volgorde, breedte, onOpenDetail }: {
  kans: KansMetRang;
  signaal: 'KOOP' | 'WATCH';
  volgorde: number;
  breedte: number;
  onOpenDetail: (kans: KansMetRang) => void;
}) {
  useValutaStand();
  const { colors } = useTheme();
  const afstand = kans.ingredienten.afstandHigh90d;
  const nieuw = kans.rangVerschil === 'nieuw';

  // Tik opent hier het detailscherm, anders dan de kaarten eronder: de carrousel klapt niet uit,
  // want een kaart die in een horizontale strook groeit duwt de hele lijst eronder weg.
  return (
    <Drukbaar
      onPress={() => onOpenDetail(kans)}
      bron={{ kleur: colors.kaart, radius: radii.kaart }}
      style={[styles.kaart, shadow.kaart, { width: breedte, backgroundColor: colors.kaart }]}
      accessibilityRole="button"
      accessibilityLabel={`Bekijk ${kans.symbool}, momentumscore ${Math.round(kans.momentumScore)}`}
    >
      <View style={styles.kaartKop}>
        <ScoreRing symbool={kans.symbool} score={kans.momentumScore} maat={44} volgorde={volgorde} />
        <View style={styles.kopMidden}>
          <Text style={[Type.titel, styles.symbool, { color: colors.tekstPrimair }]}>{kans.symbool}</Text>
          {/* Twee regels is genoeg voor elke naam op de radar; zo kapt er nooit iets af. */}
          <Text style={[Type.caption, { color: colors.tekstGedimd }]} numberOfLines={2}>
            {kans.naam}
          </Text>
        </View>
        {/* NIEUW staat onderaan naast de badge; hier alleen een rangwissel. */}
        {!nieuw && <RangLabel verschil={kans.rangVerschil} />}
      </View>
      {/* Wrap: op 360 dp passen een lange prijs en "12,3% onder 90d-top" niet altijd naast
          elkaar in de smalle carrouselkaart. */}
      <View style={styles.prijsRij}>
        <Text style={[Type.prijsGroot, styles.prijs, { color: colors.tekstPrimair }]}>{fmtPrijs(kans.prijs)}</Text>
        {afstand !== null && (
          <View style={[styles.pil, { backgroundColor: colors.verhoogd }]}>
            <Text style={[Type.prijs, styles.pilTekst, { color: colors.tekstPrimair }]}>
              {afstandLabel(afstand)}
            </Text>
          </View>
        )}
      </View>
      {kans.sparkline.length >= 2 && (
        <Sparkline reeks={kans.sparkline} hoogte={44} vlak stip volgorde={volgorde} />
      )}
      <View style={styles.voet}>
        <AdviceBadge advies={signaal} score={kans.momentumScore} />
        {nieuw && <RangLabel verschil="nieuw" />}
      </View>
    </Drukbaar>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.sm },
  kop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  // Type.sectiekop is 16; de kop is bewust een tikje groter dan de sectiekoppen.
  kopTitel: { fontSize: 17 },
  spoor: { paddingHorizontal: spacing.base, paddingBottom: spacing.xs, gap: spacing.sm },
  kaart: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: 10,
  },
  kaartKop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  kopMidden: { flex: 1, minWidth: 0 },
  // Type.titel is 21 met regelhoogte 28; naast de ring van 44 is 26 strakker.
  symbool: { lineHeight: 26 },
  prijsRij: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    rowGap: spacing.xs,
    columnGap: spacing.sm,
  },
  // Type.prijsGroot is 21; hier staat de prijs op 17, zoals op de kaarten eronder.
  prijs: { fontSize: 17, lineHeight: 22 },
  pil: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  pilTekst: { fontSize: 11.5, lineHeight: 14 },
  voet: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
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
