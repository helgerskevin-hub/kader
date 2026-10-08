import { PortfolioTrade, Richting, nieuweId } from '../state/portfolioTypes';
import { ETORO_TRADABLE } from './opportunities';
import { COIN_INFO } from './coinInfo';
import { EtoroEligibility, StopLossLimiet, kiesLimiet } from './etoroLimieten';
import { naarEtoroSymbool, vanEtoroSymbool, koersFactor } from './etoroSymbolen';

const BASIS_URL = 'https://public-api.etoro.com/api';
// Lezen mag kort falen; een schrijfactie krijgt langer de tijd, want afbreken lost daar niets op
// (zie EtoroFout.afgebroken) en een order die net onderweg is wil je niet zelf onbeslist maken.
const LEES_TIMEOUT = 15_000;
const SCHRIJF_TIMEOUT = 30_000;

// eToro valideert X-Request-Id als een echt GUID; nieuweId() (base36) volstaat niet.
export function guid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type EtoroOmgeving = 'real' | 'demo';

export interface EtoroSleutels {
  apiKey: string;
  userKey: string;
  // Ontbreekt = 'real'. Gemeten: eToro geeft één sleutel uit die zowel demo als echt mag handelen,
  // dus dezelfde sleutel wordt op allebei de paden geaccepteerd. Deze waarde kiest via demoPad()
  // het PAD, en dat pad is het enige dat speelgeld van echt geld scheidt. Een verkeerde waarde hier
  // levert dus GEEN nette 401 op maar een echte order op je echte account.
  omgeving?: EtoroOmgeving;
}

interface EtoroPositie {
  positionID: number;
  instrumentID: number;
  isBuy: boolean;
  amount?: number;
  initialAmountInDollars?: number;
  units: number;
  openRate: number;
  openDateTime: string;
  stopLossRate?: number;
  takeProfitRate?: number;
  // De order waaruit deze positie ontstond. Niet gemeten; eToro schrijft orderID en orderId door
  // elkaar, dus beide. Ontbreekt hij, dan valt er niets te koppelen en blijft de order gewoon staan.
  orderID?: number;
  orderId?: number;
}

// Een kooporder die nog niet gevuld is: een limietorder, of een marktorder op een instrument
// waarvan de beurs dicht is (een aandeel buiten handelsuren). eToro houdt het bedrag daarvan vast,
// maar telt het WEL nog mee in `credit`. Gemeten door de gebruiker: met een wachtende kooporder op
// een aandeel stond het gereserveerde bedrag in Kader gewoon als beschikbaar geld, en een koop die
// je daarop baseerde werd door eToro geweigerd omdat het geld er niet meer was.
//
// De veldnamen staan hier ruim: niets hiervan is tegen een echte respons gemeten, en Kader mag niet
// stilzwijgend het verkeerde getal tonen. Herkent hij het bedrag van een order niet, dan telt die
// order als onbekend en zegt de app dat ook, in plaats van er nul van te maken.
//
// De hoofdletters verschillen per lijst: eToro's docs schrijven orderID/instrumentID voor de
// limietorders, een derde partij orderId/instrumentId voor de wachtende marktorders. Daarom beide
// schrijfwijzen, net als bij de historie (positieIdVan).
interface EtoroWachtendeOrder {
  orderID?: number;
  orderId?: number;
  instrumentID?: number;
  instrumentId?: number;
  isBuy?: boolean;
  // Alleen bij een limietorder: de koers waarop hij moet vullen.
  rate?: number;
  amount?: number;
  // Het bedrag dat eToro voor een wachtende marktorder vasthoudt.
  frozenAmount?: number;
  initialAmountInDollars?: number;
  investmentAmount?: number;
  totalAmount?: number;
  units?: number;
  amountInUnits?: number;
  leverage?: number;
  stopLossRate?: number;
  takeProfitRate?: number;
  isNoStopLoss?: boolean;
  isNoTakeProfit?: boolean;
  openDateTime?: string;
  lastUpdate?: string;
  executionType?: unknown;
  statusId?: number;
  orderType?: unknown;
}

// Posities zitten genest onder clientPortfolio (geverifieerd tegen de echte API-respons). De
// orderlijsten niet. Een eerdere versie nam aan dat `orders` DE lijst met wachtende orders was,
// maar volgens eToro's docs staan daar alleen de limietorders in; de marktorders die op een
// gesloten beurs wachten staan in `ordersForOpen`. Juist die hielden het geld vast uit de melding
// hierboven. `ordersForClose` zijn sluitorders op bestaande posities en reserveren geen geld.
//
// Gemeten op 28 sep 2026 (demo, lege lijsten): eToro stuurt altijd orders, stockOrders,
// entryOrders, exitOrders, ordersForOpen, ordersForClose en ordersForCloseMultiple mee. Welke
// wachtende koop in welke lijst belandt is met een gevulde lijst nog niet gezien, dus stockOrders en
// entryOrders tellen ook mee (ontdubbeld op orderId). exitOrders zijn sluitorders, net als
// ordersForClose. pendingOrders is een gok van vóór de meting en blijft alleen als terugval.
export interface EtoroPortfolioRespons {
  clientPortfolio?: {
    credit?: number;
    unrealizedPnL?: number;
    positions?: EtoroPositie[];
    orders?: EtoroWachtendeOrder[];
    stockOrders?: EtoroWachtendeOrder[];
    ordersForOpen?: EtoroWachtendeOrder[];
    ordersForClose?: EtoroWachtendeOrder[];
    entryOrders?: EtoroWachtendeOrder[];
    pendingOrders?: EtoroWachtendeOrder[];
  };
}

interface EtoroInstrument {
  instrumentID: number;
  symbolFull?: string;
  ticker?: string;
  instrumentDisplayName?: string;
  instrumentTypeID?: number;
}

interface FetchOpties {
  // De meeste endpoints zitten op v1; eligibility bestaat alleen als v2.
  versie?: 'v1' | 'v2';
  // Een body aanwezig = POST. Zonder body blijft het een GET, zodat de bestaande aanroepen
  // ongewijzigd blijven werken.
  body?: unknown;
  // Overschrijft die afleiding. Nodig voor de PATCH op posities en voor een POST zonder body.
  methode?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  // De aanroeper levert 'm, zodat een handmatige herhaling van een order dezelfde id hergebruikt.
  verzoekId?: string;
  // Langere timeout, en de aanroeper mag een afgebroken poging niet als "mislukt" opvatten.
  schrijft?: boolean;
}

// Waar het /demo/-segment staat verschilt per endpointgroep en is niet uit één regel af te leiden.
// Verkeerd gokken betekent een echte order op een echt account, dus een pad dat hier niet in staat
// levert een fout op in plaats van stilzwijgend het echte pad. Links het echte pad (prefix), rechts
// wat er in demo gebruikt wordt; identiek betekent dat het endpoint niet accountgebonden is.
//
// Uit eToro's developer portal: orders, market-close-orders en eligibility hebben elk een eigen
// gedocumenteerd demo-pad, en het /demo/-segment komt steeds na `execution` of `info`. Portfolio en
// historie volgen datzelfde patroon maar zijn nog niet tegen een echte demo-sleutel bevestigd;
// scripts/etoro-demo-order.ts probeert ze en meldt welk pad werkt.
//
// Let op hoe onregelmatig het is: bij orders en market-close komt /demo/ achter `execution`, bij
// portfolio en eligibility achter `info`, maar bij het wijzigen van een positie direct achter
// `trading`. Precies daarom een tabel en geen regel.
const DEMO_PADEN: ReadonlyArray<readonly [string, string]> = [
  ['/me', '/me'],
  ['/market-data/', '/market-data/'],
  ['/trading/info/eligibility', '/trading/info/demo/eligibility'],
  ['/trading/info/portfolio', '/trading/info/demo/portfolio'],
  // Uit de docs, nog niet gemeten. De ':' hoort bij het pad, niet bij de querystring.
  ['/trading/info/orders:lookup', '/trading/info/demo/orders:lookup'],
  // Gemeten: hier zit /demo/ tussen `trade` en `history`. /trading/info/demo/trade/history geeft
  // RouteNotFound. Let op waarom dit ertoe doet: het echte pad antwoordt gewoon met 200 en echte
  // historie, dus een verkeerde gok had hier stilzwijgend het echte account gelezen.
  ['/trading/info/trade/history', '/trading/info/trade/demo/history'],
  ['/trading/execution/orders', '/trading/execution/demo/orders'],
  ['/trading/execution/market-close-orders/', '/trading/execution/demo/market-close-orders/'],
  // Gemeten: PATCH /api/v2/trading/demo/positions/{id} geeft 202 en verzet de stop echt.
  // De drie andere plaatsingen van het /demo/-segment gaven allemaal RouteNotFound.
  ['/trading/positions/', '/trading/demo/positions/'],
];

// Alleen het pad zelf vergelijken; de querystring blijft ongemoeid achter het pad hangen.
export function demoPad(pad: string): string {
  const vraag = pad.indexOf('?');
  const kaal = vraag === -1 ? pad : pad.slice(0, vraag);
  const staart = vraag === -1 ? '' : pad.slice(vraag);

  // Langste treffer wint, zodat /trading/info/portfolio niet per ongeluk op een kortere prefix valt.
  // Een treffer moet op een padgrens eindigen: zonder die eis zou '/me' ook op een toekomstig
  // '/messages' matchen en dat pad stilzwijgend doorlaten in plaats van te gooien.
  let beste: readonly [string, string] | null = null;
  for (const regel of DEMO_PADEN) {
    if (!kaal.startsWith(regel[0])) continue;
    const rest = kaal.slice(regel[0].length);
    if (rest !== '' && !regel[0].endsWith('/') && !rest.startsWith('/')) continue;
    if (!beste || regel[0].length > beste[0].length) beste = regel;
  }
  if (!beste) throw new Error(`Geen demo-pad bekend voor ${kaal}. Kader stuurt dit niet naar het echte account.`);
  return beste[1] + kaal.slice(beste[0].length) + staart;
}

// Haalt uit een foutbody de reden die een gebruiker verder helpt, of '' als eToro niets zegt wat we
// niet al in de melding zetten. eToro antwoordt op een 401 steevast met errorCode en errorMessage
// allebei op "Unauthorized" (gemeten, zie etoroFetch), en dat is precies de mededeling die de
// melding eromheen al veel uitgebreider doet.
//
// Geëxporteerd omdat dit de enige regel is die bepaalt of er rauwe API-tekst in beeld komt; los te
// toetsen met de self-check onderaan dit bestand.
export function eigenlijkeFoutreden(body: string): string {
  const kaal = body.trim();
  if (!kaal) return '';

  let reden = kaal;
  try {
    const ontleed = JSON.parse(kaal) as { errorMessage?: unknown; message?: unknown };
    const uitJson = ontleed.errorMessage ?? ontleed.message;
    // Geen bruikbaar veld: dan liever niets tonen dan een stuk rauwe JSON.
    if (typeof uitJson !== 'string' || !uitJson.trim()) return '';
    reden = uitJson.trim();
  } catch {
    // Geen JSON. Een korte platte tekst mag door, een brok HTML (een gateway-pagina) niet.
    if (kaal.startsWith('<')) return '';
  }

  // "Unauthorized" en "Forbidden" zijn de statuscode in woorden, geen reden.
  if (/^(unauthorized|forbidden|access denied)\.?$/i.test(reden)) return '';
  return reden.slice(0, 200);
}

// status null = we hebben nooit een antwoord gezien (netwerkfout of timeout).
export class EtoroFout extends Error {
  constructor(bericht: string, readonly status: number | null, readonly afgebroken = false) {
    super(bericht);
    this.name = 'EtoroFout';
  }
}

// Wat betekent deze statuscode voor een schrijfactie? 'fout' = eToro heeft 'm afgewezen, er is
// zeker niets gebeurd. 'onbekend' = het kan uitgevoerd zijn; dan verzoenen, nooit herhalen.
export function duidOrderStatus(status: number): 'ok' | 'fout' | 'onbekend' {
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 400 && status < 500) return 'fout';
  return 'onbekend';
}

