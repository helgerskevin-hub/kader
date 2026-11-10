// Kaarten in het traderprofiel: de score met uitleg per deelscore, de rendementslijn tegen BTC, de
// verdeling van zijn geld, Kaders eigen trackrecord en het bedrag per kopie.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Pencil } from 'lucide-react-native';
import { PrijsGrafiek } from '../PrijsGrafiek';
import { RING_MAAT, VerdelingRing } from '../VerdelingKaart';
import { UitlegKnop, UitlegTekst, useUitleg } from '../UitlegKnop';
import { PilKnop } from '../PilKnop';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, shadow, spacing } from '../../theme/tokens';
import { fmtPct } from '../../engine/format';
import { aandeelTekst } from '../../engine/verdeling';
import type { Candle } from '../../engine/types';
import {
  BUITEN_KADER, CONSISTENTIE, GRENS_KOPIEER, GRENS_VOLG, ONBEKENDE_DALING_PCT, SPREIDING, WEGING,
  RendementPunt, TraderBeoordeling, TraderSegment, TrackrecordTrade, trackrecordPct,
} from '../../engine/copyTrading';
import { OordeelBadge } from './OordeelBadge';

const pct = (fractie: number) => `${Math.round(fractie * 100)}%`;

// ---------- Score met uitleg ----------

const SCORE_UITLEG =
  `Drie deelscores, gewogen: consistentie ${pct(WEGING.consistentie)}, risico ${pct(WEGING.risico)}, `
  + `spreiding ${pct(WEGING.spreiding)}. Vanaf ${GRENS_KOPIEER} zegt Kader KOPIEER, vanaf ${GRENS_VOLG} VOLG, `
  + 'daaronder VERMIJD. Alle cijfers komen uit eToro\'s ranglijst over de laatste 12 maanden.';

const DEELSCORES: { sleutel: 'consistentie' | 'risico' | 'spreiding'; label: string; kort: string; uitleg: string }[] = [
  {
    sleutel: 'consistentie',
    label: 'Consistentie',
    kort: 'Hoeveel maanden met winst',
    uitleg: `Bron: eToro's deel van de maanden met winst. ${CONSISTENTIE.nul}% of minder geeft 0, `
      + `${CONSISTENTIE.vol}% of meer geeft 100. Stuurt eToro het niet mee, dan rekent Kader met 50.`,
  },
  {
    sleutel: 'risico',
    label: 'Risico',
    kort: 'Rendement tegenover de grootste daling',
    uitleg: 'Bron: eToro\'s rendement over 12 maanden, zijn grootste daling van top tot dal en eToro\'s eigen '
      + 'risicoscore van 1 tot 10. Dezelfde risico-analyse als bij een handmatige beoordeling: veel rendement '
      + `met een kleine daling scoort hoog. Zonder bekende daling rekent Kader met ${ONBEKENDE_DALING_PCT}%.`,
  },
  {
    sleutel: 'spreiding',
    label: 'Spreiding',
    kort: 'Niet alles op één coin, weinig hefboom',
    uitleg: 'Bron: eToro\'s aandeel van zijn meest verhandelde instrument en het deel van zijn trades met hoge '
      + `hefboom. Boven ${SPREIDING.topGrens}% op één instrument kost elk procentpunt `
      + `${String(SPREIDING.perPunt).replace('.', ',')} punt. Doet hij meer dan ${SPREIDING.hefboomGrens}% `
      + `met hoge hefboom, dan gaan er ${SPREIDING.hefboomAftrek} punten af.`,
  },
];

export function ScoreKaart({ beoordeling }: { beoordeling: TraderBeoordeling }) {
  const { colors } = useTheme();
  const uitleg = useUitleg();
  return (
    <Animated.View layout={uitleg.schuif} style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      <View style={styles.titelRij}>
        <OordeelBadge oordeel={beoordeling.oordeel} />
        <Text style={[Type.label, styles.flex, { color: colors.tekstGedimd }]}>Kader-score {Math.round(beoordeling.score)}</Text>
        <UitlegKnop open={uitleg.open} onWissel={uitleg.wissel} onderwerp="de Kader-score" />
      </View>
      <UitlegTekst open={uitleg.open} tekst={SCORE_UITLEG} />
      {DEELSCORES.map(d => <DeelScore key={d.sleutel} label={d.label} kort={d.kort} uitleg={d.uitleg} score={beoordeling[d.sleutel]} />)}
    </Animated.View>
  );
}

