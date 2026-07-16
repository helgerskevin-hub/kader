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

interface SuppressieRegel {
  // Epoch-ms van de laatst verstuurde melding voor deze trade + trigger.
  tijd: number;
  // Het niveau dat we toen voorstelden. Schuift dat meer dan NIVEAU_DRIFT op, dan is het nieuws
  // genoeg veranderd om binnen het herhaalvenster tóch opnieuw te melden.
  niveau: number;
}

type SuppressieState = Record<string, SuppressieRegel>;

// Dezelfde melding hooguit eens per zes uur, tenzij het voorgestelde niveau meer dan 2% verschuift.
const HERHAAL_VENSTER_MS = 6 * 60 * 60 * 1000;
const NIVEAU_DRIFT = 0.02;

// De sterke-koop-scan loopt over het hele universum en is daarmee veruit de duurste stap. Hooguit
// één keer per uur, ongeacht hoe vaak de check verder draait.
const STERKE_KOOP_SCAN_VENSTER_MS = 60 * 60 * 1000;

// Hoeveel nieuwe koopsignalen we maximaal in één ronde melden. Zonder deze grens kan een sterke
// marktdag tien meldingen tegelijk opleveren en dat leest niemand.
const MAX_KOOP_MELDINGEN = 3;

function sleutelVoor(id: string, trigger: TriggerType): string {
  return `${id}:${trigger}`;
}

function magSturen(state: SuppressieState, sleutel: string, niveau: number, nu: number): boolean {
  const vorig = state[sleutel];
  if (!vorig) return true;
  if (nu - vorig.tijd > HERHAAL_VENSTER_MS) return true;
  if (vorig.niveau > 0 && Math.abs(niveau - vorig.niveau) / vorig.niveau > NIVEAU_DRIFT) return true;
  return false;
}

// Ruimt regels op die bij een trade horen die niet meer open staat, zodat de state niet eeuwig
// blijft groeien met gesloten trades.
function snoei(state: SuppressieState, levendeSleutels: Set<string>, nu: number): SuppressieState {
  const schoon: SuppressieState = {};
  for (const [sleutel, regel] of Object.entries(state)) {
    const verlopen = nu - regel.tijd > HERHAAL_VENSTER_MS;
    if (levendeSleutels.has(sleutel) || !verlopen) schoon[sleutel] = regel;
  }
  return schoon;
}

interface Melding {
  sleutel: string;
  niveau: number;
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
      niveau: vers.takeProfit,
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
        niveau: voorstel,
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
  const laatst = Number(await laadTekst(SLEUTELS.laatsteSterkeKoopScan, '0'));
  if (Number.isFinite(laatst) && nu - laatst < STERKE_KOOP_SCAN_VENSTER_MS) return [];
  await bewaarTekst(SLEUTELS.laatsteSterkeKoopScan, String(nu));

  const { trades } = await analyseerMarkt({ topN: 10 });
  return trades
    .filter(t => t.highConviction && t.signaal === 'KOOP' && !openSymbolen.has(t.symbool))
    .slice(0, MAX_KOOP_MELDINGEN)
    .map(t => ({
      sleutel: sleutelVoor(t.symbool, 'sterkeKoop'),
      niveau: t.entry,
      titel: `Sterk koopsignaal: ${t.symbool}`,
      tekst: `${t.symbool} scoort ${t.score} van de 100 (${t.redenen.join(', ')}). Entry ${fmtPrijs(t.entry)}, stop ${fmtPrijs(t.stopLoss)}, doel ${fmtPrijs(t.takeProfit)}.`,
    }));
}

/**
 * Checkt de open trades en stuurt waar nodig een melding. Wordt aangeroepen door de achtergrondtaak
 * en, wat vaker maar afgeknepen, door de prijs-poll op de voorgrond. Beide delen dezelfde
 * suppressie-state, zodat dezelfde melding niet twee keer binnenkomt.
 *
 * @param opties.trades De open trades. De voorgrond geeft de lijst uit het geheugen mee; de
 *   achtergrondtaak draait buiten de React-tree en laat 'm hier uit AsyncStorage laden.
 * @returns Het aantal verstuurde meldingen.
 */
export async function checkOpenTrades(opties?: { trades?: PortfolioTrade[] }): Promise<number> {
  const alle = opties?.trades ?? await laadLijst<PortfolioTrade>(SLEUTELS.portfolio);
  const open = alle.filter(t => t.status === 'open');

  const nu = Date.now();
  const state = await laadObject<SuppressieState>(SLEUTELS.meldingSuppressie) ?? {};

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

  let verstuurd = 0;
  const bijgewerkt: SuppressieState = { ...state };
  for (const melding of kandidaten) {
    if (!magSturen(state, melding.sleutel, melding.niveau, nu)) continue;
    const gelukt = await stuurTradeMelding(melding.titel, melding.tekst);
    if (!gelukt) break; // geen permissie: de rest proberen heeft ook geen zin
    bijgewerkt[melding.sleutel] = { tijd: nu, niveau: melding.niveau };
    verstuurd += 1;
  }

  const levend = new Set(
    open.flatMap(t => [sleutelVoor(t.id, 'verhoogTP'), sleutelVoor(t.id, 'trekStopAan')]),
  );
  await bewaarObject(SLEUTELS.meldingSuppressie, snoei(bijgewerkt, levend, nu));

  return verstuurd;
}
