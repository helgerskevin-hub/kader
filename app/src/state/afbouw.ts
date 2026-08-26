import { Trade } from '../engine/types';
import { Klimaat } from '../engine/marktklimaat';
import { PortfolioTrade, Richting, richtingVan, tekenVan } from './portfolioTypes';

// Wat te doen met posities die je al hebt, als de markt draait.
//
// De rest van de app kijkt vooruit: wat is er te kopen. Zodra het klimaat ongunstig wordt is dat
// precies de verkeerde vraag, want dan is er niets te kopen en gaat het alleen nog over wat je al
// in de markt hebt staan. Deze module beantwoordt die vraag.
//
// Richting-bewust: een long heeft een stop onder de entry en een doel erboven, een short precies
// gespiegeld. richtingVan(trade) bepaalt welke kant het op gaat; ontbreekt het veld, dan is het long
// (zie portfolioTypes.ts).

/**
 * De stop die winst vastzet zonder de trade meteen uit te stoppen: bij een long break-even of één
 * ATR onder de koers, welke van die twee het hoogst is; bij een short het spiegelbeeld, welke van
 * de twee het laagst is.
 *
 * Geeft null als het voorstel de stop niet echt richting winst brengt, of als het voorstel aan de
 * verkeerde kant van de koers zou liggen (dan zou je jezelf onmiddellijk uitstoppen).
 *
 * Gedeeld met notifications/tradeChecks.ts. Twee kopieën van deze berekening zouden uiteen lopen en
 * dan zou de melding een ander niveau voorstellen dan het scherm, wat het vertrouwen in allebei
 * kost.
 */
export function voorstelTrailingStop(
  entryPrijs: number,
  koers: number,
  atr: number,
  huidigeStop: number,
  richting: Richting = 'long',
): number | null {
  if (!(atr > 0) || !(koers > 0)) return null;
  if (richting === 'short') {
    const voorstel = Math.min(entryPrijs, koers + atr);
    if (voorstel >= huidigeStop || voorstel <= koers) return null;
    return voorstel;
  }
  const voorstel = Math.max(entryPrijs, koers - atr);
  if (voorstel <= huidigeStop || voorstel >= koers) return null;
  return voorstel;
}

export type AfbouwNiveau = 'houden' | 'letOp' | 'afbouwen';

export interface AfbouwAdvies {
  niveau: AfbouwNiveau;
  // Korte versie voor een badge of een compacte regel.
  kort: string;
  tekst: string;
  // Voorgestelde nieuwe stop, als die winst vastzet. Ontbreekt als er niets te verhogen valt.
  trailingStop?: number;
}

/**
 * Beoordeelt één open positie in het licht van het huidige marktklimaat.
 *
 * `markt` is de verse analyse van dezelfde coin uit de marktscan (voor EMA50 en ATR). Zonder die
 * data valt er niets technisch te zeggen en geeft deze functie null terug.
 *
 * Geeft ook null terug als er niets bijzonders aan de hand is. Dat is met opzet: het bestaande
 * advieslabel uit advies.ts blijft de hoofdregel, en dit advies verschijnt alleen als het echt iets
 * toevoegt. Anders staat er bij elke trade in een stijgende markt een tweede zin die niets zegt.
 */
