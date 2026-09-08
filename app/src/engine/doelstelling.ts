// Doelverdeling, afwijking, bijstortplan en projectie voor de "Doel"-kant van VerdelingKaart en
// DoelScherm. Pure rekenmodule zonder React, in dezelfde lijn als verdeling.ts.
//
// De weegregel is BEWUST hetzelfde als berekenVerdeling in verdeling.ts: alleen open trades met een
// aantal én een live koers tellen mee, waarde is livePrijs * aantalCoins. Een Doel-weergave die op
// een andere noemer rekent dan de Nu-weergave op dezelfde kaart zou bij het omschakelen niet meer
// kloppen met wat je net zag.

import { PortfolioTrade } from '../state/portfolioTypes';
import { OVERIG_SLEUTEL } from './verdeling';

export interface DoelRegel {
  sleutel: string;   // coinsymbool, hoofdletters, bijv. 'BTC'
  doelPct: number;   // 0 < doelPct <= 100
}

// Overig zit hier NIET expliciet in. Het is altijd 100 - som(doelPct), berekend waar nodig, zodat
// een doel per constructie nooit uit balans kan raken met wat er in de UI staat.
export type Doelverdeling = DoelRegel[];

export interface AfwijkingRegel {
  sleutel: string;              // symbool, of OVERIG_SLEUTEL
  label: string;                 // 'BTC', of 'Overig'
  doelPct: number;
  actueelPct: number;
  actueelUsd: number;
  afwijkingPct: number;          // actueelPct - doelPct
  status: 'op-doel' | 'te-zwaar' | 'te-licht';
  ernst: 'mild' | 'flink';       // alleen betekenisvol als status !== 'op-doel'
}

// Binnen deze marge (procentpunt) telt een categorie als op doel, ongeacht het teken.
export const OP_DOEL_MARGE = 1;
// Boven deze marge (procentpunt) krijgt de afwijking het "let op"-gewicht. Een keuze, geen norm,
// net als CONCENTRATIE_DREMPEL in verdeling.ts.
export const AFWIJKING_FLINK = 5;

// Zelfde doorloop als berekenVerdeling: meerdere trades in hetzelfde symbool zijn samen één
// blootstelling, en alleen een positie met een aantal én een live koers is te wegen.
function wegen(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
): { perSymbool: Map<string, number>; totaalUsd: number } {
  const open = trades.filter(t => t.status === 'open');
  const perSymbool = new Map<string, number>();

  for (const t of open) {
    const livePrijs = livePrijzen[t.symbool];
    const heeftAantal = typeof t.aantalCoins === 'number' && t.aantalCoins > 0;
    if (heeftAantal && typeof livePrijs === 'number') {
      perSymbool.set(t.symbool, (perSymbool.get(t.symbool) ?? 0) + livePrijs * t.aantalCoins!);
    }
  }

  const totaalUsd = [...perSymbool.values()].reduce((s, w) => s + w, 0);
  return { perSymbool, totaalUsd };
}

interface Categorie {
  sleutel: string;
  label: string;
  doelPct: number;
  actueelUsd: number;
}

// Gedeeld door berekenAfwijking en berekenBijstortplan: allebei hebben dezelfde rijen nodig (elke
// doelregel plus Overig als sluitstuk), alleen de berekening erna verschilt.
function categorieën(
  doel: Doelverdeling,
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
): { totaalUsd: number; rijen: Categorie[] } {
  const { perSymbool, totaalUsd } = wegen(trades, livePrijzen);
  const somDoelPct = doel.reduce((s, d) => s + d.doelPct, 0);

  let overigUsd = totaalUsd;
  const rijen: Categorie[] = doel.map(d => {
    const actueelUsd = perSymbool.get(d.sleutel) ?? 0;
    overigUsd -= actueelUsd;
    return { sleutel: d.sleutel, label: d.sleutel, doelPct: d.doelPct, actueelUsd };
  });
  // Overig staat altijd als laatste regel, ongeacht zijn percentage: dezelfde volgorde-afspraak
  // als in de bestaande legenda.
  rijen.push({ sleutel: OVERIG_SLEUTEL, label: 'Overig', doelPct: 100 - somDoelPct, actueelUsd: overigUsd });

  return { totaalUsd, rijen };
}

