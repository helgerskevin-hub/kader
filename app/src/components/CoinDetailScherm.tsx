import React, { useEffect, useState } from 'react';
import {
  Modal, ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator,
  Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CheckCircle } from 'lucide-react-native';
import { Candle } from '../engine/types';
import { CoinDetailData, VerseIndicatoren, berekenVerseIndicatoren } from '../engine/coinDetailData';
import { haalData } from '../engine/marketData';
import { infoVoor, genereerKoopadvies } from '../engine/coinInfo';
import { fmtPrijs, fmtRR, fmtPct } from '../engine/format';
import { bepaalAdvies } from '../state/advies';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { ScoreBadge } from './ScoreBadge';
import { LevelRow } from './LevelRow';
import { PrijsGrafiek } from './PrijsGrafiek';
import { OfflineMelding } from './OfflineMelding';
import { Disclaimer } from './Disclaimer';
import { GetradeFormulier, GetradeBron } from './GetradeFormulier';

interface Props {
  data: CoinDetailData | null;
  onSluiten: () => void;
}

// SafeAreaView krijgt geen correcte top-inset binnen een full-screen Modal op Android,
// dus vullen we die hier handmatig aan met de status bar-hoogte.
const androidStatusBarPadding = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

type LaadStatus = 'idle' | 'loading' | 'error' | 'success';

