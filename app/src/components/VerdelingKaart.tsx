import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { fmtBedrag } from '../engine/format';
import { aandeelTekst, berekenVerdeling, OVERIG_SLEUTEL, Segment, spreekAandeel } from '../engine/verdeling';
import { PortfolioTrade } from '../state/portfolioTypes';
import { useValutaStand } from '../state/useValuta';

// Een donut van losse <Circle>-elementen met strokeDasharray, en bewust geen <Path> met booghoeken.
// Een taartpunt als pad vraagt om largeArcFlag plus sinus en cosinus per segment, en dat is precies
// waar dit soort code stukgaat. Zo is de wiskunde één vermenigvuldiging per segment en klopt de
// tekening vanzelf bij één segment, bij zeven, en bij een segment van 0,4 procent.
const RING_MAAT = 150;
const MIDDEN = RING_MAAT / 2;
const STRAAL = 58;
const DIKTE = 22;
const OMTREK = 2 * Math.PI * STRAAL;   // 364.42
// De visuele naad tussen twee segmenten, in dezelfde eenheid als de omtrek.
const NAAD = 2;

interface Props {
  trades: PortfolioTrade[];
  livePrijzen: Record<string, number>;
  // Opent het volledige overzicht. De hele kaart is de knop, want alles erop gaat over hetzelfde
  // onderwerp; een losse knop binnen een aantikbare kaart zou twee raakvlakken over elkaar leggen.
  onOpenDetail: () => void;
}

