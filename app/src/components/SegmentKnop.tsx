import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts } from '../theme/typography';
import { radii, shadow } from '../theme/tokens';
import { veer } from '../theme/beweging';
import { haptiek } from '../theme/haptiek';
import { useReduceMotion } from '../theme/useReduceMotion';
import { useVasthouden } from '../theme/useVasthouden';
import { useSchermlezer } from '../theme/useSchermlezer';
import { HoudVastVulling } from './HoudVastVulling';

export interface SegmentOptie<T extends string> {
  id: T;
  label: string;
  // Voorleestekst als het label zelf te kort is om te begrijpen, zoals "1M" voor "Eén maand".
  uitleg?: string;
}

interface Props<T extends string> {
  opties: SegmentOptie<T>[];
  actief: T;
  onKies: (id: T) => void;
  // Keuzes die je niet met een losse tik kiest maar door ingedrukt te houden, omdat ze te veel
  // gevolgen hebben om per ongeluk om te slaan. Na het vasthouden volgt gewoon onKies.
  vasthouden?: T[];
  // Een losse tik op zo'n keuze doet niets; hiermee kan het scherm uitleggen dat vasthouden nodig is.
  onTikZonderVasthouden?: (id: T) => void;
  // Met een schermlezer aan is ingedrukt houden lastig te vinden en te doen. Dan kiest een gewone
  // activering niet zelf, maar vraagt het scherm om een bevestiging (bijvoorbeeld een dialoog).
  schermlezerBevestig?: (id: T) => void;
  // Zolang dit waar is loopt een vasthouden niet af: de vulling veert terug zonder onKies en zonder
  // de stevige haptiek, zodat je geen bevestiging voelt van iets dat niet gebeurt.
  geblokkeerd?: boolean;
}

// Minimumhoogte, geen vaste hoogte: met een grote systeemletter groeit het label mee en moet de rij
// dat ook kunnen, anders knipt de tekst af. 44 is ook meteen de raakmaat: een hitSlop zou buiten de
// rij vallen, en Android geeft een aanraking buiten de ouder niet door aan het kind. De pil hangt
// met een boven- en onderrand aan de rij en volgt zo vanzelf de hoogte van de segmenten.
const MIN_HOOGTE = 44;
const BINNENRAND = 2;