async function etoroFetch<T>(pad: string, sleutels: EtoroSleutels, opties: FetchOpties = {}): Promise<T> {
  const { versie = 'v1', body, methode, verzoekId, schrijft = false } = opties;
  const werkelijkPad = (sleutels.omgeving ?? 'real') === 'demo' ? demoPad(pad) : pad;

  // Promise.race liet de fetch gewoon doorlopen; een AbortController breekt 'm echt af.
  const controller = new AbortController();
  const wekker = setTimeout(() => controller.abort(), schrijft ? SCHRIJF_TIMEOUT : LEES_TIMEOUT);

  let res: Response;
  try {
    res = await fetch(`${BASIS_URL}/${versie}${werkelijkPad}`, {
      method: methode ?? (body === undefined ? 'GET' : 'POST'),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      headers: {
        'x-api-key': sleutels.apiKey,
        'x-user-key': sleutels.userKey,
        'x-request-id': verzoekId ?? guid(),
        'Accept': 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
    });
  } catch (e) {
    const afgebroken = controller.signal.aborted;
    throw new EtoroFout(
      afgebroken ? 'Geen antwoord van eToro binnen de tijd.' : 'Geen verbinding met eToro.',
      null,
      afgebroken,
    );
  } finally {
    clearTimeout(wekker);
  }

  if (res.status === 401 || res.status === 403) {
    // Noem de omgeving erbij, maar geef er niet de schuld aan. Eerder zei deze melding dat je
    // waarschijnlijk op de verkeerde omgeving stond; dat kan niet kloppen, want eToro geeft één
    // sleutel uit die op allebei de paden werkt (zie de meting verderop in dit bestand). Met een
    // goede sleutel hoort hier dus geen 401 te staan, ongeacht demo of echt. Wat er dan wél aan de
    // hand is: de sleutel is bij eToro ingetrokken of opnieuw aangemaakt, of er staat een nieuwe
    // api-sleutel naast een oude user-sleutel. In beide gevallen moeten beide velden opnieuw.
    //
    // De foutbody hoort hier net zo goed bij als bij elke andere status hieronder; die stond er
    // eerder niet, dus eToro's eigen woorden bleven onzichtbaar op precies de fout waar iemand op
    // vastloopt.
    //
    // Gemeten op 2026-09-03 tegen public-api.etoro.com: op een 401 antwoordt eToro ALTIJD met
    // {"errorCode":"Unauthorized","errorMessage":"Unauthorized"}, of je nu een verzonnen api-sleutel
    // stuurt, de user-sleutel weglaat of helemaal geen sleutels meestuurt. Die tekst er blind bij
    // plakken maakt de melding dus alleen langer en enger zonder iets toe te voegen. Daarom alleen
    // tonen wat verder gaat dan dat ene woord: zegt eToro ooit wél welk veld fout is (of geeft een
    // 403 een echte reden), dan staat het er, en anders blijft het weg.
    const tekst = await res.text().catch(() => '');
    const detail = eigenlijkeFoutreden(tekst);
    const inDemo = (sleutels.omgeving ?? 'real') === 'demo';
    const waar = inDemo ? 'demo-account' : 'echte account';
    // 401 en 403 zijn verschillende verhalen en verdienen verschillend advies. 401 = eToro kent
    // deze sleutelcombinatie niet, dus opnieuw invullen helpt. 403 = de sleutel klopt maar mag dit
    // niet, en dan is opnieuw invullen zinloos: dan mist de scope en moet je bij eToro een sleutel
    // met de juiste rechten maken.
    const uitleg =
      res.status === 403
        ? `eToro kent je sleutel wel, maar geeft hem geen toegang tot je ${waar}. Dat is een kwestie van rechten, niet van overtikken: maak bij eToro een sleutel aan met leesrecht (en, als je wilt handelen, schrijfrecht) voor deze omgeving.`
        : `eToro accepteert je sleutel niet op je ${waar}. Dezelfde sleutel hoort in demo en in echt te werken, dus dit ligt niet aan de schakelaar. Meestal staat er een nieuwe publieke sleutel naast een oude User Key: eToro toont die User Key maar één keer, dus na het aanmaken van een nieuwe sleutel moet je beide velden opnieuw invullen.`;
    throw new EtoroFout(
      `${uitleg}${detail ? ` eToro zegt: ${detail}` : ''}`,
      res.status,
    );
  }
  if (res.status === 429) {
    throw new EtoroFout('Te veel aanvragen bij eToro. Probeer het over een minuut opnieuw.', res.status);
  }
  if (!res.ok) {
    // ponytail: foutbody meesturen ipv alleen de statuscode, anders is de oorzaak niet te achterhalen
    const tekst = await res.text().catch(() => '');
    throw new EtoroFout(`eToro gaf een fout terug (${res.status}).${tekst ? ' ' + tekst.slice(0, 500) : ''}`, res.status);
  }

  // Het lezen van de body zat eerst buiten elke afhandeling. Een geslaagde schrijfactie die een
  // lege of niet-JSON body teruggeeft (een 202 mag dat) werd daardoor een kale SyntaxError zonder
  // status, en dus een gelukte order die als onclassificeerbare fout eindigde. De status telt hier,
  // niet de body: een 2xx is geslaagd, ook als er niets in staat.
  const tekst = await res.text().catch(() => '');
  if (!tekst.trim()) return undefined as T;
  try {
    return JSON.parse(tekst) as T;
  } catch {
    throw new EtoroFout(`eToro gaf een onleesbaar antwoord (${res.status}).`, res.status);
  }
}

// Pad geverifieerd tegen eToro's publieke API (real-account). Het demo-pad komt uit DEMO_PADEN en
// is nog niet tegen een echte demo-sleutel bevestigd.
export async function haalEtoroPortfolio(sleutels: EtoroSleutels): Promise<EtoroPortfolioRespons> {
  return etoroFetch<EtoroPortfolioRespons>('/trading/info/portfolio', sleutels);
}

// ---------- Account ----------

export interface EtoroAccount {
  gcid?: number;
  realCid?: number;
  demoCid?: number;
  username?: string;
  scopes?: string[];
}

export async function haalAccountInfo(sleutels: EtoroSleutels): Promise<EtoroAccount> {
  return etoroFetch<EtoroAccount>('/me', sleutels);
}

// Geverifieerd tegen een echte respons van /api/v1/me: eToro geeft scopes als
// 'etoro-public:trade.demo:write' en 'etoro-public:trade.real:write', per omgeving apart.
//
// Exact vergelijken, geen patroon. Een eerdere versie zocht op woorden als 'write', en die zei ja
// tegen 'etoro-public:agent-portfolio:write': een scope die niets met handelen te maken heeft zou
// dan de koopknop ontgrendelen. Hernoemt eToro deze scopes ooit, dan valt handelen uit. Dat is de
// goede kant om op te falen.
const HANDELSSCOPE: Record<EtoroOmgeving, string> = {
  real: 'etoro-public:trade.real:write',
  demo: 'etoro-public:trade.demo:write',
};

export function magHandelenVolgensScopes(scopes: string[] | null | undefined, omgeving: EtoroOmgeving): boolean {
  if (!Array.isArray(scopes)) return false;
  return scopes.includes(HANDELSSCOPE[omgeving]);
}

// Wat er van je cash echt te besteden is, en wat er vastzit in orders die nog niet gevuld zijn.
export interface SaldoStand {
  // clientPortfolio.credit min het gereserveerde bedrag. null = eToro gaf `credit` niet mee; dan
  // liever geen betaalbaarheidscontrole dan een verzonnen bedrag.
  besteedbaarUsd: number | null;
  // Het kale getal van eToro, voor de uitleg naast het bedrag.
  creditUsd: number | null;
  // Wat er vastzit in wachtende orders. 0 als er geen orders wachten, null als er wél orders
  // wachten maar Kader het bedrag ervan niet kan lezen.
  gereserveerdUsd: number | null;
  wachtendeOrders: number;
}

const positiefGetal = (waarde: unknown): number | null =>
  typeof waarde === 'number' && isFinite(waarde) && waarde > 0 ? waarde : null;

// Het eerste bedrag dat als getal te lezen is. Geen optelling van alle velden: het zijn mogelijke
// namen voor hetzelfde bedrag, niet losse bedragen.
function orderBedrag(order: EtoroWachtendeOrder): number | null {
  for (const waarde of [order.amount, order.frozenAmount, order.initialAmountInDollars, order.investmentAmount, order.totalAmount]) {
    const bedrag = positiefGetal(waarde);
    if (bedrag !== null) return bedrag;
  }
  return null;
}

type OrderSoort = 'markt' | 'limiet';

// Welke lijsten tellen als orders die geld vasthouden. Gedeeld door het saldo en de orderlijst,
// zodat het aantal op de saldokaart en het aantal regels in de lijst nooit uit elkaar lopen.
//
// Eerder pakte het saldo de eerste array uit orders/entryOrders/pendingOrders. Stuurt eToro dan
// `orders: []` (geen limietorders) naast een gevulde ordersForOpen, dan werd die tweede lijst
// genegeerd en stond het vastgezette geld weer als besteedbaar. Nu tellen orders en ordersForOpen
// allebei mee. De oude gokken tellen alleen als geen van beide er is, anders zou dezelfde order
// onder twee namen dubbel afgetrokken kunnen worden.
//
// Een open positie met hetzelfde orderID verbergt de order hier bewust niet. Die koppeling is niet
// gemeten, en bij een gedeeltelijke vulling zit er nog geld vast. Liever een gevulde order even
// dubbel tellen dan vastgezet geld als besteedbaar tonen. Een eigen order met een definitieve
// status valt in PortfolioProvider weg (zie isAfgerond); orderID op een positie wordt nog wel
// gelezen voor de dev-log hieronder.
//
// null = eToro stuurde geen enkele lijst mee.
function wachtendeLijsten(portfolio: EtoroPortfolioRespons): { soort: OrderSoort; order: EtoroWachtendeOrder }[] | null {
  const cp = portfolio.clientPortfolio;
  // Een null of kale waarde in de lijst wordt een lege order: die telt dan als onleesbaar mee in
  // plaats van de hele sync op een TypeError te laten stranden.
  type SoortRegel = OrderSoort | ((order: EtoroWachtendeOrder) => OrderSoort);
  const regels = (lijst: EtoroWachtendeOrder[], soort: SoortRegel) =>
    lijst.map(item => {
      const order: EtoroWachtendeOrder = item && typeof item === 'object' ? item : {};
      return { soort: typeof soort === 'function' ? soort(order) : soort, order };
    });

  // stockOrders kan allebei bevatten: een order met een leesbare koers is een limietorder, een
  // zonder is een marktorder die op een dichte beurs wacht. Dus per order beslissen, niet per lijst.
  const stockSoort = (order: EtoroWachtendeOrder): OrderSoort => positiefGetal(order.rate) !== null ? 'limiet' : 'markt';

  const bronnen: [unknown, SoortRegel][] = [
    [cp?.ordersForOpen, 'markt'],
    [cp?.stockOrders, stockSoort],
    [cp?.orders, 'limiet'],
    [cp?.entryOrders, 'limiet'],
  ];
  const aanwezig = bronnen.filter(([lijst]) => Array.isArray(lijst)) as [EtoroWachtendeOrder[], SoortRegel][];
  if (aanwezig.length === 0) {
    return Array.isArray(cp?.pendingOrders) ? regels(cp.pendingOrders, 'limiet') : null;
  }

  // Dezelfde order kan onder twee namen staan; dan maar één keer tellen, anders wordt het
  // vastgezette bedrag dubbel van je saldo afgetrokken. Een order zonder leesbaar id valt niet te
  // ontdubbelen en telt gewoon mee.
  const gezien = new Set<number>();
  const uit: { soort: OrderSoort; order: EtoroWachtendeOrder }[] = [];
  for (const [lijst, soort] of aanwezig) {
    for (const regel of regels(lijst, soort)) {
      const id = positiefGetal(regel.order.orderId ?? regel.order.orderID);
      if (id !== null) {
        if (gezien.has(id)) continue;
        gezien.add(id);
      }
      uit.push(regel);
    }
  }
  return uit;
}

// Pure functie zodat de randgevallen (geen orderlijst, een order zonder leesbaar bedrag, een
// negatief saldo) in de self-check onderaan getoetst kunnen worden.
export function bepaalSaldoStand(portfolio: EtoroPortfolioRespons): SaldoStand {
  const cp = portfolio.clientPortfolio;
  const credit = cp?.credit;
  const creditUsd = typeof credit === 'number' && isFinite(credit) ? credit : null;

  const lijst = wachtendeLijsten(portfolio)?.map(r => r.order);
  // Geen lijst betekent niet "geen orders": eToro kan het veld gewoon weglaten. Dan is er ook niets
  // te reserveren en blijft het besteedbare bedrag het kale saldo, precies zoals voorheen.
  if (lijst === undefined) {
    return { besteedbaarUsd: creditUsd, creditUsd, gereserveerdUsd: 0, wachtendeOrders: 0 };
  }

  let gereserveerd = 0;
  let onleesbaar = false;
  for (const order of lijst) {
    const bedrag = orderBedrag(order);
    if (bedrag === null) onleesbaar = true;
    else gereserveerd += bedrag;
  }

  // Eén order zonder leesbaar bedrag maakt de hele optelling onbetrouwbaar. Dan geen bedrag tonen
  // en ook niets aftrekken, maar wel melden dát er orders wachten: dat is het enige eerlijke.
  if (onleesbaar) {
    return { besteedbaarUsd: creditUsd, creditUsd, gereserveerdUsd: null, wachtendeOrders: lijst.length };
  }

  return {
    // Nooit onder nul: eToro kan meer gereserveerd hebben dan er credit over is, en een negatief
    // "te besteden" bedrag leest als een schuld in plaats van als niets te besteden.
    besteedbaarUsd: creditUsd === null ? null : Math.max(0, creditUsd - gereserveerd),
    creditUsd,
    gereserveerdUsd: gereserveerd,
    wachtendeOrders: lijst.length,
  };
}

// Vrij te besteden saldo van de actieve omgeving, met het gereserveerde bedrag van wachtende
// orders er al af.
export async function haalSaldoStand(sleutels: EtoroSleutels): Promise<SaldoStand> {
  return bepaalSaldoStand(await haalEtoroPortfolio(sleutels));
}

// ---------- Wachtende orders ----------

// Eén wachtende order, los van hoe eToro hem schrijft. Elk veld dat niet te lezen is wordt null,
// nooit 0: een stop van 0 of een bedrag van $0 in beeld is een verzonnen getal.
export interface WachtendeOrderRuw {
  // null = niet annuleerbaar. De order staat wel in de lijst, want het geld zit echt vast.
  orderId: number | null;
  instrumentId: number | null;
  soort: OrderSoort;
  richting: Richting;
  bedragUsd: number | null;
  // Alleen bij een limietorder.
  limietKoers: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  // Epoch ms.
  openTijd: number | null;
  statusId: number | null;
}

export type WachtendeOrder = WachtendeOrderRuw & { symbool: string; naam: string; omgeving: EtoroOmgeving };

// Pure functie: de veldnamen zijn nog niet gemeten, dus de leesregels moeten in de self-check staan.
export function leesWachtendeOrders(portfolio: EtoroPortfolioRespons): WachtendeOrderRuw[] {
  return (wachtendeLijsten(portfolio) ?? []).map(({ soort, order }) => {
    const tijd = typeof order.openDateTime === 'string' ? Date.parse(order.openDateTime) : NaN;
    return {
      orderId: positiefGetal(order.orderId ?? order.orderID),
      instrumentId: positiefGetal(order.instrumentId ?? order.instrumentID),
      soort,
      // Zelfde regel als bij posities: alleen een expliciete false is short.
      richting: order.isBuy === false ? 'short' : 'long',
      bedragUsd: orderBedrag(order),
      limietKoers: soort === 'limiet' ? positiefGetal(order.rate) : null,
      // isNoStopLoss zegt expliciet dat er geen stop is; een koers die er dan toch naast staat is
      // een restwaarde en geen niveau.
      stopLoss: order.isNoStopLoss === true ? null : positiefGetal(order.stopLossRate),
      takeProfit: order.isNoTakeProfit === true ? null : positiefGetal(order.takeProfitRate),
      openTijd: isNaN(tijd) ? null : tijd,
      statusId: typeof order.statusId === 'number' && isFinite(order.statusId) ? order.statusId : null,
    };
  });
}

// ============================================================================
// ORDERS
//
// INVARIANT: de vier functies hieronder (plaatsKooporder, sluitPositie, wijzigNiveaus,
// annuleerOrder) mogen UITSLUITEND aangeroepen worden vanuit een expliciete bevestiging door de
// gebruiker. Nooit vanuit een setInterval, nooit vanuit de AppState-listener, nooit vanuit
// achtergrondtaak.ts, en nooit vanuit een herhaallus. Er is met opzet geen retry en geen backoff:
// een afgebroken schrijfactie annuleert niets aan eToro's kant, dus opnieuw sturen kan een tweede
// positie openen. Ook annuleren hoort daarbij: Kader beslist nooit zelf dat een order weg moet.
// zoekOrderStatus leest alleen en valt hier niet onder.
//
// Gemeten: eToro geeft één sleutel uit die zowel demo als echt mag handelen. Het PAD is dus het
// enige dat speelgeld van echt geld scheidt, en demoPad() gooit bij een pad dat het niet kent.
// ============================================================================

export type OrderUitkomst =
  | { soort: 'ok'; orderId?: number; token?: string }
  // eToro heeft hem afgewezen; er is zeker niets gebeurd.
  | { soort: 'fout'; bericht: string }
  // Kan uitgevoerd zijn. Verzoenen, nooit herhalen.
  | { soort: 'onbekend'; bericht: string; verzoekId: string };

// Van een gevangen fout naar een uitkomst. Let op het verschil met duidOrderStatus: een EtoroFout
// zonder status betekent dat we nooit een antwoord gezien hebben, en dat is 'onbekend'. Alles wat
// geen EtoroFout is (een demoPad die gooit, een programmeerfout) komt uit onze eigen code en
// betekent juist dat er niets verstuurd is: dat is de veiligste uitkomst, 'fout'.
export function duidFout(e: unknown, verzoekId: string): OrderUitkomst {
  if (e instanceof EtoroFout) {
    const bericht = e.message;
    if (e.status === null) return { soort: 'onbekend', bericht, verzoekId };
    return duidOrderStatus(e.status) === 'onbekend'
      ? { soort: 'onbekend', bericht, verzoekId }
      : { soort: 'fout', bericht };
  }
  return { soort: 'fout', bericht: e instanceof Error ? e.message : 'Onbekende fout.' };
}

// Tweede slot tegen dubbel indienen, naast de bezig-state in de sheet. Die state leeft per
// component; deze guard geldt voor de hele app, ook als er twee sheets tegelijk open zouden staan.
let orderLoopt = false;

async function voerOrderUit(
  verzoekId: string,
  actie: () => Promise<{ orderId?: number; token?: string } | undefined>,
): Promise<OrderUitkomst> {
  if (orderLoopt) return { soort: 'fout', bericht: 'Er loopt al een order. Wacht tot die klaar is.' };
  orderLoopt = true;
  try {
    const antwoord = await actie();
    return { soort: 'ok', orderId: antwoord?.orderId, token: antwoord?.token };
  } catch (e) {
    return duidFout(e, verzoekId);
  } finally {
    orderLoopt = false;
  }
}

// ---------- Symbool naar instrumentId ----------

interface ZoekTreffer {
  internalSymbolFull?: string;
  instrumentId?: number;
  internalInstrumentId?: number;
  internalAssetClassName?: string;
  isDelisted?: boolean;
  isBuyEnabled?: boolean;
  isInternalInstrument?: boolean;
}

// Zonder de fields-projectie geeft dit endpoint per treffer een paar kilobyte aan beschrijvingen in
// twintig talen terug. Met projectie is het een handvol velden.
const ZOEK_VELDEN = 'internalSymbolFull,instrumentId,internalAssetClassName,isDelisted,isBuyEnabled,isInternalInstrument';

// Welke van de zoektreffers is de coin die de gebruiker bedoelt? Pure functie, zodat de regels
// hieronder in de self-check staan in plaats van alleen in een API-respons die niemand kan naspelen.
//
// Gemeten: zoeken op "BTC" geeft 53 treffers, waaronder BTCEUR, BTCJPY en futures als BTC.DEC29.
// Alleen een exacte match op internalSymbolFull is de coin zelf, en isBuyEnabled staat op alle
// crosses op false en alleen op de echte BTC op true.
//
// De volgorde is belangrijk en was eerder andersom: eerst werd geëist dat er precies één exacte
// match was, en pas daarna werden delisted, niet-koopbaar en niet-crypto weggegooid. Voerde eToro
// hetzelfde symbool twee keer op (een oude delisted regel naast de levende, of een crypto naast een
// andere assetclass), dan viel het antwoord op nul terug terwijl er maar één echte kandidaat was.
// Nu gooien we eerst alles weg wat het per definitie niet kan zijn, en pas dan geldt de eis dat er
// precies één overblijft. Blijven er twee bruikbare over, dan nog steeds null: bij twijfel niet
// handelen, want een verkeerd id opent een positie in een andere coin.
export function kiesInstrumentTreffer(treffers: ZoekTreffer[], symbool: string): number | null {
  const gezocht = symbool.trim().toUpperCase();
  if (!gezocht) return null;

  const bruikbaar = treffers.filter(t => {
    if ((t.internalSymbolFull ?? '').toUpperCase() !== gezocht) return false;
    if (t.isDelisted === true) return false;
    if (t.isBuyEnabled === false) return false;
    // Gemeten: FLOW staat bij eToro op alleen bekijken en is de enige van 57 coins met dit veld op
    // true, terwijl isBuyEnabled bij hem true blijft. Een order erop wordt later geannuleerd.
    if (t.isInternalInstrument === true) return false;
    // Ontbreekt de assetclass, dan niet afkeuren: eToro stuurt het veld niet altijd mee en een
    // ontbrekend veld is geen bewijs dat het geen crypto is.
    if (t.internalAssetClassName && t.internalAssetClassName.toLowerCase() !== 'crypto') return false;
    const id = t.instrumentId ?? t.internalInstrumentId;
    return typeof id === 'number' && id > 0;
  });

  if (bruikbaar.length !== 1) return null;
  return (bruikbaar[0].instrumentId ?? bruikbaar[0].internalInstrumentId)!;
}

// Geeft null bij elke twijfel, en dan is kopen geblokkeerd.
//
// Zes coins voert eToro onder een andere naam (zie engine/etoroSymbolen.ts), dus we zoeken op het
// eToro-symbool, in eToro's exacte schrijfwijze (bijv. SHIBxM, niet SHIBXM): kiesInstrumentTreffer
// vergelijkt zelf al hoofdletterongevoelig, maar de query naar eToro moet de precieze schrijfwijze
// zijn, anders levert de zoekopdracht niets op.
export async function zoekInstrumentId(symbool: string, sleutels: EtoroSleutels): Promise<number | null> {
  const gezocht = symbool.trim();
  if (!gezocht) return null;
  const etoroSymbool = naarEtoroSymbool(gezocht);

  const data = await etoroFetch<{ items?: ZoekTreffer[] }>(
    `/market-data/search?internalSymbolFull=${encodeURIComponent(etoroSymbool)}&fields=${ZOEK_VELDEN}`,
    sleutels,
  );

  return kiesInstrumentTreffer(data?.items ?? [], etoroSymbool);
}

// ---------- Kooporder ----------

export interface KooporderInvoer {
  instrumentId: number;
  bedragUsd: number;
  // Long of short. Ontbreekt = long, zodat elke bestaande aanroep exact hetzelfde blijft doen.
  richting?: Richting;
  // Absolute koersen, geen percentages. Weglaten betekent: geen niveau meesturen, eToro kiest zelf.
  // Dit zijn Kaders eigen koersen (per coin); bouwKooporderBody rekent ze naar eToro's eenheid om.
  stopLossRate?: number;
  takeProfitRate?: number;
  // Sommige coins voert eToro in een andere eenheid (SHIB en PEPE per miljoen munten, zie
  // engine/etoroSymbolen.ts): eToro-koers = Kader-koers * koersFactor. Ontbreekt hij, of is hij niet
  // eindig of <= 0, dan geldt factor 1 (geen omrekening), zodat elke bestaande aanroep zonder dit
  // veld exact hetzelfde blijft doen.
  koersFactor?: number;
}

// eToro accepteerde 51592.8, dus een paar decimalen mag. Zonder afronden stuur je drijvendekomma-
// ruis als 51592.800000000003 mee.
const afgerond = (waarde: number) => Math.round(waarde * 1e8) / 1e8;

// Puur, zodat de samenvatting in de sheet uit dezelfde waarden komt als wat er werkelijk verstuurd
// wordt. Bij een LONG wordt settlementType bewust weggelaten: dat is gemeten in fase 1, het werkt,
// en eToro koos zelf het juiste type voor een spot-cryptokoop. Daar blijven we vanaf.
//
// Bij een SHORT sturen we het wel mee, als 'cfd'. Reden: uit de eligibility blijkt dat crypto short
// alleen bestaat als settlementType 'cfd' (long is 'real'), allebei op hefboom x1. Als eToro het
// type net zo goed zelf afleidt uit transaction 'sell' is dit veld overbodig maar niet fout; laat
// het weg zodra een demo-sell-order bewijst dat het ook zonder gaat. NOG NIET GEMETEN: er is nog
// geen echte demo-short geplaatst, dus dit is de best onderbouwde gok en geen vastgesteld feit.
export function bouwKooporderBody(invoer: KooporderInvoer): Record<string, unknown> {
  // Gemeten (26 aug 2026, docs/etoro-direct-handelen-plan.md paragraaf 10): crypto short bestaat bij
  // eToro alleen als settlementType 'cfd', maar wel op hefboom x1. Een short is daar dus wel een
  // CFD en niet een hefboompositie, en daarom blijft leverage gewoon 1: Kader rekent nergens met
  // hefboom en hoeft dat voor shorts ook niet te gaan doen.
  const short = invoer.richting === 'short';
  const body: Record<string, unknown> = {
    action: 'open',
    transaction: short ? 'sell' : 'buy',
    instrumentId: invoer.instrumentId,
    orderType: 'mkt',
    leverage: 1,
    amount: afgerond(invoer.bedragUsd),
    orderCurrency: 'usd',
  };
  if (short) body.settlementType = 'cfd';

  // Ontbreekt de factor, of is hij niet bruikbaar (0, negatief, NaN), dan verandert er niets: 1 is
  // geen omrekening.
  const factor = typeof invoer.koersFactor === 'number' && isFinite(invoer.koersFactor) && invoer.koersFactor > 0
    ? invoer.koersFactor : 1;

  const stop = invoer.stopLossRate;
  if (typeof stop === 'number' && isFinite(stop) && stop > 0) {
    body.stopLossRate = afgerond(stop * factor);
    body.stopLossType = 'fixed';
  }
  const doel = invoer.takeProfitRate;
  if (typeof doel === 'number' && isFinite(doel) && doel > 0) {
    body.takeProfitRate = afgerond(doel * factor);
  }
  return body;
}

export async function plaatsKooporder(
  invoer: KooporderInvoer,
  sleutels: EtoroSleutels,
  verzoekId: string,
): Promise<OrderUitkomst> {
  return voerOrderUit(verzoekId, () =>
    etoroFetch<{ orderId?: number; token?: string }>('/trading/execution/orders', sleutels, {
      versie: 'v2',
      body: bouwKooporderBody(invoer),
      verzoekId,
      schrijft: true,
    }),
  );
}

// ---------- Positie sluiten ----------

// Gemeten (28 sep 2026, demo): POST .../market-close-orders/positions/{id} antwoordt met 200
// `{"orderForClose":{"positionID":...,"instrumentID":1001,"orderID":384452601,"orderType":19,"statusID":1,...},"token":"..."}`.
// Het orderId staat dus niet bovenaan zoals bij een kooporder, maar genest, en met hoofdletters ID.
// Zonder dit kreeg een verkoop nooit een orderId en werd zijn uitkomst dus nooit opgevraagd. Het
// platte orderId blijft als eerste keus staan voor het geval eToro het antwoord gelijktrekt.
interface SluitAntwoord {
  orderId?: number;
  token?: string;
  orderForClose?: { orderID?: number; orderId?: number };
}

export function leesSluitOrderId(antwoord: SluitAntwoord | undefined): number | null {
  return positiefGetal(antwoord?.orderId)
    ?? positiefGetal(antwoord?.orderForClose?.orderID)
    ?? positiefGetal(antwoord?.orderForClose?.orderId);
}

// unitsToDeduct null = de hele positie sluiten.
export async function sluitPositie(
  positionId: number,
  instrumentId: number,
  unitsToDeduct: number | null,
  sleutels: EtoroSleutels,
  verzoekId: string,
): Promise<OrderUitkomst> {
  return voerOrderUit(verzoekId, async () => {
    const antwoord = await etoroFetch<SluitAntwoord | undefined>(
      `/trading/execution/market-close-orders/positions/${positionId}`,
      sleutels,
      {
        versie: 'v1',
        // Hoofdletters zoals eToro ze documenteert.
        body: { InstrumentId: instrumentId, UnitsToDeduct: unitsToDeduct },
        verzoekId,
        schrijft: true,
      },
    );
    return {
      orderId: leesSluitOrderId(antwoord) ?? undefined,
      token: typeof antwoord?.token === 'string' ? antwoord.token : undefined,
    };
  });
}

// ---------- Niveaus wijzigen ----------

export interface NiveauWijziging {
  // Kaders eigen koersen (per coin); bouwNiveauBody rekent ze met koersFactor om naar eToro's
  // eenheid.
  stopLossRate?: number;
  takeProfitRate?: number;
  // Een niveau weghalen in plaats van verzetten.
  clearStopLoss?: boolean;
  clearTakeProfit?: boolean;
  // Zie KooporderInvoer.koersFactor: dezelfde omrekening, voor dezelfde zes coins.
  koersFactor?: number;
}

// Gemeten: een veld dat je niet meestuurt blijft ongemoeid, dus een gedeeltelijke wijziging kan.
export function bouwNiveauBody(wijziging: NiveauWijziging): Record<string, unknown> {
  const factor = typeof wijziging.koersFactor === 'number' && isFinite(wijziging.koersFactor) && wijziging.koersFactor > 0
    ? wijziging.koersFactor : 1;

  const body: Record<string, unknown> = {};
  if (wijziging.clearStopLoss) body.clearStopLoss = true;
  else if (typeof wijziging.stopLossRate === 'number' && wijziging.stopLossRate > 0) {
    body.stopLossRate = afgerond(wijziging.stopLossRate * factor);
    body.stopLossType = 'fixed';
  }
  if (wijziging.clearTakeProfit) body.clearTakeProfit = true;
  else if (typeof wijziging.takeProfitRate === 'number' && wijziging.takeProfitRate > 0) {
    body.takeProfitRate = afgerond(wijziging.takeProfitRate * factor);
  }
  return body;
}

export async function wijzigNiveaus(
  positionId: number,
  wijziging: NiveauWijziging,
  sleutels: EtoroSleutels,
  verzoekId: string,
): Promise<OrderUitkomst> {
  const body = bouwNiveauBody(wijziging);
  if (Object.keys(body).length === 0) return { soort: 'fout', bericht: 'Er is niets gewijzigd.' };

  return voerOrderUit(verzoekId, () =>
    etoroFetch<{ orderId?: number; token?: string }>(`/trading/positions/${positionId}`, sleutels, {
      versie: 'v2',
      methode: 'PATCH',
      body,
      verzoekId,
      schrijft: true,
    }),
  );
}

// ---------- Wachtende order annuleren ----------

// DELETE zonder body. Gemeten (28 sep 2026, demo): op een order die al gevuld was gaf eToro toch
// 200 `{orderId, referenceId:""}`, en de status bleef Filled. Een 'ok' betekent hier dus "verzoek
// aangenomen", niet "geannuleerd"; de aanroeper mag niet beweren dat de order weg is. Wat er echt
// gebeurd is, weet je pas na een zoekOrderStatus; zie meldingNaAnnuleren in state/orderUitkomsten.ts.
//
// Een 404 (order bestaat niet of niet meer) wordt hier al vertaald, zodat eToro's rauwe foutbody
// niet in beeld komt. Het blijft een 'fout': er is niets geannuleerd, ook al kan de order intussen
// gevuld zijn. De aanroeper synct daarna en ziet het vanzelf.
export const ORDER_BESTAAT_NIET_MEER = 'Deze order bestaat niet meer bij eToro. Hij is al uitgevoerd of geannuleerd.';

export async function annuleerOrder(
  orderId: number,
  sleutels: EtoroSleutels,
  verzoekId: string,
): Promise<OrderUitkomst> {
  // Een id dat geen positief geheel getal is komt niet van eToro. Liever niets versturen dan een
  // DELETE op /orders/NaN die eToro misschien anders uitlegt dan wij.
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { soort: 'fout', bericht: 'Kader kan deze order niet herkennen en annuleert hem daarom niet.' };
  }
  return voerOrderUit(verzoekId, async () => {
    try {
      return await etoroFetch<{ orderId?: number; token?: string }>(`/trading/execution/orders/${orderId}`, sleutels, {
        versie: 'v2',
        // Zonder body leidt etoroFetch GET af; de methode moet dus expliciet.
        methode: 'DELETE',
        verzoekId,
        schrijft: true,
      });
    } catch (e) {
      // Met status 404 erbij, zodat duidFout er net als voorheen een 'fout' van maakt.
      if (e instanceof EtoroFout && e.status === 404) throw new EtoroFout(ORDER_BESTAAT_NIET_MEER, 404);
      throw e;
    }
  });
}

