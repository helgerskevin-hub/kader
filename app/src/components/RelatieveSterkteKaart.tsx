import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight, TrendingUp } from 'lucide-react-native';
import { RelatieveSterkte, RS_PERIODE } from '../engine/relatieveSterkte';
import { Klimaat } from '../engine/marktklimaat';
import { infoVoor } from '../engine/coinInfo';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useUitleg, UitlegKnop, UitlegTekst } from './UitlegKnop';

interface Props {
  lijst: RelatieveSterkte[];
  klimaat: Klimaat;
  // Krijgt het symbool; het scherm zoekt de bijbehorende analyse op en opent het detailscherm.
  onOpenCoin: (symbool: string) => void;
}

const AANTAL = 5;

const UITLEG = `Dit is het rendement van elke coin over ${RS_PERIODE} dagen, min het rendement van bitcoin over diezelfde ${RS_PERIODE} dagen. Het verschil staat in procentpunten: +8 pt betekent dat de coin het 8 procentpunten beter deed dan bitcoin, ook als hij zelf gedaald is. Dat is juist in een dalende markt het interessante cijfer, want dan daalt alles en scoort alles laag op de gewone Kader-score. Wie mínder hard daalt heeft kopers die blijven zitten, en dat zijn doorgaans de coins die als eerste omhoog gaan als de markt draait. Let op: dit is uitdrukkelijk geen koopsignaal. Er zit geen entry, stop of doel aan, en de sterkste coin van een dalende markt kan gewoon blijven dalen. Zie het als een lijstje om in de gaten te houden, niet om vandaag iets mee te doen.`;

// Wie houdt stand? De enige long-informatie die in een dalende markt nog iets waard is. Bewust geen
// onderdeel van de 0-100 score: die is met de backtest gekalibreerd, en er een ongemeten component
// in mengen zou alle drempels in drempels.ts stilzwijgend verschuiven.
export function RelatieveSterkteKaart({ lijst, klimaat, onOpenCoin }: Props) {
  const { colors } = useTheme();
  const { open, wissel } = useUitleg();

  if (lijst.length === 0) return null;

  const top = lijst.slice(0, AANTAL);
  const aantalSterker = lijst.filter(r => r.versusBtc > 0).length;

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.kaart }]}>
      <View style={styles.titelRij}>
        <View style={styles.titelLinks}>
          <TrendingUp size={15} color={colors.tekstGedimd} strokeWidth={2} />
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>WIE HOUDT STAND?</Text>
        </View>
        <UitlegKnop open={open} onWissel={wissel} onderwerp="deze lijst" />
      </View>

      <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
        {klimaat === 'ongunstig'
          ? `De markt daalt, dus scoort bijna alles laag. Deze coins doen het over ${RS_PERIODE} dagen beter dan bitcoin. Geen koopsignaal, wel het lijstje om te volgen.`
          : `Prestatie over ${RS_PERIODE} dagen ten opzichte van bitcoin. Geen koopsignaal, wel een indicatie van waar de kracht zit.`}
      </Text>

      <View style={styles.lijst}>
        {top.map(item => (
          <Regel key={item.symbool} item={item} onOpen={() => onOpenCoin(item.symbool)} />
        ))}
      </View>

      <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
        {aantalSterker} van de {lijst.length} coins doen het beter dan bitcoin.
      </Text>

      <UitlegTekst open={open} tekst={UITLEG} />
    </View>
  );
}

function Regel({ item, onOpen }: { item: RelatieveSterkte; onOpen: () => void }) {
  const { colors } = useTheme();
  const naam = infoVoor(item.symbool).naam;
  const kleur = item.versusBtc >= 0 ? colors.winst : colors.verlies;
  const teken = item.versusBtc >= 0 ? '+' : '−';
  const verschil = `${teken}${Math.abs(item.versusBtc).toFixed(1)} pt`;

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${item.symbool}, ${naam}, ${verschil} ten opzichte van bitcoin. Bekijk de analyse.`}
      style={({ pressed }) => [
        styles.regel,
        { backgroundColor: pressed ? colors.verhoogd : 'transparent' },
      ]}
    >
      <Text style={[Type.sectiekop, styles.symbool, { color: colors.tekstPrimair }]}>{item.symbool}</Text>
      <Text style={[Type.caption, styles.naam, { color: colors.tekstGedimd }]} numberOfLines={1}>
        {naam}
        {item.bovenEma50 ? ' · boven EMA50' : ''}
      </Text>
      <Text style={[Type.prijs, { color: kleur, fontSize: 13 }]}>{verschil}</Text>
      <ChevronRight size={14} color={colors.tekstGedimd} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.sm,
  },
  titelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titelLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lijst: { gap: 2 },
  regel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.veld,
    minHeight: 44,
  },
  symbool: { minWidth: 52 },
  naam: { flex: 1 },
});
