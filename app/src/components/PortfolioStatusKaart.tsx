import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, type LayoutChangeEvent } from 'react-native';
import { RefreshCw, CloudDownload, Check, History, Info } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts, Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { duur } from '../theme/beweging';
import { useBeweging } from '../theme/useReduceMotion';
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
import { Drukbaar } from './Drukbaar';
import { SegmentKnop, type SegmentOptie } from './SegmentKnop';
import { useValutaStand } from '../state/useValuta';

// Buiten de component, zie AnimatedGetal: anders elke render een nieuwe builder.
const VINK_IN = FadeIn.duration(duur.kort);
const VINK_UIT = FadeOut.duration(duur.kort);

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

// Eén keer gebouwd, buiten de component: de opties veranderen nooit.
const PERIODE_OPTIES: SegmentOptie<PeriodeId>[] = PERIODES.map(p => ({
  id: p.id,
  label: p.label,
  uitleg: PERIODE_UITLEG[p.id],
}));

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
  const { reduceMotion, naar } = useBeweging();

  const [periode, setPeriode] = useState<PeriodeId>(STANDAARD_PERIODE);

  // Rotatie van het sync-icoon: doorlopend en lineair zolang er gesynchroniseerd wordt, en bij het
  // klaarmelden niet abrupt gestopt maar afgemaakt tot de eerstvolgende volle slag met een veer.
  // Onder reduce motion blijft dit uit; de ActivityIndicator van hiervoor doet dan gewoon zijn werk.
  const rotatie = useSharedValue(0);
  const vorigSyncing = useRef(syncing);
  const [toonSyncVink, setToonSyncVink] = useState(false);
  const syncVinkWekker = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (syncVinkWekker.current !== null) clearTimeout(syncVinkWekker.current);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    if (syncing) {
      rotatie.value = withRepeat(
        withTiming(rotatie.value + 360, { duration: 900, easing: Easing.linear }),
        -1,
        false,
      );
    } else if (vorigSyncing.current) {
      // Net klaar: laat 'm afmaken tot de volgende volle slag in plaats van hem stil te zetten
      // waar hij toevallig staat, en toon heel even een vinkje.
      const doel = Math.ceil((rotatie.value + 1) / 360) * 360;
      rotatie.value = naar(doel, 'standaard');
      setToonSyncVink(true);
      if (syncVinkWekker.current !== null) clearTimeout(syncVinkWekker.current);
      syncVinkWekker.current = setTimeout(() => setToonSyncVink(false), duur.lang);
    }
    vorigSyncing.current = syncing;
  }, [syncing, reduceMotion]);

  const rotatieStijl = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotatie.value}deg` }],
  }));

  // Vermogensbalk: de baan heeft de "beschikbaar"-kleur, daarover liggen twee vullingen die vanaf
  // links groeien: "gereserveerd" (tot en met het aandeel van belegd + gereserveerd) en daarbovenop
  // "belegd". Elke vulling krijgt een expliciete breedte in pixels: aandeel (0..1, met een veer
  // animeerbaar) maal de gemeten balkbreedte, uitgerekend in de worklet op de UI-thread. De
  // breedte is een shared value en geen useState: een state in een useAnimatedStyle-closure
  // bleef op Android op zijn oude waarde staan. Eerder stond hier scaleX + translateX op een
  // vulling van width '100%', en dat tekende op Android niets: de balk bleef effen grijs.
  const balkBreedte = useSharedValue(0);
  const belegdAandeel = useSharedValue(0);
  const gereserveerdEind = useSharedValue(0);
  const eersteBalk = useRef(true);

  // Bij elke mount opnieuw: de balk hoort bij het openen zacht uit te groeien en niet te springen.
  useEffect(() => {
    eersteBalk.current = true;
  }, []);

  function opBalkLayout(e: LayoutChangeEvent) {
    balkBreedte.value = e.nativeEvent.layout.width;
  }

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
  const belegdUsd = Math.max(0, waarde.huidigeWaardeUsd);
  // Reserveringen horen bij eToro's equity: dat geld is van jou, het zit alleen vast in een order.
  // Zonder dit stuk lag het totaal lager dan het bedrag dat eToro zelf toont.
  const gereserveerdBedrag = heeftSaldo && gereserveerdUsd !== null ? Math.max(0, gereserveerdUsd) : 0;
  const vrijUsd = heeftSaldo ? Math.max(0, vrijSaldoUsd) : 0;
  const totaalUsd = heeftSaldo ? belegdUsd + gereserveerdBedrag + vrijUsd : belegdUsd;
  // Het echte aandeel van elk stuk. Samen precies 100 procent; vrij is de rest. Deze getallen
  // gaan naar de legenda en zijn altijd de waarheid.
  const belegdPct = totaalUsd > 0 ? (belegdUsd / totaalUsd) * 100 : 0;
  const gereserveerdPct = totaalUsd > 0 ? (gereserveerdBedrag / totaalUsd) * 100 : 0;
  const vrijPct = Math.max(0, 100 - belegdPct - gereserveerdPct);
  // En dit is wat de balk tekent. Een stuk dat echt nul is blijft nul: nul is geen klein aandeel
  // maar een afwezig aandeel, en daar hoort geen stukje bij. Een stuk dat bestaat maar klein is,
  // krijgt de ondergrens, zodat de verdeling afleesbaar blijft. Daarna weer op 100 gebracht.
  const balkDelen = [belegdUsd > 0 ? belegdPct : 0, gereserveerdBedrag > 0 ? gereserveerdPct : 0, vrijUsd > 0 ? vrijPct : 0]
    .map(p => (p > 0 ? Math.max(MIN_BALKSTUK_PCT, p) : 0));
  const balkSom = balkDelen[0] + balkDelen[1] + balkDelen[2];
  const belegdPctBalk = balkSom > 0 ? (balkDelen[0] / balkSom) * 100 : 0;
  const gereserveerdEindBalk = balkSom > 0 ? ((balkDelen[0] + balkDelen[1]) / balkSom) * 100 : 0;
  // Met een bekend saldo is er ook zonder gewaardeerde posities een bedrag te tonen: je hebt dan
  // gewoon alles in cash staan.
  const toonBedrag = heeftSaldo || heeftWaardering;

  useEffect(() => {
    const doel = belegdPctBalk / 100;
    const doelEind = gereserveerdEindBalk / 100;
    if (eersteBalk.current) {
      eersteBalk.current = false;
      belegdAandeel.value = naar(doel, 'zacht');
      gereserveerdEind.value = naar(doelEind, 'zacht');
      return;
    }
    belegdAandeel.value = naar(doel, 'standaard');
    gereserveerdEind.value = naar(doelEind, 'standaard');
    // naar() zelf is geen afhankelijkheid: alleen een echte aandeelwijziging hoort deze animatie
    // te starten, niet het wisselen van reduce motion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [belegdPctBalk, gereserveerdEindBalk]);

  // Breedte in pixels, uitgerekend op de UI-thread. Zolang de balk nog niet gemeten is (0) blijft
  // het stuk 0 breed, en zodra onLayout de breedte meldt springt het niet maar volgt het aandeel.
  // Loopt een vulling tot het eind van de baan, dan rondt hij ook rechts af, anders steekt de
  // rechte kant buiten de ronde baan uit (de baan knipt niet, zie styles.balk).
  const belegdStijl = useAnimatedStyle(() => {
    const rechts = belegdAandeel.value >= 0.999 ? radii.pill : 0;
    return {
      width: Math.max(0, belegdAandeel.value) * balkBreedte.value,
      borderTopRightRadius: rechts,
      borderBottomRightRadius: rechts,
    };
  });
  const gereserveerdStijl = useAnimatedStyle(() => {
    const rechts = gereserveerdEind.value >= 0.999 ? radii.pill : 0;
    return {
      width: Math.max(0, gereserveerdEind.value) * balkBreedte.value,
      borderTopRightRadius: rechts,
      borderBottomRightRadius: rechts,
    };
  });

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
      {/* Kop: label links, rechts de sync-chip en de importknop. Mag afbreken: met "WAARDE OPEN
          POSITIES" en "Bijwerken..." naast elkaar is 360 dp met een grote systeemletter te krap,
          en dan schuiven de knoppen liever naar een eigen regel dan dat het label afkapt. */}
      <View style={styles.kop}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
          {heeftSaldo ? 'TOTAAL VERMOGEN' : 'WAARDE OPEN POSITIES'}
        </Text>
        <View style={styles.acties}>
          {/* De laatste sync staat nu in de chip zelf, met dezelfde kleur als het icoon: groen is
              actueel, oranje verouderd of eToro mislukt, rood te oud. Een losse LAATSTE SYNC-regel
              onderaan de kaart is daarmee overbodig. */}
          <Drukbaar
            onPress={onVerversen}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={`Synchroniseren. ${stand.wanneer}. ${stand.advies}`}
            style={[styles.syncChip, { backgroundColor: colors.verhoogd }]}
            // De chip is 32 hoog; hitSlop maakt er een raakvlak van 44 van zonder de kop hoger te
            // maken.
            hitSlop={{ top: 6, bottom: 6 }}
            schaal={0.94}
          >
            {syncing
              ? (reduceMotion
                  ? <ActivityIndicator size="small" color={syncKleur} />
                  : (
                    <Animated.View style={rotatieStijl}>
                      <RefreshCw size={14} color={syncKleur} strokeWidth={2} />
                    </Animated.View>
                  ))
              : toonSyncVink
                ? (
                  <Animated.View entering={VINK_IN} exiting={VINK_UIT}>
                    <Check size={14} color={syncKleur} strokeWidth={2} />
                  </Animated.View>
                )
                : <RefreshCw size={14} color={syncKleur} strokeWidth={2} />}
            <Text style={[Type.caption, styles.syncTekst, { color: syncKleur }]}>{syncKort}</Text>
          </Drukbaar>
          <Drukbaar
            onPress={onImporteren}
            disabled={etoroBezig}
            accessibilityRole="button"
            accessibilityLabel="Importeer uit eToro"
            style={styles.actieKnop}
            hitSlop={4}
            schaal={0.9}
          >
            {etoroBezig
              ? <ActivityIndicator size="small" color={colors.cta} />
              : <CloudDownload size={18} color={syncKleur} strokeWidth={1.75} />}
          </Drukbaar>
        </View>
      </View>

      {/* Grote waarde. Zonder saldo en zonder gewaardeerde posities is er geen bedrag, en dan staat
          er dat ook: een verzonnen $0,00 leest als een lege rekening. */}
      {toonBedrag ? (
        <AnimatedGetal
          waarde={totaalUsd}
          format={fmtBedrag}
          style={[Type.display, { color: colors.tekstPrimair }]}
        />
      ) : (
        <Text style={[Type.display, { color: colors.tekstGedimd }]}>Onbekend</Text>
      )}

      {/* Ongerealiseerd resultaat van de open posities, als pil. Mag afbreken: bij een groot bedrag
          met een grote systeemletter past "open posities, nu" niet meer naast de pil. Alleen
          posities met een live koers hebben een resultaat; die op kostprijs tellen hier niet mee. */}
      {waarde.gewaardeerd > waarde.opKostprijs ? (
        <View style={styles.resultaatRij}>
          <View style={[styles.resultaatPil, { backgroundColor: resultaatKleur + '1F' }]}>
            <AnimatedGetal
              waarde={waarde.ongerealiseerdUsd}
              format={fmtResultaatUsd}
              style={[Type.prijs, styles.pilTekst, { color: resultaatKleur }]}
              kleurBijTeken={{ positief: colors.winst, negatief: colors.verlies }}
            />
            {waarde.ongerealiseerdPct !== null && (
              <>
                <Text style={[Type.prijs, styles.pilTekst, { color: resultaatKleur }]}> · </Text>
                <AnimatedGetal
                  waarde={waarde.ongerealiseerdPct}
                  format={fmtPct}
                  style={[Type.prijs, styles.pilTekst, { color: resultaatKleur }]}
                  kleurBijTeken={{ positief: colors.winst, negatief: colors.verlies }}
                />
              </>
            )}
          </View>
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>open posities, nu</Text>
        </View>
      ) : (
        <Text style={[Type.caption, styles.resultaatLeeg, { color: colors.tekstGedimd }]}>
          {waarde.openPosities === 0
            ? 'Nog geen open posities.'
            : 'Nog geen live koersen om je posities te waarderen.'}
        </Text>
      )}

      {/* Resultaat over een gekozen periode, direct onder het resultaat van nu: allebei antwoorden
          ze op "hoe doe ik het", het ene over nu en het andere terugkijkend. De meldingen staan
          onder de balk, bij het geld waar ze over gaan. Geen grafiek: Kader bewaart geen dagelijkse
          reeks van je vermogen, en een verzonnen lijn is erger dan geen lijn.

          Eén segmentknop met een pil die meeschuift, zoals de tabbalk. De zes keuzes passen op
          360 dp op één regel (ongeveer 49 punten per segment), en de haptiek bij een wissel zit in
          SegmentKnop zelf. */}
      <View style={styles.segment}>
        <SegmentKnop opties={PERIODE_OPTIES} actief={periode} onKies={setPeriode} />
      </View>

      <View style={styles.periodeBlok}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
          {resultaat.status === 'alleen-gerealiseerd' ? 'GEREALISEERD RESULTAAT' : 'RESULTAAT OVER PERIODE'}
        </Text>
        {/* Kort houden. Deze regel hoeft alleen te zeggen wat er in het getal zit; welke periode
            dat is staat al op het actieve segment erboven, en dat het iets anders is dan de regel
            bovenaan blijkt uit de kop. */}
        <Text style={[Type.caption, styles.periodeBijschrift, { color: colors.tekstGedimd }]}>
          Gesloten trades plus koersbeweging van open posities.
        </Text>

        {laadt ? (
          <>
            <Text style={[Type.prijs, styles.periodeGetal, { color: colors.tekstGedimd }]}>Laden...</Text>
            <Text style={[Type.caption, styles.periodeBijschrift, { color: colors.tekstGedimd }]}>
              Koersen van toen worden opgehaald.
            </Text>
          </>
        ) : resultaat.totaalUsd === null ? (
          // Geen bedrag van 0: dat leest als quitte gespeeld, en er is hier gewoon niets gebeurd.
          // Geen AnimatedGetal en ook geen los streepje, er is niets om te tonen: de zin zegt het.
          <Text style={[Type.caption, styles.periodeGetal, { color: colors.tekstGedimd }]}>
            {periode === 'alles' ? 'Nog geen trades.' : 'Niets gesloten of open in deze periode.'}
          </Text>
        ) : (
          <>
            <View style={styles.periodeRegel}>
              <AnimatedGetal
                waarde={resultaat.totaalUsd}
                format={fmtResultaatUsd}
                style={[Type.prijs, { color: resultaat.totaalUsd >= 0 ? colors.winst : colors.verlies }]}
                kleurBijTeken={{ positief: colors.winst, negatief: colors.verlies }}
              />
              {resultaat.pct !== null && (
                <AnimatedGetal
                  waarde={resultaat.pct}
                  format={fmtResultaatPct}
                  style={[Type.prijs, {
                    color: resultaat.totaalUsd >= 0 ? colors.winst : colors.verlies,
                    marginLeft: spacing.sm,
                  }]}
                  kleurBijTeken={{ positief: colors.winst, negatief: colors.verlies }}
                />
              )}
            </View>
            {/* Zonder deze regel las het percentage als rendement op je hele vermogen, en dat is
                het niet: periodeResultaat.ts deelt door het geld dat in de periode in posities zat.
                Cash telt niet mee, want Kader kent je saldo van toen niet. */}
            {resultaat.pct !== null && (
              <Text style={[Type.caption, styles.periodeBijschrift, { color: colors.tekstGedimd }]}>
                Percentage over je posities, niet je vermogen.
              </Text>
            )}
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

      {/* Belegd en beschikbaar */}
      {heeftSaldo ? (
        <>
          {totaalUsd > 0 && (
            <View
              style={[styles.balk, { backgroundColor: colors.verdelingOverig }]}
              onLayout={opBalkLayout}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {/* De baan is de beschikbaar-kleur; de vullingen liggen er vanaf links overheen, de
                  gereserveerde (tot en met zijn eigen stuk) onder de belegde. Pixelbreedte uit de
                  gemeten balkbreedte, zie hierboven. De echte boosdoener van de lege baan bleek
                  overflow: 'hidden' op de baan, zie styles.balk. */}
              {gereserveerdBedrag > 0 && (
                <Animated.View style={[styles.balkStuk, gereserveerdStijl, { backgroundColor: colors.letOp }]} />
              )}
              <Animated.View style={[styles.balkStuk, belegdStijl, { backgroundColor: colors.primair }]} />
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
              accessibilityLabel={`Beschikbaar: ${fmtBedrag(vrijUsd)}, ${spreekAandeel(vrijPct / 100)} van je vermogen.`}
            >
              <View style={styles.saldoLabelRij}>
                {/* Vol en in de kleur van de balk: het bolletje is de legenda bij dat stuk, dus een
                    open rondje naast een vol balkstuk zou twee verschillende dingen beweren. */}
                <View style={[styles.bolletje, { backgroundColor: colors.verdelingOverig }]} />
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                  BESCHIKBAAR · {aandeelTekst(vrijPct / 100)}
                </Text>
              </View>
              <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtBedrag(vrijUsd)}</Text>
            </View>
            {gereserveerdBedrag > 0 && (
              <View
                style={styles.saldoKolom}
                accessible
                accessibilityLabel={`Gereserveerd: ${fmtBedrag(gereserveerdBedrag)} in wachtende orders, ${spreekAandeel(gereserveerdPct / 100)} van je vermogen.`}
              >
                <View style={styles.saldoLabelRij}>
                  <View style={[styles.bolletje, { backgroundColor: colors.letOp }]} />
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                    GERESERVEERD · {aandeelTekst(gereserveerdPct / 100)}
                  </Text>
                </View>
                <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtBedrag(gereserveerdBedrag)}</Text>
              </View>
            )}
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

      {/* Posities die alleen op kostprijs in de waarde staan: geen resultaat bekend */}
      {waarde.opKostprijs > 0 && (
        <Text style={[Type.caption, styles.melding, { color: colors.tekstGedimd }]}>
          {waarde.opKostprijs} {waarde.opKostprijs === 1 ? 'positie staat' : 'posities staan'} op kostprijs in de waarde, want er is geen live koers. Het resultaat telt die niet mee.
        </Text>
      )}

      {/* Onderrij: ingelegd en aantal posities links, de historie rechts. Mag afbreken: met een
          groot ingelegd bedrag en een lange historie-tekst past het op 360 dp niet naast elkaar. */}
      <View style={[styles.onder, { borderTopColor: colors.rand }]}>
        <View style={styles.onderDetails}>
          <View style={styles.detail}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>INGELEGD</Text>
            {/* Zonder gewaardeerde posities kent Kader het ingelegde bedrag niet (het telt alleen
                posities met een aantal en een live koers). Zonder open posities is het gewoon 0. */}
            {heeftWaardering || waarde.openPosities === 0 ? (
              <Text style={[Type.prijs, styles.detailWaarde, { color: colors.tekstPrimair }]}>
                {fmtBedrag(waarde.ingelegdUsd)}
              </Text>
            ) : (
              <Text style={[Type.prijs, styles.detailWaarde, { color: colors.tekstGedimd }]}>Onbekend</Text>
            )}
          </View>
          <View style={styles.detail}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>POSITIES</Text>
            <Text style={[Type.prijs, styles.detailWaarde, { color: colors.tekstPrimair }]}>
              {waarde.openPosities}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onOpenHistorie}
          accessibilityRole="button"
          accessibilityLabel="Bekijk historie van afgesloten trades"
          style={styles.historieKnop}
        >
          <History size={16} color={colors.cta} strokeWidth={1.75} />
          <Text style={[Type.caption, styles.historieTekst, { color: colors.cta }]}>
            Historie{afgesloten > 0 ? ` (${afgesloten} afgesloten)` : ''}
          </Text>
        </Pressable>
      </View>
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  // marginLeft auto: breekt de kop af, dan blijven de knoppen rechts op hun eigen regel.
  acties: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
  syncChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
  },
  syncTekst: { fontFamily: Fonts.sansSemiBold, fontWeight: '600' },
  actieKnop: {
    minHeight: 36,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultaatRij: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 6,
  },
  resultaatPil: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  pilTekst: { fontSize: 13, lineHeight: 18 },
  resultaatLeeg: { marginTop: 2 },
  segment: { marginTop: spacing.base },
  periodeBlok: { marginTop: spacing.md },
  periodeRegel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  // Bewust geen overflow: 'hidden'. Op Android (Fabric) knipte die de vullingen volledig weg
  // zodra de balk pas na de eerste render verscheen, zoals wanneer het eToro-saldo binnenkomt na
  // een sync: dan bleef alleen de grijze baan over. De vullingen ronden hun linkerkant daarom zelf
  // af; rechts eindigen ze recht, net als een gevulde balk hoort.
  balk: {
    height: 8,
    borderRadius: radii.pill,
    marginTop: 14,
  },
  // Eigen hoogte in plaats van uitrekken: één ding minder dat de layout kan laten vallen.
  balkStuk: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 8,
    borderTopLeftRadius: radii.pill,
    borderBottomLeftRadius: radii.pill,
  },
  saldoRij: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  // Zonder balk erboven is er niets dat de twee kolommen van het periodeblok scheidt, dus komt
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
  melding: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  onder: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 14,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  onderDetails: { flexDirection: 'row', gap: 20 },
  detail: { gap: 2 },
  detailWaarde: { fontSize: 13 },
  // marginLeft auto: breekt de rij af, dan blijft de link rechts op zijn eigen regel.
  historieKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    marginLeft: 'auto',
  },
  historieTekst: { fontFamily: Fonts.sansSemiBold, fontWeight: '600' },
});
