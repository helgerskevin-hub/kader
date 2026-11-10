// Alle rekenregels van de Copy-tab, zonder netwerk en zonder UI. Wat hier staat beslist welke
// traders je te zien krijgt, welke van hun trades nieuw zijn en of een trade nog te kopiëren is.
// Puur gehouden zodat de self-check onderaan alles kan naspelen zonder eToro-sleutel.
//
// Bron van de velden: eToro's API-documentatie (api-portal.etoro.com), nog niet tegen een echte
// respons gemeten. Waar de eenheid onzeker is (fractie of procent) staat dat erbij, en leest
// alsPct() beide.
import { analyseRisico, copyStopLossAdvies } from './auditor';

// ---------- Typen uit de API ----------

// Eén regel uit GET /api/v2/portfolios/rankings. Alles behalve cid en username is optioneel: eToro
// laat een veld weg als het voor die belegger niet bestaat.
export interface RanglijstRij {
  cid: number;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  type?: string;
  // Fractie: 0.1234 = 12,34%.
  gain?: number;
  riskScore?: number;
  copiers?: number;
  // Grootste daling van top naar dal. Eenheid en teken niet gemeten.
  peakToValley?: number;
  // Volgens de docs 0 tot 100.
  winRatio?: number;
  profitableMonthsPct?: number;
  profitableWeeksPct?: number;
  highLeveragePct?: number;
  longPosPct?: number;
  trades?: number;
  weeksSinceRegistration?: number;
  topTradedAssetClassId?: number;
  topTradedInstrumentId?: number;
  topTradedInstrumentPct?: number;
}

// Eén positie uit GET /api/v1/user-info/people/{username}/portfolio/live.
export interface TraderPositie {
  positionId: number;
  openTimestamp?: string;
  openRate: number;
  instrumentId: number;
  isBuy: boolean;
  leverage?: number;
  takeProfitRate?: number;
  stopLossRate?: number;
  investmentPct?: number;
  netProfit?: number;
  // Gevuld als de trader deze positie zelf van iemand anders kopieert. Die tellen niet mee.
  parentPositionId?: number;
  socialTradeId?: number;
}

export interface TraderLivePortfolio {
  positions?: TraderPositie[];
  socialTrades?: unknown[];
}

// ---------- Kleine helpers ----------

// eToro schrijft sommige verhoudingen als fractie (0.25) en andere als procent (25), en voor een
// paar velden is nog niet gemeten welke. Tot 1,5 lezen we als fractie: een echte 1,5% winstratio
// bestaat in de praktijk niet, een fractie boven 1,5 ook niet.
export function alsPct(waarde: number | undefined | null): number | null {
  if (typeof waarde !== 'number' || !Number.isFinite(waarde)) return null;
  return Math.abs(waarde) <= 1.5 ? waarde * 100 : waarde;
}

function begrens(waarde: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, waarde));
}

// ---------- Welke traders horen in Ontdek ----------

// Ruimer dan dit is geen "rustige" trader meer. Startwaarden; na een paar weken meten bijstellen.
export const MAX_RISICOSCORE = 6;
export const MIN_WEKEN_ACTIEF = 52;
// Weging van de Kader-score en de grenzen voor het oordeel. Ook de uitleg in Ontdek leest ze hier.
export const WEGING = { consistentie: 0.35, risico: 0.40, spreiding: 0.25 } as const;
export const GRENS_KOPIEER = 70;
export const GRENS_VOLG = 50;

export type Oordeel = 'KOPIEER' | 'VOLG' | 'VERMIJD';

export interface TraderBeoordeling {
  score: number;
  oordeel: Oordeel;
  // Aanbevolen Copy Stop Loss in procent, dezelfde regel als de handmatige beoordeling.
  csl: number;
  consistentie: number;
  risico: number;
  spreiding: number;
  // In procenten, voor de kaart. Null als eToro het veld niet stuurde.
  rendementPct: number | null;
  maxDalingPct: number | null;
}

// Is crypto de kern van deze trader? De ranglijst heeft geen crypto-filter, alleen het meest
// verhandelde instrument en de assetclass daarvan. Ontbreken de crypto-id's (eToro gaf ze niet),
// dan laten we de trader door: liever een te veel dan alle crypto-traders kwijt.
export function isCryptoTrader(
  rij: RanglijstRij,
  cryptoKlassen: Set<number> | null,
  cryptoInstrumenten: Set<number>,
): boolean {
  if (typeof rij.topTradedInstrumentId === 'number' && cryptoInstrumenten.has(rij.topTradedInstrumentId)) return true;
  if (cryptoKlassen === null) return true;
  return typeof rij.topTradedAssetClassId === 'number' && cryptoKlassen.has(rij.topTradedAssetClassId);
}