export function CoinDetailScherm({ data, onSluiten }: Props) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<LaadStatus>('idle');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicatoren, setIndicatoren] = useState<VerseIndicatoren | null>(null);
  const [foutTijd, setFoutTijd] = useState<Date>(new Date());
  const [getradeOpen, setGetradeOpen] = useState(false);

  useEffect(() => {
    if (data) laadData(data.symbool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function laadData(symbool: string) {
    setStatus('loading');
    const result = await haalData(symbool);
    const verse = result ? berekenVerseIndicatoren(result.candles) : null;
    if (!result || !verse) {
      setFoutTijd(new Date());
      setStatus('error');
      return;
    }
    setCandles(result.candles);
    setIndicatoren(verse);
    setStatus('success');
  }

  if (!data) return null;

  const coinInfo = infoVoor(data.symbool);
  const heeftNiveaus = data.entry !== undefined && data.stopLoss !== undefined && data.takeProfit !== undefined;
  const kanGetrade = heeftNiveaus && data.context !== 'portfolio';
  const getradeBron: GetradeBron | null = kanGetrade
    ? { symbool: data.symbool, entry: data.entry!, stopLoss: data.stopLoss!, takeProfit: data.takeProfit!, rr: data.rr ?? 0 }
    : null;

  const niveaus = [
    data.stopLoss !== undefined ? { waarde: data.stopLoss, kleur: colors.verlies } : null,
    data.entry !== undefined ? { waarde: data.entry, kleur: colors.cta } : null,
    data.takeProfit !== undefined ? { waarde: data.takeProfit, kleur: colors.winst } : null,
  ].filter((n): n is { waarde: number; kleur: string } => n !== null);

  const advies = indicatoren ? genereerKoopadvies({
    score: data.score,
    rsi: indicatoren.rsi,
    trendOp: indicatoren.trendOp,
    macdBullish: indicatoren.macdBullish,
    volumeRatio: indicatoren.volumeRatio,
  }) : null;
  const adviesKleur = advies?.kleur === 'groen' ? colors.winst : advies?.kleur === 'rood' ? colors.verlies : colors.letOp;

  const isOpen = data.status === 'open';
  const heeftAantal = typeof data.aantalCoins === 'number' && data.aantalCoins > 0;

  const resultaatUsd = data.context === 'portfolio' && isOpen && data.prijs !== undefined && heeftAantal
    ? (data.prijs - (data.entryPrijs ?? 0)) * data.aantalCoins!
    : null;
  const resultaatPct = data.context === 'portfolio' && isOpen && data.prijs !== undefined && data.entryPrijs
    ? (data.prijs - data.entryPrijs) / data.entryPrijs * 100
    : null;
  const resultaatKleur = resultaatUsd !== null ? (resultaatUsd >= 0 ? colors.winst : colors.verlies) : colors.tekstGedimd;

  const behaaldPct = data.context === 'portfolio' && !isOpen && data.exitPrijs !== undefined && data.entryPrijs
    ? (data.exitPrijs - data.entryPrijs) / data.entryPrijs * 100
    : null;
  const behaaldUsd = data.context === 'portfolio' && !isOpen && data.exitPrijs !== undefined && heeftAantal
    ? (data.exitPrijs - (data.entryPrijs ?? 0)) * data.aantalCoins!
    : null;
  const behaaldKleur = behaaldPct !== null ? (behaaldPct >= 0 ? colors.winst : colors.verlies) : colors.tekstGedimd;

  const afstandStopPct = data.context === 'portfolio' && isOpen && data.prijs !== undefined && data.stopLoss !== undefined
    ? (data.prijs - data.stopLoss) / data.prijs * 100
    : null;
  const afstandDoelPct = data.context === 'portfolio' && isOpen && data.prijs !== undefined && data.takeProfit !== undefined
    ? (data.takeProfit - data.prijs) / data.prijs * 100
    : null;

  const portfolioAdvies = data.context === 'portfolio' && isOpen
    ? bepaalAdvies(data.entryPrijs ?? 0, data.stopLoss ?? 0, data.takeProfit ?? 0, data.prijs)
    : null;
  const portfolioAdviesKleur = portfolioAdvies?.kleur === 'winst' ? colors.winst
    : portfolioAdvies?.kleur === 'verlies' ? colors.verlies
    : portfolioAdvies?.kleur === 'letOp' ? colors.letOp
    : colors.tekstGedimd;

  const statusLabel = data.status === 'gewonnen' ? 'Gewonnen' : data.status === 'verloren' ? 'Verloren' : 'Open';

  return (
    <Modal visible animationType="slide" onRequestClose={onSluiten} presentationStyle="fullScreen">
      <SafeAreaView style={[styles.root, { backgroundColor: colors.achtergrond }]}>
        <View style={[styles.header, { borderBottomColor: colors.rand, paddingTop: spacing.base + androidStatusBarPadding }]}>
          <View style={styles.headerLinks}>
            <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{data.symbool}</Text>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{data.naam}</Text>
          </View>
          <View style={styles.headerRechts}>
            {data.prijs !== undefined && (
              <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>{fmtPrijs(data.prijs)}</Text>
            )}
            {typeof data.score === 'number' && <ScoreBadge score={data.score} />}
          </View>
          <Pressable
            onPress={onSluiten}
            style={styles.sluitKnop}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
            hitSlop={8}
          >
            <X size={22} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        </View>

        {status === 'loading' && (
          <View style={styles.midden}>
            <ActivityIndicator color={colors.cta} />
          </View>
        )}

        {status === 'error' && (
          <OfflineMelding
            titel="Geen koersdata"
            beschrijving={`Kon geen actuele koersdata ophalen voor ${data.symbool}. Controleer je verbinding.`}
            melding="Binance en CoinGecko niet bereikbaar"
            lastAttempt={foutTijd}
            onRetry={() => laadData(data.symbool)}
          />
        )}

        {status === 'success' && indicatoren && (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.sectie}>
              <PrijsGrafiek candles={candles} niveaus={niveaus} />
            </View>

            {heeftNiveaus && (
              <View style={styles.sectie}>
                <LevelRow stop={data.stopLoss!} entry={data.entry!} doel={data.takeProfit!} />
                {data.rr !== undefined && (
                  <Text style={[Type.caption, styles.rrTekst, { color: colors.tekstGedimd }]}>R/R {fmtRR(data.rr)}</Text>
                )}
              </View>
            )}

            {advies && (
              <View style={styles.sectie}>
                <Text style={[Type.sectiekop, styles.kopje, { color: colors.tekstPrimair }]}>Waarom</Text>
                <View style={[styles.waaromBadge, { backgroundColor: adviesKleur + '1A', borderColor: adviesKleur }]}>
                  <Text style={[Type.caption, { color: adviesKleur, fontWeight: '700' }]}>{advies.label}</Text>
                </View>
                {advies.uitleg ? (
                  <Text style={[Type.body, styles.waaromUitleg, { color: colors.tekstGedimd }]}>{advies.uitleg}</Text>
                ) : null}
              </View>
            )}

            <View style={styles.sectie}>
              <Text style={[Type.sectiekop, styles.kopje, { color: colors.tekstPrimair }]}>Indicatoren</Text>
              <View style={styles.indicatorGrid}>
                <IndicatorItem label="RSI" waarde={Math.round(indicatoren.rsi).toString()} />
                <IndicatorItem
                  label="TREND"
                  waarde={indicatoren.trendOp ? 'Opwaarts' : 'Neerwaarts'}
                  kleur={indicatoren.trendOp ? colors.winst : colors.verlies}
                />
                <IndicatorItem
                  label="MACD"
                  waarde={indicatoren.macdBullish ? 'Bullish' : 'Bearish'}
                  kleur={indicatoren.macdBullish ? colors.winst : colors.verlies}
                />
                <IndicatorItem label="VOLUME" waarde={`${indicatoren.volumeRatio.toFixed(1)}×`} />
              </View>
            </View>

            {data.context === 'portfolio' && (
              <View style={styles.sectie}>
                <Text style={[Type.sectiekop, styles.kopje, { color: colors.tekstPrimair }]}>Jouw positie</Text>
                {isOpen && portfolioAdvies && (
                  <View style={[styles.portfolioAdvies, { backgroundColor: colors.verhoogd }]}>
                    <Text style={[Type.caption, { color: portfolioAdviesKleur, lineHeight: 18 }]}>{portfolioAdvies.tekst}</Text>
                  </View>
                )}
                {!isOpen && (
                  <View style={[styles.portfolioAdvies, { backgroundColor: colors.verhoogd }]}>
                    <Text style={[Type.caption, { color: behaaldKleur, lineHeight: 18 }]}>
                      {`Gesloten op ${fmtPrijs(data.exitPrijs ?? data.entryPrijs ?? 0)}${behaaldPct !== null ? ` (${fmtPct(behaaldPct)})` : ''}.`}
                    </Text>
                  </View>
                )}
                <View style={styles.indicatorGrid}>
                  <IndicatorItem label="STATUS" waarde={statusLabel} />
                  <IndicatorItem label="INLEG" waarde={data.bedragUsd ? fmtPrijs(data.bedragUsd) : '—'} />
                  {isOpen && (
                    <>
                      <IndicatorItem
                        label="RESULTAAT"
                        waarde={resultaatPct !== null ? fmtPct(resultaatPct) : '—'}
                        kleur={resultaatKleur}
                      />
                      {resultaatUsd !== null && (
                        <IndicatorItem
                          label="WINST/VERLIES"
                          waarde={`${resultaatUsd >= 0 ? '+' : ''}$${Math.abs(resultaatUsd).toFixed(2)}`}
                          kleur={resultaatKleur}
                        />
                      )}
                      {afstandStopPct !== null && (
                        <IndicatorItem label="AFSTAND STOP" waarde={fmtPct(-afstandStopPct)} kleur={colors.verlies} />
                      )}
                      {afstandDoelPct !== null && (
                        <IndicatorItem label="AFSTAND DOEL" waarde={fmtPct(afstandDoelPct)} kleur={colors.winst} />
                      )}
                    </>
                  )}
                  {!isOpen && (
                    <>
                      {data.exitPrijs !== undefined && (
                        <IndicatorItem label="EXITPRIJS" waarde={fmtPrijs(data.exitPrijs)} />
                      )}
                      {data.slotDatum && (
                        <IndicatorItem label="SLOTDATUM" waarde={data.slotDatum} />
                      )}
                      {behaaldPct !== null && (
                        <IndicatorItem label="BEHAALD" waarde={fmtPct(behaaldPct)} kleur={behaaldKleur} />
                      )}
                      {behaaldUsd !== null && (
                        <IndicatorItem
                          label="WINST/VERLIES"
                          waarde={`${behaaldUsd >= 0 ? '+' : ''}$${Math.abs(behaaldUsd).toFixed(2)}`}
                          kleur={behaaldKleur}
                        />
                      )}
                    </>
                  )}
                </View>
                {data.notitie ? (
                  <Text style={[Type.caption, styles.notitie, { color: colors.tekstGedimd }]}>{data.notitie}</Text>
                ) : null}
              </View>
            )}

            <View style={styles.sectie}>
              <Text style={[Type.sectiekop, styles.kopje, { color: colors.tekstPrimair }]}>Over {data.naam}</Text>
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{coinInfo.categorie}</Text>
              <Text style={[Type.body, styles.coinUitleg, { color: colors.tekstPrimair }]}>{coinInfo.wat}</Text>
            </View>

            <Disclaimer />
          </ScrollView>
        )}

        {kanGetrade && (
          <View style={[styles.actiebalk, { borderTopColor: colors.rand, backgroundColor: colors.achtergrond }]}>
            <Pressable
              style={[styles.getradeKnop, { backgroundColor: colors.cta }]}
              onPress={() => setGetradeOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Getrade"
            >
              <CheckCircle size={16} color="white" strokeWidth={1.75} />
              <Text style={[Type.body, styles.getradeTekst]}>Getrade</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      <GetradeFormulier
        zichtbaar={getradeOpen}
        trade={getradeBron}
        onSluiten={() => setGetradeOpen(false)}
      />
    </Modal>
  );
}

function IndicatorItem({ label, waarde, kleur }: { label: string; waarde: string; kleur?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.indicatorItem}>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{label}</Text>
      <Text style={[Type.prijs, styles.indicatorWaarde, { color: kleur ?? colors.tekstPrimair }]}>{waarde}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  headerLinks: { gap: 2, flex: 1 },
  headerRechts: { alignItems: 'flex-end', gap: 6 },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', marginTop: -spacing.xs },
  midden: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: spacing.xl },
  sectie: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  kopje: { marginBottom: spacing.sm },
  rrTekst: { marginTop: spacing.sm },
  waaromBadge: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  waaromUitleg: { marginTop: spacing.sm, lineHeight: 20 },
  indicatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base,
  },
  indicatorItem: { gap: 2, minWidth: '40%' },
  indicatorWaarde: { fontSize: 14 },
  portfolioAdvies: {
    borderRadius: radii.veld,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  notitie: { marginTop: spacing.md, fontStyle: 'italic' },
  coinUitleg: { marginTop: spacing.sm, lineHeight: 22 },
  actiebalk: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.base,
  },
  getradeKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    minHeight: 44,
  },
  getradeTekst: { color: 'white', fontWeight: '600' },
});
