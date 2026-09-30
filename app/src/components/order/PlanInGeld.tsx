import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Type, Fonts } from '../../theme/typography';
import { radii } from '../../theme/tokens';
import { AnimatedGetal } from '../AnimatedGetal';
import { StopDoelBaan } from '../StopDoelBaan';

interface Props {
  entry: number;
  stop?: number;
  doel?: number;
  live?: number;
  bijStop: number | null;
  bijDoel: number | null;
  rr: number | null;
  stopAangepast?: boolean;
  // Staat in de STOP-tegel in plaats van het bedrag als eToro de stop zelf zet ("eToro kiest de stop").
  stopTekst?: string;
  titel?: string;
  doelLabel?: string;
}

const WAARDE_GROOTTE = 17;

// Op honderdsten afronden voor teken en kleur: -0,004 toont "$0.00" en hoort dan niet rood te zijn.
const rond = (n: number) => Math.round(n * 100) / 100;

// Bedrag met teken, zoals in het ontwerp: "-$16.01", "+$38.15". Nul krijgt geen teken.
function fmtMetTeken(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n === 0) return `$${abs}`;
  return `${n < 0 ? '-' : '+'}$${abs}`;
}

const fmtRRKomma = (rr: number) => `1 : ${rr.toFixed(1).replace('.', ',')}`;

// Wat het plan in dollars betekent voor het bedrag dat je nu intikt: de baan met stop, entry en
// doel, en twee tegels met wat je verliest of wint. Groen en rood staan alleen op de getallen.
export function PlanInGeldKaart({
  entry, stop, doel, live, bijStop, bijDoel, rr, stopAangepast, stopTekst,
  titel = 'PLAN VAN KADER', doelLabel = 'BIJ DOEL',
}: Props) {
  const { colors } = useTheme();
  const heeftBaan = typeof stop === 'number' && stop > 0 && typeof doel === 'number' && doel > 0;

  return (
    <View style={[styles.blok, { backgroundColor: colors.verhoogd }]}>
      <View style={styles.kop}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>{titel}</Text>
        {rr !== null && (
          <View style={[styles.chip, { backgroundColor: colors.kaart }]}>
            <Text style={[styles.chipTekst, { color: colors.tekstGedimd }]}>R/R {fmtRRKomma(rr)}</Text>
          </View>
        )}
      </View>

      {heeftBaan && (
        // De baan tekent zijn spoor in colors.verhoogd, en dat is ook de kleur van dit blok. Op een
        // eigen kaart-vlak blijft hij zichtbaar.
        <View style={[styles.baanVlak, { backgroundColor: colors.kaart }]}>
          <StopDoelBaan
            stop={stop}
            entry={entry}
            doel={doel}
            live={live}
            labels
            stopAangepast={stopAangepast}
          />
        </View>
      )}

      <View style={styles.tegels}>
        <Tegel
          label="BIJ STOP"
          waarde={bijStop}
          vervang={stopTekst}
        />
        <Tegel label={doelLabel} waarde={bijDoel} />
      </View>
    </View>
  );
}

function Tegel({ label, waarde, vervang }: { label: string; waarde: number | null; vervang?: string }) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const afgerond = waarde === null ? null : rond(waarde);

  const leesbaar = vervang ?? (afgerond === null ? 'geen' : fmtMetTeken(afgerond));

  return (
    <View
      style={[styles.tegel, { backgroundColor: colors.kaart }]}
      accessible
      accessibilityLabel={`${label.toLowerCase()}: ${leesbaar}`}
    >
      <Text style={[Type.overline, { color: colors.tekstGedimd }]} importantForAccessibility="no">
        {label}
      </Text>
      {vervang !== undefined ? (
        <Text style={[Type.caption, { color: colors.tekstGedimd }]} importantForAccessibility="no">
          {vervang}
        </Text>
      ) : afgerond === null ? (
        <Text style={[Type.caption, { color: colors.tekstGedimd }]} importantForAccessibility="no">
          geen
        </Text>
      ) : (
        <GeldGetal waarde={afgerond} format={fmtMetTeken} neutraal={colors.tekstPrimair} />
      )}
    </View>
  );
}

// Een bedrag in dollars dat altijd op één regel past. AnimatedGetal zet de cijfers naast elkaar en
// kent geen krimpen, dus meten we de beschikbare breedte en kiezen de letter zo dat het hele getal
// past (mono, ruim 0,7 em per teken inclusief de marge van de rolkolommen). De systeemletter telt mee tot 1,2x. Zo breekt
// "-$12,071.43" op 360 dp met grote letter niet meer midden in het getal af.
export function GeldGetal({ waarde, format, neutraal, grootte = WAARDE_GROOTTE }: {
  waarde: number;
  format: (n: number) => string;
  neutraal: string;
  grootte?: number;
}) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [breedte, setBreedte] = useState(0);
  const tekens = format(waarde).length;
  const gewenst = grootte * Math.min(fontScale, 1.2);
  const passend = breedte > 0 ? breedte / (tekens * 0.72) : gewenst;
  // AnimatedGetal schaalt zelf nog met de systeemletter, dus hier terugrekenen.
  const letter = Math.min(gewenst, passend) / fontScale;
  return (
    <View onLayout={e => setBreedte(e.nativeEvent.layout.width)}>
      <AnimatedGetal
        waarde={waarde}
        format={format}
        style={{
          fontFamily: Fonts.monoMedium,
          fontWeight: '500',
          fontVariant: ['tabular-nums'],
          fontSize: letter,
          lineHeight: letter * 1.3,
          color: neutraal,
        }}
        kleurBijTeken={{ positief: colors.winst, negatief: colors.verlies, neutraal }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blok: { borderRadius: 18, padding: 14, gap: 12 },
  kop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: radii.pill },
  chipTekst: { fontFamily: Fonts.monoMedium, fontWeight: '500', fontSize: 11.5, lineHeight: 14 },
  baanVlak: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  tegels: { flexDirection: 'row', gap: 8 },
  tegel: { flex: 1, minWidth: 0, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
});
