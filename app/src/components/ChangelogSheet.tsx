import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { X, LayoutGrid, ShieldCheck, ShoppingCart, Link2, Menu, Info, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts, Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { PilKnop } from './PilKnop';
import { LijstGroep } from './lijst/LijstGroep';
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
            {CHANGELOG.map(entry => (
              <LijstGroep
                key={entry.versie}
                titel={entry.datum ? `${versieLabel(entry.versie)} · ${entry.datum}` : versieLabel(entry.versie)}
                lijnInspringing={spacing.base}
                style={styles.groep}
              >
                {entry.punten.map((punt, i) => (
                  <View key={i} style={styles.puntRij}>
                    <Text style={[Type.caption, styles.bullet, { color: colors.tekstGedimd }]}>•</Text>
                    <Text style={[Type.caption, styles.puntTekst, { color: colors.tekstGedimd }]}>{punt}</Text>
                  </View>
                ))}
              </LijstGroep>
            ))}
          </ScrollView>
        </>
      )}
    </BottomSheet>
  );
}

// De "nieuw in deze versie"-opening: een overline, een titel, de hoogtepunten als rijen en één
// duidelijke knop. Zonder hoogtepunten vallen we terug op de eerste drie punten, als gewone tekst.
function Hero({ entry, onSluiten, onAlles }: { entry: ChangelogEntry; onSluiten: () => void; onAlles: () => void }) {
  const { colors } = useTheme();
  const titel = heeftNummer(entry.versie) ? `Versie ${entry.versie}` : 'Nieuw in Kader';
  const hoogtepunten = entry.hoogtepunten;

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
