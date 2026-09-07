// Verdeling van je open posities over coins, voor het cirkeldiagram op het portfolio-scherm.
// Pure rekenmodule zonder React, in dezelfde lijn als state/statistieken.ts.
//
// Let op het verschil met berekenPortfolioWaarde: die rekent je eigen vermogen uit (inleg plus
// ongerealiseerd, richting-bewust). Hier gaat het om blootstelling, dus om de MARKTwaarde van een
// positie: livePrijs * aantalCoins. Voor een short is dat de waarde van wat je moet terugleveren.
// Die telt hier gewoon als omvang mee, want de verdeling zegt waar je risico zit en niet of je
// erop wint of verliest.

import { PortfolioTrade } from '../state/portfolioTypes';
import { PlatformId, platformNaam, platformVanTrade } from './platforms';

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
// HET VOLLEDIGE OVERZICHT
//
// Wat het detailscherm nodig heeft en de kaart niet: de volledige coinlijst zonder Overig, de
// verdeling over de platforms waar je posities staan, het kruispunt van die twee (dezelfde coin
// kan op meer dan één plek staan), en met naam en toenaam wat er niet te wegen viel.
//
// Zelfde weegregel als berekenVerdeling hierboven, en dat is geen toeval maar een eis: totaalUsd,
// gewaardeerd en zonderLivePrijs moeten op dezelfde invoer exact gelijk zijn aan die van
// berekenVerdeling. Anders staat er op het detailscherm een ander totaal dan in het gat van de ring
// die je aantikte, en dan gelooft niemand meer een van beide. De self-check bewaakt dat.
// ============================================================================

export interface CoinRegel {
  symbool: string;
  waardeUsd: number;
  aandeel: number;              // 0..1 van het totaal
  posities: number;             // open trades in deze coin die meetellen
  platforms: PlatformId[];      // aflopend op waarde, uniek
}

export interface PlatformRegel {
  id: PlatformId;
  waardeUsd: number;
  aandeel: number;              // 0..1 van het totaal
  posities: number;
  coins: number;
}

// Alleen coins die op twee of meer platforms staan. Voor de rest zegt de merkjesrij in de coinlijst
// het al, en een blok met louter regels van 100 procent voegt niets toe.
export interface KruisRegel {
  symbool: string;
  waardeUsd: number;
  // aandeel is het aandeel BINNEN deze coin, niet binnen je portfolio.
  delen: { platform: PlatformId; waardeUsd: number; aandeel: number }[];
}

export interface NietGewogen {
  symbool: string;
  reden: 'geen aantal' | 'geen live koers';
  platform: PlatformId;
}

export interface VolledigeVerdeling {
  coins: CoinRegel[];           // aflopend, volledig, geen Overig
  platforms: PlatformRegel[];   // aflopend
  kruis: KruisRegel[];
  nietGewogen: NietGewogen[];
  totaalUsd: number;
  gewaardeerd: number;
  zonderLivePrijs: number;
}

// Percentage zoals het in beeld komt. Een aandeel onder een tiende procent afronden op 0.0% is
// onwaar: die positie bestaat wel degelijk, hij is alleen klein.
export function aandeelTekst(aandeel: number): string {
  if (aandeel > 0 && aandeel < 0.001) return '<0.1%';
  return `${(aandeel * 100).toFixed(1)}%`;
}

// Voor de schermlezer, die "34.3%" voorleest als "vierendertig punt drie". Uitgeschreven met een
// komma en het woord procent leest dat wel als een Nederlands percentage.
export function spreekAandeel(aandeel: number): string {
  if (aandeel > 0 && aandeel < 0.001) return 'minder dan 0,1 procent';
  return `${(aandeel * 100).toFixed(1).replace('.', ',')} procent`;
}

