// Profiel van één belegger, full-screen vanuit zijn kaart. Wie hij is, waarom Kader hem dit oordeel
// geeft (met uitleg per deelscore), zijn rendement tegen BTC, waar zijn geld in zit, wat Kader zelf
// van hem zag, wat hij nu open heeft (met de copyknop), en "Kopieer alles via eToro".
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Copy as CopyIcoon, X } from 'lucide-react-native';
import { PodiumScherm } from '../PodiumScherm';
import { Disclaimer } from '../Disclaimer';
import { ScoreRing } from '../ScoreRing';
import { SkeletonKaart } from '../SkeletonKaart';
import { PilKnop } from '../PilKnop';
import { Cijfer, CijferRij } from './Cijfer';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, shadow, spacing } from '../../theme/tokens';
import { useModalKopruimte } from '../../theme/useModalKopruimte';
import { fmtPct } from '../../engine/format';
import { koersFactor } from '../../engine/etoroSymbolen';
import { haalDagHistorie, haalLaatstePrijzen } from '../../engine/marketData';
import type { Candle } from '../../engine/types';
import { btcOp } from '../../state/benchmark';
import {
  allePosities, beoordeelCopyTrade, btcVergelijking, cumulatiefRendement, directePosities, traderVerdeling, TraderPositie,
} from '../../engine/copyTrading';
import { haalLivePortfolio, haalMaandRendementen, MaandRendement, vulSymbolenAan } from '../../engine/etoroTraders';
import { actieveSleutels } from '../../state/etoroSleutels';
import { useCopy, TraderMetScore } from '../../state/CopyProvider';
import { usePortfolio } from '../../state/PortfolioProvider';
import { bewaarSymboolKaart, FeedItem, laadSymboolKaart, zaaiSymboolKaart } from '../../state/copyOpslag';
import { TraderAvatar } from './TraderAvatar';
import { SterKnop } from './SterKnop';
import { BelKnop } from './BelKnop';
import { CopyTradeKaart } from './CopyTradeKaart';
import { AllesKopierenSheet } from './AllesKopierenSheet';
import { useKopieerFlow } from './useKopieerFlow';
import { TraderBedragSheet } from './TraderBedragSheet';
import { BedragKaart, GeslotenTradesKaart, RendementKaart, ScoreKaart, TraderVerdelingKaart } from './ProfielOnderdelen';

// BTC-dagkoersen voor de vergelijking, een uur bewaard: elk profiel dat je opent wil dezelfde reeks.
let btcCache: { tijd: number; candles: Candle[] } | null = null;
async function btcHistorie(): Promise<Candle[] | null> {
  if (btcCache && Date.now() - btcCache.tijd < 60 * 60 * 1000) return btcCache.candles;
  const candles = await haalDagHistorie('BTC', 400).catch(() => null);
  if (candles && candles.length > 0) btcCache = { tijd: Date.now(), candles };
  return candles;
}

const MAX_GESLOTEN = 8;

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// "2025-11-..." wordt "nov '25".
function maandLabel(datum: string): string {
  const [jaar, maand] = datum.split('-');
  const index = Number(maand) - 1;
  return index >= 0 && index < 12 && jaar ? `${MAANDEN[index]} '${jaar.slice(2)}` : datum.slice(0, 7);
}

interface Props {
  trader: TraderMetScore | null;
  onSluiten: () => void;
}

interface Geladen {
  posities: TraderPositie[];
  // Ook de posities uit zijn eigen copies, alleen voor de toets van Kopieer alles.
  allePosities: TraderPositie[];
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
  const {
    isFavoriet, wisselFavoriet, instellingen, favorieten, zetTraderMeldingen, zetTraderBedrag, bedragVoor, trackrecord,
  } = useCopy();
  const { magHandelen } = usePortfolio();
  const { rij, beoordeling } = trader;
  const [data, setData] = useState<Geladen | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [allesOpen, setAllesOpen] = useState(false);
  const [bedragOpen, setBedragOpen] = useState(false);
  const [btc, setBtc] = useState<Candle[] | null>(null);
  const kopieer = useKopieerFlow(sluit);

