import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { RefreshCw, Radar } from 'lucide-react-native';
import { useKansen, KansMetRang } from '../state/KansenProvider';
import { useTabZichtbaar } from '../state/tabZichtbaar';
import { useReduceMotion } from '../theme/useReduceMotion';
import { kaartLandt, schuifOvergang, uitklapIn, uitklapUit } from '../theme/lijstBeweging';
import { haptiek } from '../theme/haptiek';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { limietVoor, useStopLossLimieten } from '../state/useStopLossLimiet';
import { useFavorieten } from '../state/useFavorieten';
import { Disclaimer } from '../components/Disclaimer';
import { ScreenHeader } from '../components/ScreenHeader';
import { SkeletonCard } from '../components/SkeletonCard';
import { Drukbaar } from '../components/Drukbaar';
import { OfflineMelding } from '../components/OfflineMelding';
import { Laadbalk } from '../components/Laadbalk';
import { useCoinDetail } from '../components/CoinDetailScherm';
import { vanOpportunity } from '../engine/coinDetailData';
import { GetradeFormulier, GetradeBron } from '../components/GetradeFormulier';
import { KooporderSheet } from '../components/KooporderSheet';
import { usePortfolio } from '../state/PortfolioProvider';
import { useValutaStand } from '../state/useValuta';
import { LegeStaatBeeld, Opkomst } from '../components/LegeStaatBeeld';
import { KansKaart } from '../components/KansKaart';
import { KansenTop3 } from '../components/KansenTop3';

