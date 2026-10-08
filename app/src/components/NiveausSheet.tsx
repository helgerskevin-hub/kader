// Verzet de stop-loss en de take-profit van een lopende eToro-positie, of haalt ze weg.
//
// Het belangrijkste hier is dat bepaalStop vóór er een verzoek uitgaat zegt welke stop eToro echt
// zet. Gemeten (1 okt 2026, plan §12): een stop buiten de grens weigert eToro niet maar schuift hij
// stil op, dus zonder deze toets stond er bij eToro een andere stop dan de gebruiker dacht.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type TextStyle } from 'react-native';
import { Minus, Plus, Shield } from 'lucide-react-native';
import { fmtPrijs } from '../engine/format';
import { bepaalStop, StopAdvies } from '../engine/etoroLimieten';
import { guid, wijzigNiveaus, NiveauWijziging } from '../engine/etoro';
import { koersFactor } from '../engine/etoroSymbolen';
import { alsVeldTekst, zonderExponent, greepBereik, klem, opStap, planInGeld, stapGrootte, type Bereik } from '../engine/planInGeld';
import { usePortfolio } from '../state/PortfolioProvider';
import { useDialoog } from '../state/DialoogProvider';
import { useStopLossLimiet } from '../state/useStopLossLimiet';
import { actieveSleutels } from '../state/etoroSleutels';
import { PortfolioTrade, richtingVan } from '../state/portfolioTypes';
import { OnbekendeOrder } from '../state/lopendeOrders';
import type { AfbouwAdvies } from '../state/afbouw';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts, Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { haptiek } from '../theme/haptiek';
import { GeldGetal } from './order/PlanInGeld';
import { BottomSheet } from './BottomSheet';
import { Drukbaar } from './Drukbaar';
import { OrderBevestigKnop, useGeluktMoment } from './OrderBevestigKnop';
import { OrderKop } from './order/OrderKop';
import { NiveauBaan } from './order/NiveauBaan';

// De niveaus die je hier intikt gaan als dollarprijzen naar eToro, dus dit scherm blijft in dollars,
// ook als de app op euro's staat.
const DOLLARS = { valuta: 'USD' } as const;
const fmtDollar = (n: number) => fmtPrijs(n, DOLLARS);

// Grenzen van het greepbereik die verder dan dit van de entry liggen tellen niet mee voor de schaal
// van de baan. eToro's maximale long-afstand is vaak 100%, en een baan die tot nul loopt maakt alle
// grepen onbruikbaar klein. Slepen blijft gewoon tot de rand van de baan mogelijk.
const BAAN_MAX_AFSTAND = 0.35;
// Minimale breedte van de baan, als fractie van de entry: zonder stop en doel liggen entry en koers
// soms zo dicht bij elkaar dat er niets meer te slepen valt.
const BAAN_MIN_SPAN = 0.1;
const BAAN_MARGE = 0.15;
// Ouder dan dit telt de koers niet meer als referentie voor eToro's minimum. Een mislukte poll laat
// de vorige koers staan, en een verouderde hoge koers zou een stop toestaan die te dicht bij de
// werkelijke koers ligt. Dan rekent Kader weer vanaf de aankoopprijs, het oude, behoudende gedrag.
const KOERS_MAX_LEEFTIJD_MS = 2 * 60 * 1000;
// Hoe vaak het venster opnieuw kijkt of de koers nog vers genoeg is, ook als er niets verandert.
const KOERS_CONTROLE_MS = 15 * 1000;

// Op honderdsten afronden voor teken en kleur: -0,004 toont "$0.00" en hoort dan niet rood te zijn.
const rond = (n: number) => Math.round(n * 100) / 100;

function fmtMetTeken(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n === 0) return `$${abs}`;
  return `${n < 0 ? '-' : '+'}$${abs}`;
}

const fmtRR = (rr: number) => `R/R 1 : ${rr.toFixed(1).replace('.', ',')}`;

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  trade: PortfolioTrade;
  huidigePrijs?: number;
  // Het afbouwadvies dat het portfolio al voor deze trade uitrekent; alleen de trailing stop telt hier.
  afbouwAdvies?: AfbouwAdvies | null;
  // Het stopvoorstel uit een melding ("zet je winst vast"). Vult het stopveld bij openen al in; er
  // gaat pas iets naar eToro na de bevestigknop, net als bij een zelf ingetikt niveau.
  voorstelStop?: number;
}

const getal = (tekst: string): number => parseFloat(tekst.replace(',', '.'));

// Prijzen komen als float uit eToro terug; een directe ongelijkheid zou een wijziging melden die er
// niet is. Een cent verschil op de goedkoopste coin is nog altijd meer dan dit.
const anders = (a: number, b: number) => Math.abs(a - b) > 1e-9;