  useEffect(() => {
    let actief = true;
    btcHistorie().then(c => { if (actief) setBtc(c); }).catch(() => {});
    return () => { actief = false; };
  }, []);

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
        const alle = allePosities(portfolio);
        let symbolen = await zaaiSymboolKaart(await laadSymboolKaart());
        try {
          symbolen = await vulSymbolenAan(alle.map(p => p.instrumentId), symbolen, sleutels);
          bewaarSymboolKaart(symbolen).catch(() => {});
        } catch {
          // Zonder symbolen staan de posities er als "buiten Kader".
        }
        const munten = [...new Set(posities.map(p => symbolen[String(p.instrumentId)]).filter((s): s is string => !!s))];
        const koersen = munten.length > 0 ? await haalLaatstePrijzen(munten).catch(() => ({})) : {};
        if (actief) setData({ posities, allePosities: alle, symbolen, maanden, koersen });
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

  const verdeling = useMemo(() => (data ? traderVerdeling(data.allePosities, data.symbolen) : []), [data]);
  const rendement = useMemo(() => (data ? cumulatiefRendement(data.maanden) : []), [data]);
  const btcLijn = useMemo(
    () => (btc && rendement.length > 1 ? btcVergelijking(rendement, ms => btcOp(btc, ms)) : null),
    [btc, rendement],
  );
  const gesloten = useMemo(
    () => trackrecord
      .filter(t => t.username.toLowerCase() === rij.username.toLowerCase() && t.gesloten !== null)
      .sort((a, b) => (b.gesloten ?? 0) - (a.gesloten ?? 0))
      .slice(0, MAX_GESLOTEN),
    [trackrecord, rij.username],
  );
  const favoriet = favorieten.find(f => f.username.toLowerCase() === rij.username.toLowerCase());
  const eigenBedrag = typeof favoriet?.bedragUsd === 'number' ? favoriet.bedragUsd : null;