function DeelScore({ label, kort, uitleg, score }: { label: string; kort: string; uitleg: string; score: number }) {
  const { colors } = useTheme();
  const u = useUitleg();
  return (
    <View style={styles.deel}>
      <View style={styles.deelRij}>
        <View style={styles.flex}>
          <View style={styles.titelRij}>
            <Text style={[Type.body, { color: colors.tekstPrimair }]}>{label}</Text>
            <UitlegKnop open={u.open} onWissel={u.wissel} onderwerp={`de deelscore ${label.toLowerCase()}`} />
          </View>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{kort}</Text>
        </View>
        <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{score}</Text>
      </View>
      <UitlegTekst open={u.open} tekst={uitleg} />
    </View>
  );
}

// ---------- Rendementslijn ----------

export function RendementKaart({ punten, btc }: { punten: RendementPunt[]; btc: number[] | null }) {
  const { colors } = useTheme();
  const candles = useMemo<Candle[]>(
    () => punten.map(p => ({ open: p.pct, high: p.pct, low: p.pct, close: p.pct, volume: 0, tijd: p.tijd })),
    [punten],
  );
  if (punten.length < 3) return null;
  const laatste = punten[punten.length - 1].pct;
  const kleur = laatste >= 0 ? colors.winst : colors.verlies;
  const btcLaatste = btc ? btc[btc.length - 1] : null;
  const maanden = punten.length - 1;
  return (
    <View style={[styles.kaart, shadow.kaart, styles.gap, { backgroundColor: colors.kaart }]}>
      <View style={{ gap: 2 }}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>RENDEMENT, {maanden} MAANDEN</Text>
        <Text style={[Type.prijs, styles.groot, { color: kleur }]}>{fmtPct(laatste)}</Text>
        {btcLaatste !== null && (
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>BTC in dezelfde tijd: {fmtPct(btcLaatste)}</Text>
        )}
      </View>
      <PrijsGrafiek candles={candles} toonPeriodes={false} heleReeks hoogte={150} formatWaarde={n => fmtPct(n)} vergelijk={btc} />
      {btc && (
        <View style={styles.legenda} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.legendaItem}>
            <View style={[styles.legendaLijn, { backgroundColor: kleur }]} />
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Trader</Text>
          </View>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaStippel, { borderColor: colors.tekstGedimd }]} />
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>BTC vasthouden</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ---------- Verdeling ----------

export function TraderVerdelingKaart({ segmenten, username }: { segmenten: TraderSegment[]; username: string }) {
  const { colors } = useTheme();
  if (segmenten.length === 0) return null;
  const kleurVoor = (s: TraderSegment, i: number) =>
    (s.sleutel === BUITEN_KADER || i >= colors.verdeling.length ? colors.verdelingOverig : colors.verdeling[i]);
  let gelopen = 0;
  const ring = segmenten.map((s, i) => {
    const begin = gelopen;
    gelopen += s.aandeel;
    return { sleutel: s.sleutel, kleur: kleurVoor(s, i), begin, aandeel: s.aandeel };
  });
  const label = `Verdeling van ${username}: ${segmenten.map(s => `${s.label} ${aandeelTekst(s.aandeel)}`).join(', ')}.`;
  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      <Text style={[Type.overline, { color: colors.tekstGedimd, marginBottom: spacing.md }]}>WAAR ZIJN GELD NU IN ZIT</Text>
      <View style={styles.ringHouder} accessible accessibilityLabel={label}>
        <VerdelingRing segmenten={ring} />
      </View>
      <View style={styles.legendaLijst}>
        {segmenten.map((s, i) => (
          <View key={s.sleutel} style={styles.segmentRij} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.vierkantje, { backgroundColor: kleurVoor(s, i) }]} />
            <Text style={[Type.caption, styles.flex, styles.vet, { color: colors.tekstPrimair }]} numberOfLines={1}>{s.label}</Text>
            <Text style={[Type.label, styles.aandeel, { color: colors.tekstPrimair }]}>{aandeelTekst(s.aandeel)}</Text>
          </View>
        ))}
      </View>
      <Text style={[Type.caption, styles.voet, { color: colors.tekstGedimd }]}>
        Naar het deel van zijn portfolio per positie, zoals eToro het opgeeft. Ook wat hij zelf kopieert telt mee.
      </Text>
    </View>
  );
}

