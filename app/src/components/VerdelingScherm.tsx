// Het volledige overzicht achter de verdelingskaart: per coin, per platform, en waar die twee
// elkaar kruisen.
//
// Full-screen en geen sheet: dit is iets wat je leest en niet iets wat je afhandelt, en bij 25
// posities is het makkelijk drie schermhoogtes lang. Zelfde vorm als HistorieScherm.tsx, zodat de
// twee schermen die je vanaf Portfolio opent er hetzelfde uitzien.
//
// De ring hierboven komt uit berekenVerdeling, dezelfde functie als de kaart die je aantikte. Dat
// is met opzet: het bedrag boven aan dit scherm moet exact het bedrag in het gat van die ring zijn,
// anders gelooft niemand meer een van beide. verdeling.ts bewaakt dat met een self-check.
import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';
import { ChartPie, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useModalKopruimte } from '../theme/useModalKopruimte';
import { Type } from '../theme/typography';
import { radii, shadow, spacing } from '../theme/tokens';
import { fmtBedrag } from '../engine/format';
import {
  aandeelTekst, berekenVerdeling, berekenVolledigeVerdeling, duidingen,
  OVERIG_SLEUTEL, Segment, spreekAandeel,
} from '../engine/verdeling';
import { noemPlatforms, platformInfo, platformNaam } from '../engine/platforms';
import { PortfolioTrade } from '../state/portfolioTypes';
import { useValutaStand } from '../state/useValuta';
import { PlatformChip, PlatformChips } from './PlatformChip';

// Iets kleiner dan op de kaart: hier staat het bedrag er al boven in Type.display, dus de ring
// hoeft het niet nog een keer te dragen.
const RING_MAAT = 132;
const MIDDEN = RING_MAAT / 2;
const STRAAL = 51;
const DIKTE = 19;
const OMTREK = 2 * Math.PI * STRAAL;
const NAAD = 2;

// Boven dit aantal deelt de rest van de coins één grijs, precies zoals in de ring.
const EIGEN_KLEUREN = 6;

interface Props {
  zichtbaar: boolean;
  trades: PortfolioTrade[];
  livePrijzen: Record<string, number>;
  onSluiten: () => void;
}

function meervoud(n: number, enkel: string, meer: string): string {
  return `${n} ${n === 1 ? enkel : meer}`;
}

