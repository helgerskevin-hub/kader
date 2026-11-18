// "Eén ding vandaag": het belangrijkste wat je vandaag kunt doen, als één kaart bovenaan Markt.
// Risico gaat voor: eerst je open posities beschermen (winst nemen bij je doel, stop optrekken),
// pas daarna een nieuw signaal. Is er niets, dan zegt de kaart dat ook: niets doen is ook een plan.
//
// Puur, met een self-check onderaan: `npx tsx src/state/eenDing.ts` vanuit app/.
//
// Geen "winst nemen bij omslaand momentum": meting L (docs/metingen.md) liet zien dat dat niets
// oplevert boven wachten op doel of stop.

import type { Trade } from '../engine/types';
import type { Klimaat } from '../engine/marktklimaat';
import { fmtPrijs, fmtR } from '../engine/format';
import { isAlleenBekijken } from '../engine/platforms';
import { PortfolioTrade, risicoStop } from './portfolioTypes';
import { drempelBijnaOpDoel } from './advies';
import { bepaalAfbouwAdvies, voorstelTrailingStop } from './afbouw';
import { PLAFOND_PCT, fmtPctKort } from './openRisico';
import { STOP_OPTREKKEN_BEWEZEN } from '../engine/drempels';

export type EenDingSoort = 'doelBereikt' | 'stopOptrekken' | 'bijnaDoel' | 'signaal' | 'niets';

export interface EenDing {
  soort: EenDingSoort;
  // Wat dit advies uniek maakt: wegvegen geldt voor dit advies, niet voor alles.
  sleutel: string;
  // Lager is belangrijker. Een weggeveegd advies komt terug als er iets met een lager getal bijkomt.
  prio: number;
  titel: string;
  tekst: string;
  actie?: string;
  tradeId?: string;
  symbool?: string;
  voorstelStop?: number;
  signaal?: Trade;
}

export interface EenDingInvoer {
  open: PortfolioTrade[];
  livePrijzen: Record<string, number>;
  marktPerSymbool: Record<string, Trade>;
  klimaat: Klimaat | null;
  signalen: Trade[];
  remActief: boolean;
  openRisicoPct: number | null;
}

// Open winst in R tegen de oorspronkelijke stop. Null zonder stop onder de instap.
function openR(t: PortfolioTrade, koers: number): number | null {
  const stop = risicoStop(t);
  if (stop === null) return null;
  return (koers - t.entryPrijs) / (t.entryPrijs - stop);
}

