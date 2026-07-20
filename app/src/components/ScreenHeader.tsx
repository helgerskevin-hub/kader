import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Settings, BookOpen, Bell } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { InstellingenSheet } from './InstellingenSheet';
import { AchtergrondScherm } from './AchtergrondScherm';
import { MeldingenSheet } from './MeldingenSheet';
import { KaderLogo } from './KaderLogo';
import { laadLijst, laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import { MeldingLogEntry } from '../notifications/tradeChecks';

interface Props {
  titel: string;
  meta?: string;
  rechts?: React.ReactNode;
}

// Zelfde cadans als de prijs-poll elders: een AsyncStorage-read elke 60s is verwaarloosbaar en
// bespaart een apart event-systeem om het belletje te laten verversen na een achtergrondmelding.
const MELDINGEN_POLL_MS = 60_000;

export function ScreenHeader({ titel, meta, rechts }: Props) {
  const { colors } = useTheme();
  const [instellingenOpen, setInstellingenOpen] = useState(false);
  const [uitlegOpen, setUitlegOpen] = useState(false);
  const [meldingenOpen, setMeldingenOpen] = useState(false);
  const [meldingenLog, setMeldingenLog] = useState<MeldingLogEntry[]>([]);
  const [ongelezen, setOngelezen] = useState(0);

  const ververs = useCallback(async () => {
    const [log, gezien] = await Promise.all([
      laadLijst<MeldingLogEntry>(SLEUTELS.meldingLog),
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
        {rechts ? <View style={styles.rechts}>{rechts}</View> : null}
        <Pressable
          onPress={openMeldingen}
          accessibilityRole="button"
          accessibilityLabel={ongelezen > 0 ? `Meldingen, ${ongelezen} ongelezen` : 'Meldingen'}
          style={styles.tandwiel}
        >
          <Bell size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
          {ongelezen > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.cta, borderColor: colors.kaart }]}>
              <Text style={styles.badgeTekst}>{ongelezen > 9 ? '9+' : ongelezen}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={() => setUitlegOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Achtergrondinformatie"
          style={styles.tandwiel}
        >
          <BookOpen size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
        <Pressable
          onPress={() => setInstellingenOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Instellingen"
          style={styles.tandwiel}
        >
          <Settings size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>
      <InstellingenSheet zichtbaar={instellingenOpen} onSluiten={() => setInstellingenOpen(false)} />
      <AchtergrondScherm zichtbaar={uitlegOpen} onSluiten={() => setUitlegOpen(false)} />
      <MeldingenSheet zichtbaar={meldingenOpen} onSluiten={() => setMeldingenOpen(false)} log={meldingenLog} />
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
  tandwiel: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeTekst: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
