// Het plan van Kader in dollars: wat je verliest als de stop geraakt wordt en wat je wint bij het
// doel, voor het bedrag dat je nu intikt. Plus de rekenregels achter de grepen in het venster
// Stop en doel. Bewust puur (geen UI, geen netwerk), zodat de self-check onderaan los te draaien is.
//
// Alles rekent zonder hefboom, net als de rest van Kader: je aantal coins is bedrag / entry, en
// elk resultaat is aantal * (koers - entry) * teken, met teken -1 voor een short.
import { bepaalStop, type StopLossLimiet } from './etoroLimieten';
import type { Richting } from './types';

const tekenVan = (richting: Richting): 1 | -1 => (richting === 'short' ? -1 : 1);
const geldig = (n: number | undefined): n is number => typeof n === 'number' && isFinite(n) && n > 0;

export interface PlanInGeld {
  // Resultaat in dollars als de stop geraakt wordt. Negatief is verlies; positief kan ook, als de
  // stop al voorbij de entry ligt en er dus winst vaststaat. null als er geen stop is.
  bijStop: number | null;
  // Resultaat in dollars bij het doel. null als er geen doel is.
  bijDoel: number | null;
  // Beloning gedeeld door risico. null als er geen stop of doel is, of als de stop geen risico meer
  // draagt (hij ligt al aan de winstkant van de entry).
  rr: number | null;
}

export function planInGeld(invoer: {
  bedrag: number;
  entry: number;
  stop?: number;
  doel?: number;
  richting: Richting;
}): PlanInGeld | null {
  const { bedrag, entry, stop, doel, richting } = invoer;
  if (!geldig(bedrag) || !geldig(entry)) return null;
  const teken = tekenVan(richting);
  const aantal = bedrag / entry;
  const bijStop = geldig(stop) ? aantal * (stop - entry) * teken : null;
  const bijDoel = geldig(doel) ? aantal * (doel - entry) * teken : null;
  const rr = bijStop !== null && bijDoel !== null && bijStop < 0 && bijDoel > 0 ? bijDoel / -bijStop : null;
  return { bijStop, bijDoel, rr };
}

export interface Sluiting {
  // Geschat resultaat in dollars op de koers van nu. eToro sluit op zijn eigen koers en rekent kosten.
  resultaat: number;
  // Resultaat als percentage van de inleg.
  pct: number;
  // Wat er ongeveer terugkomt op je saldo: inleg plus resultaat.
  terug: number;
}

export function schatSluiting(invoer: {
  inleg: number;
  aantal: number;
  entry: number;
  prijs: number | undefined;
  richting: Richting;
}): Sluiting | null {
  const { inleg, aantal, entry, prijs, richting } = invoer;
  if (!geldig(inleg) || !geldig(aantal) || !geldig(entry) || !geldig(prijs)) return null;
  const resultaat = aantal * (prijs - entry) * tekenVan(richting);
  return { resultaat, pct: (resultaat / inleg) * 100, terug: inleg + resultaat };
}

// Een nette stapgrootte voor de -/+ knoppen en de grepen, ongeveer 0,25% van de prijs, afgerond op
// 1, 2 of 5 keer een macht van tien. Zo krijgt BTC stappen van $200 en PEPE stappen van een paar
// honderdmiljoensten, in plaats van één vaste $10 die voor de ene coin te grof en de andere te fijn is.
export function stapGrootte(prijs: number): number {
  if (!geldig(prijs)) return 0;
  const doel = prijs * 0.0025;
  const macht = Math.pow(10, Math.floor(Math.log10(doel)));
  for (const f of [1, 2, 5, 10]) {
    if (f * macht >= doel) return f * macht;
  }
  return 10 * macht;
}

// Rond een niveau af op het raster van de stap, zonder zwevende-komma-staartjes als 0.30000000000000004.
export function opStap(waarde: number, stap: number): number {
  if (!geldig(stap)) return waarde;
  const decimalen = Math.max(0, -Math.floor(Math.log10(stap)) + 1);
  return Number((Math.round(waarde / stap) * stap).toFixed(decimalen));
}

