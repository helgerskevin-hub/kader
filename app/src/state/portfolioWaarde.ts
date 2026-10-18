// Je portfoliowaarde per dag, voor de grafiek bovenin Historie.
//
// Twee bronnen, en de echte gaat altijd voor:
//
//   1. Momentopnames. Elke keer dat de portfoliokaart een volledig totaal kent (eToro-saldo plus
//      alle posities met een live koers), bewaart Kader dat bedrag voor die kalenderdag. Dat is
//      exact wat eToro als equity toont, maar het bestaat pas vanaf de dag dat deze versie draait.
//   2. Terugrekenen. Voor de dagen daarvoor gaan we uit van de waarde op een bekend moment en
//      halen we eraf wat je portfolio sindsdien heeft verdiend of verloren: het gerealiseerde
//      resultaat van wat je in de tussentijd sloot, plus hoeveel de posities van toen bewogen.
//      Stortingen en opnames kent Kader niet, dus die zitten er niet in. De grafiek zegt dat erbij.
//
// Puur rekenwerk zonder React of opslag, zodat de self-check onderaan in Node draait.
import { PortfolioTrade, tekenVan } from './portfolioTypes';
import { resultaatVan } from './statistieken';
import { KoersPunt, koersOp } from './periodeResultaat';

const DAG_MS = 24 * 60 * 60 * 1000;
// Hoe ver de grafiek terugkijkt. Gelijk aan de langste periode in Historie (1J) en binnen de
// ~400 dagcandles die useResultaatHistorie per coin bewaart.
export const WAARDE_DAGEN = 365;
// Bovengrens op het aantal bewaarde momentopnames per omgeving: ruim een jaar.
export const MAX_MOMENTOPNAMES = 400;

export interface Momentopname {
  dag: string;    // lokale kalenderdag, 'JJJJ-MM-DD'
  tijd: number;   // epoch ms van de opname
  waarde: number; // totaal in dollars
}

export interface WaardePunt {
  tijd: number;
  waarde: number;
  // true = teruggerekend uit je trades, false = een echte momentopname of de waarde van nu.
  berekend: boolean;
}

