// Kaart in Ontdek: wie is de belegger, hoe goed is hij volgens Kader, en de ster. Zelfde opbouw als
// de kaarten op Markt en Kansen: de score als ring om de avatar, het rendement rechts, en daaronder
// drie cijfers. Tik op de kaart opent het profiel; de ster is een eigen raakvlak.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, shadow, spacing } from '../../theme/tokens';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { schuifOvergang } from '../../theme/lijstBeweging';
import { fmtPct } from '../../engine/format';
import { Drukbaar } from '../Drukbaar';
import { ScoreRing } from '../ScoreRing';
import type { BronStijl } from '../../state/bronRect';
import { TraderAvatar } from './TraderAvatar';
import { OordeelBadge } from './OordeelBadge';
import { SterKnop } from './SterKnop';
import { Cijfer, CijferRij } from './Cijfer';
import type { TraderMetScore } from '../../state/CopyProvider';
import type { TrackrecordSamenvatting } from '../../engine/copyTrading';

interface Props {
  trader: TraderMetScore;
  favoriet: boolean;
  onWisselFavoriet: () => void;
  onOpen: () => void;
  bron?: BronStijl;
  // Plek in de lijst, voor de staffeling van de ring.
  volgorde?: number;
  // Kaders eigen meting sinds je ster, alleen voor favorieten.
  trackrecord?: TrackrecordSamenvatting;
  // Waarom deze trader niet in de lijst staat (alleen bij een zoekresultaat van buiten de lijst).
  buiten?: string | null;
}

export const TraderKaart = React.memo(function TraderKaart({ trader, favoriet, onWisselFavoriet, onOpen, bron, volgorde = 0, trackrecord, buiten }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { rij, beoordeling } = trader;
  const rendement = beoordeling.rendementPct;
  const copiers = typeof rij.copiers === 'number' ? rij.copiers.toLocaleString('nl-NL') : null;
  const score = Math.round(beoordeling.score);

  const label = `${rij.username}, Kader-score ${score}, oordeel ${beoordeling.oordeel}`
    + `${rendement !== null ? `, ${fmtPct(rendement)} in 12 maanden` : ''}`
    + `${beoordeling.maxDalingPct !== null ? `, grootste daling ${fmtPct(-beoordeling.maxDalingPct, 0)}` : ''}`
    + `${typeof rij.riskScore === 'number' ? `, risico ${rij.riskScore} van 10` : ''}`
    + `${copiers ? `, ${copiers} copiers` : ''}`
    + `${trackrecord ? `, ${trackrecordTekst(trackrecord)}` : ''}`
    + `${buiten ? `, niet in de lijst: ${buiten}` : ''}. Open profiel.`;

  return (
    <Animated.View layout={schuifOvergang(reduceMotion)}>
      <Drukbaar
        onPress={onOpen}
        bron={bron}
        style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.kop}>
          <ScoreRing
            score={score}
            maat={52}
            volgorde={volgorde}
            accessible={false}
            kind={<TraderAvatar username={rij.username} url={rij.avatarUrl} grootte={40} />}
          />
          <View style={styles.midden}>
            <Text style={[Type.sectiekop, styles.naam, { color: colors.tekstPrimair }]} numberOfLines={1}>{rij.username}</Text>
            <View style={styles.badges}>
              <OordeelBadge oordeel={beoordeling.oordeel} />
              <Text style={[Type.label, { color: colors.tekstGedimd }]}>score {score}</Text>
            </View>
          </View>
          <View style={styles.rechts}>
            {rendement !== null && (
              <>
                <Text style={[Type.prijs, styles.rendement, { color: rendement >= 0 ? colors.winst : colors.verlies }]}>
                  {fmtPct(rendement)}
                </Text>
                <Text style={[Type.caption, { color: colors.tekstGedimd }]}>12 mnd</Text>
              </>
            )}
          </View>
          <SterKnop username={rij.username} aan={favoriet} onWissel={onWisselFavoriet} />
        </View>

        <View style={[styles.cijfers, { borderTopColor: colors.rand }]}>
          <CijferRij>
            <Cijfer
              label="MAX DALING"
              waarde={beoordeling.maxDalingPct !== null ? fmtPct(-beoordeling.maxDalingPct, 0) : 'onbekend'}
            />
            <Cijfer label="RISICO" waarde={typeof rij.riskScore === 'number' ? `${rij.riskScore}/10` : 'onbekend'} />
            <Cijfer label="COPIERS" waarde={copiers ?? 'onbekend'} />
          </CijferRij>
          {trackrecord && (
            <Text style={[Type.caption, styles.extra, { color: colors.tekstGedimd }]}>
              <Text style={{ color: colors.tekstPrimair }}>Sinds je ster: </Text>
              {trackrecordTekst(trackrecord)}
            </Text>
          )}
          {buiten && (
            <Text style={[Type.caption, styles.extra, { color: colors.letOp }]}>Niet in Ontdek: {buiten}</Text>
          )}
        </View>
      </Drukbaar>
    </Animated.View>
  );
});

// "ongeveer +4,2% gemiddeld over 9 trades, 6 met winst": de uitstapkoers is Kaders benadering.
function trackrecordTekst(t: TrackrecordSamenvatting): string {
  const open = t.open > 0 ? `${t.open} nog open` : '';
  if (t.aantal === 0 || t.gemPct === null) return open ? `nog geen gesloten trades, ${open}` : 'nog geen trades gezien';
  const kern = `ongeveer ${fmtPct(t.gemPct)} gemiddeld over ${t.aantal} ${t.aantal === 1 ? 'trade' : 'trades'}, ${t.winst} met winst`;
  return open ? `${kern}, ${open}` : kern;
}

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  midden: { flex: 1, minWidth: 0, gap: 6 },
  naam: { fontSize: 17 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rechts: { alignItems: 'flex-end', gap: 2 },
  rendement: { fontSize: 17, lineHeight: 22 },
  extra: { marginTop: spacing.sm, lineHeight: 20 },
  cijfers: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
