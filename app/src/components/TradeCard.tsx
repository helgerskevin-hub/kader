import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { Info, CheckCircle, ChevronDown, ChevronUp, Star, ShoppingCart } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { infoVoor, genereerKoopadvies } from '../engine/coinInfo';
import { fmtPrijs, fmtRR } from '../engine/format';
import { MIN_RISK_REWARD } from '../engine/analyzer';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { AdviceBadge } from './AdviceBadge';
import { LevelRow } from './LevelRow';
import { DREMPEL_STERK_KOOP } from '../engine/drempels';
import { StopLossLimiet, etoroNiveaus } from '../engine/etoroLimieten';
import { oordeelRs, rsUitleg } from '../engine/relatieveSterkte';
import { useValutaStand } from '../state/useValuta';
import { handelbaarOp, noemPlatforms } from '../engine/platforms';
import { PlatformChips } from './PlatformChip';

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

type AdviesLabel = 'HIGH CONVICTION' | 'STERK KOOP' | 'KOOPZONE' | 'AFWACHTEN';

function adviesLabel(trade: Trade): AdviesLabel {
  if (trade.highConviction) return 'HIGH CONVICTION';
  if (trade.signaal !== 'KOOP') return 'AFWACHTEN';
  return trade.score >= DREMPEL_STERK_KOOP ? 'STERK KOOP' : 'KOOPZONE';
}

// De gekleurde linkerstreep komt niet terug. Die zei vier keer hetzelfde en stond ook op
// AFWACHTEN, waar niets aan de hand is, waardoor elke kaart in de lijst even hard riep. Maar met
// alleen een randje van anderhalve pixel en een schaduw van 6 procent was het onderscheid in een
// lijst van twintig kaarten te weinig: je moest de badge lézen om te weten wat er speelde.
//
// Het verschil loopt nu over vier assen tegelijk, oplopend in sterkte: achtergrond, rand, schaduw
// en de kopgrootte van het symbool. AFWACHTEN krijgt de achtergrond van het scherm zelf en geen
// schaduw, en ligt daarmee letterlijk plat op de pagina; HIGH CONVICTION krijgt als enige een volle
// rand plus een gevulde badge. De positieve kant werkt dus via gewicht, de negatieve via wegvallen.
// Zouden alle vier de niveaus iets extra's krijgen, dan roept de lijst weer even hard als eerst.
function niveauOpmaak(label: AdviesLabel, colors: ReturnType<typeof useTheme>['colors']) {
  if (label === 'HIGH CONVICTION') {
    return {
      borderWidth: 1.5, borderColor: colors.primair, schaduw: true,
      achtergrond: colors.kaart, groteKop: true, prijsKleur: colors.tekstPrimair,
    };
  }
  if (label === 'STERK KOOP') {
    // 20 procent dekking: net genoeg om de kaart een tint te geven, niet genoeg om met high
    // conviction te concurreren.
    return {
      borderWidth: 1, borderColor: colors.winst + '33', schaduw: true,
      achtergrond: colors.kaart, groteKop: true, prijsKleur: colors.tekstPrimair,
    };
  }
  if (label === 'AFWACHTEN') {
    return {
      borderWidth: 1, borderColor: colors.rand, schaduw: false,
      achtergrond: colors.achtergrond, groteKop: false, prijsKleur: colors.tekstGedimd,
    };
  }
  return {
    borderWidth: 0, borderColor: 'transparent', schaduw: true,
    achtergrond: colors.kaart, groteKop: false, prijsKleur: colors.tekstPrimair,
  };
}

