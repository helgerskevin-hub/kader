import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { RefreshCw, CloudDownload, History, Info } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { fmtBedrag, fmtPct, fmtResultaatUsd, relatieveTijd } from '../engine/format';
import { PortfolioWaarde } from '../state/statistieken';
import { bepaalSyncStand } from '../state/syncStatus';
import { AnimatedGetal } from './AnimatedGetal';
import { useValutaStand } from '../state/useValuta';

const fmtResultaatPct = (n: number) => `(${fmtPct(n)})`;

interface Props {
  waarde: PortfolioWaarde;
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
  waarde, vrijSaldoUsd, gereserveerdUsd, wachtendeOrders, etoroGekoppeld,
  syncing, laatsteSync, syncFout, etoroFout, etoroBezig, afgesloten,
  onVerversen, onImporteren, onOpenHistorie,
}: Props) {
  const { colors } = useTheme();
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft deze kaart na het omzetten in de oude valuta staan.
  useValutaStand();

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
            <View style={[styles.balk, { backgroundColor: colors.verhoogd }]}>
              {/* De twee flex-waarden zijn de bedragen zelf, dus de balk is de verhouding. */}
              <View style={{ flex: Math.max(0, belegdUsd), backgroundColor: colors.primair }} />
              <View style={{ flex: Math.max(0, vrijSaldoUsd), backgroundColor: colors.verhoogd }} />
            </View>
          )}
          <View style={styles.saldoRij}>
            <View style={styles.saldoKolom}>
              <View style={styles.saldoLabelRij}>
                <View style={[styles.bolletje, { backgroundColor: colors.primair }]} />
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>IN POSITIES</Text>
              </View>
              <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtBedrag(belegdUsd)}</Text>
            </View>
            <View style={styles.saldoKolom}>
              <View style={styles.saldoLabelRij}>
                <View style={[styles.bolletje, styles.bolletjeLeeg, { borderColor: colors.rand, backgroundColor: colors.verhoogd }]} />
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>BESCHIKBAAR</Text>
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
    height: 8,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: spacing.base,
  },
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
