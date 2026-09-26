import React, { useEffect } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../theme/useReduceMotion';
import { kaartLandt } from '../theme/lijstBeweging';

// Klein, rustig beeld boven een lege staat: de vier hoekhaken van het Kader-logo die zacht
// uit elkaar en weer naar elkaar toe ademen, met daarbinnen een dunne koerslijn die zich intekent
// en weer wegtrekt. Geen illustratie die iets vertelt, alleen een teken dat het scherm leeft en
// wacht. Met `children` (een icoon) staat dat icoon tussen de haken in plaats van de lijn, zodat
// een scherm zijn eigen betekenis houdt (een portemonnee bij Portfolio, mensen bij Traders).

// Zelfde geometrie als KaderLogo (viewBox 0 0 96 96).
const HOEKEN = [
  'M24 40 L24 24 L40 24',
  'M56 24 L72 24 L72 40',
  'M24 56 L24 72 L40 72',
  'M56 72 L72 72 L72 56',
].map(d => ({ d, pad: Skia.Path.MakeFromSVGString(d)! }));
// Per hoek de richting waarin hij uitademt: linksboven naar linksboven, enzovoort. Los van HOEKEN
// gehouden omdat de worklets hieronder alleen deze getallen nodig hebben, niet de Skia-paden.
const RICHTING = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;

const LIJN = Skia.Path.MakeFromSVGString('M33 57 L41 50 L47 54 L55 42 L63 47')!;

// Eén ademhaling duurt vier seconden: langzaam genoeg om niet op te vallen als je leest, snel
// genoeg om te zien dat het beweegt.
const ADEM_MS = 4000;
// Hoe ver de haken uitademen, in viewBox-eenheden (op 72 punten grofweg twee punten).
const UITSLAG = 2.5;
// Stand bij Minder beweging: haken open en de lijn helemaal getekend, en dan stil.
const RUSTSTAND = 0.55;

function glad(van: number, tot: number, x: number): number {
  'worklet';
  const t = Math.min(Math.max((x - van) / (tot - van), 0), 1);
  return t * t * (3 - 2 * t);
}

interface Props {
  maat?: number;
  // Kleur van de koerslijn (alleen zonder children). De haken blijven altijd gedimd.
  kleur?: string;
  children?: React.ReactNode;
}

export function LegeStaatBeeld({ maat = 72, kleur, children }: Props) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const t = useSharedValue(RUSTSTAND);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(t);
      t.value = RUSTSTAND;
      return;
    }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: ADEM_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  // Cosinus in plaats van heen-en-weer-timing: geen knik op het keerpunt, net als echte adem.
  const uitslag = useDerivedValue(() => UITSLAG * (1 - Math.cos(2 * Math.PI * t.value)) / 2);
  const hoek0 = useDerivedValue(() => [{ translateX: RICHTING[0][0] * uitslag.value }, { translateY: RICHTING[0][1] * uitslag.value }]);
  const hoek1 = useDerivedValue(() => [{ translateX: RICHTING[1][0] * uitslag.value }, { translateY: RICHTING[1][1] * uitslag.value }]);
  const hoek2 = useDerivedValue(() => [{ translateX: RICHTING[2][0] * uitslag.value }, { translateY: RICHTING[2][1] * uitslag.value }]);
  const hoek3 = useDerivedValue(() => [{ translateX: RICHTING[3][0] * uitslag.value }, { translateY: RICHTING[3][1] * uitslag.value }]);
  const hoekTransforms = [hoek0, hoek1, hoek2, hoek3];

  // De lijn tekent zich in (einde loopt mee) en trekt daarna vanaf zijn begin weer weg, alsof er
  // een koers voorbijschuift. Tussen twee rondes is hij even helemaal weg.
  const lijnEind = useDerivedValue(() => glad(0.1, 0.5, t.value));
  const lijnBegin = useDerivedValue(() => glad(0.62, 0.95, t.value));

  const schaal = maat / 96;

  return (
    <View style={{ width: maat, height: maat }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ scale: schaal }]}>
          {HOEKEN.map((h, i) => (
            <Group key={h.d} transform={hoekTransforms[i]}>
              <Path
                path={h.pad}
                style="stroke"
                strokeWidth={5}
                strokeCap="round"
                strokeJoin="round"
                color={colors.tekstGedimd}
                opacity={0.55}
              />
            </Group>
          ))}
          {!children && (
            <Path
              path={LIJN}
              style="stroke"
              strokeWidth={4}
              strokeCap="round"
              strokeJoin="round"
              color={kleur ?? colors.cta}
              opacity={0.85}
              start={lijnBegin}
              end={lijnEind}
            />
          )}
        </Group>
      </Canvas>
      {children ? <View style={styles.midden} pointerEvents="none">{children}</View> : null}
    </View>
  );
}

// Voor de inhoud van een lege staat: beeld, titel, tekst en knop komen na elkaar omhoog in plaats
// van als één blok. `volgorde` is de plek in die reeks.
export function Opkomst({ volgorde, style, children }: {
  volgorde: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <Animated.View entering={kaartLandt(volgorde, reduceMotion)} style={style}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  midden: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
