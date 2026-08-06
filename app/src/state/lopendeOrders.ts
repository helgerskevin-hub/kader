// Orders waarvan Kader niet weet of ze zijn doorgegaan.
//
// Het afbreken van een verzoek annuleert niets aan eToro's kant. Een timeout, een weggevallen
// verbinding of een 5xx betekent dus niet "mislukt", het betekent "onbekend". De enige veilige
// reactie is verzoenen: kijken of de positie verschijnt. Nooit opnieuw versturen, want dan koop je
// mogelijk twee keer.
//
// Dit bestand is bewust puur (geen netwerk, geen AsyncStorage), zodat de opruimregels los te
// draaien zijn met de self-check onderaan.
import { PortfolioTrade } from './portfolioTypes';
import { EtoroOmgeving } from '../engine/etoro';

export interface OnbekendeOrder {
  // Dezelfde id als de x-request-id waarmee de order de deur uitging.
  verzoekId: string;
  soort: 'koop' | 'verkoop' | 'niveaus';
  symbool: string;
  omgeving: EtoroOmgeving;
  bedragUsd?: number;
  // Bij verkoop en niveaus: welke positie het betrof.
  positionId?: number;
  // De eToro-positie-ID's die al open stonden toen dit verzoek uitging. Zonder deze lijst zou een
  // positie die je al had een onbevestigde koop in dezelfde coin "oplossen", en dan verdwijnt de
  // waarschuwing terwijl er mogelijk een tweede positie is bijgekomen.
  bekendePosities: number[];
  // epoch ms, het moment waarop het verzoek uitging.
  tijd: number;
}

// Na een kwartier zonder uitsluitsel houdt automatisch verzoenen op en vraagt de app de gebruiker
// om zelf te kijken. Langer wachten helpt niet: als de order gevuld was, stond hij er allang.
export const VERLOOPT_NA_MS = 15 * 60 * 1000;

// Is deze order opgelost door wat er nu in het portfolio staat?
function isOpgelost(order: OnbekendeOrder, trades: PortfolioTrade[]): boolean {
  if (order.soort === 'koop') {
    // Een koop is opgelost zodra er een open eToro-positie in dezelfde coin en omgeving staat die
    // er vóór het versturen nog niet was. Op positionId matchen kan niet: het orderantwoord geeft
    // een orderId, en de positie krijgt pas een positionId als de marktorder gevuld is. Vandaar de
    // vergelijking met bekendePosities in plaats van een directe match.
    return trades.some(t =>
      t.bron === 'etoro'
      && t.status === 'open'
      && t.symbool === order.symbool
      && (t.etoroOmgeving ?? 'real') === order.omgeving
      && t.etoroPositionID !== undefined
      // ?? [] omdat deze vorm via SLEUTELS.onbekendeOrders op schijf staat: een record dat vóór een
      // latere vormwijziging is weggeschreven mag geen TypeError geven midden in de verzoening.
      && !(order.bekendePosities ?? []).includes(t.etoroPositionID),
    );
  }

  // Verkoop: alleen oplossen op positief bewijs, namelijk dat diezelfde positie er nu als gesloten
  // staat. Bewust niet "de positie staat niet meer open", want dan lost een lijst die nog niet
  // geladen is of een sync die net faalde de order op zonder dat er iets bewezen is. Verdwijnt de
  // rij helemaal, dan verloopt de order na een kwartier en ziet de gebruiker de banner. Dat is de
  // goede kant om op te falen.
  if (order.soort === 'verkoop') {
    return trades.some(t => t.etoroPositionID === order.positionId && t.status !== 'open');
  }

  // Niveauwijziging: hier valt niets betrouwbaars aan af te lezen zonder de nieuwe waarden te
  // kennen, dus die laten we simpelweg verlopen. Geen order, geen dubbele aankoop, geen risico.
  return false;
}

export interface OpruimResultaat {
  // Nog onopgelost en nog binnen het kwartier: blijven proberen.
  open: OnbekendeOrder[];
  // Te lang onopgelost: de banner met "Opnieuw controleren" hoort hierbij.
  verlopen: OnbekendeOrder[];
}

