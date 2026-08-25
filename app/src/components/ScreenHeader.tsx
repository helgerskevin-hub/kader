import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { InstellingenSheet } from './InstellingenSheet';
import { AchtergrondScherm } from './AchtergrondScherm';
import { MeldingenSheet } from './MeldingenSheet';
import { SysteemMenu, MenuAnker } from './SysteemMenu';
import { KaderLogo } from './KaderLogo';
import { laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import { MeldingLogEntry, laadMeldingLog } from '../notifications/tradeChecks';
import { MeldingDoel } from '../notifications/meldingDoel';
import { useNavigatie } from '../state/navigatie';
import { usePortfolio } from '../state/PortfolioProvider';

interface Props {
  titel: string;
  meta?: string;
  rechts?: React.ReactNode;
  // De DEMO-pil staat standaard aan. Alleen uitzetten als een scherm zelf al onmiskenbaar toont in
  // welke omgeving je zit; de gevaarlijke toestand is immers vergeten dat je in echt staat.
  toonDemoPil?: boolean;
}

// Zelfde cadans als de prijs-poll elders: een AsyncStorage-read elke 60s is verwaarloosbaar en
// bespaart een apart event-systeem om het belletje te laten verversen na een achtergrondmelding.
const MELDINGEN_POLL_MS = 60_000;

export function ScreenHeader({ titel, meta, rechts, toonDemoPil = true }: Props) {
  const { colors } = useTheme();
  const { omgeving } = usePortfolio();
  const { gaNaar } = useNavigatie();
  const [instellingenOpen, setInstellingenOpen] = useState(false);
  const [uitlegOpen, setUitlegOpen] = useState(false);
  const [meldingenOpen, setMeldingenOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anker, setAnker] = useState<MenuAnker | null>(null);
  const [meldingenLog, setMeldingenLog] = useState<MeldingLogEntry[]>([]);
  const [ongelezen, setOngelezen] = useState(0);
  const kebabRef = useRef<View>(null);

  const ververs = useCallback(async () => {
    const [log, gezien] = await Promise.all([
      laadMeldingLog(),
      laadTekst(SLEUTELS.meldingenGezienTijd, '0'),
    ]);
    setMeldingenLog(log);
    const gezienTijd = Number(gezien) || 0;
    setOngelezen(log.filter(m => m.tijd > gezienTijd).length);
  }, []);

  useEffect(() => {
    ververs();
    const interval = setInterval(ververs, MELDINGEN_POLL_MS);
    return () => clearInterval(interval);
  }, [ververs]);

  function openMeldingen() {
    setMeldingenOpen(true);
    setOngelezen(0);
    bewaarTekst(SLEUTELS.meldingenGezienTijd, String(Date.now()));
  }

  // Eerst de sheet sluiten, dan pas navigeren. Andersom staat er nog een modal over het scherm
  // waar je net naartoe gestuurd bent, en dat leest als "er gebeurde niets".
  function kiesMelding(doel: MeldingDoel) {
    setMeldingenOpen(false);
    gaNaar(doel);
  }

  function openMenu() {
    kebabRef.current?.measureInWindow((x, y, breedte, hoogte) => {
      setAnker({ x, y, breedte, hoogte });
      setMenuOpen(true);
    });
  }

  return (
    <View style={[styles.header, { borderBottomColor: colors.rand }]}>
      <View style={styles.linksGroep}>
        <KaderLogo size={26} variant="outline" />
        <View style={styles.links}>
          <Text style={[Type.titel, { color: colors.tekstPrimair }]} numberOfLines={1}>{titel}</Text>
          {meta ? (
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{meta}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rechtsGroep}>
        {toonDemoPil && omgeving === 'demo' && (
          <View
            style={[styles.demoPil, { backgroundColor: colors.letOp + '22', borderColor: colors.letOp }]}
            accessibilityLabel="Demo-omgeving actief, orders gaan niet met echt geld"
          >
            <Text style={[Type.overline, { color: colors.letOp }]}>DEMO</Text>
          </View>
        )}
        {rechts ? <View style={styles.rechts}>{rechts}</View> : null}
        <Pressable
          ref={kebabRef}
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={ongelezen > 0 ? `Menu, ${ongelezen} ongelezen meldingen` : 'Menu'}
          style={styles.tandwiel}
        >
          <MoreVertical size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
          {ongelezen > 0 && (
            <View style={[styles.stip, { backgroundColor: colors.cta, borderColor: colors.kaart }]} />
          )}
        </Pressable>
      </View>
      <SysteemMenu
        zichtbaar={menuOpen}
        onSluiten={() => setMenuOpen(false)}
        anker={anker}
        ongelezen={ongelezen}
        onMeldingen={openMeldingen}
        onAchtergrond={() => setUitlegOpen(true)}
        onInstellingen={() => setInstellingenOpen(true)}
      />
      <InstellingenSheet zichtbaar={instellingenOpen} onSluiten={() => setInstellingenOpen(false)} />
      <AchtergrondScherm zichtbaar={uitlegOpen} onSluiten={() => setUitlegOpen(false)} />
      <MeldingenSheet
        zichtbaar={meldingenOpen}
        onSluiten={() => setMeldingenOpen(false)}
        log={meldingenLog}
        onKies={kiesMelding}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linksGroep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  links: {
    gap: 2,
    flexShrink: 1,
  },
  rechtsGroep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  rechts: {
    alignItems: 'flex-end',
  },
  demoPil: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tandwiel: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stip: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
  },
});
