import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet, type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming, Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, History, Trash2 } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useModalKopruimte } from '../theme/useModalKopruimte';
import { Fonts, Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { duur, veer } from '../theme/beweging';
import { useReduceMotion } from '../theme/useReduceMotion';
import { haptiek, haptiekVanUI } from '../theme/haptiek';
import { schuifOvergang, uitklapIn, uitklapUit } from '../theme/lijstBeweging';
import { fmtPct, fmtRR, fmtResultaatUsd } from '../engine/format';
import { PortfolioTrade, tekenVan } from '../state/portfolioTypes';
import { behaaldeRR, berekenStatistieken, resultaatVan } from '../state/statistieken';
import { PERIODES, PeriodeId, periodeGrens } from '../state/periodeResultaat';
import { useValutaStand } from '../state/useValuta';
import { CoinLogo } from './CoinLogo';
import { PodiumScherm } from './PodiumScherm';
import { useDrukVeer } from './Drukbaar';
import { SegmentKnop, type SegmentOptie } from './SegmentKnop';
import { Sparkline } from './Sparkline';
import { LegeStaatBeeld } from './LegeStaatBeeld';

interface Props {
  zichtbaar: boolean;
  trades: PortfolioTrade[];
  onSluiten: () => void;
  onOpenDetail: (trade: PortfolioTrade) => void;
  onVerwijder: (id: string) => void;
}

// Dezelfde tijdvakken als de portfoliokaart, op 'Dag' en '6M' na: een dag afgesloten trades is
// bijna altijd leeg, en zes knoppen passen niet naast elkaar zonder dat de labels krimpen.
const PERIODE_OPTIES: SegmentOptie<PeriodeId>[] = PERIODES
  .filter(p => p.id === '1M' || p.id === '3M' || p.id === '1J' || p.id === 'alles')
  .map(p => ({ id: p.id, label: p.label }));

type Uitkomst = 'alles' | 'gewonnen' | 'verloren';
const UITKOMST_OPTIES: SegmentOptie<Uitkomst>[] = [
  { id: 'alles', label: 'Alles' },
  { id: 'gewonnen', label: 'Gewonnen' },
  { id: 'verloren', label: 'Verloren' },
];

// Zo lang staat de ongedaan-maken-melding. Daarna is de trade echt weg.
const ONGEDAAN_MS = 5000;
const DAG_MS = 24 * 60 * 60 * 1000;

interface MaandGroep {
  sleutel: string;
  titel: string;
  totaal: number | null;
  trades: PortfolioTrade[];
}

export function HistorieScherm({ zichtbaar, trades, onSluiten, onOpenDetail, onVerwijder }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors, donkerActief } = useTheme();
  const extraKopruimte = useModalKopruimte();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [periode, setPeriode] = useState<PeriodeId>('alles');
  const [uitkomst, setUitkomst] = useState<Uitkomst>('alles');

  // Verwijderen gaat via vegen, met een paar seconden om het terug te draaien. Zolang die
  // seconden lopen is de trade hier alleen verborgen; pas daarna gaat hij echt uit het portfolio.
  // Zo hoeft de provider geen herstel te kennen.
  const [wachtend, setWachtend] = useState<PortfolioTrade | null>(null);
  const wachtendRef = useRef<PortfolioTrade | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVerwijderRef = useRef(onVerwijder);
  onVerwijderRef.current = onVerwijder;

  const voerUit = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const t = wachtendRef.current;
    wachtendRef.current = null;
    setWachtend(null);
    if (t) onVerwijderRef.current(t.id);
  }, []);

  const veegWeg = useCallback((trade: PortfolioTrade) => {
    // Een vorige verwijdering die nog liep gaat nu definitief door; er is maar één melding.
    if (wachtendRef.current) voerUit();
    wachtendRef.current = trade;
    setWachtend(trade);
    timer.current = setTimeout(voerUit, ONGEDAAN_MS);
  }, [voerUit]);

  const maakOngedaan = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    wachtendRef.current = null;
    setWachtend(null);
    haptiek('tik');
  }, []);

  // Scherm dicht met een verwijdering die nog loopt: dan geldt hij gewoon.
  useEffect(() => {
    if (!zichtbaar && wachtendRef.current) voerUit();
  }, [zichtbaar, voerUit]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (wachtendRef.current) onVerwijderRef.current(wachtendRef.current.id);
  }, []);

  const alleGesloten = useMemo(
    () => trades.filter(t => t.status !== 'open' && t.id !== wachtend?.id),
    [trades, wachtend],
  );

  // Een gesloten trade zonder slotTijd is niet in een tijdvak te plaatsen en telt dus alleen bij
  // 'Alles' mee, net als in periodeResultaat.ts.
  const inPeriode = useMemo(() => {
    const grens = periodeGrens(periode, Date.now());
    return alleGesloten
      .filter(t => grens === null || (typeof t.slotTijd === 'number' && t.slotTijd >= grens))
      .sort((a, b) => (b.slotTijd ?? 0) - (a.slotTijd ?? 0));
  }, [alleGesloten, periode]);

  const samenvatting = useMemo(() => berekenSamenvatting(inPeriode), [inPeriode]);

  // Het Demo-label zegt alleen iets als er ook echte trades tussen staan. Staat alles in demo, dan
  // is het op elke rij hetzelfde woord en dus ruis.
  const toonDemo = useMemo(() => {
    const demo = alleGesloten.some(t => t.etoroOmgeving === 'demo');
    const echt = alleGesloten.some(t => t.etoroOmgeving !== 'demo');
    return demo && echt;
  }, [alleGesloten]);

  const groepen = useMemo(() => {
    const zichtbaar = inPeriode.filter(t => uitkomst === 'alles' || t.status === uitkomst);
    return groepeerPerMaand(zichtbaar);
  }, [inPeriode, uitkomst]);

  const kiesPeriode = (id: PeriodeId) => { setPeriode(id); haptiek('tik'); };
  const kiesUitkomst = (id: Uitkomst) => { setUitkomst(id); haptiek('tik'); };

  return (
    <PodiumScherm zichtbaar={zichtbaar} onSluiten={onSluiten}>
      {sluit => (
        <View style={[styles.root, { backgroundColor: colors.achtergrond }]}>
          <View style={[styles.header, { borderBottomColor: colors.rand, paddingTop: spacing.base + extraKopruimte }]}>
            <View style={styles.headerLinks}>
              <History size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
              <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Historie</Text>
            </View>
            <Pressable
              onPress={() => sluit()}
              style={styles.sluitKnop}
              accessibilityRole="button"
              accessibilityLabel="Sluiten"
              hitSlop={8}
            >
              <X size={22} color={colors.tekstGedimd} strokeWidth={1.75} />
            </Pressable>
          </View>

          {alleGesloten.length === 0 && !wachtend ? (
            <View style={styles.leeg}>
              <LegeStaatBeeld>
                <History size={26} color={colors.primair} strokeWidth={1.5} />
              </LegeStaatBeeld>
              <Text style={[Type.sectiekop, { color: colors.tekstPrimair, marginTop: spacing.base }]}>
                Nog niets afgesloten
              </Text>
              <Text style={[Type.body, { color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.sm, lineHeight: 24 }]}>
                Zodra een trade sluit, via eToro of door hem zelf af te sluiten, staat hij hier met het resultaat.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xl + insets.bottom + (wachtend ? 64 : 0) }]}
              showsVerticalScrollIndicator={false}
            >
              <SegmentKnop opties={PERIODE_OPTIES} actief={periode} onKies={kiesPeriode} />

              {inPeriode.length === 0 ? (
                <Text style={[Type.body, styles.periodeLeeg, { color: colors.tekstGedimd }]}>
                  Geen afgesloten trades in deze periode.
                </Text>
              ) : (
                <>
                  <Samenvatting s={samenvatting} periode={periode} />
                  <SegmentKnop opties={UITKOMST_OPTIES} actief={uitkomst} onKies={kiesUitkomst} />

                  {groepen.length === 0 ? (
                    <Text style={[Type.body, styles.periodeLeeg, { color: colors.tekstGedimd }]}>
                      {uitkomst === 'gewonnen' ? 'Geen gewonnen trades in deze periode.' : 'Geen verloren trades in deze periode.'}
                    </Text>
                  ) : groepen.map(g => (
                    <Animated.View key={g.sleutel} layout={schuifOvergang(reduceMotion)} style={styles.groep}>
                      <View style={styles.groepKop}>
                        <Text accessibilityRole="header" style={[Type.overline, { color: colors.tekstGedimd }]}>{g.titel}</Text>
                        {g.totaal !== null && (
                          <Text style={[styles.groepTotaal, { color: g.totaal >= 0 ? colors.winst : colors.verlies }]}>
                            {fmtResultaatUsd(g.totaal)}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.groepKaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
                        {g.trades.map((trade, i) => (
                          <Animated.View
                            key={trade.id}
                            layout={schuifOvergang(reduceMotion)}
                            exiting={uitklapUit()}
                          >
                            {i > 0 && <View style={[styles.scheiding, { backgroundColor: colors.rand }]} />}
                            <VeegRij onVerwijder={() => veegWeg(trade)}>
                              <TradeRij trade={trade} toonDemo={toonDemo} onOpenDetail={() => onOpenDetail(trade)} onVerwijder={() => veegWeg(trade)} />
                            </VeegRij>
                          </Animated.View>
                        ))}
                      </View>
                    </Animated.View>
                  ))}

                  <Text style={[Type.caption, styles.voetnoot, { color: colors.tekstGedimd }]}>
                    Trades uit eToro tonen het resultaat na kosten. Bij handmatige trades is het het koersverschil. Veeg een trade naar links om hem te verwijderen.
                  </Text>
                </>
              )}
            </ScrollView>
          )}

          {wachtend && (
            <Animated.View
              entering={uitklapIn(reduceMotion)}
              exiting={uitklapUit()}
              style={[styles.ongedaan, shadow.modal, { backgroundColor: colors.tekstPrimair, bottom: spacing.base + insets.bottom }]}
              accessibilityLiveRegion="polite"
            >
              <Text style={[Type.body, { color: colors.achtergrond, flexShrink: 1 }]} numberOfLines={1}>
                {wachtend.symbool}-trade verwijderd
              </Text>
              <Pressable onPress={maakOngedaan} style={styles.ongedaanKnop} accessibilityRole="button" hitSlop={8}>
                {/* De melding is omgekeerd van kleur, dus de knop ook: lichtblauw op donker, donkerblauw op licht. */}
                <Text style={[Type.body, { color: donkerActief ? '#1E3A8A' : '#93C5FD', fontWeight: '600' }]}>Ongedaan maken</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      )}
    </PodiumScherm>
  );
}

