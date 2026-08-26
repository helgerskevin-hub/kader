import React, { useEffect, useState } from 'react';
import {
  Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Trade } from '../engine/types';
import { infoVoor } from '../engine/coinInfo';
import { fmtPrijs, fmtRR } from '../engine/format';
import { bepaalStop, StopAdvies } from '../engine/etoroLimieten';
import { usePortfolio } from '../state/PortfolioProvider';
import { useStopLossLimiet } from '../state/useStopLossLimiet';
import { nieuweId, PortfolioTrade, Richting } from '../state/portfolioTypes';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';

// De prijzen en bedragen die je hier intikt bewaart Kader als dollars (zo komt de marktdata binnen),
// dus dit formulier blijft in dollars, ook als de app op euro's staat.
const DOLLARS = { valuta: 'USD' } as const;


// De analyse scant vooralsnog alleen longs, dus richting ontbreekt bij die aanroepen. Alleen het
// detailscherm van een bestaande (mogelijk short) positie geeft hem mee; ontbreekt hij, dan is het
// een long, dezelfde afspraak als richtingVan() in portfolioTypes.ts.
export type GetradeBron = Pick<Trade, 'symbool' | 'entry' | 'stopLoss' | 'takeProfit' | 'rr'> & { richting?: Richting };

interface Props {
  zichtbaar: boolean;
  trade: GetradeBron | null;
  onSluiten: () => void;
}

interface VormData {
  bedragUsd: string;
  entryPrijs: string;
  aantalCoins: string;
}

function leegForm(trade: GetradeBron | null): VormData {
  return {
    bedragUsd: '',
    entryPrijs: trade ? trade.entry.toString() : '',
    aantalCoins: '',
  };
}

// De R/R uit de analyse hoort bij de entry uit de analyse. Vul je zelf een andere aankoopprijs in,
// of schuift de stop op voor eToro, dan klopt dat getal niet meer. Kan de R/R niet uit die drie
// niveaus volgen (leeg entryveld, stop aan de verkeerde kant van de entry), dan wordt het 0. Dat
// is de afspraak die de rest van de app al hanteert: etoro.ts doet hetzelfde en het portfolio toont
// een streepje bij een R/R van 0, in plaats van een cijfer dat aantoonbaar niet meer klopt.
// Bij een short liggen stop en doel andersom (stop boven, doel onder de entry), dus risico en reward
// worden in de andere richting gemeten.
function herberekenRR(entry: number, stop: number, takeProfit: number, richting: Richting = 'long'): number {
  const risico = richting === 'short' ? stop - entry : entry - stop;
  const reward = richting === 'short' ? entry - takeProfit : takeProfit - entry;
  const rr = reward / risico;
  return risico > 0 && rr > 0 ? rr : 0;
}

export function GetradeFormulier({ zichtbaar, trade, onSluiten }: Props) {
  const { colors } = useTheme();
  const { voegTradeToe } = usePortfolio();
  const [form, setForm] = useState<VormData>(() => leegForm(trade));
  const [fout, setFout] = useState('');

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

  const richting: Richting = trade?.richting ?? 'long';
  const isShort = richting === 'short';

  // Kader rekent zijn eigen stop uit, maar eToro accepteert niet elke afstand. Meten we tegen de
  // aankoopprijs die je hier invult, want die wijkt af van de entry uit de analyse zodra de koers
  // is doorgelopen. Zonder eToro-koppeling of bij een API-fout blijft de limiet null en zeggen we
  // niets: liever geen waarschuwing dan een verzonnen grens. De limiet komt per richting binnen,
  // dus een short wordt tegen eToro's short-grenzen getoetst en niet tegen de ruimere long-grens.
  const stopLimiet = useStopLossLimiet(trade?.symbool, richting);
  const ingevuldeEntry = parseFloat(form.entryPrijs.replace(',', '.'));
  const advies: StopAdvies = trade
    ? bepaalStop(ingevuldeEntry, trade.stopLoss, stopLimiet)
    : { soort: 'ok' };

  // Wat we tonen is ook wat we opslaan: tradeChecks.ts bewaakt later precies deze niveaus.
  const stop = advies.soort === 'aangepast' ? advies.stop : trade?.stopLoss ?? 0;
  const rr = trade ? herberekenRR(ingevuldeEntry, stop, trade.takeProfit, richting) : 0;

  function valideerEnOpslaan() {
    const bedrag = parseFloat(form.bedragUsd.replace(',', '.'));
    const prijs = parseFloat(form.entryPrijs.replace(',', '.'));
    const aantal = parseFloat(form.aantalCoins.replace(',', '.'));

    if (isNaN(bedrag) || bedrag <= 0) { setFout('Voer een geldig bedrag in (groter dan 0)'); return; }
    if (isNaN(prijs) || prijs <= 0) { setFout('Voer een geldige aankoopprijs in'); return; }
    if (isNaN(aantal) || aantal <= 0) { setFout('Aantal coins moet groter dan 0 zijn'); return; }
    if (!trade) return;
    // Een stop aan de verkeerde kant van de aankoopprijs zou meteen als "stop geraakt" in je
    // portfolio staan. Bij long hoort de stop eronder, bij short erboven: hetzelfde slot dat het
    // handmatige formulier op het Portfolio-scherm al heeft, nu richting-bewust.
    if (isShort ? stop <= prijs : stop >= prijs) {
      setFout(isShort
        ? 'Stop-loss moet hoger zijn dan de aankoopprijs, kijk je aankoopprijs na'
        : 'Stop-loss moet lager zijn dan de aankoopprijs, kijk je aankoopprijs na');
      return;
    }

    const coin = infoVoor(trade.symbool);
    const portfolioTrade: PortfolioTrade = {
      id: nieuweId(),
      symbool: trade.symbool,
      naam: coin.naam,
      entryPrijs: prijs,
      stopLoss: stop,
      takeProfit: trade.takeProfit,
      rr,
      datum: new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'open',
      bedragUsd: bedrag,
      aantalCoins: aantal,
      bron: 'handmatig',
      richting,
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
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={stijlen.vel}>
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
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                  {advies.soort === 'vast' ? 'STOP (KADER)' : 'STOP'}
                </Text>
                <Text style={[Type.prijs, { color: colors.verlies }]}>{fmtPrijs(stop, DOLLARS)}</Text>
              </View>
              <View style={stijlen.infoVeld}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>DOEL</Text>
                <Text style={[Type.prijs, { color: colors.winst }]}>{fmtPrijs(trade.takeProfit, DOLLARS)}</Text>
              </View>
              <View style={stijlen.infoVeld}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>R/R</Text>
                <Text style={[Type.prijs, { color: colors.tekstPrimair }]}>{rr > 0 ? fmtRR(rr) : '—'}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {advies.soort !== 'ok' ? (
          <View style={[stijlen.waarschuwing, { backgroundColor: colors.verhoogd, borderColor: colors.letOp }]}>
            <Text style={[Type.caption, { color: colors.letOp }]}>{advies.uitleg}</Text>
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
    </BottomSheet>
  );
}

const stijlen = StyleSheet.create({
  vel: {
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
  waarschuwing: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
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
