import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { X, LayoutGrid, ShieldCheck, ShoppingCart, Link2, Menu, Info, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts, Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { PilKnop } from './PilKnop';
import { LijstGroep } from './lijst/LijstGroep';
import { NieuwInVersieKaarten } from './NieuwInVersieKaarten';
import { CHANGELOG, type ChangelogEntry } from '../changelog';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
  // Toont alleen de nieuwste versie, voor de "nieuw in deze versie"-melding bij opstarten
  alleenNieuwste?: boolean;
}

// Tussen twee releases staat er "Nog niet uitgebracht" in plaats van een nummer, en daar hoort geen
// v voor: "vNog niet uitgebracht" leest als een fout in de app.
const heeftNummer = (versie: string) => /^\d/.test(versie);
const versieLabel = (versie: string) => (heeftNummer(versie) ? `v${versie}` : versie);

// De changelog kent alleen sleutels (geen UI-imports); hier worden het iconen.
type Hoogtepunt = NonNullable<ChangelogEntry['hoogtepunten']>[number];
const ICONEN: Record<Hoogtepunt['icoon'], LucideIcon> = {
  kaarten: LayoutGrid,
  keurmerk: ShieldCheck,
  koop: ShoppingCart,
  koppeling: Link2,
  menu: Menu,
  informatie: Info,
};

// Hoeveel van het scherm het vel mag vullen, en wat de titelrij en de padding van het vel daarvan
// opeten. Die twee samen geven de hoogte die de lijst zelf overhoudt.
//
// Waarom een uitgerekende hoogte in punten en geen flex: de lijst stond hier eerst zonder eigen
// hoogte in een vel met `maxHeight: '80%'`, en flexShrink is in React Native standaard 0. De lijst
// groeide dus tot zijn volle inhoud en liep onder het vel door, waar hij werd afgekapt: er viel
// niets te scrollen omdat de ScrollView zelf nooit te klein werd. Eerder is hier `flexShrink: 1`
// geprobeerd en dat hielp op het toestel niet (zie 0.1.18 in de changelog). Een expliciete
// maxHeight hoeft niets te onderhandelen: de ScrollView is dan gewoon kleiner dan zijn inhoud en
// scrollt.
const VEL_DEEL_VAN_SCHERM = 0.8;
const RUIMTE_OM_DE_LIJST = 120;
const LIJST_MINIMUM = 160;

export function ChangelogSheet({ zichtbaar, onSluiten, alleenNieuwste }: Props) {
  const { colors } = useTheme();
  const { height: schermHoogte } = useWindowDimensions();
  const lijstHoogte = Math.max(LIJST_MINIMUM, schermHoogte * VEL_DEEL_VAN_SCHERM - RUIMTE_OM_DE_LIJST);

  // In de melding kun je doorklikken naar de volledige lijst, in hetzelfde vel. Bij het sluiten
  // terug naar het begin, zodat de volgende melding weer met de hoogtepunten opent.
  const [alles, setAlles] = useState(false);
  useEffect(() => {
    if (!zichtbaar) setAlles(false);
  }, [zichtbaar]);

  const toonHero = !!alleenNieuwste && !alles;
  const nieuwste = CHANGELOG[0];

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={styles.vel}>
      {toonHero && nieuwste ? (
        <Hero entry={nieuwste} onSluiten={onSluiten} onAlles={() => setAlles(true)} />
      ) : (
        <>
          <View style={styles.titelRij}>
            <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Wijzigingen</Text>
            <Pressable
              onPress={onSluiten}
              accessibilityLabel="Sluiten"
              accessibilityRole="button"
              style={styles.sluitKnop}
            >
              <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator style={{ maxHeight: lijstHoogte }}>
            {CHANGELOG.map(entry => {
              const kop = entry.datum ? `${versieLabel(entry.versie)} · ${entry.datum}` : versieLabel(entry.versie);
              // Met groepen staat de versie als kop boven een kaart per onderdeel, met een paar korte
              // punten. De volledige lijst (punten) staat dan alleen in CHANGELOG.md.
              if (entry.groepen && entry.groepen.length > 0) {
                return (
                  <View key={entry.versie} style={styles.groep}>
                    <Text accessibilityRole="header" style={[Type.overline, styles.versieKop, { color: colors.tekstGedimd }]}>
                      {kop.toUpperCase()}
                    </Text>
                    {entry.groepen.map(g => (
                      <View key={g.kop} style={styles.onderdeel}>
                        <LijstGroep lijnInspringing={spacing.base}>
                          <Text accessibilityRole="header" style={[Type.body, styles.onderdeelKop, { color: colors.tekstPrimair }]}>
                            {g.kop}
                          </Text>
                          {g.punten.map((punt, i) => <Punt key={i} tekst={punt} />)}
                        </LijstGroep>
                      </View>
                    ))}
                  </View>
                );
              }
              return (
                <LijstGroep key={entry.versie} titel={kop} lijnInspringing={spacing.base} style={styles.groep}>
                  {entry.punten.map((punt, i) => <Punt key={i} tekst={punt} />)}
                </LijstGroep>
              );
            })}
          </ScrollView>
        </>
      )}
    </BottomSheet>
  );
}

