import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, FlatList, TextInput, ScrollView,
  StyleSheet, Alert, RefreshControl, LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Wallet, CheckCircle, XCircle, Clock, LayoutList, Rows3, ChevronDown, ChevronRight } from 'lucide-react-native';
import { fmtPrijs, fmtPct, fmtRR, fmtResultaatUsd } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { BottomSheet } from '../components/BottomSheet';
import { Disclaimer } from '../components/Disclaimer';
import { ScreenHeader } from '../components/ScreenHeader';
import { PortfolioStatusKaart } from '../components/PortfolioStatusKaart';
import { HistorieScherm } from '../components/HistorieScherm';
import { CompacteTradeRegel } from '../components/CompacteTradeRegel';
import { TradeActiesSheet } from '../components/TradeActiesSheet';
import { VerkoopOrderSheet } from '../components/VerkoopOrderSheet';
import { NiveausSheet } from '../components/NiveausSheet';
import { EtoroOmgeving } from '../engine/etoro';
import { omschrijfOnbekendeOrder } from '../state/lopendeOrders';
import { PortfolioTrade, bronVan, nieuweId } from '../state/portfolioTypes';
import { usePortfolio } from '../state/PortfolioProvider';
import { bepaalAdvies } from '../state/advies';
import { berekenPortfolioWaarde } from '../state/statistieken';
import { useWeergave, Weergave } from '../state/useWeergave';
import { CoinDetailScherm } from '../components/CoinDetailScherm';
import { CoinDetailData, vanPortfolioTrade } from '../engine/coinDetailData';
import { laadTekst, bewaarTekst, laadObject, bewaarObject, verwijderSleutel, SLEUTELS } from '../storage/opslag';
import { actieveSleutels } from '../state/etoroSleutels';
import { useValutaStand } from '../state/useValuta';

// ---------- TradeRegel ----------
// Kan deze rij bij eToro verkocht en gewijzigd worden? Alles moet kloppen: de trade komt uit eToro,
// we kennen zowel het positie- als het instrument-ID, en de positie hoort bij de omgeving waar de
// app nu in staat. Een positie-ID uit de ene omgeving naar het endpoint van de andere sturen is een
// slechte afloop, dus bij twijfel verschijnt de knop simpelweg niet. Oude opgeslagen trades missen
// deze velden en herstellen zichzelf bij de volgende sync.
export function isEtoroBestuurbaar(trade: PortfolioTrade, omgeving: EtoroOmgeving): boolean {
  return trade.bron === 'etoro'
    && trade.status === 'open'
    && typeof trade.etoroPositionID === 'number'
    && typeof trade.etoroInstrumentID === 'number'
    && (trade.etoroOmgeving ?? 'real') === omgeving;
}