// ---------- Orderstatus ----------

export interface OrderStatus {
  id: number;
  // eToro's eigen statusnaam (Engels). Voor de gebruiker is er statusInGewoneTaal().
  naam: string;
  foutCode: number | null;
  // eToro's reden bij een weigering, of null als eToro niets zegt.
  reden: string | null;
  definitief: boolean;
  orderId: number | null;
  // Positie-ID's uit positionExecutions; leeg als eToro er (nog) geen meestuurt.
  positieIds: number[];
}

interface OrderLookupRespons {
  orderId?: number;
  orderID?: number;
  status?: { id?: number; name?: string; errorCode?: number; errorMessage?: string };
  // Gemeten (demo): de posities die uit een gevulde order ontstonden. De schrijfwijze van het id is
  // alleen als positionId gezien; positionID staat erbij omdat eToro dat elders wel zo schrijft.
  positionExecutions?: { positionId?: number; positionID?: number }[];
}

// Uit eToro's docs: 3 Filled, 4 Rejected, 7 Canceled, 8 Expired, 9 CanceledPartiallyFilled,
// 10 RejectedPartiallyFilled. Daarna verandert er niets meer, dus opnieuw opvragen is zinloos.
const DEFINITIEVE_STATUSSEN = new Set([3, 4, 7, 8, 9, 10]);

