import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { X, ChevronRight, Bell, Trash2 } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { fmtPrijs, relatieveTijd } from '../engine/format';
import { Prijsalert, bewaarAlerts, laadAlerts, wacht } from '../state/prijsalerts';
import { useValutaStand } from '../state/useValuta';
import { MeldingLogEntry } from '../notifications/tradeChecks';
import { MeldingDoel } from '../notifications/meldingDoel';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  log: MeldingLogEntry[];
  // Tikken op een melding brengt je naar waar hij over gaat: de trade in je portfolio, de coin op
  // het marktscherm, of gewoon het juiste tabblad.
  onKies: (doel: MeldingDoel) => void;
}

// Waar een tik je heen brengt, in het kort. Staat onder de tekst zodat je vóór het tikken weet
// waar je uitkomt; een pijl alleen zegt dat je érgens heen gaat, niet waarheen.
function bestemming(doel: MeldingDoel): string {
  switch (doel.soort) {
    case 'trade': return `Naar ${doel.symbool} in Mijn trades`;
    case 'coin': return `Naar ${doel.symbool} op de Markt`;
    case 'portfolio': return 'Naar Mijn trades';
    case 'markt': return 'Naar de Markt';
  }
}

export function MeldingenSheet({ zichtbaar, onSluiten, log, onKies }: Props) {
  const { colors } = useTheme();
  // De formatters lezen de valuta uit een gewone module; zonder dit abonnement blijven de
  // alertniveaus na het omzetten in de oude valuta staan.
  useValutaStand();

  // Wachtende prijsalerts horen hier en niet alleen op het coinscherm: zet je er een op ICP en
  // kijk je drie weken later, dan is "open elke coin apart" de enige manier om ze terug te vinden.
  // Afgegane alerts staan er niet bij, die zijn als melding al langsgekomen en staan in het log
  // hieronder.
  const [alerts, setAlerts] = useState<Prijsalert[]>([]);

  useEffect(() => {
    if (!zichtbaar) return;
    let actief = true;
    laadAlerts().then(geladen => { if (actief) setAlerts(geladen.filter(wacht)); });
    return () => { actief = false; };
  }, [zichtbaar]);

  async function verwijder(id: string) {
    try {
      // Vers van schijf, niet uit de state hierboven: de achtergrondcheck kan ondertussen een
      // alert op afgegaan hebben gezet en die wijziging mogen we niet overschrijven.
      const actueel = await laadAlerts();
      const volgende = actueel.filter(a => a.id !== id);
      await bewaarAlerts(volgende);
      setAlerts(volgende.filter(wacht));
    } catch {
      // Mislukt: de alert blijft staan en de knop doet het de volgende keer gewoon weer.
    }
  }

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={styles.vel}>
      <View style={styles.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Meldingen</Text>
        <Pressable
          onPress={onSluiten}
          accessibilityLabel="Sluiten"
          accessibilityRole="button"
          style={styles.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
      {alerts.length > 0 && (
        <View style={styles.alertBlok}>
          <Text style={[Type.overline, { color: colors.tekstGedimd, marginBottom: spacing.sm }]}>
            PRIJSALERTS DIE WACHTEN ({alerts.length})
          </Text>
          {alerts.map(alert => (
            <View
              key={alert.id}
              style={[styles.alertRegel, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}
            >
              <Pressable
                style={styles.alertTekst}
                onPress={() => onKies({ soort: 'coin', symbool: alert.symbool })}
                accessibilityRole="button"
                accessibilityLabel={`${alert.symbool} ${alert.richting} ${fmtPrijs(alert.prijs)}, naar de coin op de Markt`}
              >
                <View style={styles.alertKop}>
                  <Bell size={13} color={colors.tekstGedimd} strokeWidth={1.75} />
                  <Text style={[Type.body, { color: colors.tekstPrimair }]}>
                    {alert.symbool} {alert.richting === 'boven' ? 'boven' : 'onder'} {fmtPrijs(alert.prijs)}
                  </Text>
                </View>
                <View style={styles.bestemmingRij}>
                  <Text style={[Type.caption, { color: colors.cta }]}>Naar {alert.symbool} op de Markt</Text>
                  <ChevronRight size={13} color={colors.cta} strokeWidth={2} />
                </View>
              </Pressable>
              <Pressable
                onPress={() => verwijder(alert.id)}
                style={styles.wisKnop}
                accessibilityRole="button"
                accessibilityLabel={`Alert op ${alert.symbool} verwijderen`}
                hitSlop={8}
              >
                <Trash2 size={17} color={colors.verlies} strokeWidth={1.75} />
              </Pressable>
            </View>
          ))}
          <Text style={[Type.overline, { color: colors.tekstGedimd, marginTop: spacing.base }]}>
            VERSTUURD
          </Text>
        </View>
      )}

      {log.length === 0 ? (
        <Text style={[Type.body, { color: colors.tekstGedimd, lineHeight: 22 }]}>
          {alerts.length > 0
            ? 'Nog geen verstuurde meldingen. Zodra een van je alerts geraakt wordt, staat hij hier.'
            : 'Nog geen meldingen. Zodra Kader iets over je trades te melden heeft, verschijnt het hier. Zelf een prijs in de gaten laten houden kan ook: tik op het belletje bovenin een coinscherm.'}
        </Text>
      ) : (
        log.map((entry, i) => (
          <Regel
            key={`${entry.tijd}-${i}`}
            entry={entry}
            onKies={onKies}
          />
        ))
      )}
      </ScrollView>
    </BottomSheet>
  );
}

// Meldingen van vóór deze versie hebben geen doel. Die blijven leesbaar maar zijn geen knop: een
// tik die nergens op uitkomt is erger dan geen tik.
function Regel({ entry, onKies }: { entry: MeldingLogEntry; onKies: (doel: MeldingDoel) => void }) {
  const { colors } = useTheme();
  const doel = entry.doel;

  const inhoud = (
    <>
      <View style={styles.entryKop}>
        <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]} numberOfLines={1}>{entry.titel}</Text>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{relatieveTijd(entry.tijd)}</Text>
      </View>
      <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{entry.tekst}</Text>
    </>
  );

  if (!doel) {
    return (
      <View style={[styles.entry, { borderBottomColor: colors.rand }]}>{inhoud}</View>
    );
  }

  return (
    <Pressable
      onPress={() => onKies(doel)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.titel}. ${entry.tekst} ${bestemming(doel)}.`}
      style={({ pressed }) => [
        styles.entry,
        { borderBottomColor: colors.rand, backgroundColor: pressed ? colors.verhoogd : 'transparent' },
      ]}
    >
      {inhoud}
      <View style={styles.bestemmingRij}>
        <Text style={[Type.caption, { color: colors.cta }]}>{bestemming(doel)}</Text>
        <ChevronRight size={13} color={colors.cta} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  vel: {
    maxHeight: '80%',
  },
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  entry: {
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    // Ademruimte links/rechts zodat de ingedrukte achtergrond niet strak om de tekst valt.
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    borderRadius: radii.veld,
  },
  bestemmingRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.xs,
  },
  alertBlok: { marginBottom: spacing.sm },
  alertRegel: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.veld,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  alertTekst: { flex: 1, gap: 2, minHeight: 44, justifyContent: 'center' },
  alertKop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wisKnop: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  entryKop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
});
