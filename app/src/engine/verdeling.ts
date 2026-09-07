// Verdeling van je open posities over coins, voor het cirkeldiagram op het portfolio-scherm.
// Pure rekenmodule zonder React, in dezelfde lijn als state/statistieken.ts.
//
// Let op het verschil met berekenPortfolioWaarde: die rekent je eigen vermogen uit (inleg plus
// ongerealiseerd, richting-bewust). Hier gaat het om blootstelling, dus om de MARKTwaarde van een
// positie: livePrijs * aantalCoins. Voor een short is dat de waarde van wat je moet terugleveren.
// Die telt hier gewoon als omvang mee, want de verdeling zegt waar je risico zit en niet of je
// erop wint of verliest.

import { PortfolioTrade, bronVan } from '../state/portfolioTypes';

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

// ============================================================================
// DETAIL
//
// Wat het detailscherm nodig heeft en de kaart niet: de volledige lijst zonder "Overig", de
// verdeling over de platforms waar je posities staan, en het kruispunt van die twee (dezelfde coin
// kan op meer dan één platform staan).
//
// Zelfde weegregel als hierboven: de MARKTwaarde van een positie, dus livePrijs * aantalCoins, en
// een short telt met zijn volle omvang mee. Een positie zonder aantal of zonder live koers valt
// buiten de verdeling, want er is geen eerlijk gewicht voor.
// ============================================================================

// Waar een positie vandaan komt. Vandaag zijn dat er twee; fase 4b van de to-do voegt er platforms
// aan toe, dus alles hieronder telt op sleutel en niet op "eToro of anders".
export type PlatformSleutel = 'etoro' | 'handmatig';

const PLATFORM_LABEL: Record<PlatformSleutel, string> = {
  etoro: 'eToro',
  handmatig: 'Handmatig',
};

export function platformLabel(sleutel: PlatformSleutel): string {
  return PLATFORM_LABEL[sleutel] ?? sleutel;
}

export interface CoinRegel {
  symbool: string;
  waardeUsd: number;
  aandeel: number;              // van het totaal, 0..1
  posities: number;             // gewaardeerde posities in deze coin
  // Op welke platforms deze coin staat, aflopend op waarde. Eén regel = de coin staat op één plek.
  perPlatform: { sleutel: PlatformSleutel; waardeUsd: number }[];
}

export interface PlatformRegel {
  sleutel: PlatformSleutel;
  waardeUsd: number;
  aandeel: number;              // van het totaal, 0..1
  posities: number;             // gewaardeerde posities op dit platform
  zonderLivePrijs: number;      // posities op dit platform die niet te wegen zijn
  // De coins op dit platform, aflopend. `aandeel` is het aandeel BINNEN dit platform, niet van het
  // totaal: op het platformblok is dat de vraag die je stelt.
  coins: { symbool: string; waardeUsd: number; aandeel: number }[];
}

export interface VerdelingDetail {
  coins: CoinRegel[];
  platforms: PlatformRegel[];
  totaalUsd: number;
  gewaardeerd: number;
  zonderLivePrijs: number;
  // Het grootste aandeel dat één coin en één platform innemen, voor de feitelijke concentratieregel
  // op het scherm. 0 als er niets te wegen valt.
  grootsteCoinAandeel: number;
  grootstePlatformAandeel: number;
}