// ---------- Kaders trackrecord ----------

const datumKort = (ms: number) => new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

export function GeslotenTradesKaart({ trades, username }: { trades: TrackrecordTrade[]; username: string }) {
  const { colors } = useTheme();
  const uitleg = useUitleg();
  return (
    <Animated.View layout={uitleg.schuif} style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      <View style={styles.titelRij}>
        <Text style={[Type.overline, styles.flex, { color: colors.tekstGedimd }]}>GESLOTEN SINDS JE STER</Text>
        <UitlegKnop open={uitleg.open} onWissel={uitleg.wissel} onderwerp="Kaders eigen trackrecord" />
      </View>
      <UitlegTekst
        open={uitleg.open}
        tekst={`Kader houdt zelf bij wat ${username} opent en sluit zolang hij een ster heeft. De uitstap is de koers op het moment dat Kader de sluiting ziet, dus een benadering. eToro's eigen cijfers hierboven gaan over 12 maanden en tellen alles mee.`}
      />
      {trades.length === 0 ? (
        <Text style={[Type.caption, styles.voet, { color: colors.tekstGedimd }]}>
          Nog geen gesloten trades gezien. Kader begint te tellen vanaf het moment dat je hem een ster geeft.
        </Text>
      ) : trades.map(t => {
        const resultaat = trackrecordPct(t);
        return (
          <View key={t.sleutel} style={styles.tradeRij}>
            <Text style={[Type.body, styles.symbool, { color: colors.tekstPrimair }]}>{t.symbool}</Text>
            <Text style={[Type.caption, styles.flex, { color: colors.tekstGedimd }]}>
              {datumKort(t.geopend)} tot {t.gesloten !== null ? datumKort(t.gesloten) : 'nu'}
            </Text>
            <Text style={[Type.label, { color: resultaat === null ? colors.tekstGedimd : resultaat >= 0 ? colors.winst : colors.verlies }]}>
              {resultaat === null ? 'geen koers' : `ca. ${fmtPct(resultaat)}`}
            </Text>
          </View>
        );
      })}
    </Animated.View>
  );
}

// ---------- Bedrag per kopie ----------

export function BedragKaart({ bedrag, eigen, favoriet, onAanpassen }: {
  bedrag: number;
  eigen: boolean;
  favoriet: boolean;
  onAanpassen: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.kaart, shadow.kaart, styles.bedragRij, { backgroundColor: colors.kaart }]}>
      <View style={styles.flex}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>JOUW BEDRAG PER KOPIE</Text>
        <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>
          ${bedrag}
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{eigen ? '  eigen bedrag' : '  standaard'}</Text>
        </Text>
        {!favoriet && (
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Geef hem een ster om een eigen bedrag te kiezen.</Text>
        )}
      </View>
      {favoriet && <PilKnop label="Aanpassen" icoon={Pencil} variant="tweede" onPress={onAanpassen} />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  vet: { fontWeight: '600' },
  gap: { gap: spacing.md },
  kaart: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    padding: spacing.base,
    borderRadius: radii.kaart,
  },
  titelRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deel: { paddingVertical: spacing.sm },
  deelRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  groot: { fontSize: 22 },
  legenda: { flexDirection: 'row', gap: spacing.base, alignItems: 'center' },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaLijn: { width: 14, height: 2, borderRadius: 1 },
  legendaStippel: { width: 14, borderTopWidth: 1.5, borderStyle: 'dashed' },
  ringHouder: { width: RING_MAAT, height: RING_MAAT, alignSelf: 'center' },
  legendaLijst: { rowGap: 10, marginTop: spacing.base },
  segmentRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vierkantje: { width: 9, height: 9, borderRadius: 2 },
  aandeel: { width: 46, textAlign: 'right' },
  voet: { marginTop: spacing.sm, lineHeight: 18 },
  tradeRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 36 },
  symbool: { width: 56, fontWeight: '600' },
  bedragRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
