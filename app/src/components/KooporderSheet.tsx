// De sheet die een echte kooporder bij eToro plaatst. Een koopknop op een kaart opent alleen deze
// sheet, hij plaatst nooit zelf een order: kopen kost altijd twee bewuste handelingen.
//
// Alles hier is fail-closed. Ontbreekt het instrumentId, keurt bepaalStop de stop af, of past het
// bedrag niet in je saldo, dan is bevestigen simpelweg uitgeschakeld. En na een onbekende uitkomst
// verschijnt er nergens een knop die het verzoek opnieuw verstuurt.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Pause, Wallet } from 'lucide-react-native';
import { fmtBedrag, fmtPrijs } from '../engine/format';
import { deelVanSaldo, inlegVoorRisico, maxBedrag, planInGeld } from '../engine/planInGeld';
import { laadHandelskapitaal } from '../state/useHandelskapitaal';
import { useRisicoPct } from '../state/useRisicoPct';
import { RisicoRegel } from './order/RisicoRegel';
import { OpenRisicoRegel } from './order/OpenRisicoRegel';
import { SpreadRegel } from './order/SpreadRegel';
import { SpreidingRegel } from './order/SpreidingRegel';
import { inOmgeving } from '../state/openRisico';
import { berekenOpenRisico } from '../state/openRisico';
import { useSpread } from '../state/useSpread';
import { nettoRR, spreadInR } from '../engine/spread';
import { useVerliesRem } from '../state/useVerliesRem';
import { REM_REEKS, remTotTekst } from '../state/verliesRem';
import { useReduceMotion } from '../theme/useReduceMotion';
import { uitklapIn, uitklapUit } from '../theme/lijstBeweging';
import { bepaalStop, StopAdvies } from '../engine/etoroLimieten';
import { bouwKooporderBody, guid, haalSaldoStand, KooporderInvoer, plaatsKooporder, SaldoStand } from '../engine/etoro';
import { koersFactor } from '../engine/etoroSymbolen';
import { isAlleenBekijken } from '../engine/platforms';
import { actieveSleutels } from '../state/etoroSleutels';
import { OnbekendeOrder } from '../state/lopendeOrders';
import { usePortfolio } from '../state/PortfolioProvider';
import { GeplaatsteOrder } from '../state/orderUitkomsten';
import { useDialoog } from '../state/DialoogProvider';
import { useInstrumentId } from '../state/useInstrumentId';
import { useNavigatie } from '../state/navigatie';
import { useStopLossLimiet } from '../state/useStopLossLimiet';
import { useValuta } from '../state/useValuta';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { OrderBevestigKnop, useGeluktMoment } from './OrderBevestigKnop';
import { OrderKop } from './order/OrderKop';
import { BedragInvoer } from './order/BedragInvoer';
import { SnelKnoppen, SnelOptie } from './order/SnelKnoppen';
import { PlanInGeldKaart } from './order/PlanInGeld';

// eToro rekent orders in dollars af en het bedrag dat je hier intikt gaat letterlijk zo de order in.
// Daarom blijft dit scherm in dollars, ook als de app op euro's staat: een omgerekend getal naast
// een invoerveld dat dollars verwacht is precies de verwarring die geld kost. Onder het veld staat
// wel de euro-tegenwaarde, zie EuroHint.
const DOLLARS = { valuta: 'USD' } as const;


// Gemeten bij eToro: minPositionAmount en minPositionExposure staan allebei op 10 voor BTC x1.
const MINIMUM_USD = 10;

// eToro rekent kosten bovenop je inleg: een order van $10 haalde $10,08 van het saldo af. Een order
// van precies je vrije saldo wordt daardoor geweigerd, dus we toetsen met wat marge in plaats van
// tegen het kale bedrag.
const KOSTENMARGE = 1.02;

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  symbool: string;
  naam: string;
  entry: number;
  stop: number;
  doel: number;
  // Staat deze sheet boven een full-screen scherm (het coin-detailscherm), dan moet dat scherm
  // eerst dicht voordat "Naar portfolio" ergens naartoe kan: een tabwissel eronder is niet te zien
  // zolang die Modal er nog overheen ligt. Schermen die zelf een tab zijn laten dit weg.
  onVerlaatScherm?: () => void;
}