export function berekenVolledigeVerdeling(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
): VolledigeVerdeling {
  const open = trades.filter(t => t.status === 'open');

  // Eén doorloop, drie optellingen: per coin, per platform, en per combinatie van die twee.
  const perCoin = new Map<string, { waardeUsd: number; posities: number }>();
  const perPlatform = new Map<PlatformId, { waardeUsd: number; posities: number; coins: Set<string> }>();
  const perKruis = new Map<string, number>();   // `${platform}|${symbool}`
  const nietGewogen: NietGewogen[] = [];
  let gewaardeerd = 0;

  for (const t of open) {
    const platform = platformVanTrade(t);
    const livePrijs = livePrijzen[t.symbool];
    const heeftAantal = typeof t.aantalCoins === 'number' && t.aantalCoins > 0;

    if (!heeftAantal || typeof livePrijs !== 'number') {
      // De reden apart houden: op het scherm is "geen aantal" iets dat je zelf kunt oplossen door
      // de trade aan te vullen, en "geen live koers" iets dat vanzelf goed komt na een sync.
      nietGewogen.push({
        symbool: t.symbool,
        reden: heeftAantal ? 'geen live koers' : 'geen aantal',
        platform,
      });
      continue;
    }

    const waarde = livePrijs * t.aantalCoins!;
    gewaardeerd += 1;

    const coin = perCoin.get(t.symbool) ?? { waardeUsd: 0, posities: 0 };
    coin.waardeUsd += waarde;
    coin.posities += 1;
    perCoin.set(t.symbool, coin);

    const vak = perPlatform.get(platform) ?? { waardeUsd: 0, posities: 0, coins: new Set<string>() };
    vak.waardeUsd += waarde;
    vak.posities += 1;
    vak.coins.add(t.symbool);
    perPlatform.set(platform, vak);

    const kruisSleutel = `${platform}|${t.symbool}`;
    perKruis.set(kruisSleutel, (perKruis.get(kruisSleutel) ?? 0) + waarde);
  }

  const totaalUsd = [...perCoin.values()].reduce((s, c) => s + c.waardeUsd, 0);
  // Alles op nul waarderen kan: een coin waarvan de koers 0 binnenkomt. Dan is elk aandeel 0 in
  // plaats van een deling door nul, precies zoals in berekenVerdeling.
  const deel = (w: number, van: number) => (van > 0 ? w / van : 0);

  // De delen van één coin over de platforms, aflopend. Wordt twee keer gebruikt: voor de
  // merkjesrij bij een coin en voor het kruisblok.
  const delenVan = (symbool: string) =>
    [...perKruis.entries()]
      .filter(([sleutel]) => sleutel.slice(sleutel.indexOf('|') + 1) === symbool)
      .map(([sleutel, waardeUsd]) => ({
        platform: sleutel.slice(0, sleutel.indexOf('|')) as PlatformId,
        waardeUsd,
      }))
      .sort((a, b) => b.waardeUsd - a.waardeUsd);

  const coins: CoinRegel[] = [...perCoin.entries()]
    .map(([symbool, c]) => ({
      symbool,
      waardeUsd: c.waardeUsd,
      aandeel: deel(c.waardeUsd, totaalUsd),
      posities: c.posities,
      platforms: delenVan(symbool).map(d => d.platform),
    }))
    .sort((a, b) => b.waardeUsd - a.waardeUsd);

  const platforms: PlatformRegel[] = [...perPlatform.entries()]
    .map(([id, p]) => ({
      id,
      waardeUsd: p.waardeUsd,
      aandeel: deel(p.waardeUsd, totaalUsd),
      posities: p.posities,
      coins: p.coins.size,
    }))
    .sort((a, b) => b.waardeUsd - a.waardeUsd);

  const kruis: KruisRegel[] = coins
    .filter(c => c.platforms.length > 1)
    .map(c => ({
      symbool: c.symbool,
      waardeUsd: c.waardeUsd,
      delen: delenVan(c.symbool).map(d => ({
        platform: d.platform,
        waardeUsd: d.waardeUsd,
        aandeel: deel(d.waardeUsd, c.waardeUsd),
      })),
    }));

  return {
    coins,
    platforms,
    kruis,
    nietGewogen,
    totaalUsd,
    gewaardeerd,
    zonderLivePrijs: nietGewogen.length,
  };
}

