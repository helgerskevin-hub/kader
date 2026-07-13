import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CheckCircle, XCircle, Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { PortfolioTrade } from '../state/portfolioTypes';

interface Props {
  trade: PortfolioTrade | null;
  onSluiten: () => void;
  onGewonnen: (trade: PortfolioTrade) => void;
  onVerloren: (trade: PortfolioTrade) => void;
  onAanpassen: (trade: PortfolioTrade) => void;
  onVerwijderen: (trade: PortfolioTrade) => void;
}

// Kebab-menu voor de compacte tradelijst: dezelfde vier acties als de voetbalk van de uitgebreide
// kaart, maar dan in een sheet omdat er in de compacte regel geen ruimte voor knoppen is.
export function TradeActiesSheet({ trade, onSluiten, onGewonnen, onVerloren, onAanpassen, onVerwijderen }: Props) {
  const { colors } = useTheme();

  function uitvoeren(actie: (trade: PortfolioTrade) => void) {
    if (!trade) return;
    onSluiten();
    actie(trade);
  }

  return (
    <BottomSheet zichtbaar={trade !== null} onSluiten={onSluiten}>
      <View style={styles.kop}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{trade?.symbool}</Text>
        {trade?.naam ? (
          <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{trade.naam}</Text>
        ) : null}
      </View>

      {trade?.status === 'open' && (
        <>
          <Rij
            icoon={<CheckCircle size={18} color={colors.winst} strokeWidth={1.75} />}
            label="Gewonnen"
            kleur={colors.winst}
            rand={colors.rand}
            onPress={() => uitvoeren(onGewonnen)}
          />
          <Rij
            icoon={<XCircle size={18} color={colors.verlies} strokeWidth={1.75} />}
            label="Verloren"
            kleur={colors.verlies}
            rand={colors.rand}
            onPress={() => uitvoeren(onVerloren)}
          />
          <Rij
            icoon={<Pencil size={18} color={colors.cta} strokeWidth={1.75} />}
            label="Aanpassen"
            kleur={colors.cta}
            rand={colors.rand}
            onPress={() => uitvoeren(onAanpassen)}
          />
        </>
      )}
      <Rij
        icoon={<Trash2 size={18} color={colors.verlies} strokeWidth={1.75} />}
        label="Verwijderen"
        kleur={colors.verlies}
        rand={colors.rand}
        laatste
        onPress={() => uitvoeren(onVerwijderen)}
      />
    </BottomSheet>
  );
}

function Rij({ icoon, label, kleur, rand, laatste, onPress }: {
  icoon: React.ReactNode;
  label: string;
  kleur: string;
  rand: string;
  laatste?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.rij, !laatste && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: rand }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icoon}
      <Text style={[Type.body, { color: kleur }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kop: {
    gap: 2,
    marginBottom: spacing.sm,
  },
  rij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
});
