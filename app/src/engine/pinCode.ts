// De pincode zelf, puur: keuren, hashen en controleren. Geen React, geen opslag en geen native
// imports. De sleutelafleiding (PBKDF2) wordt geïnjecteerd: in de app is dat
// KaderBeveiligingModule.pbkdf2Sha256Hex, in de self-check onderaan Node's crypto.pbkdf2Sync.
// Wat er in de kluis staat (PinRecord) en de constanten komen uit het contract.
import {
  Kdf,
  PBKDF2_ITERATIES,
  PIN_LENGTE,
  PIN_RECORD_VERSIE,
  PIN_SALT_BYTES,
  PinRecord,
} from '../state/vergrendelTypes';

// Precies PIN_LENGTE cijfers, niets anders (geen spaties, geen letters, ook geen Unicode-cijfers).
export function isGeldigePin(pin: string): boolean {
  return typeof pin === 'string' && pin.length === PIN_LENGTE && /^[0-9]+$/.test(pin);
}

// Zwak is: zes gelijke cijfers, of een strikte reeks met stappen van +1 (123456, 012345) of -1
// (654321, 987654). Een reeks die om de tien heen loopt (890123, 901234) telt NIET als zwak: dat is
// een eigen keuze, het plan noemt alleen "oplopende of aflopende reeksen", en een wrap is voor een
// gokker geen voor de hand liggende volgorde. Een ongeldige invoer is niet zwak maar ongeldig.
export function isZwakkePin(pin: string): boolean {
  if (!isGeldigePin(pin)) return false;
  const cijfers = Array.from(pin, Number);
  const stappen = cijfers.slice(1).map((c, i) => c - cijfers[i]);
  const alleStappen = (s: number) => stappen.every((x) => x === s);
  return alleStappen(0) || alleStappen(1) || alleStappen(-1);
}

const HEX_KLEIN = /^[0-9a-f]*$/;
const HASH_HEX = /^[0-9a-f]{64}$/;

// Grenzen voor wat we in een record of een nieuwe aanroep vertrouwen. Daarbuiten is het record
// beschadigd of geknoeid en draait de KDF (een native aanroep) niet eens.
const MIN_ITERATIES = 10_000;
const MAX_ITERATIES = 10_000_000;
const MIN_SALT_HEX = 32;

function geldigeIteraties(it: unknown): it is number {
  return typeof it === 'number' && Number.isInteger(it) && it >= MIN_ITERATIES && it <= MAX_ITERATIES;
}

function geldigeSalt(salt: unknown): salt is string {
  return typeof salt === 'string' && salt.length >= MIN_SALT_HEX && salt.length % 2 === 0 && HEX_KLEIN.test(salt);
}

// Maakt een nieuw record. De salt (PIN_SALT_BYTES willekeurige bytes als hex) levert de aanroeper
// (KaderBeveiligingModule.willekeurigeHex), zodat deze functie deterministisch en dus toetsbaar blijft.
export async function maakPinRecord(
  pin: string,
  saltHex: string,
  kdf: Kdf,
  iteraties: number = PBKDF2_ITERATIES,
): Promise<PinRecord> {
  if (!isGeldigePin(pin)) throw new Error('Pincode moet uit precies zes cijfers bestaan.');
  if (saltHex.length !== PIN_SALT_BYTES * 2 || !HEX_KLEIN.test(saltHex)) {
    throw new Error('Salt moet ' + PIN_SALT_BYTES * 2 + ' hex-tekens in kleine letters zijn.');
  }
  if (!geldigeIteraties(iteraties)) {
    throw new Error('Ongeldig aantal iteraties (' + MIN_ITERATIES + ' tot ' + MAX_ITERATIES + ').');
  }
  const hash = await kdf(pin, saltHex, iteraties);
  if (typeof hash !== 'string' || !HASH_HEX.test(hash)) {
    throw new Error('De sleutelafleiding gaf geen geldige hash (64 hex-tekens in kleine letters).');
  }
  return { v: PIN_RECORD_VERSIE, alg: 'pbkdf2-sha256', it: iteraties, salt: saltHex, hash };
}

