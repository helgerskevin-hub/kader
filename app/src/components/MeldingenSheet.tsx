import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { X, ChevronRight, Bell, Gauge, Trash2 } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useModalKopruimte } from '../theme/useModalKopruimte';
import { useReduceMotion } from '../theme/useReduceMotion';
import { schuifOvergang, uitklapIn, uitklapUit } from '../theme/lijstBeweging';
import { Fonts, Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { PodiumScherm } from './PodiumScherm';
import { CoinLogo } from './CoinLogo';
import { Drukbaar } from './Drukbaar';
import { LijstGroep } from './lijst/LijstGroep';
import { fmtPrijs, relatieveTijd } from '../engine/format';
import { Prijsalert, bewaarAlerts, laadAlerts, wacht } from '../state/prijsalerts';
import { useValutaStand } from '../state/useValuta';
import { useMarkt } from '../state/MarktProvider';
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
    case 'trade': return `Naar ${doel.symbool} in Portfolio`;
    case 'coin': return `Naar ${doel.symbool} op de Markt`;
    case 'portfolio': return 'Naar Portfolio';
    case 'markt': return 'Naar de Markt';
  }
}

const LOGO = 36;
// Waar de haarlijn begint: 16 padding + logo + 12 tussenruimte.
const LIJN_INSPRINGING = 16 + LOGO + 12;

