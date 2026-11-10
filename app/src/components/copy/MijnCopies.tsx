// Mijn copies: wat je via Kader kopieerde (gewone eToro-posities met een herkomst) en wat eToro voor
// je kopieert via "Kopieer alles" (CopyTrader-relaties). Verkopen gaat via Portfolio, waar de
// bestaande verkoopsheet zit; stoppen van een hele copy kan hier.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, ChevronRight, Copy as CopyIcoon, Square } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, shadow, spacing } from '../../theme/tokens';
import { fmtBedrag, fmtPct } from '../../engine/format';
import { haalEtoroPortfolio } from '../../engine/etoro';
import { EigenMirror, leesMirrors } from '../../engine/etoroTraders';
import { actieveSleutels } from '../../state/etoroSleutels';
import { usePortfolio } from '../../state/PortfolioProvider';
import { useCopy } from '../../state/CopyProvider';
import { useNavigatie } from '../../state/navigatie';
import { AllesCopy, laadAllesCopies } from '../../state/copyOpslag';
import { CoinLogo } from '../CoinLogo';
import { Drukbaar } from '../Drukbaar';
import { PilKnop } from '../PilKnop';
import { LegeStaatBeeld, Opkomst } from '../LegeStaatBeeld';
import { StopCopySheet } from './StopCopySheet';
import { Cijfer, CijferRij } from './Cijfer';
import { TraderAvatar } from './TraderAvatar';

const DOLLARS = { valuta: 'USD' } as const;