export function NiveausSheet({ zichtbaar, onSluiten, trade, huidigePrijs, afbouwAdvies, voorstelStop }: Props) {
  const { colors } = useTheme();
  const { toonDialoog } = useDialoog();
  const { omgeving, trades, livePrijsTijd, verzoenNaOrder, noteerOnbekendeOrder } = usePortfolio();
  const limiet = useStopLossLimiet(trade.symbool, richtingVan(trade));

  const meldingVoorstel = typeof voorstelStop === 'number' && isFinite(voorstelStop) && voorstelStop > 0
    && anders(voorstelStop, trade.stopLoss) ? voorstelStop : undefined;

  const [stopVeld, setStopVeld] = useState('');
  const [doelVeld, setDoelVeld] = useState('');
  const [wisStop, setWisStop] = useState(false);
  const [wisDoel, setWisDoel] = useState(false);
  const [verzoekId, setVerzoekId] = useState('');
  const [bezig, setBezig] = useState(false);
  // Eén bevestiging tegelijk. Een state-vlag komt pas na de volgende render aan, dus twee tikken
  // binnen één frame zouden er allebei doorheen glippen. Na een geslaagde order blijft dit dicht
  // tot het venster opnieuw opengaat: tijdens het vinkje mag er geen tweede order uit.
  const loopt = useRef(false);
  const { gelukt, vier, sluit, wis } = useGeluktMoment(onSluiten);
  const [fout, setFout] = useState('');
  // Klok voor de versheid van de koers: zonder nieuwe poll rendert het venster anders niet opnieuw,
  // en zou een koers die intussen te oud is nog als referentie gelden.
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    if (!zichtbaar) return;
    setNu(Date.now());
    const id = setInterval(() => setNu(Date.now()), KOERS_CONTROLE_MS);
    return () => clearInterval(id);
  }, [zichtbaar]);

  // Eén id per keer dat de sheet opengaat, niet per klik, zodat een handmatige herhaling na een fout
  // dezelfde x-request-id hergebruikt.
  useEffect(() => {
    if (!zichtbaar) return;
    // Een voorstel uit een melding vult de stop alvast in, behalve als het in je echte account op of
    // voorbij de instapprijs ligt: dat kan Kader nog niet doorgeven, en dan legt voorstelUitleg
    // hieronder uit waarom het veld de huidige stop houdt.
    setStopVeld(meldingVoorstel !== undefined && !bovenAankoopInEcht(meldingVoorstel)
      ? zonderExponent(meldingVoorstel)
      : trade.stopLoss > 0 ? trade.stopLoss.toString() : '');
    setDoelVeld(trade.takeProfit > 0 ? trade.takeProfit.toString() : '');
    setWisStop(false);
    setWisDoel(false);
    setVerzoekId(guid());
    setBezig(false);
    loopt.current = false;
    wis();
    setFout('');
  }, [zichtbaar, trade.id, trade.stopLoss, trade.takeProfit, meldingVoorstel]);

  // Fail-closed poort. Een positie-ID uit de ene omgeving naar het endpoint van de andere sturen is
  // een slechte afloop: dezelfde sleutel wordt op beide paden geaccepteerd, dus het pad is het enige
  // dat echt geld van speelgeld scheidt. Het instrumentID heeft dit endpoint niet nodig.
  const tradeOmgeving = trade.etoroOmgeving ?? 'real';
  const positionId = trade.etoroPositionID;
  const blokkade =
    trade.bron !== 'etoro' ? 'Deze trade heb je zelf ingevoerd, hij staat niet als positie bij eToro. Pas hem aan met Aanpassen.'
      : positionId === undefined ? 'Kader mist het eToro-positienummer van deze trade. Ververs je portfolio, dan vult de sync het aan.'
        : tradeOmgeving !== omgeving ? `Deze positie staat in je ${tradeOmgeving === 'demo' ? 'demo' : 'echte'}-account en je staat nu op ${omgeving === 'demo' ? 'demo' : 'echt'}. Schakel om om hem te kunnen wijzigen.`
          : '';
  const poortOpen = blokkade === '';

  const bekendePosities = useMemo(
    () => trades
      .filter(t => t.bron === 'etoro' && t.status === 'open' && t.etoroPositionID !== undefined
        && (t.etoroOmgeving ?? 'real') === omgeving)
      .map(t => t.etoroPositionID as number),
    [trades, omgeving],
  );

  const ingevuldeStop = getal(stopVeld);
  const ingevuldDoel = getal(doelVeld);

  // Bij het wijzigen van een lopende long meet eToro de afstand vanaf de huidige koers, niet vanaf
  // de aankoopprijs (meting 1 okt 2026, zie docs/etoro-direct-handelen-plan.md §12). Daarom krijgt
  // bepaalStop bij een long de koers als referentie, zodat je winst kunt vastzetten met een stop
  // boven de aankoopprijs. Zonder bruikbare of verse koers (zie KOERS_MAX_LEEFTIJD_MS), en bij een
  // short, blijft de aankoopprijs de basis.
  const koersTijd = livePrijsTijd[trade.symbool];
  const koersVers = koersTijd !== undefined && nu - koersTijd < KOERS_MAX_LEEFTIJD_MS;
  const koersReferentie = richtingVan(trade) === 'long' && koersVers && typeof huidigePrijs === 'number'
    && isFinite(huidigePrijs) && huidigePrijs > 0 ? huidigePrijs : undefined;

  // Of eToro een stop boven de aankoopprijs neemt, is nog niet gemeten (plan §12, T2 en T3). Tot dat
  // gemeten is houdt Kader de stop van een long in je echte account onder de aankoopprijs; in demo
  // mag het wel, daar kost een misser geen echt geld. Voor een short geldt het spiegelbeeld: in echt
  // geen stop op of onder de instapprijs. Dat blokkeert ook als de limieten nog niet binnen zijn,
  // want dan toetst bepaalStop niets en zou een break-even-stop anders na één tik uitgaan.
  const echtPlafond = richtingVan(trade) === 'long' && tradeOmgeving === 'real';
  const echtVloer = richtingVan(trade) === 'short' && tradeOmgeving === 'real';
  const bovenAankoopInEcht = (stop: number) => isFinite(stop)
    && ((echtPlafond && stop >= trade.entryPrijs) || (echtVloer && stop <= trade.entryPrijs));
  const voorbijInstap = echtVloer ? 'op of onder je instapprijs' : 'op of boven je aankoopprijs';

  // De limiet komt nu per richting binnen, dus een short wordt tegen eToro's short-grenzen getoetst
  // (gemeten: minimaal 10% en maximaal 50% BOVEN de entry, waar een long tot 100% eronder mag).
  // Wissen is geen niveau, dus dan valt er niets te toetsen. Komt de stop die zou uitgaan (ook een
  // door bepaalStop bijgestelde) op of boven de aankoopprijs in echt, dan gaat er niets uit. Een stop
  // die al zo bij eToro staat en niet wijzigt, blokkeert een wijziging van alleen het doel niet.
  const eToroAdvies: StopAdvies = wisStop
    ? { soort: 'ok' }
    : bepaalStop(trade.entryPrijs, ingevuldeStop, limiet, koersReferentie);
  const stopNaToets = eToroAdvies.soort === 'aangepast' ? eToroAdvies.stop : ingevuldeStop;
  const advies: StopAdvies =
    (eToroAdvies.soort === 'ok' || eToroAdvies.soort === 'aangepast') && !wisStop && stopNaToets > 0
      && bovenAankoopInEcht(stopNaToets) && anders(stopNaToets, trade.stopLoss)
      ? {
        soort: 'waarschuwing',
        uitleg: `In je echte account kan Kader de stop nog niet ${voorbijInstap} zetten. Dat is bij eToro nog niet gemeten; in demo kan het wel.`,
      }
      : eToroAdvies;

  // Exact de tabel uit het plan: 'aangepast' stuurt het bijgestelde niveau, 'vast' stuurt niets, en
  // 'waarschuwing' komt hieronder niet eens aan een verzoek toe.
  const stopTeSturen: number | undefined =
    advies.soort === 'aangepast' ? advies.stop
      : advies.soort === 'vast' ? undefined
        : ingevuldeStop > 0 ? ingevuldeStop
          : undefined;

  const doelTeSturen = ingevuldDoel > 0 ? ingevuldDoel : undefined;

  const stopWijzigt = wisStop
    ? trade.stopLoss > 0
    : stopTeSturen !== undefined && anders(stopTeSturen, trade.stopLoss);
  const doelWijzigt = wisDoel
    ? trade.takeProfit > 0
    : doelTeSturen !== undefined && anders(doelTeSturen, trade.takeProfit);

  const ietsGewijzigd = stopWijzigt || doelWijzigt;
  const geblokkeerdDoorStop = advies.soort === 'waarschuwing';
  const magBevestigen = poortOpen && ietsGewijzigd && !geblokkeerdDoorStop;

  function bouwWijziging(): NiveauWijziging {
    // De velden hierboven blijven in Kaders eigen koers per coin; alleen wat er echt de deur uitgaat
    // naar eToro krijgt de omrekening, zie KooporderSheet voor dezelfde aanpak bij een kooporder.
    const wijziging: NiveauWijziging = { koersFactor: koersFactor(trade.symbool) };
    if (wisStop) wijziging.clearStopLoss = true;
    else if (stopWijzigt && stopTeSturen !== undefined) wijziging.stopLossRate = stopTeSturen;
    if (wisDoel) wijziging.clearTakeProfit = true;
    else if (doelWijzigt && doelTeSturen !== undefined) wijziging.takeProfitRate = doelTeSturen;
    return wijziging;
  }

  async function bevestig() {
    if (!magBevestigen || bezig || loopt.current || positionId === undefined) return;
    loopt.current = true;
    let geslaagd = false;
    setBezig(true);
    setFout('');

    try {
      const sleutels = await actieveSleutels();
      if (!sleutels) {
        setFout('Geen eToro-sleutels gevonden voor deze omgeving. Koppel je account opnieuw in Instellingen.');
        return;
      }
      // De knop is getekend voor één omgeving. Is die intussen gewisseld, dan gaat er niets de deur
      // uit: anders zou een wijziging die je als demo bevestigde een echte positie raken, of andersom.
      if ((sleutels.omgeving ?? 'real') !== omgeving) {
        setFout('Je omgeving is net gewisseld. Sluit dit venster en open het opnieuw.');
        return;
      }

      const uitkomst = await wijzigNiveaus(positionId, bouwWijziging(), sleutels, verzoekId);

      if (uitkomst.soort === 'ok') {
        geslaagd = true;
        verzoenNaOrder();
        // Eerst het vinkje in de knop, dan pas sluiten en bevestigen.
        vier(() => {
          onSluiten();
          toonDialoog({
            variant: 'gelukt',
            rondje: 'gelukt',
            titel: 'Niveaus doorgegeven',
            tekst: `De stop-loss en het doel van ${trade.symbool} staan bij eToro. Kader werkt ze bij na de volgende sync.`,
            knoppen: [{ label: 'Oké' }],
          });
        });
        return;
      }

      if (uitkomst.soort === 'fout') {
        setFout(uitkomst.bericht);
        return;
      }

      // Onbekend: eerst naar schijf, dan pas de melding.
      const order: OnbekendeOrder = {
        verzoekId: uitkomst.verzoekId,
        soort: 'niveaus',
        symbool: trade.symbool,
        omgeving: sleutels.omgeving ?? 'real',
        positionId,
        bekendePosities,
        tijd: Date.now(),
      };
      try {
        await noteerOnbekendeOrder(order);
      } catch {
        // Wegschrijven mislukte. De melding hieronder klopt hoe dan ook, en opnieuw versturen is
        // ook nu geen optie.
      }
      onSluiten();
      toonDialoog({
        variant: 'waarschuwing',
        rondje: 'onzeker',
        titel: 'We weten niet of je wijziging is doorgegaan',
        tekst: 'Kader heeft geen antwoord van eToro gekregen. De opdracht staat genoteerd en Kader controleert het zelf bij eToro.',
        resultaat: {
          soort: 'waarschuwing',
          tekst: 'Stuur de niveaus niet opnieuw voordat je bij eToro hebt gekeken.',
        },
        knoppen: [{ label: 'Oké' }],
      });
    } finally {
      // Na een geslaagde order blijft de knop dicht tot het venster sluit: het vinkje staat nog
      // even, en een tik in die tijd mag geen tweede order worden.
      if (!geslaagd) {
        setBezig(false);
        loopt.current = false;
      }
    }
  }


  // Alles hieronder is weergave: slepen, de -/+ knoppen en het voorstel zetten alleen de velden.
  // Wat er naar eToro gaat blijft lopen via stopTeSturen, doelTeSturen en bevestig hierboven.
  const richting = richtingVan(trade);
  const entry = trade.entryPrijs;
  const stap = stapGrootte(entry);
  const bereik = useMemo(
    // live blijft ook een oudere koers: hij houdt de greep alleen onder die koers, dat verruimt niets.
    // De referentie voor eToro's minimum is wel alleen een verse koers, net als bij bepaalStop.
    () => greepBereik({
      entry, live: huidigePrijs, referentie: koersReferentie, plafond: echtPlafond ? entry : undefined, richting, limiet, stap,
    }),
    [entry, huidigePrijs, koersReferentie, echtPlafond, richting, limiet, stap],
  );

  // De schaal van de baan komt uit de oorspronkelijke niveaus, de koers en de grenzen, nooit uit
  // wat je aan het slepen bent: anders schaalt de baan onder je vinger mee.
  const baan = useMemo(() => {
    const punten: number[] = [];
    const voeg = (n: number | undefined) => {
      if (typeof n === 'number' && isFinite(n) && n > 0) punten.push(n);
    };
    voeg(entry);
    voeg(huidigePrijs);
    if (trade.stopLoss > 0) voeg(trade.stopLoss);
    if (trade.takeProfit > 0) voeg(trade.takeProfit);
    for (const grens of [bereik.stop?.min, bereik.stop?.max, bereik.doel?.min, bereik.doel?.max]) {
      if (grens !== undefined && isFinite(grens) && Math.abs(grens - entry) <= entry * BAAN_MAX_AFSTAND) voeg(grens);
    }
    if (punten.length === 0) return null;
    let lo = Math.min(...punten);
    let hi = Math.max(...punten);
    const minSpan = entry * BAAN_MIN_SPAN;
    if (hi - lo < minSpan) {
      const midden = (lo + hi) / 2;
      lo = midden - minSpan / 2;
      hi = midden + minSpan / 2;
    }
    const marge = (hi - lo) * BAAN_MARGE;
    return { min: Math.max(lo - marge, lo * 0.01), max: hi + marge };
  }, [entry, huidigePrijs, trade.stopLoss, trade.takeProfit, bereik]);

  const heeftStop = !wisStop && isFinite(ingevuldeStop) && ingevuldeStop > 0;
  const heeftDoel = !wisDoel && isFinite(ingevuldDoel) && ingevuldDoel > 0;

  // Een stap vanaf het huidige veld, of vanaf de koers (of de entry) als het veld leeg is.
  function verstap(veld: 'stop' | 'doel', teken: 1 | -1) {
    const b: Bereik | null = veld === 'stop' ? bereik.stop : bereik.doel;
    if (!b || (veld === 'stop' ? wisStop : wisDoel)) return;
    const huidig = veld === 'stop' ? ingevuldeStop : ingevuldDoel;
    const basis = isFinite(huidig) && huidig > 0 ? huidig : (huidigePrijs ?? entry);
    const nieuw = klem(opStap(basis + teken * stap, stap), b);
    if (!isFinite(nieuw) || nieuw <= 0) return;
    (veld === 'stop' ? setStopVeld : setDoelVeld)(alsVeldTekst(nieuw, stap, b));
  }

  // Wat de wijziging in geld betekent voor deze positie. De stop is die welke echt zou uitgaan,
  // dus ook de door bepaalStop bijgestelde.
  const bedrag = trade.bedragUsd ?? (trade.aantalCoins !== undefined ? trade.aantalCoins * entry : 0);
  const plan = planInGeld({
    bedrag,
    entry,
    stop: wisStop ? undefined : stopTeSturen,
    doel: heeftDoel ? ingevuldDoel : undefined,
    richting,
  });
  const stopInWinst = plan !== null && plan.bijStop !== null && plan.bijStop >= 0;

  // Het voorstel van Kader: de trailing stop uit het afbouwadvies, maar alleen als eToro hem zou
  // nemen en hij iets verandert. Een tik vult het veld; er gaat pas iets uit na de knop.
  const trailing = afbouwAdvies?.trailingStop;
  const toonVoorstel =
    typeof trailing === 'number' && isFinite(trailing) && trailing > 0
    // Alleen als eToro dit niveau zo neemt. Bij 'aangepast' zou de tekst een ander niveau noemen
    // dan wat er de deur uitgaat.
    && bepaalStop(entry, trailing, limiet, koersReferentie).soort === 'ok'
    // In echt geen voorstel voorbij de instapprijs, zie echtPlafond en echtVloer.
    && !bovenAankoopInEcht(trailing)
    && !wisStop
    && (!heeftStop || anders(trailing, ingevuldeStop));
  const voorstelInVerlies = typeof trailing === 'number' && (richting === 'short' ? trailing > entry : trailing < entry);

  // Uitleg bij een voorstel uit een melding, zodat het venster niet stil iets anders toont dan de
  // melding noemde.
  const voorstelUitleg = meldingVoorstel === undefined ? ''
    : bovenAankoopInEcht(meldingVoorstel)
      ? `Kader stelde voor je stop naar ${fmtDollar(meldingVoorstel)} te zetten, ${voorbijInstap}. In je echte account kan Kader dat nog niet doorgeven: eToro is daarop nog niet gemeten. In demo kan het wel. Je kunt de stop zelf in de eToro-app verzetten.`
      : `Voorstel uit je melding: stop naar ${fmtDollar(meldingVoorstel)}, al ingevuld. Er gaat pas iets naar eToro als je bevestigt.`;

  function neemVoorstel() {
    if (typeof trailing !== 'number') return;
    haptiek('tik');
    // Zwevende-komma-staartjes weg, zonder het niveau zelf te verschuiven.
    setStopVeld(zonderExponent(trailing));
  }

  // Staat de stop tegen eToro's minimale afstand aan, dan zeggen we waarom de greep daar stopt.
  // Alleen met een bekende grens; zonder grens valt er niets uit te leggen. Bij een long met koers
  // meet de grens vanaf de koers, net als in bepaalStop.
  const minAfstand = limiet && limiet.bewerkbaar ? limiet.minPct : null;
  const grensBasis = koersReferentie ?? entry;
  const stopAfstandPct = heeftStop ? (richting === 'short' ? (ingevuldeStop - entry) / entry : (grensBasis - ingevuldeStop) / grensBasis) * 100 : NaN;
  const aanGrens = minAfstand !== null && isFinite(stopAfstandPct)
    && stopAfstandPct >= minAfstand && stopAfstandPct - minAfstand < (stap / grensBasis) * 100;
  const grensUitleg = aanGrens && minAfstand !== null
    ? `Dichter bij ${koersReferentie !== undefined ? 'de huidige koers' : 'je aankoopprijs'} staat eToro geen stop toe: minimaal ${minAfstand.toFixed(1).replace('.', ',')}% ${richting === 'short' ? 'erboven' : 'eronder'}.`
    : '';

  const veldTekst = (uit: boolean, kleur: string) => [stijlen.input, {
    color: uit ? colors.tekstGedimd : kleur,
  }];

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={sluit} velStijl={stijlen.vel}>
      <View style={stijlen.kop}>
        <OrderKop
          symbool={trade.symbool}
          titel="Stop en doel"
          sub={`${trade.naam || trade.symbool} · aankoop ${fmtDollar(entry)}`}
          omgeving={omgeving}
          onSluiten={sluit}
        />
      </View>

      <ScrollView
        style={stijlen.lijst}
        contentContainerStyle={stijlen.inhoud}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {baan ? (
          <NiveauBaan
            min={baan.min}
            max={baan.max}
            entry={entry}
            live={huidigePrijs}
            stop={heeftStop ? (stopTeSturen ?? ingevuldeStop) : null}
            doel={heeftDoel ? ingevuldDoel : null}
            stopBereik={bereik.stop}
            doelBereik={bereik.doel}
            stap={stap}
            onStop={w => setStopVeld(alsVeldTekst(w, stap, bereik.stop))}
            onDoel={w => setDoelVeld(alsVeldTekst(w, stap, bereik.doel))}
            formatPrijs={fmtDollar}
            richting={richting}
          />
        ) : null}

        <View style={stijlen.velden}>
          <NiveauVeld
            label="STOP-LOSS"
            waarde={stopVeld}
            onWijzig={setStopVeld}
            uit={wisStop}
            kanStappen={bereik.stop !== null && !wisStop}
            onLager={() => verstap('stop', -1)}
            onHoger={() => verstap('stop', 1)}
            lagerLabel="Stop-loss lager"
            hogerLabel="Stop-loss hoger"
            tekstStijl={veldTekst(wisStop, colors.verlies)}
          />
          <NiveauVeld
            label="DOEL"
            waarde={doelVeld}
            onWijzig={setDoelVeld}
            uit={wisDoel}
            kanStappen={bereik.doel !== null && !wisDoel}
            onLager={() => verstap('doel', -1)}
            onHoger={() => verstap('doel', 1)}
            lagerLabel="Doel lager"
            hogerLabel="Doel hoger"
            tekstStijl={veldTekst(wisDoel, colors.winst)}
          />
        </View>

        <View style={stijlen.geld}>
          <GeldTegel
            label="BIJ STOP"
            waarde={plan?.bijStop ?? null}
            leeg={plan === null ? 'onbekend' : 'geen stop'}
          />
          <GeldTegel
            label="BIJ DOEL · R/R"
            waarde={plan?.bijDoel ?? null}
            leeg={plan === null ? 'onbekend' : 'geen doel'}
            onder={plan?.bijDoel == null ? undefined
              : plan.rr !== null ? fmtRR(plan.rr)
                : stopInWinst ? 'geen risico'
                  : undefined}
          />
        </View>

        {voorstelUitleg ? (
          <View style={[stijlen.melding, { backgroundColor: colors.verhoogd, borderColor: bovenAankoopInEcht(meldingVoorstel as number) ? colors.letOp : colors.winst }]}>
            <Text style={[Type.caption, { color: colors.tekstPrimair, lineHeight: 18 }]}>{voorstelUitleg}</Text>
          </View>
        ) : null}

        {toonVoorstel ? (
          <Drukbaar
            onPress={neemVoorstel}
            accessibilityRole="button"
            accessibilityHint="Zet het stop-loss-veld op dit niveau. Er gaat nog niets naar eToro."
            style={[stijlen.voorstel, { backgroundColor: colors.verhoogd }]}
          >
            <Shield size={16} color={colors.winst} strokeWidth={2} />
            <Text style={[Type.caption, stijlen.voorstelTekst, { color: colors.tekstGedimd }]}>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontWeight: '600', color: colors.tekstPrimair }}>
                Voorstel van Kader:
              </Text>
              {` stop naar ${fmtDollar(trailing as number)}. ${voorstelInVerlies ? 'Daarmee beperk je je verlies.' : 'Daarmee staat je winst tot daar vast.'}`}
            </Text>
          </Drukbaar>
        ) : null}

        {/* Leeg neemt dit vak geen ruimte in; de lijst scrolt, dus een advies dat verschijnt duwt alleen de rest omlaag. */}
        <View
          style={[
            stijlen.adviesSlot,
            advies.soort !== 'ok' && stijlen.adviesVak,
            advies.soort !== 'ok' && {
              backgroundColor: colors.verhoogd,
              borderColor: advies.soort === 'waarschuwing' ? colors.verlies : colors.letOp,
            },
          ]}
        >
          {advies.soort !== 'ok' ? (
            <Text
              style={[
                Type.caption,
                { color: advies.soort === 'waarschuwing' ? colors.verlies : colors.letOp, lineHeight: 18 },
              ]}
            >
              {advies.uitleg}
            </Text>
          ) : grensUitleg ? (
            <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>{grensUitleg}</Text>
          ) : null}
        </View>

        {/* Weghalen telt alleen als wijziging als er bij eToro een niveau staat, dus de knop
            verschijnt ook alleen dan. */}
        {trade.stopLoss > 0 || trade.takeProfit > 0 ? (
          <View style={stijlen.tekstknoppen}>
            {trade.stopLoss > 0 ? (
              <Drukbaar
                onPress={() => setWisStop(w => !w)}
                haptiek="tik"
                accessibilityRole="button"
                style={stijlen.tekstknop}
              >
                <Text style={[stijlen.tekstknopTekst, { color: colors.cta }]}>
                  {wisStop ? 'Stop terugzetten' : 'Stop weghalen'}
                </Text>
              </Drukbaar>
            ) : null}
            {trade.takeProfit > 0 ? (
              <Drukbaar
                onPress={() => setWisDoel(w => !w)}
                haptiek="tik"
                accessibilityRole="button"
                style={stijlen.tekstknop}
              >
                <Text style={[stijlen.tekstknopTekst, { color: colors.cta }]}>
                  {wisDoel ? 'Doel terugzetten' : 'Doel weghalen'}
                </Text>
              </Drukbaar>
            ) : null}
          </View>
        ) : null}

        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
          Een niveau dat je niet wijzigt blijft bij eToro staan zoals het stond.
        </Text>

        {!poortOpen ? (
          <View style={[stijlen.melding, { backgroundColor: colors.verhoogd, borderColor: colors.letOp }]}>
            <Text style={[Type.caption, { color: colors.letOp, lineHeight: 18 }]}>{blokkade}</Text>
          </View>
        ) : null}

        {fout ? (
          <View style={[stijlen.melding, { backgroundColor: colors.verhoogd, borderColor: colors.verlies }]}>
            <Text style={[Type.caption, { color: colors.verlies, lineHeight: 18 }]}>{fout}</Text>
          </View>
        ) : null}

      </ScrollView>

      {/* De hulpregel en de knop staan buiten de ScrollView, en de regel heeft een eigen
          gereserveerde hoogte. Zo blijft de knop op dezelfde plek staan of er nu een hulpregel is
          of niet, en scrollt hij niet mee weg. */}
      <View style={stijlen.hulpSlot}>
        {poortOpen && !ietsGewijzigd ? (
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
            Wijzig een niveau of haal er een weg om te kunnen bevestigen.
          </Text>
        ) : null}
      </View>

      <OrderBevestigKnop
        label={omgeving === 'real' ? 'Houd vast om door te geven' : 'Doorgeven in demo'}
        omgeving={omgeving}
        bezig={bezig}
        uitgeschakeld={!magBevestigen}
        onBevestig={bevestig}
        gelukt={gelukt}
        echtWaarschuwing="Echt geld. Houd de knop vast om door te geven."
      />
    </BottomSheet>
  );
}

