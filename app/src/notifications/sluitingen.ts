// Meldingen als een stop-loss of doel geraakt is. Twee soorten, met elk een eigen bron:
//
//  1. eToro-posities: eToro sluit die zelf op de stop of het doel. Kader ziet dat pas achteraf, als
//     de positie in de handelshistorie opduikt. meldEtoroSluitingen vergelijkt wat Kader als open
//     kende met wat eToro gesloten meldt, en meldt alleen die overgang.
//  2. Handmatige trades: daar sluit niemand iets. checkNiveausGeraakt kijkt naar de live koers en
//     zegt het als de stop of het doel geraakt is, zodat de gebruiker hem zelf kan sluiten.
//
// Staat bewust los van checkOpenTrades en dus buiten de uur-cooldown daar, om dezelfde reden als de
// prijsalerts: een geraakte stop is geen suggestie van Kader die een uur kan wachten, dat is iets
// wat al gebeurd is. De rem zit hier in de ontdubbeling: elke sluiting en elk niveau komt maar één
// keer langs.
//
// Draait ook in de achtergrondtaak, buiten de React-tree, dus geen hooks en geen context.
import { PortfolioTrade, bronVan, tekenVan } from '../state/portfolioTypes';
import { bepaalEtoroSluitReden, niveauGeraakt } from '../state/sluitReden';
import { GeplaatsteOrder, OPVRAAG_VENSTER_MS } from '../state/orderUitkomsten';
import { OnbekendeOrder } from '../state/lopendeOrders';
import { actieveSleutels } from '../state/etoroSleutels';
import { meldingenAan } from '../state/meldingVoorkeur';
import { laadLijst, bewaarLijst, SLEUTELS } from '../storage/opslag';
import { importeerEtoroAlles } from '../engine/etoro';
import { haalLaatstePrijzen } from '../engine/marketData';
import { fmtPct, fmtPrijs, fmtResultaatUsd } from '../engine/format';
import { stuurTradeMelding } from './meldingen';
import { Melding, loggeMeldingen } from './tradeChecks';

// Genoeg om elke sluiting van het afgelopen jaar te onthouden bij normaal gebruik, en klein genoeg
// om bij elke check in één keer uit AsyncStorage te lezen. Een ID dat eruit valt is zo oud dat hij
// nooit meer als "net gesloten" langs kan komen: daarvoor moet hij lokaal nog open staan.
const MAX_GEMELDE_SLUITINGEN = 200;

// Orderstatussen waarbij er niets verkocht is (geweigerd, geannuleerd, verlopen). Zo'n verkoop van
// Kader telt niet als eigen sluiting: sluit eToro de positie daarna alsnog op de stop, dan is dat
// wel degelijk nieuws.
const NIETS_VERKOCHT = new Set([4, 7, 8]);

// Een sluiting ouder dan twee dagen is geen nieuws meer: wie de app een week niet opende, krijgt
// anders bij de eerste sync een stapel "stop-loss geraakt" over wat allang voorbij is en toch al in
// zijn historie staat. Zulke posities gaan wel stil in gemeldeSluitingen, zodat de achtergrondtaak
// ze niet elke ronde opnieuw afweegt.
const MAX_LEEFTIJD_MS = 48 * 60 * 60 * 1000;

const omgevingVan = (t: PortfolioTrade) => t.etoroOmgeving ?? 'real';

// Eén run tegelijk. De voorgrond-sync, de prijs-poll en de achtergrondtaak kunnen elkaar overlappen,
// en elke run leest eerst wat al gemeld is en schrijft dat pas na het versturen bij. Twee runs naast
// elkaar zien dan allebei "nog niet gemeld" en sturen dezelfde melding twee keer. De keten zet ze
// achter elkaar; een mislukte run breekt de keten niet.
let keten: Promise<unknown> = Promise.resolve();
function naElkaar<T>(werk: () => Promise<T>): Promise<T> {
  const resultaat = keten.then(werk, werk);
  keten = resultaat.catch(() => {});
  return resultaat;
}

// Meldingsleutels ('sluiting:<id>', 'niveau:...') die nu verstuurd worden maar nog niet als gemeld
// op schijf staan. Tweede slot naast de keten: gevuld vóór de await op het versturen, zodat ook een
// aanroep die er toch naast loopt ze overslaat.
const inBehandeling = new Set<string>();

