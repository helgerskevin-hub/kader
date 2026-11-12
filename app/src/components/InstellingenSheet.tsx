import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Switch } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Constants from 'expo-constants';
import { X, Link2, Bell, CalendarDays, FileText, ChevronRight, LayoutGrid, SlidersHorizontal } from 'lucide-react-native';
import { useTheme, ThemaModus } from '../theme/ThemeProvider';
import { useModalKopruimte } from '../theme/useModalKopruimte';
import { Type, Fonts } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { duur, vervaag } from '../theme/beweging';
import { haptiek } from '../theme/haptiek';
import { useSchermlezer } from '../theme/useSchermlezer';
import { PodiumScherm } from './PodiumScherm';
import { LijstGroep } from './lijst/LijstGroep';
import { LijstRij } from './lijst/LijstRij';
import { SegmentKnop, SegmentOptie } from './SegmentKnop';
import { Disclaimer } from './Disclaimer';
import { ChangelogSheet } from './ChangelogSheet';
import { NieuwInKaderScherm } from './NieuwInKaderScherm';
import { CHANGELOG } from '../changelog';
import { EtoroKoppelingWizard } from './EtoroKoppelingWizard';
import { heeftSleutels } from '../state/etoroSleutels';
import { usePortfolio } from '../state/PortfolioProvider';
import { useDialoog } from '../state/DialoogProvider';
import { EtoroOmgeving } from '../engine/etoro';
import { SLEUTELS, laadVlag } from '../storage/opslag';
import { useValuta } from '../state/useValuta';
import { Valuta } from '../engine/valuta';
import { meldingenAan } from '../state/meldingVoorkeur';
import { zetMeldingen } from '../state/meldingSchakelaar';
import { useRisicoPct, type RisicoPct } from '../state/useRisicoPct';
import { useGrafiekSoort, type GrafiekSoort } from '../state/useGrafiekSoort';
import { useHandelskapitaal } from '../state/useHandelskapitaal';
import { weekrapportAan, zetWeekrapport } from '../notifications/weekrapport';
import { useWidgetWeergave, type WidgetHoofdgetal, type WidgetIndeling } from '../state/widgetWeergave';
import type { WidgetVolgorde } from '../state/widgetStand';
import { tekenWidgets } from '../widget/widgetVerversen';
import { fmtBedrag } from '../engine/format';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
}

const WIDGET_INDELINGEN: SegmentOptie<WidgetIndeling>[] = [
  { id: 'resultaat', label: 'Resultaat' },
  { id: 'vermogen', label: 'Vermogen' },
];
const WIDGET_HOOFDGETALLEN: SegmentOptie<WidgetHoofdgetal>[] = [
  { id: 'pct', label: '%', uitleg: 'Procenten' },
  { id: 'usd', label: '$', uitleg: 'Dollars' },
  { id: 'r', label: 'R' },
];
const WIDGET_VOLGORDES: SegmentOptie<WidgetVolgorde>[] = [
  { id: 'urgent', label: 'Urgent', uitleg: 'Dichtst bij stop of doel' },
  { id: 'grootste', label: 'Grootste' },
  { id: 'uitersten', label: 'Uitersten', uitleg: 'Beste en slechtste' },
];
const WIDGET_AANTALLEN: SegmentOptie<'2' | '3' | '4'>[] = [
  { id: '2', label: '2' },
  { id: '3', label: '3' },
  { id: '4', label: '4' },
];

const THEMAS: SegmentOptie<ThemaModus>[] = [
  { id: 'systeem', label: 'Systeem', uitleg: 'Thema volgt het systeem' },
  { id: 'licht', label: 'Licht', uitleg: 'Licht thema' },
  { id: 'donker', label: 'Donker', uitleg: 'Donker thema' },
];

const RISICOS: SegmentOptie<RisicoPct>[] = [
  { id: '0.5', label: '0.5%', uitleg: 'Een half procent risico per trade' },
  { id: '1', label: '1%', uitleg: 'Een procent risico per trade' },
  { id: '2', label: '2%', uitleg: 'Twee procent risico per trade' },
];

const VALUTAS: SegmentOptie<Valuta>[] = [
  { id: 'USD', label: 'Dollar', uitleg: 'Bedragen in dollar' },
  { id: 'EUR', label: 'Euro', uitleg: 'Bedragen in euro' },
];

