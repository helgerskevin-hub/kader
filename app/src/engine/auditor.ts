import { TraderInput, TraderAudit, ConsistentieAnalyse, RisicoAnalyse, PortfolioAnalyse } from './types';

const CORRELATIE_GROEPEN: Record<string, Set<string>> = {
  'Large-cap': new Set(['BTC', 'ETH']),
  'Layer-1 alts': new Set(['SOL', 'AVAX', 'NEAR', 'ADA', 'DOT', 'ATOM', 'SUI', 'APT', 'SEI', 'TIA']),
  'Layer-2': new Set(['ARB', 'OP', 'MATIC']),
  'DeFi': new Set(['AAVE', 'LINK', 'INJ', 'UNI']),
  'Meme': new Set(['DOGE', 'SHIB', 'PEPE']),
  'AI': new Set(['FET', 'RNDR', 'TAO']),
};

function classificeerAsset(sym: string): string {
  const s = sym.toUpperCase();
  for (const [groep, leden] of Object.entries(CORRELATIE_GROEPEN)) {
    if (leden.has(s)) return groep;
  }
  if (['CASH', 'USD', 'USDT', 'USDC'].includes(s)) return 'Cash';
  return 'Overig';
}

function pstdev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function analyseConsistentie(maandrendementen: number[]): ConsistentieAnalyse {
  if (maandrendementen.length === 0) {
    return { score: 0, positiefPct: 0, stdev: 0, gemMaand: 0, slechtsteManad: 0, opmerking: 'Geen maanddata aangeleverd.' };
  }
  const positief = maandrendementen.filter(r => r > 0).length;
  const positiefPct = 100 * positief / maandrendementen.length;
  const stdev = pstdev(maandrendementen);
  const gem = maandrendementen.reduce((a, b) => a + b, 0) / maandrendementen.length;
  const slechtste = Math.min(...maandrendementen);

  let score = 0;
  score += Math.min(50, positiefPct * 0.5);
  if (stdev > 0) {
    const sharpeAchtig = gem / stdev;
    score += Math.max(0, Math.min(30, sharpeAchtig * 15));
  } else {
    score += 20;
  }
  if (slechtste > -10) score += 20;
  else if (slechtste > -20) score += 10;

  let opmerking: string;
  if (positiefPct >= 65 && stdev < 8) opmerking = 'Zeer consistent: stabiele maand-op-maand winst.';
  else if (positiefPct >= 50) opmerking = 'Redelijk consistent, maar met enige schommeling.';
  else opmerking = 'Inconsistent: rendement lijkt afhankelijk van enkele uitschieters.';

  return {
    score: Math.round(Math.min(score, 100)),
    positiefPct: Math.round(positiefPct),
    stdev: Math.round(stdev * 10) / 10,
    gemMaand: Math.round(gem * 100) / 100,
    slechtsteManad: Math.round(slechtste * 10) / 10,
    opmerking,
  };
}

export function analyseRisico(
  maandrendementen: number[],
  maxDrawdown: number,
  jaarrendement: number | null | undefined,
  riskScore: number,
): RisicoAnalyse {
  let jaar = jaarrendement;
  if ((jaar == null) && maandrendementen.length > 0) {
    let factor = 1.0;
    for (const r of maandrendementen) factor *= (1 + r / 100);
    jaar = (factor - 1) * 100;
  }
  jaar = jaar ?? 0;
  const dd = Math.max(maxDrawdown, 0.1);
  const ratio = jaar / dd;

  let score = 0;
  let opmerking: string;
  if (ratio >= 2) { score += 50; opmerking = 'Uitstekend: rendement rechtvaardigt het risico ruimschoots.'; }
  else if (ratio >= 1) { score += 35; opmerking = 'Gezond: rendement weegt op tegen de drawdown.'; }
  else if (ratio >= 0.5) { score += 20; opmerking = 'Matig: er wordt veel risico genomen voor het rendement.'; }
  else { score += 5; opmerking = 'Zwak: drawdown te hoog t.o.v. rendement.'; }

  if (riskScore <= 3) score += 30;
  else if (riskScore <= 5) score += 20;
  else score += 5;

  if (dd <= 25) score += 20;
  else if (dd <= 40) score += 10;

  return {
    score: Math.round(Math.min(score, 100)),
    jaarrendement: Math.round(jaar * 10) / 10,
    maxDrawdown: Math.round(dd * 10) / 10,
    ratio: Math.round(ratio * 100) / 100,
    riskScore,
    opmerking,
  };
}

