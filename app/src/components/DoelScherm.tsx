// Het volledige overzicht achter de Doel-kant van VerdelingKaart: je doelverdeling, het
// bijstortplan en de projectie. Full-screen en geen sheet, zelfde vorm als VerdelingScherm.tsx: dit
// is iets om te lezen en in te vullen, niet iets wat in één klein veld afgehandeld wordt.
//
// DoelSheet en InlegSheet staan bewust NIET in dit bestand. Een BottomSheet binnen een full-screen
// Modal komt op Android achter die modal terecht, dus dit scherm vraagt via onOpenDoelSheet en
// onOpenInlegSheet alleen om ze te openen; PortfolioScreen rendert de sheets zelf, als buur van dit
// scherm en niet erin.
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Target, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useModalKopruimte } from '../theme/useModalKopruimte';
import { Type } from '../theme/typography';
import { radii, shadow, spacing } from '../theme/tokens';
import { fmtBedrag } from '../engine/format';
import { aandeelTekst, OVERIG_SLEUTEL } from '../engine/verdeling';
import {
  AfwijkingRegel, Doelverdeling,
  berekenAfwijking, berekenBijstortplan, berekenProjectie,
  fmtAfwijkingPp,
} from '../engine/doelstelling';
import { PortfolioTrade } from '../state/portfolioTypes';
import { useValutaStand } from '../state/useValuta';
import { ProjectieGrafiek } from './ProjectieGrafiek';

// De vijf periodes uit de jaren-chips, in de vaste volgorde van de spec.
const JAREN_OPTIES = [1, 3, 5, 10, 20] as const;

interface Props {
  zichtbaar: boolean;
  trades: PortfolioTrade[];
  livePrijzen: Record<string, number>;
  doel: Doelverdeling;
  inleg: number | null;
  rendementPct: number | null;
  jaren: number;
  onOpenDoelSheet: () => void;
  onOpenInlegSheet: () => void;
  onWijzigRendement: (n: number | null) => void;
  onWijzigJaren: (n: number) => void;
  onSluiten: () => void;
}

