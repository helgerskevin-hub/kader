// De beslissing achter de eenmalige samenvoeging van de eToro-sleutels, apart gezet zodat hij te
// toetsen is. state/etoroSleutels.ts trekt expo-secure-store binnen en draait daardoor niet in Node;
// deze twee functies wel, en juist hier zit het risico: kiezen we het verkeerde paar, dan staat er
// een sleutel die eToro weigert, en kiezen we te gretig een omgeving, dan wijst de app naar een
// echt account terwijl de gebruiker dacht in demo te zitten.
//
// Achtergrond: Kader bewaarde tot nu toe twee sleutelparen, een voor demo en een voor echt, terwijl
// eToro er maar een uitgeeft die in allebei de omgevingen werkt (gemeten, zie engine/etoro.ts en
// docs/etoro-direct-handelen-plan.md paragraaf 9a).
import { EtoroOmgeving } from './etoro';

export interface Sleutelpaar {
  apiKey: string;
  userKey: string;
}

// 'echt' en 'demo' zeggen in welk oud vakje de sleutel gevonden is, 'beide' dat ze er allebei
// stonden. Dat onderscheid heeft maar een doel: bepalen op welke omgeving een bestaande installatie
// hoort te beginnen als de gebruiker nog nooit expliciet gekozen heeft.
export type Sleutelbron = 'echt' | 'demo' | 'beide' | null;

// Een paar telt alleen mee als het compleet is: een halve invoer is geen sleutel maar een 401 die je
// pas dagen later ziet.
export function kiesSleutelbron(
  echt: Sleutelpaar,
  demo: Sleutelpaar,
): (Sleutelpaar & { bron: Sleutelbron }) | null {
  const echtCompleet = Boolean(echt.apiKey && echt.userKey);
  const demoCompleet = Boolean(demo.apiKey && demo.userKey);

  // Allebei gevuld: in de praktijk staat er twee keer dezelfde sleutel, want eToro geeft er maar een
  // uit. Verschillen ze toch, dan wint het echte vakje, omdat dat het vakje is dat er al was voordat
  // de demo-variant bestond. Belangrijk: de verliezer wordt nergens gewist. Een User Key laat eToro
  // maar een keer zien, dus een weggegooide sleutel is niet terug te halen.
  if (echtCompleet && demoCompleet) return { ...echt, bron: 'beide' };
  if (echtCompleet) return { ...echt, bron: 'echt' };
  if (demoCompleet) return { ...demo, bron: 'demo' };
  return null;
}

// Wat er met het User Key-veld moet gebeuren zodra iemand de publieke sleutel aanpast.
//
// eToro geeft bij een nieuwe sleutel ook een nieuwe User Key, en toont die precies één keer. De
// wizard vulde allebei de velden voor met wat er op het toestel stond, dus wie een nieuwe publieke
// sleutel plakte hield de oude User Key eronder staan, gemaskeerd als bolletjes en dus ogenschijnlijk
// gewoon ingevuld. Dat is precies de combinatie die eToro met een 401 weigert, en de melding daarbij
// adviseerde je te doen wat je net gedaan dacht te hebben.
//
// Hier als pure functie omdat het een sleutelbeslissing is, net als kiesSleutelbron hierboven: het
// gaat over een User Key die je niet opnieuw kunt opvragen, dus het moet toetsbaar zijn.
export interface Sleutelwissel {
  userKey: string;
  // Staat het veld leeg omdat de publieke sleutel veranderde? Dan moet de wizard uitleggen waarom,
  // anders leest een leeg veld als een bug.
  gewist: boolean;
}

