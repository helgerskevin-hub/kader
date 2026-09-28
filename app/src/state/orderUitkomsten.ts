// Orders die Kader daadwerkelijk bij eToro heeft ingediend (soort 'ok' terug van plaatsKooporder of
// sluitPositie). Anders dan lopendeOrders.ts, waar we niet weten of de order is aangekomen, weten we
// dat hier wel: de vraag is alleen nog of eToro hem heeft gevuld, of dat hij is blijven wachten,
// geannuleerd of geweigerd. Dat laatste wil de gebruiker weten zonder zelf bij eToro te kijken.
//
// Dit bestand is bewust puur (geen netwerk, geen AsyncStorage), net als lopendeOrders.ts, zodat de
// opvraag- en opruimregels los te draaien zijn met de self-check onderaan.
import { EtoroOmgeving, isDefinitieveStatus, statusInGewoneTaal } from '../engine/etoro';
import { fmtBedrag } from '../engine/format';
import { Richting } from './portfolioTypes';

export interface GeplaatsteOrder {
  // Dezelfde id als de x-request-id waarmee de order de deur uitging. Dient als sleutel in de lijst,
  // niet voor de opzoeking bij eToro: de lookup op referenceId gaf 404 (gemeten, zie moetOpvragen).
  verzoekId: string;
  orderId?: number;
  soort: 'koop' | 'verkoop';
  symbool: string;
  omgeving: EtoroOmgeving;
  bedragUsd?: number;
  // Alleen bij koop: bepaalt of de omschrijving "koop" of "short" zegt.
  richting?: Richting;
  // epoch ms, het moment waarop de order de deur uitging.
  tijd: number;
  status?: { id: number; naam: string; reden: string | null };
  // epoch ms van de laatste keer dat Kader de status heeft opgevraagd.
  laatstGevraagd?: number;
}

// Na 24 uur zonder uitsluitsel stopt Kader met opvragen. Een order die zo lang wacht is geen bug in
// de sync, dat is gewoon een limietorder of een marktorder buiten handelstijd die nog niet geraakt
// is; verder blijven vragen levert dan niets op behalve verbruikt quotum.
export const OPVRAAG_VENSTER_MS = 24 * 60 * 60 * 1000;

// Een week bewaren, gerekend vanaf het plaatsen van de order (o.tijd, zie ruimOp), zodat een
// definitieve uitkomst niet al verdwenen is als de gebruiker de app een paar dagen niet opent en de
// melding dus nooit heeft gezien.
export const BEWAAR_MS = 7 * 24 * 60 * 60 * 1000;

// Het orderstatus-endpoint heeft geen eigen gemeten quotum, maar de sync doet toch al genoeg
// verzoeken per ronde; vijf per sync werkt een normale hoeveelheid wachtende orders binnen een paar
// rondes weg zonder de rest van de sync merkbaar te vertragen.
export const MAX_PER_SYNC = 5;

// Zonder orderId valt er niets op te vragen. Gemeten (28 sep 2026, demo): de lookup op referenceId
// (onze x-request-id) gaf 404, ook voor een order die eToro net met die referenceId had bevestigd.
// Alleen de lookup op orderId werkt, dus een order zonder orderId zou elke sync quotum kosten.
export function moetOpvragen(order: GeplaatsteOrder, nu: number): boolean {
  if (typeof order.orderId !== 'number') return false;
  if (order.status !== undefined && isDefinitieveStatus(order.status.id)) return false;
  return nu - order.tijd < OPVRAAG_VENSTER_MS;
}

// Oudste laatstGevraagd eerst (nooit opgevraagd = 0, dus die gaan voorop), zodat elke wachtende
// order op den duur aan de beurt komt in plaats van dat de eerste vijf van de lijst het quotum
// opmaken en de rest nooit bereikt wordt.
export function kiesOmOpTeVragen(orders: GeplaatsteOrder[], nu: number): GeplaatsteOrder[] {
  return orders
    .filter(o => moetOpvragen(o, nu))
    .sort((a, b) => (a.laatstGevraagd ?? 0) - (b.laatstGevraagd ?? 0))
    .slice(0, MAX_PER_SYNC);
}

// Gevuld (3) is het normale pad en geen nieuws: de order deed waarvoor hij bedoeld was. Alles wat
// in plaats daarvan definitief wordt (geweigerd, geannuleerd, verlopen, gedeeltelijk) is wél iets
// dat de gebruiker niet had verwacht toen hij de order plaatste.
export function isMeldenswaard(order: GeplaatsteOrder): boolean {
  const status = order.status;
  return status !== undefined && isDefinitieveStatus(status.id) && status.id !== 3;
}

