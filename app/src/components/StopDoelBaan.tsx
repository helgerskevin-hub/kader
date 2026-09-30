import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii } from '../theme/tokens';
import { staggerVertraging, veer } from '../theme/beweging';
import { useReduceMotion } from '../theme/useReduceMotion';
import { fmtPrijs } from '../engine/format';
import { useValutaStand } from '../state/useValuta';
import { AangepastPil } from './LevelRow';

interface Props {
  stop: number;
  entry: number;
  doel: number;
  // De huidige koers. Zonder koers alleen de baan en het entry-streepje, zonder vulling en stip.
  live?: number;
  // STOP en DOEL met hun prijs onder de baan.
  labels?: boolean;
  // De stop staat op eToro's grens en niet op die van Kader: dan komt de AANGEPAST-pil naast het
  // STOP-label, zoals in de niveaurij van de uitklap. Alleen zichtbaar met labels.
  stopAangepast?: boolean;
  // Uit als een omliggend tikvlak al een eigen label draagt: TalkBack leest dan niet twee keer
  // dezelfde koers voor, en het tikvlak blijft één element.
  accessible?: boolean;
  // Plek in de lijst, voor de staffeling van het landen (zie staggerVertraging).
  volgorde?: number;
}

const BAAN_HOOGTE = 6;
const STIP = 14;
const STREEP_HOOGTE = 14;

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