interface NiveauVeldProps {
  label: string;
  waarde: string;
  onWijzig: (tekst: string) => void;
  uit: boolean;
  kanStappen: boolean;
  onLager: () => void;
  onHoger: () => void;
  lagerLabel: string;
  hogerLabel: string;
  tekstStijl: StyleProp<TextStyle>;
}

// Eén niveau: het label, en op één rij -, het getal en +. Het tekstveld krimpt als het krap wordt,
// de knoppen houden hun 36 dp.
function NiveauVeld({
  label, waarde, onWijzig, uit, kanStappen, onLager, onHoger, lagerLabel, hogerLabel, tekstStijl,
}: NiveauVeldProps) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  // Een prijs als 0.00000506 past met vaste letter niet tussen de knoppen op 360 dp. De grootte volgt
  // daarom de gemeten breedte en het aantal tekens (mono, ongeveer 0,62 em per teken), en rekent de
  // systeemletter zelf mee (tot 1,2x), zodat het getal nooit afkapt.
  const [breedte, setBreedte] = useState(0);
  const tekens = Math.max(waarde.length, 4);
  const passend = breedte > 0 ? breedte / (tekens * 0.62) : 15;
  const letter = Math.max(10, Math.min(15 * Math.min(fontScale, 1.2), passend));
  const knop = (Icoon: typeof Minus, onPress: () => void, a11y: string) => (
    <Drukbaar
      onPress={onPress}
      haptiek="tik"
      disabled={!kanStappen}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !kanStappen }}
      schaal={0.9}
      style={[stijlen.stapKnop, { backgroundColor: colors.kaart, opacity: kanStappen ? 1 : 0.4 }]}
    >
      <Icoon size={16} color={colors.tekstPrimair} strokeWidth={2} />
    </Drukbaar>
  );

  return (
    <View style={[stijlen.veld, { backgroundColor: colors.verhoogd, opacity: uit ? 0.5 : 1 }]}>
      <Text style={[Type.overline, { color: colors.tekstGedimd }]} numberOfLines={1}>{label}</Text>
      <View style={stijlen.veldRij}>
        {knop(Minus, onLager, lagerLabel)}
        <TextInput
          style={[tekstStijl, { fontSize: letter }]}
          onLayout={e => setBreedte(e.nativeEvent.layout.width)}
          value={waarde}
          onChangeText={onWijzig}
          editable={!uit}
          placeholder="-"
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
          textAlign="center"
          allowFontScaling={false}
          accessibilityLabel={label.toLowerCase()}
        />
        {knop(Plus, onHoger, hogerLabel)}
      </View>
    </View>
  );
}

