import {
  LinearTransition,
  withDelay,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';
import { curve, duur, staggerVertraging, veer, vervaag } from './beweging';

// Layout-beweging voor lijsten en uitklappers, op Reanimated in plaats van LayoutAnimation.
// LayoutAnimation.configureNext gold voor de hele volgende layout-ronde van de app: op Android
// animeerde daardoor soms iets heel anders mee (een lijst die net ververste, een sheet die
// opende), of juist niets. Hier hangt de beweging aan het element zelf.

// Voor alles dat opschuift of van maat verandert omdat er iets boven of in hem open- of
// dichtklapt, of omdat een lijst hersorteert. Dezelfde veer als kaarten en sheets.
// veerVan() vult massa, stijfheid en demping altijd; het type laat ze alleen optioneel.
const SCHUIF = LinearTransition.springify()
  .mass(veer.standaard.mass!)
  .stiffness(veer.standaard.stiffness!)
  .damping(veer.standaard.damping!);

// Minder beweging: geen transitie, het element staat direct op zijn nieuwe plek. Bewust niet via
// Reanimated's eigen ReduceMotion.System: die leest de instelling één keer bij het opstarten (zie
// useBeweging), dus wie hem tussendoor omzet zou hier nog glijden.
export function schuifOvergang(reduceMotion: boolean) {
  return reduceMotion ? undefined : SCHUIF;
}

// Waarom de functies hieronder gecachet zijn: elke aanroep maakt een nieuwe worklet, en Reanimated
// registreert een layout-animatie opnieuw zodra de functie een andere identiteit heeft. Voor
// `exiting` gebeurt dat bij elke render, inclusief het overzetten van de worklet naar de UI-thread.
// Met twintig kaarten in een lijst kostte dat bij elke state-wijziging honderden milliseconden op
// de JS-thread: een tik op een kaart opende het detailscherm pas na een seconde en de marktscan
// liep merkbaar trager. Zelfde invoer geeft daarom dezelfde functie terug.

// Inhoud die openklapt: vervaagt in en zakt een paar punten op zijn plek, zodat hij uit de kop
// lijkt te komen. Met Minder beweging alleen de fade.
function maakUitklapIn(reduceMotion: boolean): EntryExitAnimationFunction {
  return () => {
    'worklet';
    if (reduceMotion) {
      return { initialValues: { opacity: 0 }, animations: { opacity: vervaag(1, duur.kort) } };
    }
    return {
      initialValues: { opacity: 0, transform: [{ translateY: -6 }] },
      animations: {
        opacity: withTiming(1, { duration: duur.midden, easing: curve.fade }),
        transform: [{ translateY: withSpring(0, veer.standaard) }],
      },
    };
  };
}
const UITKLAP_IN = maakUitklapIn(false);
const UITKLAP_IN_RUSTIG = maakUitklapIn(true);

export function uitklapIn(reduceMotion: boolean): EntryExitAnimationFunction {
  return reduceMotion ? UITKLAP_IN_RUSTIG : UITKLAP_IN;
}

// Inhoud die dichtklapt: alleen een korte fade, want wat eronder ligt schuift er al overheen.
// Ook met Minder beweging, daarom via vervaag().
const UITKLAP_UIT: EntryExitAnimationFunction = () => {
  'worklet';
  return { initialValues: { opacity: 1 }, animations: { opacity: vervaag(0, duur.kort) } };
};

export function uitklapUit(): EntryExitAnimationFunction {
  return UITKLAP_UIT;
}

// Een kaart die in een lijst landt: vervaagt in en komt 12 punten omhoog op een veer. `index` is
// de plek binnen de groep die tegelijk binnenkwam, zodat een blok van zes kaarten gestaffeld landt
// in plaats van als één klap. Met Minder beweging alleen een korte fade, zonder staffeling.
function maakKaartLandt(index: number, reduceMotion: boolean): EntryExitAnimationFunction {
  const vertraging = staggerVertraging(index);
  return () => {
    'worklet';
    if (reduceMotion) {
      return { initialValues: { opacity: 0 }, animations: { opacity: vervaag(1, duur.kort) } };
    }
    return {
      initialValues: { opacity: 0, transform: [{ translateY: 12 }] },
      animations: {
        opacity: withDelay(vertraging, withTiming(1, { duration: duur.midden, easing: curve.binnen })),
        transform: [{ translateY: withDelay(vertraging, withSpring(0, veer.standaard)) }],
      },
    };
  };
}

// Per plek in de staffeling en per stand van Minder beweging precies één functie.
const kaartLandtCache = new Map<string, EntryExitAnimationFunction>();

export function kaartLandt(index: number, reduceMotion: boolean): EntryExitAnimationFunction {
  const sleutel = `${index}:${reduceMotion ? 1 : 0}`;
  let functie = kaartLandtCache.get(sleutel);
  if (!functie) {
    functie = maakKaartLandt(index, reduceMotion);
    kaartLandtCache.set(sleutel, functie);
  }
  return functie;
}
