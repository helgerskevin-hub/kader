import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { RefreshCw, Zap, CheckCircle, ShoppingCart } from 'lucide-react-native';
import { Opportunity } from '../engine/types';
import { useKansen } from '../state/KansenProvider';
import { useTabZichtbaar } from '../state/tabZichtbaar';
import { useReduceMotion } from '../theme/useReduceMotion';
import { kaartLandt, schuifOvergang, uitklapIn, uitklapUit } from '../theme/lijstBeweging';
import { haptiek } from '../theme/haptiek';
import { fmtPrijs, fmtPct, fmtRR, fmtMarktcap, fmtScore } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { LevelRow } from '../components/LevelRow';
import { StopLossLimiet, etoroNiveaus } from '../engine/etoroLimieten';
import { limietVoor, useStopLossLimieten } from '../state/useStopLossLimiet';
import { Disclaimer } from '../components/Disclaimer';
import { ScreenHeader } from '../components/ScreenHeader';
import { SkeletonCard } from '../components/SkeletonCard';
import { Drukbaar, useDrukVeer } from '../components/Drukbaar';
import { OfflineMelding } from '../components/OfflineMelding';
import { Laadbalk } from '../components/Laadbalk';
import { useCoinDetail } from '../components/CoinDetailScherm';
import { vanOpportunity } from '../engine/coinDetailData';
import { GetradeFormulier, GetradeBron } from '../components/GetradeFormulier';
import { KooporderSheet } from '../components/KooporderSheet';
import { usePortfolio } from '../state/PortfolioProvider';
import { useValutaStand } from '../state/useValuta';
import { UitklapPijl } from '../components/UitklapPijl';
import { LegeStaatBeeld, Opkomst } from '../components/LegeStaatBeeld';