// ---------- Samenvatting ----------

interface SamenvattingData {
  aantal: number;
  gewonnen: number;
  verloren: number;
  totaalUsd: number | null;
  totaalPct: number | null;
  trefferpercentage: number | null;
  gemRR: number | null;
  gemLooptijdDagen: number | null;
  // Cumulatief resultaat, oudste eerst en beginnend bij 0.
  verloop: number[];
}

function berekenSamenvatting(gesloten: PortfolioTrade[]): SamenvattingData {
  const stats = berekenStatistieken(gesloten);
  const gewonnen = gesloten.filter(t => t.status === 'gewonnen').length;

  // Het percentage alleen over trades waarvan zowel het resultaat als de inleg bekend is. Een
  // resultaat zonder inleg in de teller zonder iets in de noemer zou het percentage opblazen.
  let resultaatMetBasis = 0;
  let basis = 0;
  for (const t of gesloten) {
    const r = resultaatVan(t);
    const inleg = typeof t.aantalCoins === 'number' && t.aantalCoins > 0
      ? t.entryPrijs * t.aantalCoins
      : t.bedragUsd;
    if (r !== null && typeof inleg === 'number' && inleg > 0) {
      resultaatMetBasis += r;
      basis += inleg;
    }
  }

  const looptijden = gesloten
    .filter(t => typeof t.openTijd === 'number' && typeof t.slotTijd === 'number')
    .map(t => Math.max(0, (t.slotTijd! - t.openTijd!) / DAG_MS));

  const verloop = [0];
  [...gesloten]
    .filter(t => typeof t.slotTijd === 'number')
    .sort((a, b) => a.slotTijd! - b.slotTijd!)
    .forEach(t => {
      const r = resultaatVan(t);
      if (r !== null) verloop.push(verloop[verloop.length - 1] + r);
    });

  return {
    aantal: gesloten.length,
    gewonnen,
    verloren: gesloten.length - gewonnen,
    totaalUsd: stats.totaalResultaatUsd,
    totaalPct: basis > 0 ? (resultaatMetBasis / basis) * 100 : null,
    trefferpercentage: stats.trefferpercentage,
    gemRR: stats.gemBehaaldeRR,
    gemLooptijdDagen: looptijden.length > 0 ? looptijden.reduce((s, v) => s + v, 0) / looptijden.length : null,
    verloop,
  };
}

