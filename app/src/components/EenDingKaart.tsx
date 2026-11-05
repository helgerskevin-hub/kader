import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ArrowUp, ChevronRight, Coffee, Target, X, Zap, type LucideIcon } from 'lucide-react-native';
import { laadObject, bewaarObject, SLEUTELS } from '../storage/opslag';
import { EenDing, EenDingSoort, Weggeveegd, dagSleutel, toonEenDing } from '../state/eenDing';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, shadow, spacing } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { schuifOvergang, uitklapIn, uitklapUit } from '../theme/lijstBeweging';
import { Drukbaar } from './Drukbaar';

const ICOON: Record<EenDingSoort, LucideIcon> = {
  doelBereikt: Target,
  bijnaDoel: Target,
  stopOptrekken: ArrowUp,
  signaal: Zap,
  niets: Coffee,
};

// Eén kaart bovenaan Markt met het belangrijkste van vandaag. Een tik opent de actie zelf; het
// kruisje veegt hem weg tot morgen, tenzij er iets belangrijkers bijkomt.
export function EenDingKaart({ ding, onActie }: { ding: EenDing; onActie: (d: EenDing) => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [weg, setWeg] = useState<Weggeveegd | null | undefined>(undefined);

  useEffect(() => {
    laadObject<Weggeveegd>(SLEUTELS.eenDingWeg).then(setWeg).catch(() => setWeg(null));
  }, []);

  // Wachten op de opslag: anders knippert een weggeveegde kaart bij elke start even op.
  if (weg === undefined || !toonEenDing(ding, weg, Date.now())) return null;

  const tint = ding.soort === 'niets' ? null
    : ding.soort === 'doelBereikt' || ding.soort === 'bijnaDoel' ? colors.winst
    : colors.primair;
  const Icoon = ICOON[ding.soort];

  function veegWeg() {
    const nieuw: Weggeveegd = { dag: dagSleutel(Date.now()), sleutel: ding.sleutel, prio: ding.prio };
    setWeg(nieuw);
    bewaarObject(SLEUTELS.eenDingWeg, nieuw).catch(() => {});
  }

  const inhoud = (
    <>
      <View style={styles.boven}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>EÉN DING VANDAAG</Text>
        <Pressable onPress={veegWeg} hitSlop={10} accessibilityRole="button" accessibilityLabel="Wegvegen tot morgen" style={styles.kruis}>
          <X size={16} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>
      <View style={styles.kop}>
        <View style={[styles.tegel, { backgroundColor: tint ? tint + '1F' : colors.verhoogd }]}>
          <Icoon size={17} color={tint ?? colors.tekstGedimd} strokeWidth={1.75} />
        </View>
        <Text style={[Type.sectiekop, { color: colors.tekstPrimair, flex: 1 }]}>{ding.titel}</Text>
        {ding.actie ? <ChevronRight size={16} color={colors.tekstGedimd} strokeWidth={1.75} /> : null}
      </View>
      <Text style={[Type.caption, styles.zin, { color: colors.tekstGedimd }]}>{ding.tekst}</Text>
      {ding.actie ? <Text style={[Type.caption, styles.actie, { color: colors.cta }]}>{ding.actie}</Text> : null}
    </>
  );

  return (
    <Animated.View key={ding.sleutel} entering={uitklapIn(reduceMotion)} exiting={uitklapUit()} layout={schuifOvergang(reduceMotion)} style={styles.buiten}>
      {ding.actie ? (
        <Drukbaar
          onPress={() => onActie(ding)}
          style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}
          accessibilityRole="button"
          accessibilityLabel={`${ding.titel}. ${ding.actie}`}
        >
          {inhoud}
        </Drukbaar>
      ) : (
        <View style={[styles.kaart, shadow.kaart, { backgroundColor: colors.kaart }]}>{inhoud}</View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  buiten: { marginHorizontal: spacing.base, marginTop: spacing.md, marginBottom: spacing.sm },
  kaart: { borderRadius: radii.kaart, padding: spacing.base, gap: spacing.sm },
  boven: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kruis: { padding: 4, margin: -4 },
  kop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  tegel: { width: 30, height: 30, borderRadius: radii.veld, alignItems: 'center', justifyContent: 'center' },
  zin: { lineHeight: 19 },
  actie: { fontWeight: '600', fontSize: 13 },
});
