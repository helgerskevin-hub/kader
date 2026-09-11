import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { RefreshCw, CloudDownload, History, Info } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { fmtBedrag, fmtPct, fmtResultaatUsd, relatieveTijd } from '../engine/format';
import { aandeelTekst, spreekAandeel } from '../engine/verdeling';
import { PortfolioWaarde } from '../state/statistieken';
import { PortfolioTrade } from '../state/portfolioTypes';
import {
  PERIODES, PeriodeId, STANDAARD_PERIODE, berekenPeriodeResultaat,
} from '../state/periodeResultaat';
import { useResultaatHistorie } from '../state/useResultaatHistorie';
import { bepaalSyncStand } from '../state/syncStatus';
import { AnimatedGetal } from './AnimatedGetal';
import { useValutaStand } from '../state/useValuta';

const fmtResultaatPct = (n: number) => `(${fmtPct(n)})`;

// Percentage van de balkbreedte dat een bestaand maar klein aandeel minimaal krijgt. Gemeten op de
// emulator: bij 3 procent cash is het grijze stukje een paar pixels en moet je ernaar zoeken, bij
// 0,3 procent is de balk een effen blauwe lijn en zie je helemaal geen verdeling meer. Dat is wat
// "de balk doet het niet" in de praktijk betekent: hij tekent wel, hij is alleen niet af te lezen.
// De ondergrens verandert alleen de tekening; het getal in de legenda blijft het echte percentage.
const MIN_BALKSTUK_PCT = 6;

const PERIODE_UITLEG: Record<PeriodeId, string> = {
  dag: 'Toon resultaat van vandaag',
  '1M': 'Toon resultaat over de laatste maand',
  '3M': 'Toon resultaat over de laatste 3 maanden',
  '6M': 'Toon resultaat over de laatste 6 maanden',
  '1J': 'Toon resultaat over het laatste jaar',
  alles: 'Toon resultaat sinds je eerste trade',
};

interface Props {
  waarde: PortfolioWaarde;
  // De hele lijst, niet alleen de afgeleide waarde: het resultaat over een periode rekent over
  // gesloten trades (met hun slottijd) en over open posities (met hun openingstijd), en geen van
  // beide is uit PortfolioWaarde terug te halen.
  trades: PortfolioTrade[];
  // Nodig naast `trades` om de open posities tegen de koers van nu af te zetten. Zelfde bron als
  // waar `waarde` uit gerekend is, dus de twee cijfers op deze kaart lopen niet uiteen.
  livePrijzen: Record<string, number>;
  // Vrij te besteden saldo bij eToro, of null als Kader het niet weet. Zonder saldo is er geen
  // totaal vermogen, en dan toont deze kaart alleen de waarde van je open posities. Niet optellen
  // met een 0: een verzonnen bedrag is erger dan geen bedrag.
  vrijSaldoUsd: number | null;
  // Wat er van je cash vastzit in orders die eToro nog niet gevuld heeft. Zit al niet meer in
  // vrijSaldoUsd; staat hier zodat de kaart kan uitleggen waarom "beschikbaar" lager is dan de cash
  // die je bij eToro zelf ziet staan. 0 = niets in de wacht, null = er wachten orders maar het
  // bedrag is niet te lezen.
  gereserveerdUsd: number | null;
  wachtendeOrders: number;
  // Staat er een eToro-sleutel op dit toestel? Bepaalt alleen welke uitleg er onder een onbekend
  // saldo komt: koppelen, of wachten tot eToro het veld meestuurt.
  etoroGekoppeld: boolean;
  syncing: boolean;
  // Tijdstip van de laatste geslaagde sync (epoch-ms) en of de laatste poging mislukte,
  // samen goed voor de kleurindicatie op het sync-icoon.
  laatsteSync: number | null;
  syncFout: boolean;
  // Foutmelding van de laatste eToro-sync, of null. Los van syncFout, want de koersen kunnen
  // gewoon ververst zijn terwijl juist het ophalen van je posities mislukte.
  etoroFout: string | null;
  etoroBezig: boolean;
  afgesloten: number;
  onVerversen: () => void;
  onImporteren: () => void;
  onOpenHistorie: () => void;
}