export function MijnCopies({ inBeeld }: { inBeeld: boolean }) {
  const { colors } = useTheme();
  const { trades, livePrijzen, omgeving, etoroGekoppeld } = usePortfolio();
  const { herkomst } = useCopy();
  const { gaNaar } = useNavigatie();
  const [mirrors, setMirrors] = useState<EigenMirror[] | null>(null);
  const [alles, setAlles] = useState<AllesCopy[]>([]);
  const [stoppen, setStoppen] = useState<{ mirrorId: number; username: string } | null>(null);

  const laad = useCallback(async () => {
    setAlles(await laadAllesCopies());
    const sleutels = await actieveSleutels();
    if (!sleutels) { setMirrors([]); return; }
    try {
      setMirrors(leesMirrors(await haalEtoroPortfolio(sleutels)));
    } catch {
      setMirrors(null);
    }
  }, []);

  useEffect(() => {
    if (inBeeld) laad().catch(() => {});
  }, [inBeeld, omgeving, laad]);

  // Jouw open posities die uit een kopie komen.
  const kopieen = useMemo(() => {
    const perPositie = new Map(herkomst.filter(h => typeof h.etoroPositionID === 'number').map(h => [h.etoroPositionID as number, h]));
    return trades
      .filter(t => t.status === 'open' && typeof t.etoroPositionID === 'number' && perPositie.has(t.etoroPositionID))
      .map(t => {
        const h = perPositie.get(t.etoroPositionID as number)!;
        const koers = livePrijzen[t.symbool];
        const pct = typeof koers === 'number' && t.entryPrijs > 0 ? ((koers - t.entryPrijs) / t.entryPrijs) * 100 : null;
        return { trade: t, herkomst: h, pct };
      });
  }, [trades, herkomst, livePrijzen]);

  const totaal = useMemo(() => {
    const metPct = kopieen.filter(k => k.pct !== null);
    if (metPct.length === 0) return null;
    const gewicht = (k: typeof kopieen[number]) => (k.trade.bedragUsd && k.trade.bedragUsd > 0 ? k.trade.bedragUsd : 1);
    const som = metPct.reduce((s, k) => s + gewicht(k), 0);
    return metPct.reduce((s, k) => s + (k.pct as number) * gewicht(k), 0) / som;
  }, [kopieen]);

  // Per CopyTrader-relatie: wat Kader vroeg, en wat eToro nu als Copy Stop Loss heeft.
  const relaties = useMemo(() => {
    const lijst = mirrors ?? [];
    return lijst.map(m => {
      const gevraagd = [...alles].reverse().find(a => a.username.toLowerCase() === m.parentUsername.toLowerCase() && a.omgeving === omgeving);
      const ruimer = gevraagd && (m.cslPct === null || m.cslPct > gevraagd.cslPct + 0.5);
      return { mirror: m, gevraagd, ruimer: !!ruimer };
    });
  }, [mirrors, alles, omgeving]);

  const onderweg = alles.filter(a => a.omgeving === omgeving && (a.status === 'onderweg' || a.status === 'onbekend')
    && !(mirrors ?? []).some(m => m.parentUsername.toLowerCase() === a.username.toLowerCase())
    && Date.now() - a.tijd < 24 * 60 * 60 * 1000);

  if (!etoroGekoppeld) {
    return <Text style={[Type.body, styles.leeg, { color: colors.tekstGedimd }]}>Koppel eToro om je copies te zien.</Text>;
  }

  const niets = kopieen.length === 0 && relaties.length === 0 && onderweg.length === 0;

  return (
    <View>
      <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>OPEN COPIES</Text>
        <View style={styles.samenvatting}>
          <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>{kopieen.length + relaties.length}</Text>
          {totaal !== null && (
            <Text style={[Type.prijs, { color: totaal >= 0 ? colors.winst : colors.verlies }]}>
              {fmtPct(totaal)} open resultaat
            </Text>
          )}
        </View>
      </View>

      {niets && (
        <View style={styles.leegStaat}>
          <Opkomst volgorde={0}>
            <LegeStaatBeeld>
              <CopyIcoon size={26} color={colors.tekstGedimd} strokeWidth={1.5} />
            </LegeStaatBeeld>
          </Opkomst>
          <Opkomst volgorde={1}>
            <Text style={[Type.titel, styles.midden, { color: colors.tekstPrimair, marginTop: spacing.base }]}>Nog niets gekopieerd</Text>
          </Opkomst>
          <Opkomst volgorde={2}>
            <Text style={[Type.body, styles.midden, { color: colors.tekstGedimd, marginTop: spacing.sm, lineHeight: 24 }]}>
              Kopieer een trade in de Feed, of start in een profiel Kopieer alles via eToro. Je copies verschijnen dan hier.
            </Text>
          </Opkomst>
        </View>
      )}

      {kopieen.length > 0 && <Text style={[Type.overline, styles.sectie, { color: colors.tekstGedimd }]}>PER TRADE</Text>}
      {kopieen.map(({ trade, herkomst: h, pct }) => (
        <Drukbaar
          key={trade.id}
          onPress={() => gaNaar({ soort: 'trade', tradeId: trade.id, symbool: trade.symbool })}
          style={[styles.rij, shadow.kaart, { backgroundColor: colors.kaart }]}
          accessibilityRole="button"
          accessibilityLabel={`${trade.symbool}, gekopieerd van ${h.username}${pct !== null ? `, ${fmtPct(pct)}` : ''}. Open in Portfolio.`}
        >
          <CoinLogo symbool={trade.symbool} grootte={36} />
          <View style={styles.flex}>
            <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{trade.symbool}</Text>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Gekopieerd van {h.username}</Text>
            {h.uitstapGemeld && (
              <View style={styles.letOp}>
                <AlertTriangle size={14} color={colors.letOp} strokeWidth={1.75} />
                <Text style={[Type.caption, { color: colors.letOp }]}>LET OP · {h.username} is uitgestapt</Text>
              </View>
            )}
          </View>
          {pct !== null && (
            <Text style={[Type.prijs, { color: pct >= 0 ? colors.winst : colors.verlies }]}>{fmtPct(pct)}</Text>
          )}
          <ChevronRight size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Drukbaar>
      ))}

      {(relaties.length > 0 || onderweg.length > 0) && (
        <Text style={[Type.overline, styles.sectie, { color: colors.tekstGedimd }]}>VIA ETORO COPYTRADER</Text>
      )}
      {relaties.map(({ mirror, gevraagd, ruimer }) => (
        <View key={mirror.mirrorId} style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
          <View style={styles.rijBinnen}>
            <TraderAvatar username={mirror.parentUsername} grootte={36} />
            <View style={styles.flex}>
              <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{mirror.parentUsername}</Text>
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>eToro kopieert al zijn trades</Text>
            </View>
          </View>
          <CijferRij>
            <Cijfer label="INGELEGD" waarde={fmtBedrag(mirror.inlegUsd, DOLLARS)} />
            <Cijfer label="POSITIES" waarde={String(mirror.aantalPosities)} />
            <Cijfer label="COPY STOP LOSS" waarde={mirror.cslPct !== null ? `${Math.round(mirror.cslPct)}%` : 'niet gezet'} />
          </CijferRij>
          {ruimer && gevraagd && (
            <View style={styles.letOp}>
              <AlertTriangle size={14} color={colors.letOp} strokeWidth={1.75} />
              <Text style={[Type.caption, styles.flex, { color: colors.letOp }]}>
                LET OP · Je Copy Stop Loss staat in eToro {mirror.cslPct === null ? 'niet vast' : `op ${Math.round(mirror.cslPct)}%`}. Je koos {gevraagd.cslPct}%. Zet hem in eToro krapper.
              </Text>
            </View>
          )}
          <View style={styles.knopRij}>
            <PilKnop
              label="Stop copy"
              icoon={Square}
              variant="tweede"
              tekstKleur={colors.verlies}
              onPress={() => setStoppen({ mirrorId: mirror.mirrorId, username: mirror.parentUsername })}
              accessibilityLabel={`Stop de copy van ${mirror.parentUsername}`}
            />
          </View>
        </View>
      ))}
      {onderweg.map(a => (
        <View key={a.referentie} style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{a.username}</Text>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
            {a.status === 'onbekend'
              ? 'Niet zeker of deze copy is gestart. Kijk in eToro onder Portfolio.'
              : 'Aangevraagd. Verschijnt hier zodra eToro de copy heeft gestart.'}
          </Text>
        </View>
      ))}

      <StopCopySheet doel={stoppen} onSluiten={() => setStoppen(null)} onGestopt={() => { laad().catch(() => {}); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  kaart: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    padding: spacing.base,
    borderRadius: radii.kaart,
    gap: spacing.sm,
  },
  samenvatting: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  sectie: { marginHorizontal: spacing.base, marginTop: spacing.sm, marginBottom: spacing.sm },
  leeg: { marginHorizontal: spacing.base, marginVertical: spacing.lg, lineHeight: 22, textAlign: 'center' },
  rij: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    padding: spacing.base,
    borderRadius: radii.kaart,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rijBinnen: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  letOp: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  knopRij: { flexDirection: 'row', justifyContent: 'flex-end' },
  leegStaat: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  midden: { textAlign: 'center' },
});