// Tekst voor een veld na slepen of een -/+ stap: afgerond op het raster van de halve stap, zonder
// staartje als 0.31292999965. Ligt de afgeronde waarde net buiten het bereik (de rand van eToro's
// grens is zelden een rond getal), dan een raster-tik terug naar binnen, zodat het veld nooit een
// stop toont die bepaalStop zou bijstellen.
export function alsVeldTekst(waarde: number, stap: number, bereik: Bereik | null): string {
  if (!isFinite(waarde)) return '';
  if (!geldig(stap)) return String(waarde);
  const decimalen = Math.max(0, -Math.floor(Math.log10(stap / 2)) + 1);
  const tik = Math.pow(10, -decimalen);
  let r = Number(waarde.toFixed(decimalen));
  if (bereik && r > bereik.max) r = Number((r - tik).toFixed(decimalen));
  if (bereik && r < bereik.min) r = Number((r + tik).toFixed(decimalen));
  return zonderExponent(r);
}

export interface Bereik {
  min: number;
  max: number;
}

export interface GreepBereik {
  // null = er is geen stop te kiezen die zowel eToro's grens als de koers van nu respecteert. De
  // greep staat dan stil; een getypt niveau gaat door bepaalStop zoals altijd.
  stop: Bereik | null;
  doel: Bereik | null;
}

// Hoe ver je de grepen mag slepen. Twee soorten grenzen:
// - de koers van nu: een stop hoort aan de verlieskant van de koers, een doel aan de winstkant,
//   met minstens één stap ruimte;
// - eToro's stop-loss-grens voor deze coin (minimaal en maximaal zoveel procent van de entry, bij
//   een long met koers van de koers, want zo meet eToro bij het wijzigen).
// Zonder limiet (geen koppeling of een API-fout) verzinnen we geen eToro-grens; zonder live koers
// geen koersgrens. Alles binnen het bereik geeft bij bepaalStop 'ok', dus een greep kan nooit een
// stop opleveren die eToro weigert of die Kader zelf zou bijstellen.
export function greepBereik(invoer: {
  entry: number;
  live?: number;
  richting: Richting;
  limiet: StopLossLimiet | null;
  stap: number;
}): GreepBereik {
  const { entry, live, richting, limiet, stap } = invoer;
  if (!geldig(entry) || !geldig(stap)) return { stop: null, doel: null };
  const short = richting === 'short';
  const heeftLive = geldig(live);
  // Een haar binnen de grens blijven, zodat een waarde precies op de rand door afronding niet net
  // aan de verkeerde kant valt.
  const marge = entry * 1e-9;
  const eToroGrens = limiet && limiet.bewerkbaar ? limiet : null;

  let stop: Bereik | null;
  if (limiet && !limiet.bewerkbaar) {
    // eToro laat de stop voor deze coin niet zetten: niets te slepen.
    stop = null;
  } else if (!short) {
    const plafonds = [Infinity];
    const vloeren = [stap];
    if (heeftLive) plafonds.push(live - stap);
    if (eToroGrens) {
      // Bij een lopende long meet eToro de afstand vanaf de huidige koers (meting 1 okt 2026), en
      // bepaalStop krijgt in NiveausSheet die koers als referentie. Met koers mag de greep dus tot
      // het minimum onder de koers, ook boven de entry: zo zet je winst vast. Zonder koers keurt
      // bepaalStop elke stop op of boven de entry af, dus dan blijft de entry de basis.
      const basis = heeftLive ? live : entry;
      const basisMarge = basis * 1e-9;
      plafonds.push(eToroGrens.minPct !== null ? basis * (1 - eToroGrens.minPct / 100) - basisMarge : basis - stap);
      if (eToroGrens.maxPct !== null) vloeren.push(basis * (1 - eToroGrens.maxPct / 100) + basisMarge);
    }
    const min = Math.max(...vloeren);
    const max = Math.min(...plafonds);
    // Zonder koers en zonder limiet is er geen plafond; de baan zelf begrenst het slepen dan.
    stop = min <= max ? { min, max } : null;
  } else {
    const vloeren = [stap];
    const plafonds = [Infinity];
    if (heeftLive) vloeren.push(live + stap);
    if (eToroGrens) {
      vloeren.push(eToroGrens.minPct !== null ? entry * (1 + eToroGrens.minPct / 100) + marge : entry + stap);
      if (eToroGrens.maxPct !== null) plafonds.push(entry * (1 + eToroGrens.maxPct / 100) - marge);
    }
    const min = Math.max(...vloeren);
    const max = Math.min(...plafonds);
    // Een short-stop zonder plafond heeft geen natuurlijk einde; de baan zelf begrenst het slepen.
    stop = min <= max ? { min, max } : null;
  }

  let doel: Bereik | null;
  if (!short) {
    doel = { min: heeftLive ? live + stap : stap, max: Infinity };
  } else {
    const max = heeftLive ? live - stap : Infinity;
    doel = stap <= max ? { min: stap, max } : null;
  }

  return { stop, doel };
}