// Opgeloste orders verdwijnen simpelweg uit beide lijsten.
export function ruimOnbekendeOrdersOp(
  orders: OnbekendeOrder[],
  trades: PortfolioTrade[],
  nu: number,
): OpruimResultaat {
  const open: OnbekendeOrder[] = [];
  const verlopen: OnbekendeOrder[] = [];

  for (const order of orders) {
    if (isOpgelost(order, trades)) continue;
    if (nu - order.tijd >= VERLOOPT_NA_MS) verlopen.push(order);
    else open.push(order);
  }

  return { open, verlopen };
}

// Nederlandse tekst voor de banner. Neutraal: we weten het niet, dus we beweren niets.
export function omschrijfOnbekendeOrder(order: OnbekendeOrder): string {
  const tijd = new Date(order.tijd).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  if (order.soort === 'koop') {
    const bedrag = order.bedragUsd ? ` voor $${order.bedragUsd}` : '';
    return `Je koop${bedrag} in ${order.symbool} van ${tijd} is niet bevestigd.`;
  }
  if (order.soort === 'verkoop') return `Je verkoop van ${order.symbool} van ${tijd} is niet bevestigd.`;
  return `De wijziging van je stop-loss of doel voor ${order.symbool} van ${tijd} is niet bevestigd.`;
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/state/lopendeOrders.ts`
if (require.main === module) {
  // console.assert gooit niet in Node en zet de exitcode niet; zonder deze wrapper zou dit bestand
  // "geslaagd" printen terwijl de verzoening stuk is.
  let missers = 0;
  const origineleAssert = console.assert.bind(console);
  console.assert = ((voorwaarde?: boolean, ...rest: unknown[]) => {
    if (!voorwaarde) missers++;
    origineleAssert(voorwaarde, ...rest);
  }) as typeof console.assert;

  const nu = 1_800_000_000_000;
  const koop: OnbekendeOrder = { verzoekId: 'a', soort: 'koop', symbool: 'BTC', omgeving: 'demo', bedragUsd: 50, bekendePosities: [], tijd: nu - 1000 };

  const positie = (over: Partial<PortfolioTrade> = {}): PortfolioTrade => ({
    id: 'x', symbool: 'BTC', naam: 'Bitcoin', entryPrijs: 100, stopLoss: 90, takeProfit: 130, rr: 3,
    datum: '1 jan 2026', status: 'open', etoroPositionID: 7, etoroOmgeving: 'demo', bron: 'etoro', ...over,
  });

  // Vasthouden zolang de positie er niet is.
  const zonder = ruimOnbekendeOrdersOp([koop], [], nu);
  console.assert(zonder.open.length === 1 && zonder.verlopen.length === 0, 'een verse onopgeloste koop blijft open staan');

  // Oplossen zodra hij verschijnt.
  const met = ruimOnbekendeOrdersOp([koop], [positie()], nu);
  console.assert(met.open.length === 0 && met.verlopen.length === 0, 'een koop verdwijnt zodra de positie er staat');

  // De omgeving moet kloppen: een echte positie lost een demo-order niet op, en andersom.
  const andereOmgeving = ruimOnbekendeOrdersOp([koop], [positie({ etoroOmgeving: 'real' })], nu);
  console.assert(andereOmgeving.open.length === 1, 'een positie in de andere omgeving lost de order niet op');

  // Een positie van vóór deze versie (geen etoroOmgeving) telt als 'real'.
  const oudeTrade = ruimOnbekendeOrdersOp([{ ...koop, omgeving: 'real' }], [positie({ etoroOmgeving: undefined })], nu);
  console.assert(oudeTrade.open.length === 0, 'een trade zonder omgevingsveld telt als real');

  // De coin moet kloppen.
  const andereCoin = ruimOnbekendeOrdersOp([koop], [positie({ symbool: 'ETH' })], nu);
  console.assert(andereCoin.open.length === 1, 'een positie in een andere coin lost de order niet op');

  // Een handmatige trade is geen bewijs dat de order bij eToro is aangekomen.
  const handmatig = ruimOnbekendeOrdersOp([koop], [positie({ bron: 'handmatig' })], nu);
  console.assert(handmatig.open.length === 1, 'een handmatige trade lost een eToro-order niet op');

  // Het belangrijkste geval: je had al een BTC-positie toen je opnieuw kocht. Die oude positie mag
  // de onbevestigde order NIET oplossen, anders verdwijnt de waarschuwing terwijl je er mogelijk
  // twee hebt.
  const alGehad: OnbekendeOrder = { ...koop, bekendePosities: [7] };
  const alleenOude = ruimOnbekendeOrdersOp([alGehad], [positie({ etoroPositionID: 7 })], nu);
  console.assert(alleenOude.open.length === 1, 'een positie die er al stond lost de order niet op');

  const ookNieuwe = ruimOnbekendeOrdersOp([alGehad], [positie({ etoroPositionID: 7 }), positie({ id: 'y', etoroPositionID: 8 })], nu);
  console.assert(ookNieuwe.open.length === 0, 'zodra er een positie bijkomt die er nog niet was, is de order opgelost');

  // Na een kwartier verlopen, en dan blijft hij zichtbaar in plaats van te verdwijnen.
  const oud = ruimOnbekendeOrdersOp([{ ...koop, tijd: nu - VERLOOPT_NA_MS - 1 }], [], nu);
  console.assert(oud.verlopen.length === 1 && oud.open.length === 0, 'na 15 minuten zonder resultaat verloopt de order');

  // Precies op de grens telt al als verlopen.
  const grens = ruimOnbekendeOrdersOp([{ ...koop, tijd: nu - VERLOOPT_NA_MS }], [], nu);
  console.assert(grens.verlopen.length === 1, 'precies op de grens is verlopen');

  // Ook een verlopen order verdwijnt zodra de positie alsnog opduikt.
  const laatAlsnog = ruimOnbekendeOrdersOp([{ ...koop, tijd: nu - VERLOOPT_NA_MS - 1 }], [positie()], nu);
  console.assert(laatAlsnog.open.length === 0 && laatAlsnog.verlopen.length === 0, 'een alsnog gevulde order verdwijnt, ook na het kwartier');

  // Verkoop: opgelost zodra de positie niet meer open staat.
  const verkoop: OnbekendeOrder = { verzoekId: 'b', soort: 'verkoop', symbool: 'BTC', omgeving: 'demo', positionId: 7, bekendePosities: [7], tijd: nu - 1000 };
  console.assert(ruimOnbekendeOrdersOp([verkoop], [positie()], nu).open.length === 1, 'zolang de positie open staat is de verkoop niet bevestigd');
  console.assert(ruimOnbekendeOrdersOp([verkoop], [positie({ status: 'gewonnen' })], nu).open.length === 0, 'een gesloten positie lost de verkoop op');

  // Het gevaarlijke geval: een lege lijst is geen bewijs. Als de trades nog niet geladen zijn of de
  // sync net faalde, mag de verkoop niet stilzwijgend als bevestigd gelden.
  console.assert(ruimOnbekendeOrdersOp([verkoop], [], nu).open.length === 1, 'een lege tradelijst bewijst niets en lost de verkoop niet op');
  console.assert(ruimOnbekendeOrdersOp([verkoop], [positie({ etoroPositionID: 99, status: 'gewonnen' })], nu).open.length === 1,
    'een andere gesloten positie lost deze verkoop niet op');

  // Niveauwijziging valt niet af te lezen en verloopt gewoon.
  const niveaus: OnbekendeOrder = { verzoekId: 'c', soort: 'niveaus', symbool: 'BTC', omgeving: 'demo', positionId: 7, bekendePosities: [7], tijd: nu - 1000 };
  console.assert(ruimOnbekendeOrdersOp([niveaus], [positie()], nu).open.length === 1, 'een niveauwijziging blijft open tot hij verloopt');

  console.assert(omschrijfOnbekendeOrder(koop).includes('BTC'), 'de omschrijving noemt de coin');
  console.assert(!omschrijfOnbekendeOrder(koop).includes('mislukt'), 'de omschrijving mag niet beweren dat het misging');

  if (missers > 0) {
    console.error(`lopendeOrders.ts self-check GEFAALD: ${missers} controle(s) klopten niet`);
    process.exit(1);
  }
  console.log('lopendeOrders.ts self-check geslaagd');
}
