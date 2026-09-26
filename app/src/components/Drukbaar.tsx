import React, { useRef, useState } from 'react';
import {
  Pressable,
  type View,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { drukSchaal } from '../theme/beweging';
import { useBeweging } from '../theme/useReduceMotion';
import { haptiek as speelHaptiek, type HaptiekMoment } from '../theme/haptiek';
import { zetBron, type BronStijl } from '../state/bronRect';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Hoe ver een ingedrukt vlak dimt onder Minder beweging, in plaats van te krimpen.
const DIM_OPACITY = 0.85;

// De indruk-veer los, voor plekken waar het vlak dat moet krimpen niet hetzelfde is als het vlak
// dat je aanraakt. Een TradeCard bijvoorbeeld: je drukt op het bovenste deel, maar de hele kaart
// (met schaduw en rand) hoort mee te bewegen. Zet stijl op de buitenste Animated.View en
// drukIn/drukUit op onPressIn/onPressOut van de Pressable.
//
// Bewust op de gewone Pressable en niet op een gesture-handler-knop: binnen een FlatList of
// ScrollView van React Native neemt de lijst de aanraking over zodra je gaat scrollen, dan komt
// er een onPressOut zonder onPress. De kaart veert dus terug en er opent niets. Een
// gesture-handler-knop in een RN-lijst heeft daar op Android minder betrouwbare afspraken over.
//
// Met bron opent deze kaart een full-screen scherm dat uit de kaart moet groeien (PodiumScherm).
// Zet dan ook ref op de buitenste Animated.View en roep legBronVast() aan in onPress, vóór het
// scherm geopend wordt. Gemeten wordt al bij het indrukken: measureInWindow is een rondje naar de
// native kant, en bij de tik zelf moet het antwoord er al liggen.
export function useDrukVeer(schaal: number = drukSchaal, bron?: BronStijl) {
  const { reduceMotion, naar } = useBeweging();
  // 0 = los, 1 = helemaal ingedrukt. Eén voortgangswaarde in plaats van schaal en opacity apart,
  // zodat een onderbreking (loslaten halverwege) vanzelf vanaf de huidige stand terugveert.
  const voortgang = useSharedValue(0);

  const stijl = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - (1 - DIM_OPACITY) * voortgang.value }
      : { transform: [{ scale: 1 - (1 - schaal) * voortgang.value }] },
  );

  const ref = useRef<View>(null);
  const gemeten = useRef<{ x: number; y: number; breedte: number; hoogte: number } | null>(null);

  function drukIn() {
    voortgang.value = naar(1, 'snel');
    if (bron) {
      ref.current?.measureInWindow((x, y, breedte, hoogte) => {
        gemeten.current = { x, y, breedte, hoogte };
      });
    }
  }

  function drukUit() {
    voortgang.value = naar(0, 'snel');
  }

  // De meting geldt voor precies één tik. Een activering zonder indrukken (TalkBack) meet niets,
  // en dan hoort er geen oude rect van een eerdere tik te blijven liggen: het scherm schuift dan
  // gewoon van rechts binnen.
  function legBronVast() {
    if (bron && gemeten.current) zetBron({ ...gemeten.current, ...bron });
    gemeten.current = null;
  }

  return { stijl, drukIn, drukUit, ref, legBronVast };
}

export interface DrukbaarProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle> | ((staat: PressableStateCallbackType) => StyleProp<ViewStyle>);
  // Schaal tijdens indrukken. Standaard drukSchaal (0.97); kleine iconknoppen mogen dieper, want
  // 3% van 40 punten is nauwelijks te zien.
  schaal?: number;
  // Optionele haptic bij een geslaagde druk (onPress), niet bij het aanraken. Spaarzaam gebruiken.
  haptiek?: HaptiekMoment;
  // Opent deze knop een full-screen scherm, dan groeit dat scherm uit dit vlak. Zie useDrukVeer.
  bron?: BronStijl;
}

// Vervanger voor Pressable op kaarten en knoppen: krimpt op een snelle veer bij indrukken en veert
// terug bij loslaten, onderbreekbaar. Onder Minder beweging dimt hij kort in plaats van te krimpen.
// Verder dezelfde props als Pressable, dus omwisselen is meestal alleen de naam.
export function Drukbaar({
  style,
  schaal,
  haptiek,
  bron,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: DrukbaarProps) {
  const { stijl, drukIn, drukUit, ref, legBronVast } = useDrukVeer(schaal, bron);
  // Alleen bijgehouden als style een functie is, zodat de gewone variant bij indrukken niet
  // opnieuw hoeft te renderen: de schaal loopt volledig via de shared value.
  const [ingedrukt, setIngedrukt] = useState(false);
  const stijlIsFunctie = typeof style === 'function';

  return (
    <AnimatedPressable
      {...rest}
      ref={ref}
      onPressIn={(e: GestureResponderEvent) => {
        drukIn();
        if (stijlIsFunctie) setIngedrukt(true);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        drukUit();
        if (stijlIsFunctie) setIngedrukt(false);
        onPressOut?.(e);
      }}
      onPress={
        onPress
          ? (e: GestureResponderEvent) => {
              if (haptiek) speelHaptiek(haptiek);
              legBronVast();
              onPress(e);
            }
          : undefined
      }
      style={[stijlIsFunctie ? style({ pressed: ingedrukt }) : style, stijl]}
    />
  );
}