export function kiesEenDing(inv: EenDingInvoer): EenDing {
  const kandidaten: (EenDing & { gewicht: number })[] = [];

  for (const t of inv.open) {
    const koers = inv.livePrijzen[t.symbool];
    if (koers === undefined || !(t.takeProfit > 0)) continue;
    const r = openR(t, koers) ?? 0;

    if (koers >= t.takeProfit) {
      kandidaten.push({
        soort: 'doelBereikt', sleutel: `doel:${t.id}`, prio: 1, gewicht: r,
        titel: `${t.symbool} heeft zijn doel gehaald`,
        tekst: `De koers staat op of boven je doel van ${fmtPrijs(t.takeProfit)}. Neem winst of zet je stop strak, maar besluit het bewust.`,
        actie: 'Positie bekijken', tradeId: t.id, symbool: t.symbool,
      });
      continue;
    }

    // Stop optrekken: alleen als de stop nog onder de instap staat, er dus nog risico is om weg te nemen.
    const markt = inv.marktPerSymbool[t.symbool];
    if (markt && t.stopLoss > 0 && t.stopLoss < t.entryPrijs) {
      const afbouw = bepaalAfbouwAdvies(t, koers, markt, inv.klimaat);
      const voorstel = afbouw?.niveau === 'afbouwen' && afbouw.trailingStop
        ? afbouw.trailingStop
        : r >= 1 ? voorstelTrailingStop(t.entryPrijs, koers, markt.atr, t.stopLoss) : null;
      if (voorstel !== null && voorstel !== undefined) {
        const opInstap = Math.abs(voorstel - t.entryPrijs) < t.entryPrijs * 1e-6;
        kandidaten.push({
          soort: 'stopOptrekken', sleutel: `stop:${t.id}`, prio: afbouw?.niveau === 'afbouwen' ? 2 : 4, gewicht: r,
          titel: `Trek je stop op bij ${t.symbool}`,
          tekst: `${t.symbool} staat ${fmtR(r, 1)} in winst. Met je stop op ${fmtPrijs(voorstel)}${opInstap ? ', je instap,' : ''} kan deze trade je niets meer kosten.`,
          actie: 'Stop aanpassen', tradeId: t.id, symbool: t.symbool, voorstelStop: voorstel,
        });
        continue;
      }
    }

    if (koers > drempelBijnaOpDoel(t.entryPrijs, t.takeProfit)) {
      const nog = ((t.takeProfit - koers) / koers) * 100;
      kandidaten.push({
        soort: 'bijnaDoel', sleutel: `bijna:${t.id}`, prio: 3, gewicht: r,
        titel: `${t.symbool} staat vlak bij zijn doel`,
        tekst: `Nog ${nog.toFixed(nog < 1 ? 1 : 0)}% tot ${fmtPrijs(t.takeProfit)}. Neem winst of laat je doel staan, maar besluit het bewust.`,
        actie: 'Positie bekijken', tradeId: t.id, symbool: t.symbool,
      });
    }
  }

  // Een nieuw signaal alleen als de rem niet loopt en je onder je plafond zit.
  const binnenPlafond = inv.openRisicoPct === null || inv.openRisicoPct < PLAFOND_PCT;
  if (!inv.remActief && binnenPlafond) {
    const inBezit = new Set(inv.open.map(t => t.symbool));
    const beste = inv.signalen
      .filter(s => s.signaal === 'KOOP' && s.highConviction && !isAlleenBekijken(s.symbool) && !inBezit.has(s.symbool))
      .sort((a, b) => b.score - a.score)[0];
    if (beste) {
      const rr = beste.rr.toFixed(1);
      kandidaten.push({
        soort: 'signaal', sleutel: `signaal:${beste.symbool}`, prio: 5, gewicht: beste.score,
        titel: `Sterk koopsignaal in ${beste.symbool}`,
        tekst: `Score ${Math.round(beste.score)}, R/R 1 : ${rr}.${inv.openRisicoPct !== null ? ` Je open risico staat nu op ${fmtPctKort(inv.openRisicoPct)} van ${PLAFOND_PCT}%.` : ''}`,
        actie: 'Kooporder openen', symbool: beste.symbool, signaal: beste,
      });
    }
  }

  if (kandidaten.length > 0) {
    kandidaten.sort((a, b) => a.prio - b.prio || b.gewicht - a.gewicht);
    const { gewicht: _g, ...beste } = kandidaten[0];
    return beste;
  }

  const n = inv.open.length;
  return {
    soort: 'niets', sleutel: 'niets', prio: 9,
    titel: 'Niets te doen vandaag',
    tekst: n === 0
      ? 'Geen open posities. Ook dat is een plan.'
      : `Je ${n === 1 ? 'positie loopt' : `${n} posities lopen`} binnen ${n === 1 ? 'zijn' : 'hun'} kader en er is geen sterk signaal. Ook dat is een plan.`,
  };
}

// Mag de kaart staan, gegeven wat er vandaag is weggeveegd?
export interface Weggeveegd { dag: string; sleutel: string; prio: number }