// Vergelijking van twee strings in constante tijd (voor zover JS dat kan): geen vroegtijdige
// terugkeer, de lengteverschillen lopen in dezelfde som mee. Bedoeld voor hex-strings.
export function gelijkInConstanteTijd(a: string, b: string): boolean {
  let verschil = a.length ^ b.length;
  const lengte = Math.max(a.length, b.length);
  for (let i = 0; i < lengte; i++) {
    verschil |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return verschil === 0;
}

// Klopt de ingevoerde pincode met het record? Het record wordt gecontroleerd met zijn EIGEN
// parameters (iteraties, salt), ook als het van een oudere versie of met andere iteraties is: een
// versiebump of een andere iteratiewaarde mag nooit elke poging als fout laten tellen. Alleen een
// onbekend algoritme, een beschadigd record of een ongeldige invoer geeft false, zonder dat de KDF
// (een native aanroep) draait. Na true bepaalt moetHerhashen of het record vernieuwd moet worden.
export async function controleerPin(pin: string, record: PinRecord, kdf: Kdf): Promise<boolean> {
  if (!isGeldigePin(pin)) return false;
  if (!record || record.alg !== 'pbkdf2-sha256') return false;
  if (!geldigeIteraties(record.it) || !geldigeSalt(record.salt)) return false;
  if (typeof record.hash !== 'string' || !HASH_HEX.test(record.hash)) return false;
  const hash = await kdf(pin, record.salt, record.it);
  if (typeof hash !== 'string' || !HASH_HEX.test(hash)) return false;
  return gelijkInConstanteTijd(hash, record.hash);
}

// Moet het record na een geslaagde controle opnieuw gehasht worden? Ja bij minder iteraties dan de
// huidige waarde, of bij een ouder formaat of ander algoritme.
export function moetHerhashen(record: PinRecord, iteraties: number = PBKDF2_ITERATIES): boolean {
  return (
    record.it < iteraties || record.v !== PIN_RECORD_VERSIE || record.alg !== 'pbkdf2-sha256'
  );
}

// ponytail: self-check ipv testframework, run met `npx tsx src/engine/pinCode.ts` (vanuit app/)
if (require.main === module) {
  // Via een alias: Metro bundelt elke require('...') met een vaste string, ook in dit blok dat in
  // de app nooit draait, en kent node:assert en node:crypto niet (de app startte dan niet).
  const nodeRequire: typeof require = require;
  const assert: typeof import('node:assert/strict') = nodeRequire('node:assert/strict');
  const crypto = nodeRequire('node:crypto') as typeof import('node:crypto');

  const nodeKdf: Kdf = async (pin, saltHex, it) =>
    crypto.pbkdf2Sync(Buffer.from(pin, 'utf8'), Buffer.from(saltHex, 'hex'), it, 32, 'sha256').toString('hex');

  (async () => {
    // ---------- Geldigheid ----------
    assert.ok(isGeldigePin('483917'));
    assert.ok(isGeldigePin('000000'));
    assert.ok(!isGeldigePin('12345'), 'te kort');
    assert.ok(!isGeldigePin('1234567'), 'te lang');
    assert.ok(!isGeldigePin(''), 'leeg');
    assert.ok(!isGeldigePin('12345a'), 'letter');
    assert.ok(!isGeldigePin('12 456'), 'spatie');
    assert.ok(!isGeldigePin('１２３４５６'), 'Unicode-cijfers tellen niet');
    assert.ok(!isGeldigePin('12345\n'), 'regeleinde');

    // ---------- Zwakke codes ----------
    for (const z of ['000000', '111111', '999999', '123456', '234567', '012345', '345678', '456789',
      '654321', '987654', '876543', '543210']) {
      assert.ok(isZwakkePin(z), z + ' hoort zwak te zijn');
    }
    for (const s of ['890123', '901234', '321012', '121212', '112233', '123123', '123457', '483917',
      '135791', '100000', '123450']) {
      assert.ok(!isZwakkePin(s), s + ' hoort sterk genoeg te zijn');
    }
    assert.ok(!isZwakkePin('11111'), 'ongeldige invoer is niet zwak (maar ongeldig)');
    assert.ok(!isZwakkePin('abcdef'));

    // ---------- Bekende PBKDF2-HMAC-SHA256-testvector (via Node als KDF) ----------
    // P="password", S="salt", c=1, dkLen=32. Het salt wordt hier als bytes doorgegeven, dus als hex.
    const vector = crypto
      .pbkdf2Sync('password', 'salt', 1, 32, 'sha256')
      .toString('hex');
    assert.equal(vector, '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b');
    // En de hex-variant van dezelfde sleutelafleiding, zoals de app die aanroept:
    assert.equal(
      await nodeKdf('password', Buffer.from('salt').toString('hex'), 1),
      '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b',
      'vector, maar dan met de hex-salt van de KDF-interface',
    );
    // c=2 uit RFC 7914-achtige vectoren: ander aantal iteraties geeft een andere sleutel.
    assert.equal(
      crypto.pbkdf2Sync('password', 'salt', 2, 32, 'sha256').toString('hex'),
      'ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43',
    );

    // ---------- Record maken en controleren ----------
    const salt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const record = await maakPinRecord('483917', salt, nodeKdf, 10_000);
    assert.equal(record.v, PIN_RECORD_VERSIE);
    assert.equal(record.alg, 'pbkdf2-sha256');
    assert.equal(record.it, 10_000);
    assert.equal(record.salt, salt);
    assert.match(record.hash, /^[0-9a-f]{64}$/);
    assert.ok(await controleerPin('483917', record, nodeKdf), 'goede pincode');
    assert.ok(!(await controleerPin('483918', record, nodeKdf)), 'foute pincode');
    assert.ok(!(await controleerPin('48391', record, nodeKdf)), 'ongeldige invoer is fout');

    // De KDF mag bij een ongeldige invoer of onbekend formaat niet eens draaien.
    let aanroepen = 0;
    const telKdf: Kdf = async (p, s, i) => { aanroepen++; return nodeKdf(p, s, i); };
    assert.ok(!(await controleerPin('abc', record, telKdf)));
    assert.ok(!(await controleerPin('483917', { ...record, alg: 'sha1' as never }, telKdf)), 'ander algoritme');
    // Beschadigde of geknoeide records: nooit een native aanroep.
    for (const kapot of [
      { it: 9_999 }, { it: 10_000_001 }, { it: 10_000.5 }, { it: NaN }, { it: '10000' as never },
      { salt: 'ab' }, { salt: salt.slice(0, 30) }, { salt: salt.toUpperCase() }, { salt: salt + 'z' + 'z' },
      { salt: salt.slice(0, 31) }, { salt: undefined as never },
      { hash: 'ab' }, { hash: record.hash.toUpperCase() }, { hash: record.hash + '0' },
      { hash: undefined as never },
    ]) {
      assert.ok(!(await controleerPin('483917', { ...record, ...kapot }, telKdf)), 'kapot record ' + JSON.stringify(kapot));
    }
    assert.equal(aanroepen, 0, 'KDF draait niet bij ongeldige invoer of een beschadigd record');

    // Een record van een oudere versie of met andere iteraties wordt met zijn eigen parameters
    // gecontroleerd en moet dus slagen, waarna moetHerhashen om een vernieuwing vraagt.
    const oud = { ...record, v: 0 };
    assert.ok(await controleerPin('483917', oud, nodeKdf), 'oudere versie, goede pincode');
    assert.ok(!(await controleerPin('483918', oud, nodeKdf)), 'oudere versie, foute pincode');
    assert.ok(moetHerhashen(oud));
    const toekomst = { ...record, v: 2 };
    assert.ok(await controleerPin('483917', toekomst, nodeKdf), 'andere versie telt niet als fout');
    assert.ok(moetHerhashen(toekomst));
    const anderIt = await maakPinRecord('483917', salt, nodeKdf, 20_000);
    assert.equal(anderIt.it, 20_000);
    assert.ok(await controleerPin('483917', anderIt, nodeKdf), 'andere iteraties: eigen parameters');
    assert.ok(!(await controleerPin('483917', { ...anderIt, it: 10_000 }, nodeKdf)), 'het record zegt wat het zegt');

    // Een KDF die rommel teruggeeft: maken gooit, controleren geeft false.
    const slechteKdf: Kdf = async () => 'xyz';
    await assert.rejects(maakPinRecord('483917', salt, slechteKdf, 10_000), /geldige hash/);
    assert.ok(!(await controleerPin('483917', record, slechteKdf)));
    const korteKdf: Kdf = async () => record.hash.slice(0, 62);
    assert.ok(!(await controleerPin('483917', record, korteKdf)));
    const hoofdKdf: Kdf = async (p, s, i) => (await nodeKdf(p, s, i)).toUpperCase();
    await assert.rejects(maakPinRecord('483917', salt, hoofdKdf, 10_000), /geldige hash/);
    assert.ok(!(await controleerPin('483917', record, hoofdKdf)));

    // Een record met een andere salt geeft een andere hash (salt wordt echt gebruikt).
    const record2 = await maakPinRecord('483917', 'ffffffffffffffffffffffffffffffff', nodeKdf, 10_000);
    assert.notEqual(record2.hash, record.hash);

    // Ongeldige invoer bij het maken.
    await assert.rejects(maakPinRecord('12345', salt, nodeKdf), /zes cijfers/);
    await assert.rejects(maakPinRecord('483917', 'abcd', nodeKdf), /Salt/);
    await assert.rejects(maakPinRecord('483917', salt.toUpperCase(), nodeKdf), /Salt/);
    await assert.rejects(maakPinRecord('483917', salt, nodeKdf, 0), /iteraties/);
    await assert.rejects(maakPinRecord('483917', salt, nodeKdf, 9_999), /iteraties/);
    await assert.rejects(maakPinRecord('483917', salt, nodeKdf, 10_000_001), /iteraties/);

    // ---------- Constante tijd ----------
    assert.ok(gelijkInConstanteTijd('abc123', 'abc123'));
    assert.ok(gelijkInConstanteTijd('', ''));
    assert.ok(!gelijkInConstanteTijd('abc123', 'abc124'), 'laatste teken anders');
    assert.ok(!gelijkInConstanteTijd('bbc123', 'abc123'), 'eerste teken anders');
    assert.ok(!gelijkInConstanteTijd('abc123', 'abc12'), 'korter');
    assert.ok(!gelijkInConstanteTijd('abc12', 'abc123'), 'langer');
    assert.ok(!gelijkInConstanteTijd('abc', ''), 'leeg tegen gevuld');
    assert.ok(!gelijkInConstanteTijd('a\0', 'a'), 'een nulteken telt als verschil in lengte');
    // Er zit geen vroegtijdige terugkeer in: de lus loopt altijd over de volle lengte. Controle
    // door de broncode van de functie te lezen op een vroege return.
    const bron = gelijkInConstanteTijd.toString();
    assert.equal((bron.match(/return/g) ?? []).length, 1, 'precies een return, aan het eind');

    // ---------- Herhashen ----------
    assert.ok(!moetHerhashen({ ...record, it: PBKDF2_ITERATIES }), 'actueel record');
    assert.ok(!moetHerhashen({ ...record, it: PBKDF2_ITERATIES + 1 }), 'meer iteraties is prima');
    assert.ok(moetHerhashen({ ...record, it: PBKDF2_ITERATIES - 1 }), 'minder iteraties');
    assert.ok(moetHerhashen(record, 20_000), 'het testrecord met 10.000 iteraties is verouderd t.o.v. 20.000');
    assert.ok(!moetHerhashen(record, 10_000), 'maar niet t.o.v. 10.000');
    assert.ok(geldigeIteraties(PBKDF2_ITERATIES), 'PBKDF2_ITERATIES ligt binnen de grenzen van geldigeIteraties');
    assert.ok(moetHerhashen({ ...record, it: PBKDF2_ITERATIES, v: 0 }), 'ouder formaat');
    assert.ok(moetHerhashen({ ...record, it: PBKDF2_ITERATIES, alg: 'sha1' as never }), 'ander algoritme');

    console.log('pinCode.ts self-check geslaagd');
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