function zelfdeDag(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function MeldingenSheet({ zichtbaar, onSluiten, log, onKies }: Props) {
  const { colors } = useTheme();
  const extraKopruimte = useModalKopruimte();
  const reduceMotion = useReduceMotion();
  // De formatters lezen de valuta uit een gewone module; zonder dit abonnement blijven de
  // alertniveaus na het omzetten in de oude valuta staan.
  useValutaStand();
  const { state } = useMarkt();

  // Huidige koers per symbool uit de laatste marktanalyse. Alleen als die er is: een coin die niet
  // in de scan zit krijgt geen "nu"-regel, want een verzonnen koers is erger dan geen koers.
  const koersen = useMemo(() => {
    const m = new Map<string, number>();
    if (state.status === 'success') {
      for (const t of state.alle) if (t.prijs > 0) m.set(t.symbool.toUpperCase(), t.prijs);
    }
    return m;
  }, [state]);

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

  const { vandaag, eerder } = useMemo(() => {
    const nu = Date.now();
    return {
      vandaag: log.filter(e => zelfdeDag(e.tijd, nu)),
      eerder: log.filter(e => !zelfdeDag(e.tijd, nu)),
    };
  }, [log]);

  return (
    <PodiumScherm zichtbaar={zichtbaar} onSluiten={onSluiten}>
      {sluit => (
        <View style={[styles.root, { backgroundColor: colors.achtergrond }]}>
          <View style={[styles.header, { paddingTop: spacing.base + extraKopruimte }]}>
            <Text accessibilityRole="header" style={[styles.grootTitel, { color: colors.tekstPrimair }]}>
              Meldingen
            </Text>
            <Pressable
              onPress={() => sluit()}
              accessibilityLabel="Sluiten"
              accessibilityRole="button"
              style={[styles.sluitKnop, { backgroundColor: colors.verhoogd }]}
            >
              <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {alerts.length > 0 && (
              <LijstGroep titel={`Wacht op prijs · ${alerts.length}`} lijnInspringing={LIJN_INSPRINGING} style={styles.groep}>
                {alerts.map(alert => {
                  const nu = koersen.get(alert.symbool.toUpperCase());
                  const boven = alert.richting === 'boven';
                  // Alleen een sub als de koers nog niet voorbij het niveau is; anders zou er
                  // "nog -2% te gaan" staan bij een alert die zo afgaat.
                  const nogTeGaan = nu && (boven ? alert.prijs > nu : alert.prijs < nu)
                    ? (Math.abs(alert.prijs - nu) / nu) * 100
                    : null;
                  const titel = `${alert.symbool} ${boven ? 'boven' : 'onder'} ${fmtPrijs(alert.prijs)}`;
                  const sub = nu && nogTeGaan !== null
                    ? `Nu ${fmtPrijs(nu)}, nog ${nogTeGaan.toFixed(1)}% te gaan.`
                    : undefined;
                  return (
                    <Animated.View
                      key={alert.id}
                      layout={schuifOvergang(reduceMotion)}
                      entering={uitklapIn(reduceMotion)}
                      exiting={uitklapUit()}
                      style={styles.rijRand}
                    >
                      <Drukbaar
                        onPress={() => onKies({ soort: 'coin', symbool: alert.symbool })}
                        haptiek="tik"
                        schaal={0.98}
                        accessibilityRole="button"
                        accessibilityLabel={`${titel}${sub ? `. ${sub}` : ''} Naar ${alert.symbool} op de Markt.`}
                        style={styles.rijKlik}
                      >
                        <CoinLogo symbool={alert.symbool} grootte={LOGO} />
                        <View style={styles.tekst}>
                          <Text style={[Type.body, styles.vet, { color: colors.tekstPrimair }]}>{titel}</Text>
                          {sub ? <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{sub}</Text> : null}
                        </View>
                      </Drukbaar>
                      <Pressable
                        onPress={() => verwijder(alert.id)}
                        style={styles.wisKnop}
                        accessibilityRole="button"
                        accessibilityLabel="Alert verwijderen"
                        hitSlop={8}
                      >
                        <Trash2 size={18} color={colors.verlies} strokeWidth={1.75} />
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </LijstGroep>
            )}

            {log.length === 0 ? (
              <Text style={[Type.body, { color: colors.tekstGedimd, lineHeight: 22, paddingHorizontal: spacing.base }]}>
                {alerts.length > 0
                  ? 'Nog geen verstuurde meldingen. Zodra een van je alerts geraakt wordt, staat hij hier.'
                  : 'Nog geen meldingen. Zodra Kader iets over je trades te melden heeft, verschijnt het hier. Zelf een prijs in de gaten laten houden kan ook: tik op het belletje bovenin een coinscherm.'}
              </Text>
            ) : (
              <>
                {vandaag.length > 0 && (
                  <LijstGroep titel="Vandaag" lijnInspringing={LIJN_INSPRINGING} style={styles.groep}>
                    {vandaag.map((entry, i) => (
                      <Regel key={`${entry.tijd}-${i}`} entry={entry} onKies={onKies} />
                    ))}
                  </LijstGroep>
                )}
                {eerder.length > 0 && (
                  <LijstGroep titel="Eerder" lijnInspringing={LIJN_INSPRINGING} style={styles.groep}>
                    {eerder.map((entry, i) => (
                      <Regel key={`${entry.tijd}-${i}`} entry={entry} onKies={onKies} />
                    ))}
                  </LijstGroep>
                )}
              </>
            )}
          </ScrollView>
        </View>
      )}
    </PodiumScherm>
  );
}

// Meldingen van vóór deze versie hebben geen doel. Die blijven leesbaar maar zijn geen knop: een
// tik die nergens op uitkomt is erger dan geen tik.
function Regel({ entry, onKies }: { entry: MeldingLogEntry; onKies: (doel: MeldingDoel) => void }) {
  const { colors } = useTheme();
  const doel = entry.doel;
  const symbool = doel && (doel.soort === 'trade' || doel.soort === 'coin') ? doel.symbool : null;
  const Icoon = doel?.soort === 'markt' ? Gauge : Bell;

  const inhoud = (
    <>
      {symbool ? (
        <CoinLogo symbool={symbool} grootte={LOGO} />
      ) : (
        <View style={[styles.tegel, { backgroundColor: colors.verhoogd }]}>
          <Icoon size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
        </View>
      )}
      <View style={styles.tekst}>
        <Text style={[Type.body, styles.vet, { color: colors.tekstPrimair }]}>{entry.titel}</Text>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{entry.tekst}</Text>
        {doel ? (
          <View style={styles.bestemmingRij}>
            <Text style={[Type.caption, { color: colors.cta }]}>{bestemming(doel)}</Text>
            <ChevronRight size={13} color={colors.cta} strokeWidth={2} />
          </View>
        ) : null}
      </View>
      <Text style={[Type.caption, styles.tijd, { color: colors.tekstGedimd }]}>{relatieveTijd(entry.tijd)}</Text>
    </>
  );

  if (!doel) return <View style={styles.rijKlik}>{inhoud}</View>;

  return (
    <Drukbaar
      onPress={() => onKies(doel)}
      haptiek="tik"
      schaal={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${entry.titel}. ${entry.tekst} ${bestemming(doel)}.`}
      style={styles.rijKlik}
    >
      {inhoud}
    </Drukbaar>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  grootTitel: { flex: 1, fontFamily: Fonts.sansSemiBold, fontSize: 28, lineHeight: 34, fontWeight: '600' },
  sluitKnop: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  scroll: { paddingTop: spacing.sm, paddingBottom: spacing.xl },
  groep: { marginHorizontal: spacing.base, marginBottom: spacing.lg },
  rijRand: { flexDirection: 'row', alignItems: 'center' },
  rijKlik: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  tegel: { width: LOGO, height: LOGO, borderRadius: radii.veld, alignItems: 'center', justifyContent: 'center' },
  tekst: { flex: 1, flexShrink: 1, gap: 2 },
  vet: { fontWeight: '600' },
  tijd: { flexShrink: 0 },
  bestemmingRij: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: spacing.xs },
  wisKnop: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
