import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Hoeveel ruimte een full-screen Modal bovenin EXTRA nodig heeft, bovenop wat SafeAreaView zelf al
 * toepast.
 *
 * De vier full-screen modals in de app telden hier allemaal `StatusBar.currentHeight` bij op, met
 * het commentaar dat SafeAreaView binnen een Modal op Android geen correcte top-inset zou geven.
 * Dat klopt in deze opzet niet meer: react-native-safe-area-context levert de inset wél, en dan
 * werd de statusbalk dus twee keer gecompenseerd. Gemeten op een Pixel 8 (1080x2400, 420dpi):
 * ruim honderd dp lege band boven de titel, genoeg om een hele sectie uit beeld te duwen.
 *
 * Simpelweg niets optellen zou de oorspronkelijke zorg terugbrengen op toestellen of
 * Android-versies waar die inset wél 0 is; dan valt de titel onder de statusbalk. Vandaar deze
 * regel: alleen aanvullen als er niets is om op voort te bouwen.
 */
export function useModalKopruimte(): number {
  const insets = useSafeAreaInsets();
  if (insets.top > 0) return 0;
  return Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
}