function Punt({ tekst }: { tekst: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.puntRij}>
      <Text style={[Type.caption, styles.bullet, { color: colors.tekstGedimd }]}>•</Text>
      <Text style={[Type.caption, styles.puntTekst, { color: colors.tekstGedimd }]}>{tekst}</Text>
    </View>
  );
}

// De "nieuw in deze versie"-opening. Hebben alle hoogtepunten een animatie (vis), dan veegbare
// kaarten; anders een overline, een titel, de hoogtepunten als rijen en één duidelijke knop. Zonder
// hoogtepunten vallen we terug op de eerste drie punten, als gewone tekst.
function Hero({ entry, onSluiten, onAlles }: { entry: ChangelogEntry; onSluiten: () => void; onAlles: () => void }) {
  const { colors } = useTheme();
  const titel = heeftNummer(entry.versie) ? `Versie ${entry.versie}` : 'Nieuw in Kader';
  const hoogtepunten = entry.hoogtepunten;

  if (hoogtepunten && hoogtepunten.length > 0 && hoogtepunten.every(h => !!h.vis)) {
    return <NieuwInVersieKaarten titel={titel} hoogtepunten={hoogtepunten} onSluiten={onSluiten} onAlles={onAlles} />;
  }

  return (
    <View>
      <Text style={[Type.overline, { color: colors.cta }]}>NIEUW IN KADER</Text>
      <Text accessibilityRole="header" style={[styles.heroTitel, { color: colors.tekstPrimair }]}>{titel}</Text>

      <View style={styles.heroRijen}>
        {hoogtepunten && hoogtepunten.length > 0
          ? hoogtepunten.map(h => {
              const Icoon = ICONEN[h.icoon] ?? Sparkles;
              return (
                <View key={h.titel} style={styles.heroRij}>
                  <View style={[styles.heroTegel, { backgroundColor: `${colors.cta}1F` }]}>
                    <Icoon size={20} color={colors.cta} strokeWidth={1.75} />
                  </View>
                  <View style={styles.tekst}>
                    <Text style={[Type.body, styles.vet, { color: colors.tekstPrimair }]}>{h.titel}</Text>
                    <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{h.tekst}</Text>
                  </View>
                </View>
              );
            })
          : entry.punten.slice(0, 3).map((punt, i) => (
              <View key={i} style={styles.heroRij}>
                <View style={[styles.heroTegel, { backgroundColor: `${colors.cta}1F` }]}>
                  <Sparkles size={20} color={colors.cta} strokeWidth={1.75} />
                </View>
                <Text style={[Type.caption, styles.tekst, { color: colors.tekstPrimair, lineHeight: 19 }]}>{punt}</Text>
              </View>
            ))}
      </View>

      <PilKnop label="Begrepen" variant="cta" onPress={onSluiten} haptiek="tik" />
      <View style={styles.linkRij}>
        <PilKnop label="Alle wijzigingen" variant="link" onPress={onAlles} />
      </View>
    </View>
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
  groep: { marginBottom: spacing.base },
  versieKop: { marginBottom: spacing.sm, paddingHorizontal: spacing.base },
  onderdeel: { marginBottom: spacing.md },
  onderdeelKop: { fontFamily: Fonts.sansSemiBold, fontWeight: '600', paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xs },
  puntRij: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  bullet: { lineHeight: 18, flexShrink: 0 },
  puntTekst: { flex: 1, flexShrink: 1, lineHeight: 18 },
  heroTitel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  heroRijen: { gap: spacing.base, marginTop: spacing.lg, marginBottom: spacing.lg },
  heroRij: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heroTegel: {
    width: 40,
    height: 40,
    borderRadius: radii.veld,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tekst: { flex: 1, flexShrink: 1, gap: 2 },
  vet: { fontWeight: '600' },
  linkRij: { alignItems: 'center', marginTop: spacing.xs },
});