// Waar de koers staat tussen stop en doel, als één baan. De positie is (v - stop) / (doel - stop):
// de stop ligt altijd links en het doel altijd rechts, dus rechts is altijd beter. Bij een short
// liggen stop en doel andersom in prijs, maar deze formule draait dan vanzelf mee; er is geen
// aparte tak voor nodig.
//
// De vulling loopt van entry naar koers, groen als de koers de goede kant op staat en rood als
// niet. Alleen transform: de vulling is een View van volle breedte die met scaleX + een
// terugschuivende translateX op zijn plek komt (zoals de vermogensbalk op Portfolio), de stip
// schuift met translateX. Zo hoeft React Native per frame geen layout uit te rekenen.
export function StopDoelBaan({
  stop, entry, doel, live, labels = false, stopAangepast = false, accessible = true, volgorde = 0,
}: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement blijven
  // de prijzen na het omzetten in de oude valuta staan.
  useValutaStand();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [breedte, setBreedte] = useState(0);

  const geldig = stop > 0 && doel > 0 && doel !== stop;
  const positie = (v: number) => (geldig ? clamp01((v - stop) / (doel - stop)) : 0);
  const entryPos = positie(entry);
  const heeftLive = typeof live === 'number' && Number.isFinite(live);
  const livePos = heeftLive ? positie(live) : entryPos;
  // Gunstig is het oordeel over de ECHTE koers, niet over de afgekapte posities: buiten de baan zijn
  // livePos en entryPos allebei 0 of 1 en zouden dan gelijk zijn, terwijl de koers wel degelijk
  // onder de entry (of onder de stop) kan staan. sign(doel - stop) draait het voor een short mee.
  const gunstig = heeftLive && (live - entry) * Math.sign(doel - stop) >= 0;
  const vullingKleur = gunstig ? colors.winst : colors.verlies;

  // Waar de koers op de baan staat, als fractie. Vulling en stip lezen allebei deze ene waarde,
  // zodat ze nooit uit de pas lopen.
  const koers = useSharedValue(reduceMotion ? livePos : entryPos);
  const stipSchaal = useSharedValue(reduceMotion && heeftLive ? 1 : 0);
  // Het eerste landen (stip springt in, vulling groeit vanaf de entry) gebeurt één keer. Daarna
  // schuift alles alleen nog naar de nieuwe koers. Valt de koers weg, dan landt hij opnieuw.
  const geland = useRef(false);
  const gemeten = breedte > 0;

  useEffect(() => {
    if (!heeftLive) {
      geland.current = false;
      stipSchaal.value = 0;
      return;
    }
    // Zonder breedte is er nog niets te zien; landen zou dan onzichtbaar voorbij gaan.
    if (!gemeten) return;
    if (reduceMotion) {
      koers.value = livePos;
      stipSchaal.value = 1;
      geland.current = true;
      return;
    }
    if (!geland.current) {
      geland.current = true;
      const vertraging = staggerVertraging(volgorde);
      koers.value = entryPos;
      koers.value = withDelay(vertraging, withSpring(livePos, veer.standaard));
      stipSchaal.value = 0;
      stipSchaal.value = withDelay(vertraging, withSpring(1, veer.speels));
      return;
    }
    koers.value = withSpring(livePos, veer.standaard);
    // volgorde telt alleen voor het eerste landen; een kaart die in de lijst opschuift hoort niet
    // opnieuw te landen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heeftLive, gemeten, livePos, entryPos, reduceMotion]);

  const vullingStijl = useAnimatedStyle(() => {
    const van = Math.min(entryPos, koers.value);
    const s = Math.abs(koers.value - entryPos);
    return {
      // Opschalen vanuit het midden en dan terugschuiven tot de linkerkant precies op `van` staat.
      transform: [{ translateX: van * breedte - (breedte / 2) * (1 - s) }, { scaleX: s }],
    };
  }, [breedte, entryPos]);

  const stipStijl = useAnimatedStyle(() => ({
    transform: [{ translateX: koers.value * breedte }, { scale: stipSchaal.value }],
  }), [breedte]);

  // Kan de baan niet getekend worden (een ontbrekende stop of doel), dan blijven met labels de
  // waarden zelf staan: een positie zonder stop moet dat ook zeggen, in plaats van niets te tonen.
  if (!geldig && !labels) return null;

  function opLayout(e: LayoutChangeEvent) {
    setBreedte(e.nativeEvent.layout.width);
  }

  const stopTekst = stop > 0 ? fmtPrijs(stop) : 'Geen';
  const doelTekst = doel > 0 ? fmtPrijs(doel) : 'Geen';
  const label = geldig && heeftLive
    ? `Koers ${fmtPrijs(live)} tussen stop ${stopTekst} en doel ${doelTekst}`
    : `Stop ${stopTekst}, doel ${doelTekst}`;

  return (
    <View accessible={accessible} accessibilityLabel={label} style={styles.container}>
      {/* Ruimte boven en onder de baan, zodat het streepje en de stip (allebei 14 hoog) er niet
          buiten vallen en de rij eronder niet raken. */}
      {geldig && (
        <View style={styles.baanVak}>
          <View
            style={[styles.baan, { backgroundColor: colors.verhoogd }]}
            onLayout={opLayout}
          >
            {heeftLive && gemeten && (
              <Animated.View
                pointerEvents="none"
                style={[styles.vulling, { backgroundColor: vullingKleur }, vullingStijl]}
              />
            )}
            <View
              pointerEvents="none"
              style={[
                styles.entry,
                { left: `${entryPos * 100}%`, backgroundColor: colors.tekstPrimair },
              ]}
            />
            {heeftLive && gemeten && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.stip,
                  { backgroundColor: colors.kaart, borderColor: vullingKleur },
                  stipStijl,
                ]}
              />
            )}
          </View>
        </View>
      )}

      {labels && (
        <View style={styles.labelsRij}>
          <View style={styles.labelPaar}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>STOP</Text>
            {stopAangepast && <AangepastPil />}
            <Text style={[Type.prijs, styles.prijs, { color: stop > 0 ? colors.tekstPrimair : colors.tekstGedimd }]}>
              {stopTekst}
            </Text>
          </View>
          <View style={styles.labelPaar}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>DOEL</Text>
            <Text style={[Type.prijs, styles.prijs, { color: doel > 0 ? colors.tekstPrimair : colors.tekstGedimd }]}>
              {doelTekst}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  baanVak: { paddingVertical: (STIP - BAAN_HOOGTE) / 2 },
  baan: {
    height: BAAN_HOOGTE,
    borderRadius: radii.pill,
    overflow: 'visible',
  },
  vulling: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: BAAN_HOOGTE,
    borderRadius: radii.pill,
  },
  entry: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: STREEP_HOOGTE,
    marginLeft: -1,
    borderRadius: 1,
    opacity: 0.55,
  },
  // Links op -STIP/2, zodat translateX het midden van de stip op de koers zet.
  stip: {
    position: 'absolute',
    top: (BAAN_HOOGTE - STIP) / 2,
    left: -STIP / 2,
    width: STIP,
    height: STIP,
    borderRadius: STIP / 2,
    borderWidth: 3,
  },
  // Mag afbreken: met een grote systeemletter passen twee lange prijzen niet naast elkaar.
  labelsRij: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  labelPaar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prijs: { fontSize: 12.5 },
});
