import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { X, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { relatieveTijd } from '../engine/format';
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

      {log.length === 0 ? (
        <Text style={[Type.body, { color: colors.tekstGedimd }]}>
          Nog geen meldingen. Zodra Kader iets over je trades te melden heeft, verschijnt het hier.
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {log.map((entry, i) => (
            <Regel
              key={`${entry.tijd}-${i}`}
              entry={entry}
              onKies={onKies}
            />
          ))}
        </ScrollView>
      )}
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
  scroll: { flexGrow: 0 },
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
  entryKop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
});