export function DoelScherm({
  zichtbaar, trades, livePrijzen, doel, inleg, rendementPct, jaren,
  onOpenDoelSheet, onOpenInlegSheet, onWijzigRendement, onWijzigJaren, onSluiten,
}: Props) {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement blijft
  // dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const extraKopruimte = useModalKopruimte();

  // Los tekstveld voor het rendementpercentage. De grafiek herrekent bij elke toets (puur
  // rekenwerk in het geheugen), maar de opslag via onWijzigRendement krijgt de waarde pas bij
  // onEndEditing, zodat niet bij elk cijfer naar AsyncStorage geschreven wordt.
  const [rendementTekst, setRendementTekst] = useState(rendementPct !== null ? String(rendementPct) : '');

  useEffect(() => {
    if (zichtbaar) setRendementTekst(rendementPct !== null ? String(rendementPct) : '');
    // Bewust alleen bij het openen van het scherm opnieuw vullen: rendementPct wisselt ook door
    // deze invoer zelf (via onEndEditing), en zou anders je eigen toetsaanslagen overschrijven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zichtbaar]);

  const rendementRuw = rendementTekst.trim().replace(',', '.');
  const rendementGetal = rendementRuw === '' ? NaN : Number(rendementRuw);
  const rendementGeldig = Number.isFinite(rendementGetal);

  // Alleen rekenen als het scherm ook echt open is, zelfde reden als in VerdelingScherm: anders
  // rekent dit bij elke prijzenpoll mee terwijl niemand kijkt.
  const afwijking = useMemo(
    () => (zichtbaar ? berekenAfwijking(doel, trades, livePrijzen) : null),
    [zichtbaar, doel, trades, livePrijzen],
  );

  const bijstortplan = useMemo(
    () => (zichtbaar && doel.length > 0 && inleg !== null
      ? berekenBijstortplan(doel, trades, livePrijzen, inleg)
      : null),
    [zichtbaar, doel, trades, livePrijzen, inleg],
  );

  const projectiePunten = useMemo(
    () => (zichtbaar && afwijking !== null && inleg !== null && rendementGeldig
      ? berekenProjectie(afwijking.totaalUsd, inleg, rendementGetal, jaren)
      : null),
    [zichtbaar, afwijking, inleg, rendementGeldig, rendementGetal, jaren],
  );

  // Zelfde toewijzing als de afwijkingsrijen op VerdelingKaart: de eerste zes doelregels krijgen
  // de categorische reeks op volgorde, Overig het neutrale grijs.
  const kleurVoor = (sleutel: string, index: number): string =>
    sleutel === OVERIG_SLEUTEL || index >= colors.verdeling.length
      ? colors.verdelingOverig
      : colors.verdeling[index];

  function opRendementKlaar() {
    onWijzigRendement(rendementGeldig ? rendementGetal : null);
  }

  const laatstePunt = projectiePunten ? projectiePunten[projectiePunten.length - 1] : null;
  const eindwaarde = laatstePunt?.totaalWaarde ?? 0;
  const ingelegdEind = laatstePunt?.ingelegdWaarde ?? 0;
  const projectieVerschil = eindwaarde - ingelegdEind;

  return (
    <Modal visible={zichtbaar} animationType="slide" onRequestClose={onSluiten} presentationStyle="fullScreen">
      <SafeAreaView style={[stijlen.root, { backgroundColor: colors.achtergrond }]}>
        <View style={[stijlen.header, { borderBottomColor: colors.rand, paddingTop: spacing.base + extraKopruimte }]}>
          <View style={stijlen.headerLinks}>
            <Target size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
            <Text style={[Type.titel, { color: colors.tekstPrimair }]} accessibilityRole="header">Doel</Text>
          </View>
          <Pressable
            onPress={onSluiten}
            style={stijlen.sluitKnop}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
            hitSlop={8}
          >
            <X size={22} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={stijlen.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ---------- Blok 1: je doelverdeling ---------- */}
          <View style={[stijlen.blok, shadow.kaart, { backgroundColor: colors.kaart }]}>
            <View style={stijlen.blokKop}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]} accessibilityRole="header">
                JE DOELVERDELING
              </Text>
              {doel.length > 0 && (
                <Pressable
                  onPress={onOpenDoelSheet}
                  hitSlop={8}
                  style={stijlen.aanpassenKnop}
                  accessibilityRole="button"
                  accessibilityLabel="Doelverdeling aanpassen"
                >
                  <Text style={[Type.caption, stijlen.aanpassenTekst, { color: colors.cta }]}>Aanpassen</Text>
                </Pressable>
              )}
            </View>

            {doel.length === 0 ? (
              <View style={stijlen.leeg}>
                <Target size={28} color={colors.tekstGedimd} strokeWidth={1.5} style={stijlen.leegIcoon} />
                <Text style={[Type.caption, stijlen.leegTekst, { color: colors.tekstGedimd }]}>
                  Je hebt nog geen doelverdeling ingesteld. Vul in welk percentage je in welke coin
                  wil hebben, dan laat Kader zien waar je te zwaar of te licht zit.
                </Text>
                <Pressable
                  onPress={onOpenDoelSheet}
                  accessibilityRole="button"
                  accessibilityLabel="Doelverdeling instellen"
                  style={[stijlen.leegKnop, { borderColor: colors.cta }]}
                >
                  <Text style={[Type.caption, { color: colors.cta, fontWeight: '600' }]}>Doel instellen</Text>
                </Pressable>
              </View>
            ) : afwijking !== null && afwijking.totaalUsd === 0 ? (
              <Text style={[Type.caption, stijlen.uitleg, { color: colors.tekstGedimd }]}>
                Kader heeft nog geen live koersen om je posities tegen je doel af te zetten. De
                afwijking verschijnt na de eerste sync.
              </Text>
            ) : afwijking !== null ? (
              <View style={stijlen.doelLijst}>
                {afwijking.regels.map((r, i) => (
                  <DoelRij key={r.sleutel} regel={r} kleur={kleurVoor(r.sleutel, i)} />
                ))}
              </View>
            ) : null}
          </View>

          {/* ---------- Blok 2: bijstorten ---------- */}
          <View style={[stijlen.blok, shadow.kaart, { backgroundColor: colors.kaart }]}>
            <View style={stijlen.blokKop}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]} accessibilityRole="header">BIJSTORTEN</Text>
              {doel.length > 0 && inleg !== null && (
                <Pressable
                  onPress={onOpenInlegSheet}
                  hitSlop={8}
                  style={stijlen.aanpassenKnop}
                  accessibilityRole="button"
                  accessibilityLabel="Maandelijkse inleg aanpassen"
                >
                  <Text style={[Type.caption, stijlen.aanpassenTekst, { color: colors.cta }]}>Aanpassen</Text>
                </Pressable>
              )}
            </View>

            {doel.length === 0 ? (
              <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
                Stel eerst een doelverdeling in om te zien waar je inleg heen kan.
              </Text>
            ) : inleg === null ? (
              <>
                <Text style={[Type.body, stijlen.bijstortUitleg, { color: colors.tekstGedimd }]}>
                  Vul in wat je deze maand van plan bent bij te storten, dan rekent Kader uit waar
                  dat volgens je doel het beste heen kan.
                </Text>
                <Pressable
                  onPress={onOpenInlegSheet}
                  accessibilityRole="button"
                  accessibilityLabel="Maandelijkse inleg invullen"
                  style={[stijlen.leegKnop, { borderColor: colors.cta }]}
                >
                  <Text style={[Type.caption, { color: colors.cta, fontWeight: '600' }]}>Inleg invullen</Text>
                </Pressable>
              </>
            ) : bijstortplan !== null ? (
              <>
                <Text style={[Type.prijs, stijlen.dezeMaand, { color: colors.tekstPrimair }]}>
                  Deze maand: {fmtBedrag(inleg)}
                </Text>
                <View style={stijlen.bijstortLijst}>
                  {bijstortplan.map((r, i) => (
                    <View
                      key={r.sleutel}
                      style={stijlen.rij}
                      accessible
                      accessibilityLabel={`${r.label}, ${fmtBedrag(r.bedragUsd)} bijstorten, wordt dan ${aandeelTekst(r.nieuwPct / 100)} van je posities.`}
                    >
                      <View
                        style={[stijlen.vierkantje, { backgroundColor: kleurVoor(r.sleutel, i) }]}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      />
                      <Text style={[Type.caption, stijlen.symbool, { color: colors.tekstPrimair }]}>{r.label}</Text>
                      <View style={stijlen.vulling} />
                      <Text style={[Type.prijs, stijlen.bijstortBedrag, { color: colors.tekstGedimd }]}>
                        {fmtBedrag(r.bedragUsd)}
                      </Text>
                      <Text style={[Type.caption, stijlen.bijstortPijl, { color: colors.tekstGedimd }]}>
                        {'→ '}{aandeelTekst(r.nieuwPct / 100)}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={[Type.caption, stijlen.slotregel, { color: colors.tekstGedimd, borderTopColor: colors.rand }]}>
                  Dit is een rekensom op basis van de doelverdeling die je zelf hebt ingevuld. Geen beleggingsadvies.
                </Text>
              </>
            ) : null}
          </View>

          {/* ---------- Blok 3: projectie ---------- */}
          <View style={[stijlen.blok, shadow.kaart, { backgroundColor: colors.kaart }]}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]} accessibilityRole="header">PROJECTIE</Text>

            {inleg === null ? (
              <Text style={[Type.caption, stijlen.uitleg2, { color: colors.tekstGedimd }]}>
                Vul eerst in wat je maandelijks inlegt (bij Bijstorten hierboven), dan kan Kader een
                projectie rekenen.
              </Text>
            ) : (
              <>
                <View style={stijlen.jarenRij}>
                  {JAREN_OPTIES.map(j => {
                    const actief = j === jaren;
                    return (
                      <Pressable
                        key={j}
                        onPress={() => onWijzigJaren(j)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: actief }}
                        accessibilityLabel={`Projectie over ${j} jaar`}
                        style={[stijlen.jarenPil, { backgroundColor: actief ? colors.cta : colors.verhoogd }]}
                      >
                        <Text style={[Type.caption, stijlen.jarenTekst, { color: actief ? 'white' : colors.tekstGedimd }]}>
                          {j}j
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[Type.overline, stijlen.rendementLabel, { color: colors.tekstGedimd }]}>
                  VERWACHT RENDEMENT PER JAAR
                </Text>
                <View style={[stijlen.rendementVeldRij, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}>
                  <TextInput
                    value={rendementTekst}
                    onChangeText={setRendementTekst}
                    onEndEditing={opRendementKlaar}
                    keyboardType="decimal-pad"
                    style={[Type.prijs, stijlen.rendementVeld, { color: colors.tekstPrimair }]}
                    accessibilityLabel="Verwacht rendement per jaar, in procent"
                  />
                  <Text style={[Type.prijs, { color: colors.tekstGedimd }]}>%</Text>
                </View>

                {!rendementGeldig || projectiePunten === null ? (
                  <Text style={[Type.caption, stijlen.uitleg2, { color: colors.tekstGedimd }]}>
                    Vul een verwacht rendement in om de projectie te zien.
                  </Text>
                ) : (
                  <>
                    <Text style={[Type.display, stijlen.eindwaarde, { color: colors.tekstPrimair }]}>
                      Over {jaren} jaar: {fmtBedrag(eindwaarde)}
                    </Text>
                    <Text style={[Type.caption, stijlen.eindOnderregel, { color: colors.tekstGedimd }]}>
                      {projectieVerschil >= 0
                        ? `Waarvan ${fmtBedrag(ingelegdEind)} eigen inleg en ${fmtBedrag(projectieVerschil)} rendement.`
                        : `Waarvan ${fmtBedrag(ingelegdEind)} eigen inleg en −${fmtBedrag(Math.abs(projectieVerschil))} verlies door het ingevulde rendement.`}
                    </Text>

                    <View
                      style={stijlen.grafiekHouder}
                      accessible
                      accessibilityLabel={
                        `Verwachte waarde over ${jaren} jaar: ${fmtBedrag(eindwaarde)}, waarvan ${fmtBedrag(ingelegdEind)} eigen inleg en `
                        + (projectieVerschil >= 0
                          ? `${fmtBedrag(projectieVerschil)} rendement.`
                          : `−${fmtBedrag(Math.abs(projectieVerschil))} verlies door het ingevulde rendement.`)
                      }
                    >
                      <ProjectieGrafiek punten={projectiePunten} jaren={jaren} />
                    </View>
                  </>
                )}

                <Text style={[Type.caption, stijlen.slotregel, { color: colors.tekstGedimd, borderTopColor: colors.rand }]}>
                  Dit is een rekensom op basis van het rendement dat je zelf hebt ingevuld, geen
                  voorspelling van de koers.
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Zelfde vorm als de afwijkingsrij in VerdelingKaart (§3.3): naam met statuspil, een staafje met
// het huidige aandeel en een streep op het doel, en de twee cijfers eronder. Hier zonder de
// buitenste Pressable: dit scherm ís al het volledige overzicht, er valt niets meer te openen.
function DoelRij({ regel, kleur }: { regel: AfwijkingRegel; kleur: string }) {
  const { colors } = useTheme();

  const flink = regel.status !== 'op-doel' && regel.ernst === 'flink';
  const woord = regel.status === 'op-doel'
    ? 'OP DOEL'
    : regel.status === 'te-zwaar' ? 'TE ZWAAR' : 'TE LICHT';

  const spreek = regel.status === 'op-doel'
    ? 'op doel'
    : `${Math.abs(regel.afwijkingPct).toFixed(1).replace('.', ',')} procentpunt ${regel.status === 'te-zwaar' ? 'te zwaar' : 'te licht'}`;

  const vulling = Math.min(100, Math.max(0, regel.actueelPct));
  const streep = Math.min(100, Math.max(0, regel.doelPct));

  return (
    <View
      accessible
      accessibilityLabel={
        `${regel.label}, nu ${regel.actueelPct.toFixed(1).replace('.', ',')} procent, `
        + `doel ${regel.doelPct.toFixed(1).replace('.', ',')} procent, ${spreek}.`
      }
    >
      <View style={stijlen.rij}>
        <View
          style={[stijlen.vierkantje, { backgroundColor: kleur }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text style={[Type.caption, stijlen.symbool, { color: colors.tekstPrimair }]} numberOfLines={1}>
          {regel.label}
        </Text>
        {/* Geen winst- of verliesgroen: een afwijking van je eigen doel is geen resultaat, dezelfde
            reden waarom de ring op VerdelingKaart ook geen groen of rood gebruikt. */}
        <View
          style={[
            stijlen.pil,
            { backgroundColor: flink ? colors.letOp + '1A' : colors.verhoogd },
          ]}
        >
          <Text
            style={[
              Type.caption,
              stijlen.pilWoord,
              {
                color: flink
                  ? colors.letOp
                  : regel.status === 'op-doel' ? colors.tekstGedimd : colors.tekstPrimair,
              },
            ]}
          >
            {woord}
            {regel.status !== 'op-doel' && (
              <Text style={[Type.label, stijlen.pilCijfer]}> · {fmtAfwijkingPp(regel.afwijkingPct)}</Text>
            )}
          </Text>
        </View>
      </View>

      <View
        style={[stijlen.baan, { backgroundColor: colors.verhoogd }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[stijlen.baanVulling, { width: `${vulling}%`, backgroundColor: kleur }]} />
        <View style={[stijlen.baanStreep, { left: `${streep}%`, backgroundColor: colors.tekstPrimair }]} />
      </View>

      <View style={stijlen.cijferRij}>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
          Nu {aandeelTekst(regel.actueelPct / 100)} · {fmtBedrag(regel.actueelUsd)}
        </Text>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>
          Doel {aandeelTekst(regel.doelPct / 100)}
        </Text>
      </View>
    </View>
  );
}

// 17 = het kleurvierkantje van 9 plus de tussenruimte van spacing.sm (8), zodat het staafje en de
// cijferregel eronder uitlijnen met het symbool en niet met het vierkantje.
const INSPRONG = 17;

const stijlen = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  scroll: { padding: spacing.base },

  blok: {
    borderRadius: radii.kaart,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  blokKop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  aanpassenKnop: { minHeight: 44, justifyContent: 'center' },
  aanpassenTekst: { fontWeight: '600' },

  uitleg: { textAlign: 'center' },
  uitleg2: { marginTop: spacing.sm, lineHeight: 18 },

  leeg: { alignItems: 'center' },
  leegIcoon: { marginTop: spacing.base },
  leegTekst: {
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
  leegKnop: {
    minHeight: 44,
    alignSelf: 'center',
    marginTop: spacing.base,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },

  doelLijst: { rowGap: spacing.base },
  rij: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vulling: { flex: 1 },
  vierkantje: { width: 9, height: 9, borderRadius: 2 },
  symbool: { fontWeight: '600' },
  pil: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pilWoord: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  pilCijfer: { fontWeight: '600' },
  baan: {
    height: 3,
    borderRadius: radii.pill,
    marginTop: 5,
    marginLeft: INSPRONG,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  baanVulling: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    minWidth: 2,
  },
  baanStreep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
  },
  cijferRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginLeft: INSPRONG,
  },

  bijstortUitleg: { lineHeight: 22, marginBottom: spacing.base },
  dezeMaand: { marginBottom: spacing.base },
  bijstortLijst: { rowGap: spacing.md },
  bijstortBedrag: { fontSize: 12 },
  bijstortPijl: { marginLeft: spacing.sm },
  slotregel: {
    marginTop: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    lineHeight: 18,
  },

  jarenRij: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  jarenPil: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    minHeight: 32,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jarenTekst: { fontWeight: '600' },
  rendementLabel: { marginTop: spacing.base },
  rendementVeldRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.veld,
    minHeight: 52,
    marginTop: spacing.sm,
  },
  rendementVeld: { flex: 1, paddingVertical: spacing.md },
  eindwaarde: { marginTop: spacing.base },
  eindOnderregel: { marginTop: 2 },
  grafiekHouder: { marginTop: spacing.base },
});
