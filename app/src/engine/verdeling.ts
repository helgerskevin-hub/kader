// Verdeling van je open posities over coins, voor het cirkeldiagram op het portfolio-scherm.
// Pure rekenmodule zonder React, in dezelfde lijn als state/statistieken.ts.
//
// Let op het verschil met berekenPortfolioWaarde: die rekent je eigen vermogen uit (inleg plus
// ongerealiseerd, richting-bewust). Hier gaat het om blootstelling, dus om de MARKTwaarde van een
// positie: livePrijs * aantalCoins. Voor een short is dat de waarde van wat je moet terugleveren.
// Die telt hier gewoon als omvang mee, want de verdeling zegt waar je risico zit en niet of je
// erop wint of verliest.

import { PortfolioTrade } from '../state/portfolioTypes';

export interface Segment {
  sleutel: string;      // symbool, of '__overig__'
  label: string;        // 'BTC', of 'Overig (9)'
  waardeUsd: number;
  aandeel: number;      // 0..1
  // Wordt door VerdelingKaart ingevuld uit colors.verdeling. Kleur is een themakeuze en hoort
  // niet in een rekenmodule die geen thema kent.
  kleur: string;
  leden?: { symbool: string; waardeUsd: number; aandeel: number }[];  // alleen bij overig
}

export interface Verdeling {
  segmenten: Segment[];
  totaalUsd: number;
  gewaardeerd: number;       // open posities die meetellen
  zonderLivePrijs: number;   // open posities zonder aantal of live koers
}

export const OVERIG_SLEUTEL = '__overig__';

// Zeven is het maximum dat in een ring van 150px nog uit elkaar te houden is, en het is ook de
// grens waarboven de legenda in twee kolommen langer wordt dan de ring hoog is.
export const MAX_SEGMENTEN = 7;

export function berekenVerdeling(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
): Verdeling {
  const open = trades.filter(t => t.status === 'open');

  // Meerdere trades in hetzelfde symbool zijn samen één blootstelling, dus één segment.
  const perSymbool = new Map<string, number>();
  let gewaardeerd = 0;
  let zonderLivePrijs = 0;

  for (const t of open) {
    const livePrijs = livePrijzen[t.symbool];
    const heeftAantal = typeof t.aantalCoins === 'number' && t.aantalCoins > 0;
    if (heeftAantal && typeof livePrijs === 'number') {
      perSymbool.set(t.symbool, (perSymbool.get(t.symbool) ?? 0) + livePrijs * t.aantalCoins!);
      gewaardeerd += 1;
    } else {
      zonderLivePrijs += 1;
    }
  }

  const gesorteerd = [...perSymbool.entries()]
    .map(([symbool, waardeUsd]) => ({ symbool, waardeUsd }))
    .sort((a, b) => b.waardeUsd - a.waardeUsd);

  const totaalUsd = gesorteerd.reduce((s, r) => s + r.waardeUsd, 0);
  // Alles op nul waarderen kan: een coin waarvan de koers 0 binnenkomt. Dan is er geen verdeling
  // te maken en is elk aandeel 0, in plaats van een deling door nul.
  const deel = (w: number) => (totaalUsd > 0 ? w / totaalUsd : 0);

  if (gesorteerd.length <= MAX_SEGMENTEN) {
    return {
      segmenten: gesorteerd.map(r => ({
        sleutel: r.symbool,
        label: r.symbool,
        waardeUsd: r.waardeUsd,
        aandeel: deel(r.waardeUsd),
        kleur: '',
      })),
      totaalUsd,
      gewaardeerd,
      zonderLivePrijs,
    };
  }

  // Zes eigen segmenten plus één verzamelsegment is samen MAX_SEGMENTEN.
  const eersten = gesorteerd.slice(0, MAX_SEGMENTEN - 1);
  const rest = gesorteerd.slice(MAX_SEGMENTEN - 1);
  const restWaarde = rest.reduce((s, r) => s + r.waardeUsd, 0);

  const segmenten: Segment[] = eersten.map(r => ({
    sleutel: r.symbool,
    label: r.symbool,
    waardeUsd: r.waardeUsd,
    aandeel: deel(r.waardeUsd),
    kleur: '',
  }));

  segmenten.push({
    sleutel: OVERIG_SLEUTEL,
    label: `Overig (${rest.length})`,
    waardeUsd: restWaarde,
    aandeel: deel(restWaarde),
    kleur: '',
    // Al aflopend gesorteerd, want `gesorteerd` was dat al.
    leden: rest.map(r => ({
      symbool: r.symbool,
      waardeUsd: r.waardeUsd,
      aandeel: deel(r.waardeUsd),
    })),
  });

  return { segmenten, totaalUsd, gewaardeerd, zonderLivePrijs };
}