export function KooporderSheet({
  zichtbaar, onSluiten, symbool, naam, entry, stop, doel, onVerlaatScherm,
}: Props) {
  const { colors } = useTheme();
  const { toonDialoog } = useDialoog();
  const { gaNaar } = useNavigatie();
  const { omgeving, magHandelen, trades, verzoenNaOrder, noteerOnbekendeOrder, noteerGeplaatsteOrder } = usePortfolio();
  const instrumentStand = useInstrumentId(zichtbaar && !isAlleenBekijken(symbool) ? symbool : null);
  const instrumentId = instrumentStand.soort === 'gevonden' ? instrumentStand.id : null;
  // Zolang het zoeken loopt is er nog niets mis: dan hoort er geen rode melding te staan en is
  // bevestigen alleen tijdelijk uit.
  const instrumentBezig = instrumentStand.soort === 'bezig';
  const stopLimiet = useStopLossLimiet(zichtbaar ? symbool : null);
  // Staat de app op euro's, dan blijft dit scherm in dollars maar tonen we wel wat je inleg in
  // euro's is. Anders moet je zelf gaan rekenen om te weten wat je uitgeeft.
  const { valuta, eurPerUsd } = useValuta();
  const reduceMotion = useReduceMotion();
  // Live bied- en laatkoers voor de spread. Null zonder koppeling of bij een fout.
  const koers = useSpread(instrumentId, symbool, zichtbaar);
  // De rem na verliezen: loopt hij, dan eerst een bewuste tik voordat de koopknop verschijnt.
  const { rem } = useVerliesRem();
  const [remDoor, setRemDoor] = useState(false);

  const [bedrag, setBedrag] = useState('');
  // Het handelskapitaal, bij elke opening vers gelezen: het kan op Portfolio net zijn ingevuld.
  const [kapitaal, setKapitaal] = useState<number | null>(null);
  const { pct: risicoPct, pctGetal: risicoGetal } = useRisicoPct();
  // Heeft de gebruiker zelf een bedrag getikt of gekozen? Dan vult Kader niets meer voor.
  const zelfGekozen = useRef(false);
  const [saldo, setSaldo] = useState<SaldoStand | null>(null);
  const [saldoBezig, setSaldoBezig] = useState(true);
  // Wat er werkelijk te besteden is: eToro's `credit` min wat er vastzit in orders die nog niet
  // gevuld zijn. Een wachtende kooporder (een limietorder, of een marktorder op een aandeel terwijl
  // de beurs dicht is) houdt geld vast dat wél in `credit` blijft staan. Zonder die aftrek toonde
  // Kader dat geld als beschikbaar en werd de order die je erop baseerde door eToro geweigerd.
  const vrijSaldo = saldo?.besteedbaarUsd ?? null;
  const [bezig, setBezig] = useState(false);
  // Eén bevestiging tegelijk. Een state-vlag komt pas na de volgende render aan, dus twee tikken
  // binnen één frame zouden er allebei doorheen glippen. Na een geslaagde order blijft dit dicht
  // tot het venster opnieuw opengaat: tijdens het vinkje mag er geen tweede order uit.
  const loopt = useRef(false);
  const { gelukt, vier, sluit, wis } = useGeluktMoment(onSluiten);
  const [fout, setFout] = useState('');

  // Eén verzoekId per keer dat de sheet opengaat, zodat een handmatige herhaling na een afwijzing
  // dezelfde x-request-id draagt. Sluiten en opnieuw openen geeft een nieuwe id: dat is een bewuste
  // tweede order.
  const verzoekId = useRef(guid());

  useEffect(() => {
    if (!zichtbaar) return;
    verzoekId.current = guid();
    setBedrag('');
    setRemDoor(false);
    zelfGekozen.current = false;
    laadHandelskapitaal().then(setKapitaal).catch(() => setKapitaal(null));
    setFout('');
    setBezig(false);
    loopt.current = false;
    wis();
    setSaldo(null);
    setSaldoBezig(true);
  }, [zichtbaar]);

  // Het saldo bewijst meteen dat de sleutels van deze omgeving werken. Lukt het ophalen niet, dan
  // tonen we niets over saldo en blijft bevestigen gewoon mogelijk: een verzonnen bedrag is erger
  // dan geen bedrag, maar het is geen reden om kopen te blokkeren.
  useEffect(() => {
    if (!zichtbaar) return;
    let actief = true;
    (async () => {
      try {
        const sleutels = await actieveSleutels();
        if (!sleutels) return;
        const stand = await haalSaldoStand(sleutels);
        if (actief) setSaldo(stand);
      } catch {
        // Zonder saldo verder, zie hierboven.
      } finally {
        if (actief) setSaldoBezig(false);
      }
    })();
    return () => { actief = false; };
  }, [zichtbaar]);

  const advies: StopAdvies = bepaalStop(entry, stop, stopLimiet);
  const getoondeStop = advies.soort === 'aangepast' ? advies.stop : stop;

  // Wat er werkelijk als stop meegaat. Bij 'vast' laten we het veld weg en zet eToro zijn eigen
  // stop; bij 'waarschuwing' gaat er sowieso niets uit, want bevestigen staat dan uit.
  const stopLossRate = advies.soort === 'ok' ? stop
    : advies.soort === 'aangepast' ? advies.stop
    : undefined;

  // Op centen afgerond: het bedrag staat met twee decimalen in beeld, dus dat is ook wat er naar
  // eToro gaat. Wie 12.345 tikt ziet $12.35 en koopt voor $12.35.
  const bedragGetal = Math.round(parseFloat(bedrag.replace(',', '.')) * 100) / 100;
  const heeftBedrag = !isNaN(bedragGetal) && bedragGetal > 0;

  const invoer: KooporderInvoer = {
    instrumentId: instrumentId ?? 0,
    bedragUsd: heeftBedrag ? bedragGetal : 0,
    stopLossRate,
    takeProfitRate: doel,
    // Sommige coins voert eToro in een andere eenheid (SHIB en PEPE per miljoen munten); de body
    // rekent dat om, maar op dit scherm blijft alles in Kaders eigen koers per coin staan.
    koersFactor: koersFactor(symbool),
  };

  // De samenvatting toont Kaders eigen koersen (per coin), niet de omgerekende body-waarden die
  // naar eToro gaan. Wélk niveau er in de samenvatting verschijnt komt wel uit de body: die bepaalt,
  // via dezelfde validatie als bij het versturen, of een niveau meegaat of wegvalt.
  const body = bouwKooporderBody(invoer);
  const niveaus: string[] = [];
  if (typeof body.stopLossRate === 'number' && typeof stopLossRate === 'number') niveaus.push(`stop-loss ${fmtPrijs(stopLossRate, DOLLARS)}`);
  if (typeof body.takeProfitRate === 'number') niveaus.push(`doel ${fmtPrijs(doel, DOLLARS)}`);
  const niveauZin = niveaus.length > 0
    ? ` ${niveaus.join(', ').replace(/^./, t => t.toUpperCase())}.`
    : '';
  const samenvatting = heeftBedrag
    ? `Je koopt voor ${fmtBedrag(bedragGetal, DOLLARS)} aan ${symbool} tegen de marktprijs.${niveauZin}`
    : '';

  // Wat er van je saldo vastzit in orders die nog wachten. Staat er niets in de wacht, dan komt er
  // ook geen zin bij: een regel over nul gereserveerde dollars is ruis.
  const wachtend = saldo?.wachtendeOrders ?? 0;
  const gereserveerd = saldo?.gereserveerdUsd ?? null;
  const orderWoord = wachtend === 1 ? 'order' : 'orders';
  const gereserveerdZin = wachtend === 0
    ? ''
    : gereserveerd !== null && gereserveerd > 0
      ? ` Er staat ${fmtBedrag(gereserveerd, DOLLARS)} vast in ${wachtend} wachtende ${orderWoord} bij eToro.`
      : ` Er ${wachtend === 1 ? 'wacht' : 'wachten'} ${wachtend} ${orderWoord} bij eToro; Kader weet niet hoeveel daarvan vaststaat.`;

  // Eén rode melding tegelijk, in de volgorde waarin ze zwaarwegend zijn. Tijdens het zoeken staat
  // er niets: "niet te koppelen" over een coin die nog opgezocht wordt is gewoon onwaar.
  const blokkade =
    isAlleenBekijken(symbool)
      ? `eToro laat je ${symbool} niet kopen: de coin staat bij eToro op alleen bekijken, meestal vanwege wettelijke beperkingen. Een order zou door eToro worden geannuleerd, dus kopen is uitgeschakeld.`
    : instrumentBezig ? null
    : instrumentId === null
      ? `Kader kan ${symbool} niet aan een eToro-instrument koppelen. Dat kan aan de koppeling liggen (geen sleutel, of eToro even niet bereikbaar) of eToro voert ${symbool} onder een andere naam. Handelen via de app is daarom uitgeschakeld; bij eToro zelf kun je de coin mogelijk gewoon kopen.`
    : advies.soort === 'waarschuwing' ? advies.uitleg
    : heeftBedrag && bedragGetal < MINIMUM_USD ? `Het minimum bij eToro is ${fmtBedrag(MINIMUM_USD, DOLLARS)}.`
    : heeftBedrag && vrijSaldo !== null && bedragGetal * KOSTENMARGE > vrijSaldo
      ? `Dit past niet in je vrije saldo van ${fmtBedrag(vrijSaldo, DOLLARS)}.${gereserveerdZin} eToro rekent kosten bovenop je inleg, dus houd wat ruimte over.`
    : null;

  const magBevestigen = heeftBedrag && blokkade === null && instrumentId !== null;

  async function bevestig() {
    if (!magBevestigen || instrumentId === null || loopt.current) return;
    loopt.current = true;

    // Vastleggen vóór het versturen: welke posities stonden er al open? Zonder die lijst zou een
    // positie die je al had een onbevestigde order ten onrechte oplossen.
    const bekendePosities = trades
      .filter(t => t.bron === 'etoro' && t.status === 'open' && t.etoroPositionID !== undefined)
      .map(t => t.etoroPositionID as number);

    setFout('');
    setBezig(true);
    try {
      const sleutels = await actieveSleutels();
      if (!sleutels) {
        setFout('Er staat geen eToro-sleutel klaar voor deze omgeving.');
        setBezig(false);
        loopt.current = false;
        return;
      }
      // De knop is getekend voor één omgeving. Is die intussen gewisseld, dan gaat er niets de deur
      // uit: anders zou een order die je als demo bevestigde met echt geld kunnen lopen, of andersom.
      if ((sleutels.omgeving ?? 'real') !== omgeving) {
        setFout('Je omgeving is net gewisseld. Sluit dit venster en open het opnieuw.');
        setBezig(false);
        loopt.current = false;
        return;
      }

      const uitkomst = await plaatsKooporder(invoer, sleutels, verzoekId.current);

      if (uitkomst.soort === 'ok') {
        verzoenNaOrder();
        // Fire-and-forget: het noteren van de uitkomst mag de bevestiging aan de gebruiker niet
        // blokkeren. Mislukt het wegschrijven, dan mist alleen de "geannuleerd/geweigerd"-melding
        // later, de order zelf is al bij eToro binnen.
        const geplaatst: GeplaatsteOrder = {
          verzoekId: verzoekId.current,
          orderId: uitkomst.orderId,
          soort: 'koop',
          symbool,
          // De omgeving van de sleutels waarmee de order echt de deur uitging, niet de context-state:
          // die kan net gewisseld zijn, en dan zou de sync de status bij het verkeerde account opvragen.
          omgeving: sleutels.omgeving ?? 'real',
          bedragUsd: bedragGetal,
          tijd: Date.now(),
        };
        noteerGeplaatsteOrder(geplaatst).catch(() => {});
        // Eerst het vinkje in de knop, dan pas sluiten en bevestigen.
        vier(() => {
          onSluiten();
          toonDialoog({
            variant: 'gelukt',
            rondje: 'gelukt',
            titel: 'Koop staat bij eToro',
            tekst: `Je koop van ${fmtBedrag(bedragGetal, DOLLARS)} in ${symbool} is doorgegeven. Hij verschijnt in je portfolio zodra eToro de order heeft gevuld. Wacht hij nog, dan zie je hem in Portfolio onder Wachtende orders.`,
            // De tekst wijst naar je portfolio, dus daar hoort ook een knop naartoe te gaan. Eerst het
            // scherm eronder sluiten als daarom gevraagd is, anders wisselt de tab onzichtbaar onder
            // een openstaande Modal.
            knoppen: [
              { label: 'Oké' },
              {
                label: 'Naar portfolio',
                soort: 'omlijnd',
                onDruk: () => {
                  onVerlaatScherm?.();
                  gaNaar({ soort: 'portfolio' });
                },
              },
            ],
          });
        });
        return;
      }

      if (uitkomst.soort === 'fout') {
        setFout(uitkomst.bericht);
        setBezig(false);
        loopt.current = false;
        return;
      }

      // Onbekend: eerst naar schijf, dan pas melden. Wordt de app op dit moment weggegooid, dan is
      // het record er nog en pakt de verzoening hem alsnog op.
      const order: OnbekendeOrder = {
        verzoekId: verzoekId.current,
        soort: 'koop',
        symbool,
        omgeving: sleutels.omgeving ?? 'real',
        bedragUsd: bedragGetal,
        bekendePosities,
        tijd: Date.now(),
      };
      try {
        await noteerOnbekendeOrder(order);
      } catch {
        // Wegschrijven mislukte. De melding hieronder klopt hoe dan ook, en opnieuw versturen is
        // ook nu geen optie.
      }
      setBezig(false);
      loopt.current = false;
      onSluiten();
      toonDialoog({
        variant: 'waarschuwing',
        rondje: 'onzeker',
        titel: 'We weten niet of je order is doorgegaan',
        tekst: 'Kader heeft geen antwoord van eToro gekregen. De opdracht staat genoteerd en Kader controleert het zelf bij eToro.',
        resultaat: {
          soort: 'waarschuwing',
          tekst: 'Koop niet opnieuw voordat je bij eToro hebt gekeken. Anders open je mogelijk een tweede positie.',
        },
        knoppen: [{ label: 'Oké' }],
      });
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Er ging iets mis bij het plaatsen van de order.');
      setBezig(false);
      loopt.current = false;
    }
  }

  // Mijn risico: het bedrag waarbij je bij de stop je gekozen percentage van je kapitaal verliest,
  // nooit meer dan Max en nooit onder het eToro-minimum. Zonder kapitaal of zonder eigen stop
  // (eToro kiest hem) valt er niets te rekenen.
  const risicoInleg = kapitaal !== null && advies.soort !== 'vast'
    ? inlegVoorRisico(kapitaal, risicoGetal, entry, getoondeStop)
    : null;
  const risicoBedrag = risicoInleg === null ? null
    : Math.max(MINIMUM_USD, vrijSaldo !== null ? Math.min(risicoInleg, maxBedrag(vrijSaldo, KOSTENMARGE)) : risicoInleg);

  // Vul het bedrag één keer voor zodra het te berekenen is, maar nooit over iets heen dat je zelf
  // koos of tikte.
  useEffect(() => {
    if (!zichtbaar || zelfGekozen.current || risicoBedrag === null) return;
    setBedrag(String(Math.round(risicoBedrag * 100) / 100));
  }, [zichtbaar, risicoBedrag]);

  // Zonder schrijfrecht hoort deze sheet niet open te kunnen. Komt hij er toch, dan gebeurt er
  // niets in plaats van een half formulier.
  if (!magHandelen) return null;

  // Snelknoppen: vaste bedragen altijd, 25% en Max alleen als het saldo bekend is. Een optie onder
  // het eToro-minimum laten we weg, die zou meteen de rode melding opleveren. Mijn risico is de
  // uitzondering: die gaat naar het minimum en de RisicoRegel zegt erbij wat dat betekent.
  const snelOpties: SnelOptie[] = [
    ...(risicoBedrag !== null ? [{ id: 'risico', label: 'Mijn risico', waarde: risicoBedrag }] : []),
    { id: '50', label: '$50', waarde: 50 },
    { id: '100', label: '$100', waarde: 100 },
    { id: '250', label: '$250', waarde: 250 },
    ...(vrijSaldo !== null
      ? [
          { id: 'kwart', label: '25%', waarde: deelVanSaldo(vrijSaldo, 0.25, KOSTENMARGE) },
          { id: 'max', label: 'Max', waarde: maxBedrag(vrijSaldo, KOSTENMARGE) },
        ]
      : []),
  ].filter(o => o.id === 'risico' || o.waarde >= MINIMUM_USD);

  function kiesSnel(waarde: number) {
    if (bezig) return;
    zelfGekozen.current = true;
    setBedrag(String(Math.round(waarde * 100) / 100));
  }

  // Het plan in geld rekent met de stop die echt meegaat. Bij 'vast' zet eToro zelf de stop, dan is
  // er geen bedrag bij de stop te noemen. De R/R hangt niet van het bedrag af, dus zonder geldig
  // bedrag rekenen we met 1 dollar zodat de R/R blijft staan, en blijven de tegels leeg.
  const planStop = advies.soort === 'vast' ? undefined : getoondeStop;
  const plan = planInGeld({ bedrag: heeftBedrag ? bedragGetal : 1, entry, stop: planStop, doel });
  const verliesBijStop = heeftBedrag && plan?.bijStop != null && plan.bijStop < 0 ? -plan.bijStop : null;
  const bestaandRisico = berekenOpenRisico(trades, omgeving).risicoUsd;
  const bezit = [...new Set(trades.filter(t => t.status === 'open' && inOmgeving(t, omgeving)).map(t => t.symbool))];
  const spreadR = koers && planStop !== undefined ? spreadInR(koers, entry, planStop) : null;
  const rrNetto = koers && planStop !== undefined ? nettoRR(koers, entry, planStop, doel) : null;

  // Het bedrag in de samenvatting vet, zonder de zin zelf te veranderen.
  const bedragTekst = heeftBedrag ? fmtBedrag(bedragGetal, DOLLARS) : '';
  const bedragPlek = bedragTekst ? samenvatting.indexOf(bedragTekst) : -1;

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={sluit} velStijl={stijlen.vel}>
      <View style={stijlen.kop}>
        <OrderKop
          symbool={symbool}
          titel={`${symbool} kopen`}
          sub={`${naam} · ${fmtPrijs(entry, DOLLARS)}`}
          omgeving={omgeving}
          onSluiten={sluit}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={stijlen.inhoud}
      >
        {/* Het bedrag is het enige dat de gebruiker zelf invult, dus hoort er te staan hoeveel er
            te besteden is voordat hij begint te tikken en niet als voetnoot eronder. */}
        <BedragInvoer
          waarde={bedrag}
          onWijzig={tekst => { zelfGekozen.current = true; setBedrag(tekst); }}
          accessibilityLabel="Bedrag in dollars"
          bewerkbaar={!bezig}
          onderschrift={
            <View style={stijlen.onderschrift}>
              <View style={stijlen.saldoRij}>
                <Wallet size={13} color={colors.tekstGedimd} strokeWidth={1.75} />
                <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Te besteden</Text>
                <Text style={[Type.prijs, stijlen.saldoBedrag, { color: colors.tekstPrimair }]}>
                  {vrijSaldo !== null ? fmtBedrag(vrijSaldo, DOLLARS) : saldoBezig ? 'ophalen...' : 'onbekend'}
                </Text>
              </View>
              {valuta === 'EUR' && eurPerUsd !== null && heeftBedrag ? (
                <Text style={[Type.caption, stijlen.midden, { color: colors.tekstGedimd }]}>
                  Dat is ongeveer €{(bedragGetal * eurPerUsd).toFixed(2)}. eToro rekent in dollars af.
                </Text>
              ) : null}
              {vrijSaldo === null && !saldoBezig ? (
                <Text style={[Type.caption, stijlen.midden, { color: colors.tekstGedimd }]}>
                  Kader kon je saldo niet bij eToro ophalen. Controleer zelf of dit bedrag past voor je
                  bevestigt.
                </Text>
              ) : null}
              {/* Staat er geld vast in een order die nog niet gevuld is, dan hoort dat hier en niet pas
                  in de rode melding: het verklaart waarom "te besteden" lager is dan het bedrag dat je
                  bij eToro als cash ziet staan. */}
              {gereserveerdZin ? (
                <Text style={[Type.caption, stijlen.midden, { color: colors.letOp }]}>
                  {gereserveerdZin.trim()}
                </Text>
              ) : null}
            </View>
          }
        />

        <SnelKnoppen
          opties={snelOpties}
          actief={heeftBedrag ? bedragGetal : undefined}
          onKies={kiesSnel}
          accessibilityLabel="Snel bedrag"
        />

        <RisicoRegel
          kapitaal={kapitaal}
          risicoPct={risicoPct}
          verliesBijStop={verliesBijStop}
          onderMinimum={risicoInleg !== null && risicoInleg < MINIMUM_USD && heeftBedrag && Math.abs(bedragGetal - MINIMUM_USD) < 0.005 ? risicoInleg : null}
          minimum={MINIMUM_USD}
          eurPerUsd={eurPerUsd}
          heeftStop={planStop !== undefined}
        />

        <OpenRisicoRegel kapitaal={kapitaal} bestaandUsd={bestaandRisico} ditUsd={verliesBijStop} />
        <SpreidingRegel symbool={symbool} bezit={bezit} zichtbaar={zichtbaar} />

        <PlanInGeldKaart
          entry={entry}
          stop={planStop}
          doel={doel}
          bijStop={heeftBedrag ? plan?.bijStop ?? null : null}
          bijDoel={heeftBedrag ? plan?.bijDoel ?? null : null}
          rr={plan?.rr ?? null}
          rrNetto={rrNetto}
          stopTekst={advies.soort === 'vast' ? 'eToro kiest de stop' : undefined}
        />

        <SpreadRegel spreadR={spreadR} />

        {advies.soort === 'vast' ? (
          <View style={[stijlen.waarschuwing, { backgroundColor: colors.verhoogd, borderColor: colors.letOp }]}>
            <Text style={[Type.caption, { color: colors.letOp }]}>{advies.uitleg}</Text>
          </View>
        ) : null}

        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
          {'De entry komt uit de analyse van Kader. De order gaat tegen de marktprijs, dus je koopt tegen de koers van dat moment.'}
        </Text>

        {instrumentBezig ? (
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
            Kader zoekt {symbool} op bij eToro...
          </Text>
        ) : blokkade ? (
          <Text style={[Type.caption, { color: colors.verlies }]}>{blokkade}</Text>
        ) : null}

        {fout ? (
          <Text style={[Type.caption, { color: colors.verlies }]}>{fout}</Text>
        ) : null}

        {samenvatting ? (
          <Text style={[stijlen.samenvatting, { color: colors.tekstGedimd }]}>
            {bedragPlek >= 0 ? (
              <>
                {samenvatting.slice(0, bedragPlek)}
                <Text style={[stijlen.samenvattingBedrag, { color: colors.tekstPrimair }]}>{bedragTekst}</Text>
                {samenvatting.slice(bedragPlek + bedragTekst.length)}
              </>
            ) : samenvatting}
          </Text>
        ) : null}

        {rem && !remDoor ? (
          <Animated.View entering={uitklapIn(reduceMotion)} exiting={uitklapUit()} style={[stijlen.rem, { backgroundColor: colors.kaart, borderColor: colors.rand }]}>
            <View style={stijlen.remKop}>
              <View style={[stijlen.remTegel, { backgroundColor: colors.verhoogd }]}>
                <Pause size={17} color={colors.tekstGedimd} strokeWidth={1.75} />
              </View>
              <Text style={[Type.sectiekop, { color: colors.tekstPrimair, flex: 1 }]}>Je zit in een rem</Text>
            </View>
            <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 19 }]}>
              Je laatste {REM_REEKS} trades sloten met verlies. Na zo'n reeks is de neiging groot om het snel terug te willen halen. De rem loopt tot {remTotTekst(rem.tot, Date.now())}.
            </Text>
            <Pressable
              onPress={() => setRemDoor(true)}
              accessibilityRole="button"
              accessibilityLabel="Ik wil toch kopen"
              style={({ pressed }) => [stijlen.remKnop, { backgroundColor: colors.verhoogd, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <Text style={[Type.body, { color: colors.cta, fontWeight: '600' }]}>Ik wil toch kopen</Text>
            </Pressable>
          </Animated.View>
        ) : (
        <OrderBevestigKnop
          label={omgeving === 'real'
            ? 'Houd vast om te kopen'
            : 'Kopen in demo'}
          echtWaarschuwing="Echt geld. Houd de knop vast om te kopen."
          omgeving={omgeving}
          bezig={bezig}
          uitgeschakeld={!magBevestigen}
          onBevestig={bevestig}
          gelukt={gelukt}
        />
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const stijlen = StyleSheet.create({
  vel: {
    maxHeight: '90%',
  },
  kop: { marginBottom: spacing.base },
  inhoud: { gap: 14 },
  onderschrift: { alignItems: 'center', gap: spacing.xs },
  saldoRij: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saldoBedrag: { fontSize: 14 },
  midden: { textAlign: 'center' },
  waarschuwing: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
  },
  samenvatting: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  samenvattingBedrag: { fontWeight: '600' },
  rem: { borderRadius: radii.kaart, borderWidth: StyleSheet.hairlineWidth, padding: spacing.base, gap: spacing.sm + 2 },
  remKop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  remTegel: { width: 30, height: 30, borderRadius: radii.veld, alignItems: 'center', justifyContent: 'center' },
  remKnop: { minHeight: 52, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});
