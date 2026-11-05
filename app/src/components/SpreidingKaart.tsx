import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Network } from 'lucide-react-native';
import { STERK, MATIG, berekenSpreiding, samenhangVan } from '../engine/correlatie';
import { useDagKoersen } from '../state/useDagKoersen';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts, Type } from '../theme/typography';
import { radii, shadow, spacing } from '../theme/tokens';
import { staggerVertraging } from '../theme/beweging';
import { useBeweging, useReduceMotion } from '../theme/useReduceMotion';
import { kaartLandt, uitklapInGestaffeld } from '../theme/lijstBeweging';
import { AnimatedGetal } from './AnimatedGetal';
import { CoinLogo } from './CoinLogo';
import { UitlegKnop, UitlegTekst, useUitleg } from './UitlegKnop';

const UITLEG = `Crypto beweegt vaak samen: daalt BTC, dan dalen de meeste altcoins mee. Vijf posities die allemaal met BTC meebewegen beschermen je dan nauwelijks beter dan één grote. Kader meet hoe sterk je posities de afgelopen 30 dagen op dezelfde dagen stegen en daalden, en rekent dat om naar het aantal losse weddenschappen dat je eigenlijk hebt. Vanaf ${STERK.toFixed(1)} heet de samenhang sterk, vanaf ${MATIG.toFixed(1)} matig.`;

// Op Portfolio: hoeveel losse weddenschappen je open posities samen eigenlijk zijn. Alleen vanaf
// twee posities met genoeg koersdata.
export function SpreidingKaart({ symbolen }: { symbolen: string[] }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { naar } = useBeweging();
  const { open, wissel, schuif } = useUitleg();
  const nodig = useMemo(() => [...symbolen, 'BTC'], [symbolen]);
  const koersen = useDagKoersen(nodig, symbolen.length >= 2);
  const stand = useMemo(() => berekenSpreiding(symbolen, koersen), [symbolen, koersen]);

  const [getoond, setGetoond] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setGetoond(stand?.effectief ?? 0), staggerVertraging(1));
    return () => clearTimeout(t);
  }, [stand?.effectief]);
  const vul = useSharedValue(0);
  useEffect(() => {
    vul.value = naar(stand ? Math.min(1, stand.effectief / stand.aantal) : 0, 'standaard');
  }, [stand, naar, vul]);
  const vulStijl = useAnimatedStyle(() => ({ transform: [{ scaleX: vul.value }] }));

  if (!stand) return null;
  const zin = stand.gemCorrelatie >= STERK
    ? 'Je posities bewegen sterk samen: zakt BTC, dan zakken ze vrijwel allemaal mee.'
    : stand.gemCorrelatie >= MATIG
      ? 'Je posities bewegen deels samen. Een flinke daling van BTC raakt de meeste ervan.'
      : 'Je posities bewegen grotendeels los van elkaar.';

  return (
    <Animated.View entering={kaartLandt(2, reduceMotion)} layout={schuif} style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>
      <View style={styles.kop}>
        <View style={[styles.tegel, { backgroundColor: colors.primair + '1F' }]}>
          <Network size={17} color={colors.primair} strokeWidth={1.75} />
        </View>
        <Text style={[Type.sectiekop, { color: colors.tekstPrimair, flex: 1 }]}>Spreiding</Text>
        <UitlegKnop open={open} onWissel={wissel} onderwerp="spreiding" />
      </View>
      <UitlegTekst open={open} tekst={UITLEG} />

      <View style={{ gap: spacing.sm }}>
        <View style={styles.getalRij} accessible accessibilityLabel={`${stand.effectief.toFixed(1)} losse weddenschappen uit ${stand.aantal} posities`}>
          <AnimatedGetal waarde={getoond} format={n => n.toFixed(1)} style={[styles.getal, { color: colors.tekstPrimair }]} />
          <Text style={[Type.caption, { color: colors.tekstGedimd, flexShrink: 1 }]}>losse weddenschappen uit {stand.aantal} posities</Text>
        </View>
        <View style={[styles.balk, { backgroundColor: colors.verhoogd }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={[styles.vul, { backgroundColor: colors.primair }, vulStijl]} />
        </View>
        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>{zin}</Text>
      </View>

      <View style={[styles.lijst, { backgroundColor: colors.verhoogd }]}>
        {stand.perPositie.map((p, i) => (
          <Animated.View
            key={p.symbool}
            entering={uitklapInGestaffeld(i, reduceMotion)}
            style={[styles.rij, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rand }]}
            accessible
            accessibilityLabel={`${p.symbool}: ${regelVoor(p.symbool, p.metBtc)}`}
          >
            <CoinLogo symbool={p.symbool} grootte={30} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[Type.body, { color: colors.tekstPrimair }]}>{p.symbool}</Text>
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{regelVoor(p.symbool, p.metBtc)}</Text>
            </View>
            {p.metBtc !== null && p.symbool !== 'BTC' && (
              <Text style={[styles.waarde, { color: colors.tekstPrimair }]}>{p.metBtc.toFixed(2)}</Text>
            )}
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

function regelVoor(symbool: string, r: number | null): string {
  if (symbool === 'BTC') return 'Dit is BTC zelf';
  if (r === null) return 'Te weinig koersdata';
  return `Beweegt ${samenhangVan(r)} mee met BTC`;
}

const styles = StyleSheet.create({
  kaart: { marginHorizontal: spacing.base, marginTop: spacing.md, borderRadius: radii.kaart, padding: spacing.base, gap: spacing.md },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  tegel: { width: 30, height: 30, borderRadius: radii.veld, alignItems: 'center', justifyContent: 'center' },
  getalRij: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  getal: { fontFamily: Fonts.monoMedium, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  balk: { height: 8, borderRadius: radii.pill, overflow: 'hidden' },
  vul: { flex: 1, borderRadius: radii.pill, transformOrigin: 'left' },
  lijst: { borderRadius: radii.knop, overflow: 'hidden' },
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  waarde: { fontFamily: Fonts.monoMedium, fontSize: 14, fontVariant: ['tabular-nums'] },
});
