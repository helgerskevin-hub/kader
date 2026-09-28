import React, { memo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { CheckCircle, Star, ShoppingCart } from 'lucide-react-native';
import { fmtPrijs, fmtRR } from '../engine/format';
import { StopLossLimiet } from '../engine/etoroLimieten';
import { MIN_RISK_REWARD } from '../engine/analyzer';
import { effectiefSignaal } from '../engine/opportunities';
import { handelbaarOp, noemPlatforms } from '../engine/platforms';
import { KansMetRang, RangVerschil } from '../state/KansenProvider';
import { useValutaStand } from '../state/useValuta';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { schuifOvergang, uitklapIn, uitklapUit } from '../theme/lijstBeweging';
import { AdviceBadge } from './AdviceBadge';
import { LevelRow } from './LevelRow';
import { PlatformChips } from './PlatformChip';
import { PlatformSheet } from './PlatformSheet';
import { useDrukVeer } from './Drukbaar';
import { UitklapPijl } from './UitklapPijl';
import { MomentumBalken } from './MomentumBalken';
import { Sparkline } from './Sparkline';

interface Props {
  kans: KansMetRang;
  // Plek in de lijst, voor de staffeling van balkjes en sparkline bij binnenkomst.
  volgorde?: number;
  onOpenDetail: (kans: KansMetRang) => void;
  onGetrade: (kans: KansMetRang) => void;
  // Ontbreekt zonder koppeling met schrijfrecht. De knop opent alleen de sheet, hij plaatst nooit
  // zelf een order.
  onKoop?: (kans: KansMetRang) => void;
  favoriet?: boolean;
  onToggleFavoriet?: (symbool: string) => void;
  // De stop-loss-grens van eToro voor deze coin. Zonder grens blijft het niveau van Kader staan.
  limiet?: StopLossLimiet | null;
  // De scan is ouder dan KANSEN_COOLDOWN_MS: het plan kan al achterhaald zijn, dus geen Koop-knop
  // tot er ververst is. Het scherm legt dat boven de lijst in één regel uit.
  verouderd?: boolean;
}

// Kleine rangwissel naast de badge: pijl plus getal, dus niet alleen kleur. 'nieuw' is een eigen
// label, null (geen vorige scan, of een gelijke plek) laat niets zien.
export function RangLabel({ verschil }: { verschil: RangVerschil }) {
  const { colors } = useTheme();
  if (verschil === null || verschil === 0) return null;

  if (verschil === 'nieuw') {
    return (
      <View
        style={[styles.nieuw, { backgroundColor: colors.cta + '1A' }]}
        accessibilityLabel="Nieuw op de radar"
      >
        <Text style={[Type.overline, { color: colors.cta }]}>NIEUW</Text>
      </View>
    );
  }

  const op = verschil > 0;
  return (
    <Text
      style={[Type.prijs, styles.rang, { color: op ? colors.winst : colors.verlies }]}
      accessibilityLabel={`${op ? 'Gestegen' : 'Gezakt'} met ${Math.abs(verschil)} ${Math.abs(verschil) === 1 ? 'plek' : 'plekken'}`}
    >
      {op ? '▲' : '▼'}{Math.abs(verschil)}
    </Text>
  );
}

// Memo: tijdens een scan tekent KansenScreen bij elk voortgangstikje opnieuw, en zonder memo
// tekenden alle al gelande kaarten mee (en startten hun balkjes en sparkline opnieuw op).
export const KansKaart = memo(function KansKaart({
  kans, volgorde = 0, onOpenDetail, onGetrade, onKoop, favoriet, onToggleFavoriet, limiet = null,
  verouderd = false,
}: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const [platformsOpen, setPlatformsOpen] = useState(false);
  // De hele kaart veert mee, en het detailscherm groeit uit de hele kaart.
  const druk = useDrukVeer(undefined, { kleur: colors.kaart, radius: radii.kaart });

  // Het uitbraak-plan van de radar, niet de Markt-niveaus uit kans.trade (zie momentum.ts).
  const plan = kans.niveaus;
  // Na de eToro-stopcorrectie: schuift eToro de stop op en zakt de R/R onder de drempel, dan is het
  // hier WATCH, ook als de scan KOOP zei. Badge, R/R-regel en Koop-knop lezen alle drie hieruit.
  const { signaal, haaltRr, niveaus } = effectiefSignaal(kans, limiet);
  // Zelfde regel als TradeCard: het merkje betekent dat Kader deze order kan plaatsen, dus het
  // hangt aan precies dezelfde voorwaarde als de koopknop.
  const platforms = onKoop ? handelbaarOp(kans.symbool) : [];
  const schuif = schuifOvergang(reduceMotion);

  return (
    <Animated.View
      ref={druk.ref}
      layout={schuif}
      style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }, druk.stijl]}
    >
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
        <View style={styles.badgeRij}>
          <View style={styles.badgeLinks}>
            <AdviceBadge advies={signaal} score={kans.momentumScore} />
            <RangLabel verschil={kans.rangVerschil} />
          </View>
          {platforms.length > 0 && (
            <Pressable
              onPress={() => setPlatformsOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Te kopen via ${noemPlatforms(platforms)}. Tik voor uitleg.`}
              hitSlop={12}
            >
              <PlatformChips platforms={platforms} maat={20} />
            </Pressable>
          )}
        </View>

        <View style={styles.kop}>
          <View style={styles.kopLinks}>
            <View style={styles.symboolRij}>
              <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{kans.symbool}</Text>
              {onToggleFavoriet && (
                <Pressable
                  onPress={() => onToggleFavoriet(kans.symbool)}
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
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{kans.naam}</Text>
          </View>
          <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>{fmtPrijs(kans.prijs)}</Text>
        </View>

        {kans.sparkline.length >= 2 && (
          <View style={styles.sectie}>
            <Sparkline reeks={kans.sparkline} hoogte={40} volgorde={volgorde} />
          </View>
        )}

        <View style={styles.sectie}>
          <MomentumBalken ingredienten={kans.ingredienten} volgorde={volgorde} />
        </View>

        <View style={styles.sectie}>
          {plan && niveaus ? (
            <>
              <LevelRow
                stop={niveaus.stop}
                entry={plan.entry}
                doel={plan.takeProfit}
                stopAangepast={niveaus.aangepast}
              />
              {/* De stop staat hier op de EMA20 en niet op de swing low zoals op Markt. Zonder deze
                  regel lijkt een andere stop voor dezelfde coin een fout. */}
              <Text style={[Type.caption, styles.plannotitie, { color: colors.tekstGedimd }]}>
                Uitbraak-plan: stop op de EMA20, doel boven de 90d-top.
              </Text>
              {/* Zelfde waarschuwing als TradeCard: onder de drempel in de letOp-kleur, met de
                  drempel in dezelfde opmaak als de waarde zodat "onder 1 : 2.0" niet als "1,2" leest. */}
              {!haaltRr && (
                <Text style={[Type.caption, styles.plannotitie, { color: colors.letOp }]}>
                  R/R {fmtRR(niveaus.rr)}, onder {fmtRR(MIN_RISK_REWARD)}: geen koopsignaal.
                </Text>
              )}
              {niveaus.uitleg ? (
                <Text style={[Type.caption, styles.plannotitie, { color: colors.letOp }]}>
                  {niveaus.uitleg}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[Type.caption, styles.plannotitie, { color: colors.tekstGedimd, marginTop: 0 }]}>
              De koers staat onder de EMA20, dus er is nu geen instap-plan.
            </Text>
          )}
        </View>
      </Pressable>

      {uitgeklapt && (
        <Animated.View
          entering={uitklapIn(reduceMotion)}
          exiting={uitklapUit()}
          style={[styles.redenen, { backgroundColor: colors.verhoogd }]}
        >
          {kans.redenen.map((r, i) => (
            <Text key={i} style={[Type.caption, styles.reden, { color: colors.tekstGedimd }]}>• {r}</Text>
          ))}
          <Text style={[Type.caption, styles.reden, { color: colors.tekstGedimd, marginTop: 4 }]}>
            Dit is een uitbraak-plan: de stop staat op de EMA20 en het doel 2x ATR boven de
            90d-top. Daarom wijken de niveaus af van die op Markt.
          </Text>
        </Animated.View>
      )}

      <Animated.View layout={schuif} style={[styles.actiesRij, { borderTopColor: colors.rand }]}>
        <Pressable
          style={styles.actieKnop}
          onPress={() => setUitgeklapt(v => !v)}
          accessibilityRole="button"
          accessibilityLabel={uitgeklapt ? 'Minder info' : 'Waarom deze kans'}
        >
          <Text style={[Type.caption, styles.actieLabel, { color: colors.cta }]}>
            {uitgeklapt ? 'Minder' : 'Waarom'}
          </Text>
          <UitklapPijl open={uitgeklapt} size={12} color={colors.cta} />
        </Pressable>

        {plan && (
          <>
            <View style={[styles.scheiding, { backgroundColor: colors.rand }]} />
            <Pressable
              style={styles.actieKnop}
              onPress={() => onGetrade(kans)}
              accessibilityRole="button"
              accessibilityLabel="Getrade"
            >
              <CheckCircle size={15} color={colors.winst} strokeWidth={1.75} />
              <Text style={[Type.caption, styles.actieLabel, { color: colors.winst }]}>Getrade</Text>
            </Pressable>
          </>
        )}

        {/* Alleen bij een KOOP met een plan: zonder entry, stop en doel valt er geen order te
            bouwen, en bij WATCH zegt Kader zelf dat het nog niet klopt. Bij een verouderde scan ook
            niet: dan kan het plan al achterhaald zijn. */}
        {plan && signaal === 'KOOP' && !verouderd && onKoop && (
          <>
            <View style={[styles.scheiding, { backgroundColor: colors.rand }]} />
            <Pressable
              style={styles.actieKnop}
              onPress={() => onKoop(kans)}
              accessibilityRole="button"
              accessibilityLabel={`${kans.symbool} kopen via eToro`}
            >
              <ShoppingCart size={15} color={colors.cta} strokeWidth={1.75} />
              <Text style={[Type.caption, styles.actieLabel, { color: colors.cta }]}>Koop</Text>
            </Pressable>
          </>
        )}
      </Animated.View>

      {/* Alleen mounten als hij open is: anders staat er per kaart een Modal in de boom. */}
      {platformsOpen && (
        <PlatformSheet
          zichtbaar
          onSluiten={() => setPlatformsOpen(false)}
          symbool={kans.symbool}
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
  badgeRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.base,
  },
  badgeLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nieuw: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
  },
  rang: { fontSize: 12 },
  kop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  kopLinks: { gap: 2, flex: 1 },
  symboolRij: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectie: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  plannotitie: { lineHeight: 18, marginTop: spacing.sm },
  redenen: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderRadius: radii.veld,
    padding: spacing.md,
    gap: 4,
  },
  reden: { lineHeight: 18 },
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
    minHeight: 44,
  },
  scheiding: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.sm,
  },
  actieLabel: { fontSize: 12 },
});
