import React, { useEffect, useState } from 'react';
import {
  Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { infoVoor } from '../engine/coinInfo';
import { fmtPrijs, fmtRR } from '../engine/format';
import { usePortfolio } from '../state/PortfolioProvider';
import { nieuweId, PortfolioTrade } from '../state/portfolioTypes';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, shadow, spacing } from '../theme/tokens';
import { useToetsenbordHoogte } from '../theme/useToetsenbordHoogte';

interface Props {
  zichtbaar: boolean;
  trade: Trade | null;
  onSluiten: () => void;
}

interface VormData {
  bedragUsd: string;
  entryPrijs: string;
  aantalCoins: string;
}

function leegForm(trade: Trade | null): VormData {
  return {
    bedragUsd: '',
    entryPrijs: trade ? trade.entry.toString() : '',
    aantalCoins: '',
  };
}

export function GetradeFormulier({ zichtbaar, trade, onSluiten }: Props) {
  const { colors } = useTheme();
  const { voegTradeToe } = usePortfolio();
  const [form, setForm] = useState<VormData>(() => leegForm(trade));
  const [fout, setFout] = useState('');
  const toetsenbordHoogte = useToetsenbordHoogte();

  useEffect(() => {
    if (zichtbaar) {
      setForm(leegForm(trade));
      setFout('');
    }
  }, [zichtbaar, trade]);

  useEffect(() => {
    const bedrag = parseFloat(form.bedragUsd.replace(',', '.'));
    const prijs = parseFloat(form.entryPrijs.replace(',', '.'));
    if (bedrag > 0 && prijs > 0) {
      setForm(prev => ({ ...prev, aantalCoins: (bedrag / prijs).toFixed(6) }));
    }
  }, [form.bedragUsd, form.entryPrijs]);

  function valideerEnOpslaan() {
    const bedrag = parseFloat(form.bedragUsd.replace(',', '.'));
    const prijs = parseFloat(form.entryPrijs.replace(',', '.'));
    const aantal = parseFloat(form.aantalCoins.replace(',', '.'));

    if (isNaN(bedrag) || bedrag <= 0) { setFout('Voer een geldig bedrag in (groter dan 0)'); return; }
    if (isNaN(prijs) || prijs <= 0) { setFout('Voer een geldige aankoopprijs in'); return; }
    if (isNaN(aantal) || aantal <= 0) { setFout('Aantal coins moet groter dan 0 zijn'); return; }
    if (!trade) return;

    const coin = infoVoor(trade.symbool);
    const portfolioTrade: PortfolioTrade = {
      id: nieuweId(),
      symbool: trade.symbool,
      naam: coin.naam,
      entryPrijs: prijs,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      rr: trade.rr,
      datum: new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'open',
      bedragUsd: bedrag,
      aantalCoins: aantal,
    };

    voegTradeToe(portfolioTrade);
    setForm(leegForm(null));
    setFout('');
    onSluiten();
  }

  const inputStyle = [stijlen.input, {
    backgroundColor: colors.verhoogd,
    borderColor: colors.rand,
    color: colors.tekstPrimair,
  }];

  const coin = trade ? infoVoor(trade.symbool) : null;

  return (
    <Modal visible={zichtbaar} animationType="slide" transparent onRequestClose={onSluiten}>
      <View style={stijlen.overlay}>
        <View style={[
          stijlen.vel, shadow.modal,
          { backgroundColor: colors.kaart, paddingBottom: Math.max(spacing.xl, toetsenbordHoogte) },
        ]}>
          <View style={stijlen.titelRij}>
            <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Trade toevoegen</Text>
            <Pressable
              onPress={onSluiten}
              accessibilityLabel="Sluiten"
              accessibilityRole="button"
              style={stijlen.sluitKnop}
            >
              <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {trade && coin ? (
              <View style={[stijlen.infoBlok, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}>
                <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>
                  {trade.symbool} <Text style={[Type.body, { color: colors.tekstGedimd }]}>{coin.naam}</Text>
                </Text>
                <View style={stijlen.infoRij}>
                  <View style={stijlen.infoVeld}>
                    <Text style={[Type.overline, { color: colors.tekstGedimd }]}>STOP</Text>
                    <Text style={[Type.prijs, { color: colors.verlies }]}>{fmtPrijs(trade.stopLoss)}</Text>
                  </View>
                  <View style={stijlen.infoVeld}>
                    <Text style={[Type.overline, { color: colors.tekstGedimd }]}>DOEL</Text>
                    <Text style={[Type.prijs, { color: colors.winst }]}>{fmtPrijs(trade.takeProfit)}</Text>
                  </View>
                  <View style={stijlen.infoVeld}>
                    <Text style={[Type.overline, { color: colors.tekstGedimd }]}>R/R</Text>
                    <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{fmtRR(trade.rr)}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <Text style={[Type.overline, stijlen.label, { color: colors.tekstGedimd }]}>BEDRAG IN $</Text>
            <TextInput
              style={inputStyle}
              value={form.bedragUsd}
              onChangeText={v => setForm(prev => ({ ...prev, bedragUsd: v }))}
              placeholder="bijv. 500"
              placeholderTextColor={colors.tekstGedimd}
              keyboardType="decimal-pad"
            />

            <Text style={[Type.overline, stijlen.label, { color: colors.tekstGedimd }]}>AANKOOPPRIJS</Text>
            <TextInput
              style={inputStyle}
              value={form.entryPrijs}
              onChangeText={v => setForm(prev => ({ ...prev, entryPrijs: v }))}
              placeholder="bijv. 45000"
              placeholderTextColor={colors.tekstGedimd}
              keyboardType="decimal-pad"
            />

            <Text style={[Type.overline, stijlen.label, { color: colors.tekstGedimd }]}>AANTAL COINS</Text>
            <TextInput
              style={inputStyle}
              value={form.aantalCoins}
              onChangeText={v => setForm(prev => ({ ...prev, aantalCoins: v }))}
              placeholder="auto-berekend"
              placeholderTextColor={colors.tekstGedimd}
              keyboardType="decimal-pad"
            />

            {fout ? (
              <Text style={[Type.caption, { color: colors.verlies, marginTop: spacing.sm }]}>{fout}</Text>
            ) : null}

            <Pressable
              style={[stijlen.opslaanKnop, { backgroundColor: colors.cta }]}
              onPress={valideerEnOpslaan}
              accessibilityRole="button"
            >
              <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Trade opslaan</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const stijlen = StyleSheet.create({
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
    maxHeight: '90%',
  },
  titelRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  infoBlok: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoRij: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.base,
  },
  infoVeld: { flex: 1 },
  label: { marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radii.veld,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    minHeight: 44,
  },
  opslaanKnop: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    alignItems: 'center',
    minHeight: 44,
  },
});
