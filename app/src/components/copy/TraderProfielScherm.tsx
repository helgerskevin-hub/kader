// Profiel van één belegger, full-screen vanuit zijn kaart. Wie hij is, waarom Kader hem dit oordeel
// geeft, zijn maandrendementen, wat hij nu open heeft (met de copyknop), en "Kopieer alles via eToro".
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { PodiumScherm } from '../PodiumScherm';
import { ScoreBadge } from '../ScoreBadge';
import { Disclaimer } from '../Disclaimer';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, shadow, spacing } from '../../theme/tokens';
import { useModalKopruimte } from '../../theme/useModalKopruimte';
import { fmtPct } from '../../engine/format';
import { koersFactor } from '../../engine/etoroSymbolen';
import { haalLaatstePrijzen } from '../../engine/marketData';
import { beoordeelCopyTrade, directePosities, TraderPositie } from '../../engine/copyTrading';
import { haalLivePortfolio, haalMaandRendementen, MaandRendement, vulSymbolenAan } from '../../engine/etoroTraders';
import { actieveSleutels } from '../../state/etoroSleutels';
import { useCopy, TraderMetScore } from '../../state/CopyProvider';
import { usePortfolio } from '../../state/PortfolioProvider';
import { bewaarSymboolKaart, FeedItem, laadSymboolKaart, zaaiSymboolKaart } from '../../state/copyOpslag';
import { TraderAvatar } from './TraderAvatar';
import { OordeelBadge } from './OordeelBadge';
import { SterKnop } from './SterKnop';
import { CopyTradeKaart } from './CopyTradeKaart';
import { AllesKopierenSheet } from './AllesKopierenSheet';
import { useKopieerFlow } from './useKopieerFlow';

interface Props {
  trader: TraderMetScore | null;
  onSluiten: () => void;
}

interface Geladen {
  posities: TraderPositie[];
  symbolen: Record<string, string | null>;
  maanden: MaandRendement[];
  koersen: Record<string, number>;
}

export function TraderProfielScherm({ trader, onSluiten }: Props) {
  return (
    <PodiumScherm zichtbaar={trader !== null} onSluiten={onSluiten}>
      {sluit => (trader ? <Inhoud trader={trader} sluit={() => sluit()} /> : null)}
    </PodiumScherm>
  );
}