// Een bedrag met teken in winst- of verlieskleur, of een korte tekst als er niets te rekenen valt.
function GeldTegel({ label, waarde, leeg, onder }: { label: string; waarde: number | null; leeg: string; onder?: string }) {
  const { colors } = useTheme();
  const afgerond = waarde === null ? null : rond(waarde);
  const leesbaar = afgerond === null ? leeg : fmtMetTeken(afgerond);

  return (
    <View
      style={[stijlen.tegel, { backgroundColor: colors.verhoogd }]}
      accessible
      accessibilityLabel={`${label.toLowerCase()}: ${leesbaar}${onder ? `, ${onder}` : ''}`}
    >
      <Text style={[Type.overline, { color: colors.tekstGedimd }]} importantForAccessibility="no" numberOfLines={1}>
        {label}
      </Text>
      {afgerond === null ? (
        <Text style={[Type.caption, { color: colors.tekstGedimd }]} importantForAccessibility="no">{leeg}</Text>
      ) : (
        <GeldGetal waarde={afgerond} format={fmtMetTeken} neutraal={colors.winst} />
      )}
      {onder ? (
        <Text style={[Type.caption, { color: colors.tekstGedimd }]} importantForAccessibility="no" numberOfLines={1}>
          {onder}
        </Text>
      ) : null}
    </View>
  );
}

