// Mijn copies: wat je via Kader kopieerde (gewone eToro-posities met een herkomst), per trader
// gegroepeerd met open en gesloten resultaat, en wat eToro voor je kopieert via "Kopieer alles"
// (CopyTrader-relaties). Een open copy is dezelfde kaart als op Portfolio, met Verkopen en SL/TP;
// er gaat pas iets naar eToro na de bevestigknop in die sheets.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Copy as CopyIcoon, LogOut, Square } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, shadow, spacing } from '../../theme/tokens';
import { fmtBedrag, fmtPct, fmtPrijs, fmtResultaatUsd } from '../../engine/format';
import { haalEtoroPortfolio } from '../../engine/etoro';
import { EigenMirror, leesMirrors } from '../../engine/etoroTraders';
import { koersFactor } from '../../engine/etoroSymbolen';
import { vanPortfolioTrade } from '../../engine/coinDetailData';
import { actieveSleutels } from '../../state/etoroSleutels';
import { usePortfolio } from '../../state/PortfolioProvider';
import { useCopy } from '../../state/CopyProvider';
import { useNavigatie } from '../../state/navigatie';
import { isEtoroBestuurbaar } from '../../state/etoroBestuurbaar';
import { AllesCopy, laadAllesCopies } from '../../state/copyOpslag';
import { CopyRegel, groepeerCopies, TraderGroep } from '../../state/mijnCopies';
import { useCopyPlafond } from '../../state/useCopyPlafond';
import type { PortfolioTrade } from '../../state/portfolioTypes';
import { CoinLogo } from '../CoinLogo';
import { useCoinDetail } from '../CoinDetailScherm';
import { PilKnop } from '../PilKnop';
import { PositieKaart } from '../PositieKaart';
import { VerkoopOrderSheet } from '../VerkoopOrderSheet';
import { NiveausSheet } from '../NiveausSheet';
import { LegeStaatBeeld, Opkomst } from '../LegeStaatBeeld';
import { StopCopySheet } from './StopCopySheet';
import { Cijfer, CijferRij } from './Cijfer';
import { TraderAvatar } from './TraderAvatar';
import { useVerkoopOok } from './useVerkoopOok';

const DOLLARS = { valuta: 'USD' } as const;
// Per trader de laatste paar gesloten copies; de rest staat in de historie op Portfolio.
const MAX_GESLOTEN = 5;
const pctKaal = (p: number) => `${Math.abs(p).toFixed(1)}%`;