export function berekenVerdelingDetail(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
): VerdelingDetail {
  const open = trades.filter(t => t.status === 'open');

  // Eén doorloop, drie optellingen: per coin, per platform, en per combinatie van die twee.
  const perCoin = new Map<string, { waardeUsd: number; posities: number }>();
  const perPlatform = new Map<PlatformSleutel, { waardeUsd: number; posities: number; zonderLivePrijs: number }>();
  const perKruis = new Map<string, number>();   // `${platform}|${symbool}`
  let gewaardeerd = 0;
  let zonderLivePrijs = 0;

  const platformVak = (sleutel: PlatformSleutel) => {
    const bestaand = perPlatform.get(sleutel);
    if (bestaand) return bestaand;
    const vers = { waardeUsd: 0, posities: 0, zonderLivePrijs: 0 };
    perPlatform.set(sleutel, vers);
    return vers;
  };

  for (const t of open) {
    const platform = bronVan(t);
    const vak = platformVak(platform);
    const livePrijs = livePrijzen[t.symbool];
    const heeftAantal = typeof t.aantalCoins === 'number' && t.aantalCoins > 0;
    if (!heeftAantal || typeof livePrijs !== 'number') {
      zonderLivePrijs += 1;
      vak.zonderLivePrijs += 1;
      continue;
    }

    const waarde = livePrijs * t.aantalCoins!;
    gewaardeerd += 1;

    const coin = perCoin.get(t.symbool) ?? { waardeUsd: 0, posities: 0 };
    coin.waardeUsd += waarde;
    coin.posities += 1;
    perCoin.set(t.symbool, coin);

    vak.waardeUsd += waarde;
    vak.posities += 1;

    const kruisSleutel = `${platform}|${t.symbool}`;
    perKruis.set(kruisSleutel, (perKruis.get(kruisSleutel) ?? 0) + waarde);
  }

  const totaalUsd = [...perCoin.values()].reduce((s, c) => s + c.waardeUsd, 0);
  // Alles op nul waarderen kan (een koers die als 0 binnenkomt). Dan is elk aandeel 0 in plaats van
  // een deling door nul, precies zoals in berekenVerdeling hierboven.
  const deel = (w: number, van: number) => (van > 0 ? w / van : 0);

  const coins: CoinRegel[] = [...perCoin.entries()]
    .map(([symbool, c]) => ({
      symbool,
      waardeUsd: c.waardeUsd,
      aandeel: deel(c.waardeUsd, totaalUsd),
      posities: c.posities,
      perPlatform: [...perKruis.entries()]
        .filter(([sleutel]) => sleutel.endsWith(`|${symbool}`))
        .map(([sleutel, waardeUsd]) => ({
          sleutel: sleutel.slice(0, sleutel.indexOf('|')) as PlatformSleutel,
          waardeUsd,
        }))
        .sort((a, b) => b.waardeUsd - a.waardeUsd),
    }))
    .sort((a, b) => b.waardeUsd - a.waardeUsd);

  const platforms: PlatformRegel[] = [...perPlatform.entries()]
    .map(([sleutel, p]) => ({
      sleutel,
      waardeUsd: p.waardeUsd,
      aandeel: deel(p.waardeUsd, totaalUsd),
      posities: p.posities,
      zonderLivePrijs: p.zonderLivePrijs,
      coins: [...perKruis.entries()]
        .filter(([k]) => k.startsWith(`${sleutel}|`))
        .map(([k, waardeUsd]) => ({
          symbool: k.slice(k.indexOf('|') + 1),
          waardeUsd,
          aandeel: deel(waardeUsd, p.waardeUsd),
        }))
        .sort((a, b) => b.waardeUsd - a.waardeUsd),
    }))
    .sort((a, b) => b.waardeUsd - a.waardeUsd);

  return {
    coins,
    platforms,
    totaalUsd,
    gewaardeerd,
    zonderLivePrijs,
    grootsteCoinAandeel: coins[0]?.aandeel ?? 0,
    grootstePlatformAandeel: platforms[0]?.aandeel ?? 0,
  };
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

  // ---------- Detail: per coin, per platform en het kruispunt ----------
  const etoro = (id: string, symbool: string, aantalCoins?: number): PortfolioTrade =>
    ({ ...open(id, symbool, aantalCoins), bron: 'etoro' });

  // BTC staat op allebei de platforms, ETH alleen handmatig. Prijzen: BTC 100, ETH 50.
  // eToro: 3 BTC = 300. Handmatig: 1 BTC = 100 en 4 ETH = 200, samen 300. Totaal 600.
  const detail = berekenVerdelingDetail(
    [etoro('e1', 'BTC', 3), open('h1', 'BTC', 1), open('h2', 'ETH', 4)],
    { BTC: 100, ETH: 50 },
  );
  console.assert(detail.totaalUsd === 600, `totaal moet 600 zijn, was ${detail.totaalUsd}`);
  console.assert(detail.gewaardeerd === 3, `drie gewaardeerde posities, waren er ${detail.gewaardeerd}`);
  console.assert(detail.coins.length === 2, `twee coins, waren er ${detail.coins.length}`);
  console.assert(detail.coins[0].symbool === 'BTC' && detail.coins[0].waardeUsd === 400,
    `BTC telt over de platforms heen op tot 400, was ${detail.coins[0].waardeUsd}`);
  console.assert(detail.coins[0].posities === 2, `BTC zit in twee posities, waren er ${detail.coins[0].posities}`);
  console.assert(Math.abs(detail.coins[0].aandeel - 2 / 3) < 1e-9, `BTC is twee derde, was ${detail.coins[0].aandeel}`);

  // Het kruispunt: BTC staat op twee platforms, ETH op één.
  console.assert(detail.coins[0].perPlatform.length === 2, 'BTC staat op twee platforms');
  console.assert(detail.coins[0].perPlatform[0].sleutel === 'etoro' && detail.coins[0].perPlatform[0].waardeUsd === 300,
    'het grootste stuk BTC staat bij eToro');
  console.assert(detail.coins[1].perPlatform.length === 1 && detail.coins[1].perPlatform[0].sleutel === 'handmatig',
    'ETH staat alleen handmatig');

  // Platformkant. eToro en handmatig zijn allebei 300, dus allebei de helft.
  console.assert(detail.platforms.length === 2, `twee platforms, waren er ${detail.platforms.length}`);
  const handmatig = detail.platforms.find(p => p.sleutel === 'handmatig')!;
  console.assert(handmatig.waardeUsd === 300 && handmatig.posities === 2, `handmatig is 300 in 2 posities, was ${handmatig.waardeUsd}`);
  console.assert(Math.abs(handmatig.aandeel - 0.5) < 1e-9, `handmatig is de helft, was ${handmatig.aandeel}`);
  console.assert(handmatig.coins.length === 2 && handmatig.coins[0].symbool === 'ETH',
    `binnen handmatig is ETH (200) groter dan BTC (100), eerste was ${handmatig.coins[0].symbool}`);
  console.assert(Math.abs(handmatig.coins[0].aandeel - 2 / 3) < 1e-9,
    `binnen het platform telt het aandeel van het platform, was ${handmatig.coins[0].aandeel}`);
  console.assert(platformLabel('etoro') === 'eToro', 'het label van etoro is eToro');

  // Concentratie: het grootste stuk van één coin en van één platform.
  console.assert(Math.abs(detail.grootsteCoinAandeel - 2 / 3) < 1e-9, 'BTC is de grootste coin');
  console.assert(Math.abs(detail.grootstePlatformAandeel - 0.5) < 1e-9, 'geen platform is groter dan de helft');

  // Posities zonder aantal of live koers vallen buiten de verdeling, maar worden per platform wel
  // geteld: anders lijkt een platform met alleen zulke posities helemaal niet te bestaan.
  const onvolledigDetail = berekenVerdelingDetail(
    [etoro('e1', 'BTC', 2), etoro('e2', 'ADA', 5), open('h1', 'ETH')],
    { BTC: 100 },
  );
  console.assert(onvolledigDetail.totaalUsd === 200, `alleen BTC telt mee, was ${onvolledigDetail.totaalUsd}`);
  console.assert(onvolledigDetail.zonderLivePrijs === 2, `ADA en ETH vallen weg, waren er ${onvolledigDetail.zonderLivePrijs}`);
  const etoroVak = onvolledigDetail.platforms.find(p => p.sleutel === 'etoro')!;
  console.assert(etoroVak.zonderLivePrijs === 1, `eToro heeft één positie zonder koers, was ${etoroVak.zonderLivePrijs}`);
  const handVak = onvolledigDetail.platforms.find(p => p.sleutel === 'handmatig')!;
  console.assert(handVak !== undefined && handVak.waardeUsd === 0 && handVak.zonderLivePrijs === 1,
    'een platform met alleen niet te wegen posities blijft in de lijst staan');
  console.assert(handVak.aandeel === 0 && handVak.coins.length === 0, 'zo`n platform heeft geen aandeel en geen coins');

  // Niets te verdelen.
  const leegDetail = berekenVerdelingDetail([], {});
  console.assert(leegDetail.coins.length === 0 && leegDetail.platforms.length === 0, 'geen trades geeft een leeg detail');
  console.assert(leegDetail.grootsteCoinAandeel === 0 && leegDetail.grootstePlatformAandeel === 0,
    'zonder posities is er geen concentratie');

  // Gesloten posities doen niet mee, ook niet in de platformtelling.
  const alleenGesloten = berekenVerdelingDetail([{ ...etoro('e1', 'BTC', 2), status: 'gewonnen' }], { BTC: 100 });
  console.assert(alleenGesloten.platforms.length === 0, 'een gesloten positie levert geen platformregel op');

  if (missers > 0) {
    console.error(`verdeling.ts self-check: ${missers} misser(s)`);
    process.exit(1);
  }
  console.log('verdeling.ts self-check geslaagd');
}