export function PortfolioStatusKaart({
  waarde, trades, livePrijzen, vrijSaldoUsd, gereserveerdUsd, wachtendeOrders, etoroGekoppeld,
  syncing, laatsteSync, syncFout, etoroFout, etoroBezig, afgesloten,
  onVerversen, onImporteren, onOpenHistorie,
}: Props) {
  const { colors } = useTheme();
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft deze kaart na het omzetten in de oude valuta staan.
  useValutaStand();

  const [periode, setPeriode] = useState<PeriodeId>(STANDAARD_PERIODE);

  // Alleen de symbolen van posities die de kaart ook echt kan waarderen. Voor de rest is een
  // koersreeks ophalen zinloos: zonder aantal of live koers valt er toch niets mee te rekenen.
  const symbolen = useMemo(
    () => [...new Set(
      trades
        .filter(t => t.status === 'open' && typeof t.aantalCoins === 'number' && t.aantalCoins > 0)
        .map(t => t.symbool),
    )],
    [trades],
  );
  const { punten, status: historieStatus } = useResultaatHistorie(symbolen);
  const resultaat = useMemo(
    () => berekenPeriodeResultaat(trades, livePrijzen, punten, periode),
    [trades, livePrijzen, punten, periode],
  );
  // 'alles' rekent altijd vanaf de entryprijs en heeft dus nooit historie nodig. Daar mag het
  // laadscherm niet overheen komen, ook niet als er voor een andere periode nog gehaald wordt.
  const laadt = historieStatus === 'laden' && periode !== 'alles';

  const heeftWaardering = waarde.gewaardeerd > 0;
  const resultaatKleur = waarde.ongerealiseerdUsd >= 0 ? colors.winst : colors.verlies;

  // Kennen we het vrije saldo, dan is het grote bedrag je totale vermogen: wat er in posities zit
  // plus wat er nog vrij staat. Kennen we het niet, dan staat er alleen de waarde van je posities
  // en heet het ook zo. Er staat dan dus geen totaal, want dat is er niet.
  const heeftSaldo = vrijSaldoUsd !== null;
  // Wachtende orders houden geld vast dat eToro zelf nog gewoon als cash toont. Kader trekt het er
  // af, en zegt er hier bij hoeveel en waarom: zonder die regel lijkt het beschikbare bedrag
  // simpelweg fout.
  const orderWoord = wachtendeOrders === 1 ? 'order' : 'orders';
  const gereserveerdRegel = wachtendeOrders === 0
    ? null
    : gereserveerdUsd !== null && gereserveerdUsd > 0
      ? `${fmtBedrag(gereserveerdUsd)} staat vast in ${wachtendeOrders} wachtende ${orderWoord} bij eToro en telt niet mee als beschikbaar.`
      : `Er ${wachtendeOrders === 1 ? 'wacht' : 'wachten'} ${wachtendeOrders} ${orderWoord} bij eToro. Kader kan niet lezen hoeveel geld daarvan vaststaat, dus dat zit nog in het beschikbare bedrag.`;
  const belegdUsd = waarde.huidigeWaardeUsd;
  const totaalUsd = heeftSaldo ? belegdUsd + vrijSaldoUsd : belegdUsd;
  // Het echte aandeel dat in posities zit. Geclamped, want een negatief of te groot deel zou het
  // andere stuk van de balk duwen; de twee stukken tellen altijd op tot precies 100 procent. Dit
  // getal gaat naar de legenda en is altijd de waarheid.
  const belegdPct = totaalUsd > 0 ? Math.min(100, Math.max(0, (belegdUsd / totaalUsd) * 100)) : 0;
  // En dit is wat de balk tekent. Een kant die echt nul is blijft nul: nul is geen klein aandeel
  // maar een afwezig aandeel, en daar hoort geen stukje bij. Een kant die bestaat maar klein is,
  // krijgt de ondergrens, zodat de verdeling afleesbaar blijft.
  const belegdPctBalk =
    belegdUsd <= 0 ? 0
    : heeftSaldo && vrijSaldoUsd <= 0 ? 100
    : Math.min(100 - MIN_BALKSTUK_PCT, Math.max(MIN_BALKSTUK_PCT, belegdPct));
  // Met een bekend saldo is er ook zonder gewaardeerde posities een bedrag te tonen: je hebt dan
  // gewoon alles in cash staan.
  const toonBedrag = heeftSaldo || heeftWaardering;

  // Kleurindicatie voor het sync-icoon: groen = actueel, oranje = verouderd of eToro mislukt,
  // rood = te oud of de koersen zelf mislukten, blauw = bezig.
  const stand = bepaalSyncStand({ laatsteSync, syncFout, syncing, etoroFout });
  const syncKleur = colors[stand.kleur];
  // Bij een eToro-fout niet "3 min geleden" tonen: de koersen zijn dan wel bij, maar je posities
  // niet, en dat verschil moet uit de regel zelf blijken.
  const syncKort = syncing
    ? 'Bijwerken...'
    : stand.niveau === 'etoro-fout' ? 'eToro mislukt'
    : laatsteSync ? relatieveTijd(laatsteSync) : 'Nog niet';

  return (
    <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      {/* Kop: label + acties */}
      <View style={styles.kop}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
          {heeftSaldo ? 'TOTAAL VERMOGEN' : 'WAARDE OPEN POSITIES'}
        </Text>
        <View style={styles.acties}>
          <Pressable
            onPress={onVerversen}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={`Synchroniseren. ${stand.wanneer}. ${stand.advies}`}
            style={styles.actieKnop}
          >
            {syncing
              ? <ActivityIndicator size="small" color={syncKleur} />
              : <RefreshCw size={18} color={syncKleur} strokeWidth={1.75} />}
          </Pressable>
          <Pressable
            onPress={onImporteren}
            disabled={etoroBezig}
            accessibilityRole="button"
            accessibilityLabel="Importeer uit eToro"
            style={styles.actieKnop}
          >
            {etoroBezig
              ? <ActivityIndicator size="small" color={colors.cta} />
              : <CloudDownload size={18} color={syncKleur} strokeWidth={1.75} />}
          </Pressable>
        </View>
      </View>

      {/* Grote waarde */}
      {toonBedrag ? (
        <AnimatedGetal
          waarde={totaalUsd}
          format={fmtBedrag}
          style={[Type.display, { color: colors.tekstPrimair }]}
        />
      ) : (
        <Text style={[Type.display, { color: colors.tekstPrimair }]}>—</Text>
      )}

      {/* Ongerealiseerd resultaat */}
      {heeftWaardering ? (
        <View style={[styles.resultaat, styles.resultaatRij]}>
          <AnimatedGetal
            waarde={waarde.ongerealiseerdUsd}
            format={fmtResultaatUsd}
            style={[Type.prijs, { color: resultaatKleur }]}
          />
          {waarde.ongerealiseerdPct !== null && (
            <AnimatedGetal
              waarde={waarde.ongerealiseerdPct}
              format={fmtResultaatPct}
              style={[Type.prijs, { color: resultaatKleur, marginLeft: spacing.sm }]}
            />
          )}
        </View>
      ) : (
        <Text style={[Type.caption, styles.resultaat, { color: colors.tekstGedimd }]}>
          {waarde.openPosities === 0
            ? 'Nog geen open posities.'
            : 'Nog geen live koersen om je posities te waarderen.'}
        </Text>
      )}

      {/* Belegd en beschikbaar */}
      {heeftSaldo ? (
        <>
          {totaalUsd > 0 && (
            <View
              style={[styles.balk, { backgroundColor: colors.verhoogd }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {/* Twee stukken met een uitgerekende breedte in procenten, en met opzet geen flex.

                  Er stond hier eerder `flex: belegdUsd` naast `flex: vrijSaldoUsd`, met de gedachte
                  dat de verhouding dan vanzelf klopt. Op Android kregen beide stukken daar geen
                  breedte van en bleef alleen de lege baan over: de balk was leeg, ongeacht de
                  bedragen. Een percentage laat niets te bepalen over.

                  De kleuren waren het tweede probleem: het cash-stuk had colors.verhoogd, exact de
                  kleur van de baan eronder, dus zelfs met breedte was het onzichtbaar geweest. Nu
                  heeft elk stuk een eigen kleur. Grijs en niet groen: cash is geen winst. */}
              <View style={[styles.balkStuk, { width: `${belegdPctBalk}%`, backgroundColor: colors.primair }]} />
              <View style={[styles.balkStuk, { width: `${100 - belegdPctBalk}%`, backgroundColor: colors.verdelingOverig }]} />
            </View>
          )}
          {/* Het percentage staat hier en niet op de balk: een stukje van een paar pixels is geen
              plek voor een getal, en dit is nu juist de regel waar het kleine aandeel afleesbaar
              moet blijven. Altijd belegdPct en nooit belegdPctBalk, anders zou de tekst de
              opgerekte tekening bevestigen in plaats van de waarheid. */}
          <View style={styles.saldoRij}>
            <View
              style={styles.saldoKolom}
              accessible
              accessibilityLabel={`In posities: ${fmtBedrag(belegdUsd)}, ${spreekAandeel(belegdPct / 100)} van je vermogen.`}
            >
              <View style={styles.saldoLabelRij}>
                <View style={[styles.bolletje, { backgroundColor: colors.primair }]} />
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                  IN POSITIES · {aandeelTekst(belegdPct / 100)}
                </Text>
              </View>
              <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtBedrag(belegdUsd)}</Text>
            </View>
            <View
              style={styles.saldoKolom}
              accessible
              accessibilityLabel={`Beschikbaar: ${fmtBedrag(vrijSaldoUsd)}, ${spreekAandeel((100 - belegdPct) / 100)} van je vermogen.`}
            >
              <View style={styles.saldoLabelRij}>
                {/* Vol en in de kleur van de balk: het bolletje is de legenda bij dat stuk, dus een
                    open rondje naast een vol balkstuk zou twee verschillende dingen beweren. */}
                <View style={[styles.bolletje, { backgroundColor: colors.verdelingOverig }]} />
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                  BESCHIKBAAR · {aandeelTekst((100 - belegdPct) / 100)}
                </Text>
              </View>
              <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtBedrag(vrijSaldoUsd)}</Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={[styles.saldoRij, styles.saldoRijGescheiden, { borderTopColor: colors.rand }]}>
            <View style={styles.saldoKolom}>
              <View style={styles.saldoLabelRij}>
                <View style={[styles.bolletje, { backgroundColor: colors.primair }]} />
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>IN POSITIES</Text>
              </View>
              <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtBedrag(belegdUsd)}</Text>
            </View>
            <View style={styles.saldoKolom}>
              <View style={styles.saldoLabelRij}>
                <View style={[styles.bolletje, styles.bolletjeLeeg, styles.bolletjeGestippeld, { borderColor: colors.rand, backgroundColor: colors.verhoogd }]} />
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>BESCHIKBAAR</Text>
              </View>
              <Text style={[Type.prijs, { color: colors.tekstGedimd }]}>Onbekend</Text>
            </View>
          </View>
          <View style={[styles.uitleg, { backgroundColor: colors.verhoogd }]}>
            <Info size={15} color={colors.tekstGedimd} strokeWidth={1.75} />
            <Text style={[Type.caption, styles.uitlegTekst, { color: colors.tekstGedimd }]}>
              {etoroGekoppeld
                ? 'eToro geeft je vrije saldo nu niet door. Kader laat het liever leeg dan dat het een bedrag verzint.'
                : 'Zonder eToro-koppeling kent Kader je vrije saldo niet, dus je totale vermogen ook niet. Koppel je account in Instellingen.'}
            </Text>
          </View>
        </>
      )}

      {/* Detailregels */}
      <View style={[styles.detailRij, { borderTopColor: colors.rand }]}>
        <View style={styles.detail}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>INGELEGD</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>
            {heeftWaardering ? fmtBedrag(waarde.ingelegdUsd) : '—'}
          </Text>
        </View>
        <View style={styles.detail}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>OPEN POSITIES</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>{waarde.openPosities}</Text>
        </View>
        <View style={styles.detail}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>LAATSTE SYNC</Text>
          <Text style={[Type.caption, { color: syncKleur, fontWeight: '600' }]}>{syncKort}</Text>
        </View>
      </View>

      {/* Geld dat vastzit in een order die nog niet gevuld is */}
      {gereserveerdRegel !== null && (
        <Text style={[Type.caption, styles.melding, { color: colors.letOp }]}>
          {gereserveerdRegel}
        </Text>
      )}

      {/* Advies om te synchroniseren zodra de data niet meer vers is */}
      {stand.niveau !== 'vers' && stand.niveau !== 'bezig' && (
        <Text style={[Type.caption, styles.melding, { color: syncKleur }]}>
          {stand.advies}
        </Text>
      )}

      {/* Melding bij posities zonder live prijs */}
      {waarde.zonderLivePrijs > 0 && (
        <Text style={[Type.caption, styles.melding, { color: colors.tekstGedimd }]}>
          {waarde.zonderLivePrijs} {waarde.zonderLivePrijs === 1 ? 'positie telt' : 'posities tellen'} niet mee in de waarde (geen aantal of live koers).
        </Text>
      )}

      {/* Resultaat over een gekozen periode. Bewust onder de meldingen: die gaan over nu en over
          iets dat misschien actie vraagt, dit is een terugblik. En bewust boven de historie-knop,
          want het gerealiseerde deel van dit cijfer komt uit precies die historie. */}
      <View style={[styles.periodeBlok, { borderTopColor: colors.rand }]}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
          {resultaat.status === 'alleen-gerealiseerd' ? 'GEREALISEERD RESULTAAT' : 'RESULTAAT OVER PERIODE'}
        </Text>
        {/* Kort houden. Deze regel hoeft alleen te zeggen wat er in het getal zit; welke periode
            dat is staat al op de actieve chip eronder, en dat het iets anders is dan de regel
            bovenaan blijkt uit de kop. Drie zinnen uitleg boven een cijfer van één regel maakte
            het blok hoger dan de rest van de kaart. */}
        <Text style={[Type.caption, styles.periodeUitleg, { color: colors.tekstGedimd }]}>
          Gesloten trades plus koersbeweging van open posities.
        </Text>

        {/* Vijf even grote rondjes plus een breder, rechthoekiger blokje voor Alles.

            De vijf tijdvakken zijn onderling inwisselbaar en horen er dus identiek uit te zien; dat
            ze eerst meegroeiden met hun label (Dag breder dan 1M) maakte van een rij gelijkwaardige
            keuzes een rommelige reeks. Alles is geen tijdvak maar de uitzondering erop, en krijgt
            daarom bewust een andere vorm in plaats van een uitgerekt rondje.

            Een gewone rij die mag afbreken, zelfde patroon als pillRij in MarktFilters.tsx. Hier
            stond eerst een horizontale ScrollView; die trok de breedte van de kaart scheef, waardoor
            de kolom BESCHIKBAAR ernaast samenkneep tot één letter per regel. */}
        <View style={styles.periodeRij}>
          {PERIODES.map(p => {
            const isActief = p.id === periode;
            const isAlles = p.id === 'alles';
            return (
              <Pressable
                key={p.id}
                onPress={() => setPeriode(p.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActief }}
                accessibilityLabel={PERIODE_UITLEG[p.id]}
                // Het rondje is 40 en niet 44, anders past de rij niet op één regel op een scherm
                // van 360dp. De hitSlop maakt het aanraakvlak alsnog ruim 44 hoog, zodat de kleinere
                // vorm geen kleiner doel wordt.
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                style={[
                  styles.periodeChip,
                  isAlles ? styles.periodeChipAlles : styles.periodeChipRond,
                  { backgroundColor: isActief ? colors.cta : colors.verhoogd },
                ]}
              >
                <Text style={[Type.caption, { color: isActief ? 'white' : colors.tekstGedimd, fontWeight: '600' }]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {laadt ? (
          <>
            <Text style={[Type.prijs, styles.periodeGetal, { color: colors.tekstGedimd }]}>Laden...</Text>
            <Text style={[Type.caption, styles.periodeBijschrift, { color: colors.tekstGedimd }]}>
              Koersen van toen worden opgehaald.
            </Text>
          </>
        ) : resultaat.totaalUsd === null ? (
          <>
            {/* Geen bedrag van 0: dat leest als quitte gespeeld, en er is hier gewoon niets
                gebeurd. Geen AnimatedGetal, er is niets om naartoe te bewegen. */}
            <Text style={[Type.prijs, styles.periodeGetal, { color: colors.tekstGedimd }]}>—</Text>
            <Text style={[Type.caption, styles.periodeBijschrift, { color: colors.tekstGedimd }]}>
              {periode === 'alles' ? 'Nog geen trades.' : 'Niets gesloten of open in deze periode.'}
            </Text>
          </>
        ) : (
          <>
            <View style={styles.periodeRegel}>
              <AnimatedGetal
                waarde={resultaat.totaalUsd}
                format={fmtResultaatUsd}
                style={[Type.prijs, { color: resultaat.totaalUsd >= 0 ? colors.winst : colors.verlies }]}
              />
              {resultaat.pct !== null && (
                <AnimatedGetal
                  waarde={resultaat.pct}
                  format={fmtResultaatPct}
                  style={[Type.prijs, {
                    color: resultaat.totaalUsd >= 0 ? colors.winst : colors.verlies,
                    marginLeft: spacing.sm,
                  }]}
                />
              )}
            </View>
            <Text style={[Type.caption, styles.periodeBijschrift, { color: colors.tekstGedimd }]}>
              {resultaat.gesloten === 0
                ? 'Alleen koersbeweging, niets gesloten.'
                : `${resultaat.gesloten} gesloten ${resultaat.gesloten === 1 ? 'trade' : 'trades'}.`}
            </Text>
            {/* Bij een volledige mislukking staat er al een andere kop boven het getal, dus hier
                alleen nog waarom. Bij een gedeeltelijke mislukking is de kop nog gewoon waar en
                doet deze regel het hele werk. */}
            {resultaat.status === 'alleen-gerealiseerd' && (
              <Text style={[Type.caption, styles.periodeBijschrift, { color: colors.tekstGedimd }]}>
                Koers van toen niet opgehaald, dus alleen het gerealiseerde deel.
              </Text>
            )}
            {resultaat.status === 'deels' && (
              <Text style={[Type.caption, styles.periodeBijschrift, { color: colors.tekstGedimd }]}>
                {resultaat.zonderReferentie} {resultaat.zonderReferentie === 1 ? 'positie telt' : 'posities tellen'} niet
                mee, geen koers van toen.
              </Text>
            )}
          </>
        )}
      </View>

      {/* Historie-knop */}
      <Pressable
        onPress={onOpenHistorie}
        accessibilityRole="button"
        accessibilityLabel="Bekijk historie van afgesloten trades"
        style={[styles.historieKnop, { borderTopColor: colors.rand }]}
      >
        <History size={16} color={colors.cta} strokeWidth={1.75} />
        <Text style={[Type.caption, { color: colors.cta, fontWeight: '600' }]}>
          Historie{afgesloten > 0 ? ` (${afgesloten} afgesloten)` : ''}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  kop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  acties: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actieKnop: {
    minHeight: 36,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultaat: {
    marginTop: 2,
  },
  resultaatRij: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  balk: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: spacing.base,
  },
  // Eigen hoogte in plaats van uitrekken: één ding minder dat de layout kan laten vallen.
  balkStuk: { height: 10 },
  saldoRij: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  // Zonder balk erboven is er niets dat de twee kolommen van het grote bedrag scheidt, dus komt
  // er een lijntje voor in de plaats.
  saldoRijGescheiden: {
    marginTop: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saldoKolom: {
    flex: 1,
    gap: 2,
  },
  saldoLabelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bolletje: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  bolletjeLeeg: {
    borderWidth: 1.5,
  },
  bolletjeGestippeld: {
    borderStyle: 'dashed',
  },
  uitleg: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.veld,
  },
  uitlegTekst: {
    flex: 1,
  },
  detailRij: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detail: { gap: 2 },
  melding: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  periodeBlok: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  periodeUitleg: {
    marginTop: 2,
    lineHeight: 18,
  },
  periodeRij: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  periodeChip: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // De vijf tijdvakken: exact even breed als hoog, dus een echt rondje, ongeacht of het label
  // twee of drie tekens is.
  periodeChipRond: {
    width: 40,
    borderRadius: radii.pill,
  },
  // Alles is de uitzondering op de reeks en ziet er ook zo uit: breder, met de knop-radius in
  // plaats van de pil-radius, zodat het een blokje is en geen uitgerekt rondje.
  periodeChipAlles: {
    paddingHorizontal: spacing.md,
    borderRadius: radii.knop,
  },
  periodeRegel: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.sm,
  },
  periodeGetal: {
    marginTop: spacing.sm,
  },
  periodeBijschrift: {
    marginTop: 2,
    lineHeight: 18,
  },
  historieKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
});