export function VerdelingScherm({ zichtbaar, trades, livePrijzen, onSluiten }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement blijft
  // dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const extraKopruimte = useModalKopruimte();

  // Alleen rekenen als het scherm ook echt open is: het staat als broer van de lijst in
  // PortfolioScreen en zou anders bij elke prijzenpoll meerekenen terwijl niemand kijkt.
  const verdeling = useMemo(
    () => (zichtbaar ? berekenVerdeling(trades, livePrijzen) : null),
    [zichtbaar, trades, livePrijzen],
  );
  const vol = useMemo(
    () => (zichtbaar ? berekenVolledigeVerdeling(trades, livePrijzen) : null),
    [zichtbaar, trades, livePrijzen],
  );

  const kleurVoorIndex = (i: number) =>
    i < EIGEN_KLEUREN && i < colors.verdeling.length ? colors.verdeling[i] : colors.verdelingOverig;

  const kleurVoorSegment = (segment: Segment, i: number) =>
    segment.sleutel === OVERIG_SLEUTEL ? colors.verdelingOverig : kleurVoorIndex(i);

  const platformKleur = (kleurIndex: number) =>
    kleurIndex >= 0 && kleurIndex < colors.verdeling.length
      ? colors.verdeling[kleurIndex]
      : colors.tekstGedimd;

  return (
    <Modal visible={zichtbaar} animationType="slide" onRequestClose={onSluiten} presentationStyle="fullScreen">
      <SafeAreaView style={[stijlen.root, { backgroundColor: colors.achtergrond }]}>
        <View style={[stijlen.header, { borderBottomColor: colors.rand, paddingTop: spacing.base + extraKopruimte }]}>
          <View style={stijlen.headerLinks}>
            <ChartPie size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
            <Text style={[Type.titel, { color: colors.tekstPrimair }]} accessibilityRole="header">Verdeling</Text>
          </View>
          <Pressable
            onPress={onSluiten}
            style={stijlen.sluitKnop}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
            hitSlop={8}
          >
            <X size={22} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        </View>

        {vol === null || verdeling === null ? null : vol.coins.length === 0 && vol.nietGewogen.length === 0 ? (
          <View style={stijlen.leeg}>
            <ChartPie size={40} color={colors.tekstGedimd} strokeWidth={1.5} />
            <Text style={[Type.body, stijlen.leegTekst, { color: colors.tekstGedimd }]}>
              Je hebt nog geen open posities. Zodra er iets openstaat, verschijnt hier hoe het verdeeld is.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={stijlen.scroll} showsVerticalScrollIndicator={false}>

            {/* ---------- Blok 1: totaal en ring ---------- */}
            <View style={[stijlen.blok, shadow.kaart, { backgroundColor: colors.kaart }]}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]} accessibilityRole="header">
                IN POSITIES
              </Text>
              <Text style={[Type.display, { color: vol.gewaardeerd === 0 ? colors.tekstGedimd : colors.tekstPrimair }]}>
                {vol.gewaardeerd === 0 ? '—' : fmtBedrag(vol.totaalUsd)}
              </Text>

              <View
                style={stijlen.ringHouder}
                accessible
                accessibilityLabel={
                  vol.gewaardeerd === 0
                    ? 'Nog geen live koersen om je posities te wegen.'
                    : 'Verdeling: ' + vol.coins
                      .slice(0, EIGEN_KLEUREN)
                      .map(c => `${c.symbool} ${spreekAandeel(c.aandeel)}`)
                      .join(', ') + '.'
                }
              >
                <Svg
                  width={RING_MAAT}
                  height={RING_MAAT}
                  viewBox={`0 0 ${RING_MAAT} ${RING_MAAT}`}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {vol.gewaardeerd === 0 ? (
                    <Circle
                      cx={MIDDEN}
                      cy={MIDDEN}
                      r={STRAAL}
                      fill="none"
                      stroke={colors.rand}
                      strokeWidth={DIKTE}
                      strokeDasharray="6 8"
                    />
                  ) : (
                    <G transform={`rotate(-90 ${MIDDEN} ${MIDDEN})`}>
                      {verdeling.segmenten.length === 1 ? (
                        <Circle
                          cx={MIDDEN}
                          cy={MIDDEN}
                          r={STRAAL}
                          fill="none"
                          stroke={kleurVoorSegment(verdeling.segmenten[0], 0)}
                          strokeWidth={DIKTE}
                        />
                      ) : verdeling.segmenten.map((s, i) => {
                        const begin = verdeling.segmenten.slice(0, i).reduce((som, v) => som + v.aandeel, 0);
                        return (
                          <Circle
                            key={s.sleutel}
                            cx={MIDDEN}
                            cy={MIDDEN}
                            r={STRAAL}
                            fill="none"
                            stroke={kleurVoorSegment(s, i)}
                            strokeWidth={DIKTE}
                            strokeDasharray={`${Math.max(0.5, s.aandeel * OMTREK - NAAD)} ${OMTREK}`}
                            strokeDashoffset={-(begin * OMTREK)}
                          />
                        );
                      })}
                    </G>
                  )}
                </Svg>
              </View>

              <Text style={[Type.caption, stijlen.onderregel, { color: colors.tekstGedimd }]}>
                {vol.gewaardeerd === 0
                  ? 'Kader heeft nog geen live koersen om je posities te wegen. De verdeling verschijnt na de eerste sync.'
                  : [
                    meervoud(vol.gewaardeerd, 'positie', 'posities'),
                    meervoud(vol.coins.length, 'coin', 'coins'),
                    meervoud(vol.platforms.length, 'platform', 'platforms'),
                  ].join(' · ')}
              </Text>
            </View>

            {/* ---------- Blok 2: per coin ---------- */}
            {vol.coins.length > 0 && (
              <View style={[stijlen.blok, shadow.kaart, { backgroundColor: colors.kaart }]}>
                <View style={stijlen.blokKop}>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]} accessibilityRole="header">PER COIN</Text>
                  <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
                    {meervoud(vol.coins.length, 'coin', 'coins')}
                  </Text>
                </View>

                <View style={stijlen.rijen}>
                  {vol.coins.map((c, i) => (
                    <View
                      key={c.symbool}
                      accessible
                      accessibilityLabel={`${c.symbool}, op ${noemPlatforms(c.platforms)}, ${fmtBedrag(c.waardeUsd)}, ${spreekAandeel(c.aandeel)} van je posities.`}
                    >
                      <View style={stijlen.regel}>
                        <View
                          style={[stijlen.vierkantje, { backgroundColor: kleurVoorIndex(i) }]}
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        />
                        <Text style={[Type.caption, stijlen.symbool, { color: colors.tekstPrimair }]}>
                          {c.symbool}
                        </Text>
                        <PlatformChips platforms={c.platforms} maat={16} />
                        <View style={stijlen.vulling} />
                        <Text style={[Type.prijs, stijlen.bedrag, { color: colors.tekstGedimd }]}>
                          {fmtBedrag(c.waardeUsd)}
                        </Text>
                        <Text style={[Type.label, stijlen.aandeel, { color: colors.tekstPrimair }]}>
                          {aandeelTekst(c.aandeel)}
                        </Text>
                      </View>
                      <Staaf aandeel={c.aandeel} kleur={kleurVoorIndex(i)} inspringen={17} />
                    </View>
                  ))}
                </View>

                {vol.coins.length > EIGEN_KLEUREN && (
                  <Text style={[Type.caption, stijlen.voetregel, { color: colors.tekstGedimd }]}>
                    De zes grootste hebben de kleur uit de ring. De rest deelt één grijs.
                  </Text>
                )}
              </View>
            )}

            {/* ---------- Blok 3: per platform ---------- */}
            {vol.platforms.length > 0 && (
              <View style={[stijlen.blok, shadow.kaart, { backgroundColor: colors.kaart }]}>
                <View style={stijlen.blokKop}>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]} accessibilityRole="header">PER PLATFORM</Text>
                  <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
                    {meervoud(vol.platforms.length, 'platform', 'platforms')}
                  </Text>
                </View>

                <View style={stijlen.rijen}>
                  {vol.platforms.map(p => {
                    const info = platformInfo(p.id);
                    return (
                      <View
                        key={p.id}
                        accessible
                        accessibilityLabel={`${info.naam}${info.demo ? ', speelgeld' : ''}, ${fmtBedrag(p.waardeUsd)}, ${spreekAandeel(p.aandeel)}, ${meervoud(p.posities, 'positie', 'posities')} in ${meervoud(p.coins, 'coin', 'coins')}.`}
                      >
                        <View style={stijlen.regel}>
                          <PlatformChip platform={p.id} maat={24} />
                          <Text style={[Type.caption, stijlen.platformNaam, { color: colors.tekstPrimair }]}>
                            {info.naam}
                          </Text>
                          {info.demo && (
                            <View style={[stijlen.demoPil, { backgroundColor: colors.letOp + '1A' }]}>
                              <Text style={[Type.label, stijlen.demoTekst, { color: colors.letOp }]}>DEMO</Text>
                            </View>
                          )}
                          <View style={stijlen.vulling} />
                          <Text style={[Type.prijs, stijlen.bedrag, { color: colors.tekstGedimd }]}>
                            {fmtBedrag(p.waardeUsd)}
                          </Text>
                          <Text style={[Type.label, stijlen.aandeel, { color: colors.tekstPrimair }]}>
                            {aandeelTekst(p.aandeel)}
                          </Text>
                        </View>
                        <Staaf aandeel={p.aandeel} kleur={platformKleur(info.kleurIndex)} inspringen={32} />
                        <Text style={[Type.caption, stijlen.platformDetail, { color: colors.tekstGedimd }]}>
                          {meervoud(p.posities, 'positie', 'posities')} · {meervoud(p.coins, 'coin', 'coins')}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Staat elke coin op één plek, dan vervalt blok 4 en hoort die conclusie hier. */}
                {vol.kruis.length === 0 && vol.coins.length > 0 && (
                  <Text style={[Type.caption, stijlen.voetregel, { color: colors.tekstGedimd }]}>
                    Elke coin staat op één platform.
                  </Text>
                )}
              </View>
            )}

            {/* ---------- Blok 4: op meer dan één plek ---------- */}
            {vol.kruis.length > 0 && (
              <View style={[stijlen.blok, shadow.kaart, { backgroundColor: colors.kaart }]}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]} accessibilityRole="header">
                  OP MEER DAN ÉÉN PLEK
                </Text>
                <Text style={[Type.caption, stijlen.blokUitleg, { color: colors.tekstGedimd }]}>
                  De percentages hieronder gaan over de coin zelf, niet over je hele portfolio.
                </Text>

                <View style={stijlen.kruisRijen}>
                  {vol.kruis.map(k => (
                    <View key={k.symbool} style={stijlen.kruisCoin}>
                      <View style={stijlen.regel}>
                        <Text style={[Type.caption, stijlen.symbool, { color: colors.tekstPrimair }]}>
                          {k.symbool}
                        </Text>
                        <View style={stijlen.vulling} />
                        <Text style={[Type.prijs, stijlen.bedrag, { color: colors.tekstGedimd }]}>
                          {fmtBedrag(k.waardeUsd)}
                        </Text>
                      </View>
                      {k.delen.map(d => (
                        <View
                          key={d.platform}
                          style={[stijlen.regel, stijlen.kruisDeel]}
                          accessible
                          accessibilityLabel={`${k.symbool} op ${platformNaam(d.platform)}: ${fmtBedrag(d.waardeUsd)}, ${spreekAandeel(d.aandeel)} van deze coin.`}
                        >
                          <PlatformChip platform={d.platform} maat={16} />
                          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
                            {platformNaam(d.platform)}
                          </Text>
                          <View style={stijlen.vulling} />
                          <Text style={[Type.prijs, stijlen.bedrag, { color: colors.tekstGedimd }]}>
                            {fmtBedrag(d.waardeUsd)}
                          </Text>
                          <Text style={[Type.label, stijlen.aandeel, { color: colors.tekstPrimair }]}>
                            {aandeelTekst(d.aandeel)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ---------- Blok 5: wat opvalt ---------- */}
            {duidingen(vol).length > 0 && (
              <View style={[stijlen.blok, shadow.kaart, { backgroundColor: colors.kaart }]}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]} accessibilityRole="header">WAT OPVALT</Text>
                <View style={stijlen.duidingen}>
                  {duidingen(vol).map(zin => (
                    <View key={zin} style={stijlen.duidingRij}>
                      <View
                        style={[stijlen.bolletje, { backgroundColor: colors.tekstGedimd }]}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      />
                      <Text style={[Type.body, stijlen.duidingTekst, { color: colors.tekstPrimair }]}>{zin}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[Type.caption, stijlen.slotregel, { color: colors.tekstGedimd, borderTopColor: colors.rand }]}>
                  Dit zijn observaties, geen advies.
                </Text>
              </View>
            )}

            {/* ---------- Blok 6: niet meegeteld ---------- */}
            {vol.nietGewogen.length > 0 && (
              <View style={[stijlen.terzijde, { backgroundColor: colors.verhoogd }]}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]} accessibilityRole="header">NIET MEEGETELD</Text>
                <Text style={[Type.caption, stijlen.blokUitleg, { color: colors.tekstGedimd }]}>
                  Deze posities staan open, maar Kader kan ze niet wegen. Ze tellen niet mee in de
                  percentages hierboven.
                </Text>
                <View style={stijlen.nietGewogenRijen}>
                  {vol.nietGewogen.map((n, i) => (
                    <View
                      key={`${n.platform}-${n.symbool}-${i}`}
                      style={stijlen.regel}
                      accessible
                      accessibilityLabel={`${n.symbool} op ${platformNaam(n.platform)}: ${n.reden}.`}
                    >
                      <PlatformChip platform={n.platform} maat={16} />
                      <Text style={[Type.caption, stijlen.symbool, { color: colors.tekstPrimair }]}>{n.symbool}</Text>
                      <View style={stijlen.vulling} />
                      <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{n.reden}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// Het staafje onder een rij. Een lengtemaat is bij twintig rijen het enige dat nog werkt: er staat
// hier geen ring naast om de verhoudingen aan af te lezen.
function Staaf({ aandeel, kleur, inspringen }: { aandeel: number; kleur: string; inspringen: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[stijlen.staafSpoor, { backgroundColor: colors.verhoogd, marginLeft: inspringen }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Minimaal een streepje: een positie van 0,2 procent bestaat, en helemaal niets tekenen
          leest als een fout in plaats van als een klein aandeel. */}
      <View style={[stijlen.staafVulling, { backgroundColor: kleur, width: `${Math.max(0.6, aandeel * 100)}%` }]} />
    </View>
  );
}

const stijlen = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  leeg: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  leegTekst: { textAlign: 'center', marginTop: spacing.base, lineHeight: 24 },
  scroll: { padding: spacing.base },

  blok: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  // Een terzijde, geen kaart met data: dus geen schaduw en het verhoogde vlak.
  terzijde: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  blokKop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  blokUitleg: { marginTop: spacing.sm },

  ringHouder: { alignSelf: 'center', marginTop: spacing.base },
  onderregel: { marginTop: spacing.base, textAlign: 'center' },

  rijen: { rowGap: spacing.md },
  regel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vulling: { flex: 1 },
  vierkantje: { width: 9, height: 9, borderRadius: 2 },
  symbool: { fontWeight: '600' },
  platformNaam: { fontWeight: '600' },
  bedrag: { fontSize: 12, textAlign: 'right' },
  aandeel: { width: 46, textAlign: 'right' },

  // 17 = het vierkantje van 9 plus de tussenruimte van 8, zodat het staafje onder het symbool
  // begint. Bij een platformrij is dat 32: de chip van 24 plus dezelfde 8.
  staafSpoor: {
    height: 3,
    borderRadius: radii.pill,
    marginTop: 5,
    overflow: 'hidden',
  },
  staafVulling: { height: 3, borderRadius: radii.pill },

  platformDetail: { marginLeft: 32, marginTop: 4 },
  demoPil: {
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  demoTekst: { fontSize: 10 },

  kruisRijen: { rowGap: spacing.md, marginTop: spacing.md },
  kruisCoin: { rowGap: 4 },
  kruisDeel: { paddingLeft: spacing.md },

  duidingen: { rowGap: spacing.md, marginTop: spacing.md },
  duidingRij: { flexDirection: 'row', gap: spacing.sm },
  bolletje: { width: 5, height: 5, borderRadius: radii.pill, marginTop: 7 },
  duidingTekst: { flex: 1 },
  slotregel: {
    marginTop: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  nietGewogenRijen: { rowGap: 6, marginTop: spacing.md },
  voetregel: { marginTop: spacing.md },
});
