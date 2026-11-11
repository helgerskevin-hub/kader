import React, { memo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { CheckCircle, Star, ShoppingCart } from 'lucide-react-native';
import { fmtPrijs, fmtRR } from '../engine/format';
import { StopLossLimiet } from '../engine/etoroLimieten';
import { etoroPlan } from '../engine/opportunities';
import { RADAR_METING_UITLEG, RADAR_PLAN_UITLEG } from '../engine/momentum';
import { opsomming } from '../engine/correlatie';
import { handelbaarOp, isAlleenBekijken, noemPlatforms } from '../engine/platforms';
import { KansMetRang, RangVerschil } from '../state/KansenProvider';
import { useValutaStand } from '../state/useValuta';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { schuifOvergang, uitklapInGestaffeld, uitklapUit } from '../theme/lijstBeweging';
import { AdviceBadge } from './AdviceBadge';
import { PlatformChips } from './PlatformChip';
import { PlatformSheet } from './PlatformSheet';
import { useDrukVeer } from './Drukbaar';
import { UitklapPijl } from './UitklapPijl';
import { MomentumCompact, afstandLabel } from './MomentumBalken';
import { Sparkline } from './Sparkline';
import { ScoreRing } from './ScoreRing';
import { StopDoelBaan } from './StopDoelBaan';
import { PilKnop } from './PilKnop';

interface Props {
  kans: KansMetRang;
  // Plek in de lijst, voor de staffeling van ring, balkjes en sparkline bij binnenkomst.
  volgorde?: number;
  onOpenDetail: (kans: KansMetRang) => void;
  onGetrade: (kans: KansMetRang) => void;
  favoriet?: boolean;
  onToggleFavoriet?: (symbool: string) => void;
  // De stop-loss-grens van eToro voor deze coin. Zonder grens blijft het niveau van Kader staan.
  limiet?: StopLossLimiet | null;
  // Ontbreekt zonder koppeling met schrijfrecht. De knop opent alleen de koopsheet, hij plaatst
  // nooit zelf een order.
  onKoop?: (kans: KansMetRang) => void;
  // De scan is ouder dan KANSEN_COOLDOWN_MS: de koers waar het plan mee rekent kan achterhaald
  // zijn, dus geen Koop-knop tot er ververst is. Het scherm legt dat boven de lijst uit.
  verouderd?: boolean;
  // Je hebt deze coin al als open positie. Een merkje, geen filter: de radar zelf blijft zuiver
  // marktanalyse.
  inBezit?: boolean;
  // Open posities waar deze coin de afgelopen 30 dagen sterk mee meebewoog (zie correlatie.ts).
  beweegtMeeMet?: string[];
}

const GEEN_SYMBOLEN: string[] = [];

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
  verouderd = false, inBezit = false, beweegtMeeMet = GEEN_SYMBOLEN,
}: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const [platformsOpen, setPlatformsOpen] = useState(false);
  // De hele kaart veert mee, en het detailscherm groeit uit de hele kaart, ook via Details.
  const druk = useDrukVeer(undefined, { kleur: colors.kaart, radius: radii.kaart });

  // Het plan van de radar, niet de Markt-niveaus uit kans.trade (zie momentum.ts).
  const plan = kans.niveaus;
  // Zoals het bij eToro te zetten is: eist eToro een ruimere stop, dan schuift hij op en zakt de
  // R/R mee. Baan en R/R-chip lezen allebei hieruit.
  const niveaus = etoroPlan(kans, limiet);
  // Kopen kan bij elke coin met een plan, net als op Markt: Kader adviseert hier niet (zie WATCH en
  // RADAR_METING_UITLEG), maar wie zelf kiest moet in één tik kunnen kopen met een plan dat de
  // kosten draagt. Het merkje hangt aan dezelfde voorwaarde als de knop.
  const platforms = onKoop ? handelbaarOp(kans.symbool) : [];
  const kanKopen = !!(plan && !verouderd && onKoop && !isAlleenBekijken(kans.symbool));
  const afstand = kans.ingredienten.afstandHigh90d;
  const schuif = schuifOvergang(reduceMotion);

  // Prijs en R/R staan op de kaart maar zaten niet in het label: de ring en de chip zijn niet apart
  // voorleesbaar (ze zitten binnen het tikvlak), dus zonder deze twee mist TalkBack ze. Zonder plan
  // is er geen R/R.
  const kaartLabel = `${kans.symbool}, ${kans.naam}, volglijst, momentumscore ${Math.round(kans.momentumScore)}`
    + `, prijs ${fmtPrijs(kans.prijs)}${plan && niveaus ? `, R/R ${fmtRR(niveaus.rr)}` : ''}`
    + (inBezit ? ', heb je al' : '');

  return (
    <Animated.View
      ref={druk.ref}
      layout={schuif}
      style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }, druk.stijl]}
    >
      {/* Het bovenste deel (kop, grafiek, momentum, voet) klapt de kaart uit en weer in. Het
          detailscherm opent alleen nog via Details in het uitgeklapte deel. */}
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
          <ScoreRing symbool={kans.symbool} score={kans.momentumScore} maat={48} volgorde={volgorde} accessible={false} />
          <View style={styles.kopMidden}>
            <View style={styles.symboolRij}>
              <Text style={[Type.sectiekop, styles.symbool, { color: colors.tekstPrimair }]}>{kans.symbool}</Text>
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
            {/* Twee regels is genoeg voor elke naam op de radar; zo kapt er nooit iets af. */}
            <Text style={[Type.caption, { color: colors.tekstGedimd }]} numberOfLines={2}>
              {kans.naam}
            </Text>
          </View>
          <View style={styles.kopRechts}>
            <Text style={[Type.prijsGroot, styles.prijs, { color: colors.tekstPrimair }]}>
              {fmtPrijs(kans.prijs)}
            </Text>
            {/* Neutraal: dichter bij de top is hier het hele criterium, geen winst of verlies. */}
            {afstand !== null && (
              <View style={[styles.pil, { backgroundColor: colors.verhoogd }]}>
                <Text style={[Type.prijs, styles.pilTekst, { color: colors.tekstPrimair }]}>
                  {afstandLabel(afstand)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {kans.sparkline.length >= 2 && (
          <View style={styles.grafiek}>
            <Sparkline reeks={kans.sparkline} hoogte={52} vlak stip volgorde={volgorde} />
          </View>
        )}

        <View style={styles.momentum}>
          <MomentumCompact ingredienten={kans.ingredienten} volgorde={volgorde} vandaag={kans.vandaagPct ?? null} />
        </View>

        {/* Wrap: met een grotere systeemletter passen badge, rang en R/R op 360 dp niet altijd
            naast elkaar. De pijl blijft dan rechts op de laatste regel. */}
        <View style={styles.voet}>
          {/* Altijd WATCH: de radar is een volglijst (zie RADAR_METING_UITLEG in momentum.ts). */}
          <AdviceBadge advies="WATCH" score={kans.momentumScore} />
          <RangLabel verschil={kans.rangVerschil} />
          {/* Zonder plan is er geen R/R om te tonen. */}
          {plan && niveaus && (
            <View style={[styles.rrChip, { backgroundColor: colors.verhoogd }]}>
              <Text style={[Type.prijs, styles.pilTekst, { color: colors.tekstGedimd }]}>
                R/R {fmtRR(niveaus.rr)}
              </Text>
            </View>
          )}
          {/* Tekst en geen kleur alleen; het kaartlabel leest hem ook voor. */}
          {inBezit && (
            <View style={[styles.nieuw, { backgroundColor: colors.verhoogd }]}>
              <Text style={[Type.overline, { color: colors.tekstPrimair }]}>HEB JE AL</Text>
            </View>
          )}
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
            {plan && niveaus ? (
              <>
                <StopDoelBaan
                  stop={niveaus.stop}
                  entry={plan.entry}
                  doel={plan.takeProfit}
                  live={kans.prijs}
                  labels
                />
                {/* De stop staat hier veel ruimer dan op Markt. Zonder deze regel lijkt een andere
                    stop voor dezelfde coin een fout. */}
                <Text style={[Type.caption, styles.notitie, { color: colors.tekstGedimd }]}>
                  {RADAR_PLAN_UITLEG}
                </Text>
                {/* Alleen als eToro voor deze coin helemaal geen stop toelaat. */}
                {niveaus.uitleg ? (
                  <Text style={[Type.caption, styles.notitie, { color: colors.letOp }]}>
                    {niveaus.uitleg}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[Type.caption, styles.reden, { color: colors.tekstGedimd }]}>
                Te weinig koersdata om een plan te maken.
              </Text>
            )}
          </Animated.View>

          <Animated.View entering={uitklapInGestaffeld(1, reduceMotion)} style={styles.waarom}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>WAAROM</Text>
            {kans.redenen.map((r, i) => (
              <Text key={i} style={[Type.caption, styles.reden, { color: colors.tekstGedimd }]}>• {r}</Text>
            ))}
            <Text style={[Type.caption, styles.uitleg, { color: colors.tekstGedimd }]}>
              {RADAR_METING_UITLEG}
            </Text>
            {beweegtMeeMet.length > 0 && (
              <Text style={[Type.caption, styles.uitleg, { color: colors.letOp }]}>
                Let op: beweegt sterk mee met je {opsomming(beweegtMeeMet)}. Samen is dat grotendeels
                één weddenschap.
              </Text>
            )}
          </Animated.View>

          {/* De knoppenrij mag afbreken: Getrade en Koop met merkjes passen op 360 dp niet altijd op
              één regel. Details staat daaronder op een eigen regel. */}
          <Animated.View entering={uitklapInGestaffeld(2, reduceMotion)} style={styles.knoppen}>
            {plan && (
              <View style={styles.pilRij}>
                <PilKnop label="Getrade" icoon={CheckCircle} variant="tweede" onPress={() => onGetrade(kans)} />
                {kanKopen && onKoop && (
                  <View style={styles.koopGroep}>
                    <PilKnop
                      label="Koop"
                      icoon={ShoppingCart}
                      variant="cta"
                      onPress={() => onKoop(kans)}
                      accessibilityLabel={`${kans.symbool} kopen via eToro`}
                    />
                    {/* De merkjes staan alleen naast een Koop-knop die er ook echt staat. */}
                    {platforms.length > 0 && (
                      <Pressable
                        onPress={() => setPlatformsOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Te kopen via ${noemPlatforms(platforms)}. Tik voor uitleg.`}
                        // Links maar 4: daar staat de Koop-pil, en de slop mag het raakvlak van die knop
                        // niet overlappen.
                        hitSlop={{ top: 12, bottom: 12, left: 4, right: 12 }}
                      >
                        <PlatformChips platforms={platforms} maat={20} />
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )}
            <View style={styles.details}>
              <PilKnop
                label="Details"
                variant="link"
                // Alleen meten, niet krimpen: het detailscherm groeit uit de hele kaart, en de knop
                // zelf veert al als Drukbaar.
                onPressIn={druk.meetBron}
                onPress={() => {
                  druk.legBronVast();
                  onOpenDetail(kans);
                }}
                accessibilityLabel={`${kans.symbool} details bekijken`}
              />
            </View>
          </Animated.View>
        </Animated.View>
      )}
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
    // Knipt de blokken die bij het dichtklappen nog uitfaden af op de rand van de krimpende kaart.
    overflow: 'hidden',
  },
  boven: { padding: spacing.base },
  nieuw: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
  },
  rang: { fontSize: 12 },
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
  momentum: { marginTop: spacing.md },
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
  notitie: { lineHeight: 18, marginTop: spacing.sm },
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
  knoppen: { gap: spacing.sm },
  // Details staat op een eigen regel, rechts. In de afbrekende knoppenrij met marginLeft auto
  // rekende Yoga er een lege extra regel bij, met een gat onder de knop.
  details: { alignSelf: 'flex-end' },
});
