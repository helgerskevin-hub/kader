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

  console.log('sleutelKeuze.ts self-check geslaagd');
}
