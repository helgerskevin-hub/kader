import { PortfolioTrade } from '../state/portfolioTypes';
import { drempelBijnaOpDoel } from '../state/advies';
import { laadLijst, laadObject, bewaarObject, laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import { haalData } from '../engine/marketData';
import { scoorCandles, analyseerMarkt } from '../engine/analyzer';
import { macd } from '../engine/indicators';
import { fmtPrijs } from '../engine/format';
import { stuurTradeMelding } from './meldingen';

// Let op: PortfolioTrade heeft geen richting-veld, en de hele advies-logica in de app gaat uit van
// long (stop onder de entry, doel erboven). Deze checks doen dat ook. Trades die niet aan die vorm
// voldoen worden overgeslagen in plaats van verkeerd geadviseerd; shorts zijn een aparte uitbreiding.

type TriggerType = 'verhoogTP' | 'trekStopAan' | 'sterkeKoop';

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

interface Melding {
  sleutel: string;
  titel: string;
  tekst: string;
}

// Beoordeelt één open trade op verse candles. Retourneert de meldingen die op grond van de markt
// terecht zijn; de suppressie beslist daarna pas of ze ook echt verstuurd worden.
async function beoordeelTrade(trade: PortfolioTrade): Promise<Melding[]> {
  if (trade.stopLoss <= 0 || trade.takeProfit <= 0) return [];
  // Niet-long (doel onder entry) valt buiten wat deze logica kan beoordelen.
  if (trade.takeProfit <= trade.entryPrijs) return [];

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

  const meldingen: Melding[] = [];

  // Doel in zicht en het momentum draagt nog: voorstel om het doel op te rekken naar het verse
  // ATR-doel. Alleen als dat hoger ligt dan het huidige doel, anders is het geen verhoging.
  const bijnaOpDoel = koers > drempelBijnaOpDoel(trade.entryPrijs, trade.takeProfit);
  const momentumSterk = vers.macdBullish && histogramStijgt;
  if (bijnaOpDoel && momentumSterk && koers < trade.takeProfit && vers.takeProfit > trade.takeProfit) {
    meldingen.push({
      sleutel: sleutelVoor(trade.id, 'verhoogTP'),
      titel: `${trade.symbool} nadert je doel`,
      tekst: `De koers staat op ${fmtPrijs(koers)}, dicht bij je doel van ${fmtPrijs(trade.takeProfit)}, en het momentum is nog sterk. Overweeg je doel te verhogen naar ${fmtPrijs(vers.takeProfit)}.`,
    });
  }

  // In winst maar het momentum vlakt af: stop aantrekken tot break-even of een ATR onder de koers,
  // welke van die twee het hoogst is. Alleen melden als dat de stop echt omhoog brengt.
  const inWinst = koers > trade.entryPrijs;
  const momentumVlaktAf = !histogramStijgt;
  if (inWinst && momentumVlaktAf) {
    const voorstel = Math.max(trade.entryPrijs, koers - vers.atr);
    if (voorstel > trade.stopLoss && voorstel < koers) {
      meldingen.push({
        sleutel: sleutelVoor(trade.id, 'trekStopAan'),
        titel: `${trade.symbool}: momentum vlakt af`,
        tekst: `Je staat in winst (koers ${fmtPrijs(koers)}), maar het momentum neemt af. Overweeg je stop te verhogen van ${fmtPrijs(trade.stopLoss)} naar ${fmtPrijs(voorstel)} om winst vast te zetten.`,
      });
    }
  }

  return meldingen;
}

// Zoekt nieuwe, heel sterke koopsignalen. Leunt bewust op analyseerMarkt en niet op een eigen scan:
// die past de marktklimaat-poort al toe, dus in een ongunstig klimaat zwijgt dit vanzelf, net als
// het Marktscherm. De lat is high conviction, de sterkste bucket uit de backtest: alleen daarvoor
// is het te rechtvaardigen iemand een pushmelding te sturen.
async function beoordeelSterkeKoop(openSymbolen: Set<string>, nu: number): Promise<Melding[]> {
  const laatst = await laadTijdstip(SLEUTELS.laatsteSterkeKoopScan);
  if (nu - laatst < STERKE_KOOP_SCAN_VENSTER_MS) return [];
  // Claimen vóór de scan, niet erna: een mislukte scan brandt het venster op, maar zo kan een
  // tweede aanroeper er niet naast gaan draaien.
  await bewaarTekst(SLEUTELS.laatsteSterkeKoopScan, String(nu));

  const { trades } = await analyseerMarkt({ topN: 10 });
  return trades
    .filter(t => t.highConviction && t.signaal === 'KOOP' && !openSymbolen.has(t.symbool))
    .slice(0, MAX_KOOP_MELDINGEN)
    .map(t => ({
      sleutel: sleutelVoor(t.symbool, 'sterkeKoop'),
      titel: `Sterk koopsignaal: ${t.symbool}`,
      tekst: `${t.symbool} scoort ${t.score} van de 100 (${t.redenen.join(', ')}). Entry ${fmtPrijs(t.entry)}, stop ${fmtPrijs(t.stopLoss)}, doel ${fmtPrijs(t.takeProfit)}.`,
    }));
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
  const nu = Date.now();

  // De rem staat bewust vóór alles: binnen het uur mag er toch niets gestuurd worden, dus dan
  // hoeven we ook geen candles of marktscan op te halen. Dit is meteen wat de voorgrond-poll en de
  // achtergrondtaak uit elkaar houdt als ze elkaar overlappen: de tweede valt hier af, nog voor hij
  // de suppressie-state kan lezen die de eerste zo gaat overschrijven.
  if (nu - await laadTijdstip(SLEUTELS.laatsteMelding) < MELDING_COOLDOWN_MS) return 0;

  const alle = opties?.trades ?? await laadLijst<PortfolioTrade>(SLEUTELS.portfolio);
  const open = alle.filter(t => t.status === 'open');

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
    const openSymbolen = new Set(open.map(t => t.symbool));
    kandidaten.push(...await beoordeelSterkeKoop(openSymbolen, nu));
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
    if (await stuurTradeMelding(titel, tekst)) {
      for (const melding of teVersturen) bijgewerkt[melding.sleutel] = nu;
      await bewaarTekst(SLEUTELS.laatsteMelding, String(nu));
      verstuurd = teVersturen.length;
    }
  }

  const levend = new Set(
    open.flatMap(t => [sleutelVoor(t.id, 'verhoogTP'), sleutelVoor(t.id, 'trekStopAan')]),
  );
  await bewaarObject(SLEUTELS.meldingSuppressie, snoei(bijgewerkt, levend, nu));

  return verstuurd;
}
