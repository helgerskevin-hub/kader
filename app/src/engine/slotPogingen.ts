// De wachttrap na foute pincodes, puur: geen React, geen opslag, geen native klok. De aanroeper
// (state/slotOpslag.ts en de provider) leest de klok en schrijft de stand weg; hier zit alleen de
// rekenregel. Alle types en de trap zelf staan in het contract (state/vergrendelTypes.ts).
//
// Klokregels (zie ook Blokkade in het contract):
// - Zelfde bootTeller (niet -1) en bron 'monotoon': de monotone klok beslist, onverzetbaar.
// - Anders (reboot, onbekende teller, geen monotone klok): de wandklok via het anker, maar nooit
//   meer dan de monotone tijd. Bij een zekere reboot (beide tellers bekend en verschillend) telt
//   alleen de tijd sinds het opstarten (klok.monotoon). Bij een onbekende teller telt het
//   monotone verschil sinds het anker, of klok.monotoon als dat negatief is (dan is er herstart).
//   De tijd dat het toestel uit stond en de wandklok zijn niet te vertrouwen: een vooruitgezette
//   wandklok levert nooit winst op zolang de monotone klok doorloopt.
// - Met een monotone klok telt het monotone verschil altijd, ook als de wandklok is teruggezet.
//   Zonder monotone klok en met een teruggezette wandklok wordt er niets afgetrokken (herankeren).
// - Fail-closed: is een klokwaarde niet eindig, dan geldt de volle duur. Is de opgeslagen blokkade
//   kapot of weg terwijl er 5 of meer fouten zijn, dan komt er bij een eindige klok een verse
//   blokkade van de bijbehorende trede vanaf nu (hooguit één wachttijd extra, nooit permanent).
//
// Let op, bewust conservatief: na een ONOPGEMERKTE reboot met dezelfde teller (de teller werd niet
// opgehoogd of de blokkade is vlak na een boot gelegd) kan totMonotoon - nu.monotoon groter zijn dan
// de echte rest. De wachttijd kan dan langer duren dan nodig, maar nooit korter; de uitkomst wordt
// geclampt op [0, duurMs], dus ook niet langer dan één volle trede.
import {
  Blokkade,
  FOUTEN_VOOR_BLOKKADE,
  KlokStand,
  LEGE_POGINGEN,
  PogingenStand,
  WACHTTRAP_MS,
} from '../state/vergrendelTypes';

// Duur van de trede die bij dit aantal fouten hoort (5e fout 30 s, 6e 1 min, 7e 5 min, 8e+ 15 min).
function duurVoorFouten(fouten: number): number {
  const trede = Math.min(fouten - FOUTEN_VOOR_BLOKKADE, WACHTTRAP_MS.length - 1);
  return WACHTTRAP_MS[trede];
}