// Een rij keuzes met één pil die van segment naar segment veert, zoals de pil in de tabbalk: je
// ziet de keuze verhuizen in plaats van dat twee knoppen van kleur wisselen. Alle segmenten zijn
// even breed, zodat de pil maar één maat nodig heeft.
export function SegmentKnop<T extends string>({
  opties,
  actief,
  onKies,
  vasthouden,
  onTikZonderVasthouden,
  schermlezerBevestig,
  geblokkeerd = false,
}: Props<T>) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  // Met een schermlezer aan is ingedrukt houden lastig; de stand wordt live gevolgd.
  const schermlezer = useSchermlezer();
  const viaBevestiging = schermlezer && !!schermlezerBevestig;
  // Welke keuze nu vastgehouden wordt. Blijft na loslaten staan, zodat je de vulling ook ziet
  // terugveren; bij voortgang 0 is die onzichtbaar.
  const [vastId, setVastId] = useState<T | null>(null);
  const vastRef = useRef<T | null>(null);
  // Pressable vuurt onPress ook bij het loslaten na een volledige houd; dat is dan geen losse tik.
  const voltooid = useRef(false);
  const { voortgang, start, stop } = useVasthouden({
    geblokkeerd,
    onVoltooid: () => {
      voltooid.current = true;
      const id = vastRef.current;
      // De actieve keuze kan tijdens het vasthouden van elders veranderd zijn: dan is er niets meer
      // te kiezen.
      if (id === null || id === actief) return;
      onKies(id);
    },
  });
  const [rijBreedte, setRijBreedte] = useState(0);
  const actieveIndex = Math.max(0, opties.findIndex(o => o.id === actief));
  // Positie van de pil in segmenten (0, 1, 2, ...), los van de breedte, zodat een nieuwe meting
  // (draaien van het scherm) de pil niet laat glijden.
  const pilIndex = useSharedValue(actieveIndex);

  useEffect(() => {
    pilIndex.value = reduceMotion ? actieveIndex : withSpring(actieveIndex, veer.stevig);
  }, [actieveIndex, reduceMotion, pilIndex]);

  const segmentBreedte = opties.length > 0 ? Math.max(0, rijBreedte - BINNENRAND * 2) / opties.length : 0;

  const pilStijl = useAnimatedStyle(() => ({
    transform: [{ translateX: pilIndex.value * segmentBreedte }],
  }), [segmentBreedte]);

  function opLayout(e: LayoutChangeEvent) {
    setRijBreedte(e.nativeEvent.layout.width);
  }

  function kies(id: T) {
    // Alleen een tik bij een echte wissel: nog eens op de actieve keuze drukken verandert niets.
    if (id === actief) return;
    haptiek('tik');
    onKies(id);
  }

  // Tekstkleur op 22% dekking (0x38), zoals de vulling in het ontwerp: zichtbaar op zowel de rij als
  // de pil, in licht en donker.
  const vulKleur = `${colors.tekstPrimair}38`;

  function isHoudOptie(id: T) {
    return vasthouden?.includes(id) ?? false;
  }

  function opHoudIn(id: T) {
    voltooid.current = false;
    // Met een schermlezer en een bevestiging van het scherm loopt het via die bevestiging (opHoudTik);
    // zonder bevestiging blijft vasthouden de weg, anders was de keuze onbereikbaar.
    if (id === actief || viaBevestiging) return;
    vastRef.current = id;
    setVastId(id);
    start();
  }

  function opHoudUit() {
    stop();
  }

  function opHoudTik(id: T) {
    // Eerst de afgeronde houd: het loslaten daarna is geen nieuwe activering, ook niet als de
    // schermlezer net tijdens het vasthouden aanging.
    if (id === actief || voltooid.current) return;
    if (viaBevestiging) {
      schermlezerBevestig?.(id);
      return;
    }
    onTikZonderVasthouden?.(id);
  }

  return (
    <View
      style={[styles.rij, { backgroundColor: colors.verhoogd }]}
      onLayout={opLayout}
      accessibilityRole="tablist"
    >
      {segmentBreedte > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pil,
            shadow.kaart,
            { width: segmentBreedte, backgroundColor: colors.kaart },
            pilStijl,
          ]}
        />
      )}
      {opties.map(o => {
        const geselecteerd = o.id === actief;
        const houden = isHoudOptie(o.id);
        return (
          <Pressable
            key={o.id}
            style={[styles.segment, houden && styles.houdSegment]}
            onPress={houden ? () => opHoudTik(o.id) : () => kies(o.id)}
            onPressIn={houden ? () => opHoudIn(o.id) : undefined}
            onPressOut={houden ? opHoudUit : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: geselecteerd }}
            accessibilityLabel={o.uitleg ?? o.label}
            accessibilityHint={
              houden && !geselecteerd
                ? viaBevestiging ? 'Dubbeltik om te bevestigen' : 'Houd ingedrukt om te kiezen'
                : undefined
            }
          >
            {/* Vulling die meeloopt met het vasthouden, zoals op de bevestigknop van een echte order. */}
            {houden && vastId === o.id && (
              <HoudVastVulling voortgang={voortgang} kleur={vulKleur} />
            )}
            {/* Eén regel die desnoods krimpt: bij een grote systeemletter brak "Alles" anders midden
                in het woord af. */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[
                styles.label,
                geselecteerd
                  ? { color: colors.tekstPrimair, fontFamily: Fonts.sansSemiBold, fontWeight: '600' }
                  : { color: colors.tekstGedimd },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rij: {
    flexDirection: 'row',
    minHeight: MIN_HOOGTE,
    borderRadius: radii.pill,
    padding: BINNENRAND,
  },
  pil: {
    position: 'absolute',
    top: BINNENRAND,
    bottom: BINNENRAND,
    left: BINNENRAND,
    borderRadius: radii.pill,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Afgeronde hoeken zoals de pil, zodat de vulling niet in een rechthoek buiten de rij uitsteekt.
  houdSegment: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  label: {
    fontFamily: Fonts.sansMedium,
    fontWeight: '500',
    fontSize: 13,
  },
});