// ---------- OpportunityCard ----------
function OpportunityCard({ kans, onOpenDetail, onGetrade, onKoop, limiet = null }: {
  kans: Opportunity;
  onOpenDetail: (kans: Opportunity) => void;
  onGetrade: (kans: Opportunity) => void;
  // Ontbreekt zonder schrijfrecht; dan is de kaart identiek aan vroeger.
  onKoop?: (kans: Opportunity) => void;
  // De stop-loss-grens van eToro voor deze coin. Zonder grens blijft het niveau van Kader staan.
  limiet?: StopLossLimiet | null;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);
  // Zelfde als TradeCard: de hele kaart veert mee, ook al druk je alleen het bovenste deel in, en
  // het detailscherm groeit uit de hele kaart.
  const druk = useDrukVeer(undefined, { kleur: colors.kaart, radius: radii.kaart });
  // Het uitbraak-plan van de radar, niet de Markt-niveaus uit kans.trade (zie momentum.ts).
  const plan = kans.niveaus;
  const niveaus = plan ? etoroNiveaus(plan.entry, plan.stopLoss, plan.takeProfit, limiet) : null;
  const trendOp = kans.trade.ema20 > kans.trade.ema50;

  const randKleur = kans.signaal === 'KOOP' ? colors.winst : colors.letOp;

  const pctKleur = (p: number) =>
    p > 0 ? colors.winst : p < 0 ? colors.verlies : colors.tekstGedimd;

  // Zelfde uitklap als TradeCard: de kaart groeit op een veer, de redenen vervagen in en de voet
  // schuift mee. Kaarten eronder volgen via itemLayoutAnimation op de lijst.
  const schuif = schuifOvergang(reduceMotion);

  function wisselUitgeklapt() {
    setUitgeklapt(v => !v);
  }

  return (
    <Animated.View ref={druk.ref} layout={schuif} style={[cardStyles.kaart, shadow.kaart, { backgroundColor: colors.kaart, borderLeftColor: randKleur }, druk.stijl]}>
      <Pressable
        onPress={() => {
          druk.legBronVast();
          onOpenDetail(kans);
        }}
        onPressIn={druk.drukIn}
        onPressOut={druk.drukUit}
        accessibilityRole="button"
        accessibilityLabel={`${kans.symbool} detail bekijken`}
      >
      {/* Koptekst */}
      <View style={cardStyles.kop}>
        <View style={cardStyles.kopLinks}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{kans.naam}</Text>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
            {kans.symbool}{kans.marktcap !== null ? ` · ${fmtMarktcap(kans.marktcap)}` : ''}
          </Text>
        </View>
        <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>{fmtPrijs(kans.prijs)}</Text>
      </View>

      {/* Percentage-rij */}
      <View style={cardStyles.pctRij}>
        {([
          { label: '7D', val: kans.ingredienten.rendement7d },
          { label: '30D', val: kans.ingredienten.rendement30d },
          { label: 'VS BTC 30D', val: kans.ingredienten.rsBtc30d },
        ] as const).map(({ label, val }) => val !== null && (
          <View key={label} style={cardStyles.pctItem}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{label}</Text>
            <Text style={[Type.prijs, { color: pctKleur(val), fontSize: 13 }]}>{fmtPct(val)}</Text>
          </View>
        ))}
      </View>

      {/* Technische rij */}
      <View style={[cardStyles.pctRij, { paddingTop: 0 }]}>
        <View style={cardStyles.pctItem}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>RSI</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>{Math.round(kans.trade.rsi)}</Text>
        </View>
        <View style={cardStyles.pctItem}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>TREND</Text>
          <Text style={[Type.prijs, { color: trendOp ? colors.winst : colors.verlies, fontSize: 13 }]}>
            {trendOp ? 'Op' : 'Neer'}
          </Text>
        </View>
        <View style={cardStyles.pctItem}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>MACD</Text>
          <Text style={[Type.prijs, { color: kans.trade.macdBullish ? colors.winst : colors.verlies, fontSize: 13 }]}>
            {kans.trade.macdBullish ? 'Bullish' : 'Bearish'}
          </Text>
        </View>
      </View>

      {/* Niveaus */}
      {plan && niveaus && (
        <View style={cardStyles.sectie}>
          <LevelRow
            stop={niveaus.stop}
            entry={plan.entry}
            doel={plan.takeProfit}
            stopAangepast={niveaus.aangepast}
          />
          {niveaus.uitleg ? (
            <Text style={[Type.caption, { color: colors.letOp, lineHeight: 18, marginTop: 4 }]}>
              {niveaus.uitleg}
            </Text>
          ) : null}
        </View>
      )}

      {/* R/R + momentumscore + signaal */}
      <View style={cardStyles.rrRij}>
        {niveaus && (
          <View style={cardStyles.rrItem}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>R/R</Text>
            <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtRR(niveaus.rr)}</Text>
          </View>
        )}
        <View style={cardStyles.rrItem}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>MOMENTUM</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtScore(kans.momentumScore)}</Text>
        </View>
        <View style={[cardStyles.methodeBadge, { backgroundColor: colors.verhoogd }]}>
          <Text style={[Type.overline, { color: kans.signaal === 'KOOP' ? colors.winst : colors.tekstGedimd }]}>{kans.signaal}</Text>
        </View>
      </View>
      </Pressable>

      {/* Uitklapbare redenen */}
      {uitgeklapt && (
        <Animated.View
          entering={uitklapIn(reduceMotion)}
          exiting={uitklapUit()}
          style={[cardStyles.redenen, { backgroundColor: colors.verhoogd }]}
        >
          {kans.redenen.map((r, i) => (
            <Text key={i} style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>• {r}</Text>
          ))}
        </Animated.View>
      )}

      {/* Voet */}
      <Animated.View layout={schuif} style={[
        cardStyles.voet,
        { borderTopColor: colors.rand, justifyContent: plan ? 'space-between' : 'flex-end' },
      ]}>
        {plan && (
          <Pressable
            style={cardStyles.voetKnop}
            onPress={() => onGetrade(kans)}
            accessibilityRole="button"
            accessibilityLabel="Getrade"
          >
            <CheckCircle size={15} color={colors.winst} strokeWidth={1.75} />
            <Text style={[Type.caption, { color: colors.winst }]}>Getrade</Text>
          </Pressable>
        )}
        {/* Alleen bij een KOOP met een plan: zonder entry, stop en doel valt er geen order te bouwen
            die Kaders eigen plan volgt, en bij WATCH zegt Kader zelf dat het nog niet klopt. */}
        {plan && kans.signaal === 'KOOP' && onKoop && (
          <Pressable
            style={cardStyles.voetKnop}
            onPress={() => onKoop(kans)}
            accessibilityRole="button"
            accessibilityLabel={`${kans.symbool} kopen via eToro`}
          >
            <ShoppingCart size={15} color={colors.cta} strokeWidth={1.75} />
            <Text style={[Type.caption, { color: colors.cta }]}>Koop</Text>
          </Pressable>
        )}
        <Pressable
          style={cardStyles.voetKnop}
          onPress={wisselUitgeklapt}
          accessibilityRole="button"
          accessibilityLabel={uitgeklapt ? 'Minder info' : 'Waarom deze kans'}
        >
          <Text style={[Type.caption, { color: colors.cta }]}>
            {uitgeklapt ? 'Minder' : 'Waarom'}
          </Text>
          <UitklapPijl open={uitgeklapt} size={12} color={colors.cta} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    borderLeftWidth: 4,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  kop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.base,
    paddingBottom: spacing.sm,
  },
  kopLinks: { gap: 2, flex: 1 },
  pctRij: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  pctItem: { gap: 2 },
  sectie: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  rrRij: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.base,
  },
  rrItem: { gap: 2 },
  methodeBadge: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  redenen: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderRadius: radii.veld,
    padding: spacing.md,
    gap: 4,
  },
  voet: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.base,
  },
  voetKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.base,
    minHeight: 44,
  },
});