// De harde drempels om in Ontdek te komen. Popular Investor regelt de query al.
export function haaltDrempels(rij: RanglijstRij): boolean {
  if (rij.type && rij.type !== 'trader') return false;
  if (typeof rij.riskScore === 'number' && rij.riskScore > MAX_RISICOSCORE) return false;
  if (typeof rij.weeksSinceRegistration === 'number' && rij.weeksSinceRegistration < MIN_WEKEN_ACTIEF) return false;
  return true;
}

// Waarom een trader niet in Ontdek staat, voor wie hem via het zoekveld opzoekt. Null als hij de
// drempels haalt. Zelfde regels als haaltDrempels, in dezelfde volgorde.
export function waaromBuiten(rij: RanglijstRij): string | null {
  if (rij.type && rij.type !== 'trader') return 'Dit is een Smart Portfolio, geen trader.';
  if (typeof rij.riskScore === 'number' && rij.riskScore > MAX_RISICOSCORE) {
    return `eToro geeft een risico van ${rij.riskScore}, Kader neemt tot ${MAX_RISICOSCORE}.`;
  }
  if (typeof rij.weeksSinceRegistration === 'number' && rij.weeksSinceRegistration < MIN_WEKEN_ACTIEF) {
    return `Korter dan ${MIN_WEKEN_ACTIEF} weken actief (${rij.weeksSinceRegistration} weken).`;
  }
  return null;
}

// Het zoekveld leunt op een ander eToro-endpoint (rankings/multiple), en het is niet gemeten of dat
// alle velden stuurt. Ontbreekt wat de drempels nodig hebben, dan kan Kader niet zeggen dat de trader
// erbinnen valt, en dan geldt hij als buiten (fail-closed). Null als alles er is.
export function ontbreektVoorDrempels(rij: RanglijstRij): string | null {
  const mist: string[] = [];
  if (typeof rij.riskScore !== 'number') mist.push('het risico');
  if (typeof rij.weeksSinceRegistration !== 'number') mist.push('hoe lang hij actief is');
  if (typeof rij.topTradedInstrumentId !== 'number' && typeof rij.topTradedAssetClassId !== 'number') {
    mist.push('wat hij vooral verhandelt');
  }
  if (mist.length === 0) return null;
  return `eToro gaf niet genoeg om hem te beoordelen: ${mist.join(' en ')} ${mist.length === 1 ? 'ontbreekt' : 'ontbreken'}.`;
}

// De grenzen achter de deelscores. Staan hier zodat de uitleg in het profiel dezelfde getallen toont.
export const CONSISTENTIE = { nul: 40, vol: 80 } as const;
export const SPREIDING = { topGrens: 20, perPunt: 1.25, hefboomGrens: 20, hefboomAftrek: 15 } as const;
export const ONBEKENDE_DALING_PCT = 30;

// De Kader-score uit één ranglijstregel. Zelfde weging als de handmatige beoordeling (consistentie
// 35%, risico 40%, spreiding 25%), maar gevoed met eToro's eigen cijfers in plaats van overgetikte.
// Voor het risico-deel draait letterlijk analyseRisico uit de auditor.
export function beoordeelRij(rij: RanglijstRij): TraderBeoordeling {
  const rendementPct = alsPct(rij.gain);
  const dalingRuw = alsPct(rij.peakToValley);
  const maxDalingPct = dalingRuw === null ? null : Math.abs(dalingRuw);

  // Consistentie: het deel van de maanden met winst. Tot de ondergrens is niets waard, vanaf de
  // bovengrens is vol.
  const winstMaanden = alsPct(rij.profitableMonthsPct);
  const consistentie = winstMaanden === null
    ? 50
    : Math.round(begrens(((winstMaanden - CONSISTENTIE.nul) / (CONSISTENTIE.vol - CONSISTENTIE.nul)) * 100));

  // Zonder bekende daling geen gok: 30% is wat de auditor als middelmatig behandelt.
  const risico = analyseRisico([], maxDalingPct ?? ONBEKENDE_DALING_PCT, rendementPct ?? 0, rij.riskScore ?? 5).score;

  // Spreiding: één instrument boven de grens van zijn handel kost punten, en veel hefboom ook.
  const topPct = alsPct(rij.topTradedInstrumentPct) ?? 30;
  const hefboomPct = alsPct(rij.highLeveragePct) ?? 0;
  let spreiding = 100 - Math.max(0, topPct - SPREIDING.topGrens) * SPREIDING.perPunt;
  if (hefboomPct > SPREIDING.hefboomGrens) spreiding -= SPREIDING.hefboomAftrek;
  spreiding = Math.round(begrens(spreiding));

  const score = Math.round(WEGING.consistentie * consistentie + WEGING.risico * risico + WEGING.spreiding * spreiding);
  const kleur = score >= GRENS_KOPIEER ? 'GROEN' : score >= GRENS_VOLG ? 'GEEL' : 'ROOD';
  const oordeel: Oordeel = kleur === 'GROEN' ? 'KOPIEER' : kleur === 'GEEL' ? 'VOLG' : 'VERMIJD';

  return {
    score,
    oordeel,
    csl: copyStopLossAdvies(kleur, maxDalingPct ?? 30),
    consistentie,
    risico,
    spreiding,
    rendementPct,
    maxDalingPct,
  };
}