export function MijnCopies({ inBeeld }: { inBeeld: boolean }) {
  const { colors } = useTheme();
  const { trades, livePrijzen, omgeving, etoroGekoppeld, magHandelen, verwijderTrade } = usePortfolio();
  const { herkomst, feed } = useCopy();
  const { gaNaar } = useNavigatie();
  const verkoopOok = useVerkoopOok();
  const { copiesUsd, plafond, maxPct } = useCopyPlafond();
  const { openDetail, detailScherm } = useCoinDetail();
  const [verkoopTrade, setVerkoopTrade] = useState<PortfolioTrade | null>(null);
  const [niveausTrade, setNiveausTrade] = useState<PortfolioTrade | null>(null);
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

  const groepen = useMemo(
    () => groepeerCopies({ trades, herkomst, livePrijzen, omgeving, feed, factorVan: koersFactor }),
    [trades, herkomst, livePrijzen, omgeving, feed],
  );
  const aantalOpen = groepen.reduce((n, g) => n + g.open.length, 0);

  // Stabiel, zodat de memo op PositieKaart bij elke koers-poll blijft werken.
  const naarPortfolio = useCallback(
    (t: PortfolioTrade) => gaNaar({ soort: 'trade', tradeId: t.id, symbool: t.symbool }),
    [gaNaar],
  );
  const opOpenDetail = useCallback(
    (t: PortfolioTrade) => openDetail(vanPortfolioTrade(t, livePrijzen[t.symbool])),
    [openDetail, livePrijzen],
  );

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

  const niets = groepen.length === 0 && relaties.length === 0 && onderweg.length === 0;

  return (
    <View>
      <PlafondKaart
        copiesUsd={copiesUsd}
        aantal={aantalOpen + relaties.length}
        nuPct={plafond?.nuPct ?? null}
        maxPct={maxPct}
        grensUsd={plafond?.grensUsd ?? null}
      />

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

      {groepen.map(groep => (
        <GroepBlok
          key={groep.username}
          groep={groep}
          livePrijzen={livePrijzen}
          kanVerkopen={t => magHandelen && isEtoroBestuurbaar(t, omgeving)}
          verkoopOok={verkoopOok}
          onVerkoop={setVerkoopTrade}
          onNiveaus={setNiveausTrade}
          onPortfolio={naarPortfolio}
          onVerwijder={verwijderTrade}
          onOpenDetail={opOpenDetail}
        />
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
      {verkoopOok.sheet}
      {verkoopTrade && (
        <VerkoopOrderSheet
          zichtbaar
          trade={trades.find(t => t.id === verkoopTrade.id && t.status === 'open') ?? verkoopTrade}
          huidigePrijs={livePrijzen[verkoopTrade.symbool]}
          onSluiten={() => setVerkoopTrade(null)}
        />
      )}
      {niveausTrade && (
        <NiveausSheet
          zichtbaar
          trade={trades.find(t => t.id === niveausTrade.id) ?? niveausTrade}
          huidigePrijs={livePrijzen[niveausTrade.symbool]}
          onSluiten={() => setNiveausTrade(null)}
        />
      )}
      {detailScherm}
    </View>
  );
}

// Hoeveel er in copies zit en hoe dat zich verhoudt tot je eigen grens. Zonder kapitaal geen
// percentage en geen balk: een verhouding op een verzonnen noemer zegt niets.
function PlafondKaart({ copiesUsd, aantal, nuPct, maxPct, grensUsd }: {
  copiesUsd: number; aantal: number; nuPct: number | null; maxPct: number; grensUsd: number | null;
}) {
  const { colors } = useTheme();
  const boven = nuPct !== null && nuPct > maxPct + 0.05;
  const vulling = nuPct !== null ? Math.min(1, nuPct / maxPct) : 0;
  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>IN COPIES</Text>
      <View style={styles.samenvatting}>
        <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>{fmtBedrag(copiesUsd)}</Text>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{aantal} open</Text>
      </View>
      {nuPct !== null && grensUsd !== null ? (
        <>
          <View
            style={[styles.balk, { backgroundColor: colors.verhoogd }]}
            accessible
            accessibilityLabel={`${pctKaal(nuPct)} van je kapitaal in copies, je grens is ${maxPct} procent`}
          >
            <View style={[styles.balkVulling, { width: `${vulling * 100}%`, backgroundColor: boven ? colors.letOp : colors.cta }]} />
          </View>
          <Text style={[Type.caption, { color: boven ? colors.letOp : colors.tekstGedimd, lineHeight: 18 }]}>
            {boven
              ? `LET OP · ${pctKaal(nuPct)} van je kapitaal, boven je grens van ${maxPct}% (${fmtBedrag(grensUsd)}).`
              : `${pctKaal(nuPct)} van je kapitaal. Je grens is ${maxPct}%, ${fmtBedrag(grensUsd)}.`}
          </Text>
        </>
      ) : (
        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
          Zonder handelskapitaal kan Kader je grens van {maxPct}% niet uitrekenen. Vul het in op Portfolio.
        </Text>
      )}
    </View>
  );
}

function resultaatTekst(usd: number | null, pct: number | null): string | null {
  if (usd === null && pct === null) return null;
  if (usd === null) return fmtPct(pct as number);
  return pct === null ? fmtResultaatUsd(usd) : `${fmtResultaatUsd(usd)} (${fmtPct(pct)})`;
}

interface GroepProps {
  groep: TraderGroep;
  livePrijzen: Record<string, number>;
  kanVerkopen: (t: PortfolioTrade) => boolean;
  verkoopOok: ReturnType<typeof useVerkoopOok>;
  onVerkoop: (t: PortfolioTrade) => void;
  onNiveaus: (t: PortfolioTrade) => void;
  onPortfolio: (t: PortfolioTrade) => void;
  onVerwijder: (id: string) => void;
  onOpenDetail: (t: PortfolioTrade) => void;
}

function GroepBlok({ groep, livePrijzen, kanVerkopen, verkoopOok, onVerkoop, onNiveaus, onPortfolio, onVerwijder, onOpenDetail }: GroepProps) {
  const { colors } = useTheme();
  const open = resultaatTekst(groep.openUsd, groep.openPct);
  const dicht = resultaatTekst(groep.geslotenUsd, groep.geslotenPct);
  const kleur = (x: number | null) => (x === null ? colors.tekstPrimair : x < 0 ? colors.verlies : colors.winst);
  const getoond = groep.gesloten.slice(0, MAX_GESLOTEN);
  return (
    <View style={styles.groep}>
      <View style={styles.groepKop}>
        <TraderAvatar username={groep.username} grootte={36} />
        <View style={styles.flex}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{groep.username}</Text>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
            {groep.open.length} open · {groep.gesloten.length} gesloten
          </Text>
        </View>
      </View>
      <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
        <CijferRij>
          <Cijfer label="OPEN" waarde={open ?? (groep.open.length > 0 ? 'Laden' : 'Geen')} kleur={kleur(groep.openUsd ?? groep.openPct)} />
          <Cijfer label="GESLOTEN" waarde={dicht ?? 'Geen'} kleur={kleur(groep.geslotenUsd ?? groep.geslotenPct)} />
        </CijferRij>
      </View>

      {groep.open.map(r => {
        const mag = kanVerkopen(r.trade);
        return (
          <PositieKaart
            key={r.trade.id}
            trade={r.trade}
            livePrijs={livePrijzen[r.trade.symbool]}
            copyVan={r.herkomst.username}
            extra={<CopyExtra regel={r} verkoopOok={verkoopOok} />}
            onOpenDetail={onOpenDetail}
            // Gewonnen, Verloren en Aanpassen staan er alleen als Kader de positie niet bij eToro kan
            // besturen. Die horen bij de administratie op Portfolio, dus daarheen.
            onVraagSluiten={onPortfolio}
            onBewerk={onPortfolio}
            onVerwijder={onVerwijder}
            onVerkoop={mag ? onVerkoop : undefined}
            onNiveaus={mag ? onNiveaus : undefined}
          />
        );
      })}

      {getoond.length > 0 && (
        <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>GESLOTEN</Text>
          {getoond.map(r => <GeslotenRij key={r.trade.id} regel={r} />)}
          {groep.gesloten.length > getoond.length && (
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
              En {groep.gesloten.length - getoond.length} eerder. Alles staat in de historie op Portfolio.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// Jouw instap tegenover die van de trader, en de LET OP als hij uitstapte.
function CopyExtra({ regel, verkoopOok }: { regel: CopyRegel; verkoopOok: ReturnType<typeof useVerkoopOok> }) {
  const { colors } = useTheme();
  const { trade, herkomst: h, verschilPct, traderEntry } = regel;
  const verkoopbaar = typeof trade.etoroPositionID === 'number' ? verkoopOok.verkoopbaar.get(trade.etoroPositionID) : undefined;
  return (
    <>
      {verschilPct !== null && traderEntry !== null && (
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
          {Math.abs(verschilPct) < 0.05
            ? `Zelfde instap als ${h.username}`
            : `Instap ${pctKaal(Math.abs(verschilPct))} ${verschilPct > 0 ? 'boven' : 'onder'} ${h.username} (${fmtPrijs(traderEntry)})`}
        </Text>
      )}
      {h.uitstapGemeld && (
        <View style={styles.letOp}>
          <AlertTriangle size={14} color={colors.letOp} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.flexTekst, { color: colors.letOp }]}>LET OP · {h.username} is uitgestapt</Text>
        </View>
      )}
      {h.uitstapGemeld && verkoopbaar && (
        <View style={styles.verkoopOok}>
          <PilKnop
            label="Verkoop ook"
            icoon={LogOut}
            variant="tweede"
            onPress={() => verkoopOok.open(verkoopbaar)}
            accessibilityLabel={`Verkoop ook je ${trade.symbool}, ${h.username} stapte uit. Je bevestigt in het volgende scherm.`}
          />
        </View>
      )}
    </>
  );
}

function GeslotenRij({ regel }: { regel: CopyRegel }) {
  const { colors } = useTheme();
  const { trade, usd, pct, verschilPct } = regel;
  const tekst = resultaatTekst(usd, pct);
  const getal = usd ?? pct;
  return (
    <View style={styles.geslotenRij} accessible accessibilityLabel={`${trade.symbool}, gesloten ${trade.slotDatum ?? ''}${tekst ? `, ${tekst}` : ''}`}>
      <CoinLogo symbool={trade.symbool} grootte={28} />
      <View style={styles.flex}>
        <Text style={[Type.body, { color: colors.tekstPrimair }]}>{trade.symbool}</Text>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
          {trade.slotDatum ? `Dicht ${trade.slotDatum}` : 'Gesloten'}
          {verschilPct !== null && Math.abs(verschilPct) >= 0.05
            ? ` · instap ${pctKaal(Math.abs(verschilPct))} ${verschilPct > 0 ? 'boven' : 'onder'} de trader`
            : ''}
        </Text>
      </View>
      <Text style={[Type.prijs, { color: getal === null ? colors.tekstGedimd : getal < 0 ? colors.verlies : colors.winst }]}>
        {tekst ?? 'Onbekend'}
      </Text>
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
  balk: { height: 6, borderRadius: 3, overflow: 'hidden' },
  balkVulling: { height: 6, borderRadius: 3 },
  groep: { marginTop: spacing.sm },
  groepKop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.base, marginBottom: spacing.sm },
  geslotenRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  flexTekst: { flex: 1 },
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
  verkoopOok: { flexDirection: 'row', marginTop: spacing.sm },
  knopRij: { flexDirection: 'row', justifyContent: 'flex-end' },
  leegStaat: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  midden: { textAlign: 'center' },
});