// ---------- Scherm ----------
export function KansenScreen() {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { state, bezig, scan, scanAlsVerouderd } = useKansen();
  const [ververst, setVerverstState] = useState(false);
  const { openDetail, detailScherm } = useCoinDetail();
  const [getradeteKans, setGetradeteKans] = useState<GetradeBron | null>(null);
  const [koopKans, setKoopKans] = useState<Opportunity | null>(null);
  // Eén keer per scherm de stop-loss-grenzen van eToro, zie MarktScreen voor het waarom.
  const stopLimieten = useStopLossLimieten();
  const { magHandelen } = usePortfolio();

  // Scannen zodra dit tabblad in beeld komt, maar alleen als het bewaarde resultaat verouderd is
  // (zie KANSEN_COOLDOWN_MS in KansenProvider). Het scherm wordt vooruit gemount terwijl het nog
  // niet zichtbaar is, dus op mount alleen zou de scan draaien zonder dat iemand kijkt.
  const inBeeld = useTabZichtbaar();
  useEffect(() => {
    if (inBeeld) scanAlsVerouderd();
  }, [inBeeld, scanAlsVerouderd]);

  async function handleVervers() {
    if (ververst) return;
    setVerverstState(true);
    await scan(true);
    setVerverstState(false);
  }

  // Pull-to-refresh: haptic op het moment dat de lijst vastklikt, niet bij de verversknop.
  function trekVervers() {
    haptiek('vastklikken');
    handleVervers();
  }

  // Eén lijst voor laden en klaar, net als op het Marktscherm: kaarten die tijdens de scan landen
  // blijven gewoon liggen als hij afrondt. Ze zijn meteen tikbaar, want elke kaart is op dat moment
  // al definitief: de tussenstand is een deelverzameling van de eindlijst in dezelfde volgorde (zie
  // onTussenstand in opportunities.ts). Een kaart kan nog schuiven, maar verdwijnt niet.
  const laden = state.status === 'loading';
  const lijst: Opportunity[] = state.status === 'success' ? state.kansen : state.status === 'loading' ? state.tussenstand : [];

  const metaText = state.status === 'success'
    ? `${state.kansen.length} coins · ${state.lastUpdate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
    : undefined;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[screenStyles.root, { backgroundColor: colors.achtergrond }]}>
      <ScreenHeader
        titel="Grote kansen"
        meta={metaText}
        rechts={
          state.status === 'success' ? (
            <Drukbaar
              onPress={handleVervers}
              accessibilityRole="button"
              accessibilityLabel="Ververs scan"
              style={screenStyles.ververskOp}
              schaal={0.9}
            >
              <RefreshCw size={18} color={colors.letOp} strokeWidth={1.75} />
            </Drukbaar>
          ) : undefined
        }
      />

      {state.status === 'idle' && (
        <View style={screenStyles.midden}>
          {/* Het bliksemicoon blijft, nu tussen de ademende hoekhaken: dit scherm houdt zijn eigen
              kleur en betekenis, maar hoort zichtbaar bij dezelfde familie als de andere lege staten. */}
          <Opkomst volgorde={0}>
            <LegeStaatBeeld>
              <Zap size={26} color={colors.letOp} strokeWidth={1.5} />
            </LegeStaatBeeld>
          </Opkomst>
          <Opkomst volgorde={1}>
            <Text style={[Type.titel, screenStyles.middenTitel, { color: colors.tekstPrimair }]}>
              Zoek grote kansen
            </Text>
          </Opkomst>
          <Opkomst volgorde={2}>
            <Text style={[Type.body, screenStyles.middenBody, { color: colors.tekstGedimd }]}>
              Zoekt welke coins vlak onder hun hoogste koers van 90 dagen staan en dus voorop lopen.
            </Text>
          </Opkomst>
          <Opkomst volgorde={3}>
            <Drukbaar
              style={[screenStyles.ctaKnop, { backgroundColor: colors.letOp }]}
              onPress={() => scan()}
              accessibilityRole="button"
              accessibilityLabel="Start scan"
            >
              <Zap size={16} color="white" strokeWidth={2} />
              <Text style={[Type.body, screenStyles.ctaTekst]}>Start scan</Text>
            </Drukbaar>
          </Opkomst>
          <Opkomst volgorde={4}>
            <Text style={[Type.caption, { color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.base }]}>
              Data via CoinGecko & Binance · geen financieel advies
            </Text>
          </Opkomst>
        </View>
      )}

      {state.status === 'error' && (
        <OfflineMelding
          titel="Scan mislukt"
          beschrijving="CoinGecko of Binance is niet bereikbaar. Controleer je verbinding."
          melding={state.melding}
          lastAttempt={state.lastAttempt}
          onRetry={() => scan()}
        />
      )}

      {(state.status === 'loading' || state.status === 'success') && (
        <Animated.FlatList
          data={lijst}
          keyExtractor={item => item.symbool}
          itemLayoutAnimation={schuifOvergang(reduceMotion)}
          renderItem={({ item, index }) => (
            // Tijdens het laden landen de kaarten van één blok samen, gestaffeld vanaf de eerste
            // nieuwe. Daarna is de volgorde gewoon de plek in de lijst.
            <Animated.View
              entering={kaartLandt(index, reduceMotion)}
              exiting={uitklapUit()}
            >
              <OpportunityCard
                kans={item}
                onOpenDetail={k => openDetail(vanOpportunity(k))}
                onGetrade={k => k.niveaus && setGetradeteKans({ symbool: k.symbool, ...k.niveaus })}
                onKoop={magHandelen ? setKoopKans : undefined}
                limiet={limietVoor(stopLimieten, item.symbool)}
              />
            </Animated.View>
          )}
          contentContainerStyle={screenStyles.lijst}
          refreshControl={
            // Altijd aanwezig, tijdens het laden alleen uitgeschakeld: zie MarktScreen voor waarom
            // hem weghalen de lijst opnieuw zou opbouwen. Een stille scan die vanzelf start (zie
            // scanAlsVerouderd) laat ook de draaier zien, anders ververst de lijst ongemerkt.
            <RefreshControl
              refreshing={ververst || (bezig && !laden)}
              onRefresh={trekVervers}
              enabled={!laden}
              colors={[colors.letOp]}
              tintColor={colors.letOp}
            />
          }
          ListHeaderComponent={
            state.status === 'loading' ? (
              <Animated.View exiting={uitklapUit()}>
                {state.totaal > 0 && <Laadbalk huidig={state.gescand} totaal={state.totaal} kleur={colors.letOp} />}
                <View style={screenStyles.lijstKop}>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                    {state.totaal > 0 ? `${state.gescand} van ${state.totaal} coins bekeken` : 'Coins ophalen'}
                  </Text>
                </View>
              </Animated.View>
            ) : (
              <Animated.View entering={uitklapIn(reduceMotion)} style={screenStyles.lijstKop}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                  {state.radarLeeg
                    ? `Niets loopt echt voorop · de sterkste ${state.kansen.length} van ${state.gescand} coins`
                    : `${state.kansen.length} van ${state.gescand} coins op de radar · gesorteerd op momentum`}
                </Text>
              </Animated.View>
            )
          }
          ListFooterComponent={
            laden ? (
              <>
                {Array.from({ length: Math.max(1, 3 - lijst.length) }).map((_, i) => (
                  <Animated.View key={i} exiting={uitklapUit()}>
                    <SkeletonCard />
                  </Animated.View>
                ))}
              </>
            ) : (
              <Disclaimer />
            )
          }
        />
      )}

      {detailScherm}
      <GetradeFormulier
        zichtbaar={getradeteKans !== null}
        trade={getradeteKans}
        onSluiten={() => setGetradeteKans(null)}
      />

      {koopKans?.niveaus && (
        <KooporderSheet
          zichtbaar
          symbool={koopKans.symbool}
          naam={koopKans.naam}
          entry={koopKans.niveaus.entry}
          stop={koopKans.niveaus.stopLoss}
          doel={koopKans.niveaus.takeProfit}
          onSluiten={() => setKoopKans(null)}
        />
      )}
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  root: { flex: 1 },
  ververskOp: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  midden: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  middenTitel: { textAlign: 'center', marginBottom: spacing.sm, marginTop: spacing.base },
  middenBody: { textAlign: 'center', marginBottom: spacing.lg, lineHeight: 24 },
  ctaKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    minHeight: 44,
  },
  ctaTekst: { color: 'white', fontWeight: '600' },
  lijst: { paddingTop: spacing.md, paddingBottom: spacing.md },
  lijstKop: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
});
