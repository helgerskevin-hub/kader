import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import { BearModusStand } from '../state/bearModus';
import { fmtPct } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useUitleg, UitlegKnop, UitlegTekst } from './UitlegKnop';
import { useValutaStand } from '../state/useValuta';

interface Props {
  stand: BearModusStand | null;
}

const UITLEG = 'Kader kijkt naar twee dingen: staat BTC boven zijn 50-daags gemiddelde, en stijgt het aandeel coins dat boven zijn eigen 50-daags gemiddelde staat? Zijn allebei ongunstig, dan gaat de bear-modus aan. In dat soort periodes (2018, 2022, begin 2026) verloren koopsignalen historisch gemiddeld geld, ook de sterke. Kader verlaagt dan niet stiekem zijn drempels om toch iets te kunnen tonen, want dat is precies de fout die geld kost. In plaats daarvan verschuift de aandacht naar wat je al in de markt hebt staan, naar de coins die standhouden, en naar het moment waarop de markt weer draait. De analyse per coin blijft gewoon zichtbaar in de lijst hieronder, alleen zonder koopsignaal.';

// De kaart die in een dalende markt de plaats inneemt van "Wat moet ik nu kopen?". Dat vak zei in
// dit klimaat alleen "wacht op een sterker signaal", en dat is maandenlang hetzelfde lege antwoord.
// Hier staat wat er aan de hand is, hoe lang al, wat het tot nu toe heeft opgeleverd om niet te
// kopen, en waar Kader in de tussentijd wél op let.
export function BearModusKaart({ stand }: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module; zonder dit abonnement blijft dit
  // vak na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const { open, wissel } = useUitleg();

  // Pas vanaf een hele dag heeft de teller iets te zeggen. Op dag nul zou er "0 dagen" en "+0,0%"
  // staan, wat de kaart eerder kapot laat lijken dan informatief.
  const toonTeller = stand !== null && stand.dagen >= 1;

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.kaart, borderColor: colors.verlies }]}>
      <View style={styles.titelRij}>
        <View style={styles.titelLinks}>
          <ShieldAlert size={16} color={colors.verlies} strokeWidth={2} />
          <Text style={[Type.overline, { color: colors.verlies }]}>BEAR-MODUS ACTIEF</Text>
        </View>
        <UitlegKnop open={open} onWissel={wissel} onderwerp="bear-modus" />
      </View>

      <Text style={[Type.body, { color: colors.tekstPrimair, lineHeight: 22 }]}>
        Kader geeft nu geen koopsignalen. De markt daalt breed, en in dat soort periodes verloren
        koopsignalen historisch gemiddeld geld.
      </Text>

      {toonTeller && (
        <View style={styles.tegelRij}>
          <View style={[styles.tegel, { backgroundColor: colors.verhoogd }]}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>AL</Text>
            <Text style={[Type.titel, { color: colors.tekstPrimair }]}>
              {stand.dagen} {stand.dagen === 1 ? 'dag' : 'dagen'}
            </Text>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>geen koopsignaal</Text>
          </View>
          <View style={[styles.tegel, { backgroundColor: colors.verhoogd }]}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>MARKT SINDSDIEN</Text>
            <Text style={[
              Type.titel,
              { color: stand.btcVeranderingPct >= 0 ? colors.winst : colors.verlies },
            ]}>
              {fmtPct(stand.btcVeranderingPct)}
            </Text>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>bitcoin</Text>
          </View>
        </View>
      )}

      {toonTeller && stand.btcVeranderingPct < 0 && (
        <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
          Niet kopen is hier het resultaat: wie in deze periode was ingestapt, keek nu tegen die
          daling aan.
        </Text>
      )}

      <View style={[styles.lijst, { borderTopColor: colors.verhoogd }]}>
        <Text style={[Type.overline, { color: colors.tekstGedimd }]}>WAAR KADER NU OP LET</Text>
        <Punt tekst="Je open posities: wat is het beschermen waard, en wat houdt nog stand." />
        <Punt tekst="Wie standhoudt: coins die het beter doen dan bitcoin, als watchlist voor later." />
        <Punt tekst="De omslag: je krijgt een melding zodra het klimaat weer draait." />
      </View>

      <UitlegTekst open={open} tekst={UITLEG} />
    </View>
  );
}

function Punt({ tekst }: { tekst: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.puntRij}>
      <Text style={[Type.caption, { color: colors.tekstGedimd }]}>·</Text>
      <Text style={[Type.caption, styles.puntTekst, { color: colors.tekstGedimd }]}>{tekst}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.kaart,
    borderLeftWidth: 3,
    padding: spacing.base,
    gap: spacing.sm,
  },
  titelRij: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titelLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tegelRij: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tegel: {
    flex: 1,
    borderRadius: radii.veld,
    padding: spacing.sm,
    gap: 2,
  },
  lijst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  puntRij: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  puntTekst: {
    flex: 1,
    lineHeight: 18,
  },
});