// ---------- Nieuwe en verdwenen trades ----------

// Alleen de posities die de trader zelf opende. Een positie die hij van iemand anders kopieert is
// niet zijn beslissing.
// Alle bruikbare posities, ook wat de belegger zelf via zijn eigen copies heeft. eToro's CopyTrader
// kopieert die mee, dus de toets voor Kopieer alles moet ze ook zien.
export function allePosities(portfolio: TraderLivePortfolio | null | undefined): TraderPositie[] {
  const lijst = Array.isArray(portfolio?.positions) ? portfolio!.positions! : [];
  return lijst.filter(p =>
    p && typeof p.positionId === 'number' && p.positionId > 0
    && typeof p.instrumentId === 'number'
    && typeof p.openRate === 'number' && p.openRate > 0,
  );
}

// Alleen wat de belegger zelf opende, zonder zijn eigen copies: dat zijn de trades die Kader los
// kopieert en meldt.
export function directePosities(portfolio: TraderLivePortfolio | null | undefined): TraderPositie[] {
  return allePosities(portfolio).filter(p =>
    !(typeof p.parentPositionId === 'number' && p.parentPositionId > 0)
    && !(typeof p.socialTradeId === 'number' && p.socialTradeId > 0),
  );
}

export function nieuwePosities(bekend: readonly number[], huidig: readonly TraderPositie[]): TraderPositie[] {
  const set = new Set(bekend);
  return huidig.filter(p => !set.has(p.positionId));
}

export function verdwenenPosities(bekend: readonly number[], huidig: readonly TraderPositie[]): number[] {
  const nu = new Set(huidig.map(p => p.positionId));
  return bekend.filter(id => !nu.has(id));
}

// ---------- Profiel: rendementslijn en verdeling ----------

export interface RendementPunt {
  tijd: number;
  // Cumulatief rendement sinds het begin van de eerste maand, in procenten.
  pct: number;
}