export function bepaalAfbouwAdvies(
  trade: PortfolioTrade,
  livePrijs: number | undefined,
  markt: Trade | undefined,
  klimaat: Klimaat | null,
): AfbouwAdvies | null {
  if (livePrijs === undefined || !markt) return null;
  if (trade.stopLoss <= 0 || trade.takeProfit <= 0) return null;

  const richting = richtingVan(trade);
  const short = richting === 'short';

  // Vormcontrole, nu per richting in plaats van de oude long-only test. Een long hoort stop < entry
  // < doel te hebben en een short precies andersom. Klopt dat niet, dan is de trade niet te
  // beoordelen en zwijgen we, in plaats van een advies te geven dat de verkeerde kant op wijst.
  const stopGoed = short ? trade.stopLoss > trade.entryPrijs : trade.stopLoss < trade.entryPrijs;
  const doelGoed = short ? trade.takeProfit < trade.entryPrijs : trade.takeProfit > trade.entryPrijs;
  if (!stopGoed || !doelGoed) return null;

  const inWinst = short ? livePrijs < trade.entryPrijs : livePrijs > trade.entryPrijs;
  // Long: trend gebroken zodra de koers onder de EMA50 zakt. Short: gespiegeld, gebroken zodra de
  // koers erboven klimt.
  const trendGebroken = short ? livePrijs > markt.ema50 : livePrijs < markt.ema50;
  const trailing = voorstelTrailingStop(trade.entryPrijs, livePrijs, markt.atr, trade.stopLoss, richting) ?? undefined;
  // Het klimaat dat TEGEN je positie werkt verschilt per richting: voor een long is dat een
  // dalende markt, voor een short een stijgende. Zonder deze spiegeling zou een short die in de
  // problemen komt (markt trekt aan) juist geen waarschuwing krijgen, terwijl een short met de
  // wind mee te horen zou krijgen dat hij winst moet nemen.
  const klimaatTegen = short ? klimaat === 'gunstig' : klimaat === 'ongunstig';
  const klimaatTekst = short ? 'in een stijgende markt' : 'in een dalende markt';
  const stopWerkwoord = short ? 'te verlagen' : 'op te trekken';

  // In winst, maar de coin verliest zijn eigen trend in een dalende markt. Dit is het geval waarin
  // vasthouden tot het doel het vaakst omslaat in de hele winst weer teruggeven.
  if (klimaatTegen && trendGebroken && inWinst) {
    const trendTekst = short ? 'boven zijn 50-daags gemiddelde geklommen' : 'onder zijn 50-daags gemiddelde gezakt';
    return {
      niveau: 'afbouwen',
      kort: 'Winst beschermen',
      tekst: trailing
        ? `${trade.symbool} staat in winst maar is ${trendTekst}, ${klimaatTekst}. Overweeg (deels) winst te nemen of je stop ${stopWerkwoord}.`
        : `${trade.symbool} staat in winst maar is ${trendTekst}, ${klimaatTekst}. Overweeg (deels) winst te nemen.`,
      trailingStop: trailing,
    };
  }

  // Onder water én zonder trend, in een dalende markt. Hier is de verleiding om bij te kopen of de
  // stop te verplaatsen het grootst, en dat is precies wat je niet moet doen.
  if (klimaatTegen && trendGebroken && !inWinst) {
    return {
      niveau: 'letOp',
      kort: 'Plan volgen',
      tekst: short
        ? `${trade.symbool} staat boven je entry en boven zijn 50-daags gemiddelde. Je stop is je plan: niet verhogen en je positie niet vergroten om het gemiddelde op te trekken.`
        : `${trade.symbool} staat onder je entry en onder zijn 50-daags gemiddelde. Je stop is je plan: niet verlagen en je positie niet vergroten om het gemiddelde te drukken.`,
    };
  }

  // Buiten een dalende markt alleen iets zeggen als er echt winst te beschermen valt.
  if (inWinst && trendGebroken && trailing) {
    const trendTekst = short ? 'boven zijn 50-daags gemiddelde geklommen' : 'onder zijn 50-daags gemiddelde gezakt';
    return {
      niveau: 'letOp',
      kort: short ? 'Stop verlagen' : 'Stop optrekken',
      tekst: `${trade.symbool} staat in winst maar is ${trendTekst}. Overweeg je stop ${short ? 'te verlagen' : 'te verhogen'} om die winst vast te zetten.`,
      trailingStop: trailing,
    };
  }

  // Standhouden terwijl de markt daalt is het vermelden waard: dat is precies het gedrag dat je in
  // een bearmarkt wil zien bij wat je aanhoudt.
  if (klimaatTegen && !trendGebroken) {
    return {
      niveau: 'houden',
      kort: 'Houdt stand',
      tekst: short
        ? `${trade.symbool} staat nog onder zijn 50-daags gemiddelde terwijl de markt stijgt. Geen reden om nu iets te doen.`
        : `${trade.symbool} staat nog boven zijn 50-daags gemiddelde terwijl de markt daalt. Geen reden om nu iets te doen.`,
      trailingStop: trailing,
    };
  }

  return null;
}

export interface PortfolioRisico {
  // Aantal open posities waarvoor we verse marktdata én een live prijs hebben. De rest kunnen we
  // niet beoordelen en telt nergens in mee.
  beoordeeld: number;
  // Posities onder hun eigen 50-daags EMA: hun eigen trend is gebroken.
  zwak: number;
  onderEntry: number;
  // Posities die binnen één ATR van hun stop staan: die kunnen op een normale dagbeweging afgaan.
  dichtBijStop: number;
}