/**
 * Heeft Kader deze positie zelf verkocht? Dan is de sluiting geen stop of doel van eToro, ook al
 * ligt de exitkoers toevallig vlak bij een niveau (wie verkoopt als het doel bijna bereikt is, doet
 * precies dat).
 *
 * Een geplaatste verkoop sinds deze versie draagt het positionID en matcht exact. Oudere records
 * hebben alleen het symbool; daarvoor geldt symbool plus omgeving binnen de afgelopen 24 uur. Een
 * verkoop zonder antwoord van eToro (onbekende order) telt ook mee, die heeft wel een positionId.
 */
function eigenVerkoop(
  trade: PortfolioTrade,
  geplaatst: GeplaatsteOrder[],
  onbekend: OnbekendeOrder[],
  nu: number,
): boolean {
  const omgeving = omgevingVan(trade);
  const viaGeplaatst = geplaatst.some(o => {
    if (o.soort !== 'verkoop' || o.omgeving !== omgeving) return false;
    if (o.status !== undefined && NIETS_VERKOCHT.has(o.status.id)) return false;
    if (typeof o.positionId === 'number') return o.positionId === trade.etoroPositionID;
    return o.symbool === trade.symbool && nu - o.tijd < OPVRAAG_VENSTER_MS;
  });
  return viaGeplaatst || onbekend.some(
    o => o.soort === 'verkoop' && o.omgeving === omgeving && o.positionId === trade.etoroPositionID,
  );
}

// Resultaat in procenten van de inleg, richtinggevoelig. Liever eToro's eigen entry (de koers
// waarop hij echt gevuld is) dan de lokale, die bij een oude handmatig bijgewerkte regel kan afwijken.
function resultaatPct(lokaal: PortfolioTrade, gesloten: PortfolioTrade, exit: number): number | null {
  const entry = gesloten.entryPrijs > 0 ? gesloten.entryPrijs : lokaal.entryPrijs;
  if (!(entry > 0)) return null;
  return tekenVan(lokaal) * (exit - entry) / entry * 100;
}

function bundel(meldingen: Melding[], meervoudTitel: string, meervoudStaart: string): { titel: string; tekst: string } {
  const [eerste] = meldingen;
  return meldingen.length === 1
    ? { titel: eerste.titel, tekst: eerste.tekst }
    : { titel: meervoudTitel, tekst: `${meldingen.map(m => m.titel).join(', ')}. ${meervoudStaart}` };
}

/**
 * Meldt de eToro-posities die eToro zelf op de stop-loss of het doel gesloten heeft.
 *
 * Alleen overgangen: een positie die Kader als open kende (vorigOpen, bron eToro, status open) en
 * die nu met hetzelfde positionID en dezelfde omgeving in eToro's historie staat. Een jaar historie
 * die bij het koppelen binnenkomt levert dus niets op, want die posities stonden lokaal nooit open.
 *
 * De reden komt eerst uit eToro's stop en doel in de historieregel (wat er bij het sluiten echt
 * stond), met de lokale niveaus als terugval, zie bepaalEtoroSluitReden. Handmatig gesloten, door
 * Kader zelf verkocht of langer dan 48 uur geleden gesloten: geen melding.
 *
 * Een positie wordt pas als gemeld weggeschreven nadat het versturen gelukt is, dezelfde volgorde
 * als bij checkPrijsalerts: andersom kan een app-kill ertussen de melding stilletjes opeten. Het
 * ergste geval is nu dezelfde melding twee keer.
 *
 * @returns Het aantal gemelde sluitingen.
 */
export function meldEtoroSluitingen(vorigOpen: PortfolioTrade[], gesloten: PortfolioTrade[]): Promise<number> {
  return naElkaar(() => meldEtoroSluitingenNu(vorigOpen, gesloten));
}