export function berekenAfwijking(
  doel: Doelverdeling,
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
): { regels: AfwijkingRegel[]; totaalUsd: number } {
  const { totaalUsd, rijen } = categorieën(doel, trades, livePrijzen);
  // Alles op nul waarderen kan: geen posities die aan doel voldoen. Dan is elk aandeel 0 in plaats
  // van een deling door nul, zoals in verdeling.ts.
  const deel = (w: number) => (totaalUsd > 0 ? (w / totaalUsd) * 100 : 0);

  const regels: AfwijkingRegel[] = rijen.map(r => {
    const actueelPct = deel(r.actueelUsd);
    const afwijkingPct = actueelPct - r.doelPct;
    const status: AfwijkingRegel['status'] =
      afwijkingPct > OP_DOEL_MARGE ? 'te-zwaar' : afwijkingPct < -OP_DOEL_MARGE ? 'te-licht' : 'op-doel';
    return {
      sleutel: r.sleutel,
      label: r.label,
      doelPct: r.doelPct,
      actueelPct,
      actueelUsd: r.actueelUsd,
      afwijkingPct,
      status,
      ernst: Math.abs(afwijkingPct) > AFWIJKING_FLINK ? 'flink' : 'mild',
    };
  });

  return { regels, totaalUsd };
}

export interface BijstortRegel {
  sleutel: string;
  label: string;
  bedragUsd: number;    // toegewezen deel van de inleg
  nieuwPct: number;     // aandeel van deze categorie in het totaal NA de inleg
}

export function berekenBijstortplan(
  doel: Doelverdeling,
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
  inlegUsd: number,
): BijstortRegel[] {
  const { totaalUsd, rijen } = categorieën(doel, trades, livePrijzen);
  const nieuwTotaal = totaalUsd + inlegUsd;

  // Stap 1: tekorten aanvullen. Elk tekort is hoe ver een categorie onder haar doel zit ZODRA de
  // hele inleg is bijgeteld bij het totaal, niet bij het huidige totaal: anders zou de laatst
  // berekende categorie een ander totaal zien dan de eerste.
  const metTekort = rijen.map(r => {
    const doelUsd = (r.doelPct / 100) * nieuwTotaal;
    return { ...r, tekortUsd: Math.max(0, doelUsd - r.actueelUsd) };
  });
  const somTekort = metTekort.reduce((s, r) => s + r.tekortUsd, 0);

  return metTekort.map(r => {
    let bedragUsd: number;
    if (somTekort <= inlegUsd) {
      // De tekorten passen allemaal. Stap 2: wat overblijft gaat naar rato van doelPct over ALLE
      // categorieën, ook die al op of boven hun doel zaten, want er is geen reden meer om ze over
      // te slaan zodra hun eigen tekort al gedicht is.
      const rest = inlegUsd - somTekort;
      bedragUsd = r.tekortUsd + (r.doelPct / 100) * rest;
    } else {
      // De inleg is te klein om alle tekorten te dichten: elke categorie krijgt een aandeel naar
      // rato van haar eigen tekort. somTekort is hier per definitie groter dan 0.
      bedragUsd = (r.tekortUsd / somTekort) * inlegUsd;
    }
    const nieuwPct = nieuwTotaal > 0 ? ((r.actueelUsd + bedragUsd) / nieuwTotaal) * 100 : 0;
    return { sleutel: r.sleutel, label: r.label, bedragUsd, nieuwPct };
  });
}

export interface ProjectiePunt {
  jaar: number;            // 0..jaren
  totaalWaarde: number;    // met het ingevulde rendement
  ingelegdWaarde: number;  // dezelfde opbouw maar zonder rendement (referentielijn)
}