export function klem(waarde: number, bereik: Bereik): number {
  return Math.min(bereik.max, Math.max(bereik.min, waarde));
}

// Snelknoppen in het koopvenster. "Max" laat ruimte voor dezelfde kostenmarge die de saldocheck in
// KooporderSheet hanteert, en rondt naar beneden af op centen: Max mag die check nooit laten falen.
export function maxBedrag(vrijSaldo: number, kostenmarge: number): number {
  if (!geldig(vrijSaldo) || !geldig(kostenmarge)) return 0;
  let max = Math.floor((vrijSaldo / kostenmarge) * 100) / 100;
  // Zwevende komma: 14 * 1.02 is 14.280000000000001, net boven een saldo van 14.28. Dan een cent
  // terug, tot de saldocheck in KooporderSheet (bedrag * marge > saldo) zeker niet afgaat.
  while (max > 0 && max * kostenmarge > vrijSaldo) max = Math.round((max - 0.01) * 100) / 100;
  return Math.max(0, max);
}

// Een niveau als tekst zonder exponent: String(0.0000005) is "5e-7", en wie daarin gaat typen
// krijgt van parseFloat iets heel anders terug. Tien significante cijfers, staartnullen weg.
export function zonderExponent(waarde: number): string {
  if (!isFinite(waarde)) return '';
  if (waarde === 0) return '0';
  const decimalen = Math.min(20, Math.max(0, 9 - Math.floor(Math.log10(Math.abs(waarde)))));
  const tekst = waarde.toFixed(decimalen);
  return tekst.includes('.') ? tekst.replace(/\.?0+$/, '') : tekst;
}