export function TradeCard({ trade, onGetrade, onOpenDetail, favoriet, onToggleFavoriet, onKoop, limiet = null, versusBtc }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const info = infoVoor(trade.symbool);
  const advies = adviesLabel(trade);
  const opmaak = niveauOpmaak(advies, colors);
  const niveaus = etoroNiveaus(trade.entry, trade.stopLoss, trade.takeProfit, limiet);
  // Waar deze coin te koop is. Dat is kennis uit Kaders eigen lijsten en hangt niet af van een
  // koppeling, dus het klopt ook zonder eToro-sleutel. Kent Kader geen enkel platform, dan tekent
  // PlatformChips niets: een lege plek is eerlijk, een grijze chip zou een platform beloven.
  const platforms = handelbaarOp(trade.symbool);
  // Boven de drempel blijft de kleur neutraal. Schuift eToro de stop op, dan zakt de R/R mee en is
  // die drempel het enige eerlijke oordeel: de score kan nog zo hoog zijn, met een stop van 10% en
  // een doel van 9% verdien je er niets aan.
  const haaltRr = niveaus.aangepast ? niveaus.rr >= MIN_RISK_REWARD : trade.voldoetAanRR;
  const koopadvies = genereerKoopadvies({
    score: trade.score,
    rsi: trade.rsi,
    trendOp: trade.ema20 > trade.ema50,
    macdBullish: trade.macdBullish,
    volumeRatio: trade.volumeRatio,
    highConviction: trade.highConviction,
  });

  function wisselUitgeklapt() {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setUitgeklapt(v => !v);
  }

  return (
    <View style={[
      styles.kaart,
      opmaak.schaduw ? shadow.kaart : null,
      {
        backgroundColor: opmaak.achtergrond,
        borderWidth: opmaak.borderWidth,
        borderColor: opmaak.borderColor,
      },
    ]}>
      <Pressable
        onPress={() => onOpenDetail?.(trade)}
        accessibilityRole="button"
        accessibilityLabel={`${trade.symbool} detail bekijken`}
        disabled={!onOpenDetail}
      >
      {/* Het oordeel staat boven de cijfers, want dat is wat je als eerste wil lezen. Rechts
          ernaast op welke platforms deze coin te koop is. Dat stond eerder als het woord ETORO
          naast STOP, waar het iets heel anders betekende (zie LevelRow) en waar het als een
          merklogo op een rare plek las. */}
      <View style={styles.badgeRij}>
        <AdviceBadge advies={advies} score={trade.score} />
        <PlatformChips
          platforms={platforms}
          maat={20}
          label={platforms.length > 0 ? `Verhandelbaar op ${noemPlatforms(platforms)}` : undefined}
        />
      </View>
      {/* Koptekst */}
      <View style={styles.kop}>
        <View style={styles.kopLinks}>
          <View style={styles.symboolRij}>
            {/* Een kop van 21px tegenover 16px is op afstand zichtbaar zonder dat er kleur aan
                te pas komt, en maakt de kaart die je moet lezen ook fysiek zwaarder. */}
            <Text style={[opmaak.groteKop ? Type.titel : Type.sectiekop, { color: colors.tekstPrimair }]}>
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
          <Text style={[Type.prijsGroot, { color: opmaak.prijsKleur }]}>{fmtPrijs(trade.prijs)}</Text>
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
        {/* Neutraal gekleurd, met opzet. Een achterblijver is voor een instap gunstig maar het is
            geen coin die het goed doet, en groen zou dat laatste beweren. De duiding staat in de
            uitklap en op het detailscherm, waar er ruimte is om het uit te leggen. */}
        {versusBtc !== undefined && (
          <View style={styles.metaItem}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>VS BTC</Text>
            <Text style={[Type.prijs, styles.metaWaarde, { color: colors.tekstPrimair }]}>
              {versusBtc >= 0 ? '+' : ''}{versusBtc.toFixed(0)}%
            </Text>
            {oordeelRs(versusBtc) !== 'gelijk' && (
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
                {oordeelRs(versusBtc) === 'achterblijver' ? 'achterblijver' : 'voorloper'}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Uitklapbare redenen + waarom-kopen onderbouwing */}
      {uitgeklapt && (
        <View style={[styles.redenen, { backgroundColor: colors.verhoogd }]}>
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
        </View>
      )}

      {/* Acties */}
      <View style={[styles.actiesRij, { borderTopColor: colors.rand }]}>
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
          {uitgeklapt
            ? <ChevronUp size={12} color={colors.cta} strokeWidth={1.75} />
            : <ChevronDown size={12} color={colors.cta} strokeWidth={1.75} />}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  badgeRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.base,
  },
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