// Vanaf hier noemt Kader concentratie bij naam. Bewust een keuze en geen norm, dus het getal staat
// in de zin zodat je het zelf kunt wegen.
const CONCENTRATIE_DREMPEL = 0.4;

// Feitelijke observaties over je verdeling, in vaste volgorde. Geen aanbevelingen: Kader zegt wat
// er staat, niet wat je moet doen. Dat is niet alleen een toonkwestie, het is de grens tussen een
// analysetool en beleggingsadvies.
export function duidingen(v: VolledigeVerdeling): string[] {
  if (v.coins.length === 0) return [];

  const zinnen: string[] = [];
  const grootsteCoin = v.coins[0];
  const grootstePlatform = v.platforms[0];

  zinnen.push(
    v.coins.length === 1
      ? `Alles staat in ${grootsteCoin.symbool}.`
      : `Je grootste positie is ${grootsteCoin.symbool}, ${aandeelTekst(grootsteCoin.aandeel)} van je blootstelling.`,
  );

  // Onder de vier coins zegt "de drie grootste" bijna hetzelfde als "alles", en dat is geen
  // observatie meer.
  if (v.coins.length >= 4) {
    const top3 = v.coins.slice(0, 3).reduce((s, c) => s + c.aandeel, 0);
    zinnen.push(`De drie grootste zijn samen ${aandeelTekst(top3)}.`);
  }

  if (grootstePlatform !== undefined) {
    zinnen.push(
      v.platforms.length === 1
        ? `Alles staat op ${platformNaam(grootstePlatform.id)}.`
        : `${aandeelTekst(grootstePlatform.aandeel)} staat op ${platformNaam(grootstePlatform.id)}.`,
    );
  }

  if (grootsteCoin.aandeel >= CONCENTRATIE_DREMPEL) {
    zinnen.push(
      `Meer dan ${Math.round(CONCENTRATIE_DREMPEL * 100)} procent in één coin betekent dat je resultaat vooral van die coin afhangt.`,
    );
  }

  if (v.platforms.length === 1 && v.coins.length > 1) {
    zinnen.push('Eén platform betekent dat een storing daar al je posities tegelijk raakt.');
  }

  return zinnen;
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

  // ---------- Volledig overzicht: coins, platforms, kruis en duidingen ----------
  const etoroTrade = (id: string, symbool: string, aantalCoins?: number): PortfolioTrade =>
    ({ ...open(id, symbool, aantalCoins), bron: 'etoro' });

  // BTC staat op allebei de platforms, ETH alleen handmatig. Prijzen: BTC 100, ETH 50.
  // eToro: 3 BTC = 300. Handmatig: 1 BTC = 100 en 4 ETH = 200, samen 300. Totaal 600.
  const vol = berekenVolledigeVerdeling(
    [etoroTrade('e1', 'BTC', 3), open('h1', 'BTC', 1), open('h2', 'ETH', 4)],
    { BTC: 100, ETH: 50 },
  );
  console.assert(vol.totaalUsd === 600, `totaal moet 600 zijn, was ${vol.totaalUsd}`);
  console.assert(vol.coins.length === 2, `twee coins, waren er ${vol.coins.length}`);
  console.assert(vol.coins[0].symbool === 'BTC' && vol.coins[0].waardeUsd === 400,
    `BTC telt over de platforms heen op tot 400, was ${vol.coins[0].waardeUsd}`);
  console.assert(vol.coins[0].posities === 2, `BTC zit in twee posities, waren er ${vol.coins[0].posities}`);
  console.assert(Math.abs(vol.coins[0].aandeel - 2 / 3) < 1e-9, `BTC is twee derde, was ${vol.coins[0].aandeel}`);
  console.assert(vol.coins[0].platforms.join(',') === 'etoro,handmatig',
    `BTC staat op twee platforms, grootste eerst, was ${vol.coins[0].platforms.join(',')}`);
  console.assert(vol.coins[1].platforms.join(',') === 'handmatig', 'ETH staat alleen handmatig');

  // Platformkant: eToro en handmatig zijn allebei 300, dus allebei de helft.
  console.assert(vol.platforms.length === 2, `twee platforms, waren er ${vol.platforms.length}`);
  const handVak = vol.platforms.find(p => p.id === 'handmatig')!;
  console.assert(handVak.waardeUsd === 300 && handVak.posities === 2 && handVak.coins === 2,
    `handmatig is 300 in 2 posities over 2 coins, was ${handVak.waardeUsd}/${handVak.posities}/${handVak.coins}`);
  console.assert(Math.abs(handVak.aandeel - 0.5) < 1e-9, `handmatig is de helft, was ${handVak.aandeel}`);

  // Kruis: alleen BTC staat op meer dan één plek, en de percentages gaan over de coin zelf.
  console.assert(vol.kruis.length === 1 && vol.kruis[0].symbool === 'BTC',
    `alleen BTC staat op twee platforms, waren er ${vol.kruis.length}`);
  console.assert(Math.abs(vol.kruis[0].delen[0].aandeel - 0.75) < 1e-9,
    `300 van de 400 BTC staat bij eToro, dat is 75 procent van de coin, was ${vol.kruis[0].delen[0].aandeel}`);

  // Duidingen: feitelijk, geen advies. BTC is twee derde, dus over de concentratiedrempel.
  const zinnen = duidingen(vol);
  console.assert(zinnen[0] === 'Je grootste positie is BTC, 66.7% van je blootstelling.',
    `eerste duiding klopt niet: ${zinnen[0]}`);
  console.assert(zinnen.some(z => z.startsWith('50.0% staat op ')), `platformzin ontbreekt: ${zinnen.join(' | ')}`);
  console.assert(zinnen.some(z => z.includes('vooral van die coin afhangt')), 'de concentratiezin hoort erbij boven 40 procent');
  // Twee coins is te weinig voor "de drie grootste".
  console.assert(!zinnen.some(z => z.includes('De drie grootste')), 'onder de vier coins geen top-3-zin');

  // ---------- Eén coin, één platform ----------
  const eenCoin = berekenVolledigeVerdeling([etoroTrade('e1', 'BTC', 2)], { BTC: 100 });
  const eenZinnen = duidingen(eenCoin);
  console.assert(eenZinnen[0] === 'Alles staat in BTC.', `bij één coin: ${eenZinnen[0]}`);
  console.assert(eenZinnen.some(z => z === 'Alles staat op eToro.'), `bij één platform: ${eenZinnen.join(' | ')}`);
  console.assert(eenCoin.kruis.length === 0, 'één platform geeft geen kruisblok');
  // De zin over één platform slaat over bij één coin: dan zegt "alles staat in BTC" het al.
  console.assert(!eenZinnen.some(z => z.includes('storing')), 'geen storingszin bij één coin');

  // ---------- Demo staat apart ----------
  const demo = berekenVolledigeVerdeling(
    [{ ...etoroTrade('e1', 'BTC', 1), etoroOmgeving: 'demo' }, etoroTrade('e2', 'BTC', 1)],
    { BTC: 100 },
  );
  console.assert(demo.platforms.length === 2, `demo krijgt een eigen platformregel, waren er ${demo.platforms.length}`);
  console.assert(demo.kruis.length === 1, 'dezelfde coin op echt en demo is ook een kruis');

  // ---------- Niet te wegen posities, met reden ----------
  const onvol = berekenVolledigeVerdeling(
    [etoroTrade('e1', 'BTC', 2), etoroTrade('e2', 'ADA', 5), open('h1', 'ETH')],
    { BTC: 100 },
  );
  console.assert(onvol.totaalUsd === 200, `alleen BTC telt mee, was ${onvol.totaalUsd}`);
  console.assert(onvol.nietGewogen.length === 2, `ADA en ETH vallen weg, waren er ${onvol.nietGewogen.length}`);
  const ada = onvol.nietGewogen.find(n => n.symbool === 'ADA')!;
  console.assert(ada.reden === 'geen live koers' && ada.platform === 'etoro',
    `ADA heeft wel een aantal maar geen koers, was ${ada.reden}`);
  const eth = onvol.nietGewogen.find(n => n.symbool === 'ETH')!;
  console.assert(eth.reden === 'geen aantal', `ETH heeft geen aantal, was ${eth.reden}`);
  // Een platform waarop niets te wegen valt hoort niet in de platformlijst: daar zou 0 procent
  // staan terwijl er wel een positie is, en dat is misleidender dan hem weglaten. Blok 6 noemt hem.
  console.assert(!onvol.platforms.some(p => p.id === 'handmatig'),
    'een platform zonder weegbare positie staat niet in de platformlijst');

  // ---------- Hetzelfde totaal als de kaart ----------
  // Dit is de eis waar het scherm op staat of valt: het bedrag boven aan het detailscherm moet
  // exact het bedrag in het gat van de ring zijn.
  const zelfdeInvoer: PortfolioTrade[] = [
    etoroTrade('e1', 'BTC', 3), open('h1', 'BTC', 1), open('h2', 'ETH', 4),
    etoroTrade('e3', 'ADA', 5), open('h3', 'XRP'),
  ];
  const zelfdePrijzen = { BTC: 100, ETH: 50 };
  const kaart = berekenVerdeling(zelfdeInvoer, zelfdePrijzen);
  const scherm = berekenVolledigeVerdeling(zelfdeInvoer, zelfdePrijzen);
  console.assert(kaart.totaalUsd === scherm.totaalUsd,
    `kaart en scherm moeten hetzelfde totaal geven, waren ${kaart.totaalUsd} en ${scherm.totaalUsd}`);
  console.assert(kaart.gewaardeerd === scherm.gewaardeerd,
    `gewaardeerd moet gelijk zijn, waren ${kaart.gewaardeerd} en ${scherm.gewaardeerd}`);
  console.assert(kaart.zonderLivePrijs === scherm.zonderLivePrijs,
    `zonderLivePrijs moet gelijk zijn, waren ${kaart.zonderLivePrijs} en ${scherm.zonderLivePrijs}`);

  // ---------- Niets te verdelen ----------
  const leegVol = berekenVolledigeVerdeling([], {});
  console.assert(leegVol.coins.length === 0 && leegVol.platforms.length === 0, 'geen trades geeft een leeg overzicht');
  console.assert(duidingen(leegVol).length === 0, 'zonder posities valt er niets op te merken');
  console.assert(berekenVolledigeVerdeling([{ ...etoroTrade('e1', 'BTC', 2), status: 'gewonnen' }], { BTC: 100 }).platforms.length === 0,
    'een gesloten positie levert geen platformregel op');

  // ---------- Percentages in beeld ----------
  console.assert(aandeelTekst(0.343) === '34.3%', `aandeelTekst gaf ${aandeelTekst(0.343)}`);
  // Afronden op 0.0% zou beweren dat de positie er niet is.
  console.assert(aandeelTekst(0.0004) === '<0.1%', `een heel klein aandeel moet <0.1% geven, was ${aandeelTekst(0.0004)}`);
  console.assert(aandeelTekst(0) === '0.0%', 'precies nul is gewoon 0.0%');
  console.assert(spreekAandeel(0.343) === '34,3 procent', `spreekAandeel gaf ${spreekAandeel(0.343)}`);
  console.assert(spreekAandeel(0.0004) === 'minder dan 0,1 procent', `spreekAandeel gaf ${spreekAandeel(0.0004)}`);

  if (missers > 0) {
    console.error(`verdeling.ts self-check: ${missers} misser(s)`);
    process.exit(1);
  }
  console.log('verdeling.ts self-check geslaagd');
}