function maandBegin(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function volgendeMaand(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

// Maandrendementen op elkaar gestapeld tot één lijn: begint op 0 aan het begin van de eerste maand,
// en elk volgend punt is het einde van een maand. De lopende maand eindigt op nu.
export function cumulatiefRendement(maanden: { datum: string; pct: number }[], nu = Date.now()): RendementPunt[] {
  const geldig = maanden
    .map(m => ({ t: Date.parse(m.datum), pct: m.pct }))
    .filter(m => Number.isFinite(m.t) && Number.isFinite(m.pct))
    .sort((a, b) => a.t - b.t);
  if (geldig.length === 0) return [];
  const punten: RendementPunt[] = [{ tijd: maandBegin(geldig[0].t), pct: 0 }];
  let factor = 1;
  geldig.forEach((m, i) => {
    factor *= 1 + m.pct / 100;
    const eind = i + 1 < geldig.length ? maandBegin(geldig[i + 1].t) : Math.min(volgendeMaand(m.t), nu);
    // De tijd moet oplopen, ook als eToro twee regels in dezelfde maand stuurt.
    const tijd = Math.max(eind, punten[punten.length - 1].tijd + 1);
    punten.push({ tijd, pct: (factor - 1) * 100 });
  });
  return punten;
}

// Wat BTC op dezelfde momenten deed, in procenten sinds het eerste punt. Null als er ook maar één
// koers ontbreekt: een halve vergelijkingslijn is erger dan geen.
export function btcVergelijking(punten: RendementPunt[], koersOp: (ms: number) => number | null): number[] | null {
  if (punten.length < 2) return null;
  const basis = koersOp(punten[0].tijd);
  if (basis === null || basis <= 0) return null;
  const uit: number[] = [];
  for (const p of punten) {
    const k = koersOp(p.tijd);
    if (k === null) return null;
    uit.push((k / basis - 1) * 100);
  }
  return uit;
}

export const OVERIGE_CRYPTO = '__overig__';
export const BUITEN_KADER = '__buiten__';

export interface TraderSegment {
  sleutel: string;
  label: string;
  // 0..1
  aandeel: number;
}

// Waar zijn geld nu in zit, naar investmentPct per positie. Kaders coins los (de grootste vijf),
// de rest van die coins samen, en alles wat geen Kader-coin is als één segment. Zonder
// investmentPct telt een positie als 1, net als bij "crypto nu".
export function traderVerdeling(
  posities: TraderPositie[],
  symbolen: Record<string, string | null>,
  maxLos = 5,
): TraderSegment[] {
  const gewicht = (p: TraderPositie) => (p.investmentPct && p.investmentPct > 0 ? p.investmentPct : 1);
  const perSymbool = new Map<string, number>();
  let buiten = 0;
  for (const p of posities) {
    const symbool = symbolen[String(p.instrumentId)];
    if (symbool) perSymbool.set(symbool, (perSymbool.get(symbool) ?? 0) + gewicht(p));
    else buiten += gewicht(p);
  }
  const totaal = [...perSymbool.values()].reduce((a, b) => a + b, 0) + buiten;
  if (totaal <= 0) return [];
  const gesorteerd = [...perSymbool.entries()].sort((a, b) => b[1] - a[1]);
  const uit: TraderSegment[] = gesorteerd.slice(0, maxLos).map(([s, w]) => ({ sleutel: s, label: s, aandeel: w / totaal }));
  const rest = gesorteerd.slice(maxLos);
  if (rest.length > 0) {
    uit.push({ sleutel: OVERIGE_CRYPTO, label: `Overige coins (${rest.length})`, aandeel: rest.reduce((a, [, w]) => a + w, 0) / totaal });
  }
  if (buiten > 0) uit.push({ sleutel: BUITEN_KADER, label: 'Buiten Kaders coins', aandeel: buiten / totaal });
  return uit;
}

// ---------- Is deze trade nog te kopiëren? ----------

// Staat de koers meer dan dit boven de instap van de trader, dan ben je te laat. Startwaarde, zie
// docs/copy-trading-plan.md 1.1.
export const MAX_VERSCHUIVING_PCT = 2;

export type CopyStand =
  | { soort: 'kopieerbaar'; verschuivingPct: number | null }
  | { soort: 'te-laat'; verschuivingPct: number }
  | { soort: 'onder-stop' }
  | { soort: 'short' }
  | { soort: 'gesloten' }
  | { soort: 'buiten-kader' };

// symbool null = deze coin hoort niet bij de 57 van Kader. koers null = nog niet bekend; dan mag
// kopiëren wel, want de koopsheet haalt zelf nog een verse koers en het saldo op.
export function beoordeelCopyTrade(invoer: {
  positie: TraderPositie;
  symbool: string | null;
  koers: number | null;
  stop: number | null;
  gesloten: boolean;
}): CopyStand {
  const { positie, symbool, koers, stop, gesloten } = invoer;
  if (gesloten) return { soort: 'gesloten' };
  if (!symbool) return { soort: 'buiten-kader' };
  if (!positie.isBuy) return { soort: 'short' };
  if (koers === null || !(koers > 0)) return { soort: 'kopieerbaar', verschuivingPct: null };
  if (stop !== null && stop > 0 && koers <= stop) return { soort: 'onder-stop' };
  const verschuivingPct = ((koers - positie.openRate) / positie.openRate) * 100;
  if (verschuivingPct > MAX_VERSCHUIVING_PCT) return { soort: 'te-laat', verschuivingPct };
  return { soort: 'kopieerbaar', verschuivingPct };
}

// Welke stop en welk doel gaan mee met de kopie. Eerst die van de trader (omgerekend naar Kaders
// eenheid met de koersfactor), anders Kaders eigen niveaus. Een niveau aan de verkeerde kant van de
// koers telt niet: een stop boven de koers zou de positie meteen sluiten.
export function copyNiveaus(invoer: {
  positie: TraderPositie;
  factor: number;
  koers: number;
  kaderStop: number | null;
  kaderDoel: number | null;
}): { stop: number | null; doel: number | null; stopVan: 'trader' | 'kader' | null; doelVan: 'trader' | 'kader' | null } {
  const { positie, koers } = invoer;
  const factor = invoer.factor > 0 && Number.isFinite(invoer.factor) ? invoer.factor : 1;

  // eToro stuurt bij "geen stop" een onzinkoers, ver van de instap (zie echtNiveau in etoro.ts).
  const redelijk = (v: number | undefined): number | null => {
    if (typeof v !== 'number' || !(v > 0)) return null;
    const kader = v / factor;
    const instap = positie.openRate / factor;
    if (kader < instap / 100 || kader > instap * 100) return null;
    return kader;
  };

  const traderStop = redelijk(positie.stopLossRate);
  const traderDoel = redelijk(positie.takeProfitRate);

  const stop = traderStop !== null && traderStop < koers ? traderStop
    : invoer.kaderStop !== null && invoer.kaderStop > 0 && invoer.kaderStop < koers ? invoer.kaderStop
    : null;
  const doel = traderDoel !== null && traderDoel > koers ? traderDoel
    : invoer.kaderDoel !== null && invoer.kaderDoel > koers ? invoer.kaderDoel
    : null;

  return {
    stop,
    doel,
    stopVan: stop === null ? null : stop === traderStop ? 'trader' : 'kader',
    doelVan: doel === null ? null : doel === traderDoel ? 'trader' : 'kader',
  };
}

// ---------- Kopieer alles via eToro ----------

// Bij "Kopieer alles" neemt eToro ook shorts en hefboom over. Alleen rustige traders, zie plan 4.
export const MAX_GEM_HEFBOOM = 2;
export const MAX_SHORT_PCT = 20;
// De Copy Stop Loss mag krapper dan het advies, nooit ruimer dan dit.
export const MAX_CSL = 50;
export const MIN_CSL = 5;

export interface AllesKopierenToets {
  mag: boolean;
  gemHefboom: number;
  shortPct: number;
}

// Gemeten op de live portfolio, gewogen naar inzet. Zonder open posities valt er niets te meten,
// en dan is het antwoord nee: een lege portefeuille zegt niets over hoe hij straks handelt.
export function toetsAllesKopieren(posities: readonly TraderPositie[]): AllesKopierenToets {
  if (posities.length === 0) return { mag: false, gemHefboom: 0, shortPct: 0 };
  const gewicht = (p: TraderPositie) => (typeof p.investmentPct === 'number' && p.investmentPct > 0 ? p.investmentPct : 1);
  const totaal = posities.reduce((s, p) => s + gewicht(p), 0);
  const gemHefboom = posities.reduce((s, p) => s + gewicht(p) * (p.leverage && p.leverage > 0 ? p.leverage : 1), 0) / totaal;
  const shortPct = (posities.filter(p => !p.isBuy).reduce((s, p) => s + gewicht(p), 0) / totaal) * 100;
  return {
    mag: gemHefboom <= MAX_GEM_HEFBOOM && shortPct <= MAX_SHORT_PCT,
    gemHefboom: Math.round(gemHefboom * 10) / 10,
    shortPct: Math.round(shortPct),
  };
}

export function begrensCsl(waarde: number): number {
  if (!Number.isFinite(waarde)) return MIN_CSL;
  return Math.round(begrens(waarde, MIN_CSL, MAX_CSL));
}

// eToro wil een referenceID van hooguit 35 tekens, URL-veilig, zonder '/'. Hij is geen
// idempotentiesleutel: hergebruik maakt een nieuwe operatie, dus elke start krijgt een eigen.
export function copyReferentie(): string {
  const tekens = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let staart = '';
  for (let i = 0; i < 20; i++) staart += tekens[Math.floor(Math.random() * tekens.length)];
  return `kader-${staart}`;
}

// ponytail: self-check ipv testframework, run met `npx tsx src/engine/copyTrading.ts` vanuit app/
// ---------- Kaders eigen trackrecord ----------
// Wat een favoriet deed sinds je hem een ster gaf, gemeten door Kader zelf: elke long-trade in een
// Kader-coin met de instap van de trader, en als uitstap de koers op het moment dat Kader zag dat de
// positie weg was. Dat laatste is een benadering (de check loopt elke minuut tot elk kwartier), dus
// de app zegt er "ongeveer" bij. Alleen long: dat is wat je via Kader kunt kopiëren.

export interface TrackrecordTrade {
  // "username:positionId", net als de Feed.
  sleutel: string;
  username: string;
  symbool: string;
  // In Kaders koers (al gedeeld door de koersfactor).
  instap: number;
  geopend: number;
  uitstap: number | null;
  gesloten: number | null;
}

export function trackrecordPct(t: Pick<TrackrecordTrade, 'instap' | 'uitstap'>): number | null {
  if (t.uitstap === null || !(t.instap > 0) || !(t.uitstap > 0)) return null;
  return ((t.uitstap - t.instap) / t.instap) * 100;
}

export interface TrackrecordSamenvatting {
  // Gesloten trades met een bekende uitstap.
  aantal: number;
  // Gemiddeld resultaat per trade in procent, of null zonder gesloten trades.
  gemPct: number | null;
  // Hoeveel daarvan met winst.
  winst: number;
  // Nog open.
  open: number;
}

export function vatTrackrecordSamen(trades: readonly TrackrecordTrade[], username: string): TrackrecordSamenvatting {
  const van = trades.filter(t => t.username.toLowerCase() === username.toLowerCase());
  const pcts = van.map(trackrecordPct).filter((p): p is number => p !== null);
  return {
    aantal: pcts.length,
    gemPct: pcts.length > 0 ? pcts.reduce((s, p) => s + p, 0) / pcts.length : null,
    winst: pcts.filter(p => p > 0).length,
    open: van.filter(t => t.gesloten === null).length,
  };
}

if (require.main === module) {
  let missers = 0;
  const check = (voorwaarde: boolean, tekst: string) => {
    if (!voorwaarde) {
      missers++;
      console.error(`MIS: ${tekst}`);
    }
  };

  // alsPct leest fractie en procent.
  check(alsPct(0.25) === 25, 'een fractie wordt procent');
  check(alsPct(25) === 25, 'een procent blijft procent');
  check(alsPct(-0.3) === -30, 'een negatieve fractie wordt negatief procent');
  check(alsPct(undefined) === null, 'een ontbrekend veld is null, geen 0');

  // Drempels.
  check(haaltDrempels({ cid: 1, username: 'a', riskScore: 6, weeksSinceRegistration: 60 }), 'risico 6 en een jaar actief mag');
  check(!haaltDrempels({ cid: 1, username: 'a', riskScore: 7 }), 'risico 7 is te wild');
  check(!haaltDrempels({ cid: 1, username: 'a', weeksSinceRegistration: 20 }), 'minder dan een jaar actief valt af');
  check(!haaltDrempels({ cid: 1, username: 'a', type: 'smart-portfolio' }), 'een Smart Portfolio is geen trader');

  // Crypto-herkenning.
  check(isCryptoTrader({ cid: 1, username: 'a', topTradedInstrumentId: 100000 }, new Set([10]), new Set([100000])),
    'meest verhandeld BTC maakt een crypto-trader');
  check(isCryptoTrader({ cid: 1, username: 'a', topTradedAssetClassId: 10 }, new Set([10]), new Set()),
    'assetclass crypto telt');
  check(!isCryptoTrader({ cid: 1, username: 'a', topTradedAssetClassId: 5 }, new Set([10]), new Set()),
    'aandelen-trader valt af');
  check(isCryptoTrader({ cid: 1, username: 'a', topTradedAssetClassId: 5 }, null, new Set()),
    'zonder crypto-klassen geen filter');

  // Score.
  {
    const goed = beoordeelRij({
      cid: 1, username: 'rustig', gain: 0.35, riskScore: 3, peakToValley: -0.12,
      profitableMonthsPct: 75, topTradedInstrumentPct: 25, highLeveragePct: 0,
    });
    check(goed.oordeel === 'KOPIEER', `rustige winnaar hoort KOPIEER, was ${goed.oordeel} (${goed.score})`);
    const gok = beoordeelRij({
      cid: 2, username: 'gok', gain: 2.5, riskScore: 6, peakToValley: -0.55,
      profitableMonthsPct: 42, topTradedInstrumentPct: 90, highLeveragePct: 60,
    });
    check(gok.oordeel === 'VERMIJD', `grote winst met grote daling hoort VERMIJD, was ${gok.oordeel} (${gok.score})`);
    check(gok.score < goed.score, 'de gokker scoort lager dan de rustige trader');
    check(goed.csl >= 20 && goed.csl <= 40, 'Copy Stop Loss bij KOPIEER tussen 20 en 40');
  }

  // Nieuwe en verdwenen posities.
  {
    const p = (id: number, extra: Partial<TraderPositie> = {}): TraderPositie =>
      ({ positionId: id, instrumentId: 100000, openRate: 100, isBuy: true, ...extra });
    const huidig = directePosities({ positions: [p(1), p(2), p(3, { parentPositionId: 9 }), p(4, { socialTradeId: 5 })] });
    check(huidig.length === 2, 'gekopieerde posities van de trader tellen niet mee');
    check(nieuwePosities([1], huidig).map(x => x.positionId).join() === '2', 'positie 2 is nieuw');
    check(verdwenenPosities([1, 2, 7], huidig).join() === '7', 'positie 7 is gesloten');
    check(directePosities(null).length === 0, 'geen portfolio is geen posities');
  }

  // Te laat, onder de stop, short.
  {
    const positie: TraderPositie = { positionId: 1, instrumentId: 1, openRate: 100, isBuy: true };
    check(beoordeelCopyTrade({ positie, symbool: 'BTC', koers: 101.5, stop: 95, gesloten: false }).soort === 'kopieerbaar', '1,5% hoger mag');
    check(beoordeelCopyTrade({ positie, symbool: 'BTC', koers: 103, stop: 95, gesloten: false }).soort === 'te-laat', '3% hoger is te laat');
    check(beoordeelCopyTrade({ positie, symbool: 'BTC', koers: 94, stop: 95, gesloten: false }).soort === 'onder-stop', 'onder de stop');
    check(beoordeelCopyTrade({ positie: { ...positie, isBuy: false }, symbool: 'BTC', koers: 100, stop: null, gesloten: false }).soort === 'short', 'short');
    check(beoordeelCopyTrade({ positie, symbool: null, koers: 100, stop: null, gesloten: false }).soort === 'buiten-kader', 'onbekende coin');
    check(beoordeelCopyTrade({ positie, symbool: 'BTC', koers: 100, stop: null, gesloten: true }).soort === 'gesloten', 'al gesloten gaat voor');
    check(beoordeelCopyTrade({ positie, symbool: 'BTC', koers: null, stop: null, gesloten: false }).soort === 'kopieerbaar', 'zonder koers mag de sheet beslissen');
  }

  // Niveaus.
  {
    const positie: TraderPositie = { positionId: 1, instrumentId: 1, openRate: 100, isBuy: true, stopLossRate: 90, takeProfitRate: 130 };
    const a = copyNiveaus({ positie, factor: 1, koers: 101, kaderStop: 95, kaderDoel: 120 });
    check(a.stop === 90 && a.stopVan === 'trader' && a.doel === 130 && a.doelVan === 'trader', 'niveaus van de trader gaan voor');
    const b = copyNiveaus({ positie: { ...positie, stopLossRate: 0.0000001, takeProfitRate: undefined }, factor: 1, koers: 101, kaderStop: 95, kaderDoel: 120 });
    check(b.stop === 95 && b.stopVan === 'kader' && b.doel === 120 && b.doelVan === 'kader', 'onzinstop van eToro valt terug op Kader');
    const c = copyNiveaus({ positie: { ...positie, stopLossRate: 105 }, factor: 1, koers: 101, kaderStop: null, kaderDoel: null });
    check(c.stop === null, 'een stop boven de koers gaat nooit mee');
    const d = copyNiveaus({ positie: { ...positie, openRate: 20, stopLossRate: 18 }, factor: 1_000_000, koers: 0.0000195, kaderStop: null, kaderDoel: null });
    check(d.stop !== null && Math.abs(d.stop - 0.000018) < 1e-12, 'koersfactor rekent eToro-eenheid terug naar Kader');
  }

  // Kopieer alles.
  {
    const rustig = toetsAllesKopieren([
      { positionId: 1, instrumentId: 1, openRate: 1, isBuy: true, leverage: 1, investmentPct: 50 },
      { positionId: 2, instrumentId: 1, openRate: 1, isBuy: true, leverage: 2, investmentPct: 50 },
    ]);
    check(rustig.mag && rustig.gemHefboom === 1.5, 'gemiddeld 1,5x zonder shorts mag');
    const wild = toetsAllesKopieren([
      { positionId: 1, instrumentId: 1, openRate: 1, isBuy: false, leverage: 5, investmentPct: 50 },
      { positionId: 2, instrumentId: 1, openRate: 1, isBuy: true, leverage: 1, investmentPct: 50 },
    ]);
    check(!wild.mag && wild.shortPct === 50, 'half short met hefboom mag niet');
    check(!toetsAllesKopieren([]).mag, 'lege portefeuille: nee');
    check(begrensCsl(80) === MAX_CSL && begrensCsl(0) === MIN_CSL && begrensCsl(25) === 25, 'Copy Stop Loss begrensd');
    const ref = copyReferentie();
    check(ref.length <= 35 && /^[a-z0-9-]+$/.test(ref), 'referentie past in eToro\'s eisen');
  }

  // Trackrecord.
  {
    const t = (sleutel: string, instap: number, uitstap: number | null, username = 'rik'): TrackrecordTrade =>
      ({ sleutel, username, symbool: 'BTC', instap, geopend: 1, uitstap, gesloten: uitstap === null ? null : 2 });
    check(trackrecordPct(t('a', 100, 110)) === 10, 'winst van 10%');
    check(trackrecordPct(t('a', 100, null)) === null, 'open trade heeft geen resultaat');
    check(trackrecordPct(t('a', 0, 50)) === null, 'instap 0 geeft geen resultaat');
    const s = vatTrackrecordSamen([t('a', 100, 110), t('b', 100, 95), t('c', 100, null), t('d', 100, 120, 'cor')], 'RIK');
    check(s.aantal === 2 && s.gemPct === 2.5 && s.winst === 1 && s.open === 1, 'samenvatting per trader, hoofdletterongevoelig');
    check(vatTrackrecordSamen([], 'rik').gemPct === null, 'zonder trades geen gemiddelde');
    // waaromBuiten volgt haaltDrempels.
    const basis = { cid: 1, username: 'x', type: 'trader', riskScore: 4, weeksSinceRegistration: 100 } as RanglijstRij;
    for (const r of [basis, { ...basis, riskScore: 8 }, { ...basis, weeksSinceRegistration: 10 }, { ...basis, type: 'portfolio' }] as RanglijstRij[]) {
      check(haaltDrempels(r) === (waaromBuiten(r) === null), `waaromBuiten en haaltDrempels zijn het eens (${JSON.stringify(r)})`);
    }
    // Zoeken: een regel zonder de velden voor de drempels geldt als buiten.
    check(ontbreektVoorDrempels({ ...basis, topTradedAssetClassId: 10 } as RanglijstRij) === null, 'volle regel mist niets');
    check(ontbreektVoorDrempels({ cid: 0, username: 'x', gain: 30, riskScore: 4, copiers: 9 } as RanglijstRij) !== null,
      'regel met alleen gain, risico en copiers is onvolledig');
    check(ontbreektVoorDrempels({ ...basis } as RanglijstRij) !== null, 'zonder instrument of klasse is onvolledig');
  }

  // Rendementslijn en BTC-vergelijking.
  {
    const lijn = cumulatiefRendement([
      { datum: '2026-02-01', pct: -10 },
      { datum: '2026-01-01', pct: 10 },
    ], Date.UTC(2026, 1, 15));
    check(lijn.length === 3 && lijn[0].pct === 0 && lijn[0].tijd === Date.UTC(2026, 0, 1), 'lijn begint op 0, begin eerste maand');
    check(Math.abs(lijn[1].pct - 10) < 1e-9 && lijn[1].tijd === Date.UTC(2026, 1, 1), 'na januari +10%');
    check(Math.abs(lijn[2].pct - -1) < 1e-9, `+10% en dan -10% is -1%, kreeg ${lijn[2].pct}`);
    check(lijn[2].tijd === Date.UTC(2026, 1, 15), 'lopende maand eindigt op nu');
    check(cumulatiefRendement([]).length === 0, 'geen maanden, geen lijn');
    const koers = (ms: number) => (ms === lijn[0].tijd ? 100 : ms === lijn[1].tijd ? 120 : 90);
    const btc = btcVergelijking(lijn, koers)!;
    check(btc[0] === 0 && Math.abs(btc[1] - 20) < 1e-9 && Math.abs(btc[2] - -10) < 1e-9, 'BTC in procenten sinds het eerste punt');
    check(btcVergelijking(lijn, ms => (ms === lijn[2].tijd ? null : 100)) === null, 'ontbrekende koers: geen BTC-lijn');
  }

  // Verdeling van een trader.
  {
    const pos = (instrumentId: number, investmentPct?: number) => ({ positionId: instrumentId, instrumentId, openRate: 1, isBuy: true, investmentPct }) as TraderPositie;
    const sym: Record<string, string | null> = { 1: 'BTC', 2: 'ETH', 3: 'SOL', 4: null };
    const v = traderVerdeling([pos(1, 50), pos(2, 20), pos(3, 10), pos(4, 20)], sym, 2);
    check(v.map(s => s.sleutel).join(',') === `BTC,ETH,${OVERIGE_CRYPTO},${BUITEN_KADER}`, `volgorde segmenten, kreeg ${v.map(s => s.sleutel)}`);
    check(Math.abs(v.reduce((a, s) => a + s.aandeel, 0) - 1) < 1e-9, 'aandelen tellen op tot 1');
    check(Math.abs(v[0].aandeel - 0.5) < 1e-9 && Math.abs(v[3].aandeel - 0.2) < 1e-9, 'BTC 50%, buiten 20%');
    check(traderVerdeling([], sym).length === 0, 'geen posities, geen verdeling');
  }

  if (missers > 0) {
    console.error(`copyTrading.ts self-check GEFAALD: ${missers} controle(s) klopten niet`);
    process.exit(1);
  }
  console.log('copyTrading.ts self-check geslaagd');
}