export function dagSleutel(tijd: number): string {
  const d = new Date(tijd);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Zet de opname van vandaag in de lijst: één per kalenderdag, de laatste van de dag wint.
export function metMomentopname(lijst: Momentopname[], tijd: number, waarde: number): Momentopname[] {
  const dag = dagSleutel(tijd);
  const zonder = lijst.filter(m => m.dag !== dag);
  return [...zonder, { dag, tijd, waarde }]
    .sort((a, b) => a.tijd - b.tijd)
    .slice(-MAX_MOMENTOPNAMES);
}

// Wat je portfolio tot en met dit moment heeft opgeleverd: alles wat vóór `tijd` sloot, plus de
// koersbeweging van wat er op `tijd` open stond. Null als een open positie geen koers heeft, want
// dan zou de waarde van die dag stilzwijgend een gat bevatten.
export function resultaatOp(
  trades: PortfolioTrade[],
  koers: (symbool: string) => number | null,
  tijd: number,
): number | null {
  let som = 0;
  for (const t of trades) {
    const gesloten = t.status !== 'open' && typeof t.slotTijd === 'number';
    if (gesloten && t.slotTijd! <= tijd) {
      som += resultaatVan(t) ?? 0;
      continue;
    }
    // Zonder openingstijd valt niet te zeggen of de positie er toen al was; zonder aantal valt
    // hij niet te waarderen. Die blijven buiten de berekening.
    if (typeof t.openTijd !== 'number' || t.openTijd > tijd) continue;
    if (t.status !== 'open' && !gesloten) continue;
    if (typeof t.aantalCoins !== 'number' || t.aantalCoins <= 0) continue;
    const k = koers(t.symbool);
    if (k === null) return null;
    som += tekenVan(t) * (k - t.entryPrijs) * t.aantalCoins;
  }
  return som;
}

// Einde van de lokale kalenderdag, of `nu` voor vandaag.
function eindeVanDag(tijd: number): number {
  const d = new Date(tijd);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export interface WaardeInvoer {
  trades: PortfolioTrade[];
  koersen: Record<string, KoersPunt[]>;
  livePrijzen: Record<string, number>;
  momentopnames: Momentopname[];
  nu: number;
  // Het totaal van nu, zoals de portfoliokaart het toont. Null zonder eToro-saldo.
  waardeNu: number | null;
}

// De reeks, oudste eerst. Loopt van vandaag terug: elke dag zonder momentopname wordt afgeleid van
// het dichtstbijzijnde bekende punt erna, zodat een gat in je opnames de lijn niet laat verspringen.
export function berekenWaardeReeks(inv: WaardeInvoer): WaardePunt[] {
  const { trades, koersen, livePrijzen, momentopnames, nu, waardeNu } = inv;
  const perDag = new Map(momentopnames.map(m => [m.dag, m]));

  const live = (s: string) => (typeof livePrijzen[s] === 'number' ? livePrijzen[s] : null);
  const opDag = (tijd: number) => (s: string) => koersOp(koersen[s], tijd);

  const punten: WaardePunt[] = [];
  let anker: { waarde: number; resultaat: number } | null = null;

  if (waardeNu !== null) {
    const r = resultaatOp(trades, live, nu);
    punten.push({ tijd: nu, waarde: waardeNu, berekend: false });
    if (r !== null) anker = { waarde: waardeNu, resultaat: r };
  }

  const oudsteOpen = trades.reduce((min, t) => (typeof t.openTijd === 'number' ? Math.min(min, t.openTijd) : min), nu);
  const oudsteOpname = momentopnames.length > 0 ? momentopnames[0].tijd : nu;
  const begin = Math.max(Math.min(oudsteOpen, oudsteOpname), nu - WAARDE_DAGEN * DAG_MS);

  // Gisteren en verder terug. Vandaag is hierboven al gedaan met de live waarde; zonder live waarde
  // telt de opname van vandaag als eerste punt.
  for (let dag = waardeNu !== null ? eindeVanDag(nu) - DAG_MS : eindeVanDag(nu); dag >= begin - DAG_MS; dag -= DAG_MS) {
    const tijd = Math.min(dag, nu);
    const opname = perDag.get(dagSleutel(tijd));
    const r = resultaatOp(trades, opDag(tijd), tijd);
    if (opname) {
      punten.push({ tijd: opname.tijd, waarde: opname.waarde, berekend: false });
      if (r !== null) anker = { waarde: opname.waarde, resultaat: r };
      continue;
    }
    if (anker === null || r === null) continue;
    punten.push({ tijd, waarde: anker.waarde - (anker.resultaat - r), berekend: true });
  }

  return punten.reverse();
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/state/portfolioWaarde.ts`
if (require.main === module) {
  const nu = new Date(2026, 9, 18, 15, 0).getTime();
  const dagen = (n: number) => nu - n * DAG_MS;
  const reeks = (prijs: (d: number) => number): KoersPunt[] =>
    Array.from({ length: 40 }, (_, i) => ({ tijd: new Date(2026, 9, 18 - 39 + i, 0, 0).getTime(), close: prijs(39 - i) }));

  const basis = {
    id: 'x', naam: 'Bitcoin', stopLoss: 0, takeProfit: 0, rr: 0, datum: '', bron: 'etoro' as const,
  };
  // Tien dagen geleden 1 BTC gekocht op 100. De koers stijgt elke dag 1: vandaag 100 + 10 = 110.
  const btc: PortfolioTrade = { ...basis, symbool: 'BTC', entryPrijs: 100, aantalCoins: 1, status: 'open', openTijd: dagen(10) };
  const koersen = { BTC: reeks(d => 100 + (10 - d)) };

  // ---------- Terugrekenen vanaf nu ----------
  const r1 = berekenWaardeReeks({ trades: [btc], koersen, livePrijzen: { BTC: 110 }, momentopnames: [], nu, waardeNu: 1000 });
  console.assert(r1[r1.length - 1].waarde === 1000 && !r1[r1.length - 1].berekend, 'het laatste punt is de waarde van nu');
  const gisteren = r1[r1.length - 2];
  console.assert(Math.abs(gisteren.waarde - 999) < 1e-9 && gisteren.berekend,
    `gisteren stond BTC 1 lager, dus 999, was ${gisteren.waarde}`);
  console.assert(r1.every(p => p.waarde <= 1000), 'bij een stijgende koers ligt het verleden lager');

  // ---------- Een gesloten trade ----------
  // Vijf dagen geleden met 50 winst gesloten: vóór die dag was die 50 er nog niet.
  const eth: PortfolioTrade = {
    ...basis, id: 'e', symbool: 'ETH', entryPrijs: 10, aantalCoins: 5, status: 'gewonnen',
    openTijd: dagen(20), slotTijd: dagen(5), resultaatUsd: 50,
  };
  const ethKoers = { ...koersen, ETH: reeks(() => 10) };
  const r2 = berekenWaardeReeks({ trades: [eth], koersen: ethKoers, livePrijzen: {}, momentopnames: [], nu, waardeNu: 500 });
  const voor = r2.find(p => p.tijd < dagen(6));
  const na = r2.find(p => p.tijd > dagen(4) && p.tijd < nu);
  console.assert(voor !== undefined && Math.abs(voor.waarde - 450) < 1e-9, `vóór het sluiten 450, was ${voor?.waarde}`);
  console.assert(na !== undefined && Math.abs(na.waarde - 500) < 1e-9, `na het sluiten 500, was ${na?.waarde}`);

  // ---------- Momentopnames gaan voor ----------
  const opname: Momentopname = { dag: dagSleutel(dagen(3)), tijd: dagen(3), waarde: 2000 };
  const r3 = berekenWaardeReeks({ trades: [btc], koersen, livePrijzen: { BTC: 110 }, momentopnames: [opname], nu, waardeNu: 1000 });
  const opDag3 = r3.find(p => dagSleutel(p.tijd) === opname.dag);
  console.assert(opDag3?.waarde === 2000 && !opDag3.berekend, 'een momentopname staat er letterlijk in');
  // De dag ervoor rekent vanaf de opname, niet vanaf nu: 2000 min 1 koerspunt.
  const opDag4 = r3.find(p => dagSleutel(p.tijd) === dagSleutel(dagen(4)));
  console.assert(opDag4 !== undefined && Math.abs(opDag4.waarde - 1999) < 1e-9, `vóór een opname telt die opname, was ${opDag4?.waarde}`);

  // ---------- Zonder saldo en zonder opnames geen lijn ----------
  const r4 = berekenWaardeReeks({ trades: [btc], koersen, livePrijzen: { BTC: 110 }, momentopnames: [], nu, waardeNu: null });
  console.assert(r4.length === 0, 'zonder bekend totaal valt er niets te verzinnen');

  // ---------- Momentopnames bijhouden ----------
  let lijst = metMomentopname([], nu, 1);
  lijst = metMomentopname(lijst, nu + 1000, 2);
  console.assert(lijst.length === 1 && lijst[0].waarde === 2, 'per dag één opname, de laatste wint');

  console.log('portfolioWaarde.ts self-check geslaagd');
}