export function berekenProjectie(
  huidigeWaardeUsd: number,
  maandelijkseInlegUsd: number,
  rendementPctPerJaar: number,
  jaren: number,
): ProjectiePunt[] {
  const rJaar = rendementPctPerJaar / 100;
  // Rendement per jaar omgezet naar rendement per maand, want de inleg komt maandelijks binnen en
  // moet dus ook maandelijks rente opbouwen. Bij 0 procent per jaar is elke afgeleide maandrente
  // ook 0, maar dat expliciet maken voorkomt dat een afrondingsfout in Math.pow een schijnbaar
  // rendement invoert waar er geen is.
  const rMaand = rendementPctPerJaar === 0 ? 0 : Math.pow(1 + rJaar, 1 / 12) - 1;

  const punten: ProjectiePunt[] = [];
  for (let t = 0; t <= jaren; t++) {
    const n = t * 12;
    const ingelegdWaarde = huidigeWaardeUsd + maandelijkseInlegUsd * n;
    const totaalWaarde =
      rMaand === 0
        ? huidigeWaardeUsd * Math.pow(1 + rJaar, t) + maandelijkseInlegUsd * n
        : huidigeWaardeUsd * Math.pow(1 + rJaar, t) +
          maandelijkseInlegUsd * ((Math.pow(1 + rMaand, n) - 1) / rMaand) * (1 + rMaand);
    punten.push({ jaar: t, totaalWaarde, ingelegdWaarde });
  }
  return punten;
}

// '+4,3pp' / '−3,2pp' / '0,0pp'. Procentpunt en niet procent: het gaat over het verschil tussen twee
// percentages, en "4,3%" zou lezen als 4,3 procent van iets, niet als 4,3 punten verschil.
export function fmtAfwijkingPp(pp: number): string {
  const teken = pp > 0 ? '+' : pp < 0 ? '−' : '';
  return `${teken}${Math.abs(pp).toFixed(1).replace('.', ',')}pp`;
}

