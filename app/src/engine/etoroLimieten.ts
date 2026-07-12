// eToro weigert een order als de stop-loss te dicht bij of te ver van je entry ligt. Die grenzen
// verzinnen we niet: ze komen per instrument uit POST /api/v2/trading/info/eligibility.
//
// Dit bestand is bewust puur (geen netwerk, geen AsyncStorage): het ophalen zit in etoro.ts en het
// cachen in state/useStopLossLimiet.ts, zodat de rekenregels los te draaien zijn met de self-check
// onderaan.

// Alle velden optioneel: eToro mag er morgen een weglaten zonder dat wij crashen.
export interface EtoroLeverageConfig {
  settlementType?: string;
  direction?: string;
  leverageValues?: number[];
  allowEditStopLoss?: boolean;
  minStopLossPercentage?: number;
  maxStopLossPercentage?: number;
  defaultStopLossPercentage?: number;
}

export interface EtoroEligibility {
  instrumentId?: number;
  symbol?: string;
  leverageConfigs?: EtoroLeverageConfig[];
}

export interface StopLossLimiet {
  symbool: string;
  // false = eToro zet de stop zelf en laat 'm niet aanpassen.
  bewerkbaar: boolean;
  // Percentage van je inleg, of null als eToro geen grens meegaf.
  minPct: number | null;
  maxPct: number | null;
}

const isKoop = (richting?: string) => !richting || /buy|long/i.test(richting);

// Alleen echte, positieve getallen tellen als grens. Een 0 of een null uit de API betekent
// "geen grens", niet "stop op 0% van de entry".
const grens = (waarde: unknown): number | null =>
  typeof waarde === 'number' && isFinite(waarde) && waarde > 0 ? waarde : null;

// eToro geeft per instrument meerdere leverageConfigs terug (per hefboom en per richting). Kader
// rekent altijd zonder hefboom en altijd long, dus we zoeken de config met hefboom x1 en richting
// buy. Dat is belangrijk voor de vergelijking verderop: bij x1 is het verliespercentage van je
// inleg gelijk aan de koersdaling, bij x5 zou een stop van 2% onder de entry 10% van je inleg zijn.
export function kiesLimiet(item: EtoroEligibility): StopLossLimiet | null {
  const symbool = (item.symbol ?? '').toUpperCase();
  const configs = item.leverageConfigs ?? [];
  if (!symbool || configs.length === 0) return null;

  const config = configs.find(c => isKoop(c.direction) && c.leverageValues?.includes(1))
    ?? configs.find(c => c.leverageValues?.includes(1));
  if (!config) return null;

  return {
    symbool,
    // Ontbreekt het veld, dan gaan we ervan uit dat je 'm mag zetten: liever geen waarschuwing dan
    // een onterechte.
    bewerkbaar: config.allowEditStopLoss !== false,
    minPct: grens(config.minStopLossPercentage),
    maxPct: grens(config.maxStopLossPercentage),
  };
}

const pct = (waarde: number) => `${waarde.toFixed(1).replace('.', ',')}%`;

