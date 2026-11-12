// Kaart in de Feed: één trade van een favoriete belegger, in de kaartfamilie van Markt en Kansen.
// Compact staat erop welke coin, van wie, hoeveel de koers sinds de trader bewoog, de stop-doel-baan
// en de status. Kan je kopiëren, dan staat de knop er direct onder; een tik op de kaart klapt de
// details en de reden uit. Of kopiëren kan beslist beoordeelCopyTrade in engine/copyTrading.ts;
// deze kaart toont alleen de uitkomst, altijd met een label en nooit met kleur alleen.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AlertTriangle, CheckCircle, Copy as CopyIcoon, Eye, Info, LogOut } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts, Type } from '../../theme/typography';
import { radii, shadow, spacing } from '../../theme/tokens';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { schuifOvergang, uitklapInGestaffeld, uitklapUit } from '../../theme/lijstBeweging';
import { fmtBedrag, fmtPct, fmtPrijs } from '../../engine/format';
import { koersFactor } from '../../engine/etoroSymbolen';
import { COIN_INFO } from '../../engine/coinInfo';
import type { CopyStand } from '../../engine/copyTrading';
import type { FeedItem } from '../../state/copyOpslag';
import { CoinLogo } from '../CoinLogo';
import { ScoreRing } from '../ScoreRing';
import type { KaderCheck } from '../../state/kaderNiveaus';
import { StopDoelBaan } from '../StopDoelBaan';
import { useDrukVeer } from '../Drukbaar';
import { PilKnop } from '../PilKnop';
import { UitklapPijl } from '../UitklapPijl';
import { TraderAvatar } from './TraderAvatar';
import { Cijfer, CijferRij } from './Cijfer';

const DOLLARS = { valuta: 'USD' } as const;

export function tijdGeleden(ms: number, nu = Date.now()): string {
  const min = Math.max(0, Math.round((nu - ms) / 60000));
  if (min < 1) return 'net';
  if (min < 60) return `${min} min`;
  const uur = Math.round(min / 60);
  if (uur < 24) return `${uur} uur`;
  const dag = Math.round(uur / 24);
  return dag === 1 ? '1 dag' : `${dag} dagen`;
}

// Onder de 0,05% is er niets bewogen. Zonder dit stond er "−0.0%", wat een daling suggereert.
function verschuivingTekst(pct: number): string {
  return Math.abs(pct) < 0.05 ? '0.0%' : fmtPct(pct);
}

type Toon = 'goed' | 'letOp' | 'neutraal';

interface Status {
  label: string;
  toon: Toon;
  // De volledige reden, in de uitklap. Null als er niets uit te leggen valt.
  reden: string | null;
}

function bepaalStatus(item: FeedItem, stand: CopyStand, magHandelen: boolean, jijHebtNog: boolean): Status {
  if (jijHebtNog) {
    return {
      label: 'Trader uit',
      toon: 'letOp',
      reden: `${item.username} heeft deze positie gesloten, jij hebt hem nog. Verkoop ook als je zijn plan volgt, of laat hem lopen met je eigen stop. Kader verkoopt nooit zelf.`,
    };
  }
  if (item.gekopieerd) return { label: 'Gekopieerd', toon: 'goed', reden: null };
  switch (stand.soort) {
    case 'te-laat':
      return {
        label: 'Te laat',
        toon: 'letOp',
        reden: `De koers staat ${fmtPct(stand.verschuivingPct)} ten opzichte van de instap van ${item.username}. Kader kopieert pas tot 2% verschil, zodat je niet duurder instapt dan het plan van de trader.`,
      };
    case 'onder-stop':
      return { label: 'Onder stop', toon: 'letOp', reden: 'De koers staat al onder de stop van de trader. Instappen zou meteen je stop raken.' };
    case 'gesloten':
      return { label: 'Gesloten', toon: 'neutraal', reden: `${item.username} heeft deze positie gesloten.` };
    case 'short':
      return { label: 'Short', toon: 'neutraal', reden: 'Kader kopieert alleen long: je portfolio en de meldingen rekenen met long-posities.' };
    case 'buiten-kader':
      return { label: 'Buiten Kader', toon: 'neutraal', reden: 'Deze coin hoort niet bij de 57 die Kader volgt, dus Kader heeft er geen stop en doel voor.' };
    case 'kopieerbaar':
      return magHandelen
        ? { label: 'Kopieerbaar', toon: 'goed', reden: null }
        : { label: 'Alleen meekijken', toon: 'neutraal', reden: 'Koppel eToro met schrijfrecht om vanuit Kader te kopiëren.' };
  }
}

interface Props {
  item: FeedItem;
  stand: CopyStand;
  // Live koers in Kaders eenheid, of null.
  koers: number | null;
  bedragUsd: number;
  magHandelen: boolean;
  bezig: boolean;
  // Kort oplichten, als je via een melding binnenkomt.
  uitgelicht?: boolean;
  // Plek in de lijst, voor de staffeling van de baan.
  volgorde?: number;
  // Uit in het profiel van de trader zelf: daar staat zijn naam al bovenaan.
  metTrader?: boolean;
  // Krijgen de trade mee, zodat de lijst een stabiele callback kan geven en de memo op deze kaart
  // bij elke koers-poll blijft werken.
  onKopieer: (item: FeedItem) => void;
  // Alleen als de trader uitstapte en jij zijn kopie nog open hebt (en hij via eToro te verkopen is).
  onVerkoopOok?: (item: FeedItem) => void;
  // Hoe Kader zelf over deze coin denkt (zijn eigen score). Puur informatief.
  kaderCheck?: KaderCheck;
}

