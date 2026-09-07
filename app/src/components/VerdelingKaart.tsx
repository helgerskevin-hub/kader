import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../theme/useReduceMotion';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { fmtBedrag, fmtPct } from '../engine/format';
import { berekenVerdeling, OVERIG_SLEUTEL, Segment } from '../engine/verdeling';
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
// Hoeveel leden van Overig er uitgeklapt met naam verschijnen; de rest wordt één regel.
const MAX_ZICHTBARE_LEDEN = 4;

interface Props {
  trades: PortfolioTrade[];
  livePrijzen: Record<string, number>;
}

// fmtPct zet er een expliciet plusteken voor, want hij is gemaakt voor een verandering. Een aandeel
// in je portfolio verandert niets, dus dat teken gaat eraf. De rest van de opmaak blijft van fmtPct,
// zodat percentages er in de hele app hetzelfde uitzien.
function fmtAandeel(aandeel: number): string {
  return fmtPct(aandeel * 100).replace('+', '');
}

// Voor de schermlezer, die "34.3%" als "vierendertig punt drie" voorleest. Uitgeschreven met een
// komma en het woord procent leest dat wél als een Nederlands percentage.
function spreekAandeel(aandeel: number): string {
  return `${(aandeel * 100).toFixed(1).replace('.', ',')} procent`;
}

export function VerdelingKaart({ trades, livePrijzen }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  // De formatters lezen de gekozen valuta uit een gewone module. Zonder dit abonnement blijft deze
  // kaart na het omzetten in de oude valuta staan.
  useValutaStand();
  const [uitgeklapt, setUitgeklapt] = useState(false);

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

  function wisselUitgeklapt() {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setUitgeklapt(v => !v);
  }

  const overig = segmenten.find(s => s.sleutel === OVERIG_SLEUTEL);
  const aantalSymbolen = segmenten.length - (overig ? 1 : 0) + (overig?.leden?.length ?? 0);

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
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      {/* Kop. De rechterkant blijft leeg: daar komt later de Nu/Doel-schakelaar. */}
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

          <View style={styles.legenda}>
            {segmenten.map((s, i) => (
              <View key={s.sleutel} style={[styles.cel, uitgeklapt && styles.celVol]}>
                <View style={styles.celRij}>
                  <View style={[styles.vierkantje, { backgroundColor: kleurVoor(s, i) }]} />
                  <Text
                    style={[Type.caption, styles.celLabel, { color: colors.tekstPrimair }]}
                    numberOfLines={1}
                  >
                    {s.label}
                  </Text>
                  <Text style={[Type.label, { color: colors.tekstGedimd }]}>
                    {fmtAandeel(s.aandeel)}
                  </Text>
                </View>
                <Text style={[Type.prijs, styles.celWaarde, { color: colors.tekstGedimd }]}>
                  {fmtBedrag(s.waardeUsd)}
                </Text>

                {/* De leden van Overig delen de kleur van Overig, dus geen eigen vierkantje. */}
                {uitgeklapt && s.leden !== undefined && (
                  <>
                    {s.leden.slice(0, MAX_ZICHTBARE_LEDEN).map(lid => (
                      <View key={lid.symbool} style={styles.lidRij}>
                        <Text style={[Type.caption, styles.lidLabel, { color: colors.tekstGedimd }]}>
                          {lid.symbool}
                        </Text>
                        <Text style={[Type.label, { color: colors.tekstGedimd }]}>
                          {fmtAandeel(lid.aandeel)}
                        </Text>
                      </View>
                    ))}
                    {s.leden.length > MAX_ZICHTBARE_LEDEN && (
                      <Text style={[Type.caption, styles.lidRest, { color: colors.tekstGedimd }]}>
                        en {s.leden.length - MAX_ZICHTBARE_LEDEN} kleinere posities
                      </Text>
                    )}
                  </>
                )}
              </View>
            ))}
          </View>

          {overig !== undefined && (
            <Pressable
              onPress={wisselUitgeklapt}
              accessibilityRole="button"
              accessibilityLabel={uitgeklapt ? 'Toon minder posities' : `Toon alle ${aantalSymbolen} posities`}
              style={styles.uitklapKnop}
            >
              <Text style={[Type.caption, styles.uitklapLabel, { color: colors.cta }]}>
                {uitgeklapt ? 'Toon minder' : `Toon alle ${aantalSymbolen}`}
              </Text>
              {uitgeklapt
                ? <ChevronUp size={12} color={colors.cta} strokeWidth={2} />
                : <ChevronDown size={12} color={colors.cta} strokeWidth={2} />}
            </Pressable>
          )}
        </>
      )}

      {zonderLivePrijs > 0 && (
        <Text style={[Type.caption, styles.zonderPrijs, { color: colors.tekstGedimd }]}>
          {zonderLivePrijs} {zonderLivePrijs === 1 ? 'positie telt' : 'posities tellen'} niet mee in de verdeling (geen aantal of live koers).
        </Text>
      )}
    </View>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: 10,
    marginTop: spacing.base,
  },
  // Twee kolommen: twee cellen van minstens 45% passen naast elkaar, een derde niet meer.
  cel: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '45%',
  },
  // Uitgeklapt wordt het één kolom, zodat de leden van Overig eronder passen.
  celVol: {
    minWidth: '100%',
  },
  celRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vierkantje: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  celLabel: {
    flex: 1,
    fontWeight: '600',
  },
  // 15 = het vierkantje van 9 plus de tussenruimte van 6, zodat het bedrag onder het label staat.
  celWaarde: {
    fontSize: 12,
    marginLeft: 15,
  },
  lidRij: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    marginTop: 2,
  },
  lidLabel: {
    flex: 1,
  },
  lidRest: {
    paddingLeft: 15,
    marginTop: 2,
  },
  uitklapKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  uitklapLabel: {
    fontWeight: '600',
  },
  zonderPrijs: {
    marginTop: spacing.sm,
  },
});
