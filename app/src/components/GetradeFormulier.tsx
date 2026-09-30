import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Trade } from '../engine/types';
import { infoVoor } from '../engine/coinInfo';
import { bepaalStop, StopAdvies } from '../engine/etoroLimieten';
import { planInGeld } from '../engine/planInGeld';
import { usePortfolio } from '../state/PortfolioProvider';
import { useStopLossLimiet } from '../state/useStopLossLimiet';
import { nieuweId, PortfolioTrade, Richting } from '../state/portfolioTypes';
import { useTheme } from '../theme/ThemeProvider';
import { Fonts, Type } from '../theme/typography';
import { radii, spacing } from '../theme/tokens';
import { BottomSheet } from './BottomSheet';
import { PilKnop } from './PilKnop';
import { BedragInvoer } from './order/BedragInvoer';
import { OrderKop } from './order/OrderKop';
import { PlanInGeldKaart } from './order/PlanInGeld';
import { SnelKnoppen } from './order/SnelKnoppen';

// De prijzen en bedragen die je hier intikt bewaart Kader als dollars (zo komt de marktdata binnen),
// dus dit formulier blijft in dollars, ook als de app op euro's staat.
const SNEL_BEDRAGEN = [100, 250, 500, 1000].map(v => ({
  id: String(v),
  label: `$${v.toLocaleString('en-US')}`,
  waarde: v,
}));

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
      openTijd: Date.now(),
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

  const coin = trade ? infoVoor(trade.symbool) : null;

  // Wat je intikt voor het plan in geld. Zonder geldig bedrag of aankoopprijs geeft planInGeld null
  // en tonen de tegels "geen" in plaats van een verzonnen getal.
  const bedragGetal = parseFloat(form.bedragUsd.replace(',', '.'));
  const plan = trade
    ? planInGeld({ bedrag: bedragGetal, entry: ingevuldeEntry, stop, doel: trade.takeProfit, richting })
    : null;

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={onSluiten} velStijl={stijlen.vel}>
      <View style={stijlen.kop}>
        <OrderKop
          symbool={trade?.symbool ?? ''}
          titel="Trade vastleggen"
          sub={`${coin?.naam ?? trade?.symbool ?? ''} · zonder eToro-order`}
          onSluiten={onSluiten}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={stijlen.inhoud}
      >
        <BedragInvoer
          label="INGELEGD"
          waarde={form.bedragUsd}
          onWijzig={v => setForm(prev => ({ ...prev, bedragUsd: v }))}
          accessibilityLabel="Ingelegd bedrag in dollars"
        />

        <SnelKnoppen
          opties={SNEL_BEDRAGEN}
          actief={bedragGetal > 0 ? bedragGetal : undefined}
          onKies={waarde => setForm(prev => ({ ...prev, bedragUsd: String(waarde) }))}
          accessibilityLabel="Snelle bedragen"
        />

        <View style={[stijlen.lijst, { backgroundColor: colors.verhoogd }]}>
          <View style={stijlen.lijstRij}>
            <Text style={[stijlen.lijstLabel, { color: colors.tekstGedimd }]}>Aankoopprijs</Text>
            <TextInput
              style={[stijlen.lijstInvoer, { color: colors.cta }]}
              value={form.entryPrijs}
              onChangeText={v => setForm(prev => ({ ...prev, entryPrijs: v }))}
              placeholder="bijv. 45000"
              placeholderTextColor={colors.tekstGedimd}
              keyboardType="decimal-pad"
              accessibilityLabel="Aankoopprijs in dollars"
              maxFontSizeMultiplier={1.3}
            />
          </View>
          <View style={[stijlen.lijstRij, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rand }]}>
            <Text style={[stijlen.lijstLabel, { color: colors.tekstGedimd }]}>Aantal coins</Text>
            <TextInput
              style={[stijlen.lijstInvoer, { color: colors.cta }]}
              value={form.aantalCoins}
              onChangeText={v => setForm(prev => ({ ...prev, aantalCoins: v }))}
              placeholder="auto-berekend"
              placeholderTextColor={colors.tekstGedimd}
              keyboardType="decimal-pad"
              accessibilityLabel="Aantal coins"
              maxFontSizeMultiplier={1.3}
            />
            <Text style={[stijlen.autoTag, { color: colors.tekstGedimd }]}>auto</Text>
          </View>
        </View>

        {trade && ingevuldeEntry > 0 ? (
          <PlanInGeldKaart
            entry={ingevuldeEntry}
            stop={stop}
            doel={trade.takeProfit}
            bijStop={plan?.bijStop ?? null}
            bijDoel={plan?.bijDoel ?? null}
            rr={plan?.rr ?? null}
            stopAangepast={advies.soort === 'aangepast'}
          />
        ) : null}

        {advies.soort !== 'ok' ? (
          <View style={[stijlen.waarschuwing, { backgroundColor: colors.verhoogd, borderColor: colors.letOp }]}>
            <Text style={[Type.caption, { color: colors.letOp }]}>{advies.uitleg}</Text>
          </View>
        ) : null}

        {fout ? (
          <Text style={[Type.caption, { color: colors.verlies }]}>{fout}</Text>
        ) : null}

        <PilKnop label="Trade opslaan" variant="cta" onPress={valideerEnOpslaan} />
      </ScrollView>
    </BottomSheet>
  );
}

const stijlen = StyleSheet.create({
  vel: {
    maxHeight: '90%',
  },
  kop: { marginBottom: spacing.base },
  inhoud: { gap: 14 },
  lijst: { borderRadius: 16, paddingHorizontal: 14 },
  lijstRij: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 12,
  },
  lijstLabel: { fontFamily: Fonts.sansMedium, fontWeight: '500', fontSize: 13.5, lineHeight: 18, flexShrink: 1 },
  lijstInvoer: {
    flex: 1,
    minWidth: 90,
    minHeight: 44,
    padding: 0,
    textAlign: 'right',
    fontFamily: Fonts.monoRegular,
    fontSize: 14.5,
    fontVariant: ['tabular-nums'],
  },
  autoTag: { flexShrink: 0, fontFamily: Fonts.sansMedium, fontWeight: '500', fontSize: 11, marginLeft: -6 },
  waarschuwing: {
    borderWidth: 1,
    borderRadius: radii.veld,
    padding: spacing.md,
  },
});
