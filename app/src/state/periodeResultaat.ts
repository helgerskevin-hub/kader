import { PortfolioTrade, tekenVan } from './portfolioTypes';

// Je resultaat over een tijdvak, en dat is iets anders dan de twee getallen die de portfoliokaart
// al toont. Het grote bedrag is je vermogen nu, de groene of rode regel eronder is het
// ongerealiseerde resultaat van je open posities sinds je ze kocht. Geen van beide heeft een
// tijdvak: ze zijn altijd "nu" en "sinds altijd".
//
// Dit bestand rekent wél over een tijdvak, en telt daarvoor twee dingen bij elkaar op:
//
//   1. Gerealiseerd: wat je in die periode hebt afgesloten. Lokaal en exact, want een gesloten
//      trade heeft een slotTijd en een resultaat.
//   2. Ongerealiseerd: hoeveel je nog open posities in diezelfde periode zijn bewogen. Daarvoor is
//      per positie een referentiekoers nodig, de slotkoers op de dag waarop de periode begon.
//
// Wat hier nadrukkelijk NIET gebeurt, is een vermogenscurve reconstrueren. Kader bewaart geen
// historie van je cashsaldo en geen momentopnames van je totale vermogen, dus "wat was ik een jaar
// geleden waard" is niet te beantwoorden zonder het te verzinnen. Dit is de eerlijke variant van
// dezelfde vraag: wat heeft het geld dat in die periode aan het werk was, opgeleverd.

export type PeriodeId = 'dag' | '1M' | '3M' | '6M' | '1J' | 'alles';

export interface Periode {
  id: PeriodeId;
  label: string;
  // null = geen ondergrens. Bij 'dag' betekent null niet "alles" maar "vanaf middernacht", zie
  // periodeGrens: een kalenderdag is geen vast aantal dagen terug.
  dagen: number | null;
}

// Labels in dezelfde schrijfwijze als BEREIKEN in engine/grafiekBereik.ts, dat op de koersgrafiek
// al 1M/3M/6M/Alles gebruikt. Twee woorden voor hetzelfde tijdvak op twee plekken in dezelfde app
// is een verschil zonder reden.
export const PERIODES: readonly Periode[] = [
  { id: 'dag', label: 'Dag', dagen: null },
  { id: '1M', label: '1M', dagen: 30 },
  { id: '3M', label: '3M', dagen: 90 },
  { id: '6M', label: '6M', dagen: 180 },
  { id: '1J', label: '1J', dagen: 365 },
  { id: 'alles', label: 'Alles', dagen: null },
];

// Een maand als eerste keuze. 'Dag' staat vaak leeg en is een zwakke eerste indruk, 'Alles' zegt
// weinig over hoe het nu gaat.
export const STANDAARD_PERIODE: PeriodeId = '1M';

// Hoeveel dagen historie er maximaal nodig is om elke periode te kunnen uitrekenen, met wat marge
// voor dagen waarop de beurs of de bron niets teruggaf.
export const HISTORIE_DAGEN = 400;

export interface KoersPunt {
  tijd: number;   // epoch ms
  close: number;
}

// Hoe compleet het cijfer is. Bewust onderdeel van de uitkomst en niet iets dat de kaart zelf moet
// afleiden: of een getal de hele vraag beantwoordt of maar de helft, hoort bij het getal.
//
// 'alleen-gerealiseerd' is de faalstaat die er het meest toe doet. Gerealiseerd plus nul
// ongerealiseerd ziet er precies zo uit als een compleet cijfer waarin de koersen toevallig
// stilstonden, en dat verschil mag niet in een voetnoot verdwijnen: de kaart zet bij deze status ook
// een andere kop boven het getal.
export type PeriodeStatus = 'leeg' | 'compleet' | 'deels' | 'alleen-gerealiseerd';

export interface PeriodeResultaat {
  status: PeriodeStatus;
  // Gesloten trades in deze periode.
  gerealiseerdUsd: number;
  gesloten: number;
  // Beweging van de nu nog open posities over deze periode.
  ongerealiseerdUsd: number;
  meegewogen: number;
  // Gewaardeerde open posities (aantal én live koers bekend) waarvoor toch geen referentiekoers op de
  // periodegrens te bepalen was: geen historie ver genoeg terug, of een onbekend openingstijdstip
  // waardoor niet vast te stellen is of de positie er aan het begin van de periode al was.
  //
  // Posities zonder aantal of zonder live koers zitten hier NIET in. Die kan de kaart sowieso niet
  // waarderen en daar heeft hij al een eigen regel voor; ze hier nog een keer melden zou dezelfde
  // tekortkoming twee keer op één kaart zetten.
  zonderReferentie: number;
  // De som van de twee, of null als er in deze periode niets te melden valt. Bewust null en niet 0:
  // nul leest als "quitte gespeeld" en dat is iets anders dan "niets gebeurd".
  totaalUsd: number | null;
  // Resultaat afgezet tegen het geld dat in deze periode aan het werk was: de waarde van de
  // meegewogen open posities op de periodegrens, plus de inleg van de trades die erin gesloten
  // zijn. Null als die basis nul is, want dan valt er niets in te delen.
  pct: number | null;
}