export function beoordeelPortfolioRisico(
  openTrades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
  marktPerSymbool: Record<string, Trade>,
): PortfolioRisico {
  let beoordeeld = 0;
  let zwak = 0;
  let onderEntry = 0;
  let dichtBijStop = 0;

  for (const trade of openTrades) {
    const koers = livePrijzen[trade.symbool];
    const markt = marktPerSymbool[trade.symbool];
    if (koers === undefined || !markt) continue;
    beoordeeld += 1;
    const teken = tekenVan(trade);
    // Long: zwak zodra de koers onder de EMA50 zakt. Short: gespiegeld, zodra hij erboven klimt.
    if (teken * (koers - markt.ema50) < 0) zwak += 1;
    if (teken * (koers - trade.entryPrijs) < 0) onderEntry += 1;
    // Richtingsafhankelijke afstand tot de stop: bij een long is dat koers - stop (stop ligt eronder),
    // bij een short stop - koers (stop ligt erboven). teken * (koers - stop) geeft precies dat, met
    // hetzelfde teken in beide richtingen: positief betekent nog ruimte tot de stop.
    if (trade.stopLoss > 0 && markt.atr > 0 && teken * (koers - trade.stopLoss) < markt.atr) dichtBijStop += 1;
  }

  return { beoordeeld, zwak, onderEntry, dichtBijStop };
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/state/afbouw.ts`
if (require.main === module) {
  const markt = (over: Partial<Trade> = {}): Trade => ({
    symbool: 'SOL', bron: 'binance', prijs: 100, entry: 100, entryLaag: 98, entryHoog: 102,
    stopLoss: 90, takeProfit: 130, rr: 3, atr: 5, rsi: 50, ema20: 100, ema50: 100,
    macdBullish: true, volumeRatio: 1, score: 60, redenen: [], signaal: 'WATCH',
    highConviction: false, voldoetAanRR: true, profiel: 'momentum', richting: 'long', ...over,
  });
  const trade = (over: Partial<PortfolioTrade> = {}): PortfolioTrade => ({
    id: '1', symbool: 'SOL', naam: 'Solana', entryPrijs: 100, stopLoss: 90, takeProfit: 130,
    rr: 3, datum: '', status: 'open', ...over,
  });

  console.assert(voorstelTrailingStop(100, 110, 5, 90) === 105, 'een ATR onder de koers, want dat is hoger dan break-even');
  console.assert(voorstelTrailingStop(100, 102, 5, 90) === 100, 'te dicht bij entry: break-even is dan het voorstel');
  console.assert(voorstelTrailingStop(100, 110, 5, 106) === null, 'een voorstel onder de bestaande stop is geen voorstel');
  console.assert(voorstelTrailingStop(100, 95, 5, 90) === null, 'onder water valt er geen winst vast te zetten');

  // Short: spiegelbeeld van de vier gevallen hierboven, met de laagste van break-even en koers+atr.
  console.assert(voorstelTrailingStop(100, 90, 5, 110, 'short') === 95, 'een ATR boven de koers, want dat is lager dan break-even');
  console.assert(voorstelTrailingStop(100, 98, 5, 110, 'short') === 100, 'te dicht bij entry: break-even is dan het voorstel');
  console.assert(voorstelTrailingStop(100, 90, 5, 94, 'short') === null, 'een voorstel boven de bestaande stop is geen voorstel');
  console.assert(voorstelTrailingStop(100, 105, 5, 110, 'short') === null, 'onder water valt er geen winst vast te zetten');

  // In winst, onder EMA50, dalende markt: het geval waarin winst teruggeven het vaakst gebeurt.
  const a = bepaalAfbouwAdvies(trade(), 110, markt({ ema50: 120 }), 'ongunstig');
  console.assert(a?.niveau === 'afbouwen', `afbouwen verwacht, was ${a?.niveau}`);
  console.assert(a?.trailingStop === 105, `trailing stop 105 verwacht, was ${a?.trailingStop}`);

  // Onder water in een dalende markt: plan volgen, geen afbouwadvies.
  const b = bepaalAfbouwAdvies(trade(), 95, markt({ ema50: 120 }), 'ongunstig');
  console.assert(b?.niveau === 'letOp', `letOp verwacht, was ${b?.niveau}`);
  console.assert(b?.trailingStop === undefined, 'onder water valt er niets vast te zetten');

  // Standhouden terwijl de markt daalt.
  const c = bepaalAfbouwAdvies(trade(), 110, markt({ ema50: 100 }), 'ongunstig');
  console.assert(c?.niveau === 'houden', `houden verwacht, was ${c?.niveau}`);

  // Gunstig klimaat en alles in orde: geen tweede zin onder de trade.
  console.assert(bepaalAfbouwAdvies(trade(), 110, markt({ ema50: 100 }), 'gunstig') === null,
    'in een gunstige markt hoort er geen extra advies bij een gezonde trade te staan');

  // Zonder marktdata of zonder live prijs: zwijgen.
  console.assert(bepaalAfbouwAdvies(trade(), undefined, markt(), 'ongunstig') === null, 'zonder live prijs geen advies');
  console.assert(bepaalAfbouwAdvies(trade(), 110, undefined, 'ongunstig') === null, 'zonder marktdata geen advies');

  // ---------- Short-trades ----------
  // Zelfde vier scenario's als hierboven (a, b, c), nu gespiegeld voor een short: entry 100, stop
  // 110 (erboven), doel 70 (eronder).
  const shortTrade = (over: Partial<PortfolioTrade> = {}) =>
    trade({ entryPrijs: 100, stopLoss: 110, takeProfit: 70, richting: 'short', ...over });

  // In winst (koers onder entry), trend gebroken (koers boven EMA50), dalende markt: afbouwen.
  const sa = bepaalAfbouwAdvies(shortTrade(), 90, markt({ ema50: 80, atr: 5 }), 'gunstig');
  console.assert(sa?.niveau === 'afbouwen', `afbouwen verwacht voor short in winst, was ${sa?.niveau}`);
  console.assert(sa?.trailingStop === 95, `trailing stop 95 verwacht voor short, was ${sa?.trailingStop}`);

  // Onder water (koers boven entry) in een dalende markt: plan volgen, geen afbouwadvies.
  const sb = bepaalAfbouwAdvies(shortTrade(), 105, markt({ ema50: 80, atr: 5 }), 'gunstig');
  console.assert(sb?.niveau === 'letOp', `letOp verwacht voor short onder water, was ${sb?.niveau}`);
  console.assert(sb?.trailingStop === undefined, 'onder water valt er voor een short ook niets vast te zetten');

  // Standhouden terwijl de markt daalt: koers nog onder de EMA50, precies waar een short op teert.
  const sc = bepaalAfbouwAdvies(shortTrade(), 90, markt({ ema50: 100, atr: 5 }), 'gunstig');
  console.assert(sc?.niveau === 'houden', `houden verwacht voor short die standhoudt, was ${sc?.niveau}`);

  // De spiegel van de long-regel hierboven: een dalende markt werkt VOOR een short, dus daar hoort
  // geen waarschuwing bij. Deze assertie ving af dat `bearig` niet meegespiegeld was.
  console.assert(bepaalAfbouwAdvies(shortTrade(), 90, markt({ ema50: 80, atr: 5 }), 'ongunstig')?.niveau !== 'afbouwen',
    'een short met de wind mee hoort niet te horen dat hij winst moet nemen');

  const risico = beoordeelPortfolioRisico(
    [trade({ id: '1', symbool: 'SOL' }), trade({ id: '2', symbool: 'ADA' }), trade({ id: '3', symbool: 'XRP' })],
    { SOL: 95, ADA: 130 },
    { SOL: markt({ ema50: 120, atr: 10 }), ADA: markt({ symbool: 'ADA', ema50: 100, atr: 5 }) },
  );
  console.assert(risico.beoordeeld === 2, `XRP heeft geen prijs en telt niet mee, was ${risico.beoordeeld}`);
  console.assert(risico.zwak === 1, `alleen SOL staat onder zijn EMA50, was ${risico.zwak}`);
  console.assert(risico.onderEntry === 1, `alleen SOL staat onder entry, was ${risico.onderEntry}`);
  console.assert(risico.dichtBijStop === 1, `SOL staat op 5 boven zijn stop met ATR 10, was ${risico.dichtBijStop}`);

  console.log('afbouw.ts self-check geslaagd');
}
