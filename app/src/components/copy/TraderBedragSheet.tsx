// Eigen bedrag per kopie voor één favoriet. Alleen een startbedrag: de koopsheet toont het en je
// bevestigt of past het daar per kopie nog aan. "Standaard" haalt het eigen bedrag weer weg.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheet } from '../BottomSheet';
import { Drukbaar } from '../Drukbaar';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, spacing } from '../../theme/tokens';
import { SNEL } from './CopyInstellingenSheet';
import { MINIMUM_COPY_USD as MINIMUM_USD } from '../../state/copyOpslag';
import { fmtBedrag } from '../../engine/format';

const DOLLARS = { valuta: 'USD' } as const;

interface Props {
  zichtbaar: boolean;
  username: string;
  // Het eigen bedrag van deze trader, of null als hij het standaardbedrag volgt.
  eigen: number | null;
  standaard: number;
  onOpslaan: (bedragUsd: number | null) => void;
  onSluiten: () => void;
}

export function TraderBedragSheet({ zichtbaar, username, eigen, standaard, onOpslaan, onSluiten }: Props) {
  const { colors } = useTheme();
  const [bedrag, setBedrag] = useState('');

  useEffect(() => {
    if (zichtbaar) setBedrag(String(eigen ?? standaard));
  }, [zichtbaar, eigen, standaard]);

  const getal = Math.round(Number(bedrag.replace(',', '.')) * 100) / 100;
  const geldig = Number.isFinite(getal) && getal >= MINIMUM_USD;

  const opslaan = () => {
    if (!geldig) return;
    // Gelijk aan het standaardbedrag is geen eigen bedrag: dan volgt hij een latere wijziging mee.
    onOpslaan(getal === standaard ? null : getal);
    onSluiten();
  };

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten}>
      <View style={styles.inhoud}>
        <View style={styles.titelRij}>
          <Text style={[Type.titel, styles.flex, { color: colors.tekstPrimair }]} numberOfLines={1}>
            Bedrag voor {username}
          </Text>
          <Pressable onPress={onSluiten} accessibilityRole="button" accessibilityLabel="Sluiten" style={styles.sluitKnop}>
            <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        </View>

        <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>Hoeveel zet je per kopie van {username} in?</Text>
        <View style={styles.snelRij}>
          {SNEL.map(w => {
            const actief = getal === w;
            return (
              <Drukbaar
                key={w}
                haptiek="tik"
                onPress={() => setBedrag(String(w))}
                accessibilityRole="button"
                accessibilityState={{ selected: actief }}
                style={[styles.snel, { backgroundColor: actief ? colors.cta : colors.verhoogd }]}
              >
                <Text style={[Type.prijs, { color: actief ? '#FFFFFF' : colors.tekstPrimair }]}>${w}</Text>
              </Drukbaar>
            );
          })}
        </View>
        <View style={[styles.veldRij, { backgroundColor: colors.verhoogd }]}>
          <Text style={[Type.prijs, { color: colors.tekstGedimd }]}>$</Text>
          <TextInput
            value={bedrag}
            onChangeText={setBedrag}
            keyboardType="decimal-pad"
            style={[Type.prijs, styles.veld, { color: colors.tekstPrimair }]}
            accessibilityLabel={`Bedrag per kopie van ${username} in dollars`}
          />
        </View>
        <Text style={[Type.caption, { color: geldig ? colors.tekstGedimd : colors.verlies, lineHeight: 18 }]}>
          {geldig
            ? `Je standaardbedrag is ${fmtBedrag(standaard, DOLLARS)}. In de koopsheet zie je dit bedrag en kun je het per kopie nog aanpassen.`
            : `Het minimum bij eToro is ${fmtBedrag(MINIMUM_USD, DOLLARS)}.`}
        </Text>

        <Drukbaar
          onPress={opslaan}
          disabled={!geldig}
          accessibilityRole="button"
          style={[styles.knop, { backgroundColor: geldig ? colors.cta : colors.verhoogd }]}
        >
          <Text style={[Type.body, { color: geldig ? '#FFFFFF' : colors.tekstGedimd, fontWeight: '600' }]}>Opslaan</Text>
        </Drukbaar>
        {eigen !== null && (
          <Drukbaar
            onPress={() => { onOpslaan(null); onSluiten(); }}
            accessibilityRole="button"
            style={styles.tweedeKnop}
          >
            <Text style={[Type.body, { color: colors.cta }]}>Terug naar standaard ({fmtBedrag(standaard, DOLLARS)})</Text>
          </Drukbaar>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  inhoud: { gap: spacing.md },
  flex: { flex: 1 },
  titelRij: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  snelRij: { flexDirection: 'row', gap: spacing.sm },
  snel: { flex: 1, minHeight: 44, borderRadius: radii.knop, alignItems: 'center', justifyContent: 'center' },
  veldRij: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.base, borderRadius: radii.veld, minHeight: 52,
  },
  veld: { flex: 1, paddingVertical: spacing.md },
  knop: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.knop, minHeight: 48, marginTop: spacing.sm },
  tweedeKnop: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