// Geeft een Nederlandse waarschuwingszin terug, of null als er niets aan de hand is (of als we het
// simpelweg niet weten: zonder limiet geen waarschuwing).
export function valideerStopLoss(entry: number, stop: number, limiet: StopLossLimiet | null): string | null {
  if (!limiet) return null;
  if (!isFinite(entry) || !isFinite(stop) || entry <= 0 || stop <= 0) return null;

  if (stop >= entry) {
    return `Je stop ligt op of boven de aankoopprijs. eToro accepteert voor ${limiet.symbool} alleen een stop daaronder.`;
  }

  if (!limiet.bewerkbaar) {
    return `eToro laat de stop-loss voor ${limiet.symbool} niet zelf instellen. Je houdt de standaardstop van eToro.`;
  }

  const afstand = ((entry - stop) / entry) * 100;

  if (limiet.minPct !== null && afstand < limiet.minPct) {
    return `Je stop ligt ${pct(afstand)} onder de aankoopprijs, eToro accepteert voor ${limiet.symbool} minimaal ${pct(limiet.minPct)}. Leg je stop verder weg, anders weigert eToro de order.`;
  }

  if (limiet.maxPct !== null && afstand > limiet.maxPct) {
    return `Je stop ligt ${pct(afstand)} onder de aankoopprijs, eToro accepteert voor ${limiet.symbool} maximaal ${pct(limiet.maxPct)}. Leg je stop dichterbij, anders weigert eToro de order.`;
  }

  return null;
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/etoroLimieten.ts`
if (require.main === module) {
  const ruw: EtoroEligibility = {
    instrumentId: 100000, symbol: 'BTC',
    leverageConfigs: [
      // Volgorde bewust omgedraaid: de x2-config staat vooraan, dus een naïeve [0] pakt de verkeerde.
      { direction: 'Buy', leverageValues: [2], allowEditStopLoss: true, minStopLossPercentage: 20, maxStopLossPercentage: 50 },
      { direction: 'Sell', leverageValues: [1], allowEditStopLoss: true, minStopLossPercentage: 9, maxStopLossPercentage: 9 },
      { direction: 'Buy', leverageValues: [1], allowEditStopLoss: true, minStopLossPercentage: 1, maxStopLossPercentage: 50 },
    ],
  };

  const limiet = kiesLimiet(ruw)!;
  console.assert(limiet.symbool === 'BTC', 'symbool moet BTC zijn');
  console.assert(limiet.minPct === 1 && limiet.maxPct === 50, `de x1-buy-config moet gekozen worden, was ${limiet.minPct}-${limiet.maxPct}`);
  console.assert(limiet.bewerkbaar, 'allowEditStopLoss true moet bewerkbaar zijn');

  console.assert(kiesLimiet({ symbol: 'BTC' }) === null, 'zonder leverageConfigs is er geen limiet');
  console.assert(kiesLimiet({ symbol: 'BTC', leverageConfigs: [{ leverageValues: [2] }] }) === null,
    'zonder x1-config gokken we niet met een hefboomlimiet');
  console.assert(kiesLimiet({ leverageConfigs: [{ leverageValues: [1] }] }) === null, 'zonder symbool is de limiet onbruikbaar');

  const nul = kiesLimiet({ symbol: 'ETH', leverageConfigs: [{ leverageValues: [1], minStopLossPercentage: 0 }] })!;
  console.assert(nul.minPct === null, 'een min van 0 betekent geen grens, geen stop op 0%');

  // Entry 100: stop op 99,5 is 0,5% onder de entry, dus onder eToro's minimum van 1%.
  const teDicht = valideerStopLoss(100, 99.5, limiet);
  console.assert(teDicht !== null && teDicht.includes('minimaal 1,0%'), `stop binnen de minimumafstand moet waarschuwen, was: ${teDicht}`);
  console.assert(teDicht!.includes('0,5%'), 'de eigen afstand moet in de melding staan');

  // Stop op 40 is 60% onder de entry, boven het maximum van 50%.
  const teVer = valideerStopLoss(100, 40, limiet);
  console.assert(teVer !== null && teVer.includes('maximaal 50,0%'), `stop voorbij de maximumafstand moet waarschuwen, was: ${teVer}`);

  console.assert(valideerStopLoss(100, 90, limiet) === null, '10% onder de entry valt netjes binnen 1-50%');
  console.assert(valideerStopLoss(100, 99, limiet) === null, 'precies op het minimum is nog goed');
  console.assert(valideerStopLoss(100, 50, limiet) === null, 'precies op het maximum is nog goed');

  console.assert(valideerStopLoss(100, 105, limiet) !== null, 'een stop boven de entry is altijd fout');

  // Het belangrijkste: zonder limiet (geen eToro-koppeling of een API-fout) waarschuwen we niet.
  console.assert(valideerStopLoss(100, 99.5, null) === null, 'zonder limiet geen verzonnen waarschuwing');
  console.assert(valideerStopLoss(0, 99.5, limiet) === null, 'een leeg entryveld mag niet waarschuwen');
  console.assert(valideerStopLoss(NaN, 99.5, limiet) === null, 'een onparseerbare entry mag niet waarschuwen');

  const vast = valideerStopLoss(100, 90, { symbool: 'DOGE', bewerkbaar: false, minPct: 1, maxPct: 50 });
  console.assert(vast !== null && vast.includes('niet zelf instellen'), 'een niet-bewerkbare stop moet gemeld worden');

  console.log('etoroLimieten.ts self-check geslaagd');
}
