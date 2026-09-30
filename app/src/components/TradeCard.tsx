import React, { memo, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { CheckCircle, Star, ShoppingCart } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { infoVoor, genereerKoopadvies } from '../engine/coinInfo';
import { fmtPct, fmtPrijs, fmtRR } from '../engine/format';
import { MIN_RISK_REWARD } from '../engine/analyzer';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { schuifOvergang, uitklapInGestaffeld, uitklapUit } from '../theme/lijstBeweging';
import { AdviceBadge } from './AdviceBadge';
import { BevestigdKeurmerk } from './BevestigdKeurmerk';
import { Bevestigingen } from './Bevestigingen';
import { bevestigingen } from '../engine/bevestigingen';
import { AangepastPil } from './LevelRow';
import { DREMPEL_STERK_KOOP } from '../engine/drempels';
import { StopLossLimiet, etoroNiveaus } from '../engine/etoroLimieten';
import { oordeelRs, rsUitleg } from '../engine/relatieveSterkte';
import { useValutaStand } from '../state/useValuta';
import { handelbaarOp, noemPlatforms } from '../engine/platforms';
import { PlatformChips } from './PlatformChip';
import { PlatformSheet } from './PlatformSheet';
import { useDrukVeer } from './Drukbaar';
import { UitklapPijl } from './UitklapPijl';
import { ScoreRing } from './ScoreRing';
import { Sparkline } from './Sparkline';
import { StopDoelBaan } from './StopDoelBaan';
import { PilKnop } from './PilKnop';

interface Props {
  trade: Trade;
  onGetrade?: (trade: Trade) => void;
  onOpenDetail?: (trade: Trade) => void;
  favoriet?: boolean;
  onToggleFavoriet?: (symbool: string) => void;
  // Opent de kooporder-sheet. Ontbreekt deze prop (geen koppeling, of een sleutel zonder
  // schrijfrecht), dan blijft de kaart precies zoals hij was: geen koopknop en geen merkjes.
  // De knop plaatst zelf nooit een order, hij opent alleen de sheet.
  onKoop?: (trade: Trade) => void;
  // De stop-loss-grens van eToro voor deze coin, of null als die er niet is (geen koppeling, of een
  // API-fout). Het scherm haalt de hele kaart in één keer op, zodat twintig kaarten niet twintig
  // keer los abonneren. Met een grens tonen we de stop die je bij eToro werkelijk kunt zetten in
  // plaats van het niveau dat Kader zelf berekende, plus de R/R die daarbij hoort.
  limiet?: StopLossLimiet | null;
  // Rendement over 30 dagen min dat van BTC, in procentpunten. Ontbreekt als de scan het niet kon
  // uitrekenen (te weinig historie, of BTC zelf niet opgehaald); dan blijft de tegel gewoon weg.
  // Gemeten in meting H van de backtest: achterblijvers doen het als instap beter dan voorlopers.
  versusBtc?: number;
  // Plek in de lijst, voor de staffeling van ring en grafiek bij binnenkomst. Het scherm geeft de
  // waarde die ook de landing van de kaart gebruikt, zodat ze samen binnenkomen.
  volgorde?: number;
}

type AdviesLabel = 'STERK KOOP' | 'KOOPZONE' | 'AFWACHTEN';

// HIGH CONVICTION is geen label meer: een high-conviction trade is STERK KOOP met het losse
// BEVESTIGD-keurmerk ernaast. highConviction (score 75+) valt al boven de drempel van 72, maar we
// noemen hem toch expliciet zodat dat niet stilletjes afhangt van twee constanten die uit elkaar
// kunnen lopen.
function adviesLabel(trade: Trade): AdviesLabel {
  if (trade.signaal !== 'KOOP') return 'AFWACHTEN';
  if (trade.highConviction || trade.score >= DREMPEL_STERK_KOOP) return 'STERK KOOP';
  return 'KOOPZONE';
}

// Memo: tijdens de marktscan tekent MarktScreen bij elk voortgangstikje opnieuw, en zonder memo
// tekenden alle al gelande kaarten dan mee, net terwijl de nieuwe kaarten binnen komen vliegen.
export const TradeCard = memo(function TradeCard({ trade, onGetrade, onOpenDetail, favoriet, onToggleFavoriet, onKoop, limiet = null, versusBtc, volgorde = 0 }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const [platformsOpen, setPlatformsOpen] = useState(false);
  const info = infoVoor(trade.symbool);
  const advies = adviesLabel(trade);
  // De hele kaart veert mee als je het bovenste deel indrukt, niet alleen dat deel: anders krimpt
  // de inhoud binnen een stilstaande rand en schaduw. Het detailscherm groeit uit deze kaart, ook
  // als je het via de Details-knop opent.
  const druk = useDrukVeer(undefined, { kleur: colors.kaart, radius: radii.kaart });
  const niveaus = etoroNiveaus(trade.entry, trade.stopLoss, trade.takeProfit, limiet);
  // Het merkje betekent: KADER kan deze order plaatsen. Niet "deze coin bestaat op eToro". Moet je
  // het bij de provider zelf doen, dan hoort er geen merkje te staan, want dan doet de koopknop het
  // ook niet. Daarom hangt het aan precies dezelfde voorwaarde als die knop: `onKoop` komt van het
  // scherm en is er alleen bij een koppeling met schrijfrecht. Zo kunnen die twee nooit uit elkaar
  // lopen. handelbaarOp() zegt daarnaast of deze specifieke coin er verhandelbaar is.
  const platforms = onKoop ? handelbaarOp(trade.symbool) : [];
  // Boven de drempel blijft de kleur neutraal. Schuift eToro de stop op, dan zakt de R/R mee en is
  // die drempel het enige eerlijke oordeel: de score kan nog zo hoog zijn, met een stop van 10% en
  // een doel van 9% verdien je er niets aan.
  const haaltRr = niveaus.aangepast ? niveaus.rr >= MIN_RISK_REWARD : trade.voldoetAanRR;
  const uitkomst = bevestigingen(trade, niveaus.rr, haaltRr);
  // Het keurmerk popt alleen als een trade bevestigd raakt terwijl de kaart er al staat. Bij elke
  // filterwissel mount de lijst opnieuw, en dan zouden alle keurmerken tegelijk opspringen.
  const eerderBevestigd = useRef(uitkomst.bevestigd);
  const animeerKeurmerk = uitkomst.bevestigd && !eerderBevestigd.current;
  useEffect(() => {
    eerderBevestigd.current = uitkomst.bevestigd;
  }, [uitkomst.bevestigd]);
  const koopadvies = genereerKoopadvies({
    score: trade.score,
    rsi: trade.rsi,
    trendOp: trade.ema20 > trade.ema50,
    macdBullish: trade.macdBullish,
    volumeRatio: trade.volumeRatio,
    highConviction: trade.highConviction,
  });

  // Eerste tegen laatste dagclose: de candles zijn dagcandles, dus dat is precies 30 dagen. Zonder
  // reeks (niet elke plek die een Trade bouwt heeft candles, en de CoinGecko-fallback levert geen
  // dagcandles) vallen grafiek en pil allebei weg.
  const reeks = trade.sparkline && trade.sparkline.length >= 2 ? trade.sparkline : null;
  const verandering30d = reeks && reeks[0] > 0 ? (reeks[reeks.length - 1] / reeks[0] - 1) * 100 : null;
  const veranderingKleur = verandering30d !== null && verandering30d < 0 ? colors.verlies : colors.winst;

  // De kaart groeit op een veer mee met de uitklap. De kaarten eronder volgen via de lijst
  // (itemLayoutAnimation op MarktScreen).
  const schuif = schuifOvergang(reduceMotion);

  // Prijs en R/R staan op de kaart maar zaten niet in het label: de ring en de chip zijn hier
  // niet apart voorleesbaar (ze zitten binnen het tikvlak), dus zonder deze twee mist TalkBack ze.
  const kaartLabel =
    `${trade.symbool}, ${info.naam}, ${advies}${uitkomst.bevestigd ? ', BEVESTIGD' : ''}, score ${Math.round(trade.score)}`
    + `, prijs ${fmtPrijs(trade.prijs)}, R/R ${fmtRR(niveaus.rr)}`;

  return (
    // Elke kaart ziet er hetzelfde uit: besluit van de UI-makeover. De overtuiging zit in de ring,
    // de badge en het keurmerk, en AFWACHTEN oogt niet uitgeschakeld. De kaart zelf blijft neutraal:
    // groen en rood staan alleen op cijfers, pillen en lijnen.
    <Animated.View ref={druk.ref} layout={schuif} style={[
      styles.kaart,
      shadow.kaart,
      { backgroundColor: colors.kaart },
      druk.stijl,
    ]}>
      {/* Het bovenste deel (kop, grafiek, voet) klapt de kaart uit en weer in. Het detailscherm
          opent alleen nog via Details in het uitgeklapte deel, zodat een tik om te lezen je niet
          meteen naar een ander scherm stuurt. */}
      <Pressable
        onPress={() => {
          // Deze tik is geen opening van het detailscherm: een oude meting van dit indrukken mag
          // niet blijven liggen voor een latere activering van Details.
          druk.vergeetBron();
          setUitgeklapt(v => !v);
        }}
        onPressIn={druk.drukIn}
        onPressOut={druk.drukUit}
        accessibilityRole="button"
        accessibilityState={{ expanded: uitgeklapt }}
        accessibilityLabel={kaartLabel}
        accessibilityHint={uitgeklapt ? 'Tik om in te klappen' : 'Tik om uit te klappen'}
        // De padding zit op het tikvlak en niet op de kaart, zodat ook de rand rond de kop tikbaar is.
        style={styles.boven}
      >
        <View style={styles.kop}>
          <ScoreRing symbool={trade.symbool} score={trade.score} maat={48} volgorde={volgorde} accessible={false} />
          <View style={styles.kopMidden}>
            <View style={styles.symboolRij}>
              <Text style={[Type.sectiekop, styles.symbool, { color: colors.tekstPrimair }]}>
                {trade.symbool}
              </Text>
              {onToggleFavoriet && (
                <Pressable
                  onPress={() => onToggleFavoriet(trade.symbool)}
                  accessibilityRole="button"
                  accessibilityLabel={favoriet ? 'Favoriet verwijderen' : 'Favoriet maken'}
                  hitSlop={8}
                >
                  <Star
                    size={16}
                    color={favoriet ? '#F59E0B' : colors.tekstGedimd}
                    fill={favoriet ? '#F59E0B' : 'transparent'}
                    strokeWidth={1.75}
                  />
                </Pressable>
              )}
            </View>
            {/* Twee regels is genoeg voor elke naam in het universum; zo kapt er nooit iets af. */}
            <Text style={[Type.caption, { color: colors.tekstGedimd }]} numberOfLines={2}>
              {info.naam}
            </Text>
          </View>
          <View style={styles.kopRechts}>
            <Text style={[Type.prijsGroot, styles.prijs, { color: colors.tekstPrimair }]}>
              {fmtPrijs(trade.prijs)}
            </Text>
            {verandering30d !== null && (
              <View style={[styles.pil, { backgroundColor: veranderingKleur + '1F' }]}>
                <Text style={[Type.prijs, styles.pilTekst, { color: veranderingKleur }]}>
                  {fmtPct(verandering30d)} · 30D
                </Text>
              </View>
            )}
          </View>
        </View>

        {reeks && (
          <View style={styles.grafiek}>
            <Sparkline reeks={reeks} hoogte={52} vlak stip volgorde={volgorde} />
          </View>
        )}

        {/* Wrap: met een grotere systeemletter passen badge, keurmerk en R/R op 360 dp niet altijd
            naast elkaar. De pijl blijft dan rechts op de laatste regel. */}
        <View style={styles.voet}>
          <AdviceBadge advies={advies} score={trade.score} />
          {uitkomst.bevestigd && <BevestigdKeurmerk animeer={animeerKeurmerk} />}
          {/* Onder de drempel kleurt de verhouding: de coin blijft zichtbaar, maar dit is precies
              de reden dat hij geen KOOP wordt. Zonder markering lijkt het een willekeurig getal. */}
          <View style={[styles.rrChip, { backgroundColor: colors.verhoogd }]}>
            <Text style={[Type.prijs, styles.pilTekst, { color: haaltRr ? colors.tekstGedimd : colors.letOp }]}>
              R/R {fmtRR(niveaus.rr)}
            </Text>
          </View>
          <View style={[styles.pijlRondje, { backgroundColor: colors.verhoogd }]}>
            <UitklapPijl open={uitgeklapt} size={14} color={colors.tekstGedimd} strokeWidth={2} veerNaam="stevig" />
          </View>
        </View>
      </Pressable>

      {/* Het uitgeklapte deel klapt niet dicht bij een tik erop: hier staan knoppen en tekst die je
          wil kunnen aanraken en lezen zonder dat de kaart onder je vinger wegvouwt. */}
      {uitgeklapt && (
        <Animated.View exiting={uitklapUit()} style={[styles.uitklap, { borderTopColor: colors.rand }]}>
          {/* Alleen de container heeft een exiting: de blokken erin laten hun entering, en een tweede
              exiting per blok speelde dubbel af bovenop die van de container. */}
          <Animated.View entering={uitklapInGestaffeld(0, reduceMotion)}>
            <StopDoelBaan stop={niveaus.stop} entry={trade.entry} doel={trade.takeProfit} live={trade.prijs} />
            {/* Vier kolommen in twee paren: past het niet naast elkaar (een BTC-prijs is breed), dan
                breekt het naar 2x2 in plaats van dat één kolom los op een eigen regel valt. */}
            <View style={styles.niveaus}>
              <View style={styles.niveauPaar}>
                <View style={styles.niveau}>
                  {/* Staat de stop op eToro's grens in plaats van op die van Kader, dan zegt de pil
                      dat het getal is aangepast. Het waarom staat hieronder bij WAAROM. */}
                  <View style={styles.niveauLabel}>
                    <Text style={[Type.overline, { color: colors.verlies }]}>STOP</Text>
                    {niveaus.aangepast && <AangepastPil />}
                  </View>
                  <Text style={[Type.prijs, styles.niveauWaarde, { color: colors.tekstPrimair }]}>
                    {fmtPrijs(niveaus.stop)}
                  </Text>
                </View>
                <View style={styles.niveau}>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]}>ENTRY</Text>
                  <Text style={[Type.prijs, styles.niveauWaarde, { color: colors.tekstPrimair }]}>
                    {fmtPrijs(trade.entry)}
                  </Text>
                </View>
              </View>
              <View style={styles.niveauPaar}>
                <View style={styles.niveau}>
                  <Text style={[Type.overline, { color: colors.winst }]}>DOEL</Text>
                  <Text style={[Type.prijs, styles.niveauWaarde, { color: colors.tekstPrimair }]}>
                    {fmtPrijs(trade.takeProfit)}
                  </Text>
                </View>
                <View style={styles.niveau}>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]}>R/R</Text>
                  <Text style={[
                    Type.prijs, styles.niveauWaarde,
                    { color: haaltRr ? colors.tekstPrimair : colors.letOp },
                  ]}>
                    {fmtRR(niveaus.rr)}
                  </Text>
                </View>
              </View>
            </View>
            {/* De drempel in dezelfde opmaak als de waarde erboven, en dat is de hele reden dat fmtRR
                hier staat. Er stond "onder 1:2" onder een waarde van "1 : 1.3", en dat las als
                "onder 1,2": een grens die het getal erboven ruim haalde. */}
            {!haaltRr && (
              <Text style={[Type.caption, styles.notitie, { color: colors.letOp }]}>
                Onder {fmtRR(MIN_RISK_REWARD)}: Kader geeft hier geen koopsignaal.
              </Text>
            )}
          </Animated.View>

          {/* De vier eisen bestaan alleen voor een long op het momentum-profiel: trend, MACD en
              volume betekenen bij een omkeer- of short-trade iets anders. */}
          {trade.richting === 'long' && trade.profiel === 'momentum' && (
            <Animated.View entering={uitklapInGestaffeld(1, reduceMotion)}>
              <Bevestigingen uitkomst={uitkomst} />
            </Animated.View>
          )}

          <Animated.View
            entering={uitklapInGestaffeld(2, reduceMotion)}
            style={styles.tegels}
          >
            <View style={[styles.tegel, { backgroundColor: colors.verhoogd }]}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>RSI</Text>
              <Text style={[Type.prijs, styles.tegelWaarde, { color: colors.tekstPrimair }]}>
                {Math.round(trade.rsi)}
              </Text>
            </View>
            {/* Neutraal gekleurd, met opzet. Een achterblijver is voor een instap gunstig maar het
                is geen coin die het goed doet, en groen zou dat laatste beweren. Op de dichte kaart
                stond dit alleen buiten de band van -10 tot +25 procentpunt, om geen kaal getal op
                elke kaart te zetten; hier in de uitklap is er ruimte, en staat er bij een
                verwaarloosbaar verschil gewoon "gelijk" onder. */}
            {versusBtc !== undefined && (
              <View style={[styles.tegel, { backgroundColor: colors.verhoogd }]}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>VS BTC</Text>
                <Text style={[Type.prijs, styles.tegelWaarde, { color: colors.tekstPrimair }]}>
                  {versusBtc >= 0 ? '+' : ''}{versusBtc.toFixed(0)}%
                </Text>
                <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{oordeelRs(versusBtc)}</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View entering={uitklapInGestaffeld(3, reduceMotion)} style={styles.waarom}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>WAAROM</Text>
            {trade.redenen.map((r, i) => (
              <Text key={i} style={[Type.caption, styles.reden, { color: colors.tekstGedimd }]}>• {r}</Text>
            ))}
            {koopadvies.uitleg ? (
              <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>
                {koopadvies.uitleg}
              </Text>
            ) : null}
            {/* Staat de stop op eToro's grens in plaats van op die van Kader, dan hoort hier te staan
                waarom. Anders lijkt het getal een rekenfout. */}
            {niveaus.uitleg ? (
              <Text style={[Type.caption, styles.uitleg, { color: colors.letOp }]}>
                {niveaus.uitleg}
              </Text>
            ) : null}
            {versusBtc !== undefined && rsUitleg(versusBtc) ? (
              <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>
                {rsUitleg(versusBtc)}
              </Text>
            ) : null}
          </Animated.View>

          {/* Mag afbreken: Getrade, Koop met merkjes en Details passen op 360 dp niet altijd op één
              regel, en een knop gaat liever naar de volgende regel dan dat zijn label afkapt. */}
          <Animated.View entering={uitklapInGestaffeld(4, reduceMotion)} style={styles.pilRij}>
            {onGetrade && (
              <PilKnop label="Getrade" icoon={CheckCircle} variant="tweede" onPress={() => onGetrade(trade)} />
            )}
            {onKoop && (
              <View style={styles.koopGroep}>
                <PilKnop
                  label="Koop"
                  icoon={ShoppingCart}
                  variant="cta"
                  onPress={() => onKoop(trade)}
                  accessibilityLabel={`${trade.symbool} kopen via eToro`}
                />
                {/* Op welke platforms Kader deze order kan plaatsen, direct naast de knop die dat
                    doet. In de kop was de voet op 360 dp te vol. */}
                {platforms.length > 0 && (
                  <Pressable
                    onPress={() => setPlatformsOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Te kopen via ${noemPlatforms(platforms)}. Tik voor uitleg.`}
                    // De rij chips is 20 punten hoog; hitSlop maakt er een raakvlak van 44 van
                    // zonder de rij hoger te maken. Links maar 4: daar staat de Koop-pil, en de slop
                    // mag het raakvlak van die knop niet overlappen.
                    hitSlop={{ top: 12, bottom: 12, left: 4, right: 12 }}
                  >
                    <PlatformChips platforms={platforms} maat={20} />
                  </Pressable>
                )}
              </View>
            )}
            {onOpenDetail && (
              <View style={styles.details}>
                <PilKnop
                  label="Details"
                  variant="link"
                  // Alleen meten, niet krimpen: het detailscherm groeit uit de hele kaart, en de knop
                  // zelf veert al als Drukbaar.
                  onPressIn={druk.meetBron}
                  onPress={() => {
                    druk.legBronVast();
                    onOpenDetail(trade);
                  }}
                  accessibilityLabel={`${trade.symbool} details bekijken`}
                />
              </View>
            )}
          </Animated.View>
        </Animated.View>
      )}

      {/* Alleen mounten als hij open is: anders staat er per kaart een Modal in de boom, en dat zijn
          er twintig in een lijst die je aan het scrollen bent. */}
      {platformsOpen && (
        <PlatformSheet
          zichtbaar
          onSluiten={() => setPlatformsOpen(false)}
          symbool={trade.symbool}
          platforms={platforms}
        />
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    // Knipt de blokken die bij het dichtklappen nog uitfaden af op de rand van de krimpende kaart.
    overflow: 'hidden',
  },
  boven: { padding: spacing.base },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  kopMidden: { flex: 1, minWidth: 0, gap: 2 },
  // Wrap: bij een lang symbool met een grote systeemletter valt de ster liever onder het symbool
  // dan over de prijs heen.
  symboolRij: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  // Type.sectiekop is 16; het ontwerp zet het symbool op 17.
  symbool: { fontSize: 17 },
  // Mag krimpen maar nooit meer dan de helft: bij een grote systeemletter wordt het midden anders
  // dichtgeknepen tot een smalle kolom. De prijs heeft bewust geen numberOfLines, want een prijs die
  // afkapt is erger dan een prijs die op twee regels staat.
  kopRechts: { alignItems: 'flex-end', gap: spacing.xs, flexShrink: 1, maxWidth: '50%' },
  // Type.prijsGroot is 21; op de kaart staat de prijs op 17, naast het symbool.
  prijs: { fontSize: 17, lineHeight: 22 },
  pil: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  pilTekst: { fontSize: 11.5, lineHeight: 14 },
  grafiek: { marginTop: spacing.md },
  voet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  rrChip: {
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  pijlRondje: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  // Het tikvlak erboven levert de 16 punten boven de haarlijn al.
  uitklap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    paddingTop: spacing.base,
    gap: spacing.base,
  },
  niveaus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  niveauPaar: { flexDirection: 'row', flexGrow: 1, gap: spacing.sm },
  niveau: { flexGrow: 1, flexBasis: 'auto', gap: 2 },
  niveauLabel: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  niveauWaarde: { fontSize: 13 },
  notitie: { lineHeight: 18, marginTop: spacing.sm },
  tegels: { flexDirection: 'row', gap: spacing.sm },
  tegel: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  tegelWaarde: { fontSize: 15, fontFamily: Type.prijsGroot.fontFamily },
  waarom: { gap: 4 },
  reden: { lineHeight: 18 },
  uitleg: { lineHeight: 18, marginTop: 4 },
  pilRij: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  koopGroep: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Duwt Details naar rechts op zijn regel, ook als de rij afbreekt.
  details: { marginLeft: 'auto' },
});
