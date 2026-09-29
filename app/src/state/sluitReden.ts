// Waarom is een positie gesloten, en is een niveau geraakt? Twee kleine beslissingen die de
// sluitingsmeldingen (notifications/sluitingen.ts) nodig hebben.
//
// Bewust puur (geen React Native, geen AsyncStorage, geen netwerk), net als lopendeOrders.ts, zodat
// de regels los te draaien zijn met de self-check onderaan.
import { PortfolioTrade, richtingVan } from './portfolioTypes';

export type SluitReden = 'stop' | 'doel' | 'handmatig';

// Een procent speling bij het herkennen van een sluiting door eToro. eToro sluit op zijn eigen
// koers, niet exact op het niveau: een stop die in een snelle daling geraakt wordt vult vaak een
// stuk verder (slippage), en een doel kan net iets eronder gevuld zijn door de spread. Zonder deze
// speling zou een echte stop-loss als "handmatig gesloten" lezen en bleef de melding weg.
const SPELING = 0.01;

/**
 * Bepaalt of een gesloten positie door de stop-loss, door het doel of handmatig gesloten is.
 *
 * Voorbij de stop telt altijd als stop, hoe ver ook: dat is precies wat slippage doet. Aan de kant
 * van het doel idem. Een niveau van 0 (of ontbrekend) telt niet mee, want dan stond er niets.
 * Kunnen beide kloppen (alleen bij rare data, bijvoorbeeld een stop en doel vlak bij elkaar), dan
 * wint het niveau dat het dichtst bij de exitkoers ligt.
 */
export function bepaalSluitReden(trade: PortfolioTrade, exitPrijs: number): SluitReden {
  if (!Number.isFinite(exitPrijs) || exitPrijs <= 0) return 'handmatig';
  const short = richtingVan(trade) === 'short';
  const stop = trade.stopLoss > 0 ? trade.stopLoss : 0;
  const doel = trade.takeProfit > 0 ? trade.takeProfit : 0;

  // Long: de stop ligt onder de entry, dus alles tot net boven de stop is "stop geraakt". Short
  // precies gespiegeld: de stop ligt erboven.
  const stopGeraakt = stop > 0 && (short ? exitPrijs >= stop * (1 - SPELING) : exitPrijs <= stop * (1 + SPELING));
  const doelGeraakt = doel > 0 && (short ? exitPrijs <= doel * (1 + SPELING) : exitPrijs >= doel * (1 - SPELING));

  if (stopGeraakt && doelGeraakt) {
    return Math.abs(exitPrijs - stop) <= Math.abs(exitPrijs - doel) ? 'stop' : 'doel';
  }
  if (stopGeraakt) return 'stop';
  if (doelGeraakt) return 'doel';
  return 'handmatig';
}

/**
 * Staat de koers op of voorbij de stop of het doel van deze trade? Zonder speling: dit is voor
 * handmatige trades, waar Kader alleen de live koers kent en niemand iets gesloten heeft. Een
 * procent speling zou hier "je stop is geraakt" melden terwijl hij er nog boven staat.
 */
export function niveauGeraakt(trade: PortfolioTrade, koers: number): 'stop' | 'doel' | null {
  if (!Number.isFinite(koers) || koers <= 0) return null;
  const short = richtingVan(trade) === 'short';
  if (trade.stopLoss > 0 && (short ? koers >= trade.stopLoss : koers <= trade.stopLoss)) return 'stop';
  if (trade.takeProfit > 0 && (short ? koers <= trade.takeProfit : koers >= trade.takeProfit)) return 'doel';
  return null;
}