export function deelVanSaldo(vrijSaldo: number, deel: number, kostenmarge: number): number {
  if (!geldig(vrijSaldo) || !geldig(deel)) return 0;
  return Math.min(Math.floor(vrijSaldo * deel * 100) / 100, maxBedrag(vrijSaldo, kostenmarge));
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/planInGeld.ts`
if (require.main === module) {
  const bijna = (a: number | null | undefined, b: number, eps = 1e-6) => a !== null && a !== undefined && Math.abs(a - b) < eps;

  // Long: $250 in SOL op 148.62, stop 139.10, doel 171.30 (de cijfers uit het ontwerp).
  const sol = planInGeld({ bedrag: 250, entry: 148.62, stop: 139.1, doel: 171.3, richting: 'long' });
  console.assert(bijna(sol?.bijStop, -16.0140, 1e-3), `long bij stop -16.01 verwacht, was ${sol?.bijStop}`);
  console.assert(bijna(sol?.bijDoel, 38.1510, 1e-3), `long bij doel +38.15 verwacht, was ${sol?.bijDoel}`);
  console.assert(bijna(sol?.rr, 38.151 / 16.014, 1e-3), `long rr verwacht, was ${sol?.rr}`);

  // Short: $100 op entry 100, stop 110 erboven, doel 80 eronder. Stijgt de koers, dan verlies.
  const sh = planInGeld({ bedrag: 100, entry: 100, stop: 110, doel: 80, richting: 'short' });
  console.assert(bijna(sh?.bijStop, -10), `short bij stop -10 verwacht, was ${sh?.bijStop}`);
  console.assert(bijna(sh?.bijDoel, 20), `short bij doel +20 verwacht, was ${sh?.bijDoel}`);
  console.assert(bijna(sh?.rr, 2), `short rr 2 verwacht, was ${sh?.rr}`);

  // Long met de stop al boven de entry: winst staat vast, geen risico, dus geen R/R.
  const vast = planInGeld({ bedrag: 100, entry: 100, stop: 105, doel: 120, richting: 'long' });
  console.assert(bijna(vast?.bijStop, 5), `stop boven entry geeft +5, was ${vast?.bijStop}`);
  console.assert(vast?.rr === null, 'zonder risico geen R/R');

  // Short met de stop al onder de entry: ook winst vast.
  const shVast = planInGeld({ bedrag: 100, entry: 100, stop: 95, doel: 80, richting: 'short' });
  console.assert(bijna(shVast?.bijStop, 5), `short-stop onder entry geeft +5, was ${shVast?.bijStop}`);

  // Ontbrekende niveaus en ongeldige invoer.
  const zonderStop = planInGeld({ bedrag: 100, entry: 100, doel: 120, richting: 'long' });
  console.assert(zonderStop?.bijStop === null && bijna(zonderStop?.bijDoel, 20) && zonderStop?.rr === null, 'zonder stop alleen bij doel');
  console.assert(planInGeld({ bedrag: 0, entry: 100, stop: 90, doel: 120, richting: 'long' }) === null, 'bedrag 0 geeft niets');
  console.assert(planInGeld({ bedrag: NaN, entry: 100, stop: 90, richting: 'long' }) === null, 'NaN geeft niets');
  console.assert(planInGeld({ bedrag: 100, entry: 0, stop: 90, richting: 'long' }) === null, 'entry 0 geeft niets');

  // Sluiting, long en short.
  const sl = schatSluiting({ inleg: 200, aantal: 2, entry: 100, prijs: 110, richting: 'long' });
  console.assert(bijna(sl?.resultaat, 20) && bijna(sl?.pct, 10) && bijna(sl?.terug, 220), `long sluiting klopt niet: ${JSON.stringify(sl)}`);
  const ss = schatSluiting({ inleg: 200, aantal: 2, entry: 100, prijs: 110, richting: 'short' });
  console.assert(bijna(ss?.resultaat, -20) && bijna(ss?.pct, -10) && bijna(ss?.terug, 180), `short sluiting klopt niet: ${JSON.stringify(ss)}`);
  console.assert(schatSluiting({ inleg: 200, aantal: 2, entry: 100, prijs: undefined, richting: 'long' }) === null, 'zonder koers geen schatting');

  // Stapgrootte.
  console.assert(stapGrootte(3500) === 10, `ETH stap 10 verwacht, was ${stapGrootte(3500)}`);
  console.assert(stapGrootte(60000) === 200, `BTC stap 200 verwacht, was ${stapGrootte(60000)}`);
  console.assert(stapGrootte(148.62) === 0.5, `SOL stap 0.5 verwacht, was ${stapGrootte(148.62)}`);
  console.assert(stapGrootte(0) === 0, 'prijs 0 geeft stap 0');
  console.assert(opStap(0.1 + 0.2, 0.1) === 0.3, `opStap haalt het staartje weg, was ${opStap(0.1 + 0.2, 0.1)}`);

  // Greepbereik: elk punt binnen het stopbereik moet door bepaalStop als 'ok' komen.
  const limietLong: StopLossLimiet = { symbool: 'BTC', richting: 'long', bewerkbaar: true, minPct: 10, maxPct: 100 };
  const limietShort: StopLossLimiet = { symbool: 'BTC', richting: 'short', bewerkbaar: true, minPct: 10, maxPct: 50 };
  // `referentie` zoals NiveausSheet hem aan bepaalStop geeft: de koers, alleen bij een long.
  const allesOk = (entry: number, b: Bereik | null, limiet: StopLossLimiet, referentie?: number) => {
    if (!b) return false;
    const max = isFinite(b.max) ? b.max : b.min * 3;
    for (let i = 0; i <= 50; i += 1) {
      const w = b.min + ((max - b.min) * i) / 50;
      if (bepaalStop(entry, w, limiet, referentie).soort !== 'ok') return false;
    }
    return true;
  };

  // Lopende long met koers: eToro meet vanaf de koers, dus de greep mag tot 10% onder 62000.
  const gl = greepBereik({ entry: 60000, live: 62000, richting: 'long', limiet: limietLong, stap: 200 });
  console.assert(allesOk(60000, gl.stop, limietLong, 62000), `long greepbereik bevat een stop die bepaalStop niet ok vindt: ${JSON.stringify(gl.stop)}`);
  console.assert(gl.stop !== null && gl.stop.max <= 55800 && gl.stop.max > 55799.99, `long stop tot 10% onder de koers, was ${JSON.stringify(gl.stop)}`);
  console.assert(gl.doel !== null && gl.doel.min === 62200, 'long doel minstens een stap boven de koers');

  // Winst vastzetten: entry 100, koers 120. De greep mag boven de entry, tot 108, en niet hoger.
  const winst = greepBereik({ entry: 100, live: 120, richting: 'long', limiet: limietLong, stap: 1 });
  console.assert(allesOk(100, winst.stop, limietLong, 120), `winstgreep bevat een stop die bepaalStop niet ok vindt: ${JSON.stringify(winst.stop)}`);
  console.assert(winst.stop !== null && winst.stop.max > 100 && winst.stop.max <= 108 && winst.stop.max > 107.99,
    `de greep moet boven de entry tot 108 kunnen, was ${JSON.stringify(winst.stop)}`);

  // Long zonder koers: oud gedrag, de entry blijft de basis.
  const zonderKoers = greepBereik({ entry: 60000, richting: 'long', limiet: limietLong, stap: 200 });
  console.assert(allesOk(60000, zonderKoers.stop, limietLong), `long zonder koers bevat een stop die bepaalStop niet ok vindt: ${JSON.stringify(zonderKoers.stop)}`);
  console.assert(zonderKoers.stop !== null && zonderKoers.stop.max <= 54000, 'zonder koers blijft de stop minstens 10% onder de entry');

  const gs = greepBereik({ entry: 60000, live: 58000, richting: 'short', limiet: limietShort, stap: 200 });
  console.assert(allesOk(60000, gs.stop, limietShort), `short greepbereik bevat een stop die bepaalStop niet ok vindt: ${JSON.stringify(gs.stop)}`);
  console.assert(gs.stop !== null && gs.stop.min >= 66000 && gs.stop.max <= 90000, 'short stop tussen 10% en 50% boven de entry');
  console.assert(gs.doel !== null && gs.doel.max === 57800, 'short doel minstens een stap onder de koers');

  // Zonder limiet: alleen de koersgrens, geen verzonnen eToro-grens.
  const zl = greepBereik({ entry: 100, live: 110, richting: 'long', limiet: null, stap: 1 });
  console.assert(zl.stop !== null && zl.stop.max === 109 && zl.stop.min === 1, `zonder limiet alleen de koersgrens, was ${JSON.stringify(zl.stop)}`);

  // Zonder limiet en zonder koers: vrij, maar nog steeds boven nul.
  const vrij = greepBereik({ entry: 100, richting: 'long', limiet: null, stap: 1 });
  console.assert(vrij.stop !== null && vrij.stop.min === 1 && vrij.stop.max === Infinity, 'long zonder koers en limiet: alleen boven nul, de baan begrenst de rest');

  // eToro laat de stop niet zetten: geen greep.
  const nietBewerkbaar = greepBereik({ entry: 100, live: 110, richting: 'long', limiet: { ...limietLong, bewerkbaar: false }, stap: 1 });
  console.assert(nietBewerkbaar.stop === null, 'niet bewerkbaar betekent geen stopgreep');

  // Koers zo laag dat onder de koers geen stap meer past: geen geldige stop meer te slepen. (Met de
  // koers als basis telt eToro's maximum vanaf de koers, dus een diepe koers alleen is geen bezwaar.)
  const diep = greepBereik({ entry: 100, live: 1.5, richting: 'long', limiet: { ...limietLong, maxPct: 50 }, stap: 1 });
  console.assert(diep.stop === null, 'geen overlap tussen koersgrens en eToro-grens geeft geen stopgreep');

  // Veldtekst: geen staartjes, en een rand die niet rond is wordt naar binnen afgerond.
  console.assert(alsVeldTekst(0.31292999965, 0.001, { min: 0.0001, max: 0.31292999965 }) === '0.31292',
    `rand naar binnen afgerond verwacht, was ${alsVeldTekst(0.31292999965, 0.001, { min: 0.0001, max: 0.31292999965 })}`);
  console.assert(alsVeldTekst(0.3125, 0.001, null) === '0.3125', `0.3125 blijft staan, was ${alsVeldTekst(0.3125, 0.001, null)}`);
  console.assert(alsVeldTekst(66000.0000001, 200, { min: 66000.00006, max: 90000 }) === '66001',
    `short-rand naar binnen verwacht, was ${alsVeldTekst(66000.0000001, 200, { min: 66000.00006, max: 90000 })}`);
  console.assert(Number(alsVeldTekst(0.31292999965, 0.001, { min: 0.0001, max: 0.31292999965 })) <= 0.31292999965, 'veldtekst blijft binnen het bereik');

  // Snelknoppen.
  console.assert(maxBedrag(1000, 1.02) === 980.39, `max 980.39 verwacht, was ${maxBedrag(1000, 1.02)}`);
  console.assert(maxBedrag(1000, 1.02) * 1.02 <= 1000, 'max blijft binnen de saldocheck');
  console.assert(deelVanSaldo(1000, 0.25, 1.02) === 250, `25% van 1000 is 250, was ${deelVanSaldo(1000, 0.25, 1.02)}`);
  console.assert(maxBedrag(0, 1.02) === 0, 'geen saldo geen max');
  // Elke centstand van $10 tot $20.000: Max mag de saldocheck nooit laten afgaan.
  let maxFout = 0;
  for (let c = 1000; c <= 2000000; c += 1) {
    const v = c / 100;
    if (maxBedrag(v, 1.02) * 1.02 > v) maxFout += 1;
  }
  console.assert(maxFout === 0, `Max liet de saldocheck ${maxFout} keer afgaan`);
  console.assert(maxBedrag(14.28, 1.02) === 13.99, `Max bij 14.28 is 13.99, was ${maxBedrag(14.28, 1.02)}`);

  // Geen exponent in veldtekst.
  console.assert(zonderExponent(0.0000005) === '0.0000005', `zonder exponent, was ${zonderExponent(0.0000005)}`);
  console.assert(zonderExponent(0.00000506) === '0.00000506', `SHIB-prijs, was ${zonderExponent(0.00000506)}`);
  console.assert(zonderExponent(60000) === '60000', `BTC-prijs, was ${zonderExponent(60000)}`);
  console.assert(zonderExponent(0.311) === '0.311', `CRV-stop, was ${zonderExponent(0.311)}`);
  console.assert(alsVeldTekst(0.000000512, 0.000000002, null).indexOf('e') === -1, `veldtekst zonder exponent, was ${alsVeldTekst(0.000000512, 0.000000002, null)}`);

  console.log('planInGeld: self-check klaar');
}
