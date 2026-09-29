import React, { memo, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Info, CheckCircle, Star, ShoppingCart } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { infoVoor, genereerKoopadvies } from '../engine/coinInfo';
import { fmtPrijs, fmtRR } from '../engine/format';
import { MIN_RISK_REWARD } from '../engine/analyzer';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { schuifOvergang, uitklapIn, uitklapUit } from '../theme/lijstBeweging';
import { AdviceBadge } from './AdviceBadge';
import { BevestigdKeurmerk } from './BevestigdKeurmerk';
import { Bevestigingen } from './Bevestigingen';
import { bevestigingen } from '../engine/bevestigingen';
import { LevelRow } from './LevelRow';
import { DREMPEL_STERK_KOOP } from '../engine/drempels';
import { StopLossLimiet, etoroNiveaus } from '../engine/etoroLimieten';
import { oordeelRs, rsUitleg } from '../engine/relatieveSterkte';
import { useValutaStand } from '../state/useValuta';
import { handelbaarOp, noemPlatforms } from '../engine/platforms';
import { PlatformChips } from './PlatformChip';
import { PlatformSheet } from './PlatformSheet';
import { useDrukVeer } from './Drukbaar';
import { UitklapPijl } from './UitklapPijl';

interface Props {
  trade: Trade;
  onGetrade?: (trade: Trade) => void;
  onOpenDetail?: (trade: Trade) => void;
  favoriet?: boolean;
  onToggleFavoriet?: (symbool: string) => void;
  // Opent de kooporder-sheet. Ontbreekt deze prop (geen koppeling, of een sleutel zonder
  // schrijfrecht), dan blijft de kaart precies zoals hij was: twee knoppen, geen koopknop.
  // De knop plaatst zelf nooit een order, hij opent alleen de sheet.
  onKoop?: (trade: Trade) => void;
  // De stop-loss-grens van eToro voor deze coin, of null als die er niet is (geen koppeling, of een
  // API-fout). Het scherm haalt de hele kaart in één keer op, zodat twintig kaarten niet twintig
  // keer los abonneren. Met een grens tonen we de stop die je bij eToro werkelijk kunt zetten in
  // plaats van het niveau dat Kader zelf berekende, plus de R/R die daarbij hoort.
  limiet?: StopLossLimiet | null;
  // Rendement over 30 dagen min dat van BTC, in procentpunten. Ontbreekt als de scan het niet kon
  // uitrekenen (te weinig historie, of BTC zelf niet opgehaald); dan blijft de kolom gewoon weg.
  // Gemeten in meting H van de backtest: achterblijvers doen het als instap beter dan voorlopers.
  versusBtc?: number;
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
export const TradeCard = memo(function TradeCard({ trade, onGetrade, onOpenDetail, favoriet, onToggleFavoriet, onKoop, limiet = null, versusBtc }: Props) {
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
  // de inhoud binnen een stilstaande rand en schaduw. Het detailscherm groeit uit deze kaart.
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

  // De kaart groeit op een veer mee met de uitklap, en de actierij schuift op dezelfde veer naar
  // zijn nieuwe plek. De kaarten eronder volgen via de lijst (itemLayoutAnimation op MarktScreen).
  const schuif = schuifOvergang(reduceMotion);

  function wisselUitgeklapt() {
    setUitgeklapt(v => !v);
  }

  return (
    // Elke kaart ziet er hetzelfde uit: besluit van de UI-makeover. De overtuiging zit in de badge
    // en het keurmerk (de scorering zelf komt later), en AFWACHTEN oogt niet meer uitgeschakeld.
    <Animated.View ref={druk.ref} layout={schuif} style={[
      styles.kaart,
      shadow.kaart,
      { backgroundColor: colors.kaart },
      druk.stijl,
    ]}>
      <Pressable
        onPress={() => {
          druk.legBronVast();
          onOpenDetail?.(trade);
        }}
        onPressIn={druk.drukIn}
        onPressOut={druk.drukUit}
        accessibilityRole="button"
        accessibilityLabel={`${trade.symbool} detail bekijken`}
        disabled={!onOpenDetail}
      >
      {/* Het oordeel staat boven de cijfers, want dat is wat je als eerste wil lezen. Rechts
          ernaast op welke platforms deze coin te koop is. Dat stond eerder als het woord ETORO
          naast STOP, waar het iets heel anders betekende (zie LevelRow) en waar het als een
          merklogo op een rare plek las. */}
      <View style={styles.badgeRij}>
        <View style={styles.badgeGroep}>
          <AdviceBadge advies={advies} score={trade.score} />
          {uitkomst.bevestigd && <BevestigdKeurmerk animeer={animeerKeurmerk} />}
        </View>
        {platforms.length > 0 && (
          <Pressable
            onPress={() => setPlatformsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Te kopen via ${noemPlatforms(platforms)}. Tik voor uitleg.`}
            // De rij chips is 20 punten hoog; hitSlop maakt er een raakvlak van 44 van zonder de
            // kaart hoger te maken.
            hitSlop={12}
          >
            <PlatformChips platforms={platforms} maat={20} />
          </Pressable>
        )}
      </View>
      {/* Koptekst */}
      <View style={styles.kop}>
        <View style={styles.kopLinks}>
          <View style={styles.symboolRij}>
            <Text style={[Type.titel, { color: colors.tekstPrimair }]}>
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
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{info.naam}</Text>
        </View>
        <View style={styles.kopRechts}>
          {/* Het scorecijfer stond hier als losse badge en verderop nog eens als SCORE-kolom.
              Allebei weg: het staat nu in de adviesbadge zelf, dus één element draagt het oordeel
              en de maat ervan, en de metarij houdt drie kolommen over die ruimer kunnen staan. */}
          <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>{fmtPrijs(trade.prijs)}</Text>
        </View>
      </View>

      {/* Sub-label */}
      <Text style={[Type.overline, styles.paar, { color: colors.tekstGedimd }]}>
        {trade.symbool} / USDT
      </Text>

      {/* Niveaus */}
      <View style={styles.sectie}>
        <LevelRow stop={niveaus.stop} entry={trade.entry} doel={trade.takeProfit} stopAangepast={niveaus.aangepast} />
      </View>
      </Pressable>

      {/* R/R + RSI */}
      <View style={styles.metaRij}>
        <View style={styles.metaItem}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>R/R</Text>
          {/* Onder de drempel kleurt de verhouding: de coin blijft zichtbaar, maar dit is precies
              de reden dat hij geen KOOP wordt. Zonder markering lijkt het een willekeurig getal. */}
          <Text style={[
            Type.prijs, styles.metaWaarde,
            { color: haaltRr ? colors.tekstPrimair : colors.letOp },
          ]}>
            {fmtRR(niveaus.rr)}
          </Text>
          {/* Zelfde opmaak als de waarde erboven, en dat is de hele reden dat fmtRR hier staat.
              Er stond "onder 1:2" onder een waarde van "1 : 1.3", en dat las als "onder 1,2":
              een grens die het getal erboven ruim haalde. Nu staat er "onder 1 : 2.0" onder
              "1 : 1.3" en is het één schaal. */}
          {!haaltRr && (
            <Text style={[Type.caption, { color: colors.letOp }]}>onder {fmtRR(MIN_RISK_REWARD)}</Text>
          )}
        </View>
        <View style={styles.metaItem}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>RSI</Text>
          <Text style={[Type.prijs, styles.metaWaarde, { color: colors.tekstPrimair }]}>{Math.round(trade.rsi)}</Text>
        </View>
        {/* Alleen tonen als het cijfer iets zegt. Tussen -10 en +25 procentpunt is het gemeten
            verschil verwaarloosbaar (zie de emmers in relatieveSterkte.ts), en dan stond hier een
            kaal getal zonder betekenis op elke kaart: ruis naast R/R en RSI, die wél altijd iets
            zeggen. Buiten die band is het een gemeten voordeel of nadeel en staat het woord er
            meteen bij, zodat je het niet hoeft op te zoeken.

            Neutraal gekleurd, met opzet. Een achterblijver is voor een instap gunstig maar het is
            geen coin die het goed doet, en groen zou dat laatste beweren. De hele uitleg staat in
            de uitklap en op het detailscherm, waar er ruimte voor is. */}
        {versusBtc !== undefined && oordeelRs(versusBtc) !== 'gelijk' && (
          <View style={styles.metaItem}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>VS BTC</Text>
            <Text style={[Type.prijs, styles.metaWaarde, { color: colors.tekstPrimair }]}>
              {versusBtc >= 0 ? '+' : ''}{versusBtc.toFixed(0)}%
            </Text>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
              {oordeelRs(versusBtc) === 'achterblijver' ? 'achterblijver' : 'voorloper'}
            </Text>
          </View>
        )}
      </View>

      {/* Uitklapbare redenen + waarom-kopen onderbouwing */}
      {uitgeklapt && (
        <Animated.View
          entering={uitklapIn(reduceMotion)}
          exiting={uitklapUit()}
          style={[styles.redenen, { backgroundColor: colors.verhoogd }]}
        >
          {/* De vier eisen bestaan alleen voor een long op het momentum-profiel: trend, MACD en
              volume betekenen bij een omkeer- of short-trade iets anders. */}
          {trade.richting === 'long' && trade.profiel === 'momentum' && (
            <View style={styles.bevestigingen}>
              <Bevestigingen uitkomst={uitkomst} />
            </View>
          )}
          {trade.redenen.map((r, i) => (
            <Text key={i} style={[Type.caption, styles.reden, { color: colors.tekstGedimd }]}>• {r}</Text>
          ))}
          {koopadvies.uitleg ? (
            <Text style={[Type.caption, styles.koopadviesUitleg, { color: colors.tekstGedimd }]}>
              {koopadvies.uitleg}
            </Text>
          ) : null}
          {/* Staat de stop op eToro's grens in plaats van op die van Kader, dan hoort hier te staan
              waarom. Anders lijkt het getal een rekenfout. */}
          {niveaus.uitleg ? (
            <Text style={[Type.caption, styles.koopadviesUitleg, { color: colors.letOp }]}>
              {niveaus.uitleg}
            </Text>
          ) : null}
          {versusBtc !== undefined && rsUitleg(versusBtc) ? (
            <Text style={[Type.caption, styles.koopadviesUitleg, { color: colors.tekstGedimd }]}>
              {rsUitleg(versusBtc)}
            </Text>
          ) : null}
        </Animated.View>
      )}

      {/* Acties */}
      <Animated.View layout={schuif} style={[styles.actiesRij, { borderTopColor: colors.rand }]}>
        <Pressable
          style={[styles.actieKnop, { minHeight: 44 }]}
          onPress={wisselUitgeklapt}
          accessibilityLabel={uitgeklapt ? 'Minder info' : 'Over deze coin'}
          accessibilityRole="button"
        >
          <Info size={15} color={colors.cta} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.actieLabel, { color: colors.cta }]}>
            {uitgeklapt ? 'Minder' : 'Over deze coin'}
          </Text>
          <UitklapPijl open={uitgeklapt} size={12} color={colors.cta} />
        </Pressable>

        <View style={[styles.scheiding, { backgroundColor: colors.rand }]} />

        <Pressable
          style={[styles.actieKnop, { minHeight: 44 }]}
          onPress={() => onGetrade?.(trade)}
          accessibilityLabel="Getrade"
          accessibilityRole="button"
        >
          <CheckCircle size={15} color={colors.winst} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.actieLabel, { color: colors.winst }]}>Getrade</Text>
        </Pressable>

        {onKoop && (
          <>
            <View style={[styles.scheiding, { backgroundColor: colors.rand }]} />
            <Pressable
              style={[styles.actieKnop, { minHeight: 44 }]}
              onPress={() => onKoop(trade)}
              accessibilityLabel={`${trade.symbool} kopen via eToro`}
              accessibilityRole="button"
            >
              <ShoppingCart size={15} color={colors.cta} strokeWidth={1.75} />
              <Text style={[Type.caption, styles.actieLabel, { color: colors.cta }]}>Koop</Text>
            </Pressable>
          </>
        )}
      </Animated.View>

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
    overflow: 'hidden',
  },
  // Wrap en krimpen: met een grotere systeemletter passen badge, keurmerk en platformchip op
  // 360dp niet meer naast elkaar, en zonder wrap schuift de chip onder de kaartrand weg.
  badgeRij: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.base,
  },
  badgeGroep: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, alignItems: 'center', gap: 6 },
  kop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.base,
    // De badgerij erboven levert de bovenruimte al, anders staat er 12 plus 16 boven het symbool.
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  kopLinks: { gap: 2 },
  symboolRij: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kopRechts: { alignItems: 'flex-end', gap: 6 },
  paar: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  sectie: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  metaRij: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  metaItem: { gap: 2 },
  metaWaarde: { fontSize: 14 },
  redenen: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderRadius: radii.veld,
    padding: spacing.md,
    gap: 4,
  },
  bevestigingen: { marginBottom: spacing.sm },
  reden: { lineHeight: 18 },
  koopadviesUitleg: { lineHeight: 18, marginTop: 4 },
  actiesRij: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actieKnop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  scheiding: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.sm,
  },
  actieLabel: { fontSize: 12 },
});
