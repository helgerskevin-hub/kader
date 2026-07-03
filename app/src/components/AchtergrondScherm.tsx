import React, { useState } from 'react';
import {
  Modal, ScrollView, View, Text, Pressable, StyleSheet,
  Platform, StatusBar, LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Candle } from '../engine/types';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { ScoreBadge } from './ScoreBadge';
import { AdviceBadge } from './AdviceBadge';
import { LevelRow } from './LevelRow';
import { MarktBalk } from './MarktBalk';
import { AngstHebzucht } from './AngstHebzucht';
import { PrijsGrafiek } from './PrijsGrafiek';
import { Disclaimer } from './Disclaimer';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
}

// SafeAreaView krijgt geen correcte top-inset binnen een full-screen Modal op Android,
// dus vullen we die hier handmatig aan met de status bar-hoogte.
const androidStatusBarPadding = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

// ponytail: vaste demo-reeks in plaats van live data, zodat de uitleg altijd hetzelfde toont
const DEMO_CANDLES: Candle[] = Array.from({ length: 40 }, (_, i) => {
  const close = 100 + i * 0.4 + Math.sin(i / 4) * 6;
  return { open: close - 0.5, high: close + 1, low: close - 1, close, volume: 1000, tijd: Date.now() - (40 - i) * 864e5 };
});

const SECTIES = [
  { id: 'score', titel: 'De Kader-score' },
  { id: 'advies', titel: 'Advieslabels' },
  { id: 'grafiek', titel: 'De prijsgrafiek' },
  { id: 'atr', titel: 'Stop en doel (ATR)' },
  { id: 'indicatoren', titel: 'De indicatoren' },
  { id: 'marktbalk', titel: 'De marktbalk' },
  { id: 'feargreed', titel: 'Fear & Greed' },
  { id: 'kansscore', titel: 'Kansscore (Grote Kansen)' },
  { id: 'statistieken', titel: 'Portfolio-statistieken' },
  { id: 'oordeel', titel: 'Het trader-oordeel' },
] as const;

type SectieId = typeof SECTIES[number]['id'];