export const CopyTradeKaart = React.memo(function CopyTradeKaart({
  item, stand, koers, bedragUsd, magHandelen, bezig, uitgelicht = false, volgorde = 0, metTrader = true, onKopieer, onVerkoopOok, kaderCheck,
}: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const druk = useDrukVeer();

  const factor = item.symbool ? koersFactor(item.symbool) : 1;
  const entry = item.openRate / factor;
  const stop = item.stopLossRate ? item.stopLossRate / factor : 0;
  const doel = item.takeProfitRate ? item.takeProfitRate / factor : 0;
  const heeftBaan = stop > 0 && doel > 0 && stop < entry && doel > entry;
  const symbool = item.symbool ?? '?';
  const naam = item.symbool ? COIN_INFO[item.symbool]?.naam ?? item.symbool : 'Onbekende coin';
  const status = bepaalStatus(item, stand, magHandelen, !!onVerkoopOok);
  const kanKopieren = stand.soort === 'kopieerbaar' && !item.gekopieerd && magHandelen;
  const tijd = tijdGeleden(item.openTijd ?? item.gezien);

  const verschuiving = (stand.soort === 'kopieerbaar' || stand.soort === 'te-laat') ? stand.verschuivingPct : null;
  const toonKleur = (t: Toon) => (t === 'goed' ? colors.winst : t === 'letOp' ? colors.letOp : colors.tekstGedimd);
  const StatusIcoon = onVerkoopOok ? AlertTriangle
    : item.gekopieerd ? CheckCircle
    : status.toon === 'letOp' ? AlertTriangle
    : status.label === 'Alleen meekijken' ? Eye
    : status.toon === 'goed' ? CopyIcoon
    : Info;

  const kaartLabel = `${symbool}, ${item.isBuy ? 'long' : 'short'} van ${item.username}, ${tijd} geleden`
    + `${verschuiving !== null ? `, ${verschuivingTekst(verschuiving)} sinds de trader` : ''}, ${status.label}`
    + `${kaderCheck ? `, Kader-score voor ${symbool} ${kaderCheck.score}` : ''}`;

  return (
    <Animated.View
      ref={druk.ref}
      layout={schuifOvergang(reduceMotion)}
      style={[
        styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }, druk.stijl,
        uitgelicht && { borderColor: colors.cta, borderWidth: 1.5 },
      ]}
    >
      <Pressable
        onPress={() => setUitgeklapt(v => !v)}
        onPressIn={druk.drukIn}
        onPressOut={druk.drukUit}
        accessibilityRole="button"
        accessibilityState={{ expanded: uitgeklapt }}
        accessibilityLabel={kaartLabel}
        accessibilityHint={uitgeklapt ? 'Tik om in te klappen' : 'Tik voor details'}
        style={styles.boven}
      >
        <View style={styles.kop}>
          {kaderCheck && item.symbool
            ? <ScoreRing symbool={item.symbool} score={kaderCheck.score} maat={48} volgorde={volgorde} accessible={false} />
            : <CoinLogo symbool={symbool} grootte={40} />}
          <View style={styles.kopMidden}>
            <View style={styles.symboolRij}>
              <Text style={[Type.sectiekop, styles.symbool, { color: colors.tekstPrimair }]}>{symbool}</Text>
              <View style={[styles.pil, { backgroundColor: colors.verhoogd }]}>
                <Text style={[Type.overline, styles.pilTekst, { color: colors.tekstPrimair }]}>{item.isBuy ? 'LONG' : 'SHORT'}</Text>
              </View>
            </View>
            <View style={styles.vanRij}>
              {metTrader && <TraderAvatar username={item.username} grootte={18} />}
              <Text style={[Type.caption, styles.flex, { color: colors.tekstGedimd }]} numberOfLines={1}>
                {metTrader ? `${item.username} · ${tijd}` : `${naam} · ${tijd === 'net' ? 'net geopend' : `${tijd} geleden`}`}
              </Text>
            </View>
          </View>
          <View style={styles.kopRechts}>
            {verschuiving !== null ? (
              <>
                <Text style={[Type.prijs, styles.verschuiving, { color: stand.soort === 'te-laat' ? colors.letOp : colors.tekstPrimair }]}>
                  {verschuivingTekst(verschuiving)}
                </Text>
                <Text style={[Type.caption, { color: colors.tekstGedimd }]}>sinds trader</Text>
              </>
            ) : (
              <Text style={[Type.prijs, styles.verschuiving, { color: colors.tekstPrimair }]}>
                {fmtPrijs(koers ?? entry)}
              </Text>
            )}
          </View>
        </View>

        {heeftBaan && (
          <View style={styles.baan}>
            <StopDoelBaan stop={stop} entry={entry} doel={doel} live={koers ?? undefined} labels accessible={false} volgorde={volgorde} />
          </View>
        )}

        <View style={styles.voet}>
          <View style={[styles.status, { backgroundColor: toonKleur(status.toon) + '1A' }]}>
            <StatusIcoon size={13} color={toonKleur(status.toon)} strokeWidth={2} />
            <Text style={[Type.overline, styles.pilTekst, { color: toonKleur(status.toon) }]}>{status.label.toUpperCase()}</Text>
          </View>
          {item.leverage > 1 && (
            <View style={[styles.pil, { backgroundColor: colors.verhoogd }]}>
              <Text style={[Type.prijs, styles.pilTekst, { color: colors.tekstGedimd }]}>trader {item.leverage}x</Text>
            </View>
          )}
          <View style={[styles.pijlRondje, { backgroundColor: colors.verhoogd }]}>
            <UitklapPijl open={uitgeklapt} size={14} color={colors.tekstGedimd} strokeWidth={2} veerNaam="stevig" />
          </View>
        </View>
      </Pressable>

      {kanKopieren && (
        <View style={styles.actie}>
          <PilKnop
            label={bezig ? 'Even kijken' : `Kopieer voor ${fmtBedrag(bedragUsd, DOLLARS)}`}
            icoon={CopyIcoon}
            variant="cta"
            onPress={() => { if (!bezig) onKopieer(item); }}
            accessibilityLabel={`Kopieer ${symbool} van ${item.username} voor ${fmtBedrag(bedragUsd, DOLLARS)}`}
          />
        </View>
      )}

      {onVerkoopOok && (
        <View style={styles.actie}>
          <PilKnop
            label="Verkoop ook"
            icoon={LogOut}
            variant="tweede"
            onPress={() => onVerkoopOok(item)}
            accessibilityLabel={`Verkoop ook je ${symbool}, ${item.username} stapte uit. Je bevestigt in het volgende scherm.`}
          />
        </View>
      )}

      {uitgeklapt && (
        <Animated.View exiting={uitklapUit()} style={[styles.uitklap, { borderTopColor: colors.rand }]}>
          {status.reden && (
            <Animated.View entering={uitklapInGestaffeld(0, reduceMotion)} style={styles.redenRij}>
              <StatusIcoon size={15} color={toonKleur(status.toon)} strokeWidth={1.75} />
              <Text style={[Type.caption, styles.flex, styles.regelHoogte, { color: colors.tekstPrimair }]}>{status.reden}</Text>
            </Animated.View>
          )}
          <Animated.View entering={uitklapInGestaffeld(1, reduceMotion)}>
            <CijferRij>
              <Cijfer label="INSTAP TRADER" waarde={fmtPrijs(entry)} />
              <Cijfer label="NU" waarde={koers !== null ? fmtPrijs(koers) : 'onbekend'} />
              <Cijfer label="JIJ" waarde={`${fmtBedrag(bedragUsd, DOLLARS)} · 1x`} />
            </CijferRij>
          </Animated.View>
          {kaderCheck && (
            <Animated.View entering={uitklapInGestaffeld(2, reduceMotion)}>
              <Text style={[Type.caption, styles.regelHoogte, { color: colors.tekstPrimair }]}>
                <Text style={{ fontFamily: Fonts.monoMedium }}>Kader {kaderCheck.score}</Text>
                {kaderCheck.signaal === 'KOOP' ? ', zelf ook een koopsignaal' : kaderCheck.signaal === 'WATCH' ? ', zelf geen koopsignaal' : ''}
                {kaderCheck.reden ? ` · ${kaderCheck.reden}` : ''}. De ring om het logo is Kaders eigen score voor
                deze coin, los van de trader.
              </Text>
            </Animated.View>
          )}
          <Animated.View entering={uitklapInGestaffeld(3, reduceMotion)}>
            <Text style={[Type.caption, styles.regelHoogte, { color: colors.tekstGedimd }]}>
              {stop > 0
                ? 'Je kopieert zonder hefboom, met de stop en het doel van de trader.'
                : 'De trader zette geen stop. Kader zet zijn eigen stop eronder: zonder stop kopieert Kader niet.'}
            </Text>
          </Animated.View>
        </Animated.View>
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
  kopMidden: { flex: 1, minWidth: 0, gap: 4 },
  symboolRij: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  symbool: { fontSize: 17 },
  vanRij: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  kopRechts: { alignItems: 'flex-end', gap: 2, flexShrink: 1, maxWidth: '45%' },
  verschuiving: { fontSize: 17, lineHeight: 22 },
  pil: { paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radii.pill },
  pilTekst: { fontSize: 11.5, lineHeight: 14 },
  baan: { marginTop: spacing.md },
  voet: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  actie: { paddingHorizontal: spacing.base, paddingBottom: spacing.base, marginTop: -spacing.xs },
  uitklap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    paddingTop: spacing.base,
    gap: spacing.md,
  },
  redenRij: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  regelHoogte: { lineHeight: 18 },
});
