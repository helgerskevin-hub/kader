import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { ChevronRight, Target } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { fmtBedrag } from '../engine/format';
import { aandeelTekst, berekenVerdeling, OVERIG_SLEUTEL, Segment, spreekAandeel } from '../engine/verdeling';
import { AfwijkingRegel, Doelverdeling, berekenAfwijking, fmtAfwijkingPp } from '../engine/doelstelling';
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

// Het kleurvierkantje is 9 breed en staat op spacing.sm van de tekst. Het staafje en de cijferregel
// eronder beginnen daarom op 17, zodat ze uitlijnen met het symbool en niet met het vierkantje.
const INSPRONG = 17;

type Weergave = 'nu' | 'doel';

interface Props {
  trades: PortfolioTrade[];
  livePrijzen: Record<string, number>;
  // De ingestelde doelverdeling, of een lege lijst als er nog geen doel is.
  doel: Doelverdeling;
  // Opent het volledige overzicht van de huidige verdeling, per coin en per platform.
  onOpenDetail: () => void;
  // Opent het doelscherm: doelverdeling, bijstortplan en projectie.
  onOpenDoel: () => void;
  // Opent de sheet waarin je het doel invult. Alleen nodig vanuit de lege staat, waar er nog niets
  // is om een detailscherm mee te vullen.
  onDoelInstellen: () => void;
}