function eindig(...getallen: number[]): boolean {
  return getallen.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function monotoonVergelijkbaar(b: Blokkade, klok: KlokStand): boolean {
  return klok.bron === 'monotoon' && klok.bootTeller !== -1 && b.bootTeller === klok.bootTeller;
}

// Duur voor een kapotte of ontbrekende blokkade: die van de blokkade zelf als die klopt (nooit langer
// dan de langste trede), anders de trede die bij het aantal fouten hoort, anders de langste trede.
function terugvalDuur(b: Blokkade | null, fouten: number): number {
  if (b && eindig(b.duurMs) && b.duurMs > 0) return Math.min(b.duurMs, WACHTTRAP_MS[WACHTTRAP_MS.length - 1]);
  if (eindig(fouten) && fouten >= FOUTEN_VOOR_BLOKKADE) return duurVoorFouten(fouten);
  return WACHTTRAP_MS[WACHTTRAP_MS.length - 1];
}

// Er hoort een blokkade te zijn (vanaf de 5e fout), ook als hij ontbreekt of kapot is.
function blokkadeVerwacht(stand: PogingenStand): boolean {
  return stand.blokkade != null || (eindig(stand.fouten) && stand.fouten >= FOUTEN_VOOR_BLOKKADE);
}

// Resterende tijd en de vraag of het anker vernieuwd moet worden. Altijd geclampt op [0, duur].
// Een kapotte of ontbrekende blokkade (null, NaN) bij een eindige klok geeft de volle duur met
// herankeren: er komt een verse blokkade vanaf nu, dus hooguit één wachttijd extra en nooit een
// permanente. Bij een niet-eindige klok geldt de volle duur zonder herankeren (niets te schrijven).
function reken(
  b: Blokkade | null,
  klok: KlokStand,
  fouten: number,
): { rest: number; herankeren: boolean; duur: number } {
  const duur = terugvalDuur(b, fouten);
  const clamp = (ms: number) => Math.max(0, Math.min(duur, ms));
  if (!eindig(klok.monotoon, klok.wand, klok.bootTeller)) return { rest: duur, herankeren: false, duur };
  if (!b || !eindig(b.totMonotoon, b.bootTeller, b.wandAnker, b.resterendBijAnker)) {
    return { rest: duur, herankeren: true, duur };
  }
  if (monotoonVergelijkbaar(b, klok)) {
    return { rest: clamp(b.totMonotoon - klok.monotoon), herankeren: false, duur };
  }
  const wandVerschil = klok.wand - b.wandAnker;
  const zelfdeTeller = b.bootTeller === klok.bootTeller;
  // Herankeren als de teller verschilt of de wandklok terugsprong: bij -1 en -1 blijft het anker
  // gelden en hoeft er niet elke tick iets naar de kluis.
  const herankeren = !zelfdeTeller || wandVerschil < 0;
  let verstreken: number;
  if (klok.bron === 'monotoon') {
    // Het monotone verschil sinds het anker telt altijd, ook bij een teruggezette wandklok; een
    // vooruitgezette wandklok levert nooit meer op dan dat (min). Bij een zekere herstart (beide
    // tellers bekend en verschillend) of een negatief verschil telt alleen de tijd sinds opstarten.
    const zekerHerstart = b.bootTeller !== -1 && klok.bootTeller !== -1 && !zelfdeTeller;
    const monoVerschil = klok.monotoon - (b.totMonotoon - b.resterendBijAnker);
    const monoVerstreken = !zekerHerstart && monoVerschil >= 0 ? monoVerschil : Math.max(0, klok.monotoon);
    verstreken = wandVerschil < 0 ? monoVerstreken : Math.min(wandVerschil, monoVerstreken);
  } else {
    // Geen monotone klok: alleen de wandklok. Teruggezet telt niets (herankeren, rest ongewijzigd).
    verstreken = Math.max(0, wandVerschil);
  }
  return { rest: clamp(b.resterendBijAnker - verstreken), herankeren, duur };
}

// Resterende wachttijd in ms (0 als er geen loopt of hij voorbij is).
export function resterendeBlokkade(stand: PogingenStand, klok: KlokStand): number {
  if (!blokkadeVerwacht(stand)) return 0;
  return reken(stand.blokkade, klok, stand.fouten).rest;
}

// Geeft de stand terug met een blokkade die weer op de actuele klok leunt, als dat nodig is (na
// een reboot, bij een gewijzigde teller, een teruggezette wandklok of een kapotte blokkade). Is er
// niets te vernieuwen, dan komt precies dezelfde stand (===) terug: schrijf dan niets weg. Een
// verlopen blokkade blijft ongemoeid (de fouten tellen toch door).
export function herankerStand(stand: PogingenStand, klok: KlokStand): PogingenStand {
  if (!blokkadeVerwacht(stand)) return stand;
  const { rest, herankeren, duur } = reken(stand.blokkade, klok, stand.fouten);
  if (!herankeren || rest <= 0) return stand;
  return {
    ...stand,
    blokkade: {
      totMonotoon: klok.monotoon + rest,
      bootTeller: klok.bootTeller,
      wandAnker: klok.wand,
      resterendBijAnker: rest,
      duurMs: duur,
    },
  };
}

// Een foute pincode erbij. Vanaf de 5e fout volgt een nieuwe wachttijd, ook als de vorige net
// afliep (één poging per wachttijd). De aanroeper schrijft dit weg VOOR hij verifieert.
export function registreerFout(stand: PogingenStand, klok: KlokStand): PogingenStand {
  // Een niet-eindig of negatief aantal fouten telt als "net onder de grens": de volgende fout blokkeert.
  const basis = eindig(stand.fouten) && stand.fouten >= 0 ? stand.fouten : FOUTEN_VOOR_BLOKKADE - 1;
  const fouten = basis + 1;
  if (fouten < FOUTEN_VOOR_BLOKKADE) return { ...stand, fouten };
  const duurMs = duurVoorFouten(fouten);
  return {
    ...stand,
    fouten,
    blokkade: {
      totMonotoon: klok.monotoon + duurMs,
      bootTeller: klok.bootTeller,
      wandAnker: klok.wand,
      resterendBijAnker: duurMs,
      duurMs,
    },
  };
}

// Een goede pincode zet alles terug. Altijd een nieuw object, nooit de gedeelde constante zelf.
export function registreerSucces(): PogingenStand {
  return { ...LEGE_POGINGEN };
}

// Pogingen tot de eerstvolgende wachttijd, voor "Nog 2 pogingen." / "Nog 1 poging.". Bedoeld om
// na registreerFout aan te roepen: 3 fouten geeft 2, 4 fouten geeft 1, vanaf 5 fouten 0 (die
// laatste fout startte de wachttijd; na afloop is er weer precies één poging).
export function pogingenTotBlokkade(stand: PogingenStand): number {
  if (!eindig(stand.fouten)) return 0;
  return Math.max(0, FOUTEN_VOOR_BLOKKADE - stand.fouten);
}

// ponytail: self-check ipv testframework, run met `npx tsx src/engine/slotPogingen.ts` (vanuit app/)
if (require.main === module) {
  const assert: typeof import('node:assert/strict') = require('node:assert/strict');

  const SEC = 1000;
  const MIN = 60 * SEC;
  const W0 = 1_700_000_000_000;
  // Klok op een toestel met monotone bron.
  const klok = (monotoon: number, wand: number, bootTeller = 7): KlokStand =>
    ({ monotoon, bootTeller, wand, bron: 'monotoon' });
  const wandKlok = (wand: number): KlokStand =>
    ({ monotoon: wand, bootTeller: -1, wand, bron: 'wand' });

  // ---------- Lege stand en onveranderlijkheid ----------
  assert.ok(Object.isFrozen(LEGE_POGINGEN), 'LEGE_POGINGEN is bevroren');
  assert.throws(() => { (LEGE_POGINGEN as { fouten: number }).fouten = 9; }, TypeError);
  assert.equal(LEGE_POGINGEN.fouten, 0, 'mutatie besmet de constante niet');
  const leeg = registreerSucces();
  assert.deepEqual(leeg, { v: 1, fouten: 0, blokkade: null });
  assert.notEqual(leeg, LEGE_POGINGEN, 'succes geeft een nieuw object');
  leeg.fouten = 3; // mag, het is een kopie
  assert.equal(LEGE_POGINGEN.fouten, 0);
  assert.equal(resterendeBlokkade(registreerSucces(), klok(0, 0)), 0, 'geen blokkade, geen wachttijd');

  // ---------- De hele trap ----------
  let t = 1_000_000;
  let s: PogingenStand = registreerSucces();
  const verwacht: Array<number | null> = [null, null, null, null, 30 * SEC, MIN, 5 * MIN, 15 * MIN, 15 * MIN, 15 * MIN];
  const tellers = [4, 3, 2, 1, 0, 0, 0, 0, 0, 0];
  verwacht.forEach((duur, i) => {
    s = registreerFout(s, klok(t, 5_000_000 + t));
    assert.equal(s.fouten, i + 1, 'fouten tellen op');
    assert.equal(pogingenTotBlokkade(s), tellers[i], 'resterend tot blokkade na fout ' + (i + 1));
    if (duur === null) {
      assert.equal(s.blokkade, null, 'geen blokkade onder de 5 fouten');
      assert.equal(resterendeBlokkade(s, klok(t, 5_000_000 + t)), 0);
    } else {
      assert.equal(s.blokkade?.duurMs, duur, 'duur na fout ' + (i + 1));
      assert.equal(resterendeBlokkade(s, klok(t, 5_000_000 + t)), duur, 'volle wachttijd direct na de fout');
      // Na afloop is er weer ruimte voor een poging, de fouten blijven staan.
      assert.equal(resterendeBlokkade(s, klok(t + duur, 5_000_000 + t + duur)), 0);
      assert.equal(resterendeBlokkade(s, klok(t + duur + 1, 5_000_000 + t + duur + 1)), 0);
      t += duur + 1; // de wachttijd loopt af, volgende poging
    }
  });
  // De stand zelf is nergens gemuteerd.
  const s5 = registreerFout({ v: 1, fouten: 4, blokkade: null }, klok(0, 0));
  assert.equal(s5.blokkade?.duurMs, 30 * SEC);
  const voor = JSON.stringify(s5);
  registreerFout(s5, klok(1, 1));
  assert.equal(JSON.stringify(s5), voor, 'registreerFout muteert niet');

  // ---------- Monotone klok leidend, wandklok verzetten doet niets ----------
  const b30 = registreerFout({ v: 1, fouten: 4, blokkade: null }, klok(100_000, 1_700_000_000_000));
  assert.equal(resterendeBlokkade(b30, klok(110_000, 1_700_000_010_000)), 20 * SEC, 'halverwege');
  assert.equal(resterendeBlokkade(b30, klok(110_000, 1_600_000_000_000)), 20 * SEC, 'wandklok een eeuw terug: geen effect');
  assert.equal(resterendeBlokkade(b30, klok(110_000, 1_900_000_000_000)), 20 * SEC, 'wandklok ver vooruit: geen effect');
  assert.equal(herankerStand(b30, klok(110_000, 1_600_000_000_000)), b30, 'monotoon: niets te herankeren (zelfde object)');
  assert.equal(resterendeBlokkade(b30, klok(130_000, 0)), 0, 'precies afgelopen');

  // ---------- Clamp op [0, duurMs] ----------
  // Onopgemerkte reboot waarbij de teller gelijk lijkt maar monotoon kleiner is: rest > duur zonder clamp.
  assert.equal(resterendeBlokkade(b30, klok(5_000, 1_700_000_005_000)), 30 * SEC, 'nooit meer dan de duur');
  assert.equal(resterendeBlokkade(b30, klok(0, 0)), 30 * SEC);
  assert.equal(resterendeBlokkade(b30, klok(10_000_000, 0)), 0, 'nooit negatief');

  // ---------- Reboot: andere bootTeller ----------
  // Blokkade van 5 min gelegd op boot 7; na reboot (boot 8) is de monotone klok bij 20 s.
  const b5 = registreerFout(registreerFout({ v: 1, fouten: 5, blokkade: null }, klok(0, 0, 7)), klok(1_000_000, 2_000_000_000_000, 7));
  assert.equal(b5.blokkade?.duurMs, 5 * MIN);
  // Reboot vlak erna: wand 60 s later, monotoon sinds opstarten 20 s. Alleen die 20 s tellen.
  const na1 = klok(20_000, 2_000_000_060_000, 8);
  assert.equal(resterendeBlokkade(b5, na1), 5 * MIN - 20 * SEC, 'na reboot telt alleen de tijd sinds opstarten');
  // Wandklok sprong vooruit na de reboot (uur later): mag niet meer opleveren dan monotoon sinds boot.
  assert.equal(resterendeBlokkade(b5, klok(20_000, 2_000_003_600_000, 8)), 5 * MIN - 20 * SEC, 'vooruitgezette wandklok wint niets');
  // Wandklok teruggezet na reboot: eerste lezing herankert, niets af.
  assert.equal(resterendeBlokkade(b5, klok(20_000, 1_000, 8)), 5 * MIN - 20 * SEC, 'teruggezette wandklok na reboot: monotoon sinds opstarten telt toch');
  // De remaining verdwijnt niet na een reboot.
  assert.ok(resterendeBlokkade(b5, klok(1_000, 2_000_000_001_000, 8)) > 0);

  // Herankeren na reboot schrijft een stand terug waarop de monotone klok weer leidt.
  const her = herankerStand(b5, na1);
  assert.notEqual(her, b5, 'na reboot is er een nieuwe stand om weg te schrijven');
  assert.equal(her.fouten, b5.fouten);
  assert.equal(her.blokkade?.bootTeller, 8);
  assert.equal(her.blokkade?.duurMs, 5 * MIN);
  assert.equal(her.blokkade?.resterendBijAnker, 5 * MIN - 20 * SEC);
  assert.equal(her.blokkade?.wandAnker, 2_000_000_060_000);
  assert.equal(resterendeBlokkade(her, klok(50_000, 2_000_000_090_000, 8)), 5 * MIN - 50 * SEC, 'daarna weer monotoon');
  assert.equal(herankerStand(her, klok(50_000, 0, 8)), her, 'tweede keer is niets meer te doen');
  assert.equal(b5.blokkade?.bootTeller, 7, 'oorspronkelijke stand niet gemuteerd');

  // Onbekende teller (-1) in de blokkade of de klok: terugval op het anker.
  const bOnbekend = registreerFout({ v: 1, fouten: 4, blokkade: null }, klok(100_000, 10_000_000, -1));
  assert.equal(bOnbekend.blokkade?.bootTeller, -1);
  assert.equal(resterendeBlokkade(bOnbekend, klok(110_000, 10_010_000, -1)), 20 * SEC, 'teller -1: via anker');
  assert.equal(resterendeBlokkade(bOnbekend, klok(110_000, 10_010_000, 7)), 20 * SEC, 'klok heeft teller maar blokkade niet: via anker');
  // Klok meldt -1 terwijl de blokkade een teller heeft.
  assert.equal(resterendeBlokkade(b30, klok(110_000, 1_700_000_010_000, -1)), 20 * SEC, 'klok -1: via anker, conservatief');

  // ---------- Geen monotone klok (bron 'wand', bijvoorbeeld in Node) ----------
  const bw = registreerFout({ v: 1, fouten: 4, blokkade: null }, wandKlok(50_000_000));
  assert.equal(resterendeBlokkade(bw, wandKlok(50_000_000)), 30 * SEC);
  assert.equal(resterendeBlokkade(bw, wandKlok(50_010_000)), 20 * SEC);
  assert.equal(resterendeBlokkade(bw, wandKlok(50_030_000)), 0);
  assert.equal(resterendeBlokkade(bw, wandKlok(99_000_000)), 0);
  // Klok teruggezet: niet korter, ook niet oneindig.
  assert.equal(resterendeBlokkade(bw, wandKlok(40_000_000)), 30 * SEC, 'teruggezet: volle rest, nooit langer dan de duur');
  const heranker = herankerStand(bw, wandKlok(40_000_000));
  assert.equal(heranker.blokkade?.wandAnker, 40_000_000, 'anker naar de nieuwe wandtijd');
  assert.equal(heranker.blokkade?.resterendBijAnker, 30 * SEC, 'rest ongewijzigd');
  assert.equal(resterendeBlokkade(heranker, wandKlok(40_010_000)), 20 * SEC, 'daarna loopt de tijd weer gewoon');
  // Bij teller -1 en -1 blijft het anker gelden: geen nieuw object per tick (anders schrijft de
  // provider elke tick naar de kluis), zolang de wandklok niet terugspringt.
  assert.equal(herankerStand(bw, wandKlok(50_010_000)), bw, 'wand-only: geen herankering nodig');
  assert.equal(herankerStand(bOnbekend, klok(110_000, 10_010_000, -1)), bOnbekend, 'teller -1/-1: zelfde object');
  assert.equal(herankerStand(bOnbekend, klok(120_000, 10_020_000, -1)), bOnbekend, 'teller -1/-1: nog steeds zelfde object');
  // Na een teruggezette klok is er eenmalig een nieuwe stand, daarna weer niet.
  const na1x = herankerStand(bOnbekend, klok(110_000, 1_000, -1));
  assert.notEqual(na1x, bOnbekend, 'teruggezette wandklok: eenmalig nieuw anker');
  assert.equal(na1x.blokkade?.resterendBijAnker, 20 * SEC, 'monotoon verschil (10 s) telt ook bij teruggezette wandklok');
  assert.equal(herankerStand(na1x, klok(115_000, 6_000, -1)), na1x, 'daarna weer stabiel');
  assert.equal(resterendeBlokkade(na1x, klok(115_000, 6_000, -1)), 15 * SEC);
  assert.equal(resterendeBlokkade(bOnbekend, klok(110_000, 1_000, -1)), 20 * SEC, 'teruggezette wand, monotoon 10 s: 20 s over');
  // Teller werd bekend: eenmalig herankeren naar de nieuwe teller.
  const bekend = herankerStand(bOnbekend, klok(110_000, 10_010_000, 7));
  assert.equal(bekend.blokkade?.bootTeller, 7);
  assert.equal(herankerStand(bekend, klok(112_000, 10_012_000, 7)), bekend);

  // ---------- Vooruitgezette wandklok met onbekende teller levert geen winst op ----------
  assert.equal(resterendeBlokkade(bOnbekend, klok(110_000, 10_000_000 + 3_600_000, -1)), 20 * SEC, 'teller -1, wand een uur vooruit: monotoon beslist');
  assert.equal(resterendeBlokkade(bOnbekend, klok(110_000, 10_000_000 + 3_600_000, 7)), 20 * SEC, 'idem, klok kent de teller wel');
  assert.equal(resterendeBlokkade(b30, klok(110_000, 1_700_000_000_000 + 3_600_000, -1)), 20 * SEC, 'idem, blokkade kent de teller wel');
  // Zeker herstart (7 -> 8) met een monotone klok die toevallig voorbij het oude anker is:
  // alleen de tijd sinds opstarten telt, niet het verschil met het anker van de vorige boot.
  const bHerstart = registreerFout({ v: 1, fouten: 5, blokkade: null }, klok(1_000, W0, 7));
  assert.equal(bHerstart.blokkade?.duurMs, 60 * SEC);
  assert.equal(resterendeBlokkade(bHerstart, klok(50_000, W0 + 3_600_000, 8)), 10 * SEC, 'reboot 7->8: alleen 50 s sinds boot telt');

  // ---------- Niet-eindige waarden: fail-closed ----------
  assert.equal(resterendeBlokkade(b30, klok(NaN, 1, 7)), 30 * SEC, 'NaN monotoon');
  assert.equal(resterendeBlokkade(b30, klok(110_000, Infinity, 7)), 30 * SEC, 'Infinity wand');
  assert.equal(resterendeBlokkade(b30, { monotoon: 1, bootTeller: NaN, wand: 1, bron: 'monotoon' }), 30 * SEC, 'NaN teller');
  const kapot = (veld: keyof Blokkade, waarde: number): PogingenStand =>
    ({ ...b30, blokkade: { ...b30.blokkade!, [veld]: waarde } });
  for (const veld of ['totMonotoon', 'bootTeller', 'wandAnker', 'resterendBijAnker'] as const) {
    assert.equal(resterendeBlokkade(kapot(veld, NaN), klok(110_000, 1_700_000_010_000)), 30 * SEC, 'NaN in ' + veld);
  }
  // Niet-eindige klok: niets te herankeren, volle duur.
  const kapotStand = kapot('totMonotoon', NaN);
  assert.equal(herankerStand(kapotStand, klok(NaN, 1)), kapotStand, 'geen herankering bij een kapotte klok');
  // Kapotte blokkade met een eindige klok: verse blokkade vanaf nu, nooit permanent.
  for (const veld of ['totMonotoon', 'bootTeller', 'wandAnker', 'resterendBijAnker'] as const) {
    const nu = klok(500_000, W0 + 500_000);
    const vers = herankerStand(kapot(veld, NaN), nu);
    assert.notEqual(vers, kapot(veld, NaN));
    assert.equal(vers.blokkade?.duurMs, 30 * SEC, 'verse blokkade: trede bij 5 fouten, ' + veld);
    assert.equal(vers.blokkade?.resterendBijAnker, 30 * SEC);
    assert.equal(resterendeBlokkade(vers, nu), 30 * SEC);
    assert.equal(resterendeBlokkade(vers, klok(500_000 + 30 * SEC, W0 + 530_000)), 0, 'loopt gewoon af: ' + veld);
    assert.equal(herankerStand(vers, klok(510_000, W0 + 510_000)), vers, 'daarna stabiel');
  }
  // Ontbrekende blokkade (null) terwijl er 5+ fouten zijn: ook een verse blokkade, trede volgt uit fouten.
  const weg: PogingenStand = { v: 1, fouten: 7, blokkade: null };
  assert.equal(resterendeBlokkade(weg, klok(0, 0)), 5 * MIN);
  const wegVers = herankerStand(weg, klok(1_000, W0));
  assert.equal(wegVers.blokkade?.duurMs, 5 * MIN);
  assert.equal(wegVers.fouten, 7);
  assert.equal(resterendeBlokkade(wegVers, klok(1_000 + 5 * MIN, W0 + 5 * MIN)), 0);
  assert.equal(herankerStand(weg, klok(NaN, 0)), weg, 'kapotte klok: niets schrijven');
  // Een opgeblazen duurMs (kapotte of gemanipuleerde opslag) geeft nooit meer dan de langste trede.
  const TIEN_UUR = 10 * 60 * MIN;
  const opgeblazen: PogingenStand = {
    v: 1,
    fouten: 9,
    blokkade: { totMonotoon: 100_000 + TIEN_UUR, bootTeller: 7, wandAnker: W0, resterendBijAnker: TIEN_UUR, duurMs: TIEN_UUR },
  };
  assert.equal(resterendeBlokkade(opgeblazen, klok(100_000, W0)), 15 * MIN, 'duurMs begrensd op de langste trede');
  assert.equal(resterendeBlokkade({ ...opgeblazen, blokkade: { ...opgeblazen.blokkade!, totMonotoon: NaN } }, klok(100_000, W0)), 15 * MIN, 'ook bij een kapotte blokkade');
  // Onder de 5 fouten is geen blokkade normaal.
  const normaal: PogingenStand = { v: 1, fouten: 3, blokkade: null };
  assert.equal(resterendeBlokkade(normaal, klok(0, 0)), 0);
  assert.equal(herankerStand(normaal, klok(0, 0)), normaal);
  assert.equal(resterendeBlokkade(kapot('duurMs', NaN), klok(1, 1)), 30 * SEC, 'kapotte duur: trede bij het aantal fouten (30 s), niet NaN');
  assert.equal(resterendeBlokkade(b30, klok(110_000, Infinity, 7)) <= 30 * SEC, true);
  // Stand met kapot aantal fouten: de eerstvolgende fout blokkeert.
  const nanFouten = registreerFout({ v: 1, fouten: NaN, blokkade: null }, klok(0, 0));
  assert.equal(nanFouten.fouten, FOUTEN_VOOR_BLOKKADE);
  assert.ok(nanFouten.blokkade);
  assert.equal(pogingenTotBlokkade({ v: 1, fouten: NaN, blokkade: null }), 0);

  // Verlopen blokkade wordt niet geherankerd.
  assert.equal(herankerStand(bw, wandKlok(60_000_000)), bw);
  // Een blokkade met bron monotoon maar klok zonder monotone bron valt ook terug op het anker.
  assert.equal(resterendeBlokkade(b30, wandKlok(1_700_000_010_000)), 20 * SEC);

  // ---------- Succes zet alles terug ----------
  const na = registreerFout(b5, klok(2_000_000, 3_000_000_000_000, 7));
  assert.ok(na.fouten > 5);
  const reset = registreerSucces();
  assert.equal(reset.fouten, 0);
  assert.equal(reset.blokkade, null);
  assert.equal(resterendeBlokkade(reset, klok(2_000_000, 0, 7)), 0);
  // Na succes begint de trap weer bij 30 s op de 5e fout.
  let nieuw: PogingenStand = reset;
  for (let i = 0; i < 5; i++) nieuw = registreerFout(nieuw, klok(10, 10, 7));
  assert.equal(nieuw.blokkade?.duurMs, 30 * SEC);

  // ---------- Pogingen tot blokkade ----------
  assert.equal(pogingenTotBlokkade({ v: 1, fouten: 0, blokkade: null }), 5);
  assert.equal(pogingenTotBlokkade({ v: 1, fouten: 3, blokkade: null }), 2);
  assert.equal(pogingenTotBlokkade({ v: 1, fouten: 4, blokkade: null }), 1);
  assert.equal(pogingenTotBlokkade({ v: 1, fouten: 5, blokkade: null }), 0);
  assert.equal(pogingenTotBlokkade({ v: 1, fouten: 12, blokkade: null }), 0);

  console.log('slotPogingen.ts self-check geslaagd');
}