const PERIODE_KOP: Record<PeriodeId, string> = {
  dag: 'RESULTAAT VANDAAG',
  '1M': 'RESULTAAT AFGELOPEN MAAND',
  '3M': 'RESULTAAT AFGELOPEN 3 MAANDEN',
  '6M': 'RESULTAAT AFGELOPEN 6 MAANDEN',
  '1J': 'RESULTAAT AFGELOPEN JAAR',
  alles: 'RESULTAAT TOTAAL',
};

function Samenvatting({ s, periode }: { s: SamenvattingData; periode: PeriodeId }) {
  const { colors } = useTheme();
  const totaalKleur = s.totaalUsd === null ? colors.tekstPrimair : s.totaalUsd >= 0 ? colors.winst : colors.verlies;

  return (
    <View style={[styles.samenvatting, shadow.kaart, { backgroundColor: colors.kaart }]}>
      <View style={styles.samenKop}>
        <View style={{ flexShrink: 1, gap: 2 }}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{PERIODE_KOP[periode]}</Text>
          <Text style={[styles.totaal, { color: totaalKleur }]}>
            {s.totaalUsd !== null ? fmtResultaatUsd(s.totaalUsd) : '—'}
          </Text>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
            {s.aantal === 1 ? 'uit 1 afgesloten trade' : `uit ${s.aantal} afgesloten trades`}
          </Text>
        </View>
        {s.totaalPct !== null && (
          <View style={[styles.pctPil, { backgroundColor: (s.totaalPct >= 0 ? colors.winst : colors.verlies) + '1F' }]}>
            <Text style={[styles.pctTekst, { color: s.totaalPct >= 0 ? colors.winst : colors.verlies }]}>
              {fmtPct(s.totaalPct)}
            </Text>
          </View>
        )}
      </View>

      {/* Pas bij twee resultaten is er een verloop; één punt na nul is een streep, geen lijn. */}
      {s.verloop.length >= 3 && (
        <View accessibilityLabel="Verloop van het resultaat over de periode">
          <Sparkline reeks={s.verloop} hoogte={56} vlak stip />
        </View>
      )}

      <View style={[styles.statRij, { borderTopColor: colors.rand }]}>
        <View style={styles.stat}>
          <Text style={[styles.statWaarde, { color: colors.tekstPrimair }]}>
            {s.trefferpercentage !== null ? `${Math.round(s.trefferpercentage)}%` : '—'}
          </Text>
          {s.aantal > 0 && (
            <View style={styles.verhoudingBalk} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {s.gewonnen > 0 && <View style={{ flex: s.gewonnen, backgroundColor: colors.winst }} />}
              {s.verloren > 0 && <View style={{ flex: s.verloren, backgroundColor: colors.verlies }} />}
            </View>
          )}
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
            TREFFERS {s.gewonnen}/{s.aantal}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statWaarde, { color: colors.tekstPrimair }]}>
            {s.gemRR !== null ? fmtRR(s.gemRR) : '—'}
          </Text>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>GEM. R/R</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statWaarde, { color: colors.tekstPrimair }]}>
            {s.gemLooptijdDagen !== null ? `${s.gemLooptijdDagen.toFixed(1)} d` : '—'}
          </Text>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>GEM. LOOPTIJD</Text>
        </View>
      </View>
    </View>
  );
}