// ponytail: self-check ipv testframework, run met `npx tsx src/engine/verdeling.ts` vanuit app/
if (require.main === module) {
  // console.assert gooit niet in Node en zet de exitcode niet. Zonder deze teller zou dit bestand
  // "geslaagd" printen terwijl er van alles fout is.
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

  // ---------- Eén positie ----------
  const een = berekenVerdeling([open('1', 'BTC', 2)], { BTC: 50 });
  console.assert(een.segmenten.length === 1, `één positie geeft één segment, waren er ${een.segmenten.length}`);
  console.assert(een.totaalUsd === 100, `2 BTC op 50 is 100, was ${een.totaalUsd}`);
  console.assert(een.segmenten[0].aandeel === 1, `één segment is het hele diagram, was ${een.segmenten[0].aandeel}`);
  console.assert(een.segmenten[0].label === 'BTC', 'het label is het symbool');
  console.assert(een.gewaardeerd === 1 && een.zonderLivePrijs === 0, 'één gewaardeerde positie');

  // ---------- Meerdere trades in hetzelfde symbool ----------
  // Twee keer SOL is één blootstelling in SOL, geen twee taartpunten naast elkaar.
  const zelfde = berekenVerdeling(
    [open('1', 'SOL', 2), open('2', 'SOL', 3), open('3', 'ETH', 1)],
    { SOL: 100, ETH: 250 },
  );
  console.assert(zelfde.segmenten.length === 2, `SOL hoort één segment te zijn, waren er ${zelfde.segmenten.length}`);
  console.assert(zelfde.segmenten[0].sleutel === 'SOL', `SOL (500) staat boven ETH (250), was ${zelfde.segmenten[0].sleutel}`);
  console.assert(zelfde.segmenten[0].waardeUsd === 500, `2+3 SOL op 100 is 500, was ${zelfde.segmenten[0].waardeUsd}`);
  console.assert(zelfde.totaalUsd === 750, `totaal moet 750 zijn, was ${zelfde.totaalUsd}`);
  console.assert(Math.abs(zelfde.segmenten[1].aandeel - 1 / 3) < 1e-9, `ETH is een derde, was ${zelfde.segmenten[1].aandeel}`);

  // ---------- Meer dan zeven symbolen ----------
  // Negen symbolen: zes eigen segmenten plus Overig met de resterende drie erin.
  const namen = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const veelTrades = namen.map((n, i) => open(String(i), n, 1));
  const veelPrijzen: Record<string, number> = {};
  namen.forEach((n, i) => { veelPrijzen[n] = 100 - i * 10; });  // A=100 ... I=20
  const veel = berekenVerdeling(veelTrades, veelPrijzen);
  console.assert(veel.segmenten.length === MAX_SEGMENTEN, `zeven segmenten verwacht, waren er ${veel.segmenten.length}`);
  const overig = veel.segmenten[veel.segmenten.length - 1];
  console.assert(overig.sleutel === OVERIG_SLEUTEL, `het laatste segment is Overig, was ${overig.sleutel}`);
  console.assert(overig.label === 'Overig (3)', `label moet het aantal leden noemen, was ${overig.label}`);
  console.assert(overig.leden?.length === 3, `Overig heeft drie leden, waren er ${overig.leden?.length}`);
  console.assert(overig.waardeUsd === 40 + 30 + 20, `Overig telt zijn leden op, was ${overig.waardeUsd}`);
  console.assert(overig.leden![0].symbool === 'G', `leden staan aflopend, eerste was ${overig.leden![0].symbool}`);
  const som = veel.segmenten.reduce((s, seg) => s + seg.aandeel, 0);
  console.assert(Math.abs(som - 1) < 1e-9, `de aandelen tellen op tot 1, waren ${som}`);
  console.assert(veel.segmenten[0].sleutel === 'A' && veel.segmenten[5].sleutel === 'F', 'de zes grootste houden hun eigen segment');

  // ---------- Short ----------
  // Marktwaarde telt als omvang. De koers is gehalveerd, dus deze short staat flink in de winst,
  // maar de blootstelling is nog steeds 2 * 50 = 100 en niet de winst van 100.
  const short = berekenVerdeling(
    [{ ...open('s1', 'SOL', 2), richting: 'short' }, open('l1', 'BTC', 3)],
    { SOL: 50, BTC: 100 },
  );
  console.assert(short.totaalUsd === 400, `100 short plus 300 long is 400, was ${short.totaalUsd}`);
  const solSegment = short.segmenten.find(s => s.sleutel === 'SOL')!;
  console.assert(solSegment.waardeUsd === 100, `short telt als marktwaarde 100, was ${solSegment.waardeUsd}`);
  console.assert(solSegment.aandeel === 0.25, `short is een kwart van de omvang, was ${solSegment.aandeel}`);

  // ---------- Zonder aantal of zonder live prijs ----------
  const onvolledig = berekenVerdeling(
    [
      open('1', 'BTC', 2),      // compleet
      open('2', 'ETH'),         // geen aantal
      open('3', 'ADA', 5),      // geen live prijs
      open('4', 'XRP', 0),      // aantal 0 telt niet als aantal
      { ...open('5', 'DOT', 1), status: 'gewonnen' },  // niet open, doet niet mee
    ],
    { BTC: 50, ETH: 3000, DOT: 7 },
  );
  console.assert(onvolledig.segmenten.length === 1, `alleen BTC is te wegen, waren er ${onvolledig.segmenten.length}`);
  console.assert(onvolledig.gewaardeerd === 1, `één gewaardeerde positie, was ${onvolledig.gewaardeerd}`);
  console.assert(onvolledig.zonderLivePrijs === 3, `ETH, ADA en XRP vallen weg, was ${onvolledig.zonderLivePrijs}`);
  console.assert(onvolledig.totaalUsd === 100, `alleen BTC telt mee, was ${onvolledig.totaalUsd}`);

  // ---------- Niets te verdelen ----------
  const leeg = berekenVerdeling([], {});
  console.assert(leeg.segmenten.length === 0 && leeg.totaalUsd === 0, 'geen trades geeft een lege verdeling');
  const nulKoers = berekenVerdeling([open('1', 'BTC', 2)], { BTC: 0 });
  console.assert(nulKoers.segmenten[0].aandeel === 0, `een koers van 0 mag geen deling door nul geven, was ${nulKoers.segmenten[0].aandeel}`);

  if (missers > 0) {
    console.error(`verdeling.ts self-check: ${missers} misser(s)`);
    process.exit(1);
  }
  console.log('verdeling.ts self-check geslaagd');
}
