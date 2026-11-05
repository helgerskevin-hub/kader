// De tekst van het weekrapport (notifications/weekrapport.ts), puur zodat de self-check onderaan
// los draait: `npx tsx src/notifications/weekrapportTekst.ts` vanuit app/.

import type { PortfolioTrade } from '../state/portfolioTypes';
import { behaaldeRR } from '../state/statistieken';
import { beoordeelTrade } from '../state/discipline';
import type { GelogdSignaal } from '../engine/signaalLog';
import { fmtR } from '../engine/format';

const DAG_MS = 24 * 60 * 60 * 1000;

// De maandag 00:00 van de week waarin `ms` valt, in lokale tijd. Dient als sleutel: per week één
// rapport, ook als de taak die zondag vaker draait.
export function weekSleutel(ms: number): string {
  const d = new Date(ms);
  const sindsMaandag = (d.getDay() + 6) % 7;
  const maandag = new Date(d.getFullYear(), d.getMonth(), d.getDate() - sindsMaandag);
  return `${maandag.getFullYear()}-${maandag.getMonth() + 1}-${maandag.getDate()}`;
}

export function bouwWeekrapport(trades: PortfolioTrade[], signalen: GelogdSignaal[], nu: number): string | null {
  const grens = nu - 7 * DAG_MS;
  const gesloten = trades.filter(t => t.status !== 'open' && typeof t.slotTijd === 'number' && t.slotTijd >= grens);
  const sigAf = signalen.filter(s => s.uitkomst !== 'open' && typeof s.uitkomstTijd === 'number' && s.uitkomstTijd >= grens);
  if (gesloten.length === 0 && sigAf.length === 0) return null;

  const delen: string[] = [];
  if (gesloten.length > 0) {
    const r = gesloten.map(behaaldeRR).filter((x): x is number => x !== null);
    const oordelen = gesloten.map(beoordeelTrade).filter(o => o.beoordeeld);
    const gevolgd = oordelen.filter(o => o.afwijking === null).length;
    const aantal = gesloten.length === 1 ? '1 gesloten trade' : `${gesloten.length} gesloten trades`;
    let zin = r.length > 0 ? `Je trades: ${fmtR(r.reduce((a, b) => a + b, 0), 1)} uit ${aantal}.` : `Je sloot ${aantal}.`;
    if (oordelen.length > 0) zin += ` Je volgde je plan bij ${gevolgd} van de ${oordelen.length}.`;
    delen.push(zin);
  }
  if (sigAf.length > 0) {
    const gem = sigAf.reduce((s, x) => s + (x.behaaldeR ?? 0), 0) / sigAf.length;
    delen.push(`Signalen van Kader: ${sigAf.length} afgesloten, gemiddeld ${fmtR(gem)}.`);
  }
  return delen.join(' ');
}

if (require.main === module) {
  let missers = 0;
  const origineleAssert = console.assert.bind(console);
  console.assert = ((voorwaarde?: boolean, ...rest: unknown[]) => {
    if (!voorwaarde) missers++;
    origineleAssert(voorwaarde, ...rest);
  }) as typeof console.assert;

  const nu = new Date(2026, 10, 8, 18, 30).getTime(); // zondag
  const t = (over: Partial<PortfolioTrade>): PortfolioTrade => ({
    id: 'x', symbool: 'BTC', naam: 'Bitcoin', entryPrijs: 100, stopLoss: 90, initieleStop: 90, takeProfit: 130, rr: 3,
    datum: '', status: 'gewonnen', slotTijd: nu - DAG_MS, ...over,
  });
  const tekst = bouwWeekrapport(
    [t({ exitPrijs: 130 }), t({ exitPrijs: 90, status: 'verloren' }), t({ exitPrijs: 110 }), t({ exitPrijs: 130, slotTijd: nu - 9 * DAG_MS })],
    [{ id: 's', symbool: 'ETH', tijd: 0, score: 70, advies: 'KOOPZONE', entry: 1, stop: 0.9, doel: 1.3, rr: 3, uitkomst: 'doel', uitkomstTijd: nu - DAG_MS, behaaldeR: 3 }],
    nu,
  );
  console.assert(tekst === 'Je trades: +3.0 R uit 3 gesloten trades. Je volgde je plan bij 2 van de 3. Signalen van Kader: 1 afgesloten, gemiddeld +3.00 R.', `was: ${tekst}`);
  console.assert(bouwWeekrapport([], [], nu) === null, 'lege week geeft geen rapport');
  console.assert(weekSleutel(nu) === weekSleutel(new Date(2026, 10, 2, 0, 1).getTime()), 'maandag en zondag vallen in dezelfde week');
  console.assert(weekSleutel(nu) !== weekSleutel(new Date(2026, 10, 9, 0, 1).getTime()), 'de maandag erna is een nieuwe week');

  if (missers > 0) {
    console.error(`weekrapportTekst.ts self-check GEFAALD: ${missers} controle(s) klopten niet`);
    process.exit(1);
  }
  console.log('weekrapportTekst.ts self-check geslaagd');
}