export function AchtergrondScherm({ zichtbaar, onSluiten }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [open, setOpen] = useState<SectieId | null>(null);

  function wisselOpen(id: SectieId) {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpen(v => (v === id ? null : id));
  }

  if (!zichtbaar) return null;

  return (
    <Modal visible={zichtbaar} animationType="slide" onRequestClose={onSluiten} presentationStyle="fullScreen">
      <SafeAreaView style={[styles.root, { backgroundColor: colors.achtergrond }]}>
        <View style={[styles.header, { borderBottomColor: colors.rand, paddingTop: spacing.base + androidStatusBarPadding }]}>
          <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Achtergrond informatie</Text>
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

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[Type.body, styles.intro, { color: colors.tekstGedimd }]}>
            Hoe rekent Kader? Hieronder staat per weergave in de app hoe die tot stand komt.
          </Text>

          <Sectie id="score" titel="De Kader-score" open={open === 'score'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              De score van 0 tot 100 is een optelsom van technische signalen: EMA20 boven EMA50 (opwaartse trend) telt
              25 punten, koers boven EMA20 telt 15 punten, een gezonde RSI tussen 45 en 68 telt 20 punten (RSI onder
              35, mogelijk herstel, telt 10 punten), een bullish MACD telt 20 punten (met 5 punten extra bij een
              positief histogram), en een volumepiek van minstens 1,5 keer het gemiddelde telt 15 punten (1,2 keer
              telt 8 punten). Vanaf een score van 55 krijgt een coin het signaal KOOP.
            </Text>
            <View style={styles.badgeRij}>
              <ScoreBadge score={25} />
              <ScoreBadge score={55} />
              <ScoreBadge score={80} />
            </View>
          </Sectie>

          <Sectie id="advies" titel="Advieslabels" open={open === 'advies'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              AFWACHTEN betekent geen koopsignaal. KOOPZONE betekent score 55 of hoger. STERK KOOP betekent score 72
              of hoger. HIGH CONVICTION is de sterkste combinatie: score 75 of hoger, samen met een stijgende trend,
              een bullish MACD en een volume van minstens 1,3 keer het gemiddelde.
            </Text>
            <View style={styles.badgeRij}>
              <AdviceBadge advies="AFWACHTEN" />
              <AdviceBadge advies="KOOPZONE" />
              <AdviceBadge advies="STERK KOOP" />
              <AdviceBadge advies="HIGH CONVICTION" />
            </View>
          </Sectie>

          <Sectie id="grafiek" titel="De prijsgrafiek" open={open === 'grafiek'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              De grafiek toont de laatste koersen als lijn: groen als de koers over de weergegeven periode is
              gestegen, rood als die is gedaald. De stippellijnen zijn de STOP (rood), ENTRY (blauw) en DOEL (groen)
              van een trade. Sleep met je vinger over de grafiek voor de exacte datum en koers op dat punt.
            </Text>
            <PrijsGrafiek
              candles={DEMO_CANDLES}
              niveaus={[
                { waarde: 85, kleur: colors.verlies },
                { waarde: 100, kleur: colors.cta },
                { waarde: 130, kleur: colors.winst },
              ]}
            />
          </Sectie>

          <Sectie id="atr" titel="Stop en doel (ATR)" open={open === 'atr'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              ATR (14) meet de gemiddelde dagbeweging van een coin over de laatste 14 candles. De stop-loss ligt op
              1,5 keer de ATR onder de entry, het doel op 3 keer de ATR erboven. Dat geeft een verhouding
              risico/beloning van minimaal 2: bij minder dan 2 vervalt het signaal helemaal. De entry-zone ligt op
              plus of min 0,2 keer de ATR rond de entryprijs.
            </Text>
            <LevelRow stop={85} entry={100} doel={130} />
          </Sectie>

          <Sectie id="indicatoren" titel="De indicatoren" open={open === 'indicatoren'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              RSI (14) meet of een coin recent overwegend is gestegen of gedaald, op een schaal van 0 tot 100. EMA20
              en EMA50 zijn voortschrijdende gemiddelden over 20 en 50 candles; ligt de korte boven de lange, dan is
              de trend opwaarts. MACD (12/26/9) volgt het verschil tussen twee EMA's om te zien of het momentum
              versnelt of afzwakt. ATR (14) meet de gemiddelde dagbeweging en bepaalt de stop en het doel. Het
              volumecijfer vergelijkt de laatste candle met het gemiddelde volume van de afgelopen 20 candles.
            </Text>
          </Sectie>

          <Sectie id="marktbalk" titel="De marktbalk" open={open === 'marktbalk'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              De marktbalk toont de gemiddelde Kader-score van alle gevolgde coins in één oogopslag. Onder 30 is dat
              HEAVY SELL, onder 45 SELL, onder 55 BALANCED, onder 70 BUY, en vanaf 70 HEAVY BUY.
            </Text>
            <MarktBalk score={62} />
          </Sectie>

          <Sectie id="feargreed" titel="Fear & Greed" open={open === 'feargreed'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              De Fear & Greed-index (0 tot 100) komt van Alternative.me en meet het algemene marktsentiment, los van
              de Kader-score. Een waarde van 45 of lager is angst (rood), 55 of hoger is hebzucht (groen), daartussen
              is neutraal.
            </Text>
            <AngstHebzucht waarde={28} klasse="Fear" />
          </Sectie>

          <Sectie id="kansscore" titel="Kansscore (Grote Kansen)" open={open === 'kansscore'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Grote Kansen scant een breder aanbod aan coins op basis van marktdata van CoinGecko in plaats van
              candle-indicatoren. De kansscore telt op: 7-daagse koersverandering keer 1,2, 30-daagse verandering keer
              0,5, de verhouding volume/marktcap (tot 25 punten), de afstand onder de all-time high, en een
              rank-bonus. Een stijging van meer dan 35% in 24 uur levert juist een straf van 25 punten op
              (oververhitting), tussen 20 en 35% een straf van 10 punten. Alleen coins met marktcap-rang 12 tot 260,
              minstens 15 miljoen dollar 24-uurs volume en geen stablecoins komen mee. Stop en doel komen uit ATR
              als er candle-data beschikbaar is, anders geldt de richtlijn min 12,5% / plus 25%.
            </Text>
          </Sectie>

          <Sectie id="statistieken" titel="Portfolio-statistieken" open={open === 'statistieken'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Het trefferpercentage is het aandeel gesloten trades dat is gewonnen. De gemiddelde behaalde R/R is
              (exitprijs min entry) gedeeld door (entry min stop). Het totaal resultaat telt alle gesloten trades bij
              elkaar op. Zonder handmatig ingevoerde exitprijs telt de take-profit als exit bij een gewonnen trade en
              de stop-loss bij een verloren trade.
            </Text>
          </Sectie>

          <Sectie id="oordeel" titel="Het trader-oordeel" open={open === 'oordeel'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Het totaaloordeel over een trader weegt drie deelscores: 35% consistentie, 40% risicobeheer en 25%
              portfoliospreiding. Vanaf 70 punten is het oordeel GROEN, vanaf 50 GEEL, daaronder ROOD. De aanbevolen
              Copy Stop Loss is afgeleid van de maximale drawdown van de trader en wordt afgerond op een veelvoud van
              5 procent.
            </Text>
          </Sectie>

          <Text style={[Type.caption, styles.slotnoot, { color: colors.tekstGedimd }]}>
            Deze uitleg beschrijft hoe de app rekent. Geen financieel advies.
          </Text>
        </ScrollView>

        <Disclaimer />
      </SafeAreaView>
    </Modal>
  );
}

function Sectie({
  titel, open, onToggle, id, children,
}: {
  id: SectieId;
  titel: string;
  open: boolean;
  onToggle: (id: SectieId) => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectie, { borderColor: colors.rand }]}>
      <Pressable
        onPress={() => onToggle(id)}
        style={styles.sectieKop}
        accessibilityRole="button"
        accessibilityLabel={titel}
        accessibilityState={{ expanded: open }}
      >
        <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{titel}</Text>
        {open
          ? <ChevronUp size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
          : <ChevronDown size={18} color={colors.tekstGedimd} strokeWidth={1.75} />}
      </Pressable>
      {open && <View style={styles.sectieInhoud}>{children}</View>}
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
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', marginTop: -spacing.xs },
  scroll: { paddingBottom: spacing.xl },
  intro: { paddingHorizontal: spacing.base, paddingTop: spacing.base, paddingBottom: spacing.sm, lineHeight: 20 },
  sectie: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.kaart,
    overflow: 'hidden',
  },
  sectieKop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    minHeight: 44,
  },
  sectieInhoud: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    gap: spacing.md,
  },
  tekst: { lineHeight: 21 },
  badgeRij: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  slotnoot: { paddingHorizontal: spacing.base, paddingTop: spacing.md, textAlign: 'center' },
});
