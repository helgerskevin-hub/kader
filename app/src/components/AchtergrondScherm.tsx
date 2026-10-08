import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  X, ChevronLeft, Search, CircleX, Info,
  Activity, BadgeCheck, Bell, BellRing, ChartCandlestick, ChartPie, ChartSpline, CloudRain, CloudSun, Gauge, History,
  Layers, Link, Scale, Shield, ShieldAlert, ShoppingCart, Store, Thermometer, TrendingDown, Users,
  Wallet, Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useModalKopruimte } from '../theme/useModalKopruimte';
import { Type, Fonts } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { uitklapIn, uitklapUit } from '../theme/lijstBeweging';
import { Disclaimer } from './Disclaimer';
import { PodiumScherm } from './PodiumScherm';
import { UitklapPijl } from './UitklapPijl';
import { StapOvergang } from './StapOvergang';
import { LijstGroep } from './lijst/LijstGroep';
import { LijstRij } from './lijst/LijstRij';
import { InfoVisualisatie } from './informatie/InfoVisualisatie';
import {
  BRONNEN, GROEPEN, HOOFDSTUKKEN, SHORTS_HOOFDSTUK, type Hoofdstuk,
} from '../informatie/hoofdstukken';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
}

// Statische map van icoonnaam (uit hoofdstukken.ts) naar component; geen dynamische require.
const ICONEN: Record<string, LucideIcon> = {
  Activity, BadgeCheck, Bell, BellRing, ChartCandlestick, ChartPie, ChartSpline, CloudRain, CloudSun, Gauge, History,
  Layers, Link, Scale, Shield, ShieldAlert, ShoppingCart, Store, Thermometer, TrendingDown, Users,
  Wallet, Zap,
};

const BRONNEN_ID = 'bronnen';

// Shorts staat als laatste in de groep Handelen.
const ALLE: Hoofdstuk[] = [...HOOFDSTUKKEN, SHORTS_HOOFDSTUK];