// ---------- Groeperen ----------

function groepeerPerMaand(trades: PortfolioTrade[]): MaandGroep[] {
  const groepen = new Map<string, MaandGroep>();
  for (const t of trades) {
    let sleutel = 'zonder-datum';
    let titel = 'ZONDER SLUITDATUM';
    if (typeof t.slotTijd === 'number') {
      const d = new Date(t.slotTijd);
      sleutel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      titel = d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }).toUpperCase();
    }
    let g = groepen.get(sleutel);
    if (!g) {
      g = { sleutel, titel, totaal: null, trades: [] };
      groepen.set(sleutel, g);
    }
    g.trades.push(t);
    const r = resultaatVan(t);
    if (r !== null) g.totaal = (g.totaal ?? 0) + r;
  }
  // De invoer is al nieuwste eerst gesorteerd, en trades zonder slotTijd staan achteraan.
  return [...groepen.values()];
}

function korteDatum(ms: number): string {
  return new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }).replace('.', '');
}

function looptijdTekst(t: PortfolioTrade): string {
  if (typeof t.openTijd === 'number' && typeof t.slotTijd === 'number') {
    const dagen = Math.round(Math.max(0, t.slotTijd - t.openTijd) / DAG_MS);
    const duurTekst = dagen === 0 ? 'binnen een dag' : dagen === 1 ? '1 dag' : `${dagen} dagen`;
    return `${korteDatum(t.openTijd)} → ${korteDatum(t.slotTijd)} · ${duurTekst}`;
  }
  return `${t.datum}${t.slotDatum ? ` → ${t.slotDatum}` : ''}`;
}

