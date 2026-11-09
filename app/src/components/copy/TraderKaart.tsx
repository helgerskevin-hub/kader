// Kaart in Ontdek: wie is de belegger, hoe goed is hij volgens Kader, en de ster. Vier cijfers en
// niet meer, zodat de lijst rustig blijft. Tik op de kaart opent het profiel, de ster is een eigen
// raakvlak.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, shadow, spacing } from '../../theme/tokens';
import { fmtPct } from '../../engine/format';
import { Drukbaar } from '../Drukbaar';
import type { BronStijl } from '../../state/bronRect';
import { TraderAvatar } from './TraderAvatar';
import { OordeelBadge, ScorePil } from './OordeelBadge';
import { SterKnop } from './SterKnop';
import type { TraderMetScore } from '../../state/CopyProvider';

interface Props {
  trader: TraderMetScore;
  favoriet: boolean;
  onWisselFavoriet: () => void;
  onOpen: () => void;
  bron?: BronStijl;
}

export const TraderKaart = React.memo(function TraderKaart({ trader, favoriet, onWisselFavoriet, onOpen, bron }: Props) {
  const { colors } = useTheme();
  const { rij, beoordeling } = trader;
  const rendement = beoordeling.rendementPct;
  const copiers = typeof rij.copiers === 'number' ? rij.copiers.toLocaleString('nl-NL') : null;

  const cijfers: string[] = [];
  if (rendement !== null) cijfers.push(`${fmtPct(rendement)} 12 mnd`);
  if (beoordeling.maxDalingPct !== null) cijfers.push(`daling ${fmtPct(-beoordeling.maxDalingPct, 0)}`);
  if (typeof rij.riskScore === 'number') cijfers.push(`risico ${rij.riskScore}`);
  if (copiers) cijfers.push(`${copiers} copiers`);

  return (
    <Drukbaar
      onPress={onOpen}
      bron={bron}
      style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}
      accessibilityRole="button"
      accessibilityLabel={`${rij.username}, Kader-score ${beoordeling.score}, oordeel ${beoordeling.oordeel}. ${cijfers.join(', ')}. Open profiel.`}
    >
      <View style={styles.rij}>
        <TraderAvatar username={rij.username} url={rij.avatarUrl} grootte={44} />
        <View style={styles.naam}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]} numberOfLines={1}>{rij.username}</Text>
          <View style={styles.badges}>
            <ScorePil score={beoordeling.score} />
            <OordeelBadge oordeel={beoordeling.oordeel} />
          </View>
        </View>
        <SterKnop username={rij.username} aan={favoriet} onWissel={onWisselFavoriet} />
      </View>
      {cijfers.length > 0 && (
        <Text style={[Type.label, styles.cijfers, { color: colors.tekstGedimd }]}>
          {cijfers.join(' · ')}
        </Text>
      )}
    </Drukbaar>
  );
});

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  naam: {
    flex: 1,
    gap: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cijfers: {
    marginTop: spacing.md,
    fontSize: 12,
  },
});