// ponytail: self-check ipv testframework, run met `npx tsx src/engine/doelstelling.ts` vanuit app/
if (require.main === module) {
  let missers = 0;
  const origineleAssert = console.assert.bind(console);
  console.assert = ((voorwaarde?: boolean, ...rest: unknown[]) => {
    if (!voorwaarde) missers++;
    origineleAssert(voorwaarde, ...rest);
  }) as typeof console.assert;

  const open = (id: string, symbool: string, aantalCoins?: number): PortfolioTrade => ({
    id, symbool, naam: symbool, entryPrijs: 100, stopLoss: 90, takeProfit: 130, rr: 3,
    datum: '', status: 'open', aantalCoins,
  });

  // ---------- Een doel dat optelt tot 100 blijft dat na berekenAfwijking ----------
  const doel = [{ sleutel: 'BTC', doelPct: 60 }, { sleutel: 'ETH', doelPct: 20 }];
  const trades = [open('1', 'BTC', 3), open('2', 'ETH', 2), open('3', 'SOL', 5)];
  const prijzen = { BTC: 100, ETH: 100, SOL: 20 };  // BTC 300, ETH 200, SOL 100, totaal 600
  const afwijking = berekenAfwijking(doel, trades, prijzen);
  console.assert(afwijking.totaalUsd === 600, `totaal moet 600 zijn, was ${afwijking.totaalUsd}`);
  const somDoelPct = afwijking.regels.reduce((s, r) => s + r.doelPct, 0);
  console.assert(Math.abs(somDoelPct - 100) < 1e-9, `doelPct moet optellen tot 100, was ${somDoelPct}`);
  console.assert(afwijking.regels[afwijking.regels.length - 1].sleutel === OVERIG_SLEUTEL,
    'Overig staat altijd als laatste regel');
  const btcRegel = afwijking.regels.find(r => r.sleutel === 'BTC')!;
  console.assert(Math.abs(btcRegel.actueelPct - 50) < 1e-9, `BTC is 300 van 600, dat is 50%, was ${btcRegel.actueelPct}`);
  console.assert(Math.abs(btcRegel.afwijkingPct - (-10)) < 1e-9, `BTC zit 10pp onder doel, was ${btcRegel.afwijkingPct}`);
  console.assert(btcRegel.status === 'te-licht', `BTC onder doel is te-licht, was ${btcRegel.status}`);
  console.assert(btcRegel.ernst === 'flink', `10pp is boven AFWIJKING_FLINK, was ${btcRegel.ernst}`);
  const overigRegel = afwijking.regels.find(r => r.sleutel === OVERIG_SLEUTEL)!;
  console.assert(overigRegel.doelPct === 20, `Overig doel is 100 - 60 - 20, was ${overigRegel.doelPct}`);
  console.assert(overigRegel.label === 'Overig', `label moet 'Overig' zijn, was ${overigRegel.label}`);
  console.assert(Math.abs(overigRegel.actueelPct - (100 / 6)) < 1e-9, `SOL (100 van 600) is Overig, was ${overigRegel.actueelPct}`);

  // ---------- Lege doel-array geeft precies één regel: Overig, 100 procent doel ----------
  const legeAfwijking = berekenAfwijking([], trades, prijzen);
  console.assert(legeAfwijking.regels.length === 1, `lege doel geeft één regel, waren er ${legeAfwijking.regels.length}`);
  console.assert(legeAfwijking.regels[0].sleutel === OVERIG_SLEUTEL && legeAfwijking.regels[0].doelPct === 100,
    'Overig is bij een leeg doel de volledige 100 procent');
  console.assert(Math.abs(legeAfwijking.regels[0].actueelPct - 100) < 1e-9, 'alles zit dan in Overig');

  // ---------- Statusgrenzen: precies op de marge telt als op-doel ----------
  const opMarge = berekenAfwijking(
    [{ sleutel: 'BTC', doelPct: 51 }],
    [open('1', 'BTC', 1)],
    { BTC: 100 },
  );
  // BTC is hier de enige positie: actueelPct = 100, doel = 51, afwijking = 49pp, ver over de marge.
  console.assert(opMarge.regels[0].status === 'te-zwaar', 'ruim boven de marge is te-zwaar');
  const preciesOpDoel = berekenAfwijking(
    [{ sleutel: 'BTC', doelPct: 99 }],
    [open('1', 'BTC', 1)],
    { BTC: 100 },
  );
  // actueelPct = 100, doelPct = 99, afwijking = 1pp: exact OP_DOEL_MARGE, dus nog steeds op-doel.
  console.assert(preciesOpDoel.regels[0].status === 'op-doel', `1pp is nog binnen de marge, was ${preciesOpDoel.regels[0].status}`);

  // ---------- Een coin die niet in het doel staat telt wel mee in het totaal, via Overig ----------
  // totaalUsd is de gewogen som van ALLE posities, niet alleen de posities die met naam in het doel
  // staan. Zou dat wel zo zijn, dan zou de Doel-weergave een ander totaal tonen dan de ring ernaast.
  const zonderMatch = berekenAfwijking(
    [{ sleutel: 'BTC', doelPct: 50 }],
    [open('1', 'ADA', 5)],
    { ADA: 10 },
  );
  console.assert(zonderMatch.totaalUsd === 50, `ADA telt gewoon mee in het totaal, was ${zonderMatch.totaalUsd}`);
  const btcZonder = zonderMatch.regels.find(r => r.sleutel === 'BTC')!;
  console.assert(btcZonder.actueelUsd === 0 && btcZonder.status === 'te-licht',
    'een doelcoin die je niet bezit staat op nul en dus te-licht');
  const overigZonder = zonderMatch.regels.find(r => r.sleutel === OVERIG_SLEUTEL)!;
  console.assert(Math.abs(overigZonder.actueelPct - 100) < 1e-9, `ADA valt volledig onder Overig, was ${overigZonder.actueelPct}`);

  // ---------- Helemaal geen weegbare posities: totaalUsd is 0, alles staat op nul ----------
  // Geen aparte tak in de code, het volgt uit dezelfde formule. Wel apart in de UI, want "alles te
  // licht" leest als een oordeel terwijl er alleen nog geen koersen zijn.
  const zonderKoers = berekenAfwijking(
    [{ sleutel: 'BTC', doelPct: 50 }],
    [open('1', 'BTC')],   // geen aantalCoins, dus niet te wegen
    { BTC: 100 },
  );
  console.assert(zonderKoers.totaalUsd === 0, `zonder aantal is er niets te wegen, was ${zonderKoers.totaalUsd}`);
  console.assert(zonderKoers.regels.every(r => r.actueelPct === 0), 'elk actueel aandeel is dan 0');

  // ---------- Bijstortplan: tekort groter dan inleg verdeelt de hele inleg zonder rest ----------
  const scheefDoel = [{ sleutel: 'BTC', doelPct: 80 }, { sleutel: 'ETH', doelPct: 20 }];
  const scheefTrades = [open('1', 'ETH', 10)];  // alles in ETH, BTC en Overig staan op 0
  const scheefPrijzen = { ETH: 100 };  // 1000 aan ETH
  const kleinePlan = berekenBijstortplan(scheefDoel, scheefTrades, scheefPrijzen, 50);
  const somBedragKlein = kleinePlan.reduce((s, r) => s + r.bedragUsd, 0);
  console.assert(Math.abs(somBedragKlein - 50) < 1e-6, `een kleine inleg moet toch volledig verdeeld worden, was ${somBedragKlein}`);
  const btcKlein = kleinePlan.find(r => r.sleutel === 'BTC')!;
  const overigKlein = kleinePlan.find(r => r.sleutel === OVERIG_SLEUTEL)!;
  console.assert(overigKlein.bedragUsd === 0, `ETH is niet in het doel dus valt onder Overig en zit al op 100% van zijn eigen doel (0), was ${overigKlein.bedragUsd}`);
  console.assert(btcKlein.bedragUsd > 0, 'BTC heeft het grootste tekort en krijgt dus het grootste deel van de kleine inleg');

  // ---------- Bijstortplan: inleg groter dan alle tekorten laat niets ongebruikt ----------
  const grotePlan = berekenBijstortplan(scheefDoel, scheefTrades, scheefPrijzen, 10000);
  const somBedragGroot = grotePlan.reduce((s, r) => s + r.bedragUsd, 0);
  console.assert(Math.abs(somBedragGroot - 10000) < 1e-6, `een grote inleg moet ook volledig verdeeld worden, was ${somBedragGroot}`);
  const ethGroot = grotePlan.find(r => r.sleutel === 'ETH')!;
  console.assert(ethGroot !== undefined, 'ETH staat met naam in scheefDoel en heeft dus een eigen regel');
  const btcGroot = grotePlan.find(r => r.sleutel === 'BTC')!;
  console.assert(btcGroot.bedragUsd > ethGroot.bedragUsd,
    'BTC had het grootste tekort en houdt ook bij een ruime inleg het grootste bedrag');
  const overigGroot = grotePlan.find(r => r.sleutel === OVERIG_SLEUTEL)!;
  // scheefDoel telt zelf al op tot 100, dus Overig heeft hier een doel van 0 procent. Dan is er
  // geen tekort te dichten en is er in stap 2 ook geen doelaandeel om de rest over te verdelen:
  // precies nul, en dat hoort zo.
  console.assert(overigGroot.bedragUsd === 0, `Overig met een doel van 0 procent krijgt niets, was ${overigGroot.bedragUsd}`);

  // ---------- Stap 2 met een Overig dat wél een doel heeft: de rest gaat naar doelverhouding ----------
  const metOverigDoel = [{ sleutel: 'BTC', doelPct: 60 }];   // Overig krijgt de resterende 40
  const restPlan = berekenBijstortplan(metOverigDoel, [], {}, 1000);
  const btcRest = restPlan.find(r => r.sleutel === 'BTC')!;
  const overigRest = restPlan.find(r => r.sleutel === OVERIG_SLEUTEL)!;
  console.assert(Math.abs(btcRest.bedragUsd - 600) < 1e-6, `60% van 1000 is 600, was ${btcRest.bedragUsd}`);
  console.assert(Math.abs(overigRest.bedragUsd - 400) < 1e-6, `Overig krijgt de resterende 40%, was ${overigRest.bedragUsd}`);

  // ---------- Bijstortplan vanaf nul: de hele inleg gaat exact naar de doelverhouding ----------
  const vanafNul = berekenBijstortplan(scheefDoel, [], {}, 1000);
  const btcNul = vanafNul.find(r => r.sleutel === 'BTC')!;
  const ethNul = vanafNul.find(r => r.sleutel === 'ETH')!;
  console.assert(Math.abs(btcNul.bedragUsd - 800) < 1e-6, `80% van 1000 is 800, was ${btcNul.bedragUsd}`);
  console.assert(Math.abs(ethNul.bedragUsd - 200) < 1e-6, `20% van 1000 is 200, was ${ethNul.bedragUsd}`);
  console.assert(Math.abs(btcNul.nieuwPct - 80) < 1e-6, `nieuwPct moet het doelpercentage zijn, was ${btcNul.nieuwPct}`);

  // ---------- Projectie: rendement 0 procent geeft totaalWaarde === ingelegdWaarde overal ----------
  const projectieZonderRendement = berekenProjectie(1000, 100, 0, 5);
  console.assert(projectieZonderRendement.length === 6, `jaar 0 tot en met 5 is 6 punten, waren er ${projectieZonderRendement.length}`);
  for (const p of projectieZonderRendement) {
    console.assert(p.totaalWaarde === p.ingelegdWaarde,
      `zonder rendement moeten de lijnen samenvallen op jaar ${p.jaar}, waren ${p.totaalWaarde} en ${p.ingelegdWaarde}`);
  }
  console.assert(projectieZonderRendement[5].ingelegdWaarde === 1000 + 100 * 60,
    `na 5 jaar is er 1000 plus 60 keer 100 ingelegd, was ${projectieZonderRendement[5].ingelegdWaarde}`);

  // ---------- Projectie: jaar 0 is altijd het startbedrag, met of zonder rendement ----------
  const projectieMetRendement = berekenProjectie(2000, 50, 8, 10);
  console.assert(projectieMetRendement[0].jaar === 0, 'eerste punt is jaar 0');
  console.assert(projectieMetRendement[0].totaalWaarde === 2000, `jaar 0 heeft nog geen rendement gehad, was ${projectieMetRendement[0].totaalWaarde}`);
  console.assert(projectieMetRendement[0].ingelegdWaarde === 2000, `jaar 0 heeft nog geen extra inleg gehad, was ${projectieMetRendement[0].ingelegdWaarde}`);
  const laatste = projectieMetRendement[projectieMetRendement.length - 1];
  console.assert(laatste.totaalWaarde > laatste.ingelegdWaarde,
    `met positief rendement moet de waarde boven de inleg uitkomen, waren ${laatste.totaalWaarde} en ${laatste.ingelegdWaarde}`);

  // ---------- fmtAfwijkingPp ----------
  console.assert(fmtAfwijkingPp(4.34) === '+4,3pp', `positieve afwijking, was ${fmtAfwijkingPp(4.34)}`);
  console.assert(fmtAfwijkingPp(-3.21) === '−3,2pp', `negatieve afwijking, was ${fmtAfwijkingPp(-3.21)}`);
  console.assert(fmtAfwijkingPp(0) === '0,0pp', `precies nul heeft geen teken, was ${fmtAfwijkingPp(0)}`);

  if (missers > 0) {
    console.error(`doelstelling.ts self-check: ${missers} misser(s)`);
    process.exit(1);
  }
  console.log('doelstelling.ts self-check geslaagd');
}