async function meldEtoroSluitingenNu(vorigOpen: PortfolioTrade[], gesloten: PortfolioTrade[]): Promise<number> {
  if (!await meldingenAan()) return 0;

  const kandidaten = vorigOpen.filter(
    t => bronVan(t) === 'etoro' && t.status === 'open' && typeof t.etoroPositionID === 'number',
  );
  if (kandidaten.length === 0 || gesloten.length === 0) return 0;

  const perPositie = new Map<string, PortfolioTrade>();
  for (const g of gesloten) {
    if (typeof g.etoroPositionID === 'number') perPositie.set(`${omgevingVan(g)}:${g.etoroPositionID}`, g);
  }
  const overgangen = kandidaten
    .map(lokaal => ({ lokaal, uitEtoro: perPositie.get(`${omgevingVan(lokaal)}:${lokaal.etoroPositionID}`) }))
    .filter((p): p is { lokaal: PortfolioTrade; uitEtoro: PortfolioTrade } => p.uitEtoro !== undefined);
  if (overgangen.length === 0) return 0;

  const gemeld = await laadLijst<number>(SLEUTELS.gemeldeSluitingen);
  const alGemeld = new Set(gemeld);
  const [geplaatst, onbekend] = await Promise.all([
    laadLijst<GeplaatsteOrder>(SLEUTELS.geplaatsteOrders),
    laadLijst<OnbekendeOrder>(SLEUTELS.onbekendeOrders),
  ]);
  const nu = Date.now();

  const meldingen: Melding[] = [];
  const positieIds: number[] = [];
  // Te oude sluitingen: geen melding, wel onthouden (zie MAX_LEEFTIJD_MS).
  const teOud: number[] = [];
  for (const { lokaal, uitEtoro } of overgangen) {
    const positieId = lokaal.etoroPositionID as number;
    if (alGemeld.has(positieId) || inBehandeling.has(`sluiting:${positieId}`)) continue;
    const exit = uitEtoro.exitPrijs;
    if (typeof exit !== 'number' || !(exit > 0)) continue;
    if (typeof uitEtoro.slotTijd === 'number' && nu - uitEtoro.slotTijd > MAX_LEEFTIJD_MS) {
      teOud.push(positieId);
      continue;
    }
    if (eigenVerkoop(lokaal, geplaatst, onbekend, nu)) continue;

    // eToro's niveaus van het moment van sluiten eerst, de lokale als terugval: zie sluitReden.ts.
    const reden = bepaalEtoroSluitReden(lokaal, uitEtoro, exit);
    if (reden === 'handmatig') continue;

    const pct = resultaatPct(lokaal, uitEtoro, exit);
    const pctTekst = pct !== null ? fmtPct(pct) : null;
    const resultaat = typeof uitEtoro.resultaatUsd === 'number'
      ? ` Resultaat ${fmtResultaatUsd(uitEtoro.resultaatUsd)}${pctTekst ? ` (${pctTekst})` : ''}.`
      : pctTekst ? ` Resultaat ${pctTekst}.` : '';

    meldingen.push({
      sleutel: `sluiting:${positieId}`,
      doel: { soort: 'trade', tradeId: lokaal.id, symbool: lokaal.symbool },
      titel: reden === 'stop' ? `${lokaal.symbool}: stop-loss geraakt` : `${lokaal.symbool}: doel gehaald`,
      tekst: `eToro heeft je positie gesloten op ${fmtPrijs(exit)}.${resultaat}`,
    });
    positieIds.push(positieId);
  }
  const bewaarGemeld = async (erbij: number[]) => {
    if (erbij.length > 0) {
      await bewaarLijst(SLEUTELS.gemeldeSluitingen, [...gemeld, ...erbij].slice(-MAX_GEMELDE_SLUITINGEN));
    }
  };
  if (meldingen.length === 0) {
    await bewaarGemeld(teOud);
    return 0;
  }

  const { titel, tekst } = bundel(meldingen, `${meldingen.length} posities gesloten door eToro`, 'Open de app voor details.');
  for (const m of meldingen) inBehandeling.add(m.sleutel);
  try {
    if (!await stuurTradeMelding(titel, tekst)) {
      await bewaarGemeld(teOud);
      return 0;
    }
    await bewaarGemeld([...teOud, ...positieIds]);
  } finally {
    for (const m of meldingen) inBehandeling.delete(m.sleutel);
  }
  await loggeMeldingen(meldingen, nu);
  return meldingen.length;
}

/**
 * De achtergrondvariant van de sluitingsmelding: haalt zelf de eToro-historie op en vergelijkt die
 * met het opgeslagen portfolio.
 *
 * Schrijft het portfolio NIET bij. Dat doet de sync op de voorgrond, en twee schrijvers op dezelfde
 * sleutel zouden elkaars wijzigingen overschrijven. De gedeelde lijst gemeldeSluitingen zorgt dat
 * de voorgrond dezelfde sluiting daarna niet nog eens meldt.
 *
 * Kost alleen verzoeken als er iets te bewaken valt: zonder koppeling of zonder open eToro-positie
 * in de actieve omgeving gaat er niets de deur uit.
 *
 * @returns Het aantal gemelde sluitingen.
 */
export async function checkEtoroSluitingen(): Promise<number> {
  if (!await meldingenAan()) return 0;
  const sleutels = await actieveSleutels();
  if (!sleutels) return 0;
  const omgeving = sleutels.omgeving ?? 'real';

  const portfolio = await laadLijst<PortfolioTrade>(SLEUTELS.portfolio);
  const open = portfolio.filter(
    t => bronVan(t) === 'etoro' && t.status === 'open' && omgevingVan(t) === omgeving,
  );
  if (open.length === 0) return 0;

  const { historie } = await importeerEtoroAlles(sleutels);
  return meldEtoroSluitingen(open, historie.trades);
}