export function analysePortfolio(portfolio: Record<string, number>): PortfolioAnalyse {
  if (!portfolio || Object.keys(portfolio).length === 0) {
    return { score: 50, grootstePositie: 0, grootsteGroep: 0, cash: 0, groepConcentratie: {}, opmerking: 'Geen portfolio-data aangeleverd.' };
  }
  const totaal = Object.values(portfolio).reduce((a, b) => a + b, 0) || 100;
  const genormaliseerd = Object.fromEntries(Object.entries(portfolio).map(([k, v]) => [k, 100 * v / totaal]));
  const cash = Object.entries(genormaliseerd).filter(([k]) => classificeerAsset(k) === 'Cash').reduce((s, [, v]) => s + v, 0);

  const groepConc: Record<string, number> = {};
  for (const [sym, pct] of Object.entries(genormaliseerd)) {
    const groep = classificeerAsset(sym);
    if (groep === 'Cash') continue;
    groepConc[groep] = (groepConc[groep] ?? 0) + pct;
  }

  const nonCashPositions = Object.entries(genormaliseerd).filter(([k]) => classificeerAsset(k) !== 'Cash').map(([, v]) => v);
  const grootstePositie = nonCashPositions.length ? Math.max(...nonCashPositions) : 0;
  const grootsteGroep = Object.values(groepConc).length ? Math.max(...Object.values(groepConc)) : 0;
  const nGroepen = Object.keys(groepConc).length;

  let score = 100;
  const opmerkingen: string[] = [];
  if (grootstePositie > 50) { score -= 30; opmerkingen.push(`zeer geconcentreerd in één asset (${grootstePositie.toFixed(0)}%)`); }
  else if (grootstePositie > 35) { score -= 15; opmerkingen.push(`flinke enkele positie (${grootstePositie.toFixed(0)}%)`); }
  if (grootsteGroep > 60) { score -= 25; opmerkingen.push(`sterk gecorreleerd cluster (${grootsteGroep.toFixed(0)}% in één groep)`); }
  else if (grootsteGroep > 45) { score -= 12; opmerkingen.push(`matige correlatie-concentratie (${grootsteGroep.toFixed(0)}%)`); }
  if (nGroepen >= 3) score += 5;
  else if (nGroepen <= 1) { score -= 10; opmerkingen.push('nauwelijks spreiding over categorieën'); }
  if (cash >= 10) opmerkingen.push(`gezonde cash-buffer (${cash.toFixed(0)}%)`);
  if (opmerkingen.length === 0) opmerkingen.push('goed gespreide portefeuille');

  return {
    score: Math.round(Math.max(0, Math.min(score, 100))),
    grootstePositie: Math.round(grootstePositie),
    grootsteGroep: Math.round(grootsteGroep),
    cash: Math.round(cash),
    groepConcentratie: Object.fromEntries(Object.entries(groepConc).map(([k, v]) => [k, Math.round(v)])),
    opmerking: opmerkingen.join('; '),
  };
}

export function beoordeelTrader(trader: TraderInput): TraderAudit {
  const cons = analyseConsistentie(trader.maandrendementen ?? []);
  const risico = analyseRisico(trader.maandrendementen ?? [], trader.maxDrawdown ?? 0, trader.jaarrendement, trader.riskScore ?? 4);
  const port = analysePortfolio(trader.portfolio ?? {});

  const totaal = Math.round(0.35 * cons.score + 0.40 * risico.score + 0.25 * port.score);

  let oordeel: 'GROEN' | 'GEEL' | 'ROOD';
  let kleur: 'green' | 'yellow' | 'red';
  if (totaal >= 70) { oordeel = 'GROEN'; kleur = 'green'; }
  else if (totaal >= 50) { oordeel = 'GEEL'; kleur = 'yellow'; }
  else { oordeel = 'ROOD'; kleur = 'red'; }

  const dd = risico.maxDrawdown;
  let csl: number;
  if (oordeel === 'GROEN') csl = Math.min(40, Math.max(20, Math.round(dd * 1.2 / 5) * 5));
  else if (oordeel === 'GEEL') csl = Math.min(30, Math.max(15, Math.round(dd * 1.0 / 5) * 5));
  else csl = Math.min(20, Math.max(10, Math.round(dd * 0.6 / 5) * 5));

  return { naam: trader.naam ?? 'Onbekend', consistentie: cons, risico, portfolio: port, totaalscore: totaal, oordeel, kleur, csl };
}