// Begin van de periode als epoch ms, of null bij 'alles'. 'Dag' is de kalenderdag en niet
// "24 uur terug": wie 's ochtends kijkt wil weten wat vandaag deed, niet wat er sinds gisterochtend
// gebeurde.
export function periodeGrens(periode: PeriodeId, nu: number): number | null {
  if (periode === 'alles') return null;
  if (periode === 'dag') {
    const d = new Date(nu);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const dagen = PERIODES.find(p => p.id === periode)?.dagen;
  if (!dagen) return null;
  return nu - dagen * 24 * 60 * 60 * 1000;
}

// De laatst bekende slotkoers op of vóór een tijdstip. Reeks mag ongesorteerd binnenkomen; er wordt
// niet geïnterpoleerd en niet vooruitgekeken. Is er geen enkel punt van vóór dat tijdstip, dan
// reikt de historie niet ver genoeg terug en is het antwoord null, niet het oudste punt dat er
// toevallig wel is: dat zou een koers van ná de grens als koers van vóór de grens presenteren.
export function koersOp(reeks: KoersPunt[] | undefined, tijd: number): number | null {
  if (!reeks || reeks.length === 0) return null;
  let beste: KoersPunt | null = null;
  for (const punt of reeks) {
    if (punt.tijd > tijd) continue;
    if (typeof punt.close !== 'number' || !isFinite(punt.close) || punt.close <= 0) continue;
    if (beste === null || punt.tijd > beste.tijd) beste = punt;
  }
  return beste === null ? null : beste.close;
}

// Het werkelijke resultaat van een gesloten trade in dollars. Zelfde regels als in statistieken.ts:
// eToro's netProfit is inclusief kosten en gaat dus voor; voor handmatige trades blijft het bruto
// koersverschil de beste schatting, met het teken erin zodat een short die in winst sloot (koers
// daalde) ook als winst telt.
function resultaatVan(t: PortfolioTrade): number | null {
  if (typeof t.resultaatUsd === 'number') return t.resultaatUsd;
  const exit = t.exitPrijs ?? (t.status === 'gewonnen' ? t.takeProfit : t.stopLoss);
  if (typeof t.aantalCoins === 'number' && t.aantalCoins > 0) {
    return tekenVan(t) * (exit - t.entryPrijs) * t.aantalCoins;
  }
  return null;
}

export function berekenPeriodeResultaat(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
  historie: Record<string, KoersPunt[]>,
  periode: PeriodeId,
  nu: number = Date.now(),
): PeriodeResultaat {
  const grens = periodeGrens(periode, nu);

  // ---------- Gerealiseerd ----------
  // Een gesloten trade zonder slotTijd is niet in een tijdvak te plaatsen. Die telt daarom alleen
  // mee bij 'alles'. Dat is geen gok maar precies het punt: zonder tijdstip weet Kader niet of hij
  // in deze periode valt, dus hoort hij niet in een periode-antwoord.
  const gesloten = trades.filter(t => {
    if (t.status === 'open') return false;
    if (grens === null) return true;
    return typeof t.slotTijd === 'number' && t.slotTijd >= grens;
  });

  let gerealiseerdUsd = 0;
  let gerealiseerdeBasis = 0;
  for (const t of gesloten) {
    const r = resultaatVan(t);
    if (r !== null) gerealiseerdUsd += r;
    if (typeof t.aantalCoins === 'number' && t.aantalCoins > 0) {
      gerealiseerdeBasis += t.entryPrijs * t.aantalCoins;
    }
  }

  // ---------- Ongerealiseerd ----------
  const open = trades.filter(t => t.status === 'open');
  let ongerealiseerdUsd = 0;
  let openBasis = 0;
  let meegewogen = 0;
  let zonderReferentie = 0;

  // Alleen posities die de kaart überhaupt kan waarderen doen mee aan deze telling. Een positie
  // zonder aantal of zonder live koers is geen tekortkoming van dit blok maar van de waardering, en
  // staat al in een eigen regel op de kaart.
  let gewaardeerd = 0;

  for (const t of open) {
    const live = livePrijzen[t.symbool];
    const heeftAantal = typeof t.aantalCoins === 'number' && t.aantalCoins > 0;
    if (!heeftAantal || typeof live !== 'number') continue;
    gewaardeerd += 1;

    const referentie = referentiePrijs(t, historie, grens);
    if (referentie === null) {
      zonderReferentie += 1;
      continue;
    }

    ongerealiseerdUsd += tekenVan(t) * (live - referentie) * t.aantalCoins!;
    openBasis += referentie * t.aantalCoins!;
    meegewogen += 1;
  }

  // 'leeg' is niet hetzelfde als een resultaat van nul: er valt in deze periode niets te melden,
  // niet "het leverde niets op". De kaart toont daar een streepje en geen bedrag.
  const status: PeriodeStatus =
    gesloten.length === 0 && gewaardeerd === 0 ? 'leeg'
    : gewaardeerd > 0 && meegewogen === 0 ? 'alleen-gerealiseerd'
    : zonderReferentie > 0 ? 'deels'
    : 'compleet';

  const totaalUsd = status === 'leeg' ? null : gerealiseerdUsd + ongerealiseerdUsd;
  const basis = gerealiseerdeBasis + openBasis;
  const pct = totaalUsd !== null && basis > 0 ? (totaalUsd / basis) * 100 : null;

  return {
    status,
    gerealiseerdUsd,
    gesloten: gesloten.length,
    ongerealiseerdUsd,
    meegewogen,
    zonderReferentie,
    totaalUsd,
    pct,
  };
}

// Waartegen de huidige koers van een open positie afgezet wordt.
//
// Bij 'alles' is dat altijd de entryprijs, en dan komt er precies het ongerealiseerde resultaat uit
// dat de kaart bovenaan al toont. Dat is de bedoeling en meteen de beste controle op deze functie.
//
// Binnen een tijdvak hangt het ervan af of de positie er aan het begin van de periode al was. Was
// hij er al, dan is de koers op de grens de referentie. Is hij er ná de grens bij gekomen, dan is
// het je entryprijs: de beweging van daarvoor is niet van jou geweest.
//
// Weten we het openingstijdstip niet (posities van vóór het openTijd-veld), dan is er geen keuze te
// maken. Beide takken zouden fout kunnen zijn: de koers op de grens rekent beweging mee die je
// misschien niet bezat, de entryprijs zou bij 'Dag' de hele looptijd van de positie als resultaat
// van vandaag presenteren. Dan telt de positie niet mee en zegt de kaart dat erbij. eToro-posities
// lossen dit vanzelf op: de eerstvolgende sync vervangt ze door een versie mét openTijd.
function referentiePrijs(
  t: PortfolioTrade,
  historie: Record<string, KoersPunt[]>,
  grens: number | null,
): number | null {
  if (grens === null) return t.entryPrijs > 0 ? t.entryPrijs : null;
  if (typeof t.openTijd !== 'number') return null;
  if (t.openTijd >= grens) return t.entryPrijs > 0 ? t.entryPrijs : null;
  return koersOp(historie[t.symbool], grens);
}

// ponytail: self-check ipv testframework, run met `npx ts-node app/src/state/periodeResultaat.ts`
if (require.main === module) {
  const DAG = 24 * 60 * 60 * 1000;
  const nu = Date.parse('2026-09-11T12:00:00Z');

  const reeks = (punten: [number, number][]): KoersPunt[] =>
    punten.map(([dagenTerug, close]) => ({ tijd: nu - dagenTerug * DAG, close }));

  // BTC stond 100 dagen terug op 50, 40 dagen terug op 80, nu op 100.
  const historie: Record<string, KoersPunt[]> = {
    BTC: reeks([[100, 50], [40, 80], [0, 100]]),
  };
  const live = { BTC: 100, ETH: 20 };

  const openOud: PortfolioTrade = {
    id: 'o1', symbool: 'BTC', naam: 'Bitcoin', entryPrijs: 40, stopLoss: 30, takeProfit: 130,
    rr: 3, datum: '', status: 'open', aantalCoins: 2, openTijd: nu - 200 * DAG,
  };

  // ---------- koersOp ----------
  console.assert(koersOp(historie.BTC, nu - 45 * DAG) === 50, 'koersOp pakt het laatste punt vóór de grens');
  console.assert(koersOp(historie.BTC, nu - 39 * DAG) === 80, 'koersOp pakt 80 zodra dat punt gepasseerd is');
  console.assert(koersOp(historie.BTC, nu - 300 * DAG) === null, 'geen punt vóór de grens is null, niet het oudste punt');
  console.assert(koersOp(undefined, nu) === null, 'ontbrekende reeks is null');

  // ---------- Alles komt uit op het gewone ongerealiseerde resultaat ----------
  // Entry 40, live 100, 2 coins => +120.
  const alles = berekenPeriodeResultaat([openOud], live, historie, 'alles', nu);
  console.assert(alles.ongerealiseerdUsd === 120, `alles moet +120 zijn, was ${alles.ongerealiseerdUsd}`);
  console.assert(alles.totaalUsd === 120, `alles totaal moet 120 zijn, was ${alles.totaalUsd}`);
  console.assert(alles.pct === 150, `120 op een inleg van 80 is 150%, was ${alles.pct}`);
  console.assert(alles.zonderReferentie === 0, 'alles heeft geen historie nodig');

  // ---------- Binnen een tijdvak telt alleen de beweging in dat tijdvak ----------
  // 1M: koers op de grens is 80 (het punt van 40 dagen terug), live 100, 2 coins => +40.
  const maand = berekenPeriodeResultaat([openOud], live, historie, '1M', nu);
  console.assert(maand.ongerealiseerdUsd === 40, `1M moet +40 zijn, was ${maand.ongerealiseerdUsd}`);
  console.assert(maand.meegewogen === 1, '1M weegt de positie mee');

  // 3M: koers op de grens is 50, live 100, 2 coins => +100.
  const kwartaal = berekenPeriodeResultaat([openOud], live, historie, '3M', nu);
  console.assert(kwartaal.ongerealiseerdUsd === 100, `3M moet +100 zijn, was ${kwartaal.ongerealiseerdUsd}`);

  // ---------- Positie die ná de grens is geopend, rekent vanaf de entry ----------
  const openNieuw: PortfolioTrade = { ...openOud, id: 'o2', entryPrijs: 90, openTijd: nu - 10 * DAG };
  const nieuwMaand = berekenPeriodeResultaat([openNieuw], live, historie, '1M', nu);
  console.assert(nieuwMaand.ongerealiseerdUsd === 20, `positie van 10 dagen oud rekent vanaf entry 90: +20, was ${nieuwMaand.ongerealiseerdUsd}`);

  // ---------- Zonder openTijd telt de positie niet mee binnen een tijdvak ----------
  const zonderTijd: PortfolioTrade = { ...openOud, id: 'o3', openTijd: undefined };
  const zt = berekenPeriodeResultaat([zonderTijd], live, historie, '1M', nu);
  console.assert(zt.meegewogen === 0 && zt.zonderReferentie === 1, 'zonder openTijd geen tijdvak-antwoord');
  console.assert(zt.status === 'alleen-gerealiseerd', `een wel te waarderen positie zonder referentie is de faalstaat, was ${zt.status}`);
  console.assert(zt.totaalUsd === 0, 'de faalstaat toont het gerealiseerde deel, hier 0, en niet null');
  const ztAlles = berekenPeriodeResultaat([zonderTijd], live, historie, 'alles', nu);
  console.assert(ztAlles.ongerealiseerdUsd === 120, 'bij alles is openTijd niet nodig');

  // ---------- Zonder historie voor het symbool telt hij ook niet mee ----------
  const geenHistorie = berekenPeriodeResultaat([openOud], live, {}, '1M', nu);
  console.assert(geenHistorie.zonderReferentie === 1, 'geen koersreeks betekent geen referentie');

  // ---------- Zonder live koers of zonder aantal telt hij niet mee ----------
  const geenLive = berekenPeriodeResultaat([openOud], {}, historie, '1M', nu);
  console.assert(geenLive.meegewogen === 0, 'zonder live koers geen weging');
  const geenAantal = berekenPeriodeResultaat([{ ...openOud, aantalCoins: undefined }], live, historie, '1M', nu);
  console.assert(geenAantal.meegewogen === 0, 'zonder aantal geen weging');

  // ---------- Gerealiseerd: alleen wat in de periode gesloten is ----------
  const gisteren: PortfolioTrade = {
    id: 'g1', symbool: 'ETH', naam: 'Ethereum', entryPrijs: 10, stopLoss: 8, takeProfit: 16,
    rr: 3, datum: '', status: 'gewonnen', exitPrijs: 16, aantalCoins: 5,
    slotTijd: nu - 1 * DAG,
  };
  const langGeleden: PortfolioTrade = { ...gisteren, id: 'g2', slotTijd: nu - 200 * DAG };

  const dag = berekenPeriodeResultaat([gisteren, langGeleden], live, historie, 'dag', nu);
  console.assert(dag.gesloten === 0, 'gisteren gesloten valt buiten de kalenderdag vandaag');
  const maandGesloten = berekenPeriodeResultaat([gisteren, langGeleden], live, historie, '1M', nu);
  console.assert(maandGesloten.gesloten === 1, `1M telt alleen de trade van gisteren, was ${maandGesloten.gesloten}`);
  console.assert(maandGesloten.gerealiseerdUsd === 30, `(16-10)*5 = 30, was ${maandGesloten.gerealiseerdUsd}`);
  const allesGesloten = berekenPeriodeResultaat([gisteren, langGeleden], live, historie, 'alles', nu);
  console.assert(allesGesloten.gesloten === 2, 'alles telt allebei');

  // Gesloten trade zonder slotTijd: alleen bij alles.
  const zonderSlotTijd: PortfolioTrade = { ...gisteren, id: 'g3', slotTijd: undefined };
  const zst = berekenPeriodeResultaat([zonderSlotTijd], live, historie, '1M', nu);
  console.assert(zst.gesloten === 0, 'zonder slotTijd niet in een tijdvak');
  const zstAlles = berekenPeriodeResultaat([zonderSlotTijd], live, historie, 'alles', nu);
  console.assert(zstAlles.gesloten === 1, 'zonder slotTijd wel bij alles');

  // ---------- De twee delen tellen op ----------
  const samen = berekenPeriodeResultaat([openOud, gisteren], live, historie, '1M', nu);
  console.assert(samen.totaalUsd === 70, `40 open plus 30 gerealiseerd is 70, was ${samen.totaalUsd}`);
  // Basis: open 80 (2 x referentie 40... nee: 2 x 80 = 160) plus inleg gesloten 50 = 210.
  console.assert(Math.abs(samen.pct! - (70 / 210) * 100) < 1e-9, `pct over de basis van 210, was ${samen.pct}`);

  // ---------- Statussen ----------
  console.assert(alles.status === 'compleet', `alles met een weegbare positie is compleet, was ${alles.status}`);
  console.assert(maand.status === 'compleet', '1M met historie is compleet');
  const deels = berekenPeriodeResultaat([openOud, zonderTijd], live, historie, '1M', nu);
  console.assert(deels.status === 'deels', `een van de twee weegbaar is deels, was ${deels.status}`);
  console.assert(deels.zonderReferentie === 1 && deels.meegewogen === 1, 'deels telt beide kanten');

  // Een positie zonder live koers telt niet als "zonder referentie": die tekortkoming staat al
  // elders op de kaart en hoort er niet twee keer te staan.
  const zonderLive = berekenPeriodeResultaat([openOud], {}, historie, '1M', nu);
  console.assert(zonderLive.zonderReferentie === 0, 'geen live koers is geen referentieprobleem');
  console.assert(zonderLive.status === 'leeg', `niets te waarderen en niets gesloten is leeg, was ${zonderLive.status}`);

  // ---------- Lege portfolio ----------
  const leeg = berekenPeriodeResultaat([], {}, {}, '1M', nu);
  console.assert(leeg.status === 'leeg', 'lege portfolio is leeg');
  console.assert(leeg.totaalUsd === null && leeg.pct === null, 'lege portfolio geeft null');

  // ---------- Short ----------
  // Short op BTC, entry 120, live 100, 2 coins, al lang open. Bij alles: +40 (koers daalde).
  const short: PortfolioTrade = {
    id: 's1', symbool: 'BTC', naam: 'Bitcoin', entryPrijs: 120, stopLoss: 130, takeProfit: 70,
    rr: 3, datum: '', status: 'open', aantalCoins: 2, richting: 'short', openTijd: nu - 200 * DAG,
  };
  const shortAlles = berekenPeriodeResultaat([short], live, historie, 'alles', nu);
  console.assert(shortAlles.ongerealiseerdUsd === 40, `short in winst als de koers daalt: +40, was ${shortAlles.ongerealiseerdUsd}`);
  // 1M: referentie 80, live 100, koers STEEG dus de short verloor: -40.
  const shortMaand = berekenPeriodeResultaat([short], live, historie, '1M', nu);
  console.assert(shortMaand.ongerealiseerdUsd === -40, `short verliest bij een stijging: -40, was ${shortMaand.ongerealiseerdUsd}`);

  console.log('periodeResultaat.ts self-check geslaagd');
}
