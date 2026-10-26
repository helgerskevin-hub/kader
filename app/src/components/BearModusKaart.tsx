import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldAlert, Briefcase, TrendingUp, Bell, type LucideIcon } from 'lucide-react-native';
import { BearModusStand } from '../state/bearModus';
import { fmtPct } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import Animated from 'react-native-reanimated';
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
  const { open, wissel, schuif } = useUitleg();

  // Pas vanaf een hele dag heeft de teller iets te zeggen. Op dag nul zou er "0 dagen" en "+0,0%"
  // staan, wat de kaart eerder kapot laat lijken dan informatief.
  const toonTeller = stand !== null && stand.dagen >= 1;

  return (
    <Animated.View layout={schuif} style={[styles.wrapper, shadow.kaart, { backgroundColor: colors.kaart }]}>
      <View style={styles.kop}>
        <View style={[styles.tegel, { backgroundColor: colors.verlies + '1F' }]}>
          <ShieldAlert size={17} color={colors.verlies} strokeWidth={1.75} />
        </View>
        <Text style={[Type.sectiekop, styles.kopTitel, { color: colors.tekstPrimair }]}>Bear-modus</Text>
        <View style={[styles.pil, { backgroundColor: colors.verlies + '1F' }]}>
          <Text style={[Type.caption, styles.pilTekst, { color: colors.verlies }]}>Actief</Text>
        </View>
        <UitlegKnop open={open} onWissel={wissel} onderwerp="bear-modus" />
      </View>

      <Text style={[Type.body, styles.lopendeTekst, { color: colors.tekstPrimair }]}>
        Kader geeft nu geen koopsignalen. De markt daalt breed, en in dat soort periodes verloren
        koopsignalen historisch gemiddeld geld.
      </Text>

      {toonTeller && (
        <View style={styles.tegelRij}>
          <View style={[styles.teller, { backgroundColor: colors.verhoogd }]}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>AL</Text>
            <Text style={[Type.titel, { color: colors.tekstPrimair }]}>
              {stand.dagen} {stand.dagen === 1 ? 'dag' : 'dagen'}
            </Text>
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>geen koopsignaal</Text>
          </View>
          <View style={[styles.teller, { backgroundColor: colors.verhoogd }]}>
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

      <View style={[styles.lijst, { borderTopColor: colors.rand }]}>
        <Text style={[Type.overline, styles.lijstKop, { color: colors.tekstGedimd }]}>WAAR KADER NU OP LET</Text>
        <Aandachtspunt
          icoon={Briefcase}
          titel="Je open posities"
          sub="Wat is het beschermen waard, en wat houdt nog stand."
        />
        <Aandachtspunt
          icoon={TrendingUp}
          titel="Wie standhoudt"
          sub="Coins die het beter doen dan bitcoin, als watchlist voor later."
        />
        <Aandachtspunt
          icoon={Bell}
          titel="De omslag"
          sub="Je krijgt een melding zodra het klimaat weer draait."
        />
      </View>

      <UitlegTekst open={open} tekst={UITLEG} />
    </Animated.View>
  );
}

// Zelfde opbouw als een LijstRij (getinte tegel, titel, regel eronder), maar zonder de eigen
// zijmarge daarvan: binnen deze kaart zou die dubbel inspringen.
function Aandachtspunt({ icoon: Icoon, titel, sub }: { icoon: LucideIcon; titel: string; sub: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.puntRij}>
      <View style={[styles.tegel, { backgroundColor: colors.verhoogd }]}>
        <Icoon size={17} color={colors.tekstGedimd} strokeWidth={1.75} />
      </View>
      <View style={styles.puntTekst}>
        <Text style={[Type.body, { color: colors.tekstPrimair }]}>{titel}</Text>
        <Text style={[Type.caption, styles.puntSub, { color: colors.tekstGedimd }]}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.kaart,
    padding: spacing.base,
    gap: spacing.md,
  },
  kop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kopTitel: { flex: 1 },
  tegel: {
    width: 30,
    height: 30,
    borderRadius: radii.veld,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pil: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.pill,
  },
  pilTekst: { fontWeight: '700' },
  lopendeTekst: { lineHeight: 22 },
  tegelRij: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  teller: {
    flex: 1,
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.knop,
  },
  lijst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  lijstKop: { marginBottom: -spacing.xs },
  puntRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  puntTekst: { flex: 1 },
  puntSub: { lineHeight: 18 },
});