// De prijs van het niveau hoort in de sleutel: verzet de gebruiker na een melding zijn stop, dan is
// het nieuwe niveau een nieuwe afspraak en mag dat opnieuw melden. Het trade-id blijft het tweede
// deel, daarop ruimt checkNiveausGeraakt op.
const niveauSleutel = (tradeId: string, niveau: 'stop' | 'doel', prijs: number) => `niveau:${tradeId}:${niveau}:${prijs}`;

/**
 * Meldt handmatige trades waarvan de live koers de stop of het doel geraakt heeft.
 *
 * Kader verkoopt die niet zelf, dus de melding zegt wat de gebruiker moet doen. Per trade per
 * niveau één keer: een koers die rond de stop blijft hangen zou anders elke ronde opnieuw melden.
 * Sleutels van trades die niet meer open staan worden opgeruimd, zodat de lijst niet blijft groeien.
 *
 * @param opties.trades De trades. De voorgrond geeft de lijst uit het geheugen mee; de
 *   achtergrondtaak laat 'm hier uit AsyncStorage laden.
 * @returns Het aantal gemelde niveaus.
 */
export function checkNiveausGeraakt(opties?: { trades?: PortfolioTrade[] }): Promise<number> {
  return naElkaar(() => checkNiveausGeraaktNu(opties));
}

async function checkNiveausGeraaktNu(opties?: { trades?: PortfolioTrade[] }): Promise<number> {
  if (!await meldingenAan()) return 0;
  const alle = opties?.trades ?? await laadLijst<PortfolioTrade>(SLEUTELS.portfolio);
  const open = alle.filter(
    t => bronVan(t) === 'handmatig' && t.status === 'open' && (t.stopLoss > 0 || t.takeProfit > 0),
  );

  const opgeslagen = await laadLijst<string>(SLEUTELS.gemeldeNiveaus);
  const openIds = new Set(open.map(t => t.id));
  // Het tweede deel is het trade-id; nieuweId() levert base36 zonder dubbele punten.
  const levend = opgeslagen.filter(sleutel => openIds.has(sleutel.split(':')[1]));
  const bewaarOpgeschoond = async () => {
    if (levend.length !== opgeslagen.length) await bewaarLijst(SLEUTELS.gemeldeNiveaus, levend);
  };
  if (open.length === 0) {
    await bewaarOpgeschoond();
    return 0;
  }

  const prijzen = await haalLaatstePrijzen([...new Set(open.map(t => t.symbool))]);
  const alGemeld = new Set(levend);

  const meldingen: Melding[] = [];
  for (const trade of open) {
    const koers = prijzen[trade.symbool];
    if (koers === undefined) continue;
    const niveau = niveauGeraakt(trade, koers);
    if (niveau === null) continue;
    const stop = niveau === 'stop';
    const sleutel = niveauSleutel(trade.id, niveau, stop ? trade.stopLoss : trade.takeProfit);
    if (alGemeld.has(sleutel) || inBehandeling.has(sleutel)) continue;

    meldingen.push({
      sleutel,
      doel: { soort: 'trade', tradeId: trade.id, symbool: trade.symbool },
      titel: stop ? `${trade.symbool}: je stop-loss is geraakt` : `${trade.symbool}: je doel is geraakt`,
      tekst: `Koers ${fmtPrijs(koers)}, je ${stop ? 'stop' : 'doel'} stond op ${fmtPrijs(stop ? trade.stopLoss : trade.takeProfit)}. Kader verkoopt handmatige trades niet zelf: sluit hem op je platform en daarna in Portfolio.`,
    });
  }
  if (meldingen.length === 0) {
    await bewaarOpgeschoond();
    return 0;
  }

  const { titel, tekst } = bundel(
    meldingen,
    `Stop of doel geraakt bij ${meldingen.length} trades`,
    'Kader verkoopt handmatige trades niet zelf: sluit ze op je platform en daarna in Portfolio.',
  );
  // Eerst sturen, dan pas wegschrijven dat het gemeld is: zie meldEtoroSluitingen.
  for (const m of meldingen) inBehandeling.add(m.sleutel);
  try {
    if (!await stuurTradeMelding(titel, tekst)) {
      await bewaarOpgeschoond();
      return 0;
    }
    await bewaarLijst(SLEUTELS.gemeldeNiveaus, [...levend, ...meldingen.map(m => m.sleutel)]);
  } finally {
    for (const m of meldingen) inBehandeling.delete(m.sleutel);
  }
  await loggeMeldingen(meldingen, Date.now());
  return meldingen.length;
}