  const winratio = typeof rij.winRatio === 'number' ? rij.winRatio : null;
  const cijfers: { label: string; waarde: string; kleur?: string }[] = [
    {
      label: '12 MAANDEN',
      waarde: beoordeling.rendementPct !== null ? fmtPct(beoordeling.rendementPct) : 'onbekend',
      kleur: beoordeling.rendementPct === null ? undefined : beoordeling.rendementPct >= 0 ? colors.winst : colors.verlies,
    },
    { label: 'MAX DALING', waarde: beoordeling.maxDalingPct !== null ? fmtPct(-beoordeling.maxDalingPct) : 'onbekend' },
    { label: 'WINSTKANS', waarde: winratio !== null ? `${Math.round(winratio <= 1 ? winratio * 100 : winratio)}%` : 'onbekend' },
    { label: 'RISICO', waarde: typeof rij.riskScore === 'number' ? `${rij.riskScore}/10` : 'onbekend' },
    { label: 'COPIERS', waarde: typeof rij.copiers === 'number' ? rij.copiers.toLocaleString('nl-NL') : 'onbekend' },
    { label: 'CRYPTO NU', waarde: cryptoAandeel !== null ? `${cryptoAandeel}%` : 'onbekend' },
  ];
  const maxMaand = data ? Math.max(1, ...data.maanden.map(m => Math.abs(m.pct))) : 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.achtergrond }]}>
      <View style={[styles.kop, { borderBottomColor: colors.rand, paddingTop: spacing.base + kopruimte }]}>
        {/* Dezelfde scorering als op de kaart in Ontdek, zodat het scherm leest als de kaart die net
            is opengegroeid. */}
        <ScoreRing
          score={beoordeling.score}
          maat={52}
          accessible={false}
          kind={<TraderAvatar username={rij.username} url={rij.avatarUrl} grootte={40} />}
        />
        <View style={styles.flex}>
          <Text style={[Type.titel, { color: colors.tekstPrimair }]} numberOfLines={1}>{rij.username}</Text>
          {rij.fullName ? <Text style={[Type.caption, { color: colors.tekstGedimd }]} numberOfLines={1}>{rij.fullName}</Text> : null}
        </View>
        {(() => {
          const fav = favorieten.find(f => f.username.toLowerCase() === rij.username.toLowerCase());
          if (!fav) return null;
          const aan = fav.meldingen !== false;
          return <BelKnop username={rij.username} aan={aan} onWissel={() => zetTraderMeldingen(rij.username, !aan)} />;
        })()}
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
        <ScoreKaart beoordeling={beoordeling} />

        <View style={[styles.kaart, shadow.kaart, styles.raster, { backgroundColor: colors.kaart }]}>
          <CijferRij>
            {cijfers.slice(0, 3).map(c => <Cijfer key={c.label} label={c.label} waarde={c.waarde} kleur={c.kleur} />)}
          </CijferRij>
          <CijferRij>
            {cijfers.slice(3).map(c => <Cijfer key={c.label} label={c.label} waarde={c.waarde} kleur={c.kleur} />)}
          </CijferRij>
        </View>

        <RendementKaart punten={rendement} btc={btcLijn} />

        {data && data.maanden.length > 0 && (
          <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
            <Text style={[Type.sectiekop, { color: colors.tekstPrimair, marginBottom: spacing.sm }]}>Per maand</Text>
            {data.maanden.map(m => {
              const winst = m.pct >= 0;
              return (
                <View key={m.datum} style={styles.maandRij}>
                  <Text style={[Type.label, styles.maandLabel, { color: colors.tekstGedimd }]}>{maandLabel(m.datum)}</Text>
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

        <TraderVerdelingKaart segmenten={verdeling} username={rij.username} />

        {(favoriet || gesloten.length > 0) && <GeslotenTradesKaart trades={gesloten} username={rij.username} />}

        <BedragKaart
          bedrag={bedragVoor(rij.username)}
          eigen={eigenBedrag !== null}
          favoriet={!!favoriet}
          onAanpassen={() => setBedragOpen(true)}
        />

        <Text style={[Type.overline, styles.sectie, { color: colors.tekstGedimd }]}>OPEN CRYPTO-POSITIES</Text>
        {!data && !fout && <><SkeletonKaart /><SkeletonKaart /></>}
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
              bedragUsd={bedragVoor(rij.username)}
              magHandelen={magHandelen}
              bezig={kopieer.bezigSleutel === item.sleutel}
              metTrader={false}
              onKopieer={() => kopieer.start(item)}
            />
          );
        })}

        <Text style={[Type.overline, styles.sectie, { color: colors.tekstGedimd }]}>ALLES KOPIËREN</Text>
        {data && (
          <View style={styles.allesKnop}>
            <PilKnop label="Kopieer alles via eToro" icoon={CopyIcoon} variant="tweede" onPress={() => setAllesOpen(true)} />
          </View>
        )}
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
        posities={data?.allePosities ?? []}
      />
      <TraderBedragSheet
        zichtbaar={bedragOpen}
        username={rij.username}
        eigen={eigenBedrag}
        standaard={instellingen.bedragUsd}
        onOpslaan={b => zetTraderBedrag(rij.username, b)}
        onSluiten={() => setBedragOpen(false)}
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
  raster: { gap: spacing.base },
  maandRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 24 },
  maandLabel: { width: 60 },
  balkBaan: { flex: 1, height: 8 },
  balk: { height: 8, borderRadius: radii.pill },
  maandWaarde: { width: 64, textAlign: 'right' },
  sectie: { marginHorizontal: spacing.base, marginTop: spacing.lg, marginBottom: spacing.sm },
  tekst: { marginHorizontal: spacing.base, marginBottom: spacing.md, lineHeight: 20 },
  allesKnop: { marginHorizontal: spacing.base, marginBottom: spacing.sm, alignItems: 'flex-start' },
});