export function isDefinitieveStatus(id: number): boolean {
  return DEFINITIEVE_STATUSSEN.has(id);
}

const STATUS_TEKST: Record<number, string> = {
  1: 'ontvangen door eToro',
  2: 'ontvangen door eToro',
  3: 'uitgevoerd',
  4: 'geweigerd door eToro',
  5: 'gedeeltelijk uitgevoerd',
  6: 'wordt geannuleerd',
  7: 'geannuleerd',
  8: 'verlopen',
  9: 'gedeeltelijk uitgevoerd, de rest is geannuleerd',
  10: 'gedeeltelijk uitgevoerd, de rest is geweigerd',
  11: 'wacht tot de markt opent',
  12: 'wacht op de koers',
};

export function statusInGewoneTaal(id: number): string {
  return STATUS_TEKST[id] ?? 'status onbekend';
}

// Opzoeken op orderId, of op de x-request-id waarmee de order verstuurd is (referenceId). Let op:
// gemeten op 28 sep 2026 (demo) gaf de lookup op referenceId 404 "No external operation was found",
// ook voor een order die eToro net met precies die referenceId had bevestigd. De lookup op orderId
// werkte wel. Gebruik dus orderId; referenceId staat er alleen nog voor als eToro dat ooit oplost.
//
// null = eToro kent deze order niet (404). Elke andere fout gooit, want "kon het niet nagaan" is
// iets anders dan "bestaat niet". Een antwoord zonder leesbaar status-id gooit ook: een status
// verzinnen is erger dan er geen tonen.
export async function zoekOrderStatus(
  sleutel: { orderId: number } | { referenceId: string },
  sleutels: EtoroSleutels,
): Promise<OrderStatus | null> {
  let query: string;
  if ('orderId' in sleutel) {
    if (!Number.isInteger(sleutel.orderId) || sleutel.orderId <= 0) throw new Error('Ongeldig order-id.');
    query = `orderId=${encodeURIComponent(String(sleutel.orderId))}`;
  } else {
    if (!sleutel.referenceId.trim()) throw new Error('Lege verzoek-id.');
    query = `referenceId=${encodeURIComponent(sleutel.referenceId.trim())}`;
  }

  let data: OrderLookupRespons | undefined;
  try {
    data = await etoroFetch<OrderLookupRespons | undefined>(`/trading/info/orders:lookup?${query}`, sleutels, { versie: 'v2' });
  } catch (e) {
    if (e instanceof EtoroFout && e.status === 404) return null;
    throw e;
  }

  const status = data?.status;
  const id = status?.id;
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw new Error('eToro gaf een orderstatus die Kader niet kan lezen.');
  }
  const reden = typeof status?.errorMessage === 'string' ? status.errorMessage.trim() : '';
  return {
    id,
    naam: typeof status?.name === 'string' ? status.name.trim() : '',
    foutCode: typeof status?.errorCode === 'number' && isFinite(status.errorCode) ? status.errorCode : null,
    reden: reden ? reden.slice(0, 200) : null,
    definitief: isDefinitieveStatus(id),
    orderId: positiefGetal(data?.orderId ?? data?.orderID),
    positieIds: (Array.isArray(data?.positionExecutions) ? data.positionExecutions : [])
      .map(e => positiefGetal(e?.positionId ?? e?.positionID))
      .filter((p): p is number => p !== null),
  };
}

// ---------- Stop-loss-limieten ----------

interface EligibilityRespons {
  eligibilities?: EtoroEligibility[];
  notFoundSymbols?: string[];
}

// eToro staat maximaal 100 symbolen per aanroep toe, en dit endpoint heeft een eigen quotum van
// 20 requests per 60 seconden. Daarom in één keer alles opvragen en een dag cachen (zie
// state/useStopLossLimiet.ts); de limieten veranderen zelden.
const MAX_SYMBOLEN = 100;

// Geeft per symbool de stop-loss-grenzen die eToro hanteert. Symbolen die eToro niet kent komen
// terug in notFoundSymbols en staan dus simpelweg niet in de kaart: geen limiet, geen waarschuwing.
export async function haalStopLossLimieten(
  symbolen: string[],
  sleutels: EtoroSleutels,
): Promise<Record<string, StopLossLimiet>> {
  // eToro verwacht hier zijn eigen schrijfwijze (bijv. SHIBxM), dus niet zomaar uppercasen zoals de
  // rest van dit bestand doet: naarEtoroSymbool levert de exacte schrijfwijze, en ontdubbelt daarop.
  const uniek = [...new Set(symbolen.map(s => naarEtoroSymbool(s)))].slice(0, MAX_SYMBOLEN);
  if (uniek.length === 0) return {};

  const data = await etoroFetch<EligibilityRespons>('/trading/info/eligibility', sleutels, {
    versie: 'v2',
    body: { symbols: uniek, currency: 'USD' },
  });

  // Beide richtingen uit dezelfde respons: eToro levert de long- en de short-config naast elkaar,
  // dus dit kost geen extra verzoek en dat is belangrijk, het endpoint heeft maar 20 per minuut.
  // De sleutel is SYMBOOL:richting, want de grenzen verschillen echt (gemeten: short max 50%,
  // long max 100%). Grenzen zijn percentages van de inleg, dus geen koers om om te rekenen; wel
  // moet het symbool zelf terug naar Kaders eigen naam, anders staat de grens onder SHIBxM in de
  // kaart terwijl de rest van de app onder SHIB zoekt, en komt hij ook zo in uitlegteksten terecht.
  const kaart: Record<string, StopLossLimiet> = {};
  for (const item of data.eligibilities ?? []) {
    for (const richting of ['long', 'short'] as const) {
      const ruw = kiesLimiet(item, richting);
      if (!ruw) continue;
      const limiet: StopLossLimiet = { ...ruw, symbool: vanEtoroSymbool(ruw.symbool) };
      kaart[`${limiet.symbool}:${richting}`] = limiet;
    }
  }
  return kaart;
}

async function haalInstrumenten(ids: number[], sleutels: EtoroSleutels): Promise<Map<number, EtoroInstrument>> {
  const kaart = new Map<number, EtoroInstrument>();
  if (ids.length === 0) return kaart;
  // De respons komt terug onder instrumentDisplayDatas (geverifieerd tegen de echte API-respons).
  const data = await etoroFetch<{ instrumentDisplayDatas?: EtoroInstrument[] } | EtoroInstrument[]>(
    `/market-data/instruments?instrumentIds=${ids.join(',')}`,
    sleutels,
  );
  const lijst = Array.isArray(data) ? data : (data.instrumentDisplayDatas ?? []);
  for (const instr of lijst) kaart.set(instr.instrumentID, instr);
  return kaart;
}

// De crypto-instrumentTypeID staat niet vast gedocumenteerd; we vragen 'm live op zodat we niet
// hoeven te gokken (en zodat het blijft werken als eToro de nummering ooit wijzigt).
// ponytail: lukt de herkenning niet (onverwachte responsvorm), dan filteren we niet op type en
// nemen we liever een aandeel te veel mee dan een crypto te missen.
async function haalCryptoTypeIds(sleutels: EtoroSleutels): Promise<Set<number> | null> {
  try {
    const data = await etoroFetch<unknown>('/market-data/instrument-types', sleutels);
    const lijst = Array.isArray(data) ? data : Array.isArray((data as any)?.instrumentTypes) ? (data as any).instrumentTypes : null;
    if (!lijst) return null;

    const ids = new Set<number>();
    for (const item of lijst) {
      if (!item || typeof item !== 'object') continue;
      const isCrypto = Object.values(item).some(v => typeof v === 'string' && /crypto/i.test(v));
      if (!isCrypto) continue;
      const idVeld = Object.entries(item).find(([k, v]) => /id$/i.test(k) && typeof v === 'number');
      if (idVeld) ids.add(idVeld[1] as number);
    }
    return ids.size > 0 ? ids : null;
  } catch {
    return null;
  }
}

function symboolVan(instrument: EtoroInstrument | undefined): string {
  const ruw = instrument?.ticker ?? instrument?.symbolFull ?? '';
  return ruw.replace(/\/.*$/, '').toUpperCase(); // "BTC/USD" -> "BTC"
}

// R/R voor een positie, met het teken van de richting erin. Long: het risico ligt onder de entry
// (stop < entry) en de beloning erboven (doel > entry). Short: precies gespiegeld, het risico ligt
// boven de entry en de beloning eronder. Zonder de spiegelformule zou de long-berekening op een
// short altijd door de guard (openRate > stopLoss) vallen en stilzwijgend rr: 0 opleveren, ook als
// er wel degelijk geldige niveaus stonden.
function berekenRR(stopLoss: number, takeProfit: number, openRate: number, richting: Richting): number {
  if (stopLoss <= 0 || takeProfit <= 0) return 0;
  if (richting === 'short') {
    if (openRate >= stopLoss) return 0;
    return Math.round(((openRate - takeProfit) / (stopLoss - openRate)) * 10) / 10;
  }
  if (openRate <= stopLoss) return 0;
  return Math.round(((takeProfit - openRate) / (openRate - stopLoss)) * 10) / 10;
}

export function naarPortfolioTrade(positie: EtoroPositie, symbool: string, omgeving: EtoroOmgeving = 'real'): PortfolioTrade {
  // eToro levert koers en aantal in zijn eigen eenheid (SHIB en PEPE bijvoorbeeld per miljoen
  // munten); hier rekenen we ze terug naar Kaders eigen koers per coin, zie engine/etoroSymbolen.ts.
  // Voor elke andere coin is de factor 1 en verandert er niets.
  const factor = koersFactor(symbool);
  const openRate = positie.openRate / factor;
  const stopLoss = (positie.stopLossRate ?? 0) / factor;
  const takeProfit = (positie.takeProfitRate ?? 0) / factor;
  // Bewust `=== false` en niet de waarheidswaarde van isBuy: het veld is getypeerd als verplicht,
  // maar dat is een aanname over ongevalideerde JSON. Ontbreekt hij, dan is long de veilige uitkomst
  // (zelfde keuze als in de historie hieronder). Met een waarheidstest zou een ontbrekend veld een
  // stilzwijgende short opleveren, met omgekeerde winst, balk en trailing stop.
  const richting: Richting = positie.isBuy === false ? 'short' : 'long';
  const rr = berekenRR(stopLoss, takeProfit, openRate, richting);

  return {
    id: nieuweId(),
    symbool,
    naam: COIN_INFO[symbool]?.naam ?? symbool,
    entryPrijs: openRate,
    stopLoss,
    takeProfit,
    rr,
    datum: new Date(positie.openDateTime).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }),
    // Het ruwe tijdstip naast de opgemaakte datum: het resultaat over een periode moet kunnen zien
    // of deze positie er aan het begin van die periode al was, en dat is uit de tekst niet te halen.
    openTijd: Number.isNaN(Date.parse(positie.openDateTime)) ? undefined : Date.parse(positie.openDateTime),
    status: 'open',
    bedragUsd: positie.amount ?? positie.initialAmountInDollars ?? 0,
    aantalCoins: positie.units * factor,
    richting,
    etoroPositionID: positie.positionID,
    // Allebei nodig om deze positie later te kunnen sluiten: het sluit-endpoint wil naast het
    // positionID ook het instrumentID, en het positionID hoort bij precies één omgeving.
    etoroInstrumentID: positie.instrumentID,
    etoroOmgeving: omgeving,
    bron: 'etoro',
  };
}

