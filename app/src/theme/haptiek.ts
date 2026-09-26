import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { scheduleOnRN } from 'react-native-worklets';

// De enige plek in de app die expo-haptics aanroept. Haptics zijn spaarzaam: alleen op momenten
// die er echt toe doen (een keuze wisselt, iets klikt vast, een grens wordt gepasseerd, een order
// lukt). Nooit op elke tik op een kaart. Ze blijven aan bij Minder beweging, net als bij Apple.
export type HaptiekMoment =
  | 'tik'           // een keuze wisselt: periode, filter, tab
  | 'vastklikken'   // iets rast op zijn plek: een sheet die open klikt, pull-to-refresh
  | 'drempel'       // een grens passeren tijdens een gebaar: hoogste of laagste punt in de grafiek
  | 'succes'        // iets is gelukt: order geplaatst, koppeling werkt
  | 'waarschuwing'  // iets ging mis of vraagt aandacht
  | 'stevig';       // het zwaarste moment, zoals de laatste stap van een order bevestigen

// Op Android via performHapticFeedback in plaats van de Vibrator: dat is wat het systeem zelf voor
// toetsenbord en schakelaars gebruikt, het voelt strakker, en het respecteert de instelling
// "Aanraakfeedback" van de gebruiker. Een deel van deze constanten bestaat pas vanaf Android 11 of
// 14; op een ouder toestel weigert expo-haptics en vallen we terug op de Vibrator-variant.
const ANDROID: Record<HaptiekMoment, Haptics.AndroidHaptics> = {
  tik: Haptics.AndroidHaptics.Segment_Tick,
  vastklikken: Haptics.AndroidHaptics.Context_Click,
  drempel: Haptics.AndroidHaptics.Clock_Tick,
  succes: Haptics.AndroidHaptics.Confirm,
  waarschuwing: Haptics.AndroidHaptics.Reject,
  stevig: Haptics.AndroidHaptics.Long_Press,
};

// iOS, en de terugval op oudere Android-versies.
const ALGEMEEN: Record<HaptiekMoment, () => Promise<void>> = {
  tik: () => Haptics.selectionAsync(),
  vastklikken: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  drempel: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid),
  succes: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  waarschuwing: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  stevig: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
};

function terugval(moment: HaptiekMoment) {
  ALGEMEEN[moment]().catch(() => {});
}

// Vuur-en-vergeet. Een haptic die niet lukt (web, geen trilmotor, instelling uit) is nooit een
// reden om een actie te laten mislukken, dus alle fouten worden ingeslikt.
export function haptiek(moment: HaptiekMoment): void {
  try {
    if (Platform.OS === 'android') {
      Haptics.performAndroidHapticsAsync(ANDROID[moment]).catch(() => terugval(moment));
    } else if (Platform.OS === 'ios') {
      terugval(moment);
    }
  } catch {
    // Native module ontbreekt (oude dev-build): stil blijven.
  }
}

// Vanuit een worklet (gesture-callback, useAnimatedReaction) mag je haptiek() niet direct
// aanroepen, want dat is een gewone JS-functie en de native module leeft op de JS-thread. Deze
// variant zet de aanroep via scheduleOnRN over naar de JS-thread. scheduleOnRN (uit
// react-native-worklets) is de opvolger van runOnJS in Reanimated 4.
export function haptiekVanUI(moment: HaptiekMoment): void {
  'worklet';
  scheduleOnRN(haptiek, moment);
}
