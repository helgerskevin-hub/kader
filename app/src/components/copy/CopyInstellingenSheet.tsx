// Instellingen van de Copy-tab. Wordt één keer getoond bij het eerste gebruik en is daarna via het
// tandwiel bereikbaar. Bewust weinig keuzes: hefboom en de stop liggen vast (1x, altijd een stop).
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheet } from '../BottomSheet';
import { Drukbaar } from '../Drukbaar';
import { useTheme } from '../../theme/ThemeProvider';
import { Type } from '../../theme/typography';
import { radii, spacing } from '../../theme/tokens';
import type { CopyInstellingen } from '../../state/copyOpslag';

const SNEL = [25, 50, 100, 250];
// eToro's minimum per positie (gemeten voor BTC x1).
const MINIMUM_USD = 10;

interface Props {
  zichtbaar: boolean;
  huidig: CopyInstellingen;
  onOpslaan: (inst: CopyInstellingen) => void;
  onSluiten: () => void;
}

export function CopyInstellingenSheet({ zichtbaar, huidig, onOpslaan, onSluiten }: Props) {
  const { colors } = useTheme();
  const [bedrag, setBedrag] = useState('');
  const [meldingen, setMeldingen] = useState(true);
  const [stilleUren, setStilleUren] = useState(true);

  useEffect(() => {
    if (!zichtbaar) return;
    setBedrag(String(huidig.bedragUsd));
    setMeldingen(huidig.meldingen);
    setStilleUren(huidig.stilleUren);
  }, [zichtbaar, huidig]);

  const getal = Math.round(Number(bedrag.replace(',', '.')) * 100) / 100;
  const geldig = Number.isFinite(getal) && getal >= MINIMUM_USD;

  const opslaan = () => {
    if (!geldig) return;
    onOpslaan({ bedragUsd: getal, meldingen, stilleUren, ingesteld: true });
    onSluiten();
  };

  const schakelaar = (waarde: boolean, zet: (v: boolean) => void, label: string) => (
    <Switch
      value={waarde}
      onValueChange={zet}
      trackColor={{ true: colors.tekstGedimd, false: colors.rand }}
      thumbColor={waarde ? colors.tekstPrimair : colors.verhoogd}
      accessibilityLabel={label}
    />
  );

  // Bij het eerste bezoek telt elke manier van sluiten als "ingesteld" (met het standaardbedrag),
  // anders komt de intro bij elke start terug.
  const sluit = () => { if (huidig.ingesteld) onSluiten(); else opslaan(); };

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={sluit} velStijl={styles.vel}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inhoud} showsVerticalScrollIndicator={false}>
        <View style={styles.titelRij}>
          <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Copy instellen</Text>
          <Pressable onPress={sluit} accessibilityRole="button" accessibilityLabel="Sluiten" style={styles.sluitKnop}>
            <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        </View>

        <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>Hoeveel zet je per gekopieerde trade in?</Text>
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
            accessibilityLabel="Copybedrag in dollars"
          />
        </View>
        <Text style={[Type.caption, { color: geldig ? colors.tekstGedimd : colors.verlies, lineHeight: 18 }]}>
          {geldig
            ? 'In dollars, want eToro rekent in dollars af. Je kunt het per kopie nog aanpassen.'
            : `Het minimum bij eToro is $${MINIMUM_USD}.`}
        </Text>

        <View style={[styles.lijn, { backgroundColor: colors.rand }]} />

        <View style={styles.schakelRij}>
          <View style={styles.flex}>
            <Text style={[Type.body, { color: colors.tekstPrimair }]}>Meldingen</Text>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Melding als een favoriet een crypto-trade opent</Text>
          </View>
          {schakelaar(meldingen, setMeldingen, 'Meldingen bij nieuwe trades')}
        </View>
        <View style={styles.schakelRij}>
          <View style={styles.flex}>
            <Text style={[Type.body, { color: colors.tekstPrimair }]}>Stille uren</Text>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Geen meldingen tussen 23:00 en 07:00</Text>
          </View>
          {schakelaar(stilleUren, setStilleUren, 'Stille uren')}
        </View>

        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
          Kader kopieert altijd zonder hefboom en altijd met een stop-loss. Zet de trader er zelf geen,
          dan gaat Kaders eigen stop mee.
        </Text>

        <Drukbaar
          onPress={opslaan}
          disabled={!geldig}
          accessibilityRole="button"
          style={[styles.knop, { backgroundColor: geldig ? colors.cta : colors.verhoogd }]}
        >
          <Text style={[Type.body, { color: geldig ? '#FFFFFF' : colors.tekstGedimd, fontWeight: '600' }]}>Opslaan</Text>
        </Drukbaar>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  vel: { maxHeight: '90%' },
  inhoud: { gap: spacing.md },
  titelRij: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  snelRij: { flexDirection: 'row', gap: spacing.sm },
  snel: { flex: 1, minHeight: 44, borderRadius: radii.knop, alignItems: 'center', justifyContent: 'center' },
  veldRij: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.base, borderRadius: radii.veld, minHeight: 52,
  },
  veld: { flex: 1, paddingVertical: spacing.md },
  lijn: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  schakelRij: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  flex: { flex: 1, gap: 2 },
  knop: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.knop, minHeight: 48, marginTop: spacing.sm },
});