export interface EtoroOvergeslagenPositie {
  naam: string;
  reden: 'geen-crypto';
}

export interface EtoroImportResultaat {
  trades: PortfolioTrade[];
  overgeslagen: EtoroOvergeslagenPositie[];
}

// Gedeeld door de portfolio- en de historie-import: welk symbool hoort bij dit instrument, en
// is het crypto? Alleen filteren op instrumentType als de herkenning is gelukt; anders (null)
// niet gokken (zie haalCryptoTypeIds).
function duidInstrument(
  instrumentID: number,
  instrumentKaart: Map<number, EtoroInstrument>,
  cryptoTypeIds: Set<number> | null,
): { symbool: string; naam: string; isCrypto: boolean } {
  const instrument = instrumentKaart.get(instrumentID);
  // eToro levert hier zijn eigen symbool (bijv. SHIBxM); vanEtoroSymbool zet dat terug naar Kaders
  // eigen naam, anders herkent ETORO_TRADABLE de coin niet en klopt de naam uit COIN_INFO niet meer.
  const symbool = vanEtoroSymbool(symboolVan(instrument));
  const naam = instrument?.instrumentDisplayName || symbool || `instrument ${instrumentID}`;
  const isCrypto = !cryptoTypeIds || (instrument?.instrumentTypeID !== undefined && cryptoTypeIds.has(instrument.instrumentTypeID))
    || ETORO_TRADABLE.has(symbool);
  return { symbool, naam, isCrypto };
}

function bouwOpenTrades(
  posities: EtoroPositie[],
  instrumentKaart: Map<number, EtoroInstrument>,
  cryptoTypeIds: Set<number> | null,
  omgeving: EtoroOmgeving,
): EtoroImportResultaat {
  const trades: PortfolioTrade[] = [];
  const overgeslagen: EtoroOvergeslagenPositie[] = [];

  for (const positie of posities) {
    const { symbool, naam, isCrypto } = duidInstrument(positie.instrumentID, instrumentKaart, cryptoTypeIds);

    if (!symbool || !isCrypto) { overgeslagen.push({ naam, reden: 'geen-crypto' }); continue; }
    trades.push(naarPortfolioTrade(positie, symbool, omgeving));
  }

  return { trades, overgeslagen };
}

// ---------- Gesloten posities (trade-historie) ----------

// Let op: deze endpoint levert `positionId` en `instrumentId` (kleine d), terwijl
// /trading/info/portfolio `positionID` en `instrumentID` gebruikt. We lezen beide varianten uit
// zodat een casing-wijziging aan eToro's kant ons niet stilzwijgend de historie kost.
interface EtoroHistorieRegel {
  positionId?: number;
  positionID?: number;
  instrumentId?: number;
  instrumentID?: number;
  isBuy?: boolean;
  openRate?: number;
  closeRate?: number;
  openTimestamp?: string;
  closeTimestamp?: string;
  netProfit?: number;
  units?: number;
  investment?: number;
  initialInvestment?: number;
  stopLossRate?: number;
  takeProfitRate?: number;
}

const positieIdVan = (r: EtoroHistorieRegel) => r.positionId ?? r.positionID;
const instrumentIdVan = (r: EtoroHistorieRegel) => r.instrumentId ?? r.instrumentID;

// ponytail: vast venster van 1 jaar en één pagina van 1000. PortfolioTrade.datum is een
// gelokaliseerde string ("15 jan 2026") en dus niet te parsen tot een scherpere ondergrens.
// Pagineer pas als iemand meer dan 1000 trades per jaar sluit.
const HISTORIE_VENSTER_MS = 365 * 24 * 60 * 60 * 1000;

async function haalHistorieRegels(sleutels: EtoroSleutels): Promise<EtoroHistorieRegel[]> {
  const minDate = new Date(Date.now() - HISTORIE_VENSTER_MS).toISOString().slice(0, 10);
  const data = await etoroFetch<EtoroHistorieRegel[] | { trades?: EtoroHistorieRegel[] }>(
    `/trading/info/trade/history?minDate=${minDate}&page=1&pageSize=1000`,
    sleutels,
  );
  return Array.isArray(data) ? data : (data.trades ?? []);
}

const nlDatum = (ms: number) =>
  new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

// netProfit is inclusief kosten en bepaalt daarom of het een winst of verlies was, niet de
// vergelijking van closeRate met openRate.
export function naarGeslotenTrade(regel: EtoroHistorieRegel, symbool: string, omgeving: EtoroOmgeving = 'real'): PortfolioTrade | null {
  const positionID = positieIdVan(regel);
  const slotTijd = regel.closeTimestamp ? Date.parse(regel.closeTimestamp) : NaN;
  const openTijd = regel.openTimestamp ? Date.parse(regel.openTimestamp) : NaN;
  if (typeof positionID !== 'number' || typeof regel.openRate !== 'number'
    || typeof regel.closeRate !== 'number' || isNaN(slotTijd)) return null;

  // Zelfde omrekening als naarPortfolioTrade hierboven: eToro's koers en aantal terug naar Kaders
  // eigen koers per coin.
  const factor = koersFactor(symbool);
  const openRate = regel.openRate / factor;
  const closeRate = regel.closeRate / factor;
  const stopLoss = (regel.stopLossRate ?? 0) / factor;
  const takeProfit = (regel.takeProfitRate ?? 0) / factor;
  // isBuy ontbreekt soms in de historie-respons; ontbreken betekent long, hetzelfde als vóór deze
  // versie toen shorts nog overgeslagen werden (zie ook bouwGeslotenTrades hieronder).
  const richting: Richting = regel.isBuy === false ? 'short' : 'long';
  const rr = berekenRR(stopLoss, takeProfit, openRate, richting);
  const netProfit = regel.netProfit ?? 0;

  return {
    id: nieuweId(),
    symbool,
    naam: COIN_INFO[symbool]?.naam ?? symbool,
    entryPrijs: openRate,
    stopLoss,
    takeProfit,
    rr,
    datum: nlDatum(isNaN(openTijd) ? slotTijd : openTijd),
    status: netProfit >= 0 ? 'gewonnen' : 'verloren',
    bedragUsd: regel.investment ?? regel.initialInvestment ?? 0,
    aantalCoins: typeof regel.units === 'number' ? regel.units * factor : regel.units,
    exitPrijs: closeRate,
    slotDatum: nlDatum(slotTijd),
    slotTijd,
    // Alleen bewaren als eToro het echt meestuurde. Een ontbrekende netProfit als 0 wegschrijven
    // zou het totaalresultaat vervuilen met nepwinsten van precies nul.
    resultaatUsd: typeof regel.netProfit === 'number' ? regel.netProfit : undefined,
    richting,
    etoroPositionID: positionID,
    etoroInstrumentID: instrumentIdVan(regel),
    etoroOmgeving: omgeving,
    bron: 'etoro',
  };
}

function bouwGeslotenTrades(
  regels: EtoroHistorieRegel[],
  instrumentKaart: Map<number, EtoroInstrument>,
  cryptoTypeIds: Set<number> | null,
  omgeving: EtoroOmgeving,
): EtoroImportResultaat {
  const trades: PortfolioTrade[] = [];
  const overgeslagen: EtoroOvergeslagenPositie[] = [];

  for (const regel of regels) {
    const instrumentID = instrumentIdVan(regel);
    if (instrumentID === undefined) continue;
    const { symbool, naam, isCrypto } = duidInstrument(instrumentID, instrumentKaart, cryptoTypeIds);

    if (!symbool || !isCrypto) { overgeslagen.push({ naam, reden: 'geen-crypto' }); continue; }
    const trade = naarGeslotenTrade(regel, symbool, omgeving);
    if (trade) trades.push(trade);
  }

  return { trades, overgeslagen };
}

export interface EtoroSyncResultaat {
  open: EtoroImportResultaat;       // wat er nu open staat op eToro
  historie: EtoroImportResultaat;   // wat er het afgelopen jaar is gesloten
  // clientPortfolio.credit min wat er vastzit in wachtende orders, of null als eToro `credit` niet
  // meestuurt. Nooit 0 invullen: een verzonnen saldo is erger dan geen saldo, want er wordt een
  // totaal vermogen op gebaseerd.
  vrijSaldoUsd: number | null;
  // Het kale clientPortfolio.credit, zodat PortfolioProvider het besteedbare bedrag opnieuw kan
  // uitrekenen over de orders die na isAfgerond nog in beeld blijven.
  creditUsd: number | null;
  // Wat er vastzit in orders die nog niet gevuld zijn, en hoeveel dat er zijn. Zie bepaalSaldoStand.
  gereserveerdUsd: number | null;
  wachtendeOrders: number;
  // Diezelfde orders een voor een, nieuwste eerst. Ook orders op aandelen en andere niet-crypto:
  // het geld dat daarin vastzit is net zo goed weg uit het besteedbare saldo.
  wachtendeOrderLijst: WachtendeOrder[];
}

// Een order zonder tijd achteraan: die is niet te plaatsen, en bovenaan zou hij doen alsof hij net
// geplaatst is.
function bouwWachtendeOrders(
  ruw: WachtendeOrderRuw[],
  instrumentKaart: Map<number, EtoroInstrument>,
  cryptoTypeIds: Set<number> | null,
  omgeving: EtoroOmgeving,
): WachtendeOrder[] {
  return ruw
    .map(order => {
      const { symbool, naam } = order.instrumentId === null
        ? { symbool: '', naam: 'onbekend instrument' }
        : duidInstrument(order.instrumentId, instrumentKaart, cryptoTypeIds);
      const uiteindelijkSymbool = symbool || naam;
      // limietKoers, stopLoss en takeProfit komen nog in eToro's eenheid binnen (zelfde omrekening
      // als bij naarPortfolioTrade hierboven); bedragUsd is dollars en blijft ongemoeid.
      const factor = koersFactor(uiteindelijkSymbool);
      return {
        ...order,
        symbool: uiteindelijkSymbool,
        naam,
        omgeving,
        limietKoers: order.limietKoers !== null ? order.limietKoers / factor : null,
        stopLoss: order.stopLoss !== null ? order.stopLoss / factor : null,
        takeProfit: order.takeProfit !== null ? order.takeProfit / factor : null,
      };
    })
    .sort((a, b) => (b.openTijd ?? 0) - (a.openTijd ?? 0));
}

// Eenmalig per app-start, alleen in een dev-build: de ruwe orderlijsten plus de orderID per positie.
// Open punt (TODO.md): in welke lijst blijft een gevulde marktorder met SL/TP staan, en draagt de
// positie dan hetzelfde orderID? Pas met een echte respons weten we of de koppeling hierboven werkt.
let orderlijstenGelogd = false;
function logOrderlijstenEenmalig(portfolio: EtoroPortfolioRespons): void {
  if (orderlijstenGelogd || typeof __DEV__ === 'undefined' || !__DEV__) return;
  orderlijstenGelogd = true;
  const cp = (portfolio.clientPortfolio ?? {}) as Record<string, unknown>;
  const lijsten = Object.fromEntries(Object.entries(cp).filter(([sleutel, waarde]) => Array.isArray(waarde) && sleutel !== 'positions'));
  const posities = (portfolio.clientPortfolio?.positions ?? []).map(p => {
    const { positionID, instrumentID, orderID, orderId, openDateTime } = p ?? {} as EtoroPositie;
    return { positionID, instrumentID, orderID, orderId, openDateTime };
  });
  console.log('[Kader] eToro orderlijsten (eenmalig):', JSON.stringify({ lijsten, posities }, null, 2));
}

// Open posities en gesloten historie in één keer. Bewust één functie en niet twee losse imports:
// beide hebben dezelfde instrument- en instrumenttype-lookups nodig, en die endpoints delen een
// quotum van 60 requests per 60 seconden. Los aanroepen deed elke sync die twee calls dubbel.
export async function importeerEtoroAlles(sleutels: EtoroSleutels): Promise<EtoroSyncResultaat> {
  const [portfolio, regels] = await Promise.all([
    haalEtoroPortfolio(sleutels),
    haalHistorieRegels(sleutels),
  ]);
  const posities = portfolio.clientPortfolio?.positions ?? [];
  const orders = leesWachtendeOrders(portfolio);
  logOrderlijstenEenmalig(portfolio);

  // De orders gaan mee in dezelfde instrument-lookup: geen extra request op het gedeelde quotum.
  const ids = [...new Set([
    ...posities.map(p => p.instrumentID),
    ...regels.map(instrumentIdVan).filter((id): id is number => typeof id === 'number'),
    ...orders.map(o => o.instrumentId).filter((id): id is number => id !== null),
  ])];
  const [instrumentKaart, cryptoTypeIds] = await Promise.all([
    haalInstrumenten(ids, sleutels),
    haalCryptoTypeIds(sleutels),
  ]);

  // De omgeving van de sleutels waarmee we net opgehaald hebben, zodat elke geïmporteerde trade
  // weet waar hij vandaan komt. Zonder dat veld kun je een demo-positie niet onderscheiden van een
  // echte, en zou de verkoopknop een demo-ID naar het echte endpoint kunnen sturen.
  const omgeving = sleutels.omgeving ?? 'real';

  // Het saldo komt uit dezelfde portfolio-respons die we hierboven al hebben. haalSaldoStand()
  // zou hem opnieuw ophalen, en dat is een extra request per sync op een endpoint met een quotum
  // van 60 per minuut. Die functie blijft bestaan voor KooporderSheet, die geen sync doet.
  const saldo = bepaalSaldoStand(portfolio);

  return {
    open: bouwOpenTrades(posities, instrumentKaart, cryptoTypeIds, omgeving),
    historie: bouwGeslotenTrades(regels, instrumentKaart, cryptoTypeIds, omgeving),
    vrijSaldoUsd: saldo.besteedbaarUsd,
    creditUsd: saldo.creditUsd,
    gereserveerdUsd: saldo.gereserveerdUsd,
    wachtendeOrders: saldo.wachtendeOrders,
    wachtendeOrderLijst: bouwWachtendeOrders(orders, instrumentKaart, cryptoTypeIds, omgeving),
  };
}