export function userKeyBijApiKeyWijziging(
  geladen: Sleutelpaar | null,
  nieuweApiKey: string,
  huidigeUserKey: string,
  eerderGewist: boolean,
): Sleutelwissel {
  // Niets voorgevuld: er is ook niets dat niet meer bij elkaar kan horen.
  if (!geladen) return { userKey: huidigeUserKey, gewist: eerderGewist };

  const anders = nieuweApiKey.trim() !== geladen.apiKey.trim();

  // Andere publieke sleutel terwijl de voorgevulde User Key er nog staat: die hoort er niet meer bij.
  if (anders && huidigeUserKey === geladen.userKey && huidigeUserKey !== '') {
    return { userKey: '', gewist: true };
  }

  // Weer terug op de oude publieke sleutel: dan mag de oude User Key ook terug. Zonder dit sta je
  // met een leeg veld terwijl er per saldo niets veranderd is, en eToro laat hem je niet nog eens
  // zien. Alleen als het veld nog leeg is, zodat een zelf ingetypte User Key nooit overschreven wordt.
  if (!anders && eerderGewist && huidigeUserKey === '') {
    return { userKey: geladen.userKey, gewist: false };
  }

  return { userKey: huidigeUserKey, gewist: eerderGewist };
}

// Op welke omgeving hoort iemand te starten die nog nooit expliciet gekozen heeft? Dit houdt precies
// het gedrag aan van voor deze wijziging (echt && !demo ? 'real' : 'demo'): alleen een sleutel die
// uitsluitend in het echte vakje stond hoort bij een bestaande echte koppeling van voor 0.1.13, en
// die mag door een update niet stilzwijgend op een leeg demo-portfolio uitkomen.
//
// Al het andere begint in demo. Dat is de kant om op te falen: wie niets gekozen heeft hoort niet
// per ongeluk met echt geld te beginnen.
export function standaardOmgeving(bron: Sleutelbron): EtoroOmgeving {
  return bron === 'echt' ? 'real' : 'demo';
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/sleutelKeuze.ts`
if (require.main === module) {
  const leeg: Sleutelpaar = { apiKey: '', userKey: '' };
  const a: Sleutelpaar = { apiKey: 'API-A', userKey: 'USER-A' };
  const b: Sleutelpaar = { apiKey: 'API-B', userKey: 'USER-B' };

  // ---------- Welk paar wint ----------
  console.assert(kiesSleutelbron(leeg, leeg) === null, 'zonder sleutels is er niets te kiezen');

  const alleenEcht = kiesSleutelbron(a, leeg);
  console.assert(alleenEcht?.apiKey === 'API-A' && alleenEcht?.bron === 'echt',
    'een sleutel die alleen in het echte vakje staat wint en heet echt');

  // Dit is het geval van Kevin: zijn enige sleutel stond onder demo, en in echt was hij daardoor
  // niet gekoppeld. Die sleutel moet nu gewoon de sleutel zijn.
  const alleenDemo = kiesSleutelbron(leeg, b);
  console.assert(alleenDemo?.apiKey === 'API-B' && alleenDemo?.bron === 'demo',
    'een sleutel die alleen in het demo-vakje staat wint ook, en heet demo');

  const beide = kiesSleutelbron(a, b);
  console.assert(beide?.apiKey === 'API-A' && beide?.bron === 'beide',
    'staan er twee verschillende, dan wint het echte vakje');

  const dezelfde = kiesSleutelbron(a, a);
  console.assert(dezelfde?.apiKey === 'API-A' && dezelfde?.bron === 'beide',
    'twee keer dezelfde sleutel is ook beide, en levert die sleutel op');

  // Halve paren tellen niet mee, anders bewaart de app een api-sleutel zonder user-sleutel en geeft
  // eToro een 401 op iets wat nooit een koppeling was.
  console.assert(kiesSleutelbron({ apiKey: 'API-A', userKey: '' }, leeg) === null,
    'een api-sleutel zonder user-sleutel is geen koppeling');
  console.assert(kiesSleutelbron({ apiKey: '', userKey: 'USER-A' }, leeg) === null,
    'een user-sleutel zonder api-sleutel is geen koppeling');
  const halfEchtHeelDemo = kiesSleutelbron({ apiKey: 'API-A', userKey: '' }, b);
  console.assert(halfEchtHeelDemo?.apiKey === 'API-B' && halfEchtHeelDemo?.bron === 'demo',
    'een half echt paar verliest van een compleet demo-paar');

  // ---------- Waar begin je ----------
  console.assert(standaardOmgeving('echt') === 'real',
    'alleen een echte sleutel van voor 0.1.13 blijft op echt staan, anders valt de sync stilzwijgend uit');
  console.assert(standaardOmgeving('demo') === 'demo', 'wie alleen demo gekoppeld had blijft in demo');
  console.assert(standaardOmgeving('beide') === 'demo',
    'met sleutels in allebei de vakjes begin je in demo, precies zoals de oude afleiding deed');
  console.assert(standaardOmgeving(null) === 'demo', 'zonder sleutel is demo de veilige stand');

  // De regel die het geldrisico afdekt: er is precies een bron die 'real' oplevert.
  const bronnen: Sleutelbron[] = ['echt', 'demo', 'beide', null];
  console.assert(bronnen.filter(x => standaardOmgeving(x) === 'real').length === 1,
    'maar een van de vier bronnen mag op het echte account uitkomen');

  // ---------- Wat gebeurt er met de User Key als de publieke sleutel verandert ----------
  const opgeslagen: Sleutelpaar = { apiKey: 'API-OUD', userKey: 'USER-OUD' };

  // Het geval van Kevin: nieuwe sleutel bij eToro gemaakt, publieke sleutel geplakt, en de oude
  // User Key bleef eronder staan. Die moet nu weg, met uitleg.
  const geplakt = userKeyBijApiKeyWijziging(opgeslagen, 'API-NIEUW', 'USER-OUD', false);
  console.assert(geplakt.userKey === '' && geplakt.gewist,
    'een nieuwe publieke sleutel maakt de voorgevulde User Key leeg');

  // Tussentijds tikken mag de al ingevulde nieuwe User Key niet opeten.
  const zelfIngevuld = userKeyBijApiKeyWijziging(opgeslagen, 'API-NIEUW', 'USER-NIEUW', true);
  console.assert(zelfIngevuld.userKey === 'USER-NIEUW' && zelfIngevuld.gewist,
    'een zelf ingetypte User Key blijft staan');

  // Terug naar de oude sleutel: de oude User Key hoort terug te komen, want eToro toont hem niet
  // nog een keer.
  const teruggezet = userKeyBijApiKeyWijziging(opgeslagen, 'API-OUD', '', true);
  console.assert(teruggezet.userKey === 'USER-OUD' && !teruggezet.gewist,
    'de oude sleutel terugzetten geeft de oude User Key terug');

  // Maar niet over iets heen dat de gebruiker zelf heeft ingevuld.
  const terugMaarIngevuld = userKeyBijApiKeyWijziging(opgeslagen, 'API-OUD', 'USER-NIEUW', true);
  console.assert(terugMaarIngevuld.userKey === 'USER-NIEUW',
    'terugzetten overschrijft nooit een zelf ingevulde User Key');

  // Witruimte bij het plakken is geen andere sleutel.
  const metSpaties = userKeyBijApiKeyWijziging(opgeslagen, '  API-OUD  ', 'USER-OUD', false);
  console.assert(metSpaties.userKey === 'USER-OUD' && !metSpaties.gewist,
    'spaties rond dezelfde sleutel tellen niet als wijziging');

  // Wie nog niet gekoppeld was heeft niets te verliezen.
  const nietGekoppeld = userKeyBijApiKeyWijziging(null, 'API-NIEUW', 'USER-GETYPT', false);
  console.assert(nietGekoppeld.userKey === 'USER-GETYPT' && !nietGekoppeld.gewist,
    'zonder opgeslagen paar verandert er niets');

  // Halverwege het plakken van een lange sleutel mag het veld niet blijven flikkeren: is de User Key
  // eenmaal leeg, dan blijft hij leeg zolang de publieke sleutel afwijkt.
  const nogSteedsAnders = userKeyBijApiKeyWijziging(opgeslagen, 'API-NIEUWER', '', true);
  console.assert(nogSteedsAnders.userKey === '' && nogSteedsAnders.gewist,
    'blijft leeg zolang de publieke sleutel afwijkt');

  console.log('sleutelKeuze.ts self-check geslaagd');
}