export function ruimOp(orders: GeplaatsteOrder[], nu: number): GeplaatsteOrder[] {
  return orders.filter(o => {
    if (o.status?.id === 3) return false;
    if (nu - o.tijd >= BEWAAR_MS) return false;
    return true;
  });
}

// Orders staan altijd in dollars bij eToro, net als op de orderschermen zelf.
const DOLLARS = { valuta: 'USD' } as const;

export function omschrijfUitkomst(order: GeplaatsteOrder): string {
  // Datum erbij, niet alleen de tijd: de melding blijft tot BEWAAR_MS staan, en "van 14:05" zegt
  // na een paar dagen niets meer.
  const moment = new Date(order.tijd);
  const tijd = `${moment.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} om ${moment.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
  const bedrag = order.bedragUsd ? ` van ${fmtBedrag(order.bedragUsd, DOLLARS)}` : '';
  const onderwerp = order.soort === 'verkoop'
    ? `Je verkoop van ${order.symbool}`
    : order.richting === 'short'
      ? `Je short${bedrag} in ${order.symbool}`
      : `Je koop${bedrag} in ${order.symbool}`;

  if (!order.status) return `${onderwerp}, geplaatst op ${tijd}, is nog niet bevestigd door eToro.`;

  // Geen "door eToro" ervoor: een geannuleerde order kan de gebruiker net zo goed zelf geannuleerd
  // hebben. Alleen bij een weigering noemt statusInGewoneTaal eToro, want die komt altijd van eToro.
  const reden = order.status.reden ? ` eToro zegt: ${order.status.reden}` : '';
  return `${onderwerp}, geplaatst op ${tijd}, is ${statusInGewoneTaal(order.status.id)}.${reden}`;
}

// Wat de gebruiker nu met de uitkomst moet. Hangt af van de soort en de status: bij een gedeeltelijk
// uitgevoerde order (9, 10) staat er wel degelijk een positie, en bij een verkoop die niet doorging
// staat de positie juist nog open. Eén vaste zin onder alle meldingen klopte daardoor vaak niet.
export function adviesBijUitkomst(order: GeplaatsteOrder): string {
  const gedeeltelijk = order.status?.id === 9 || order.status?.id === 10;
  if (order.soort === 'verkoop') {
    return gedeeltelijk
      ? 'Een deel van je positie is wel verkocht. Verkoop het restant opnieuw als je hem helemaal wilt sluiten.'
      : 'Je positie staat nog open. Verkoop opnieuw als je hem wilt sluiten.';
  }
  return gedeeltelijk
    ? 'Een deel van je order is wel uitgevoerd; die positie staat in je portfolio. Koop niet het hele bedrag opnieuw.'
    : 'Er is geen positie geopend. Wil je alsnog kopen, plaats dan een nieuwe order.';
}

export interface AnnuleerMelding {
  variant: 'gelukt' | 'waarschuwing' | 'informatie';
  titel: string;
  tekst: string;
  // Alleen bij een echte annulering: succeshaptiek op een order die toch gevuld is, zegt het
  // tegenovergestelde van wat er gebeurd is.
  succes: boolean;
}

// Wat de gebruiker te zien krijgt nadat eToro een annuleerverzoek met 200 heeft aangenomen. Die 200
// zegt niets over de uitkomst (gemeten: ook een al gevulde order gaf 200 en bleef Filled), dus de
// melding hangt aan de status die Kader daarna opvraagt. null = opvragen lukte niet of eToro kende
// de order niet; dan niets beweren.
export function meldingNaAnnuleren(statusId: number | null): AnnuleerMelding {
  switch (statusId) {
    case 7:
      return { variant: 'gelukt', titel: 'Order geannuleerd', tekst: 'eToro heeft de order geannuleerd.', succes: true };
    case 9:
    case 10:
      // 10 (RejectedPartiallyFilled) is voor de gebruiker hetzelfde als 9: er staat een deelpositie.
      return {
        variant: 'waarschuwing',
        titel: 'Gedeeltelijk uitgevoerd',
        tekst: 'Gedeeltelijk uitgevoerd: een deel staat als positie in je portfolio, de rest is geannuleerd.',
        succes: false,
      };
    case 3:
      return {
        variant: 'waarschuwing',
        titel: 'Te laat',
        tekst: 'Te laat: eToro had de order al uitgevoerd. De positie staat in je portfolio.',
        succes: false,
      };
    case 1:
    case 2:
    case 5:
    case 11:
    case 12:
      // De order wacht gewoon door: de annulering heeft (nog) niet gewerkt. Niet doen alsof.
      return {
        variant: 'waarschuwing',
        titel: 'Order wacht nog',
        tekst: 'eToro nam het verzoek aan, maar de order staat nog open. Kijk zo nog eens, en annuleer opnieuw als hij blijft staan.',
        succes: false,
      };
    default:
      // 6 (wordt geannuleerd), elke andere status, of geen status: het verzoek is binnen, meer niet.
      return {
        variant: 'informatie',
        titel: 'Annulering doorgegeven',
        tekst: 'eToro heeft het verzoek ontvangen. Kijk of de order uit Wachtende orders verdwijnt zonder dat er een nieuwe positie bij komt.',
        succes: false,
      };
  }
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/state/orderUitkomsten.ts`
if (require.main === module) {
  // console.assert gooit niet in Node en zet de exitcode niet; zonder deze wrapper zou dit bestand
  // "geslaagd" printen terwijl de regels hierboven stuk zijn.
  let missers = 0;
  const origineleAssert = console.assert.bind(console);
  console.assert = ((voorwaarde?: boolean, ...rest: unknown[]) => {
    if (!voorwaarde) missers++;
    origineleAssert(voorwaarde, ...rest);
  }) as typeof console.assert;

  const nu = 1_800_000_000_000;
  const basis: GeplaatsteOrder = {
    verzoekId: 'a', orderId: 384361926, soort: 'koop', symbool: 'SOL', omgeving: 'demo', bedragUsd: 50, tijd: nu - 1000,
  };

  // Zonder orderId valt er niets op te vragen: de lookup op referenceId gaf 404 (gemeten).
  console.assert(!moetOpvragen({ ...basis, orderId: undefined }, nu), 'een order zonder orderId wordt niet opgevraagd');

  const gevuld: GeplaatsteOrder = { ...basis, status: { id: 3, naam: 'Filled', reden: null } };
  console.assert(!isMeldenswaard(gevuld), 'een gevulde order is geen nieuws');
  console.assert(ruimOp([gevuld], nu).length === 0, 'een gevulde order wordt meteen opgeruimd');

  const geannuleerd: GeplaatsteOrder = { ...basis, status: { id: 7, naam: 'Canceled', reden: 'Insufficient funds' } };
  console.assert(isMeldenswaard(geannuleerd), 'een geannuleerde order (7) is wel meldenswaard');
  console.assert(ruimOp([geannuleerd], nu).length === 1, 'een geannuleerde order blijft staan tot BEWAAR_MS');

  for (const id of [4, 8, 9, 10]) {
    console.assert(isMeldenswaard({ ...basis, status: { id, naam: '', reden: null } }), `status ${id} is meldenswaard`);
  }

  const wachtOpMarkt: GeplaatsteOrder = { ...basis, status: { id: 11, naam: 'PendingMarketOpen', reden: null } };
  console.assert(moetOpvragen(wachtOpMarkt, nu), 'status 11 is niet definitief, dus blijft opvragen');

  const teOud: GeplaatsteOrder = { ...basis, tijd: nu - OPVRAAG_VENSTER_MS - 1 };
  console.assert(!moetOpvragen(teOud, nu), 'ouder dan 24 uur wordt niet meer opgevraagd');

  const nogNet: GeplaatsteOrder = { ...basis, tijd: nu - OPVRAAG_VENSTER_MS + 1 };
  console.assert(moetOpvragen(nogNet, nu), 'net binnen de 24 uur wordt nog opgevraagd');

  const langGeleden: GeplaatsteOrder = { ...geannuleerd, tijd: nu - BEWAAR_MS - 1 };
  console.assert(ruimOp([langGeleden], nu).length === 0, 'ouder dan 7 dagen verdwijnt ook een definitieve order');

  const nogNietBewaartermijn: GeplaatsteOrder = { ...geannuleerd, tijd: nu - BEWAAR_MS + 1 };
  console.assert(ruimOp([nogNietBewaartermijn], nu).length === 1, 'net binnen de bewaartermijn blijft staan');

  // Max 5 per sync, en de langst niet-opgevraagde order gaat voorop.
  const veel: GeplaatsteOrder[] = Array.from({ length: 8 }, (_, i) => ({
    ...basis, verzoekId: `v${i}`, laatstGevraagd: nu - i * 1000,
  }));
  const gekozen = kiesOmOpTeVragen(veel, nu);
  console.assert(gekozen.length === MAX_PER_SYNC, 'nooit meer dan MAX_PER_SYNC per sync');
  console.assert(gekozen[0].verzoekId === 'v7', 'de langst niet-opgevraagde order gaat het eerst');

  console.assert(omschrijfUitkomst(geannuleerd).includes('SOL'), 'de omschrijving noemt de coin');
  console.assert(omschrijfUitkomst(geannuleerd).includes('Insufficient funds'), 'de omschrijving noemt de reden');
  const moment = new Date(geannuleerd.tijd);
  const verwachtMoment = `${moment.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} om `
    + moment.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  console.assert(omschrijfUitkomst(geannuleerd) === `Je koop van $50.00 in SOL, geplaatst op ${verwachtMoment}, is geannuleerd. eToro zegt: Insufficient funds`,
    `de omschrijving volgt exact het afgesproken format, was: ${omschrijfUitkomst(geannuleerd)}`);
  console.assert(!omschrijfUitkomst(geannuleerd).includes('door eToro'),
    'een geannuleerde order kan de gebruiker zelf geannuleerd hebben, dus niet "door eToro"');
  console.assert(omschrijfUitkomst({ ...basis, status: { id: 4, naam: 'Rejected', reden: null } }).includes('geweigerd door eToro'),
    'een weigering noemt eToro wel');

  // Het advies onder de melding hangt af van soort en status.
  console.assert(adviesBijUitkomst(geannuleerd).startsWith('Er is geen positie geopend'), 'koop niet uitgevoerd: geen positie');
  for (const id of [9, 10]) {
    console.assert(adviesBijUitkomst({ ...basis, status: { id, naam: '', reden: null } }).startsWith('Een deel van je order is wel uitgevoerd'),
      `koop met status ${id}: er staat wel een positie`);
  }
  const verkoopGeweigerd: GeplaatsteOrder = { ...basis, soort: 'verkoop', status: { id: 4, naam: 'Rejected', reden: null } };
  console.assert(adviesBijUitkomst(verkoopGeweigerd).startsWith('Je positie staat nog open'), 'verkoop niet uitgevoerd: positie staat nog open');
  console.assert(!adviesBijUitkomst(verkoopGeweigerd).includes('kopen'), 'een verkoop krijgt nooit het koopadvies');
  console.assert(adviesBijUitkomst({ ...verkoopGeweigerd, status: { id: 9, naam: '', reden: null } }).startsWith('Een deel van je positie is wel verkocht'),
    'verkoop gedeeltelijk uitgevoerd: een deel is wel verkocht');

  // ruimOp rekent vanaf o.tijd, ook voor een order die nooit is opgevraagd (geen orderId).
  console.assert(ruimOp([{ ...basis, orderId: undefined, tijd: nu - BEWAAR_MS - 1 }], nu).length === 0,
    'een oude order zonder orderId wordt ook opgeruimd');

  // Na een aangenomen annulering: alleen status 7 is een succes.
  const geannuleerdNa = meldingNaAnnuleren(7);
  console.assert(geannuleerdNa.variant === 'gelukt' && geannuleerdNa.succes, 'status 7 is een geslaagde annulering');
  console.assert(meldingNaAnnuleren(9).variant === 'waarschuwing' && meldingNaAnnuleren(9).tekst.includes('positie in je portfolio'),
    'status 9: een deel staat als positie');
  console.assert(meldingNaAnnuleren(3).variant === 'waarschuwing' && meldingNaAnnuleren(3).tekst.startsWith('Te laat'),
    'status 3: de order was al uitgevoerd');
  console.assert(meldingNaAnnuleren(10).tekst === meldingNaAnnuleren(9).tekst, 'status 10 is voor de gebruiker hetzelfde als 9: er staat een deelpositie');
  for (const id of [6, 4, 8, null]) {
    const m = meldingNaAnnuleren(id);
    console.assert(m.variant === 'informatie' && !m.succes, `status ${id}: neutraal, niets beweren`);
  }
  // De order wacht gewoon door: dan zeggen dat hij nog open staat, niet dat het verzoek "binnen" is.
  for (const id of [1, 2, 5, 11, 12]) {
    const m = meldingNaAnnuleren(id);
    console.assert(m.titel === 'Order wacht nog' && !m.succes, `status ${id}: de order wacht nog`);
  }
  for (const id of [3, 9, 10, 6, 11, null]) {
    console.assert(!meldingNaAnnuleren(id).succes, `status ${id}: geen succeshaptiek`);
  }

  if (missers > 0) {
    console.error(`orderUitkomsten.ts self-check GEFAALD: ${missers} controle(s) klopten niet`);
    process.exit(1);
  }
  console.log('orderUitkomsten.ts self-check geslaagd');
}