const GRAFIEKSOORTEN: SegmentOptie<GrafiekSoort>[] = [
  { id: 'lijn', label: 'Lijn', uitleg: 'Koersgrafiek als lijn' },
  { id: 'candles', label: 'Candles', uitleg: 'Koersgrafiek als candles' },
];

const OMGEVINGEN: SegmentOptie<EtoroOmgeving>[] = [
  { id: 'demo', label: 'Demo', uitleg: 'Demo, oefengeld' },
  { id: 'real', label: 'Echt', uitleg: 'Echt, je eigen geld' },
];

// Naar echt vraagt vasthouden; naar demo niet, dat kan geen geld kosten.
const VASTHOUDEN: EtoroOmgeving[] = ['real'];

// Zo lang blijft de hint "houd Echt vast" staan voor hij wegvervaagt: lang genoeg om de zin te
// lezen, kort genoeg dat hij niet blijft hangen als je het al begrepen hebt.
const HINT_ZICHTBAAR_MS = 2500;

type SleutelStatus =
  | 'Niet ingesteld'
  | 'Alleen lezen'
  | 'Handelen in demo'
  | 'Handelen in echt'
  | 'Handelen in demo en echt';

const SCHRIJFVLAG: Record<EtoroOmgeving, string> = {
  real: SLEUTELS.etoroRealSchrijven,
  demo: SLEUTELS.etoroDemoSchrijven,
};

// Eén sleutel, dus één status. Het handelsrecht blijft wél per omgeving, want eToro kan je sleutel
// in demo wel en in echt geen schrijfrecht geven, en dat verschil hoort zichtbaar te blijven.
async function bepaalStatus(): Promise<SleutelStatus> {
  if (!(await heeftSleutels())) return 'Niet ingesteld';
  const [real, demo] = await Promise.all([laadVlag(SCHRIJFVLAG.real), laadVlag(SCHRIJFVLAG.demo)]);
  if (real && demo) return 'Handelen in demo en echt';
  if (demo) return 'Handelen in demo';
  if (real) return 'Handelen in echt';
  return 'Alleen lezen';
}

const VERSIE = Constants.expoConfig?.version ?? '';