export function VerdelingKaart({ trades, livePrijzen, onOpenDetail }: Props) {
  const { colors } = useTheme();
  // De formatters lezen de gekozen valuta uit een gewone module. Zonder dit abonnement blijft deze
  // kaart na het omzetten in de oude valuta staan.
  useValutaStand();

  const verdeling = useMemo(() => berekenVerdeling(trades, livePrijzen), [trades, livePrijzen]);
  const { segmenten, totaalUsd, gewaardeerd, zonderLivePrijs } = verdeling;

  const kleurVoor = (segment: Segment, index: number): string =>
    // Overig is altijd het neutrale grijs. Datzelfde grijs vangt ook het zevende eigen segment op:
    // de categorische reeks telt er zes, en bij precies zeven symbolen is er geen Overig, dus die
    // twee kunnen nooit tegelijk in beeld staan.
    segment.sleutel === OVERIG_SLEUTEL || index >= colors.verdeling.length
      ? colors.verdelingOverig
      : colors.verdeling[index];

  // Geen open posities: geen kaart. PortfolioScreen heeft daar zijn eigen lege staat voor.
  if (gewaardeerd + zonderLivePrijs === 0) return null;

  const overig = segmenten.find(s => s.sleutel === OVERIG_SLEUTEL);

  // Cumulatief aandeel vóór elk segment: dat is waar de streep begint.
  let gelopen = 0;
  const beginPunten = segmenten.map(s => {
    const begin = gelopen;
    gelopen += s.aandeel;
    return begin;
  });

  const ringLabel = 'Verdeling: ' + [
    ...segmenten
      .filter(s => s.sleutel !== OVERIG_SLEUTEL)
      .map(s => `${s.label} ${spreekAandeel(s.aandeel)}`),
    ...(overig ? [`en ${overig.leden?.length ?? 0} kleinere posities`] : []),
  ].join(', ') + '.';

  return (
    <Pressable
      onPress={onOpenDetail}
      accessibilityRole="button"
      accessibilityLabel="Verdeling in detail bekijken"
      accessibilityHint="Opent het volledige overzicht per coin en per platform."
      style={({ pressed }) => [
        styles.kaart,
        shadow.kaart,
        { backgroundColor: colors.kaart, opacity: pressed ? 0.96 : 1 },
      ]}
    >
      <View style={styles.kop}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>VERDELING VAN JE POSITIES</Text>
      </View>

      {gewaardeerd === 0 ? (
        <>
          <View style={styles.ringHouder}>
            <Svg width={RING_MAAT} height={RING_MAAT} viewBox={`0 0 ${RING_MAAT} ${RING_MAAT}`}>
              <Circle
                cx={MIDDEN}
                cy={MIDDEN}
                r={STRAAL}
                fill="none"
                stroke={colors.rand}
                strokeWidth={DIKTE}
                strokeDasharray="6 8"
              />
            </Svg>
          </View>
          <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>
            Kader heeft nog geen live koersen om je posities te wegen. De verdeling verschijnt na de eerste sync.
          </Text>
        </>
      ) : (
        <>
          {/* De ring is decoratief: de legenda eronder geeft dezelfde cijfers in tekst. */}
          <View
            style={styles.ringHouder}
            accessible
            accessibilityLabel={ringLabel}
          >
            <Svg
              width={RING_MAAT}
              height={RING_MAAT}
              viewBox={`0 0 ${RING_MAAT} ${RING_MAAT}`}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <G transform={`rotate(-90 ${MIDDEN} ${MIDDEN})`}>
                {segmenten.length === 1 ? (
                  // Eén segment krijgt geen dasharray. Met een naad van 2 zou de enige streep
                  // niet rondkomen en leest dat gaatje als een fout in plaats van als een naad.
                  <Circle
                    cx={MIDDEN}
                    cy={MIDDEN}
                    r={STRAAL}
                    fill="none"
                    stroke={kleurVoor(segmenten[0], 0)}
                    strokeWidth={DIKTE}
                  />
                ) : segmenten.map((s, i) => (
                  <Circle
                    key={s.sleutel}
                    cx={MIDDEN}
                    cy={MIDDEN}
                    r={STRAAL}
                    fill="none"
                    stroke={kleurVoor(s, i)}
                    strokeWidth={DIKTE}
                    // Een segment van een halve procent is korter dan de naad. Zonder deze
                    // ondergrens wordt de streeplengte negatief en tekent het hele segment niet.
                    strokeDasharray={`${Math.max(0.5, s.aandeel * OMTREK - NAAD)} ${OMTREK}`}
                    strokeDashoffset={-(beginPunten[i] * OMTREK)}
                  />
                ))}
              </G>
            </Svg>
            <View style={styles.ringMidden} pointerEvents="none">
              <Text
                style={[Type.prijs, styles.ringBedrag, { color: colors.tekstPrimair }]}
                numberOfLines={1}
              >
                {fmtBedrag(totaalUsd)}
              </Text>
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
                {gewaardeerd} {gewaardeerd === 1 ? 'positie' : 'posities'}
              </Text>
            </View>
          </View>

          {/* Eén kolom, drie rechte kolommen per rij. De percentages stonden eerder achter de naam
              en dus op een wisselende horizontale plek: je kon ze niet met je oog vergelijken. Nu
              staan ze recht onder elkaar tegen de rechtermarge, en dat is het getal waar de kaart
              om draait. Twee kolommen naast elkaar maakten van vijf getallen twee lijstjes. */}
          <View style={styles.legenda}>
            {segmenten.map((s, i) => (
              <View
                key={s.sleutel}
                style={styles.rij}
                accessible
                accessibilityLabel={`${s.label}, ${fmtBedrag(s.waardeUsd)}, ${spreekAandeel(s.aandeel)} van je posities.`}
              >
                <View
                  style={[styles.vierkantje, { backgroundColor: kleurVoor(s, i) }]}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
                <Text
                  style={[Type.caption, styles.naam, { color: colors.tekstPrimair }]}
                  numberOfLines={1}
                >
                  {s.label}
                </Text>
                <Text style={[Type.prijs, styles.bedrag, { color: colors.tekstGedimd }]}>
                  {fmtBedrag(s.waardeUsd)}
                </Text>
                <Text style={[Type.label, styles.aandeel, { color: colors.tekstPrimair }]}>
                  {aandeelTekst(s.aandeel)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {zonderLivePrijs > 0 && (
        <Text style={[Type.caption, styles.zonderPrijs, { color: colors.tekstGedimd }]}>
          {zonderLivePrijs} {zonderLivePrijs === 1 ? 'positie telt' : 'posities tellen'} niet mee in de verdeling (geen aantal of live koers).
        </Text>
      )}

      {/* Zelfde vorm als de historie-knop in PortfolioStatusKaart, zodat de twee ingangen op dit
          scherm er hetzelfde uitzien. Hij is zelf geen knop: de hele kaart is dat al. */}
      <View style={[styles.ingang, { borderTopColor: colors.rand }]}>
        <Text style={[Type.caption, styles.ingangLabel, { color: colors.cta }]}>
          Alle posities en platforms
        </Text>
        <ChevronRight size={16} color={colors.cta} strokeWidth={1.75} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  kop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ringHouder: {
    width: RING_MAAT,
    height: RING_MAAT,
    alignSelf: 'center',
  },
  ringMidden: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ringBedrag: {
    fontSize: 14,
    fontWeight: '500',
  },
  uitleg: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  legenda: {
    rowGap: 10,
    marginTop: spacing.base,
  },
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  vierkantje: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  naam: {
    flex: 1,
    fontWeight: '600',
  },
  // 78 is genoeg voor $12,480.00 op 12px mono. Loopt een bedrag daaroverheen, dan groeit deze
  // kolom en krimpt de naam: een symbool van vier letters mag inleveren, een bedrag niet.
  bedrag: {
    fontSize: 12,
    minWidth: 78,
    textAlign: 'right',
  },
  // Vast en niet flexibel: dit is de kolom die recht moet staan. 46 past 100.0%.
  aandeel: {
    width: 46,
    textAlign: 'right',
  },
  zonderPrijs: {
    marginTop: spacing.sm,
  },
  ingang: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  ingangLabel: {
    fontWeight: '600',
  },
});