const stijlen = StyleSheet.create({
  vel: {
    maxHeight: '90%',
  },
  kop: { marginBottom: spacing.base },
  // Levert hoogte in aan de voet eronder in plaats van hem van het scherm te duwen.
  lijst: { flexShrink: 1 },
  inhoud: { gap: 14 },
  velden: { flexDirection: 'row', gap: 8 },
  veld: { flex: 1, minWidth: 0, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, gap: 6 },
  veldRij: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stapKnop: {
    minWidth: 36,
    width: 36,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontFamily: Fonts.monoMedium,
    fontVariant: ['tabular-nums'],
    fontSize: 15,
  },
  geld: { flexDirection: 'row', gap: 8 },
  tegel: { flex: 1, minWidth: 0, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  voorstel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    minHeight: 44,
  },
  voorstelTekst: { flex: 1, lineHeight: 18 },
  tekstknoppen: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  tekstknop: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  tekstknopTekst: { fontFamily: Fonts.sansSemiBold, fontWeight: '600', fontSize: 13 },
  melding: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
  },
  // 60px is padding 12 boven en onder plus twee regels Type.caption op lineHeight 18: de hoogte die
  // het stop-advies inneemt als het er wél staat.
  adviesSlot: {
    justifyContent: 'center',
  },
  adviesVak: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
  },
  // Twee regels Type.caption plus lucht. Onder de zin zat eerst helemaal niets.
  hulpSlot: {
    minHeight: 60,
    marginTop: spacing.md,
    marginBottom: spacing.base,
    justifyContent: 'center',
  },
});