export function InstellingenSheet({ zichtbaar, onSluiten }: Props) {
  const { colors, modus, setModus } = useTheme();
  const extraKopruimte = useModalKopruimte();
  const { toonDialoog } = useDialoog();
  const { valuta, eurPerUsd, koersOntbreekt, kiesValuta } = useValuta();
  // Meteen ophalen zodra de koppeling is opgeslagen, niet pas bij de volgende app-start.
  const { omgeving, setOmgeving } = usePortfolio();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [rondleidingOpen, setRondleidingOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [sleutelStatus, setSleutelStatus] = useState<SleutelStatus>('Niet ingesteld');
  const [bezigWisselen, setBezigWisselen] = useState(false);
  // De ref is de waarheid tijdens een wissel (state loopt een render achter), en onthoudt een tik op
  // Demo die binnenkwam terwijl de vorige wissel nog liep: terug naar demo mag nooit verloren gaan.
  const bezigRef = useRef(false);
  const naDemoRef = useRef(false);
  const schermlezer = useSchermlezer();
  const [meldingen, setMeldingen] = useState(true);
  const [weekrapport, setWeekrapport] = useState(true);
  const { pct: risico, pctGetal: risicoGetal, kiesPct } = useRisicoPct();
  const { soort: grafiekSoort, kiesSoort: kiesGrafiekSoort } = useGrafiekSoort();
  const { kapitaal } = useHandelskapitaal();
  const [bezigMeldingen, setBezigMeldingen] = useState(false);
  const { weergave: widget, kies: kiesWidget } = useWidgetWeergave(tekenWidgets);

  // Hint onder de handelsomgeving na een losse tik op Echt. Alleen de dekking beweegt.
  const [hintGetoond, setHintGetoond] = useState(false);
  const hintDekking = useSharedValue(0);
  const hintWekkers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hintStijl = useAnimatedStyle(() => ({ opacity: hintDekking.value }));

  useEffect(() => () => {
    hintWekkers.current.forEach(clearTimeout);
  }, []);

  function toonHoudHint() {
    hintWekkers.current.forEach(clearTimeout);
    setHintGetoond(true);
    hintDekking.value = vervaag(1, duur.kort);
    hintWekkers.current = [
      setTimeout(() => {
        hintDekking.value = vervaag(0, duur.midden);
      }, HINT_ZICHTBAAR_MS),
      setTimeout(() => setHintGetoond(false), HINT_ZICHTBAAR_MS + duur.midden),
    ];
  }

  async function ververStatussen() {
    const [status, aan, week] = await Promise.all([bepaalStatus(), meldingenAan(), weekrapportAan()]);
    setSleutelStatus(status);
    setMeldingen(aan);
    setWeekrapport(week);
  }

  // De schakelaar doet meteen wat hij belooft: uit wist de geplande dagelijkse herinnering en
  // schrijft de achtergrondtaak uit. Mislukt dat, dan zetten we de knop terug in plaats van een
  // stand te tonen die niet klopt.
  function kiesWeekrapport(aan: boolean) {
    setWeekrapport(aan);
    zetWeekrapport(aan).catch(() => setWeekrapport(!aan));
  }

  async function kiesMeldingen(aan: boolean) {
    if (aan === meldingen || bezigMeldingen) return;
    setBezigMeldingen(true);
    setMeldingen(aan);
    try {
      await zetMeldingen(aan);
    } catch {
      setMeldingen(!aan);
    } finally {
      setBezigMeldingen(false);
    }
  }

  useEffect(() => {
    if (zichtbaar) ververStatussen();
  }, [zichtbaar]);

  // viaDialoog: de schermlezer-route heeft geen vasthouden gehad, dus ook nog niet de stevige
  // haptiek die useVasthouden bij 100% geeft. Die komt dan hier, pas als de wissel gelukt is.
  async function wissel(nieuw: EtoroOmgeving, viaDialoog = false) {
    bezigRef.current = true;
    setBezigWisselen(true);
    try {
      await setOmgeving(nieuw);
      if (viaDialoog && nieuw === 'real') haptiek('stevig');
    } catch {
      // setOmgeving vangt zijn eigen fouten af; mocht er toch iets doorkomen, dan blijft de
      // omgeving de bewaarde en toont de knop die stand.
    } finally {
      bezigRef.current = false;
      setBezigWisselen(false);
    }
    if (naDemoRef.current) {
      naDemoRef.current = false;
      if (nieuw !== 'demo') wissel('demo');
    }
  }

  // Naar demo mag met een tik: dat kan geen geld kosten. Naar echt komt hier alleen na 800 ms
  // vasthouden (SegmentKnop), de stap die je anders per ongeluk zet en pas merkt bij je eerste order.
  function kiesOmgeving(nieuw: EtoroOmgeving) {
    if (bezigRef.current) {
      if (nieuw === 'demo') naDemoRef.current = true;
      return;
    }
    if (nieuw === omgeving) return;
    wissel(nieuw);
  }

  // Met een schermlezer is vasthouden lastig; dan vraagt een gewone activering op Echt deze
  // bevestiging. Oranje waarschuwing, geen rood: het is geen fout en niets gaat stuk.
  function bevestigEcht(nieuw: EtoroOmgeving) {
    if (nieuw !== 'real' || nieuw === omgeving || bezigRef.current) return;
    toonDialoog({
      variant: 'waarschuwing',
      titel: 'Overschakelen naar echt',
      tekst: 'Orders die je hierna bevestigt gaan naar je echte eToro-account, met je eigen geld. Je portfolio in Kader toont vanaf dan alleen je echte posities.',
      knoppen: [
        {
          label: 'Naar echt',
          soort: 'primair',
          // Opnieuw kijken bij het drukken: de dialoog kan open hebben gestaan terwijl er al gewisseld werd.
          onDruk: () => { if (!bezigRef.current) wissel('real', true); },
        },
        { label: 'Annuleren', soort: 'secundair' },
      ],
    });
  }

  function naOpslaan() {
    ververStatussen();
    // Zet de actieve omgeving opnieuw: dat leest het schrijfrecht vers van schijf (anders verschijnt
    // de koopknop pas na een herstart), legt de omgeving vast en synchroniseert meteen.
    setOmgeving(omgeving);
  }

  // Niet gekoppeld of alleen lezen is neutraal; handelen krijgt de winstkleur, maar alleen als tekst
  // en rand van een pil, nooit als gevuld vlak.
  const kanHandelen = sleutelStatus !== 'Niet ingesteld' && sleutelStatus !== 'Alleen lezen';
  const chipKleur = kanHandelen ? colors.winst : colors.tekstGedimd;

  const valutaUitleg = koersOntbreekt
    ? 'De wisselkoers is nog niet opgehaald, dus bedragen staan voorlopig in dollars. Zodra er internet is pakt de app dit vanzelf op.'
    : valuta === 'EUR' && eurPerUsd !== null
      ? `Koersen en bedragen worden omgerekend tegen €${eurPerUsd.toFixed(4)} per dollar.`
      : 'Marktdata en eToro rekenen allebei in dollars. Kies euro als je liever ziet wat een bedrag in je eigen valuta is.';

  return (
    <>
      <PodiumScherm zichtbaar={zichtbaar} onSluiten={onSluiten}>
        {sluit => (
          <View style={[styles.root, { backgroundColor: colors.achtergrond }]}>
            <View style={[styles.header, { paddingTop: spacing.sm + extraKopruimte }]}>
              <Text accessibilityRole="header" style={[styles.titel, { color: colors.tekstPrimair }]}>
                Instellingen
              </Text>
              <Pressable
                onPress={() => sluit()}
                style={[styles.sluitKnop, { backgroundColor: colors.verhoogd }]}
                accessibilityRole="button"
                accessibilityLabel="Sluiten"
              >
                <X size={18} color={colors.tekstPrimair} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <LijstGroep
                titel="eToro"
                voetnoot={
                  omgeving === 'real'
                    ? 'Orders die je bevestigt gaan naar je echte eToro-account, met je eigen geld. Demo en echt gebruiken dezelfde sleutel; alleen het adres waar een order heen gaat verschilt.'
                    : `Demo is oefengeld. ${schermlezer ? 'Dubbeltik op Echt en bevestig' : 'Houd Echt vast'} om over te stappen naar je echte account. Je portfolio toont daarna alleen je echte posities. Demo en echt gebruiken dezelfde sleutel; alleen het adres waar een order heen gaat verschilt.`
                }
              >
                <LijstRij
                  icoon={Link2}
                  icoonKleur={colors.cta}
                  titel="Koppeling"
                  sub="Sleutel op dit toestel"
                  onPress={() => setWizardOpen(true)}
                  accessibilityLabel={`eToro-koppeling, sleutel op dit toestel, nu ${sleutelStatus.toLowerCase()}`}
                  rechts={
                    <>
                      <View style={[styles.chip, { borderColor: kanHandelen ? colors.winst : colors.rand }]}>
                        <Text style={[Type.caption, styles.chipTekst, { color: chipKleur }]}>{sleutelStatus}</Text>
                      </View>
                      <ChevronRight size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
                    </>
                  }
                />
                <View style={styles.segmentRij}>
                  <Text style={[Type.body, styles.rijLabel, { color: colors.tekstPrimair }]}>Handelsomgeving</Text>
                  <SegmentKnop
                    opties={OMGEVINGEN}
                    actief={omgeving}
                    onKies={kiesOmgeving}
                    vasthouden={VASTHOUDEN}
                    onTikZonderVasthouden={id => { if (id === 'real') toonHoudHint(); }}
                    schermlezerBevestig={bevestigEcht}
                    geblokkeerd={bezigWisselen}
                  />
                  {hintGetoond && (
                    <Animated.Text
                      accessibilityLiveRegion="polite"
                      style={[Type.caption, styles.hint, { color: colors.tekstGedimd }, hintStijl]}
                    >
                      Houd Echt vast om over te stappen.
                    </Animated.Text>
                  )}
                </View>
              </LijstGroep>

              <LijstGroep
                titel="Handelen"
                style={styles.groep}
                lijnInspringing={spacing.base}
                voetnoot={
                  kapitaal !== null
                    ? `Op ${risico}% van ${fmtBedrag(kapitaal, { valuta: 'USD' })} verlies je bij een geraakte stop ${fmtBedrag((kapitaal * risicoGetal) / 100, { valuta: 'USD' })}. Met Mijn risico in de kooporder rekent Kader het bedrag daarbij uit.`
                    : 'Wat je verliest als je stop geraakt wordt. Vul op Portfolio je handelskapitaal in, dan rekent de kooporder het bedrag daarbij uit.'
                }
              >
                <View style={styles.segmentRij}>
                  <Text style={[Type.body, styles.rijLabel, { color: colors.tekstPrimair }]}>Risico per trade</Text>
                  <SegmentKnop opties={RISICOS} actief={risico} onKies={kiesPct} />
                </View>
              </LijstGroep>

              <LijstGroep
                titel="Weergave"
                style={styles.groep}
                lijnInspringing={spacing.base}
                voetnoot={
                  <>
                    <Text style={[Type.caption, { color: koersOntbreekt ? colors.letOp : colors.tekstGedimd }]}>
                      {valutaUitleg}
                    </Text>
                    <Text style={[Type.caption, styles.voetnootVervolg, { color: colors.tekstGedimd }]}>
                      Orders reken je bij eToro altijd in dollars af, dus de ordervensters blijven in dollars.
                    </Text>
                    <Text style={[Type.caption, styles.voetnootVervolg, { color: colors.tekstGedimd }]}>
                      Candles gelden voor de grote grafiek op het detailscherm van een coin: hol als de koers in die periode steeg, gevuld als hij daalde. De kleine grafiekjes op de kaarten blijven een lijn.
                    </Text>
                  </>
                }
              >
                <View style={styles.segmentRij}>
                  <Text style={[Type.body, styles.rijLabel, { color: colors.tekstPrimair }]}>Thema</Text>
                  <SegmentKnop opties={THEMAS} actief={modus} onKies={setModus} />
                </View>
                <View style={styles.segmentRij}>
                  <Text style={[Type.body, styles.rijLabel, { color: colors.tekstPrimair }]}>Valuta</Text>
                  <SegmentKnop opties={VALUTAS} actief={valuta} onKies={kiesValuta} />
                </View>
                <View style={styles.segmentRij}>
                  <Text style={[Type.body, styles.rijLabel, { color: colors.tekstPrimair }]}>Grafiek</Text>
                  <SegmentKnop opties={GRAFIEKSOORTEN} actief={grafiekSoort} onKies={kiesGrafiekSoort} />
                </View>
              </LijstGroep>

              <LijstGroep
                titel="Meldingen"
                style={styles.groep}
                voetnoot={
                  meldingen
                    ? 'Kader stuurt een dagelijkse herinnering, meldt het als een open positie aandacht vraagt of het marktklimaat omslaat, en waarschuwt je bij een prijsalert die je zelf hebt gezet.'
                    : 'Kader stuurt geen enkele melding meer, ook geen prijsalerts. Je alerts blijven staan en gaan weer werken zodra je dit aanzet.'
                }
              >
                <LijstRij
                  icoon={Bell}
                  titel="Meldingen"
                  sub="Posities, marktklimaat en prijsalerts"
                  rechts={
                    // Grijs als hij aan staat, niet groen: aan is geen goedkeuring.
                    <Switch
                      value={meldingen}
                      onValueChange={kiesMeldingen}
                      disabled={bezigMeldingen}
                      trackColor={{ true: colors.tekstGedimd, false: colors.rand }}
                      // Zonder thumbColor kleurt Android de knop in zijn eigen accent (groenblauw).
                      thumbColor={meldingen ? colors.tekstPrimair : colors.verhoogd}
                      accessibilityLabel="Meldingen"
                    />
                  }
                />
                <LijstRij
                  icoon={CalendarDays}
                  titel="Weekrapport"
                  sub="Zondag vanaf 18:00, je week in R"
                  rechts={
                    <Switch
                      value={meldingen && weekrapport}
                      onValueChange={kiesWeekrapport}
                      disabled={!meldingen}
                      trackColor={{ true: colors.tekstGedimd, false: colors.rand }}
                      thumbColor={meldingen && weekrapport ? colors.tekstPrimair : colors.verhoogd}
                      accessibilityLabel="Weekrapport"
                    />
                  }
                />
              </LijstGroep>

              <LijstGroep
                titel="Widget"
                style={styles.groep}
                lijnInspringing={spacing.base}
                voetnoot="Je startscherm zien ook anderen, dus dollars staan er alleen op als je dat hier kiest. De widget ververst als je Kader gebruikt en daarbuiten ongeveer elk kwartier; Android bepaalt het precieze moment."
              >
                <View style={styles.segmentRij}>
                  <Text style={[Type.body, styles.rijLabel, { color: colors.tekstPrimair }]}>Indeling</Text>
                  <SegmentKnop opties={WIDGET_INDELINGEN} actief={widget.indeling} onKies={id => kiesWidget({ indeling: id })} />
                </View>
                <View style={styles.segmentRij}>
                  <Text style={[Type.body, styles.rijLabel, { color: colors.tekstPrimair }]}>Hoofdgetal</Text>
                  <SegmentKnop opties={WIDGET_HOOFDGETALLEN} actief={widget.hoofdgetal} onKies={id => kiesWidget({ hoofdgetal: id })} />
                </View>
                <LijstRij
                  icoon={LayoutGrid}
                  titel="Bedragen in dollars"
                  sub="Resultaat en vermogen in dollars"
                  rechts={
                    <Switch
                      value={widget.bedragen}
                      onValueChange={aan => kiesWidget({ bedragen: aan })}
                      trackColor={{ true: colors.tekstGedimd, false: colors.rand }}
                      thumbColor={widget.bedragen ? colors.tekstPrimair : colors.verhoogd}
                      accessibilityLabel="Bedragen in dollars op de widget"
                    />
                  }
                />
                <LijstRij
                  icoon={SlidersHorizontal}
                  titel="Balken naar stop en doel"
                  sub="Op de brede widget, per positie"
                  rechts={
                    <Switch
                      value={widget.balken}
                      onValueChange={aan => kiesWidget({ balken: aan })}
                      trackColor={{ true: colors.tekstGedimd, false: colors.rand }}
                      thumbColor={widget.balken ? colors.tekstPrimair : colors.verhoogd}
                      accessibilityLabel="Balken naar stop en doel op de widget"
                    />
                  }
                />
                <View style={styles.segmentRij}>
                  <Text style={[Type.body, styles.rijLabel, { color: colors.tekstPrimair }]}>Welke posities</Text>
                  <SegmentKnop opties={WIDGET_VOLGORDES} actief={widget.volgorde} onKies={id => kiesWidget({ volgorde: id })} />
                </View>
                <View style={styles.segmentRij}>
                  <Text style={[Type.body, styles.rijLabel, { color: colors.tekstPrimair }]}>Aantal posities</Text>
                  <SegmentKnop
                    opties={WIDGET_AANTALLEN}
                    actief={String(widget.aantal) as '2' | '3' | '4'}
                    onKies={id => kiesWidget({ aantal: Number(id) as 2 | 3 | 4 })}
                  />
                </View>
              </LijstGroep>

              <LijstGroep titel="Over Kader" style={styles.groep}>
                <LijstRij
                  icoon={FileText}
                  titel="Wijzigingen"
                  waarde={VERSIE}
                  rechts="pijl"
                  onPress={() => setChangelogOpen(true)}
                  accessibilityLabel={VERSIE ? `Wijzigingen, versie ${VERSIE}` : 'Wijzigingen'}
                />
              </LijstGroep>

              <View style={styles.disclaimer}>
                <Disclaimer metRand={false} />
              </View>
            </ScrollView>
          </View>
        )}
      </PodiumScherm>

      {/* Eigen Modals, dus ze liggen boven het scherm; dat blijft eronder gewoon staan. */}
      <ChangelogSheet
        zichtbaar={changelogOpen}
        onSluiten={() => setChangelogOpen(false)}
        onRondleiding={() => {
          // Eerst de sheet laten wegschuiven, dan pas het scherm: geen twee Modals tegelijk in beweging.
          setChangelogOpen(false);
          setTimeout(() => setRondleidingOpen(true), 280);
        }}
      />
      <NieuwInKaderScherm
        zichtbaar={rondleidingOpen}
        onSluiten={() => setRondleidingOpen(false)}
        features={CHANGELOG[0]?.nieuweFeatures ?? []}
      />
      <EtoroKoppelingWizard
        zichtbaar={wizardOpen}
        onSluiten={() => setWizardOpen(false)}
        onOpgeslagen={naOpslaan}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xs,
  },
  titel: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontWeight: '600',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  sluitKnop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
  },
  groep: { marginTop: spacing.lg },
  chip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    // Smal genoeg dat de titel bij 360 dp en grote letter ruimte houdt; de tekst loopt dan door
    // op een tweede regel in plaats van afgeknipt te worden.
    maxWidth: 128,
  },
  chipTekst: { textAlign: 'center' },
  segmentRij: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rijLabel: { fontWeight: '600' },
  hint: { marginTop: spacing.xs },
  voetnootVervolg: { marginTop: spacing.xs },
  disclaimer: { marginTop: spacing.lg, alignItems: 'center' },
});