export function VerdelingKaart({
  trades, livePrijzen, doel, onOpenDetail, onOpenDoel, onDoelInstellen,
}: Props) {
  const { colors } = useTheme();
  // De formatters lezen de gekozen valuta uit een gewone module. Zonder dit abonnement blijft deze
  // kaart na het omzetten in de oude valuta staan.
  useValutaStand();

  // Lokale state en niet bewaard tussen sessies: dit is een lichte weergavewissel en geen
  // instelling. De kaart moet openen op de ring die iedereen kent, ook als je vorige keer op Doel
  // stond.
  const [actief, setActief] = useState<Weergave>('nu');

  const verdeling = useMemo(() => berekenVerdeling(trades, livePrijzen), [trades, livePrijzen]);
  const { segmenten, totaalUsd, gewaardeerd, zonderLivePrijs } = verdeling;

  const afwijking = useMemo(
    () => berekenAfwijking(doel, trades, livePrijzen),
    [doel, trades, livePrijzen],
  );

  const kleurVoor = (segment: Segment, index: number): string =>
    // Overig is altijd het neutrale grijs. Datzelfde grijs vangt ook het zevende eigen segment op:
    // de categorische reeks telt er zes, en bij precies zeven symbolen is er geen Overig, dus die
    // twee kunnen nooit tegelijk in beeld staan.
    segment.sleutel === OVERIG_SLEUTEL || index >= colors.verdeling.length
      ? colors.verdelingOverig
      : colors.verdeling[index];

  // Zelfde toewijzing voor de afwijkingsrijen: de eerste zes doelregels krijgen de categorische
  // reeks op volgorde, Overig het neutrale grijs.
  const doelKleurVoor = (regel: AfwijkingRegel, index: number): string =>
    regel.sleutel === OVERIG_SLEUTEL || index >= colors.verdeling.length
      ? colors.verdelingOverig
      : colors.verdeling[index];

  // Geen open posities en ook geen doel: geen kaart. PortfolioScreen heeft daar zijn eigen lege
  // staat voor. Staat er wel een doel, dan blijft de kaart staan, ook als je net al je posities
  // hebt gesloten: een doel dat je zelf hebt ingesteld hoort niet zomaar uit beeld te verdwijnen.
  if (gewaardeerd + zonderLivePrijs === 0 && doel.length === 0) return null;

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

  const zonderPrijsRegel = zonderLivePrijs > 0 && (
    <Text style={[Type.caption, styles.zonderPrijs, { color: colors.tekstGedimd }]}>
      {zonderLivePrijs} {zonderLivePrijs === 1 ? 'positie telt' : 'posities tellen'} niet mee in de verdeling (geen aantal of live koers).
    </Text>
  );

  // Zelfde vorm als de historie-knop in PortfolioStatusKaart, zodat de twee ingangen op dit
  // scherm er hetzelfde uitzien. Hij is zelf geen knop: het blok eromheen is dat al.
  const ingangRij = (label: string) => (
    <View style={[styles.ingang, { borderTopColor: colors.rand }]}>
      <Text style={[Type.caption, styles.ingangLabel, { color: colors.cta }]}>{label}</Text>
      <ChevronRight size={16} color={colors.cta} strokeWidth={1.75} />
    </View>
  );

  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      {/* De kop staat bewust buiten de Pressable hieronder. Zat de schakelaar erbinnen, dan zou een
          tik op de kop twee dingen tegelijk kunnen betekenen: van weergave wisselen én het
          detailscherm openen. Dat raakvlakconflict is precies waarom de vorige spec een losse knop
          op deze kaart afwees. */}
      <View style={styles.kop}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>VERDELING VAN JE POSITIES</Text>
        <View style={[styles.schakelaar, { backgroundColor: colors.verhoogd }]}>
          {(['nu', 'doel'] as const).map(optie => (
            <Pressable
              key={optie}
              onPress={() => setActief(optie)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ selected: actief === optie }}
              accessibilityLabel={optie === 'nu' ? 'Huidige verdeling tonen' : 'Doelverdeling tonen'}
              style={[styles.schakelKnop, actief === optie && { backgroundColor: colors.kaart }]}
            >
              <Text
                style={[
                  Type.caption,
                  styles.schakelLabel,
                  { color: actief === optie ? colors.tekstPrimair : colors.tekstGedimd },
                ]}
              >
                {optie === 'nu' ? 'Nu' : 'Doel'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {actief === 'nu' ? (
        <Pressable
          onPress={onOpenDetail}
          accessibilityRole="button"
          accessibilityLabel="Verdeling in detail bekijken"
          accessibilityHint="Opent het volledige overzicht per coin en per platform."
          style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
        >
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

          {zonderPrijsRegel}
          {ingangRij('Alle posities en platforms')}
        </Pressable>
      ) : doel.length === 0 ? (
        // Zonder doel valt er niets te openen, dus hier ook geen Pressable om het blok heen: een
        // kaart die aanvoelt als een knop maar nergens heen gaat is erger dan een knop die er staat.
        <View style={styles.leeg}>
          <Target size={28} color={colors.tekstGedimd} strokeWidth={1.5} style={styles.leegIcoon} />
          <Text style={[Type.caption, styles.leegTekst, { color: colors.tekstGedimd }]}>
            Je hebt nog geen doelverdeling ingesteld. Vul in welk percentage je in welke coin wil
            hebben, dan laat Kader zien waar je te zwaar of te licht zit.
          </Text>
          <Pressable
            onPress={onDoelInstellen}
            accessibilityRole="button"
            accessibilityLabel="Doelverdeling instellen"
            style={[styles.leegKnop, { borderColor: colors.cta }]}
          >
            <Text style={[Type.caption, { color: colors.cta, fontWeight: '600' }]}>Doel instellen</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={onOpenDoel}
          accessibilityRole="button"
          accessibilityLabel="Doel, bijstorten en projectie bekijken"
          accessibilityHint="Opent je doelverdeling, het bijstortplan en de projectie."
          style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
        >
          {afwijking.totaalUsd === 0 ? (
            // Zonder koersen staat rekenkundig elke categorie op te-licht, want elk actueel aandeel
            // is dan 0. Dat klopt, maar het leest als een oordeel over je portfolio in plaats van
            // over een ontbrekende sync. Dus geen rijen, wel de reden.
            <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>
              Kader heeft nog geen live koersen om je posities tegen je doel af te zetten. De
              afwijking verschijnt na de eerste sync.
            </Text>
          ) : (
            <View style={styles.doelLijst}>
              {afwijking.regels.map((r, i) => (
                <DoelRij key={r.sleutel} regel={r} kleur={doelKleurVoor(r, i)} />
              ))}
            </View>
          )}

          {zonderPrijsRegel}
          {ingangRij('Doel, bijstorten en projectie')}
        </Pressable>
      )}
    </View>
  );
}

// Eén categorie tegenover haar doel: naam met statuspil, een staafje met je huidige aandeel en een
// streep op het doel, en de twee cijfers eronder. Het staafje laat het gat zien, de pil zegt in
// woorden hoe groot dat gat is; kleur is dus nergens het enige signaal.
function DoelRij({ regel, kleur }: { regel: AfwijkingRegel; kleur: string }) {
  const { colors } = useTheme();

  const flink = regel.status !== 'op-doel' && regel.ernst === 'flink';
  const woord = regel.status === 'op-doel'
    ? 'OP DOEL'
    : regel.status === 'te-zwaar' ? 'TE ZWAAR' : 'TE LICHT';

  const spreek = regel.status === 'op-doel'
    ? 'op doel'
    : `${Math.abs(regel.afwijkingPct).toFixed(1).replace('.', ',')} procentpunt ${regel.status === 'te-zwaar' ? 'te zwaar' : 'te licht'}`;

  const vulling = Math.min(100, Math.max(0, regel.actueelPct));
  const streep = Math.min(100, Math.max(0, regel.doelPct));

  return (
    <View
      accessible
      accessibilityLabel={
        `${regel.label}, nu ${regel.actueelPct.toFixed(1).replace('.', ',')} procent, ` +
        `doel ${regel.doelPct.toFixed(1).replace('.', ',')} procent, ${spreek}.`
      }
    >
      <View style={styles.rij}>
        <View
          style={[styles.vierkantje, { backgroundColor: kleur }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text style={[Type.caption, styles.naam, { color: colors.tekstPrimair }]} numberOfLines={1}>
          {regel.label}
        </Text>
        {/* Geen winst- of verliesgroen hier. Een afwijking van je eigen doel is geen resultaat,
            dezelfde reden waarom de ring zelf ook geen groen of rood gebruikt. */}
        <View
          style={[
            styles.pil,
            { backgroundColor: flink ? colors.letOp + '1A' : colors.verhoogd },
          ]}
        >
          <Text
            style={[
              Type.caption,
              styles.pilWoord,
              {
                color: flink
                  ? colors.letOp
                  : regel.status === 'op-doel' ? colors.tekstGedimd : colors.tekstPrimair,
              },
            ]}
          >
            {woord}
            {regel.status !== 'op-doel' && (
              <Text style={[Type.label, styles.pilCijfer]}> · {fmtAfwijkingPp(regel.afwijkingPct)}</Text>
            )}
          </Text>
        </View>
      </View>

      <View
        style={[styles.baan, { backgroundColor: colors.verhoogd }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.baanVulling, { width: `${vulling}%`, backgroundColor: kleur }]} />
        <View style={[styles.baanStreep, { left: `${streep}%`, backgroundColor: colors.tekstPrimair }]} />
      </View>

      <View style={styles.cijferRij}>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
          Nu {aandeelTekst(regel.actueelPct / 100)} · {fmtBedrag(regel.actueelUsd)}
        </Text>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
          Doel {aandeelTekst(regel.doelPct / 100)}
        </Text>
      </View>
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
  schakelaar: {
    flexDirection: 'row',
    borderRadius: radii.knop,
    padding: 2,
    gap: 2,
  },
  // 28 hoog met hitSlop 6 eromheen. Een volle 44px per knop zou de twee knoppen laten overlappen,
  // want ze staan naast elkaar in dezelfde pil.
  schakelKnop: {
    minHeight: 28,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.knop - 2,
  },
  schakelLabel: {
    fontWeight: '600',
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
  doelLijst: {
    rowGap: spacing.base,
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
  pil: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pilWoord: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  pilCijfer: {
    fontWeight: '600',
  },
  baan: {
    height: 3,
    borderRadius: radii.pill,
    marginTop: 5,
    marginLeft: INSPRONG,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  baanVulling: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    minWidth: 2,
  },
  baanStreep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
  },
  cijferRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginLeft: INSPRONG,
  },
  leeg: {
    alignItems: 'center',
  },
  leegIcoon: {
    marginTop: spacing.base,
  },
  leegTekst: {
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
  leegKnop: {
    minHeight: 44,
    alignSelf: 'center',
    marginTop: spacing.base,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
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