function fmtR(r: number): string {
  // Punt als decimaalteken, net als fmtPct ernaast.
  return `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}R`;
}

// ---------- Rij ----------

function TradeRij({ trade, toonDemo, onOpenDetail, onVerwijder }: {
  trade: PortfolioTrade;
  toonDemo: boolean;
  onOpenDetail: () => void;
  onVerwijder: () => void;
}) {
  const { colors } = useTheme();
  // Het detailscherm groeit uit deze rij, dus de rij veert mee bij indrukken.
  const druk = useDrukVeer(undefined, { kleur: colors.kaart, radius: radii.kaart });
  const gewonnen = trade.status === 'gewonnen';

  const teken = tekenVan(trade);
  const behaaldPct = trade.exitPrijs !== undefined
    ? (trade.exitPrijs - trade.entryPrijs) / trade.entryPrijs * 100 * teken
    : null;
  const usd = resultaatVan(trade);
  const r = behaaldeRR(trade);
  // Kleuren op het bedrag, niet op het koersverschil: een trade kan net boven entry sluiten en na
  // kosten toch verlies zijn, en dan hoort er geen groen bedrag naast het label "Verloren".
  const kleur = usd !== null
    ? (usd >= 0 ? colors.winst : colors.verlies)
    : gewonnen ? colors.winst : colors.verlies;
  const statusKleur = gewonnen ? colors.winst : colors.verlies;
  const subregel = [behaaldPct !== null ? fmtPct(behaaldPct) : null, r !== null ? fmtR(r) : null]
    .filter(Boolean).join(' · ');

  return (
    <Animated.View ref={druk.ref} style={[{ backgroundColor: colors.kaart }, druk.stijl]}>
      <Pressable
        onPress={() => { druk.legBronVast(); onOpenDetail(); }}
        onPressIn={druk.drukIn}
        onPressOut={druk.drukUit}
        style={styles.rij}
        accessibilityRole="button"
        accessibilityLabel={`${trade.symbool}, ${gewonnen ? 'gewonnen' : 'verloren'}${usd !== null ? `, ${fmtResultaatUsd(usd)}` : ''}`}
        accessibilityHint="Opent het detail"
        accessibilityActions={[{ name: 'verwijder', label: 'Verwijderen' }]}
        onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'verwijder') onVerwijder(); }}
      >
        <CoinLogo symbool={trade.symbool} grootte={36} />
        <View style={styles.rijMidden}>
          <View style={styles.rijKop}>
            <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]} numberOfLines={1}>{trade.symbool}</Text>
            <View style={[styles.statusPil, { backgroundColor: statusKleur + '1F' }]}>
              {gewonnen
                ? <Check size={11} color={statusKleur} strokeWidth={2.5} />
                : <X size={11} color={statusKleur} strokeWidth={2.5} />}
              <Text style={[styles.statusTekst, { color: statusKleur }]}>{gewonnen ? 'Gewonnen' : 'Verloren'}</Text>
            </View>
            {toonDemo && trade.etoroOmgeving === 'demo' && (
              <View style={[styles.demoPil, { borderColor: colors.rand }]}>
                <Text style={[styles.statusTekst, { color: colors.tekstGedimd }]}>Demo</Text>
              </View>
            )}
          </View>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]} numberOfLines={1}>{looptijdTekst(trade)}</Text>
        </View>
        <View style={styles.rijRechts}>
          <Text style={[styles.rijBedrag, { color: kleur }]}>
            {usd !== null ? fmtResultaatUsd(usd) : behaaldPct !== null ? fmtPct(behaaldPct) : '—'}
          </Text>
          {usd !== null && subregel ? (
            <Text style={[styles.rijSub, { color: colors.tekstGedimd }]}>{subregel}</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Naar links vegen legt de rode verwijderbalk bloot. Voorbij de drempel volgt een tik, en loslaten
// voorbij de drempel (of met een snelle zwiep) verwijdert. Alleen naar links, zodat het
// veeg-terug-gebaar van PodiumScherm vanaf de linkerrand niet in de weg zit.
function VeegRij({ children, onVerwijder }: { children: React.ReactNode; onVerwijder: () => void }) {
  const { colors } = useTheme();
  const breedte = useSharedValue(0);
  const x = useSharedValue(0);
  const voorbij = useSharedValue(false);

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-12, 10000])
    .failOffsetY([-10, 10])
    .onUpdate(e => {
      'worklet';
      x.value = Math.min(0, e.translationX);
      const nu = -x.value > breedte.value * 0.4;
      if (nu !== voorbij.value) {
        voorbij.value = nu;
        haptiekVanUI('drempel');
      }
    })
    .onEnd(e => {
      'worklet';
      if (voorbij.value || e.velocityX < -1200) {
        x.value = withTiming(-breedte.value, { duration: duur.midden }, klaar => {
          if (klaar) scheduleOnRN(onVerwijder);
        });
      } else {
        x.value = withSpring(0, { ...veer.snel, velocity: e.velocityX });
      }
      voorbij.value = false;
    }), [onVerwijder, x, breedte, voorbij]);

  const voorStijl = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const achterStijl = useAnimatedStyle(() => ({
    opacity: interpolate(-x.value, [0, 48], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View onLayout={(e: LayoutChangeEvent) => { breedte.value = e.nativeEvent.layout.width; }}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.veegAchter, { backgroundColor: colors.verlies }, achterStijl]}>
        <Trash2 size={20} color="#FFFFFF" strokeWidth={1.75} />
        <Text style={[Type.caption, { color: '#FFFFFF', fontWeight: '600' }]}>Verwijder</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={voorStijl}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  leeg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  scroll: { padding: spacing.base, gap: spacing.md },
  periodeLeeg: { textAlign: 'center', marginTop: spacing.lg },
  samenvatting: { borderRadius: radii.kaart, padding: spacing.base, gap: spacing.md },
  samenKop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  totaal: { fontFamily: Fonts.monoMedium, fontSize: 28, lineHeight: 36 },
  pctPil: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pctTekst: { fontFamily: Fonts.monoMedium, fontSize: 12.5 },
  statRij: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, gap: 4 },
  statWaarde: { fontFamily: Fonts.monoMedium, fontSize: 16 },
  verhoudingBalk: { flexDirection: 'row', gap: 2, height: 4, borderRadius: 2, overflow: 'hidden' },
  groep: { gap: spacing.xs + 2 },
  groepKop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  groepTotaal: { fontFamily: Fonts.monoMedium, fontSize: 12.5 },
  groepKaart: { borderRadius: radii.kaart, overflow: 'hidden' },
  scheiding: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    minHeight: 64,
  },
  rijMidden: { flex: 1, minWidth: 0, gap: 3 },
  rijKop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusPil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  demoPil: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 6, paddingVertical: 1 },
  statusTekst: { fontSize: 11, fontWeight: '600' },
  rijRechts: { alignItems: 'flex-end', gap: 3 },
  rijBedrag: { fontFamily: Fonts.monoMedium, fontSize: 15 },
  rijSub: { fontFamily: Fonts.monoMedium, fontSize: 12 },
  veegAchter: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: spacing.lg,
    gap: 2,
  },
  voetnoot: { marginHorizontal: spacing.xs, lineHeight: 19 },
  ongedaan: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    borderRadius: 14,
    paddingLeft: spacing.base,
    paddingRight: spacing.xs,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ongedaanKnop: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
});