export function AchtergrondScherm({ zichtbaar, onSluiten }: Props) {
  const { colors } = useTheme();
  const extraKopruimte = useModalKopruimte();
  const [open, setOpen] = useState<string | null>(null);
  const [zoek, setZoek] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Niets onthouden tussen openen: terug naar de index.
  useEffect(() => {
    if (zichtbaar) {
      setOpen(null);
      setZoek('');
      indexY.current = 0;
      herstelIndex.current = false;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [zichtbaar]);

  // Een hoofdstuk begint bovenaan. Terug naar de index gaat naar waar je was: die wordt bij het
  // openen van een hoofdstuk ontmount, en de ScrollView krimpt dan mee naar de hoogte van het
  // hoofdstuk, dus de stand moet apart onthouden en na de nieuwe layout teruggezet worden.
  const indexY = useRef(0);
  const herstelIndex = useRef(false);
  // Het herstel is pas klaar als de index weer hoog genoeg is om tot indexY te scrollen; daarvoor
  // klemt de ScrollView de stand af. Tot dan probeert elke nieuwe inhoudshoogte het opnieuw.
  const inhoudHoogte = useRef(0);
  const zichtHoogte = useRef(0);
  const herstel = () => {
    if (!herstelIndex.current) return;
    scrollRef.current?.scrollTo({ y: indexY.current, animated: false });
    if (inhoudHoogte.current - zichtHoogte.current >= indexY.current - 1) herstelIndex.current = false;
  };
  useEffect(() => {
    if (open === null) {
      if (!herstelIndex.current) return;
      requestAnimationFrame(herstel);
      return;
    }
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [open]);

  const openHoofdstuk = (id: string) => {
    herstelIndex.current = false;
    setOpen(id);
  };
  const terugNaarIndex = () => {
    herstelIndex.current = true;
    setOpen(null);
  };

  const onTerug = () => {
    if (open !== null) {
      terugNaarIndex();
      return true;
    }
    return false;
  };

  const hoofdstuk = open && open !== BRONNEN_ID ? ALLE.find(h => h.id === open) ?? null : null;
  const stapIndex = open === null ? 0 : 1;

  return (
    <PodiumScherm zichtbaar={zichtbaar} onSluiten={onSluiten} onTerug={onTerug}>
      {sluit => (
        <View style={[styles.root, { backgroundColor: colors.achtergrond }]}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.scroll, { paddingTop: spacing.sm + extraKopruimte }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={32}
            onScroll={e => { if (open === null && !herstelIndex.current) indexY.current = e.nativeEvent.contentOffset.y; }}
            // Scrolt de gebruiker zelf, dan wint dat van een herstel dat nog wacht.
            onScrollBeginDrag={() => { herstelIndex.current = false; }}
            onLayout={e => { zichtHoogte.current = e.nativeEvent.layout.height; }}
            onContentSizeChange={(_breedte, hoogte) => {
              inhoudHoogte.current = hoogte;
              if (open === null) herstel();
            }}
          >
            <StapOvergang stapIndex={stapIndex}>
              {open === null ? (
                <Index zoek={zoek} setZoek={setZoek} onOpen={openHoofdstuk} onSluit={() => sluit()} />
              ) : (
                <Pagina onTerug={terugNaarIndex}>
                  {open === BRONNEN_ID ? <Bronnen /> : hoofdstuk ? <HoofdstukPagina h={hoofdstuk} /> : null}
                </Pagina>
              )}
            </StapOvergang>
          </ScrollView>
        </View>
      )}
    </PodiumScherm>
  );
}

// ---------- Index ----------

function Index({
  zoek, setZoek, onOpen, onSluit,
}: { zoek: string; setZoek: (v: string) => void; onOpen: (id: string) => void; onSluit: () => void }) {
  const { colors } = useTheme();
  const q = zoek.trim().toLowerCase();

  const groepen = useMemo(() => {
    return GROEPEN.map(g => ({
      ...g,
      items: ALLE.filter(h => h.groep === g.id).filter(
        h => !q || h.titel.toLowerCase().includes(q) || h.kort.toLowerCase().includes(q),
      ),
    })).filter(g => g.items.length > 0);
  }, [q]);

  return (
    <View>
      <View style={styles.kopRij}>
        <Pressable
          onPress={onSluit}
          style={[styles.rond, { backgroundColor: colors.verhoogd }]}
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
        >
          <X size={20} color={colors.tekstPrimair} strokeWidth={1.75} />
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={[styles.grootTitel, { color: colors.tekstPrimair }]}>
        Informatie
      </Text>

      <View style={[styles.zoekVeld, { backgroundColor: colors.verhoogd }]}>
        <Search size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
        <TextInput
          value={zoek}
          onChangeText={setZoek}
          placeholder="Zoek, bijvoorbeeld stop of RSI"
          placeholderTextColor={colors.tekstGedimd}
          accessibilityLabel="Zoek in Informatie"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={[Type.body, styles.zoekInvoer, { color: colors.tekstPrimair }]}
        />
        {zoek.length > 0 ? (
          <Pressable
            onPress={() => setZoek('')}
            style={styles.wis}
            accessibilityRole="button"
            accessibilityLabel="Zoekopdracht wissen"
          >
            <CircleX size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        ) : null}
      </View>

      {groepen.length === 0 ? (
        <Text style={[Type.body, styles.leeg, { color: colors.tekstGedimd }]}>
          Geen hoofdstuk gevonden. Probeer een ander woord, zoals stop, RSI of eToro.
        </Text>
      ) : (
        groepen.map(g => (
          <LijstGroep key={g.id} titel={g.titel} style={styles.groep}>
            {g.items.map(h => (
              <LijstRij
                key={h.id}
                icoon={ICONEN[h.icoon]}
                icoonKleur={colors.cta}
                titel={h.titel}
                sub={h.kort}
                rechts="pijl"
                nieuw={h.nieuw}
                onPress={() => onOpen(h.id)}
              />
            ))}
          </LijstGroep>
        ))
      )}

      {!q ? (
        <LijstGroep titel="Over deze app" style={styles.groep}>
          <LijstRij
            icoon={Info}
            titel="Bronnen"
            sub="Waar de koersen, iconen en licenties vandaan komen."
            rechts="pijl"
            onPress={() => onOpen(BRONNEN_ID)}
          />
        </LijstGroep>
      ) : null}

      <View style={styles.disclaimer}>
        <Disclaimer />
      </View>
    </View>
  );
}

// ---------- Gedeelde kop van een subpagina ----------

function Pagina({ onTerug, children }: { onTerug: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View>
      <Pressable
        onPress={onTerug}
        style={styles.terug}
        accessibilityRole="button"
        accessibilityLabel="Terug naar Informatie"
      >
        <ChevronLeft size={22} color={colors.cta} strokeWidth={2} />
        <Text style={[Type.body, styles.terugTekst, { color: colors.cta }]}>Informatie</Text>
      </Pressable>
      {children}
    </View>
  );
}

// ---------- Hoofdstuk ----------

function HoofdstukPagina({ h }: { h: Hoofdstuk }) {
  const { colors } = useTheme();
  const groep = GROEPEN.find(g => g.id === h.groep);
  const blokken: [string, string][] = [
    ['WAT JE ZIET', h.zie],
    ['HOE KADER REKENT', h.reken],
    ['WAT JE ERMEE DOET', h.doe],
  ];

  return (
    <View>
      <Text style={[Type.overline, { color: colors.cta }]}>{(groep?.titel ?? '').toUpperCase()}</Text>
      <Text accessibilityRole="header" style={[styles.hTitel, { color: colors.tekstPrimair }]}>
        {h.titel}
      </Text>
      <Text style={[Type.body, styles.kort, { color: colors.tekstGedimd }]}>{h.kort}</Text>

      <View style={styles.vis}>
        <InfoVisualisatie id={h.id} />
      </View>

      {blokken.map(([kop, tekst]) => (
        <View key={kop} style={styles.blok}>
          <Text accessibilityRole="header" style={[Type.overline, { color: colors.tekstGedimd }]}>{kop}</Text>
          <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>{tekst}</Text>
        </View>
      ))}

      {h.detail.length > 0 ? (
        <Uitklap titel="Meer detail">
          {h.detail.map((d, i) => (
            <View key={i} style={styles.punt}>
              <Text style={[Type.body, styles.tekst, { color: colors.tekstGedimd }]}>{'•'}</Text>
              <Text style={[Type.body, styles.tekst, styles.puntTekst, { color: colors.tekstPrimair }]}>{d}</Text>
            </View>
          ))}
        </Uitklap>
      ) : null}

      <View style={styles.disclaimer}>
        <Disclaimer />
      </View>
    </View>
  );
}

// ---------- Bronnen ----------

function Bronnen() {
  const { colors } = useTheme();
  return (
    <View>
      <Text accessibilityRole="header" style={[styles.hTitel, { color: colors.tekstPrimair }]}>Bronnen</Text>
      {BRONNEN.map(b => (
        <View key={b.titel} style={styles.blok}>
          <Text accessibilityRole="header" style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{b.titel}</Text>
          <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>{b.tekst}</Text>
          {b.licentie ? (
            <Uitklap titel="Licentietekst">
              <Text style={[styles.licentie, { color: colors.tekstGedimd }]}>{b.licentie}</Text>
            </Uitklap>
          ) : null}
        </View>
      ))}
      <View style={styles.disclaimer}>
        <Disclaimer />
      </View>
    </View>
  );
}

// ---------- Uitklapper ----------

function Uitklap({ titel, children }: { titel: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.uitklap}>
      <Pressable
        onPress={() => setOpen(v => !v)}
        style={styles.uitklapKop}
        accessibilityRole="button"
        accessibilityLabel={titel}
        accessibilityState={{ expanded: open }}
      >
        <Text style={[Type.body, styles.uitklapTitel, { color: colors.cta }]}>{titel}</Text>
        <UitklapPijl open={open} size={18} color={colors.cta} />
      </Pressable>
      {open ? (
        <Animated.View entering={uitklapIn(reduceMotion)} exiting={uitklapUit()} style={styles.uitklapInhoud}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing.base, paddingBottom: spacing.xl },
  kopRij: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  rond: { width: 44, height: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  grootTitel: {
    fontFamily: Fonts.sansSemiBold, fontSize: 28, fontWeight: '600', lineHeight: 34,
    marginTop: spacing.sm, marginBottom: spacing.base,
  },
  zoekVeld: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44,
    borderRadius: radii.knop, paddingLeft: spacing.md, marginBottom: spacing.lg,
  },
  zoekInvoer: { flex: 1, minHeight: 44, paddingVertical: 0 },
  wis: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  leeg: { paddingVertical: spacing.lg, textAlign: 'center' },
  groep: { marginBottom: spacing.lg },
  disclaimer: { marginTop: spacing.lg },
  terug: { flexDirection: 'row', alignItems: 'center', height: 44, alignSelf: 'flex-start', marginLeft: -spacing.xs },
  terugTekst: { fontWeight: '600' },
  hTitel: {
    fontFamily: Fonts.sansSemiBold, fontSize: 28, fontWeight: '600', lineHeight: 34,
    marginTop: spacing.xs, marginBottom: spacing.sm,
  },
  kort: { marginBottom: spacing.base },
  vis: { marginBottom: spacing.lg },
  blok: { marginBottom: spacing.lg, gap: spacing.xs },
  tekst: { lineHeight: 22 },
  punt: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  puntTekst: { flex: 1 },
  uitklap: { marginTop: spacing.xs },
  uitklapKop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  uitklapTitel: { fontWeight: '600', flexShrink: 1 },
  uitklapInhoud: { paddingTop: spacing.xs },
  licentie: { fontFamily: Fonts.monoRegular, fontSize: 11, lineHeight: 16 },
});
