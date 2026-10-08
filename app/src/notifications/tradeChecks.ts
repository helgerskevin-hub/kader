import { PortfolioTrade, richtingVan } from '../state/portfolioTypes';
import { voorstelTrailingStop, bepaalAfbouwAdvies } from '../state/afbouw';
import { laadLijst, bewaarLijst, laadObject, bewaarObject, laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import { haalData, haalLaatstePrijzen } from '../engine/marketData';
import { scoorCandles, analyseerMarkt } from '../engine/analyzer';
import { macd } from '../engine/indicators';
import { fmtPrijs } from '../engine/format';
import { stuurTradeMelding } from './meldingen';
import { MeldingDoel, leesDoel } from './meldingDoel';
import { bewaarAlerts, geraakteAlerts, laadAlerts, wachtendeSymbolen } from '../state/prijsalerts';
import { meldingenAan } from '../state/meldingVoorkeur';

// 'verhoogTP', 'klimaat' en 'portfolioRisico' bestonden tot deze versie. Ze worden niet meer
// verstuurd; oude regels in het meldingenlog blijven gewoon leesbaar (het log bewaart titel en tekst,
// niet het type), en oude suppressie-sleutels ruimt snoei na zes uur vanzelf op.
type TriggerType = 'trekStopAan' | 'sterkeKoop' | 'afbouwen';

// Per trade + trigger het epoch-ms van de laatst verstuurde melding.
type SuppressieState = Record<string, number>;

// Tot en met 0.1.8 stond hier per sleutel een object ({tijd, niveau}) omdat de driftuitzondering
// het voorgestelde niveau nodig had. Die uitzondering is weg, dus het niveau ook. Zonder deze
// vertaling zou een bestaande installatie zijn oude regels als getal lezen: elke vergelijking geeft
// dan NaN, magSturen wordt daardoor altijd onwaar en snoei ruimt de regel nooit op, dus die trades
// zouden nooit meer een melding krijgen. Het tijdstip nemen we mee, zodat een melding die net
// verstuurd is niet alsnog meteen herhaald wordt.
function leesSuppressie(ruw: Record<string, unknown> | null): SuppressieState {
  const schoon: SuppressieState = {};
  for (const [sleutel, waarde] of Object.entries(ruw ?? {})) {
    if (typeof waarde === 'number') {
      schoon[sleutel] = waarde;
    } else if (waarde !== null && typeof waarde === 'object' && typeof (waarde as { tijd?: unknown }).tijd === 'number') {
      schoon[sleutel] = (waarde as { tijd: number }).tijd;
    }
    // Alles wat geen van beide is telt als "niets bekend": de melding mag dan gewoon door.
  }
  return schoon;
}

// Dezelfde melding hooguit eens per zes uur. Hier zat eerder een uitzondering op: verschoof het
// voorgestelde niveau meer dan 2%, dan mocht de melding er binnen dat venster tóch door, want dan
// zou het nieuws materieel veranderd zijn. In de praktijk deed die uitzondering dat niet. Het
// niveau is afgeleid van de live koers (doel = koers + 3xATR, stop = koers - ATR) en crypto beweegt
// routineus 2% per uur, dus de suppressie herlaadde zichzelf op ruis en meldde dezelfde trade elke
// ronde opnieuw. Het venster is nu hard.
const HERHAAL_VENSTER_MS = 6 * 60 * 60 * 1000;

// Eén trade-melding per uur, over alle open trades en koopsignalen heen. De suppressie hierboven
// voorkomt dat dezelfde melding zich herhaalt; deze rem voorkomt een stapel verschillende. Wordt
// bovenaan checkOpenTrades gecheckt, dus binnen het uur kost een ronde ook geen netwerkverzoeken.
const MELDING_COOLDOWN_MS = 60 * 60 * 1000;

// De sterke-koop-scan loopt over het hele universum en is daarmee veruit de duurste stap. Hooguit
// één keer per uur, ongeacht hoe vaak de check verder draait.
const STERKE_KOOP_SCAN_VENSTER_MS = 60 * 60 * 1000;

// Hoeveel nieuwe koopsignalen we maximaal uit één scan melden. Zonder deze grens kan een sterke
// marktdag tien koopsignalen tegelijk opleveren en dat leest niemand.
const MAX_KOOP_MELDINGEN = 3;

// Leest een epoch-ms uit de opslag. Een corrupte waarde telt als "lang geleden": dat is de veilige
// kant voor een rem (hooguit één melding te vroeg) en houdt het gedrag van de scan gelijk.
async function laadTijdstip(sleutel: string): Promise<number> {
  const waarde = Number(await laadTekst(sleutel, '0'));
  return Number.isFinite(waarde) ? waarde : 0;
}

function sleutelVoor(id: string, trigger: TriggerType): string {
  return `${id}:${trigger}`;
}

function magSturen(state: SuppressieState, sleutel: string, nu: number): boolean {
  const vorig = state[sleutel];
  return vorig === undefined || nu - vorig > HERHAAL_VENSTER_MS;
}

// Ruimt regels op die bij een trade horen die niet meer open staat, zodat de state niet eeuwig
// blijft groeien met gesloten trades.
function snoei(state: SuppressieState, levendeSleutels: Set<string>, nu: number): SuppressieState {
  const schoon: SuppressieState = {};
  for (const [sleutel, tijd] of Object.entries(state)) {
    const verlopen = nu - tijd > HERHAAL_VENSTER_MS;
    if (levendeSleutels.has(sleutel) || !verlopen) schoon[sleutel] = tijd;
  }
  return schoon;
}

export interface Melding {
  sleutel: string;
  titel: string;
  tekst: string;
  // Waar deze melding over gaat, zodat je er in het meldingenlog naartoe kunt tikken.
  doel: MeldingDoel;
}

export interface MeldingLogEntry {
  tijd: number;
  titel: string;
  tekst: string;
  // Ontbreekt bij alles wat vóór deze versie gelogd is; zo'n regel blijft leesbaar maar is niet
  // aantikbaar. Bewust optioneel gehouden in plaats van een migratie: het log is een historie,
  // en er is geen manier om achteraf te bepalen over welke trade een oude regel ging.
  doel?: MeldingDoel;
}

const MAX_LOG_ENTRIES = 50;

/**
 * Leest het meldingenlog uit de opslag en schoont het doel per regel op.
 *
 * Bestaat zodat de UI niet zelf hoeft te weten dat oude regels geen doel hebben en dat een
 * opgeslagen doel van een vorige app-versie niet meer hoeft te kloppen: leesDoel geeft dan null
 * en de regel is gewoon niet aantikbaar, in plaats van dat een tik nergens op uitkomt.
 */
export async function laadMeldingLog(): Promise<MeldingLogEntry[]> {
  const ruw = await laadLijst<MeldingLogEntry & { doel?: unknown }>(SLEUTELS.meldingLog);
  return ruw.map(entry => {
    const doel = leesDoel(entry.doel);
    return doel ? { ...entry, doel } : { tijd: entry.tijd, titel: entry.titel, tekst: entry.tekst };
  });
}

// Bewaart verstuurde meldingen lokaal, zodat een melding die uit de notificatiebalk is verdwenen
// (of nooit doorkwam terwijl de telefoon vergrendeld was) terug te lezen is in de app. De dagelijkse
// 09:00-herinnering loopt hier niet doorheen: die levert het OS zelf af zonder dat er app-code
// draait, en heeft toch geen trade-context om te loggen. Geëxporteerd voor de sluitingsmeldingen
// in sluitingen.ts, zodat er één log en één maximum blijft.
export async function loggeMeldingen(meldingen: Melding[], nu: number): Promise<void> {
  const bestaand = await laadLijst<MeldingLogEntry>(SLEUTELS.meldingLog);
  const nieuw = meldingen.map(m => ({ tijd: nu, titel: m.titel, tekst: m.tekst, doel: m.doel }));
  await bewaarLijst(SLEUTELS.meldingLog, [...nieuw, ...bestaand].slice(0, MAX_LOG_ENTRIES));
}

// Beoordeelt één open trade op verse candles. Retourneert de meldingen die op grond van de markt
// terecht zijn; de suppressie beslist daarna pas of ze ook echt verstuurd worden.
async function beoordeelTrade(trade: PortfolioTrade): Promise<Melding[]> {
  if (trade.stopLoss <= 0 || trade.takeProfit <= 0) return [];

  const richting = richtingVan(trade);
  const short = richting === 'short';

  // Vormcontrole per richting, opvolger van de oude long-only test op takeProfit <= entryPrijs.
  // Een long hoort stop < entry < doel te hebben, een short precies andersom. Klopt dat niet, dan
  // is de trade niet te beoordelen en sturen we liever geen melding dan een verkeerde.
  const stopGoed = short ? trade.stopLoss > trade.entryPrijs : trade.stopLoss < trade.entryPrijs;
  const doelGoed = short ? trade.takeProfit < trade.entryPrijs : trade.takeProfit > trade.entryPrijs;
  if (!stopGoed || !doelGoed) return [];

  const data = await haalData(trade.symbool);
  if (!data) return [];

  // minRR: 0 omdat de R/R-filter hier niet hoort: deze trade lóópt al, we willen alleen weten wat
  // de verse niveaus en het momentum nu zeggen. Met de standaardfilter zou scoorCandles null geven
  // zodra de actuele R/R onder de 2 zakt en zwegen we juist als er iets te melden valt.
  const vers = scoorCandles(trade.symbool, data.candles, data.bron, { minRR: 0 });
  if (!vers) return [];

  const koers = vers.prijs;
  const { histogram } = macd(data.candles.map(c => c.close));
  const n = histogram.length;
  if (n < 2) return [];
  const histogramStijgt = histogram[n - 1] > histogram[n - 2];
  // Een long wil een stijgend histogram, een short precies het omgekeerde: een dalend histogram.
  const histogramGunstig = short ? !histogramStijgt : histogramStijgt;

  const meldingen: Melding[] = [];

  // Stop aantrekken: de positie staat minstens 1R in winst (de koers ligt minstens één
  // stop-afstand voorbij de entry), of hij staat in winst en het momentum vlakt af. Eén melding per
  // trade voor beide redenen. Alleen melden als het voorstel de stop echt richting winst brengt.
  //
  // De R rekent met de huidige stop, want de oorspronkelijke stop wordt niet apart bewaard. Dat is
  // hier precies goed: zodra de stop op break-even of erboven staat, faalt de vormcontrole
  // hierboven en zwijgt deze trigger vanzelf.
  //
  // Dit is alleen advies. Er gaat niets naar eToro: een tik op de melding opent het stop-venster
  // met het voorstel ingevuld, en pas de bevestigknop daar verzet de stop.
  const teken = short ? -1 : 1;
  const winstAfstand = teken * (koers - trade.entryPrijs);
  const risicoAfstand = teken * (trade.entryPrijs - trade.stopLoss);
  const inWinst = winstAfstand > 0;
  const eenRWinst = risicoAfstand > 0 && winstAfstand >= risicoAfstand;
  const momentumVlaktAf = !histogramGunstig;
  if (inWinst && (eenRWinst || momentumVlaktAf)) {
    // Zelfde berekening als het afbouwadvies in het Portfolio-scherm, bewust uit één bron: een
    // melding die een ander niveau noemt dan het scherm kost het vertrouwen in allebei.
    const voorstel = voorstelTrailingStop(trade.entryPrijs, koers, vers.atr, trade.stopLoss, richting);
    if (voorstel !== null) {
      const breakEven = Math.abs(voorstel - trade.entryPrijs) < 1e-9;
      const werkwoord = short ? 'verlagen' : 'verhogen';
      const niveau = breakEven
        ? `${fmtPrijs(voorstel)}, je instapprijs (break-even)`
        : `${fmtPrijs(voorstel)}, dan staat de winst tot daar vast`;
      const r = (winstAfstand / risicoAfstand).toFixed(1).replace('.', ',');
      // Alleen een voorstel dat NiveausSheet ook echt kan bevestigen gaat als voorstelStop mee: een
      // eToro-trade in demo, of in je echte account een niveau dat nog aan de veilige kant van de
      // instap ligt (zie echtPlafond en echtVloer daar). Anders is het puur advies en opent de tik
      // gewoon de trade.
      const echt = (trade.etoroOmgeving ?? 'real') === 'real';
      const veiligInEcht = short ? voorstel > trade.entryPrijs : voorstel < trade.entryPrijs;
      const bevestigbaar = trade.bron === 'etoro' && (!echt || veiligInEcht);
      const slot = bevestigbaar
        ? ' Tik om het voorstel te bekijken en te bevestigen.'
        : trade.bron === 'etoro'
          ? ' Dat niveau kan Kader in je echte account nog niet doorgeven; verzet de stop zelf in de eToro-app.'
          : ' Pas de stop aan via Aanpassen bij de trade.';
      meldingen.push({
        sleutel: sleutelVoor(trade.id, 'trekStopAan'),
        doel: bevestigbaar
          ? { soort: 'trade', tradeId: trade.id, symbool: trade.symbool, voorstelStop: voorstel }
          : { soort: 'trade', tradeId: trade.id, symbool: trade.symbool },
        titel: eenRWinst ? `${trade.symbool}: zet je winst vast` : `${trade.symbool}: momentum vlakt af`,
        tekst: eenRWinst
          ? `Je staat ${r}R in winst (koers ${fmtPrijs(koers)}). Overweeg je stop te ${werkwoord} van ${fmtPrijs(trade.stopLoss)} naar ${niveau}.${slot}`
          : `Je staat in winst (koers ${fmtPrijs(koers)}), maar het momentum neemt af. Overweeg je stop te ${werkwoord} van ${fmtPrijs(trade.stopLoss)} naar ${niveau}.${slot}`,
      });
    }
  }

  return meldingen;
}

// Eén marktronde: haalt de scan één keer op en leidt daar alle marktbrede meldingen uit af. Bewust
// gebundeld en niet drie losse functies, want elke scan is 57 coins aan requests.
//
// De koopsignalen leunen op analyseerMarkt en niet op een eigen scan, zodat de marktklimaat-poort
// er al op zit: in een ongunstig klimaat zwijgen ze vanzelf, net als het Marktscherm. De lat is high
// conviction, de sterkste bucket uit de backtest.
async function beoordeelMarkt(
  open: PortfolioTrade[],
  nu: number,
): Promise<Melding[]> {
  const laatst = await laadTijdstip(SLEUTELS.laatsteSterkeKoopScan);
  if (nu - laatst < STERKE_KOOP_SCAN_VENSTER_MS) return [];
  // Claimen vóór de scan, niet erna: een mislukte scan brandt het venster op, maar zo kan een
  // tweede aanroeper er niet naast gaan draaien.
  await bewaarTekst(SLEUTELS.laatsteSterkeKoopScan, String(nu));

  const { trades, alle, klimaat } = await analyseerMarkt({ topN: 10 });
  // Alleen open LONGS onderdrukken een nieuw koopsignaal op diezelfde coin: een open short op een
  // coin is geen reden om een legitiem koopsignaal daar te verzwijgen, die twee bijten elkaar niet.
  const openSymbolen = new Set(open.filter(t => richtingVan(t) === 'long').map(t => t.symbool));

  const meldingen: Melding[] = trades
    .filter(t => t.highConviction && t.signaal === 'KOOP' && !openSymbolen.has(t.symbool))
    .slice(0, MAX_KOOP_MELDINGEN)
    .map(t => ({
      sleutel: sleutelVoor(t.symbool, 'sterkeKoop'),
      doel: { soort: 'coin', symbool: t.symbool },
      titel: `Sterk koopsignaal: ${t.symbool}`,
      tekst: `${t.symbool} scoort ${t.score} van de 100. Trend, MACD en volume staan mee. Entry ${fmtPrijs(t.entry)}, stop ${fmtPrijs(t.stopLoss)}, doel ${fmtPrijs(t.takeProfit)}.`,
    }));

  if (!klimaat) return meldingen;

  // De scan levert voor elke coin een verse koers en EMA50/ATR, dus het afbouwadvies over de open
  // posities kost hier geen enkel extra verzoek. De achtergrondtaak heeft ook geen andere prijsbron:
  // die draait buiten de React-tree en kan niet bij de live prijzen in PortfolioProvider.
  //
  // Alleen niveau 'afbouwen' geeft een melding: dat is echt advies om (deels) winst te nemen. De
  // oude portefeuillebrede melding ("X van je posities staan zwak") is weg, die vroeg nergens om een
  // concrete handeling. Zelfde berekening als het Portfolio-scherm, dus melding en scherm zeggen
  // hetzelfde.
  const marktPerSymbool = Object.fromEntries(alle.map(t => [t.symbool, t]));
  for (const trade of open) {
    const markt = marktPerSymbool[trade.symbool];
    const advies = bepaalAfbouwAdvies(trade, markt?.prijs, markt, klimaat.klimaat);
    if (advies?.niveau !== 'afbouwen') continue;
    meldingen.push({
      sleutel: sleutelVoor(trade.id, 'afbouwen'),
      doel: { soort: 'trade', tradeId: trade.id, symbool: trade.symbool },
      titel: `${trade.symbool}: winst beschermen`,
      tekst: advies.tekst,
    });
  }

  // De klimaatstand blijft bewaard, ook nu de omslagmelding weg is. Het veld zwakGemeld hoorde bij
  // de vervallen portefeuillemelding en staat er alleen nog voor de vorm.
  await bewaarObject(SLEUTELS.laatsteKlimaat, { klimaat: klimaat.klimaat, zwakGemeld: 0 });

  return meldingen;
}

/**
 * Checkt de zelf ingestelde prijsalerts en meldt wat geraakt is.
 *
 * Staat bewust LOS van checkOpenTrades en dus buiten de uur-cooldown daar. Reden: die cooldown
 * hoort bij meldingen die Kader zelf bedenkt, en die mogen best een uur wachten. Een prijsalert is
 * het omgekeerde: de gebruiker heeft zelf een niveau gekozen en wil het op dat moment weten. De rem
 * zit hier ingebouwd doordat elke alert precies één keer afgaat, dus er kan per alert nooit meer
 * dan één melding uit komen.
 *
 * Kost alleen verzoeken als er echt iets te wachten staat: een ticker-call per coin met een
 * wachtende alert, en nul als de lijst leeg is.
 *
 * @returns Het aantal afgegane alerts.
 */
export async function checkPrijsalerts(): Promise<number> {
  if (!await meldingenAan()) return 0;
  const alerts = await laadAlerts();
  const symbolen = wachtendeSymbolen(alerts);
  if (symbolen.length === 0) return 0;

  const prijzen = await haalLaatstePrijzen(symbolen);
  const geraakt = geraakteAlerts(alerts, prijzen);
  if (geraakt.length === 0) return 0;

  const nu = Date.now();
  const meldingen: Melding[] = geraakt.map(({ alert, koers }) => ({
    // De alert-id in de sleutel, niet het symbool: twee alerts op dezelfde coin zijn twee
    // verschillende meldingen. De suppressie van checkOpenTrades raakt dit sowieso niet.
    sleutel: `alert:${alert.id}`,
    doel: { soort: 'coin', symbool: alert.symbool },
    titel: `${alert.symbool} ${alert.richting === 'boven' ? 'boven' : 'onder'} ${fmtPrijs(alert.prijs)}`,
    tekst: `Je prijsalert is geraakt: ${alert.symbool} staat op ${fmtPrijs(koers)}.`,
  }));

  const [eerste] = meldingen;
  const titel = meldingen.length === 1 ? eerste.titel : `${meldingen.length} prijsalerts geraakt`;
  const tekst = meldingen.length === 1
    ? eerste.tekst
    : `${meldingen.map(m => m.titel).join(', ')}. Open de app voor details.`;

  // Eerst sturen, dan pas wegschrijven dat hij af is. Andersom zou een app-kill tussen die twee in
  // de alert stilletjes opeten en dan mis je het niveau waar je op wachtte. Nu is het ergste geval
  // dezelfde melding nog een keer, en dat is bij een alert die je zelf zette het minst erge.
  if (!await stuurTradeMelding(titel, tekst, meldingen.length === 1 ? eerste.doel : undefined)) return 0;

  const geraakteKoersen = new Map(geraakt.map(g => [g.alert.id, g.koers]));
  await bewaarAlerts(alerts.map(a => {
    const koers = geraakteKoersen.get(a.id);
    return koers === undefined ? a : { ...a, afgegaanOp: nu, afgegaanBij: koers };
  }));
  await loggeMeldingen(meldingen, nu);

  return meldingen.length;
}

/**
 * Checkt de open trades en stuurt waar nodig één gebundelde melding. Wordt aangeroepen door de
 * achtergrondtaak en, wat vaker maar afgeknepen, door de prijs-poll op de voorgrond. Beide delen
 * dezelfde suppressie-state en dezelfde cooldown, zodat dezelfde melding niet twee keer binnenkomt
 * en er hooguit één melding per uur uitgaat.
 *
 * @param opties.trades De open trades. De voorgrond geeft de lijst uit het geheugen mee; de
 *   achtergrondtaak draait buiten de React-tree en laat 'm hier uit AsyncStorage laden.
 * @returns Het aantal verstuurde meldingen.
 */
export async function checkOpenTrades(opties?: { trades?: PortfolioTrade[] }): Promise<number> {
  // Bovenaan, vóór de cooldown-claim: staan de meldingen uit, dan hoeft er ook niets geclaimd of
  // opgehaald te worden.
  if (!await meldingenAan()) return 0;
  const nu = Date.now();

  // De rem staat bewust vóór alles: binnen het uur mag er toch niets gestuurd worden, dus dan
  // hoeven we ook geen candles of marktscan op te halen.
  const laatsteMelding = await laadTijdstip(SLEUTELS.laatsteMelding);
  if (nu - laatsteMelding < MELDING_COOLDOWN_MS) return 0;
  // Claimen vóór het werk, niet erna: anders kunnen de voorgrond-poll en de achtergrondtaak elkaar
  // overlappen en allebei de gate hierboven passeren voordat de een klaar is met versturen. Blijkt
  // er niets te versturen, dan zetten we de claim aan het eind terug (zie verstuurd === 0 hieronder).
  await bewaarTekst(SLEUTELS.laatsteMelding, String(nu));

  const alle = opties?.trades ?? await laadLijst<PortfolioTrade>(SLEUTELS.portfolio);
  // Een eToro-positie waarvan de sluiting al gemeld (of stil afgedaan, zie sluitingen.ts) is, staat
  // in het opgeslagen portfolio soms nog open: alleen de voorgrond-sync werkt het portfolio bij.
  // Zonder deze filter kreeg de gebruiker vanuit de achtergrond nog "momentum vlakt af" over een
  // positie die eToro al gesloten heeft.
  const gesloten = new Set(await laadLijst<number>(SLEUTELS.gemeldeSluitingen));
  const open = alle.filter(t => t.status === 'open'
    && !(t.bron === 'etoro' && t.etoroPositionID !== undefined && gesloten.has(t.etoroPositionID)));

  const state = leesSuppressie(await laadObject<Record<string, unknown>>(SLEUTELS.meldingSuppressie));

  const kandidaten: Melding[] = [];
  for (const trade of open) {
    try {
      kandidaten.push(...await beoordeelTrade(trade));
    } catch {
      // Eén coin die geen data geeft mag de rest van de ronde niet meeslepen.
    }
  }

  try {
    kandidaten.push(...await beoordeelMarkt(open, nu));
  } catch {
    // Een mislukte marktscan is geen reden om de trade-meldingen hierboven te laten vallen.
  }

  // Alles wat de suppressie doorlaat gaat mee in één melding. Er staat bewust geen plafond meer op:
  // dat knipte de lijst af zonder de rest weg te gooien, dus kandidaat vier en verder waren de
  // volgende ronde nog steeds niet gesuppresseerd en kwamen vijf minuten later alsnog binnen, met
  // exact dezelfde gebundelde titel. Dat was de "dubbele" meldingen. De bundeling voorkomt de
  // waslijst al en de cooldown hierboven begrenst de frequentie.
  const teVersturen = kandidaten.filter(m => magSturen(state, m.sleutel, nu));

  let verstuurd = 0;
  const bijgewerkt: SuppressieState = { ...state };
  if (teVersturen.length > 0) {
    // Eén gebundelde melding in plaats van een stapel losse: dat voorkomt de waslijst en blijft
    // ook zonder native Android-groepering (expo-notifications biedt geen groupKey-optie) rustig.
    const [eerste] = teVersturen;
    const titel = teVersturen.length === 1 ? eerste.titel : `Kader heeft ${teVersturen.length} updates voor je`;
    const tekst = teVersturen.length === 1
      ? eerste.tekst
      : `${teVersturen.map(m => m.titel).join(', ')}. Open de app voor details.`;
    // Alleen een losse melding krijgt een doel mee voor de tik: een bundel gaat over meerdere
    // trades, die opent gewoon de app en staat per regel in het meldingenlog.
    if (await stuurTradeMelding(titel, tekst, teVersturen.length === 1 ? eerste.doel : undefined)) {
      for (const melding of teVersturen) bijgewerkt[melding.sleutel] = nu;
      verstuurd = teVersturen.length;
      await loggeMeldingen(teVersturen, nu);
    }
  }

  // Niets verstuurd (geen kandidaten of het versturen mislukte): de claim hierboven was voorbarig,
  // teruggezet zodat een lege ronde het uur niet opbrandt en een echte melding niet tot 55 minuten
  // later hoeft te wachten op de volgende voorgrond-poll.
  if (verstuurd === 0) {
    await bewaarTekst(SLEUTELS.laatsteMelding, String(laatsteMelding));
  }

  const levend = new Set(
    open.flatMap(t => [sleutelVoor(t.id, 'trekStopAan'), sleutelVoor(t.id, 'afbouwen')]),
  );
  await bewaarObject(SLEUTELS.meldingSuppressie, snoei(bijgewerkt, levend, nu));

  return verstuurd;
}