export function dagSleutel(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function toonEenDing(ding: EenDing, weg: Weggeveegd | null, nu: number): boolean {
  if (!weg || weg.dag !== dagSleutel(nu)) return true;
  // Hetzelfde advies, of iets dat niet belangrijker is: weg tot morgen.
  return ding.sleutel !== weg.sleutel && ding.prio < weg.prio;
}

if (typeof require !== 'undefined' && require.main === module) {
  const markt = (over: Partial<Trade> = {}): Trade => ({
    symbool: 'SOL', bron: 'binance', prijs: 100, entry: 100, entryLaag: 98, entryHoog: 102,
    stopLoss: 90, takeProfit: 130, rr: 3, atr: 5, rsi: 50, ema20: 100, ema50: 100,
    macdBullish: true, volumeRatio: 1, score: 60, redenen: [], signaal: 'WATCH',
    highConviction: false, voldoetAanRR: true, profiel: 'momentum', ...over,
  });
  const trade = (over: Partial<PortfolioTrade> = {}): PortfolioTrade => ({
    id: '1', symbool: 'SOL', naam: 'Solana', entryPrijs: 100, stopLoss: 90, takeProfit: 130,
    rr: 3, datum: '', status: 'open', ...over,
  });
  const basis: EenDingInvoer = { open: [], livePrijzen: {}, marktPerSymbool: {}, klimaat: 'gunstig', signalen: [], remActief: false, openRisicoPct: 1 };

  console.assert(kiesEenDing(basis).soort === 'niets', 'leeg: niets');
  const sterk = markt({ symbool: 'AVAX', signaal: 'KOOP', highConviction: true, score: 78, rr: 2.6 });
  console.assert(kiesEenDing({ ...basis, signalen: [sterk] }).soort === 'signaal', 'sterk signaal');
  console.assert(kiesEenDing({ ...basis, signalen: [sterk], remActief: true }).soort === 'niets', 'rem blokkeert signaal');
  console.assert(kiesEenDing({ ...basis, signalen: [sterk], openRisicoPct: 5.2 }).soort === 'niets', 'boven plafond geen signaal');

  // +1.2 R in winst in een gunstige markt: stop optrekken, voor het signaal. Staat het advies uit
  // (STOP_OPTREKKEN_BEWEZEN in drempels.ts), dan is er geen voorstel en wint het signaal.
  const stopInv = { ...basis, open: [trade()], livePrijzen: { SOL: 112 }, marktPerSymbool: { SOL: markt() }, signalen: [sterk] };
  const s = kiesEenDing(stopInv);
  if (STOP_OPTREKKEN_BEWEZEN) {
    console.assert(s.soort === 'stopOptrekken' && s.voorstelStop === 107, `stop optrekken naar 107, was ${s.soort} ${s.voorstelStop}`);
  } else {
    console.assert(s.soort === 'signaal', `advies uit: het signaal wint, was ${s.soort}`);
  }
  // Stop staat al op de instap: geen optrekadvies meer.
  console.assert(kiesEenDing({ ...stopInv, open: [trade({ stopLoss: 100 })] }).soort === 'signaal', 'stop op instap: niets op te trekken');
  // Doel gehaald gaat voor alles.
  console.assert(kiesEenDing({ ...stopInv, open: [trade(), trade({ id: '2', symbool: 'ETH' })], livePrijzen: { SOL: 112, ETH: 131 } }).soort === 'doelBereikt', 'doel gaat voor');
  // Vlak bij doel met de stop al op instap.
  console.assert(kiesEenDing({ ...basis, open: [trade({ stopLoss: 100 })], livePrijzen: { SOL: 128 } }).soort === 'bijnaDoel', 'bijna op doel');

  const ding = kiesEenDing(stopInv);
  const nu = Date.UTC(2026, 10, 5, 12);
  console.assert(toonEenDing(ding, null, nu), 'niets weggeveegd');
  console.assert(!toonEenDing(ding, { dag: dagSleutel(nu), sleutel: ding.sleutel, prio: ding.prio }, nu), 'zelfde advies weg tot morgen');
  console.assert(toonEenDing(ding, { dag: dagSleutel(nu), sleutel: 'niets', prio: 9 }, nu), 'iets belangrijkers komt terug');
  console.assert(!toonEenDing(kiesEenDing(basis), { dag: dagSleutel(nu), sleutel: 'stop:1', prio: 4 }, nu), 'minder belangrijk blijft weg');
  console.assert(toonEenDing(ding, { dag: dagSleutel(nu - 86400000), sleutel: ding.sleutel, prio: ding.prio }, nu), 'gisteren weggeveegd telt niet');
  console.log('eenDing.ts self-check klaar');
}
