import {
  Easing,
  ReduceMotion,
  withTiming,
  type AnimationCallback,
  type WithSpringConfig,
} from 'react-native-reanimated';

// Motion-tokens voor heel Kader. Elke animatie hoort hier zijn veer, duur of curve vandaan te
// halen in plaats van een losse ms-waarde, zodat de app op één plek bijgesteld kan worden en
// overal hetzelfde voelt. Zie ook docs/app-beschrijving-voor-claude-design.md (Beweging).

// Veren beschrijven we zoals Apple (SwiftUI) dat doet: een respons in seconden (hoe lang één
// "slag" duurt, grofweg de waargenomen snelheid) en een dempingsfractie (1 = kritisch gedempt,
// geen overshoot; lager = een beetje doorveren). Reanimated wil massa, stijfheid en demping,
// dus rekenen we om. Bewust niet de duration/dampingRatio-variant van Reanimated: die rekt de
// stijfheid op tot hij de vaste duur haalt, ook als een gebaar de veer al snelheid meegeeft. Een
// fysieke veer neemt die vaart gewoon over, en dat is precies wat onderbreekbaar en
// vinger-gestuurd moet voelen.
function veerVan(respons: number, demping: number): WithSpringConfig {
  const massa = 1;
  return {
    mass: massa,
    stiffness: Math.pow((2 * Math.PI) / respons, 2) * massa,
    damping: (4 * Math.PI * demping * massa) / respons,
  };
}

export const veer = {
  // Indrukken, loslaten, schakelaars. Kort en kritisch gedempt: je moet het voelen, niet zien
  // stuiteren. Staat binnen ongeveer 250ms stil.
  snel: veerVan(0.22, 1),
  // Sheets, kaarten, dingen die op hun plek schuiven. Een fractie onder kritisch, zodat het
  // aankomen zacht is zonder zichtbare stuit. Rond 400ms.
  standaard: veerVan(0.38, 0.9),
  // Schermovergangen. Iets trager en rustiger dan standaard, omdat er een heel vlak beweegt en
  // het oog meer tijd nodig heeft om te volgen. Rond 450ms.
  zacht: veerVan(0.42, 0.95),
  // Tabindicator en andere dingen die ergens "vastklikken". Een vleugje overshoot (ongeveer 1,5%)
  // geeft het gevoel van een aanslag zonder speels te worden.
  stevig: veerVan(0.32, 0.8),
  // Klein popje, alleen voor favoriet aan/uit en vergelijkbare bevestigingen. Het enige token
  // met duidelijk zichtbare overshoot (ongeveer 10%), dus spaarzaam gebruiken.
  speels: veerVan(0.3, 0.6),
} as const;

export type VeerNaam = keyof typeof veer;

// Duren in ms voor wat geen veer is: fades, kleurovergangen, en alles onder "Minder beweging".
export const duur = {
  kort: 120,
  midden: 220,
  lang: 400,
} as const;

// Curves voor withTiming. Easing.bezier levert een fabriek die Reanimated naar de UI-thread
// kan kopiëren, dus deze zijn veilig in worklets te gebruiken.
export const curve = {
  // Standaard voor cross-fades en kleur: de CSS/iOS "ease", vlot weg en rustig uit.
  fade: Easing.bezier(0.25, 0.1, 0.25, 1),
  // Iets dat binnenkomt: snel op gang en lang uitlopen, zodat het aankomt in plaats van stopt.
  binnen: Easing.bezier(0.22, 1, 0.36, 1),
  // Iets dat vertrekt: langzaam los en dan weg, het oog hoeft het niet meer te volgen.
  weg: Easing.bezier(0.4, 0, 1, 1),
  // Iets dat van plek naar plek gaat zonder veer, zoals iOS' easeInOut.
  verplaats: Easing.bezier(0.42, 0, 0.58, 1),
} as const;

// Lijsten die gestaffeld binnenkomen. De cap voorkomt dat de twintigste kaart pas na bijna een
// seconde verschijnt: na maxTotaal komt alles tegelijk.
export const stagger = {
  stap: 40,
  maxTotaal: 320,
} as const;

export function staggerVertraging(index: number): number {
  'worklet';
  return Math.min(index * stagger.stap, stagger.maxTotaal);
}

// Schaal van een kaart of knop terwijl hij ingedrukt is.
export const drukSchaal = 0.97;

// Een fade die ook onder "Minder beweging" echt afspeelt. Reanimated slaat met zijn standaard
// (ReduceMotion.System) elke animatie over als het systeem minder beweging vraagt en springt dan
// direct naar de eindwaarde. Dat willen we voor glijden en veren, maar niet voor een korte
// cross-fade: die is juist het Apple-alternatief. Daarom hier expliciet Never.
export function vervaag(
  waarde: number,
  duurMs: number = duur.midden,
  klaar?: AnimationCallback,
): number {
  'worklet';
  return withTiming(
    waarde,
    { duration: duurMs, easing: curve.fade, reduceMotion: ReduceMotion.Never },
    klaar,
  );
}