// ponytail: self-check ipv testframework, run met `npx ts-node app/src/engine/etoro.ts`
if (require.main === module) {
  // console.assert gooit niet in Node en zet de exitcode niet, dus zonder deze wrapper zou dit
  // bestand "geslaagd" printen terwijl bijvoorbeeld demoPad stuk is. De poort uit het plan moet
  // echt een poort zijn.
  let missers = 0;
  const origineleAssert = console.assert.bind(console);
  console.assert = ((voorwaarde?: boolean, ...rest: unknown[]) => {
    if (!voorwaarde) missers++;
    origineleAssert(voorwaarde, ...rest);
  }) as typeof console.assert;

  const mock: EtoroPositie = {
    positionID: 123, instrumentID: 1, isBuy: true, amount: 500, units: 0.01,
    openRate: 50000, openDateTime: '2026-01-15T10:00:00Z', stopLossRate: 45000, takeProfitRate: 65000,
  };
  const trade = naarPortfolioTrade(mock, 'BTC');
  console.assert(trade.symbool === 'BTC', 'symbool moet BTC zijn');
  console.assert(trade.entryPrijs === 50000, 'entry moet 50000 zijn');
  console.assert(trade.stopLoss === 45000 && trade.takeProfit === 65000, 'SL/TP moeten overgenomen worden');
  console.assert(trade.rr === 3, `RR moet 3 zijn ((65000-50000)/(50000-45000)), was ${trade.rr}`);
  console.assert(trade.etoroPositionID === 123, 'positionID moet bewaard blijven');
  console.assert(trade.bron === 'etoro', 'bron moet etoro zijn');
  console.assert(trade.richting === 'long', 'isBuy true moet long worden');

  const geenSlTp = naarPortfolioTrade({ ...mock, stopLossRate: undefined, takeProfitRate: undefined }, 'BTC');
  console.assert(geenSlTp.stopLoss === 0 && geenSlTp.takeProfit === 0, 'ontbrekende SL/TP moet 0 worden');
  console.assert(geenSlTp.rr === 0, 'RR zonder SL/TP moet 0 zijn');

  // Short: stop boven de entry, doel eronder. isBuy false betekent short, en de gespiegelde
  // formule moet nog steeds een positieve R/R van 3 geven, niet 0 door de long-guard.
  const shortMock: EtoroPositie = {
    positionID: 456, instrumentID: 1, isBuy: false, amount: 500, units: 0.01,
    openRate: 50000, openDateTime: '2026-01-15T10:00:00Z', stopLossRate: 55000, takeProfitRate: 35000,
  };
  const shortTrade = naarPortfolioTrade(shortMock, 'BTC');
  console.assert(shortTrade.richting === 'short', 'isBuy false moet short worden');
  console.assert(shortTrade.rr === 3, `short RR moet 3 zijn ((50000-35000)/(55000-50000)), was ${shortTrade.rr}`);

  // eToro voert SHIB per miljoen munten: een positie met instrumentID 100080 (SHIBxM), openRate 5.6
  // en stopLossRate 5.0 moet terugkomen als Kaders eigen koers per coin.
  const shibPositie: EtoroPositie = {
    positionID: 999, instrumentID: 100080, isBuy: true, amount: 56, units: 10,
    openRate: 5.6, openDateTime: '2026-01-15T10:00:00Z', stopLossRate: 5.0,
  };
  const shibTrade = naarPortfolioTrade(shibPositie, 'SHIB');
  console.assert(Math.abs(shibTrade.entryPrijs - 0.0000056) < 1e-12, `SHIB-entry moet ~0,0000056 zijn, was ${shibTrade.entryPrijs}`);
  console.assert(shibTrade.aantalCoins === 10_000_000, `SHIB-aantal moet 10 miljoen zijn, was ${shibTrade.aantalCoins}`);
  console.assert(Math.abs(shibTrade.stopLoss - 0.000005) < 1e-12, `SHIB-stop moet ~0,000005 zijn, was ${shibTrade.stopLoss}`);
  console.assert(shibTrade.bedragUsd === 56, 'bedragUsd blijft in dollars, geen omrekening');

  // Historie: gesloten trade uit een ruwe historie-regel.
  const ruw = {
    positionId: 123, instrumentId: 1, isBuy: true, openRate: 50000, closeRate: 65000,
    openTimestamp: '2026-01-15T10:00:00Z', closeTimestamp: '2026-02-01T12:00:00Z',
    netProfit: 150, units: 0.01, investment: 500, stopLossRate: 45000, takeProfitRate: 65000,
  };
  const gesloten = naarGeslotenTrade(ruw, 'BTC');
  console.assert(gesloten?.etoroPositionID === 123, 'positionId (kleine d) moet gelezen worden');
  console.assert(gesloten?.entryPrijs === 50000 && gesloten?.exitPrijs === 65000, 'openRate/closeRate moeten entry/exit worden');
  console.assert(gesloten?.slotTijd === Date.parse('2026-02-01T12:00:00Z'), 'closeTimestamp moet epoch ms worden');
  console.assert(gesloten?.status === 'gewonnen', 'positieve netProfit is gewonnen');
  console.assert(gesloten?.rr === 3, `RR moet 3 zijn, was ${gesloten?.rr}`);
  console.assert(gesloten?.aantalCoins === 0.01 && gesloten?.bedragUsd === 500, 'units/investment moeten overgenomen worden');
  console.assert(gesloten?.bron === 'etoro', 'bron moet etoro zijn');
  console.assert(gesloten?.resultaatUsd === 150, `netProfit moet als resultaatUsd bewaard blijven, was ${gesloten?.resultaatUsd}`);
  console.assert(gesloten?.richting === 'long', 'isBuy true in de historie moet long worden');

  // Dezelfde omrekening in de historie: een gesloten SHIB-trade (SHIBxM) moet ook terugkomen in
  // Kaders eigen koers per coin.
  const shibRuw = {
    positionId: 111, instrumentId: 100080, isBuy: true, openRate: 5.6, closeRate: 6.72,
    openTimestamp: '2026-01-15T10:00:00Z', closeTimestamp: '2026-02-01T12:00:00Z',
    netProfit: 11.2, units: 10, investment: 56, stopLossRate: 5.0, takeProfitRate: 8.4,
  };
  const shibGesloten = naarGeslotenTrade(shibRuw, 'SHIB');
  console.assert(Math.abs((shibGesloten?.entryPrijs ?? 0) - 0.0000056) < 1e-12, `SHIB-historie-entry moet ~0,0000056 zijn, was ${shibGesloten?.entryPrijs}`);
  console.assert(Math.abs((shibGesloten?.exitPrijs ?? 0) - 0.00000672) < 1e-12, `SHIB-historie-exit moet ~0,00000672 zijn, was ${shibGesloten?.exitPrijs}`);
  console.assert(shibGesloten?.aantalCoins === 10_000_000, `SHIB-historie-aantal moet 10 miljoen zijn, was ${shibGesloten?.aantalCoins}`);
  console.assert(shibGesloten?.resultaatUsd === 11.2, 'resultaatUsd blijft in dollars, geen omrekening');

  // isBuy ontbreekt in deze regel (zoals bij een deel van de echte historie-respons): dat moet
  // hetzelfde long-gedrag geven als isBuy: true, niet stilzwijgend als short gelezen worden.
  const zonderIsBuy = naarGeslotenTrade({ ...ruw, isBuy: undefined }, 'BTC');
  console.assert(zonderIsBuy?.richting === 'long', 'ontbrekende isBuy moet standaard long zijn');

  // Short in de historie: stop boven de entry, doel eronder, RR gespiegeld.
  const shortRuw = {
    positionId: 789, instrumentId: 1, isBuy: false, openRate: 50000, closeRate: 35000,
    openTimestamp: '2026-01-15T10:00:00Z', closeTimestamp: '2026-02-01T12:00:00Z',
    netProfit: 300, units: 0.01, investment: 500, stopLossRate: 55000, takeProfitRate: 35000,
  };
  const shortGesloten = naarGeslotenTrade(shortRuw, 'BTC');
  console.assert(shortGesloten?.richting === 'short', 'isBuy false in de historie moet short worden');
  console.assert(shortGesloten?.rr === 3, `short RR in de historie moet 3 zijn, was ${shortGesloten?.rr}`);

  // netProfit wint van de prijsvergelijking: exit boven entry, maar door kosten toch verlies.
  const kostenVerlies = naarGeslotenTrade({ ...ruw, netProfit: -2 }, 'BTC');
  console.assert(kostenVerlies?.status === 'verloren', 'negatieve netProfit is verloren, ook als closeRate > openRate');
  console.assert(kostenVerlies?.resultaatUsd === -2, 'het netto verlies moet bewaard blijven, niet alleen het teken');

  // Ontbrekende netProfit blijft undefined, wordt geen nul: anders telt een onbekend resultaat
  // als "precies break-even" mee in het totaal.
  const zonderNetProfit = naarGeslotenTrade({ ...ruw, netProfit: undefined }, 'BTC');
  console.assert(zonderNetProfit?.resultaatUsd === undefined, 'ontbrekende netProfit mag geen 0 worden');

  // Oude casing (positionID/instrumentID) moet ook werken.
  const oudeCasing = naarGeslotenTrade(
    { positionID: 9, instrumentID: 1, openRate: 100, closeRate: 90, closeTimestamp: '2026-02-01T12:00:00Z', netProfit: -5 },
    'ETH',
  );
  console.assert(oudeCasing?.etoroPositionID === 9, 'positionID (hoofdletter D) moet ook gelezen worden');
  console.assert(oudeCasing?.status === 'verloren', 'negatieve netProfit is verloren');
  console.assert(oudeCasing?.rr === 0, 'RR zonder SL/TP moet 0 zijn');
  console.assert(oudeCasing?.datum === oudeCasing?.slotDatum, 'zonder openTimestamp valt datum terug op de slotdatum');

  console.assert(naarGeslotenTrade({ ...ruw, positionId: undefined }, 'BTC') === null, 'regel zonder positionId is onbruikbaar');
  console.assert(naarGeslotenTrade({ ...ruw, closeRate: undefined }, 'BTC') === null, 'regel zonder closeRate is onbruikbaar');
  console.assert(naarGeslotenTrade({ ...ruw, openRate: undefined }, 'BTC') === null, 'regel zonder openRate is onbruikbaar');
  console.assert(naarGeslotenTrade({ ...ruw, closeTimestamp: 'onzin' }, 'BTC') === null, 'onparseerbare closeTimestamp is onbruikbaar');

  // ---------- Demo-paden ----------
  // Het gevaar is niet dat een demo-pad ontbreekt, maar dat een onbekend pad stilzwijgend naar het
  // echte account gaat. Dus: elk bekend pad mapt, en al het andere gooit.
  console.assert(demoPad('/trading/execution/orders') === '/trading/execution/demo/orders', 'orders moet het demo-segment krijgen');
  console.assert(demoPad('/trading/info/portfolio') === '/trading/info/demo/portfolio', 'portfolio moet het demo-segment krijgen');
  console.assert(demoPad('/trading/info/trade/history?minDate=2026-01-01&page=1') === '/trading/info/trade/demo/history?minDate=2026-01-01&page=1',
    'de querystring moet intact achter het demo-pad blijven staan, en /demo/ zit hier tussen trade en history');
  console.assert(demoPad('/trading/info/eligibility') === '/trading/info/demo/eligibility', 'eligibility heeft een eigen demo-pad');
  console.assert(demoPad('/trading/execution/market-close-orders/positions/123') === '/trading/execution/demo/market-close-orders/positions/123',
    'het positionID moet achter het demo-segment blijven staan');
  console.assert(demoPad('/market-data/instruments?instrumentIds=1,2') === '/market-data/instruments?instrumentIds=1,2', 'market-data is niet accountgebonden');
  console.assert(demoPad('/me') === '/me', '/me werkt in beide omgevingen');

  console.assert(demoPad('/trading/positions/3576802030') === '/trading/demo/positions/3576802030',
    'het demo-segment van een positie-wijziging zit achter trading, niet achter positions');

  const gooit = (pad: string) => { try { demoPad(pad); return false; } catch { return true; } };
  console.assert(gooit('/trading/execution/close-orders/1'), 'een onbekend schrijfpad moet gooien, niet naar het echte account gaan');
  console.assert(gooit('/verzonnen/pad'), 'een onbekend pad moet gooien');
  console.assert(gooit('/messages'), 'een pad dat toevallig met /me begint mag niet op de /me-regel vallen');
  console.assert(gooit('/trading/info/portfolio-extra'), 'een treffer moet op een padgrens eindigen');
  console.assert(demoPad('/me?veld=1') === '/me?veld=1', 'een querystring direct achter een exacte treffer blijft goed');

  // ---------- Statusduiding ----------
  console.assert(duidOrderStatus(200) === 'ok' && duidOrderStatus(201) === 'ok' && duidOrderStatus(202) === 'ok', '2xx is uitgevoerd');
  console.assert(duidOrderStatus(400) === 'fout', '400 is afgewezen door eToro, dus zeker niet uitgevoerd');
  console.assert(duidOrderStatus(422) === 'fout', '422 is afgewezen');
  console.assert(duidOrderStatus(429) === 'fout', '429 is afgewezen, niet onbekend: eToro heeft de order niet aangenomen');
  console.assert(duidOrderStatus(500) === 'onbekend', '500 kan uitgevoerd zijn');
  console.assert(duidOrderStatus(502) === 'onbekend', '502 kan uitgevoerd zijn');

  // ---------- Scopes ----------
  // Letterlijk de scopes uit een echte /api/v1/me-respons, ingekort tot wat hier telt.
  const echteScopes = [
    'etoro-public:agent-portfolio:write', 'etoro-public:crypto:write', 'etoro-public:market-data:read',
    'etoro-public:trade.demo:read', 'etoro-public:trade.demo:write',
    'etoro-public:trade.real:read', 'etoro-public:trade.real:write',
  ];
  console.assert(magHandelenVolgensScopes(echteScopes, 'demo') === true, 'trade.demo:write ontgrendelt handelen in demo');
  console.assert(magHandelenVolgensScopes(echteScopes, 'real') === true, 'trade.real:write ontgrendelt handelen in echt');

  // De omgevingen staan los van elkaar: alleen demo mogen handelen betekent niet echt mogen handelen.
  const alleenDemo = ['etoro-public:trade.demo:write', 'etoro-public:trade.real:read'];
  console.assert(magHandelenVolgensScopes(alleenDemo, 'demo') === true, 'demo mag handelen');
  console.assert(magHandelenVolgensScopes(alleenDemo, 'real') === false, 'een leesscope op echt ontgrendelt daar niets');

  // Het geval waar de oude woordherkenning op stukging: schrijfrecht dat niets met handelen te maken heeft.
  console.assert(magHandelenVolgensScopes(['etoro-public:agent-portfolio:write'], 'demo') === false,
    'een schrijfscope buiten handelen mag de koopknop niet ontgrendelen');
  console.assert(magHandelenVolgensScopes(['etoro-public:trade.demo:read'], 'demo') === false, 'alleen lezen is niet handelen');
  console.assert(magHandelenVolgensScopes([], 'demo') === false, 'geen scopes is niet handelen');
  console.assert(magHandelenVolgensScopes(undefined, 'demo') === false, 'een ontbrekend scopes-veld is niet handelen');

  // ---------- Orderbody ----------
  // Deze body is letterlijk de body die eToro op 2026-08-06 met een 200 accepteerde.
  const koopBody = bouwKooporderBody({ instrumentId: 100000, bedragUsd: 10, stopLossRate: 51592.8, takeProfitRate: 83838.3 });
  console.assert(koopBody.action === 'open' && koopBody.transaction === 'buy', 'een koop is action open, transaction buy');
  console.assert(koopBody.orderType === 'mkt' && koopBody.leverage === 1, 'marktorder zonder hefboom');
  console.assert(koopBody.amount === 10 && koopBody.orderCurrency === 'usd', 'bedrag in dollars');
  console.assert(koopBody.stopLossRate === 51592.8 && koopBody.stopLossType === 'fixed', 'de stop gaat als absolute koers mee');
  console.assert(koopBody.takeProfitRate === 83838.3, 'het doel gaat als absolute koers mee');
  console.assert(!('settlementType' in koopBody), 'settlementType wordt bewust weggelaten, eToro kiest zelf');

  // Zonder stop mag het veld er niet als 0 of null in staan: dat zou eToro als een echte stop op
  // nul lezen. Weglaten betekent "geen stop meesturen".
  const zonderStop = bouwKooporderBody({ instrumentId: 100000, bedragUsd: 10 });
  console.assert(!('stopLossRate' in zonderStop), 'een lege stop wordt weggelaten, niet als 0 verstuurd');
  console.assert(!('stopLossType' in zonderStop), 'zonder stop ook geen stopLossType');
  console.assert(!('takeProfitRate' in zonderStop), 'een leeg doel wordt weggelaten');
  const nulStop = bouwKooporderBody({ instrumentId: 100000, bedragUsd: 10, stopLossRate: 0, takeProfitRate: NaN });
  console.assert(!('stopLossRate' in nulStop) && !('takeProfitRate' in nulStop), 'een stop van 0 of NaN telt als geen niveau');

  // Drijvendekommaruis mag niet meegestuurd worden.
  const ruis = bouwKooporderBody({ instrumentId: 1, bedragUsd: 0.1 + 0.2, stopLossRate: 51592.800000000003 });
  console.assert(ruis.amount === 0.3, `bedrag moet afgerond worden, was ${ruis.amount}`);
  console.assert(ruis.stopLossRate === 51592.8, `stop moet afgerond worden, was ${ruis.stopLossRate}`);

  // eToro voert SHIB per miljoen munten (SHIBxM): Kaders koers van 0,0000054 moet als 5.4 de deur
  // uitgaan, niet als 0,0000054.
  const shibBody = bouwKooporderBody({
    instrumentId: 100080, bedragUsd: 10, stopLossRate: 0.0000054, takeProfitRate: 0.0000081, koersFactor: 1_000_000,
  });
  console.assert(Math.abs((shibBody.stopLossRate as number) - 5.4) < 1e-9, `SHIB-stop moet 5.4 zijn, was ${shibBody.stopLossRate}`);
  console.assert(Math.abs((shibBody.takeProfitRate as number) - 8.1) < 1e-9, `SHIB-doel moet 8.1 zijn, was ${shibBody.takeProfitRate}`);

  // Zonder koersFactor, en met koersFactor 1, blijft de body exact zoals voorheen: bestaande
  // aanroepen mogen niet veranderen door dit nieuwe, optionele veld.
  console.assert(
    JSON.stringify(bouwKooporderBody({ instrumentId: 100000, bedragUsd: 10, stopLossRate: 51592.8, takeProfitRate: 83838.3, koersFactor: 1 }))
      === JSON.stringify(koopBody),
    'koersFactor 1 mag de body niet veranderen, dat is per definitie geen omrekening');

  // ---------- Niveaubody ----------
  const alleenStop = bouwNiveauBody({ stopLossRate: 54000 });
  console.assert(alleenStop.stopLossRate === 54000 && !('takeProfitRate' in alleenStop),
    'een veld dat je niet wijzigt blijft weg, zodat eToro het ongemoeid laat');
  const wissen = bouwNiveauBody({ clearStopLoss: true, stopLossRate: 54000 });
  console.assert(wissen.clearStopLoss === true && !('stopLossRate' in wissen), 'wissen wint van een meegegeven niveau');

  // Zelfde omrekening bij het wijzigen van niveaus.
  const shibNiveau = bouwNiveauBody({ stopLossRate: 0.0000054, takeProfitRate: 0.0000081, koersFactor: 1_000_000 });
  console.assert(Math.abs((shibNiveau.stopLossRate as number) - 5.4) < 1e-9, `SHIB-niveauwijziging stop moet 5.4 zijn, was ${shibNiveau.stopLossRate}`);
  console.assert(Math.abs((shibNiveau.takeProfitRate as number) - 8.1) < 1e-9, `SHIB-niveauwijziging doel moet 8.1 zijn, was ${shibNiveau.takeProfitRate}`);
  console.assert(Object.keys(bouwNiveauBody({})).length === 0, 'een lege wijziging levert een lege body');

  // ---------- Foutduiding ----------
  const vid = 'verzoek-1';
  console.assert(duidFout(new EtoroFout('weg', null, true), vid).soort === 'onbekend', 'een afgebroken verzoek is onbekend, niet mislukt');
  console.assert(duidFout(new EtoroFout('netwerk', null), vid).soort === 'onbekend', 'zonder antwoord weten we het niet');
  console.assert(duidFout(new EtoroFout('afgewezen', 400), vid).soort === 'fout', 'een 400 is afgewezen');
  console.assert(duidFout(new EtoroFout('quotum', 429), vid).soort === 'fout', 'een 429 is afgewezen, dus zeker niet uitgevoerd');
  console.assert(duidFout(new EtoroFout('stuk', 503), vid).soort === 'onbekend', 'een 5xx kan alsnog uitgevoerd zijn');
  const onbekend = duidFout(new EtoroFout('x', null), vid);
  console.assert(onbekend.soort === 'onbekend' && onbekend.verzoekId === vid, 'de verzoek-id moet mee, anders kun je niet verzoenen');

  // Een fout uit onze eigen code (demoPad die gooit) betekent dat er niets verstuurd is. Dat is
  // 'fout', niet 'onbekend': anders gaat de app verzoenen voor een order die nooit bestond.
  console.assert(duidFout(new Error('Geen demo-pad bekend voor /iets'), vid).soort === 'fout',
    'een gewone Error komt uit onze eigen code en betekent dat er niets verstuurd is');

  // ---------- Saldo met wachtende orders ----------
  // De aanleiding: een wachtende kooporder op een aandeel (beurs dicht) hield $400 vast, maar
  // eToro's `credit` telde dat gewoon mee. Kader toonde dus $1000 te besteden terwijl er $600 was,
  // en de order die je daarop baseerde werd geweigerd.
  const metOrder = bepaalSaldoStand({ clientPortfolio: { credit: 1000, orders: [{ amount: 400 }] } });
  console.assert(metOrder.besteedbaarUsd === 600, `1000 min 400 gereserveerd is 600, was ${metOrder.besteedbaarUsd}`);
  console.assert(metOrder.creditUsd === 1000, 'het kale saldo blijft leesbaar voor de uitleg');
  console.assert(metOrder.gereserveerdUsd === 400 && metOrder.wachtendeOrders === 1, 'gereserveerd bedrag en aantal moeten kloppen');

  // Zonder orderlijst verandert er niets aan het gedrag van voor deze versie.
  const zonderLijst = bepaalSaldoStand({ clientPortfolio: { credit: 1000 } });
  console.assert(zonderLijst.besteedbaarUsd === 1000, 'zonder orderlijst blijft het kale saldo staan');
  console.assert(zonderLijst.gereserveerdUsd === 0 && zonderLijst.wachtendeOrders === 0, 'zonder orderlijst is er niets gereserveerd');

  // Een lege orderlijst is iets anders dan geen lijst, maar het antwoord is hetzelfde.
  console.assert(bepaalSaldoStand({ clientPortfolio: { credit: 50, orders: [] } }).besteedbaarUsd === 50,
    'een lege orderlijst reserveert niets');

  // De drie mogelijke veldnamen voor hetzelfde bedrag, en de eerste die een getal is wint.
  const anderVeld = bepaalSaldoStand({ clientPortfolio: { credit: 100, entryOrders: [{ investmentAmount: 25 }] } });
  console.assert(anderVeld.besteedbaarUsd === 75, `entryOrders telt ook mee, was ${anderVeld.besteedbaarUsd}`);

  // Eén order zonder leesbaar bedrag maakt de optelling onbetrouwbaar: dan niets aftrekken en het
  // gereserveerde bedrag als onbekend melden, in plaats van er stilzwijgend nul van te maken.
  const onleesbaar = bepaalSaldoStand({ clientPortfolio: { credit: 100, orders: [{ amount: 20 }, {}] } });
  console.assert(onleesbaar.besteedbaarUsd === 100, 'bij een onleesbare order wordt er niets afgetrokken');
  console.assert(onleesbaar.gereserveerdUsd === null, 'een onleesbaar bedrag is null, geen 0');
  console.assert(onleesbaar.wachtendeOrders === 2, 'het aantal wachtende orders is wel bekend');

  // Meer gereserveerd dan er staat mag geen negatief bedrag opleveren.
  console.assert(bepaalSaldoStand({ clientPortfolio: { credit: 10, orders: [{ amount: 50 }] } }).besteedbaarUsd === 0,
    'meer gereserveerd dan saldo geeft 0, geen negatief bedrag');

  // Geen credit betekent geen betaalbaarheidscontrole, ook niet met orders erbij.
  const geenCredit = bepaalSaldoStand({ clientPortfolio: { orders: [{ amount: 50 }] } });
  console.assert(geenCredit.besteedbaarUsd === null && geenCredit.creditUsd === null,
    'zonder credit blijft het saldo onbekend');
  console.assert(bepaalSaldoStand({}).besteedbaarUsd === null, 'een lege respons geeft geen saldo');

  // ---------- Symbool naar instrument ----------
  // De aanleiding: PEPE stond met een eToro-merkje op de kaart, maar de koopsheet meldde dat Kader
  // de coin niet aan een instrument kon koppelen.
  const pepe: ZoekTreffer = { internalSymbolFull: 'PEPE', instrumentId: 123, internalAssetClassName: 'crypto' };
  console.assert(kiesInstrumentTreffer([pepe], 'PEPE') === 123, 'een enkele bruikbare treffer is het antwoord');
  console.assert(kiesInstrumentTreffer([pepe], 'pepe') === 123, 'kleine letters horen ook te werken');

  // Crosses en futures dragen een ander internalSymbolFull en tellen dus niet mee.
  const crosses: ZoekTreffer[] = [
    { internalSymbolFull: 'PEPEEUR', instrumentId: 900, isBuyEnabled: false },
    { internalSymbolFull: 'PEPE.DEC29', instrumentId: 901 },
    pepe,
  ];
  console.assert(kiesInstrumentTreffer(crosses, 'PEPE') === 123, 'alleen de exacte match telt');

  // Dit is de regel die eerder omgekeerd stond: een tweede regel met hetzelfde symbool die
  // delisted, niet koopbaar of geen crypto is, mag de echte niet meeslepen.
  console.assert(
    kiesInstrumentTreffer([{ internalSymbolFull: 'PEPE', instrumentId: 5, isDelisted: true }, pepe], 'PEPE') === 123,
    'een delisted dubbele regel mag de levende niet blokkeren');
  console.assert(
    kiesInstrumentTreffer([{ internalSymbolFull: 'PEPE', instrumentId: 5, isBuyEnabled: false }, pepe], 'PEPE') === 123,
    'een niet-koopbare dubbele regel mag de koopbare niet blokkeren');
  console.assert(
    kiesInstrumentTreffer([{ internalSymbolFull: 'FLOW', instrumentId: 100500, isBuyEnabled: true, isInternalInstrument: true }], 'FLOW') === null,
    'een alleen-bekijken coin (isInternalInstrument) krijgt geen instrumentId, ook met isBuyEnabled true');
  console.assert(
    kiesInstrumentTreffer([{ internalSymbolFull: 'PEPE', instrumentId: 5, internalAssetClassName: 'stocks' }, pepe], 'PEPE') === 123,
    'een aandeel met hetzelfde symbool mag de crypto niet blokkeren');

  // En de kant waar het fail-closed moet blijven: twee bruikbare kandidaten is twijfel.
  console.assert(
    kiesInstrumentTreffer([pepe, { internalSymbolFull: 'PEPE', instrumentId: 456, internalAssetClassName: 'crypto' }], 'PEPE') === null,
    'twee bruikbare kandidaten geeft null, want dan weten we het niet');
  console.assert(kiesInstrumentTreffer([], 'PEPE') === null, 'geen treffers geeft null');
  console.assert(kiesInstrumentTreffer([{ internalSymbolFull: 'PEPE' }], 'PEPE') === null, 'een treffer zonder id is onbruikbaar');
  console.assert(kiesInstrumentTreffer([{ internalSymbolFull: 'PEPE', instrumentId: 0 }], 'PEPE') === null, 'id 0 is geen id');
  // Zonder assetclass niet afkeuren: eToro stuurt dat veld niet altijd mee.
  console.assert(kiesInstrumentTreffer([{ internalSymbolFull: 'PEPE', instrumentId: 7 }], 'PEPE') === 7,
    'een ontbrekende assetclass is geen bewijs dat het geen crypto is');
  // internalInstrumentId is de tweede naam voor hetzelfde veld.
  console.assert(kiesInstrumentTreffer([{ internalSymbolFull: 'PEPE', internalInstrumentId: 42 }], 'PEPE') === 42,
    'internalInstrumentId telt ook als id');

  // eToro voert SHIB onder een ander symbool (SHIBxM, per miljoen munten). zoekInstrumentId zoekt
  // dus op naarEtoroSymbool('SHIB') in plaats van op 'SHIB' zelf, en die treffer moet gekozen worden.
  const shibxm: ZoekTreffer = { internalSymbolFull: 'SHIBxM', instrumentId: 100080, internalAssetClassName: 'Crypto' };
  console.assert(kiesInstrumentTreffer([shibxm], naarEtoroSymbool('SHIB')) === 100080,
    'de SHIBxM-treffer moet gekozen worden als er op het eToro-symbool gezocht wordt');

  // ---------- Omgeving op geimporteerde trades ----------
  const demoTrade = naarPortfolioTrade(mock, 'BTC', 'demo');
  console.assert(demoTrade.etoroOmgeving === 'demo', 'een demo-positie moet als demo gemerkt worden');
  console.assert(demoTrade.etoroInstrumentID === 1, 'het instrumentID moet mee, anders kun je niet sluiten');
  console.assert(naarPortfolioTrade(mock, 'BTC').etoroOmgeving === 'real', 'zonder opgave is het een echte positie');

  // ---------- Wachtende orders: saldo ----------
  // De bug: `orders: []` (geen limietorders) is ook een array, dus de oude find() stopte daar en
  // de marktorder in ordersForOpen, precies het geld dat vastzat, telde niet mee.
  {
    const leegPlusMarkt = bepaalSaldoStand({ clientPortfolio: { credit: 100, orders: [], ordersForOpen: [{ amount: 40 }] } });
    console.assert(leegPlusMarkt.besteedbaarUsd === 60, `een lege orders mag ordersForOpen niet verbergen, was ${leegPlusMarkt.besteedbaarUsd}`);
    console.assert(leegPlusMarkt.wachtendeOrders === 1, 'de marktorder telt als wachtende order');

    const beide = bepaalSaldoStand({ clientPortfolio: { credit: 100, orders: [{ amount: 10 }], ordersForOpen: [{ amount: 40 }] } });
    console.assert(beide.gereserveerdUsd === 50 && beide.besteedbaarUsd === 50, `beide lijsten tellen op, was ${beide.gereserveerdUsd}`);
    console.assert(beide.wachtendeOrders === 2, 'twee lijsten met elk een order zijn twee orders');

    // frozenAmount is de naam die de derde partij voor het vastgezette bedrag van een marktorder geeft.
    console.assert(bepaalSaldoStand({ clientPortfolio: { credit: 100, ordersForOpen: [{ frozenAmount: 30 }] } }).besteedbaarUsd === 70,
      'frozenAmount telt als bedrag');

    // Sluitorders reserveren geen geld.
    console.assert(bepaalSaldoStand({ clientPortfolio: { credit: 100, ordersForClose: [{ amount: 40 }] } }).besteedbaarUsd === 100,
      'ordersForClose mag niets van het saldo afhalen');

    // Gemeten: eToro stuurt entryOrders en stockOrders altijd mee. Die tellen dus ook, maar dezelfde
    // order onder twee namen maar één keer.
    console.assert(bepaalSaldoStand({ clientPortfolio: { credit: 100, ordersForOpen: [], entryOrders: [{ amount: 40 }] } }).besteedbaarUsd === 60,
      'entryOrders telt mee naast een lege ordersForOpen');
    console.assert(bepaalSaldoStand({ clientPortfolio: { credit: 100, stockOrders: [{ orderId: 5, amount: 40 }] } }).besteedbaarUsd === 60,
      'stockOrders telt mee');
    const dubbel = bepaalSaldoStand({ clientPortfolio: { credit: 100, ordersForOpen: [{ orderId: 5, amount: 40 }], stockOrders: [{ orderID: 5, amount: 40 }] } });
    console.assert(dubbel.besteedbaarUsd === 60 && dubbel.wachtendeOrders === 1, `dezelfde order in twee lijsten telt één keer, was ${dubbel.besteedbaarUsd}`);
    // pendingOrders is een gok van vóór de meting en telt alleen als er geen echte lijst is.
    console.assert(bepaalSaldoStand({ clientPortfolio: { credit: 100, orders: [], pendingOrders: [{ amount: 40 }] } }).besteedbaarUsd === 100,
      'pendingOrders telt niet naast een echte lijst');
    // De vorm zoals eToro hem op 28 sep 2026 stuurde: alle lijsten leeg.
    const gemeten = bepaalSaldoStand({ clientPortfolio: { credit: 105998.02, orders: [], stockOrders: [], entryOrders: [], ordersForOpen: [], ordersForClose: [] } });
    console.assert(gemeten.besteedbaarUsd === 105998.02 && gemeten.wachtendeOrders === 0, 'de gemeten lege respons reserveert niets');

    // Rommel in de lijst mag de sync niet laten crashen en telt als onleesbaar.
    const rommel = bepaalSaldoStand({ clientPortfolio: { credit: 100, ordersForOpen: [null as unknown as EtoroWachtendeOrder] } });
    console.assert(rommel.gereserveerdUsd === null && rommel.wachtendeOrders === 1, 'een null-order is een onleesbare order');
  }

  // ---------- Wachtende orders: lijst ----------
  {
    const lijst = leesWachtendeOrders({
      clientPortfolio: {
        orders: [{
          orderID: 11, instrumentID: 1001, isBuy: true, rate: 180.5, amount: 25,
          stopLossRate: 0, takeProfitRate: 200, openDateTime: '2026-09-01T10:00:00Z',
        }],
        ordersForOpen: [{
          orderId: 22, instrumentId: 1002, isBuy: false, frozenAmount: 40, statusId: 11,
          stopLossRate: 120, isNoTakeProfit: true, takeProfitRate: 90,
        }],
      },
    });
    const limiet = lijst.find(o => o.soort === 'limiet');
    const markt = lijst.find(o => o.soort === 'markt');
    console.assert(lijst.length === 2, `twee orders verwacht, waren het er ${lijst.length}`);
    console.assert(limiet?.orderId === 11 && limiet?.instrumentId === 1001, 'orderID en instrumentID (hoofdletters) moeten gelezen worden');
    console.assert(markt?.orderId === 22 && markt?.instrumentId === 1002, 'orderId en instrumentId (kleine d) moeten gelezen worden');
    console.assert(limiet?.limietKoers === 180.5 && markt?.limietKoers === null, 'alleen een limietorder heeft een limietkoers');
    console.assert(limiet?.stopLoss === null, 'een stop van 0 is geen stop en wordt null, geen 0');
    console.assert(limiet?.takeProfit === 200, 'een echt doel blijft staan');
    console.assert(markt?.takeProfit === null, 'isNoTakeProfit wint van een restwaarde');
    console.assert(markt?.stopLoss === 120, 'een echte stop op een marktorder blijft staan');
    console.assert(limiet?.richting === 'long' && markt?.richting === 'short', 'isBuy false is short');
    console.assert(limiet?.bedragUsd === 25 && markt?.bedragUsd === 40, 'amount en frozenAmount zijn allebei een bedrag');
    console.assert(limiet?.openTijd === Date.parse('2026-09-01T10:00:00Z') && markt?.openTijd === null, 'tijd in epoch ms, of null');
    console.assert(markt?.statusId === 11 && limiet?.statusId === null, 'statusId alleen als eToro hem meestuurt');

    const zonderId = leesWachtendeOrders({ clientPortfolio: { ordersForOpen: [{ amount: 5 }] } });
    console.assert(zonderId.length === 1 && zonderId[0].orderId === null && zonderId[0].instrumentId === null,
      'een order zonder id staat wel in de lijst, maar met orderId null');
    console.assert(zonderId[0].richting === 'long', 'een ontbrekende isBuy is long');
    console.assert(leesWachtendeOrders({}).length === 0, 'een lege respons geeft een lege lijst');
    console.assert(leesWachtendeOrders({ clientPortfolio: { pendingOrders: [{ orderId: 3 }] } })[0]?.soort === 'limiet',
      'de oude terugvallijst telt als limietorder');

    // stockOrders per order: met een leesbare koers limiet, zonder markt.
    const aandelen = leesWachtendeOrders({ clientPortfolio: { stockOrders: [{ orderId: 31, rate: 150 }, { orderId: 32 }, { orderId: 33, rate: 0 }] } });
    console.assert(aandelen[0]?.soort === 'limiet' && aandelen[0]?.limietKoers === 150, 'een stockOrder met koers is een limietorder');
    console.assert(aandelen[1]?.soort === 'markt' && aandelen[1]?.limietKoers === null, 'een stockOrder zonder koers is een marktorder');
    console.assert(aandelen[2]?.soort === 'markt', 'een koers van 0 is geen koers, dus marktorder');

    // Fail open: een positie met hetzelfde orderID verbergt de order niet (koppeling niet gemeten,
    // een gedeeltelijke vulling houdt nog geld vast). Lijst en saldo houden alle drie de orders.
    const positie = (over: Partial<EtoroPositie>): EtoroPositie => ({
      positionID: 1, instrumentID: 1001, isBuy: true, units: 1, openRate: 1, openDateTime: '2026-09-01T10:00:00Z', ...over,
    });
    const alGevuld = { clientPortfolio: { credit: 100, positions: [positie({ orderID: 41 }), positie({ orderId: 42 })],
      ordersForOpen: [{ orderId: 41, amount: 10 }, { orderID: 42, amount: 10 }, { orderId: 43, amount: 10 }] } };
    console.assert(leesWachtendeOrders(alGevuld).length === 3, 'een positie met hetzelfde orderID verbergt de order niet');
    console.assert(bepaalSaldoStand(alGevuld).gereserveerdUsd === 30, 'het bedrag van zo een order blijft gereserveerd');
  }

  // Het sluitantwoord zoals gemeten (28 sep 2026, demo): orderId genest onder orderForClose.orderID.
  {
    const gemeten = {
      orderForClose: { positionID: 3355213401, instrumentID: 1001, orderID: 384452601, orderType: 19, statusID: 1 },
      token: 'abc',
    } as unknown as Parameters<typeof leesSluitOrderId>[0];
    console.assert(leesSluitOrderId(gemeten) === 384452601, 'het gemeten sluitantwoord levert orderForClose.orderID');
    console.assert(leesSluitOrderId({ orderId: 7, orderForClose: { orderID: 8 } }) === 7, 'een plat orderId gaat voor');
    console.assert(leesSluitOrderId({ orderForClose: { orderId: 9 } }) === 9, 'ook orderForClose.orderId (kleine d) telt');
    console.assert(leesSluitOrderId(undefined) === null && leesSluitOrderId({ orderForClose: { orderID: 0 } }) === null,
      'geen of een onzinnig id wordt null, geen 0');
  }

  // ---------- Annuleren en status ----------
  console.assert(demoPad('/trading/execution/orders/123') === '/trading/execution/demo/orders/123',
    'annuleren van een order moet in demo het demo-segment krijgen');
  console.assert(demoPad('/trading/info/orders:lookup?orderId=5') === '/trading/info/demo/orders:lookup?orderId=5',
    'de orderstatus heeft een eigen demo-pad, en de querystring blijft erachter staan');
  console.assert(demoPad('/trading/info/orders:lookup?referenceId=abc') === '/trading/info/demo/orders:lookup?referenceId=abc',
    'ook opzoeken op verzoek-id gaat naar demo');
  console.assert(isDefinitieveStatus(7) === true && isDefinitieveStatus(3) === true, 'geannuleerd en uitgevoerd zijn definitief');
  console.assert(isDefinitieveStatus(11) === false && isDefinitieveStatus(1) === false, 'wachten op de markt en ontvangen zijn niet definitief');
  console.assert(statusInGewoneTaal(11) === 'wacht tot de markt opent', 'status 11 in gewone taal');
  console.assert(statusInGewoneTaal(99) === 'status onbekend', 'een onbekend status-id wordt niet verzonnen');
  {
    // annuleerOrder gooit bij een 404 deze vertaalde fout; die moet een 'fout' blijven (er is niets
    // geannuleerd) en de eigen tekst tonen in plaats van eToro's rauwe body.
    const u = duidFout(new EtoroFout(ORDER_BESTAAT_NIET_MEER, 404), 'x');
    console.assert(u.soort === 'fout' && u.bericht === ORDER_BESTAAT_NIET_MEER, 'een 404 bij annuleren wordt een leesbare fout');
  }

  // Een open positie zonder isBuy in de respons moet long blijven, net als in de historie. Met een
  // waarheidstest zou hij stilzwijgend als short opgeslagen worden, en dan klopt alles eromheen niet.
  {
    const zonderVeld = { positionID: 1, instrumentID: 2, units: 1, openRate: 100, openDateTime: '2026-01-01T00:00:00Z' } as unknown as Parameters<typeof naarPortfolioTrade>[0];
    const t = naarPortfolioTrade(zonderVeld, 'BTC');
    console.assert(t.richting === 'long', `een positie zonder isBuy moet long zijn, was ${t.richting}`);
  }

  // De orderbody per richting. Dit is het geldpad, dus expliciet vastleggen wat eToro krijgt.
  {
    const lang = bouwKooporderBody({ instrumentId: 100000, bedragUsd: 50 });
    console.assert(lang.transaction === 'buy', `long moet buy sturen, was ${lang.transaction}`);
    console.assert(!('settlementType' in lang), 'long laat settlementType weg, precies zoals in fase 1 gemeten');
    console.assert(lang.leverage === 1, 'Kader rekent nergens met hefboom');

    const kort = bouwKooporderBody({ instrumentId: 100000, bedragUsd: 50, richting: 'short' });
    console.assert(kort.transaction === 'sell', `short moet sell sturen, was ${kort.transaction}`);
    // Gemeten: crypto shorten kan bij eToro alleen als CFD, maar wel op hefboom x1.
    console.assert(kort.settlementType === 'cfd', `short moet settlementType cfd sturen, was ${kort.settlementType}`);
    console.assert(kort.leverage === 1, 'ook een short gaat op x1, niet met hefboom');

    // Zonder richting exact hetzelfde als voorheen: dat is wat elke bestaande aanroep doet.
    console.assert(JSON.stringify(lang) === JSON.stringify(bouwKooporderBody({ instrumentId: 100000, bedragUsd: 50, richting: 'long' })),
      'weglaten van richting hoort identiek te zijn aan long');
  }

  // Helemaal onderaan: stond eerder halverwege, en de controles daarna telden dan niet mee.
  if (missers > 0) {
    console.error(`etoro.ts self-check GEFAALD: ${missers} controle(s) klopten niet`);
    process.exit(1);
  }
  console.log('etoro.ts self-check geslaagd');
}