function TradeRegel({ trade, livePrijs, onVraagSluiten, onVerwijder, onBewerk, onOpenDetail, onVerkoop, onNiveaus }: {
  trade: PortfolioTrade;
  livePrijs: number | undefined;
  onVraagSluiten: (trade: PortfolioTrade, status: 'gewonnen' | 'verloren') => void;
  onVerwijder: (id: string) => void;
  onBewerk: (trade: PortfolioTrade) => void;
  // Ontbreken als deze rij niet bij eToro te besturen is; dan blijft de rij zoals hij was.
  onVerkoop?: (trade: PortfolioTrade) => void;
  onNiveaus?: (trade: PortfolioTrade) => void;
  onOpenDetail: (trade: PortfolioTrade) => void;
}) {
  const { colors } = useTheme();

  const statusKleur = trade.status === 'gewonnen' ? colors.winst
    : trade.status === 'verloren' ? colors.verlies
    : colors.tekstGedimd;

  const StatusIcon = trade.status === 'gewonnen' ? CheckCircle
    : trade.status === 'verloren' ? XCircle
    : Clock;

  const statusLabel = trade.status === 'gewonnen' ? 'Gewonnen'
    : trade.status === 'verloren' ? 'Verloren'
    : 'Open';

  const advies = bepaalAdvies(trade.entryPrijs, trade.stopLoss, trade.takeProfit, livePrijs);

  const adviesKleur = advies.kleur === 'winst' ? colors.winst
    : advies.kleur === 'verlies' ? colors.verlies
    : advies.kleur === 'letOp' ? colors.letOp
    : colors.tekstGedimd;

  const heeftAantal = typeof trade.aantalCoins === 'number' && trade.aantalCoins > 0;
  const resultaatUsd = livePrijs !== undefined && heeftAantal
    ? (livePrijs - trade.entryPrijs) * trade.aantalCoins!
    : null;
  const resultaatPct = livePrijs !== undefined
    ? (livePrijs - trade.entryPrijs) / trade.entryPrijs * 100
    : null;
  const resultaatKleur = resultaatUsd !== null
    ? (resultaatUsd >= 0 ? colors.winst : colors.verlies)
    : colors.tekstGedimd;

  const behaaldPct = trade.exitPrijs !== undefined
    ? (trade.exitPrijs - trade.entryPrijs) / trade.entryPrijs * 100
    : null;
  // eToro's resultaatUsd is inclusief kosten en dus het echte resultaat. Alleen als we dat niet
  // hebben (handmatige trade) rekenen we het bruto koersverschil uit.
  const behaaldUsd = typeof trade.resultaatUsd === 'number'
    ? trade.resultaatUsd
    : trade.exitPrijs !== undefined && heeftAantal
      ? (trade.exitPrijs - trade.entryPrijs) * trade.aantalCoins!
      : null;
  // Kleuren op het bedrag, niet op het koersverschil. Een trade kan net boven entry sluiten en na
  // kosten toch verlies zijn; dan hoort er geen groene +0,4% naast een rode "verloren"-badge.
  const behaaldKleur = behaaldUsd !== null
    ? (behaaldUsd >= 0 ? colors.winst : colors.verlies)
    : behaaldPct !== null
      ? (behaaldPct >= 0 ? colors.winst : colors.verlies)
      : colors.tekstGedimd;

  const randKleur = trade.status === 'open' ? adviesKleur : statusKleur;

  return (
    <View style={[tradeStyles.kaart, shadow.kaart, { backgroundColor: colors.kaart, borderLeftColor: randKleur }]}>
      <Pressable
        onPress={() => onOpenDetail(trade)}
        accessibilityRole="button"
        accessibilityLabel={`${trade.symbool} detail bekijken`}
      >
      <View style={tradeStyles.kop}>
        <View style={tradeStyles.kopLinks}>
          <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{trade.symbool}</Text>
          {trade.naam ? (
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{trade.naam}</Text>
          ) : null}
        </View>
        <View style={tradeStyles.kopRechts}>
          <StatusIcon size={14} color={statusKleur} strokeWidth={1.75} />
          <Text style={[Type.caption, { color: statusKleur }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Adviesveld */}
      <View style={[tradeStyles.advies, { backgroundColor: colors.verhoogd }]}>
        <Text style={[Type.caption, { color: trade.status === 'open' ? adviesKleur : behaaldKleur, lineHeight: 18 }]}>
          {trade.status === 'open'
            ? advies.tekst
            : `Gesloten op ${fmtPrijs(trade.exitPrijs ?? trade.entryPrijs)}${behaaldPct !== null ? ` (${fmtPct(behaaldPct)})` : ''}.`}
        </Text>
      </View>

      {/* Niveaus */}
      <View style={tradeStyles.niveaus}>
        <View style={tradeStyles.niveau}>
          <Text style={[Type.overline, { color: colors.verlies }]}>STOP</Text>
          <Text style={[Type.prijs, { color: colors.verlies, fontSize: 13 }]}>{trade.stopLoss > 0 ? fmtPrijs(trade.stopLoss) : '—'}</Text>
        </View>
        <View style={tradeStyles.niveau}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>ENTRY</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>{fmtPrijs(trade.entryPrijs)}</Text>
        </View>
        <View style={tradeStyles.niveau}>
          <Text style={[Type.overline, { color: colors.winst }]}>DOEL</Text>
          <Text style={[Type.prijs, { color: colors.winst, fontSize: 13 }]}>{trade.takeProfit > 0 ? fmtPrijs(trade.takeProfit) : '—'}</Text>
        </View>
        <View style={tradeStyles.niveau}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>R/R</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>{trade.rr > 0 ? fmtRR(trade.rr) : '—'}</Text>
        </View>
      </View>

      {/* Live resultaat voor open trades (alleen tonen als we een live prijs hebben) */}
      {trade.status === 'open' && livePrijs !== undefined && (
        <View style={[tradeStyles.niveaus, { paddingTop: 0 }]}>
          <View style={tradeStyles.niveau}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>LIVE</Text>
            <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>{fmtPrijs(livePrijs)}</Text>
          </View>
          {resultaatPct !== null && (
            <View style={tradeStyles.niveau}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>RESULTAAT</Text>
              <Text style={[Type.prijs, { color: resultaatKleur, fontSize: 13 }]}>
                {fmtPct(resultaatPct)}
                {resultaatUsd !== null ? `  ${fmtResultaatUsd(resultaatUsd)}` : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Realized resultaat voor gesloten trades */}
      {trade.status !== 'open' && trade.exitPrijs !== undefined && (
        <View style={[tradeStyles.niveaus, { paddingTop: 0 }]}>
          <View style={tradeStyles.niveau}>
            <Text style={[Type.overline, { color: colors.tekstGedimd }]}>EXIT</Text>
            <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>{fmtPrijs(trade.exitPrijs)}</Text>
          </View>
          {behaaldPct !== null && (
            <View style={tradeStyles.niveau}>
              <Text style={[Type.overline, { color: colors.tekstGedimd }]}>BEHAALD</Text>
              <Text style={[Type.prijs, { color: behaaldKleur, fontSize: 13 }]}>
                {fmtPct(behaaldPct)}
                {behaaldUsd !== null ? `  ${fmtResultaatUsd(behaaldUsd)}` : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      {trade.notitie ? (
        <Text style={[Type.caption, tradeStyles.notitie, { color: colors.tekstGedimd }]}>
          {trade.notitie}
        </Text>
      ) : null}
      </Pressable>

      <View style={[tradeStyles.voet, { borderTopColor: colors.rand }]}>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{trade.datum}</Text>
        <View style={tradeStyles.voetActies}>
          {/* Bij een eToro-positie die Kader echt kan besturen vervangen Verkopen en SL/TP de
              handmatige knoppen: Gewonnen en Verloren zouden hier alleen de lokale administratie
              wijzigen terwijl de positie bij eToro gewoon open blijft staan, en dat is misleidend. */}
          {trade.status === 'open' && onVerkoop && onNiveaus && (
            <>
              <Pressable
                style={tradeStyles.voetKnop}
                onPress={() => onVerkoop(trade)}
                accessibilityRole="button"
                accessibilityLabel={`${trade.symbool} verkopen bij eToro`}
              >
                <Text style={[Type.caption, { color: colors.verlies }]}>Verkopen</Text>
              </Pressable>
              <Pressable
                style={tradeStyles.voetKnop}
                onPress={() => onNiveaus(trade)}
                accessibilityRole="button"
                accessibilityLabel="Stop-loss en doel aanpassen"
              >
                <Text style={[Type.caption, { color: colors.cta }]}>SL/TP</Text>
              </Pressable>
            </>
          )}

          {trade.status === 'open' && !(onVerkoop && onNiveaus) && (
            <>
              <Pressable
                style={tradeStyles.voetKnop}
                onPress={() => onVraagSluiten(trade, 'gewonnen')}
                accessibilityRole="button"
                accessibilityLabel="Gewonnen"
              >
                <Text style={[Type.caption, { color: colors.winst }]}>Gewonnen</Text>
              </Pressable>
              <Pressable
                style={tradeStyles.voetKnop}
                onPress={() => onVraagSluiten(trade, 'verloren')}
                accessibilityRole="button"
                accessibilityLabel="Verloren"
              >
                <Text style={[Type.caption, { color: colors.verlies }]}>Verloren</Text>
              </Pressable>
              <Pressable
                style={tradeStyles.voetKnop}
                onPress={() => onBewerk(trade)}
                accessibilityRole="button"
                accessibilityLabel="Trade aanpassen"
              >
                <Text style={[Type.caption, { color: colors.cta }]}>Aanpassen</Text>
              </Pressable>
            </>
          )}
          <Pressable
            style={tradeStyles.voetKnop}
            onPress={() => onVerwijder(trade.id)}
            accessibilityRole="button"
            accessibilityLabel="Trade verwijderen"
          >
            <Text style={[Type.caption, { color: colors.tekstGedimd }]}>Verwijder</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const tradeStyles = StyleSheet.create({
  kaart: {
    borderRadius: radii.kaart,
    borderLeftWidth: 4,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  kop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    paddingBottom: spacing.sm,
  },
  kopLinks: { gap: 2 },
  kopRechts: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  advies: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: radii.veld,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  niveaus: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    gap: spacing.base,
    flexWrap: 'wrap',
  },
  niveau: { gap: 2 },
  notitie: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    fontStyle: 'italic',
  },
  voet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.base,
    minHeight: 44,
  },
  voetActies: { flexDirection: 'row', gap: spacing.base },
  voetKnop: { paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
});

// ---------- Formulier (handmatig toevoegen vanuit Portfolio) ----------
interface VormData {
  symbool: string;
  naam: string;
  entryPrijs: string;
  stopLoss: string;
  takeProfit: string;
  bedragUsd: string;
  aantalCoins: string;
  notitie: string;
}

const leegForm: VormData = {
  symbool: '', naam: '', entryPrijs: '', stopLoss: '', takeProfit: '', bedragUsd: '', aantalCoins: '', notitie: '',
};

function formVanTrade(trade: PortfolioTrade): VormData {
  return {
    symbool: trade.symbool,
    naam: trade.naam,
    entryPrijs: trade.entryPrijs.toString(),
    stopLoss: trade.stopLoss.toString(),
    takeProfit: trade.takeProfit.toString(),
    bedragUsd: trade.bedragUsd?.toString() ?? '',
    aantalCoins: trade.aantalCoins?.toString() ?? '',
    notitie: trade.notitie ?? '',
  };
}

function TradeFormulier({ zichtbaar, bestaand, onSluiten, onOpslaan }: {
  zichtbaar: boolean;
  bestaand?: PortfolioTrade | null;
  onSluiten: () => void;
  onOpslaan: (trade: PortfolioTrade) => void;
}) {
  const { colors } = useTheme();
  const [form, setForm] = useState<VormData>(leegForm);
  const [fout, setFout] = useState('');

  // Bij een nieuwe trade eerst een eventueel bewaard concept proberen: als je tussendoor naar
  // eToro schakelde om de prijs te checken en terugkomt, staan je ingevulde waarden er nog.
  useEffect(() => {
    if (!zichtbaar) return;
    setFout('');
    if (bestaand) {
      setForm(formVanTrade(bestaand));
      return;
    }
    let actief = true;
    laadObject<VormData>(SLEUTELS.tradeConcept).then(concept => {
      if (actief) setForm(concept ?? leegForm);
    });
    return () => { actief = false; };
  }, [zichtbaar, bestaand]);

  // Concept wegschrijven terwijl het formulier open staat, alleen voor een nieuwe trade: bewerken
  // van een bestaande trade vult zich uit die trade zelf, daar hoeft geen concept voor bewaard.
  useEffect(() => {
    if (!zichtbaar || bestaand) return;
    bewaarObject(SLEUTELS.tradeConcept, form);
  }, [form, zichtbaar, bestaand]);

  useEffect(() => {
    const bedrag = parseFloat(form.bedragUsd.replace(',', '.'));
    const prijs = parseFloat(form.entryPrijs.replace(',', '.'));
    if (bedrag > 0 && prijs > 0) {
      setForm(prev => ({ ...prev, aantalCoins: (bedrag / prijs).toFixed(6) }));
    }
  }, [form.bedragUsd, form.entryPrijs]);

  function reset() {
    setForm(leegForm);
    setFout('');
    if (!bestaand) verwijderSleutel(SLEUTELS.tradeConcept);
  }

  function valideerEnOpslaan() {
    const sym = form.symbool.trim().toUpperCase();
    const entry = parseFloat(form.entryPrijs.replace(',', '.'));
    const stop = parseFloat(form.stopLoss.replace(',', '.'));
    const tp = parseFloat(form.takeProfit.replace(',', '.'));
    const bedrag = parseFloat(form.bedragUsd.replace(',', '.'));
    const aantal = parseFloat(form.aantalCoins.replace(',', '.'));

    if (!sym) { setFout('Voer een symbool in (bijv. BTC)'); return; }
    if (isNaN(entry) || entry <= 0) { setFout('Voer een geldige entryprijs in'); return; }
    if (isNaN(stop) || stop >= entry) { setFout('Stop-loss moet lager zijn dan de entryprijs'); return; }
    if (isNaN(tp) || tp <= entry) { setFout('Take-profit moet hoger zijn dan de entryprijs'); return; }

    const rr = Math.round(((tp - entry) / (entry - stop)) * 10) / 10;
    onOpslaan({
      id: bestaand ? bestaand.id : nieuweId(),
      symbool: sym,
      naam: form.naam.trim(),
      entryPrijs: entry,
      stopLoss: stop,
      takeProfit: tp,
      rr,
      datum: bestaand ? bestaand.datum : new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: bestaand ? bestaand.status : 'open',
      notitie: form.notitie.trim() || undefined,
      bedragUsd: !isNaN(bedrag) && bedrag > 0 ? bedrag : undefined,
      aantalCoins: !isNaN(aantal) && aantal > 0 ? aantal : undefined,
      bron: bestaand ? bestaand.bron : 'handmatig',
    });
    reset();
  }

  const inputStyle = [formStyles.input, {
    backgroundColor: colors.verhoogd,
    borderColor: colors.rand,
    color: colors.tekstPrimair,
  }];

  return (
    <BottomSheet zichtbaar={zichtbaar} onSluiten={() => { reset(); onSluiten(); }} velStijl={formStyles.vel}>
      <View style={formStyles.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>{bestaand ? 'Trade aanpassen' : 'Trade bijhouden'}</Text>
        <Pressable
          onPress={() => { reset(); onSluiten(); }}
          accessibilityLabel="Sluiten"
          accessibilityRole="button"
          style={formStyles.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[Type.overline, formStyles.label, { color: colors.tekstGedimd }]}>SYMBOOL *</Text>
        <TextInput
          style={inputStyle}
          value={form.symbool}
          onChangeText={v => setForm(f => ({ ...f, symbool: v }))}
          placeholder="bijv. BTC"
          placeholderTextColor={colors.tekstGedimd}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <Text style={[Type.overline, formStyles.label, { color: colors.tekstGedimd }]}>NAAM (optioneel)</Text>
        <TextInput
          style={inputStyle}
          value={form.naam}
          onChangeText={v => setForm(f => ({ ...f, naam: v }))}
          placeholder="bijv. Bitcoin"
          placeholderTextColor={colors.tekstGedimd}
        />

        <Text style={[Type.overline, formStyles.label, { color: colors.tekstGedimd }]}>ENTRYPRIJS *</Text>
        <TextInput
          style={inputStyle}
          value={form.entryPrijs}
          onChangeText={v => setForm(f => ({ ...f, entryPrijs: v }))}
          placeholder="bijv. 45000"
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
        />

        <Text style={[Type.overline, formStyles.label, { color: colors.tekstGedimd }]}>STOP-LOSS *</Text>
        <TextInput
          style={inputStyle}
          value={form.stopLoss}
          onChangeText={v => setForm(f => ({ ...f, stopLoss: v }))}
          placeholder="bijv. 40000"
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
        />

        <Text style={[Type.overline, formStyles.label, { color: colors.tekstGedimd }]}>TAKE-PROFIT *</Text>
        <TextInput
          style={inputStyle}
          value={form.takeProfit}
          onChangeText={v => setForm(f => ({ ...f, takeProfit: v }))}
          placeholder="bijv. 58000"
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
        />

        <Text style={[Type.overline, formStyles.label, { color: colors.tekstGedimd }]}>BEDRAG IN $ (optioneel)</Text>
        <TextInput
          style={inputStyle}
          value={form.bedragUsd}
          onChangeText={v => setForm(f => ({ ...f, bedragUsd: v }))}
          placeholder="bijv. 500"
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
        />

        <Text style={[Type.overline, formStyles.label, { color: colors.tekstGedimd }]}>AANTAL COINS (optioneel)</Text>
        <TextInput
          style={inputStyle}
          value={form.aantalCoins}
          onChangeText={v => setForm(f => ({ ...f, aantalCoins: v }))}
          placeholder="auto-berekend"
          placeholderTextColor={colors.tekstGedimd}
          keyboardType="decimal-pad"
        />

        <Text style={[Type.overline, formStyles.label, { color: colors.tekstGedimd }]}>NOTITIE (optioneel)</Text>
        <TextInput
          style={[inputStyle, formStyles.multilineInput]}
          value={form.notitie}
          onChangeText={v => setForm(f => ({ ...f, notitie: v }))}
          placeholder="bijv. breakout boven weerstand"
          placeholderTextColor={colors.tekstGedimd}
          multiline
          numberOfLines={2}
        />

        {fout ? (
          <Text style={[Type.caption, { color: colors.verlies, marginTop: spacing.sm }]}>{fout}</Text>
        ) : null}

        <Pressable
          style={[formStyles.opslaanKnop, { backgroundColor: colors.cta }]}
          onPress={valideerEnOpslaan}
          accessibilityRole="button"
        >
          <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>
            {bestaand ? 'Wijzigingen opslaan' : 'Trade toevoegen'}
          </Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

// ---------- Sluit-modaal: vraagt tegen welke prijs is verkocht ----------
function SluitTradeModal({ verzoek, onSluiten, onBevestig }: {
  verzoek: { trade: PortfolioTrade; status: 'gewonnen' | 'verloren' } | null;
  onSluiten: () => void;
  onBevestig: (prijs: number) => void;
}) {
  const { colors } = useTheme();
  const [prijs, setPrijs] = useState('');
  const [fout, setFout] = useState('');

  // Voorvullen met de planprijs: TP bij gewonnen, SL bij verloren.
  const planPrijs = verzoek
    ? (verzoek.status === 'gewonnen' ? verzoek.trade.takeProfit : verzoek.trade.stopLoss)
    : 0;

  useEffect(() => {
    if (verzoek) {
      setPrijs(planPrijs.toString());
      setFout('');
    }
  }, [verzoek, planPrijs]);

  function bevestig() {
    const p = parseFloat(prijs.replace(',', '.'));
    if (isNaN(p) || p <= 0) { setFout('Voer een geldige verkoopprijs in'); return; }
    onBevestig(p);
  }

  const winst = verzoek?.status === 'gewonnen';
  const inputStyle = [formStyles.input, {
    backgroundColor: colors.verhoogd,
    borderColor: colors.rand,
    color: colors.tekstPrimair,
  }];

  return (
    <BottomSheet zichtbaar={verzoek !== null} onSluiten={onSluiten} velStijl={formStyles.vel}>
      <View style={formStyles.titelRij}>
        <Text style={[Type.titel, { color: colors.tekstPrimair }]}>
          {verzoek?.trade.symbool} sluiten als {winst ? 'gewonnen' : 'verloren'}
        </Text>
        <Pressable
          onPress={onSluiten}
          accessibilityLabel="Sluiten"
          accessibilityRole="button"
          style={formStyles.sluitKnop}
        >
          <X size={20} color={colors.tekstGedimd} strokeWidth={1.75} />
        </Pressable>
      </View>

      <Text style={[Type.body, { color: colors.tekstGedimd, lineHeight: 22 }]}>
        De prijs is voorgevuld met je {winst ? 'take-profit' : 'stop-loss'}. Volgde de trade het plan?
        Bevestig dan direct. Verkocht je op een andere prijs? Pas hem aan.
      </Text>

      <Text style={[Type.overline, formStyles.label, { color: colors.tekstGedimd }]}>VERKOOPPRIJS *</Text>
      <TextInput
        style={inputStyle}
        value={prijs}
        onChangeText={v => setPrijs(v)}
        placeholder="bijv. 58000"
        placeholderTextColor={colors.tekstGedimd}
        keyboardType="decimal-pad"
        autoFocus
      />

      {fout ? (
        <Text style={[Type.caption, { color: colors.verlies, marginTop: spacing.sm }]}>{fout}</Text>
      ) : null}

      <Pressable
        style={[formStyles.opslaanKnop, { backgroundColor: winst ? colors.winst : colors.verlies }]}
        onPress={bevestig}
        accessibilityRole="button"
      >
        <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Trade sluiten</Text>
      </Pressable>
    </BottomSheet>
  );
}

const formStyles = StyleSheet.create({
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
  label: { marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radii.veld,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    minHeight: 44,
  },
  multilineInput: {
    minHeight: 72,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  opslaanKnop: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.knop,
    alignItems: 'center',
    minHeight: 44,
  },
});

// ---------- Weergaveschakelaar (uitgebreid/compact) ----------
function WeergaveSchakelaar({ actief, onWijzig }: {
  actief: Weergave;
  onWijzig: (weergave: Weergave) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[weergaveStyles.wrapper, { backgroundColor: colors.verhoogd }]}>
      <Pressable
        style={[weergaveStyles.knop, actief === 'uitgebreid' && { backgroundColor: colors.kaart }]}
        onPress={() => onWijzig('uitgebreid')}
        accessibilityRole="button"
        accessibilityLabel="Uitgebreide weergave"
        hitSlop={4}
      >
        <LayoutList size={17} color={actief === 'uitgebreid' ? colors.tekstPrimair : colors.tekstGedimd} strokeWidth={1.75} />
      </Pressable>
      <Pressable
        style={[weergaveStyles.knop, actief === 'compact' && { backgroundColor: colors.kaart }]}
        onPress={() => onWijzig('compact')}
        accessibilityRole="button"
        accessibilityLabel="Compacte weergave"
        hitSlop={4}
      >
        <Rows3 size={17} color={actief === 'compact' ? colors.tekstPrimair : colors.tekstGedimd} strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}

const weergaveStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    borderRadius: radii.knop,
    padding: 2,
    gap: 2,
  },
  knop: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.knop - 2,
  },
});

// ---------- Bron-groepskop (alleen zichtbaar als er meer dan één bron is) ----------
const BRON_LABEL: Record<'etoro' | 'handmatig', string> = {
  etoro: 'eToro',
  handmatig: 'Handmatig',
};

function BronKop({ bron, aantal, dicht, onWissel }: {
  bron: 'etoro' | 'handmatig';
  aantal: number;
  dicht: boolean;
  onWissel: () => void;
}) {
  const { colors } = useTheme();
  const label = BRON_LABEL[bron];
  return (
    <Pressable
      style={[bronKopStyles.balk, { backgroundColor: colors.verhoogd, borderColor: colors.rand }]}
      onPress={onWissel}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${aantal} ${aantal === 1 ? 'trade' : 'trades'}, ${dicht ? 'ingeklapt' : 'uitgeklapt'}`}
    >
      <Text style={[Type.overline, { color: colors.tekstPrimair }]}>{label}</Text>
      <View style={bronKopStyles.rechts}>
        <Text style={[Type.caption, { color: colors.tekstGedimd }]}>{aantal}</Text>
        {dicht
          ? <ChevronRight size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
          : <ChevronDown size={18} color={colors.tekstGedimd} strokeWidth={1.75} />}
      </View>
    </Pressable>
  );
}

const bronKopStyles = StyleSheet.create({
  balk: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: radii.kaart,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.base,
    minHeight: 44,
  },
  rechts: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});

type TradeLijstItem =
  | { soort: 'kop'; bron: 'etoro' | 'handmatig'; aantal: number }
  | { soort: 'trade'; trade: PortfolioTrade };

// ---------- Scherm ----------
export function PortfolioScreen() {
  // De formatters lezen de gekozen valuta uit een gewone module, dus zonder dit abonnement
  // blijft dit scherm na het omzetten in de oude valuta staan.
  useValutaStand();

  const { colors } = useTheme();
  const {
    trades, livePrijzen, voegTradeToe, wijzigTrade, sluitTrade, verwijderTrade,
    syncing, laatsteSync, syncFout, etoroFout, synchroniseer,
    omgeving, magHandelen, verlopenOrders, controleerOnbekendeOrders,
  } = usePortfolio();
  const [verkoopTrade, setVerkoopTrade] = useState<PortfolioTrade | null>(null);
  const [niveausTrade, setNiveausTrade] = useState<PortfolioTrade | null>(null);
  const [controleBezig, setControleBezig] = useState(false);
  const [formulierZichtbaar, setFormulierZichtbaar] = useState(false);
  const [bewerkTrade, setBewerkTrade] = useState<PortfolioTrade | null>(null);
  const [sluitVerzoek, setSluitVerzoek] = useState<{ trade: PortfolioTrade; status: 'gewonnen' | 'verloren' } | null>(null);
  const [detailCoin, setDetailCoin] = useState<CoinDetailData | null>(null);
  const [etoroBezig, setEtoroBezig] = useState(false);
  const [ververst, setVerverst] = useState(false);
  const [historieOpen, setHistorieOpen] = useState(false);
  const [actiesVoor, setActiesVoor] = useState<PortfolioTrade | null>(null);
  const { weergave, setWeergave } = useWeergave();
  const reduceMotion = useReduceMotion();

  // Welke bron-groepen zijn dichtgeklapt, bewaard tussen app-starts. Standaard staan ze allebei open.
  const [dichteBronnen, setDichteBronnen] = useState<Set<'etoro' | 'handmatig'>>(new Set());
  useEffect(() => {
    laadTekst(SLEUTELS.portfolioBronDicht, '').then(tekst => {
      if (!tekst) return;
      setDichteBronnen(new Set(tekst.split(',').filter(Boolean) as ('etoro' | 'handmatig')[]));
    });
  }, []);

  function wisselBron(bron: 'etoro' | 'handmatig') {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDichteBronnen(vorige => {
      const volgende = new Set(vorige);
      if (volgende.has(bron)) volgende.delete(bron); else volgende.add(bron);
      bewaarTekst(SLEUTELS.portfolioBronDicht, Array.from(volgende).join(','));
      return volgende;
    });
  }

  // Swipe omlaag en de verversknop: stil synchroniseren. Geen meldingen, ook niet als er geen
  // koppeling is; een mislukte eToro-sync komt via etoroFout terug in de statuskaart.
  // De vroege return voorkomt dat je met een paar tikken meerdere volledige syncs tegelijk afvuurt.
  async function swipeSync() {
    if (ververst) return;
    setVerverst(true);
    try {
      await synchroniseer();
    } finally {
      setVerverst(false);
    }
  }

  // Knop: expliciete actie, dus wel terugkoppeling over wat er gebeurd is.
  async function importerenUitEtoro() {
    if (!(await actieveSleutels())) {
      Alert.alert(
        'Nog geen eToro-koppeling',
        'Stel je API-sleutel in via Instellingen (het tandwiel rechtsboven) voordat je kunt importeren.',
      );
      return;
    }
    setEtoroBezig(true);
    try {
      const uitkomst = await synchroniseer();
      if (uitkomst.fout) {
        Alert.alert('Import mislukt', uitkomst.fout);
        return;
      }
      const delen = [`${uitkomst.toegevoegd} nieuw`];
      if (uitkomst.bijgewerkt > 0) delen.push(`${uitkomst.bijgewerkt} bijgewerkt`);
      if (uitkomst.gesloten > 0) delen.push(`${uitkomst.gesloten} automatisch gesloten`);
      if (uitkomst.uitHistorie > 0) delen.push(`${uitkomst.uitHistorie} uit je eToro-historie`);
      if (uitkomst.overgeslagen.length > 0) delen.push(`${uitkomst.overgeslagen.length} overgeslagen`);
      let bericht = delen.join(', ') + '.';
      if (uitkomst.overgeslagen.length > 0) {
        const regels = uitkomst.overgeslagen.map(
          o => `- ${o.naam} (${o.reden === 'short' ? 'short, nog niet ondersteund' : 'geen crypto'})`,
        );
        bericht += '\n\nOvergeslagen:\n' + regels.join('\n');
      }
      Alert.alert('Import voltooid', bericht);
    } finally {
      setEtoroBezig(false);
    }
  }

  const openTrades = trades.filter(t => t.status === 'open');
  const afgeslotenCount = trades.length - openTrades.length;
  const waarde = berekenPortfolioWaarde(trades, livePrijzen);

  // Groeperen per bron, eToro eerst, dan handmatig. Bij maar één bron geen groepsbalken: een
  // enkele balk boven al je trades is ruis voor iedereen zonder eToro-koppeling.
  const lijstData = useMemo<TradeLijstItem[]>(() => {
    const etoroTrades = openTrades.filter(t => bronVan(t) === 'etoro');
    const handmatigeTrades = openTrades.filter(t => bronVan(t) === 'handmatig');
    if (etoroTrades.length === 0 || handmatigeTrades.length === 0) {
      return openTrades.map(trade => ({ soort: 'trade', trade } as const));
    }
    const items: TradeLijstItem[] = [];
    for (const [bron, groep] of [['etoro', etoroTrades], ['handmatig', handmatigeTrades]] as const) {
      items.push({ soort: 'kop', bron, aantal: groep.length });
      if (!dichteBronnen.has(bron)) {
        for (const trade of groep) items.push({ soort: 'trade', trade });
      }
    }
    return items;
  }, [openTrades, dichteBronnen]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[portfolioStyles.root, { backgroundColor: colors.achtergrond }]}>
      <ScreenHeader
        titel="Mijn trades"
        rechts={
          <Pressable
            style={[portfolioStyles.toevoegenKnop, { backgroundColor: colors.cta }]}
            onPress={() => setFormulierZichtbaar(true)}
            accessibilityRole="button"
            accessibilityLabel="Trade toevoegen"
          >
            <Plus size={16} color="white" strokeWidth={2} />
            <Text style={[Type.caption, { color: 'white', fontWeight: '600' }]}>Voeg toe</Text>
          </Pressable>
        }
      />

      <FlatList
        data={lijstData}
        keyExtractor={item => item.soort === 'kop' ? `kop-${item.bron}` : item.trade.id}
        renderItem={({ item }) => {
          if (item.soort === 'kop') {
            return (
              <BronKop
                bron={item.bron}
                aantal={item.aantal}
                dicht={dichteBronnen.has(item.bron)}
                onWissel={() => wisselBron(item.bron)}
              />
            );
          }
          const trade = item.trade;
          return weergave === 'compact' ? (
            <CompacteTradeRegel
              trade={trade}
              livePrijs={livePrijzen[trade.symbool]}
              onOpenDetail={t => setDetailCoin(vanPortfolioTrade(t, livePrijzen[t.symbool]))}
              onOpenActies={setActiesVoor}
            />
          ) : (
            <TradeRegel
              trade={trade}
              livePrijs={livePrijzen[trade.symbool]}
              onVraagSluiten={(t, status) => setSluitVerzoek({ trade: t, status })}
              onVerwijder={verwijderTrade}
              onBewerk={setBewerkTrade}
              onVerkoop={magHandelen && isEtoroBestuurbaar(trade, omgeving) ? setVerkoopTrade : undefined}
              onNiveaus={magHandelen && isEtoroBestuurbaar(trade, omgeving) ? setNiveausTrade : undefined}
              onOpenDetail={t => setDetailCoin(vanPortfolioTrade(t, livePrijzen[t.symbool]))}
            />
          );
        }}
        contentContainerStyle={portfolioStyles.lijst}
        refreshControl={
          <RefreshControl
            refreshing={ververst}
            onRefresh={swipeSync}
            tintColor={colors.cta}
            colors={[colors.cta]}
          />
        }
        ListHeaderComponent={
          <>
            <PortfolioStatusKaart
              waarde={waarde}
              // Ook tijdens een swipe- of knop-sync bezig tonen: verversPrijzen zet `syncing` alleen
              // als er open posities zijn, dus met een lege portfolio bleef de knop anders indrukbaar.
              syncing={syncing || ververst}
              laatsteSync={laatsteSync}
              syncFout={syncFout}
              etoroFout={etoroFout}
              etoroBezig={etoroBezig}
              afgesloten={afgeslotenCount}
              onVerversen={swipeSync}
              onImporteren={importerenUitEtoro}
              onOpenHistorie={() => setHistorieOpen(true)}
            />

            {/* Orders waarvan we na een kwartier nog steeds niet weten of ze zijn doorgegaan. Er
                staat bewust maar één knop: opnieuw controleren. Nergens iets dat opnieuw verstuurt,
                want dan koop je mogelijk twee keer. */}
            {verlopenOrders.length > 0 && (
              <View style={[portfolioStyles.onbevestigd, { backgroundColor: colors.letOp + '1A', borderColor: colors.letOp }]}>
                {verlopenOrders.map(order => (
                  <Text key={order.verzoekId} style={[Type.caption, { color: colors.tekstPrimair, lineHeight: 18 }]}>
                    {omschrijfOnbekendeOrder(order)}
                  </Text>
                ))}
                <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
                  Kader heeft geen bevestiging van eToro gekregen. Controleer je posities bij eToro voordat je opnieuw koopt.
                </Text>
                <Pressable
                  onPress={async () => {
                    if (controleBezig) return;
                    setControleBezig(true);
                    try { await controleerOnbekendeOrders(); } finally { setControleBezig(false); }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Opnieuw controleren bij eToro"
                  style={[portfolioStyles.onbevestigdKnop, { borderColor: colors.letOp }]}
                >
                  <Text style={[Type.caption, { color: colors.letOp, fontWeight: '600' }]}>
                    {controleBezig ? 'Bezig met controleren' : 'Opnieuw controleren'}
                  </Text>
                </Pressable>
              </View>
            )}
            {openTrades.length > 0 && (
              <View style={portfolioStyles.weergaveRij}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                  {openTrades.length} {openTrades.length === 1 ? 'OPEN TRADE' : 'OPEN TRADES'}
                </Text>
                <WeergaveSchakelaar actief={weergave} onWijzig={setWeergave} />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={portfolioStyles.leeg}>
            <Wallet size={40} color={colors.tekstGedimd} strokeWidth={1.5} />
            <Text style={[Type.titel, { color: colors.tekstPrimair, textAlign: 'center', marginTop: spacing.base }]}>
              Geen open trades
            </Text>
            <Text style={[Type.body, { color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.sm, lineHeight: 24 }]}>
              Voeg een trade toe vanuit het Markt-scherm of via de knop rechtsboven{afgeslotenCount > 0 ? ', of bekijk je afgesloten trades in de historie' : ''}.
            </Text>
            <Pressable
              style={[portfolioStyles.leegKnop, { backgroundColor: colors.cta }]}
              onPress={() => setFormulierZichtbaar(true)}
              accessibilityRole="button"
            >
              <Plus size={16} color="white" strokeWidth={2} />
              <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Trade toevoegen</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={<Disclaimer metRand={openTrades.length > 0} />}
      />

      <TradeFormulier
        zichtbaar={formulierZichtbaar || bewerkTrade !== null}
        bestaand={bewerkTrade}
        onSluiten={() => { setFormulierZichtbaar(false); setBewerkTrade(null); }}
        onOpslaan={(trade) => {
          if (bewerkTrade) wijzigTrade(trade); else voegTradeToe(trade);
          setFormulierZichtbaar(false);
          setBewerkTrade(null);
        }}
      />

      <SluitTradeModal
        verzoek={sluitVerzoek}
        onSluiten={() => setSluitVerzoek(null)}
        onBevestig={(prijs) => {
          if (sluitVerzoek) sluitTrade(sluitVerzoek.trade.id, sluitVerzoek.status, prijs);
          setSluitVerzoek(null);
        }}
      />

      {verkoopTrade && (
        <VerkoopOrderSheet
          zichtbaar
          trade={verkoopTrade}
          huidigePrijs={livePrijzen[verkoopTrade.symbool]}
          onSluiten={() => setVerkoopTrade(null)}
        />
      )}

      {niveausTrade && (
        <NiveausSheet
          zichtbaar
          trade={niveausTrade}
          onSluiten={() => setNiveausTrade(null)}
        />
      )}

      <CoinDetailScherm data={detailCoin} onSluiten={() => setDetailCoin(null)} />

      <TradeActiesSheet
        trade={actiesVoor}
        onSluiten={() => setActiesVoor(null)}
        onGewonnen={t => setSluitVerzoek({ trade: t, status: 'gewonnen' })}
        onVerloren={t => setSluitVerzoek({ trade: t, status: 'verloren' })}
        onAanpassen={setBewerkTrade}
        onVerwijderen={t => verwijderTrade(t.id)}
        onVerkoop={actiesVoor && magHandelen && isEtoroBestuurbaar(actiesVoor, omgeving) ? setVerkoopTrade : undefined}
        onNiveaus={actiesVoor && magHandelen && isEtoroBestuurbaar(actiesVoor, omgeving) ? setNiveausTrade : undefined}
      />

      <HistorieScherm
        zichtbaar={historieOpen}
        trades={trades}
        onSluiten={() => setHistorieOpen(false)}
        onOpenDetail={t => setDetailCoin(vanPortfolioTrade(t, livePrijzen[t.symbool]))}
        onVerwijder={verwijderTrade}
      />
    </SafeAreaView>
  );
}

const portfolioStyles = StyleSheet.create({
  root: { flex: 1 },
  onbevestigd: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.veld,
    borderWidth: 1,
    gap: spacing.sm,
  },
  onbevestigdKnop: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: radii.knop,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  toevoegenKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.knop,
    minHeight: 36,
  },
  leeg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  leegKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.knop,
    minHeight: 44,
    marginTop: spacing.lg,
  },
  lijst: { paddingTop: spacing.md, paddingBottom: spacing.md },
  weergaveRij: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
});
