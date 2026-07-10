import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { Cloud, CloudCheck, CloudOff, RefreshCw, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { usePortfolio } from '../state/PortfolioProvider';
import { bepaalSyncStand, SyncNiveau } from '../state/syncStatus';

// Hoe vaak we opnieuw renderen zodat de relatieve tijd ("3 min geleden") blijft kloppen zonder
// dat er iets ververst hoeft te worden.
const TIK_MS = 30_000;

function IconVoor(niveau: SyncNiveau) {
  if (niveau === 'bezig') return RefreshCw;
  if (niveau === 'vers') return CloudCheck;
  if (niveau === 'fout' || niveau === 'oud') return CloudOff;
  return Cloud;
}

export function SyncStatusKnop() {
  const { colors } = useTheme();
  const { laatsteSync, syncFout, syncing, synchroniseer } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [nu, setNu] = useState(Date.now());
  const draai = useRef(new Animated.Value(0)).current;

  // Laat de tijd meelopen terwijl de app open is.
  useEffect(() => {
    const id = setInterval(() => setNu(Date.now()), TIK_MS);
    return () => clearInterval(id);
  }, []);

  // Draaiende cloud zolang er gesynchroniseerd wordt.
  useEffect(() => {
    if (!syncing) {
      draai.stopAnimation();
      draai.setValue(0);
      return;
    }
    const lus = Animated.loop(
      Animated.timing(draai, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    lus.start();
    return () => lus.stop();
  }, [syncing, draai]);

  const stand = bepaalSyncStand({ laatsteSync, syncFout, syncing, nu });
  const kleur = colors[stand.kleur];
  const Icon = IconVoor(stand.niveau);
  const rotatie = draai.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Synchronisatiestatus: ${stand.wanneer}`}
        style={styles.knop}
      >
        <Animated.View style={syncing ? { transform: [{ rotate: rotatie }] } : undefined}>
          <Icon size={20} color={kleur} strokeWidth={1.75} />
        </Animated.View>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.vel, shadow.modal, { backgroundColor: colors.kaart }]}>
            <View style={styles.titelRij}>
              <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Synchronisatie</Text>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityLabel="Sluiten"
                accessibilityRole="button"
                style={styles.sluitKnop}
              >
                <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
              </Pressable>
            </View>

            <View style={[styles.statusRij, { backgroundColor: kleur + '14', borderColor: kleur + '33' }]}>
              <Icon size={26} color={kleur} strokeWidth={1.75} />
              <View style={styles.statusTekst}>
                <Text style={[Type.body, { color: colors.tekstPrimair, fontWeight: '600' }]}>{stand.wanneer}</Text>
                <Text style={[Type.caption, { color: colors.tekstGedimd, marginTop: 2 }]}>{stand.advies}</Text>
              </View>
            </View>

            <Pressable
              onPress={() => { if (!syncing) synchroniseer(); }}
              disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel="Nu synchroniseren"
              style={[styles.ctaKnop, { backgroundColor: colors.cta, opacity: syncing ? 0.6 : 1 }]}
            >
              <Animated.View style={syncing ? { transform: [{ rotate: rotatie }] } : undefined}>
                <RefreshCw size={18} color="#FFFFFF" strokeWidth={2} />
              </Animated.View>
              <Text style={[Type.body, styles.ctaTekst]}>
                {syncing ? 'Bezig...' : 'Nu synchroniseren'}
              </Text>
            </Pressable>

            <Text style={[Type.caption, styles.voetnoot, { color: colors.tekstGedimd }]}>
              Koersen verversen automatisch elke minuut en zodra je de app opent.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  knop: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  vel: {
    borderTopLeftRadius: radii.kaart,
    borderTopRightRadius: radii.kaart,
    padding: spacing.base,
    paddingBottom: spacing.xl,
  },
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  statusRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    borderWidth: 1,
    borderRadius: radii.knop,
  },
  statusTekst: { flex: 1 },
  ctaKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.knop,
    paddingVertical: spacing.md,
    marginTop: spacing.base,
    minHeight: 48,
  },
  ctaTekst: { color: '#FFFFFF', fontWeight: '600' },
  voetnoot: { marginTop: spacing.md, textAlign: 'center' },
});