// Zoveel coins staan in de carrousel bovenaan. Alleen bij een gevulde radar met minstens zoveel
// coins: met minder is er niets te swipen en staat alles al in de lijst eronder. Niet alleen KOOP,
// want dat komt zelden voor; de carrousel is de drie die het dichtst bij hun top staan.
const TOP_AANTAL = 3;

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
  const [koopKans, setKoopKans] = useState<KansMetRang | null>(null);
  // Eén keer per scherm de stop-loss-grenzen van eToro, zie MarktScreen voor het waarom.
  const stopLimieten = useStopLossLimieten();
  const { magHandelen } = usePortfolio();
  const { isFavoriet, wisselFavoriet } = useFavorieten();

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

  // Stabiele callbacks, zodat de gememoiseerde kaarten niet bij elke scan-tik opnieuw tekenen.
  const opOpenDetail = useCallback(
    (k: KansMetRang) => openDetail(vanOpportunity(k)),
    [openDetail],
  );
  // Het radar-uitbraakplan, niet de Markt-niveaus: k.niveaus heeft entry, stopLoss, takeProfit, rr.
  const opGetrade = useCallback(
    (k: KansMetRang) => { if (k.niveaus) setGetradeteKans({ symbool: k.symbool, ...k.niveaus }); },
    [],
  );

  // Eén lijst voor laden en klaar, net als op het Marktscherm: kaarten die tijdens de scan landen
  // blijven gewoon liggen als hij afrondt. Ze zijn meteen tikbaar, want elke kaart is op dat moment
  // al definitief: de tussenstand is een deelverzameling van de eindlijst in dezelfde volgorde (zie
  // onTussenstand in opportunities.ts). Een kaart kan nog schuiven, maar verdwijnt niet. Een halve
  // lijst heeft geen eerlijke plek, dus zonder rangverschil.
  const laden = state.status === 'loading';
  const tussenstand = state.status === 'loading' ? state.tussenstand : null;
  const lijst: KansMetRang[] = useMemo(() => {
    if (state.status === 'success') return state.kansen;
    return tussenstand ? tussenstand.map(k => ({ ...k, rangVerschil: null })) : [];
  }, [state, tussenstand]);

  const radarLeeg = state.status === 'success' && state.radarLeeg;
  const top = useMemo(
    () => (state.status === 'success' && !state.radarLeeg && state.kansen.length >= TOP_AANTAL
      ? [...state.kansen].sort((a, b) => b.momentumScore - a.momentumScore).slice(0, TOP_AANTAL)
      : []),
    [state],
  );

  const metaText = state.status === 'success'
    ? `${state.kansen.length} ${state.kansen.length === 1 ? 'coin' : 'coins'} · ${state.lastUpdate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
    : undefined;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: colors.achtergrond }]}>
      <ScreenHeader
        titel="Momentum-radar"
        meta={metaText}
        rechts={
          state.status === 'success' ? (
            <Drukbaar
              onPress={handleVervers}
              accessibilityRole="button"
              accessibilityLabel="Ververs radar"
              style={styles.ververskOp}
              schaal={0.9}
            >
              <RefreshCw size={18} color={colors.cta} strokeWidth={1.75} />
            </Drukbaar>
          ) : undefined
        }
      />

      {state.status === 'idle' && (
        <View style={styles.midden}>
          <Opkomst volgorde={0}>
            <LegeStaatBeeld>
              <Radar size={26} color={colors.primair} strokeWidth={1.5} />
            </LegeStaatBeeld>
          </Opkomst>
          <Opkomst volgorde={1}>
            <Text style={[Type.titel, styles.middenTitel, { color: colors.tekstPrimair }]}>
              Nog geen radar
            </Text>
          </Opkomst>
          <Opkomst volgorde={2}>
            <Text style={[Type.body, styles.middenBody, { color: colors.tekstGedimd }]}>
              De radar zoekt coins die dicht bij hun hoogste koers van 90 dagen staan en dus voorop
              lopen.
            </Text>
          </Opkomst>
          <Opkomst volgorde={3}>
            <Drukbaar
              style={[styles.ctaKnop, { backgroundColor: colors.cta }]}
              onPress={() => scan()}
              accessibilityRole="button"
              accessibilityLabel="Start scan"
            >
              <Radar size={16} color="white" strokeWidth={2} />
              <Text style={[Type.body, styles.ctaTekst]}>Start scan</Text>
            </Drukbaar>
          </Opkomst>
          <Opkomst volgorde={4}>
            <Text style={[Type.caption, styles.bron, { color: colors.tekstGedimd }]}>
              Data via CoinGecko en Binance
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
              <KansKaart
                kans={item}
                volgorde={index}
                onOpenDetail={opOpenDetail}
                onGetrade={opGetrade}
                onKoop={magHandelen ? setKoopKans : undefined}
                favoriet={isFavoriet(item.symbool)}
                onToggleFavoriet={wisselFavoriet}
                limiet={limietVoor(stopLimieten, item.symbool)}
              />
            </Animated.View>
          )}
          contentContainerStyle={styles.lijst}
          refreshControl={
            // Altijd aanwezig, tijdens het laden alleen uitgeschakeld: zie MarktScreen voor waarom
            // hem weghalen de lijst opnieuw zou opbouwen. Een stille scan die vanzelf start (zie
            // scanAlsVerouderd) laat ook de draaier zien, anders ververst de lijst ongemerkt.
            <RefreshControl
              refreshing={ververst || (bezig && !laden)}
              onRefresh={trekVervers}
              enabled={!laden}
              colors={[colors.cta]}
              tintColor={colors.cta}
            />
          }
          ListHeaderComponent={
            state.status === 'loading' ? (
              <Animated.View exiting={uitklapUit()}>
                {state.totaal > 0 && <Laadbalk huidig={state.gescand} totaal={state.totaal} kleur={colors.cta} />}
                <View style={styles.lijstKop}>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                    {state.totaal > 0 ? `${state.gescand} van ${state.totaal} coins bekeken` : 'Coins ophalen'}
                  </Text>
                </View>
              </Animated.View>
            ) : (
              <Animated.View entering={uitklapIn(reduceMotion)}>
                <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>
                  Coins die dicht bij hun hoogste koers van 90 dagen staan.
                </Text>
                {radarLeeg ? (
                  <View style={[styles.leeg, { backgroundColor: colors.kaart }]}>
                    <LegeStaatBeeld maat={64}>
                      <Radar size={22} color={colors.tekstGedimd} strokeWidth={1.5} />
                    </LegeStaatBeeld>
                    <Text style={[Type.sectiekop, styles.leegTitel, { color: colors.tekstPrimair }]}>
                      Niets loopt echt voorop
                    </Text>
                    <Text style={[Type.body, styles.leegTekst, { color: colors.tekstGedimd }]}>
                      Geen enkele coin staat dicht genoeg bij zijn 90d-top om op de radar te komen.
                      Kader vult de lijst niet aan met zwakkere coins. Hieronder de drie die er nog
                      het dichtst bij zitten, zonder koopsignaal.
                    </Text>
                  </View>
                ) : (
                  <>
                    {top.length === TOP_AANTAL && (
                      <KansenTop3 kansen={top} onOpenDetail={opOpenDetail} />
                    )}
                    <Text style={[Type.overline, styles.lijstKop, { color: colors.tekstGedimd }]}>
                      {state.status === 'success'
                        ? `${state.kansen.length} van ${state.gescand} coins op de radar · gesorteerd op momentum`
                        : ''}
                    </Text>
                  </>
                )}
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

const styles = StyleSheet.create({
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
  bron: { textAlign: 'center', marginTop: spacing.base },
  lijst: { paddingTop: spacing.md, paddingBottom: spacing.md },
  lijstKop: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  uitleg: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    lineHeight: 18,
  },
  leeg: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderRadius: radii.kaart,
    padding: spacing.base,
    alignItems: 'center',
    gap: spacing.sm,
  },
  leegTitel: { textAlign: 'center', marginTop: spacing.sm },
  leegTekst: { textAlign: 'center', lineHeight: 22 },
});
