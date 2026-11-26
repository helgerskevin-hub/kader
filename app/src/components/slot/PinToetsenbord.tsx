import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Delete, Fingerprint } from 'lucide-react-native';
import { Drukbaar } from '../Drukbaar';
import { useTheme } from '../../theme/ThemeProvider';
import { Fonts } from '../../theme/typography';

// Maten van het slotscherm naar de schermhoogte (hoogte van het venster, dus met edge-to-edge
// inclusief systeembalken). Eén plek, zodat toetsenbord, logo en afstanden samen meeschalen.
export interface SlotMaat {
  // Diameter van een toets in dp.
  toets: number;
  // Ruimte tussen de toetsen, horizontaal en verticaal.
  tussen: number;
  // Logo in de kop: 56, 40 of 0 (geen logo).
  logo: number;
}

export function slotMaatVoorHoogte(hoogte: number): SlotMaat {
  if (hoogte >= 740) return { toets: 72, tussen: 24, logo: 56 };
  if (hoogte >= 620) return { toets: 60, tussen: 20, logo: 40 };
  return { toets: 52, tussen: 16, logo: 0 };
}

export function useSlotMaat(): SlotMaat {
  const { height } = useWindowDimensions();
  return slotMaatVoorHoogte(height);
}

const CIJFERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const HIT_SLOP = 6;

interface Props {
  onCijfer(cijfer: string): void;
  onWis(): void;
  // Toon de biometrie-toets links onder. Zonder deze toets blijft de plek leeg.
  biometrieToets?: boolean;
  onBiometrie?(): void;
  // Wachttijd: de cijfertoetsen en de wis-toets zijn gedimd en doen niets. De biometrie-toets
  // blijft werken, want biometrie telt niet mee in de teller.
  gedimd?: boolean;
  // Er is niets om te wissen: de wis-toets is gedimd.
  leeg?: boolean;
  // Tijdens het controleren van een volledige pincode: invoer even negeren, zonder te dimmen.
  bezig?: boolean;
}

// Eigen 3x4-toetsenbord in plaats van een TextInput: geen systeemtoetsenbord dat meebeweegt, geen
// klembord of autofill bij een pincode, en de toetsen staan op vaste plekken.
function PinToetsenbordBasis({
  onCijfer,
  onWis,
  biometrieToets = false,
  onBiometrie,
  gedimd = false,
  leeg = false,
  bezig = false,
}: Props) {
  const { colors } = useTheme();
  const { toets, tussen } = useSlotMaat();
  const cijferStijl = { width: toets, height: toets, borderRadius: toets / 2 };

  const cijferToets = (c: string) => (
    <Drukbaar
      key={c}
      accessibilityRole="button"
      accessibilityLabel={c}
      accessibilityState={{ disabled: gedimd }}
      hitSlop={HIT_SLOP}
      disabled={gedimd}
      onPress={() => {
        if (!bezig) onCijfer(c);
      }}
      schaal={0.94}
      style={({ pressed }) => [
        styles.toets,
        cijferStijl,
        { backgroundColor: pressed ? colors.rand : colors.verhoogd, opacity: gedimd ? 0.4 : 1 },
      ]}
    >
      <Text
        maxFontSizeMultiplier={1.3}
        allowFontScaling
        style={[styles.cijfer, { color: colors.tekstPrimair }]}
      >
        {c}
      </Text>
    </Drukbaar>
  );

  return (
    <View style={[styles.raster, { width: toets * 3 + tussen * 2, rowGap: tussen, columnGap: tussen }]}>
      {CIJFERS.map(cijferToets)}

      {biometrieToets ? (
        <Drukbaar
          accessibilityRole="button"
          accessibilityLabel="Ontgrendel met vingerafdruk of gezicht"
          hitSlop={HIT_SLOP}
          disabled={bezig}
          accessibilityState={{ disabled: bezig }}
          onPress={onBiometrie}
          schaal={0.94}
          style={[styles.toets, cijferStijl]}
        >
          <Fingerprint size={Math.round(toets * 0.42)} strokeWidth={1.75} color={colors.tekstPrimair} />
        </Drukbaar>
      ) : (
        <View importantForAccessibility="no-hide-descendants" style={cijferStijl} />
      )}

      {cijferToets('0')}

      <Drukbaar
        accessibilityRole="button"
        accessibilityLabel="Wis laatste cijfer"
        accessibilityState={{ disabled: gedimd || leeg }}
        hitSlop={HIT_SLOP}
        disabled={gedimd || leeg}
        onPress={() => {
          if (!bezig) onWis();
        }}
        schaal={0.94}
        style={[styles.toets, cijferStijl, { opacity: gedimd || leeg ? 0.4 : 1 }]}
      >
        <Delete size={Math.round(toets * 0.39)} strokeWidth={1.75} color={colors.tekstPrimair} />
      </Drukbaar>
    </View>
  );
}

// Memo: het toetsenbord rendert alleen opnieuw als zijn props echt veranderen. De aanroepers geven
// stabiele functies mee (usePinInvoer levert useCallback-functies).
export const PinToetsenbord = React.memo(PinToetsenbordBasis);

const styles = StyleSheet.create({
  raster: { flexDirection: 'row', flexWrap: 'wrap' },
  toets: { alignItems: 'center', justifyContent: 'center' },
  cijfer: {
    fontFamily: Fonts.monoMedium,
    fontSize: 28,
    lineHeight: 34,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
});