function Inhoud({ trader, sluit }: { trader: TraderMetScore; sluit: () => void }) {
  const { colors } = useTheme();
  const kopruimte = useModalKopruimte();
  const { isFavoriet, wisselFavoriet, instellingen } = useCopy();
  const { magHandelen } = usePortfolio();
  const { rij, beoordeling } = trader;
  const [data, setData] = useState<Geladen | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [allesOpen, setAllesOpen] = useState(false);
  const kopieer = useKopieerFlow(sluit);

  useEffect(() => {
    let actief = true;
    (async () => {
      const sleutels = await actieveSleutels();
      if (!sleutels) { if (actief) setFout('Koppel eToro om dit profiel te laden.'); return; }
      try {
        const [portfolio, maanden] = await Promise.all([
          haalLivePortfolio(rij.username, sleutels),
          haalMaandRendementen(rij.username, sleutels).catch(() => [] as MaandRendement[]),
        ]);
        const posities = directePosities(portfolio);
        let symbolen = await zaaiSymboolKaart(await laadSymboolKaart());
        try {
          symbolen = await vulSymbolenAan(posities.map(p => p.instrumentId), symbolen, sleutels);
          bewaarSymboolKaart(symbolen).catch(() => {});
        } catch {
          // Zonder symbolen staan de posities er als "buiten Kader".
        }
        const munten = [...new Set(posities.map(p => symbolen[String(p.instrumentId)]).filter((s): s is string => !!s))];
        const koersen = munten.length > 0 ? await haalLaatstePrijzen(munten).catch(() => ({})) : {};
        if (actief) setData({ posities, symbolen, maanden, koersen });
      } catch (e) {
        if (actief) setFout(e instanceof Error ? e.message : 'Kader kan dit profiel nu niet laden.');
      }
    })();
    return () => { actief = false; };
  }, [rij.username]);

  // Alleen crypto-posities die bij Kader horen, als feedregels zodat dezelfde kaart ze toont.
  const regels = useMemo<FeedItem[]>(() => {
    if (!data) return [];
    const nu = Date.now();
    return data.posities
      .map(p => {
        const symbool = data.symbolen[String(p.instrumentId)] ?? null;
        const t = p.openTimestamp ? Date.parse(p.openTimestamp) : NaN;
        return {
          sleutel: `${rij.username}:${p.positionId}`,
          username: rij.username,
          positionId: p.positionId,
          instrumentId: p.instrumentId,
          symbool,
          isBuy: p.isBuy,
          leverage: p.leverage && p.leverage > 0 ? p.leverage : 1,
          openRate: p.openRate,
          stopLossRate: p.stopLossRate && p.stopLossRate > 0 ? p.stopLossRate : null,
          takeProfitRate: p.takeProfitRate && p.takeProfitRate > 0 ? p.takeProfitRate : null,
          openTijd: Number.isNaN(t) ? null : t,
          gezien: nu,
          gesloten: false,
          gekopieerd: false,
        };
      })
      .filter(i => i.symbool !== null)
      .sort((a, b) => (b.openTijd ?? 0) - (a.openTijd ?? 0));
  }, [data, rij.username]);

  const cryptoAandeel = useMemo(() => {
    if (!data || data.posities.length === 0) return null;
    const gewicht = (p: TraderPositie) => (p.investmentPct && p.investmentPct > 0 ? p.investmentPct : 1);
    const totaal = data.posities.reduce((s, p) => s + gewicht(p), 0);
    const crypto = data.posities.filter(p => data.symbolen[String(p.instrumentId)]).reduce((s, p) => s + gewicht(p), 0);
    return Math.round((crypto / totaal) * 100);
  }, [data]);

  const winratio = typeof rij.winRatio === 'number' ? rij.winRatio : null;
  const cijfers: { label: string; waarde: string }[] = [
    { label: 'RENDEMENT 12 MND', waarde: beoordeling.rendementPct !== null ? fmtPct(beoordeling.rendementPct) : 'onbekend' },
    { label: 'GROOTSTE DALING', waarde: beoordeling.maxDalingPct !== null ? fmtPct(-beoordeling.maxDalingPct) : 'onbekend' },
    { label: 'WINSTKANS', waarde: winratio !== null ? `${Math.round(winratio <= 1 ? winratio * 100 : winratio)}%` : 'onbekend' },
    { label: 'RISICO (1-10)', waarde: typeof rij.riskScore === 'number' ? String(rij.riskScore) : 'onbekend' },
    { label: 'COPIERS', waarde: typeof rij.copiers === 'number' ? rij.copiers.toLocaleString('nl-NL') : 'onbekend' },
    { label: 'CRYPTO NU', waarde: cryptoAandeel !== null ? `${cryptoAandeel}%` : 'onbekend' },
  ];
  const deelscores = [
    { label: 'Consistentie', score: beoordeling.consistentie, uitleg: 'Hoeveel maanden met winst' },
    { label: 'Risico', score: beoordeling.risico, uitleg: 'Rendement tegenover de grootste daling' },
    { label: 'Spreiding', score: beoordeling.spreiding, uitleg: 'Niet alles op één coin, weinig hefboom' },
  ];
  const maxMaand = data ? Math.max(1, ...data.maanden.map(m => Math.abs(m.pct))) : 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.achtergrond }]}>
      <View style={[styles.kop, { borderBottomColor: colors.rand, paddingTop: spacing.base + kopruimte }]}>
        <TraderAvatar username={rij.username} url={rij.avatarUrl} grootte={48} />
        <View style={styles.flex}>
          <Text style={[Type.titel, { color: colors.tekstPrimair }]} numberOfLines={1}>{rij.username}</Text>
          {rij.fullName ? <Text style={[Type.caption, { color: colors.tekstGedimd }]} numberOfLines={1}>{rij.fullName}</Text> : null}
        </View>
        <SterKnop
          username={rij.username}
          aan={isFavoriet(rij.username)}
          onWissel={() => wisselFavoriet({ username: rij.username, cid: rij.cid })}
        />
        <Pressable onPress={sluit} style={styles.sluit} accessibilityRole="button" accessibilityLabel="Sluiten" hitSlop={8}>
          <X size={22} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
          <View style={styles.oordeelRij}>
            <ScoreBadge score={beoordeling.score} />
            <OordeelBadge oordeel={beoordeling.oordeel} />
            <Text style={[Type.caption, styles.flex, { color: colors.tekstGedimd }]}>Kader-score</Text>
          </View>
          {deelscores.map(d => (
            <View key={d.label} style={styles.deelRij}>
              <View style={styles.flex}>
                <Text style={[Type.body, { color: colors.tekstPrimair }]}>{d.label}</Text>
                <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{d.uitleg}</Text>
              </View>
              <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{d.score}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.kaart, shadow.kaart, styles.raster, { backgroundColor: colors.kaart }]}>
          {cijfers.map(c => (
            <View key={c.label} style={styles.cel}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{c.label}</Text>
              <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{c.waarde}</Text>
            </View>
          ))}
        </View>

        {data && data.maanden.length > 0 && (
          <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
            <Text style={[Type.sectiekop, { color: colors.tekstPrimair, marginBottom: spacing.sm }]}>Per maand</Text>
            {data.maanden.map(m => {
              const winst = m.pct >= 0;
              return (
                <View key={m.datum} style={styles.maandRij}>
                  <Text style={[Type.label, styles.maandLabel, { color: colors.tekstGedimd }]}>{m.datum.slice(0, 7)}</Text>
                  <View style={styles.balkBaan}>
                    <View style={[styles.balk, {
                      width: `${Math.max(2, (Math.abs(m.pct) / maxMaand) * 100)}%`,
                      backgroundColor: winst ? colors.winst : colors.verlies,
                    }]} />
                  </View>
                  <Text style={[Type.label, styles.maandWaarde, { color: colors.tekstPrimair }]}>{fmtPct(m.pct)}</Text>
                </View>
              );
            })}
          </View>
        )}

        <Text style={[Type.overline, styles.sectie, { color: colors.tekstGedimd }]}>OPEN CRYPTO-POSITIES</Text>
        {!data && !fout && <ActivityIndicator color={colors.tekstGedimd} style={{ marginVertical: spacing.lg }} />}
        {fout && <Text style={[Type.body, styles.tekst, { color: colors.tekstGedimd }]}>{fout}</Text>}
        {data && regels.length === 0 && (
          <Text style={[Type.body, styles.tekst, { color: colors.tekstGedimd }]}>
            {rij.username} heeft nu geen open posities in de coins die Kader volgt.
          </Text>
        )}
        {regels.map(item => {
          const koers = item.symbool && data?.koersen[item.symbool] ? data.koersen[item.symbool] : null;
          const factor = item.symbool ? koersFactor(item.symbool) : 1;
          const stand = beoordeelCopyTrade({
            positie: { positionId: item.positionId, instrumentId: item.instrumentId, openRate: item.openRate / factor, isBuy: item.isBuy },
            symbool: item.symbool,
            koers,
            stop: item.stopLossRate ? item.stopLossRate / factor : null,
            gesloten: false,
          });
          return (
            <CopyTradeKaart
              key={item.sleutel}
              item={item}
              stand={stand}
              koers={koers}
              bedragUsd={instellingen.bedragUsd}
              magHandelen={magHandelen}
              bezig={kopieer.bezigSleutel === item.sleutel}
              onKopieer={() => kopieer.start(item)}
            />
          );
        })}

        <Pressable
          onPress={() => setAllesOpen(true)}
          disabled={!data}
          accessibilityRole="button"
          style={[styles.allesKnop, { borderColor: colors.cta, opacity: data ? 1 : 0.5 }]}
        >
          <Text style={[Type.body, { color: colors.cta, fontWeight: '600' }]}>Kopieer alles via eToro</Text>
        </Pressable>
        <Text style={[Type.caption, styles.tekst, { color: colors.tekstGedimd }]}>
          eToro kopieert dan elke trade van {rij.username} zelf, zonder vertraging. Alleen bij weinig hefboom en shorts.
        </Text>

        <Disclaimer />
      </ScrollView>

      {kopieer.sheet}
      <AllesKopierenSheet
        zichtbaar={allesOpen}
        onSluiten={() => setAllesOpen(false)}
        username={rij.username}
        cid={rij.cid}
        adviesCsl={beoordeling.csl}
        posities={data?.posities ?? []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  kop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sluit: { minHeight: 44, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: spacing.xs, paddingBottom: spacing.xl },
  kaart: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    padding: spacing.base,
    borderRadius: radii.kaart,
  },
  oordeelRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  deelRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  raster: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.base },
  cel: { width: '50%', gap: 2 },
  maandRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 24 },
  maandLabel: { width: 60 },
  balkBaan: { flex: 1, height: 8 },
  balk: { height: 8, borderRadius: radii.pill },
  maandWaarde: { width: 64, textAlign: 'right' },
  sectie: { marginHorizontal: spacing.base, marginTop: spacing.lg, marginBottom: spacing.sm },
  tekst: { marginHorizontal: spacing.base, marginBottom: spacing.md, lineHeight: 20 },
  allesKnop: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 48,
    borderRadius: radii.knop,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