if (require.main === module) {
  // console.assert gooit niet in Node en zet de exitcode niet; zonder deze wrapper zou dit bestand
  // "geslaagd" printen terwijl de regels stuk zijn.
  let missers = 0;
  const origineleAssert = console.assert.bind(console);
  console.assert = ((voorwaarde?: boolean, ...rest: unknown[]) => {
    if (!voorwaarde) missers++;
    origineleAssert(voorwaarde, ...rest);
  }) as typeof console.assert;

  const trade = (over: Partial<PortfolioTrade> = {}): PortfolioTrade => ({
    id: 'x', symbool: 'BTC', naam: 'Bitcoin', entryPrijs: 100, stopLoss: 90, takeProfit: 130, rr: 3,
    datum: '1 jan 2026', status: 'open', ...over,
  });
  const long = trade();
  const short = trade({ richting: 'short', stopLoss: 110, takeProfit: 70 });

  // Long
  console.assert(bepaalSluitReden(long, 90) === 'stop', 'long: exact op de stop is stop');
  console.assert(bepaalSluitReden(long, 90.8) === 'stop', 'long: binnen 1% boven de stop is stop');
  console.assert(bepaalSluitReden(long, 80) === 'stop', 'long: slippage ver voorbij de stop is nog steeds stop');
  console.assert(bepaalSluitReden(long, 130) === 'doel', 'long: exact op het doel is doel');
  console.assert(bepaalSluitReden(long, 128.8) === 'doel', 'long: binnen 1% onder het doel is doel');
  console.assert(bepaalSluitReden(long, 140) === 'doel', 'long: voorbij het doel is doel');
  console.assert(bepaalSluitReden(long, 110) === 'handmatig', 'long: tussen stop en doel is handmatig');
  console.assert(bepaalSluitReden(long, 91) === 'handmatig', 'long: net buiten de speling is handmatig');

  // Short, gespiegeld
  console.assert(bepaalSluitReden(short, 110) === 'stop', 'short: exact op de stop is stop');
  console.assert(bepaalSluitReden(short, 120) === 'stop', 'short: slippage boven de stop is stop');
  console.assert(bepaalSluitReden(short, 70) === 'doel', 'short: op het doel is doel');
  console.assert(bepaalSluitReden(short, 60) === 'doel', 'short: onder het doel is doel');
  console.assert(bepaalSluitReden(short, 95) === 'handmatig', 'short: ertussen is handmatig');

  // Niveau 0 telt niet
  console.assert(bepaalSluitReden(trade({ stopLoss: 0 }), 50) === 'handmatig', 'stop 0: een diepe exit is geen stop');
  console.assert(bepaalSluitReden(trade({ stopLoss: 0 }), 135) === 'doel', 'stop 0: het doel werkt nog wel');
  console.assert(bepaalSluitReden(trade({ stopLoss: 0, takeProfit: 0 }), 135) === 'handmatig', 'zonder niveaus altijd handmatig');
  console.assert(bepaalSluitReden(long, NaN) === 'handmatig', 'een onzinnige exitkoers is handmatig');

  // Beide raak (rare data): het dichtstbijzijnde niveau wint
  const krap = trade({ stopLoss: 100, takeProfit: 101 });
  console.assert(bepaalSluitReden(krap, 100.2) === 'stop', 'beide raak: dichter bij de stop is stop');
  console.assert(bepaalSluitReden(krap, 100.9) === 'doel', 'beide raak: dichter bij het doel is doel');

  // niveauGeraakt: exact, geen speling
  console.assert(niveauGeraakt(long, 90) === 'stop', 'long: op de stop is geraakt');
  console.assert(niveauGeraakt(long, 90.5) === null, 'long: net boven de stop is niet geraakt');
  console.assert(niveauGeraakt(long, 130) === 'doel', 'long: op het doel is geraakt');
  console.assert(niveauGeraakt(long, 129.9) === null, 'long: net onder het doel is niet geraakt');
  console.assert(niveauGeraakt(short, 111) === 'stop', 'short: boven de stop is geraakt');
  console.assert(niveauGeraakt(short, 69) === 'doel', 'short: onder het doel is geraakt');
  console.assert(niveauGeraakt(short, 100) === null, 'short: ertussen is niets geraakt');
  console.assert(niveauGeraakt(trade({ stopLoss: 0 }), 1) === null, 'stop 0 wordt nooit geraakt');
  console.assert(niveauGeraakt(trade({ takeProfit: 0 }), 1000) === null, 'doel 0 wordt nooit geraakt');

  if (missers > 0) {
    console.error(`sluitReden.ts self-check GEFAALD: ${missers} controle(s) klopten niet`);
    process.exit(1);
  }
  console.log('sluitReden.ts self-check geslaagd');
}
