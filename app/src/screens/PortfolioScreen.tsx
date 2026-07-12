import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, FlatList, TextInput, ScrollView,
  StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Wallet, CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { fmtPrijs, fmtPct, fmtRR, fmtResultaatUsd } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { BottomSheet } from '../components/BottomSheet';
import { Disclaimer } from '../components/Disclaimer';
import { ScreenHeader } from '../components/ScreenHeader';
import { PortfolioStatusKaart } from '../components/PortfolioStatusKaart';
import { HistorieScherm } from '../components/HistorieScherm';
import { PortfolioTrade, nieuweId } from '../state/portfolioTypes';
import { usePortfolio } from '../state/PortfolioProvider';
import { bepaalAdvies } from '../state/advies';
import { berekenPortfolioWaarde } from '../state/statistieken';
import { CoinDetailScherm } from '../components/CoinDetailScherm';
import { CoinDetailData, vanPortfolioTrade } from '../engine/coinDetailData';
import { laadTekst, laadObject, bewaarObject, verwijderSleutel, SLEUTELS } from '../storage/opslag';

// ---------- TradeRegel ----------
function TradeRegel({ trade, livePrijs, onVraagSluiten, onVerwijder, onBewerk, onOpenDetail }: {
  trade: PortfolioTrade;
  livePrijs: number | undefined;
  onVraagSluiten: (trade: PortfolioTrade, status: 'gewonnen' | 'verloren') => void;
  onVerwijder: (id: string) => void;
  onBewerk: (trade: PortfolioTrade) => void;
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
          {trade.status === 'open' && (
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

// ---------- Scherm ----------
export function PortfolioScreen() {
  const { colors } = useTheme();
  const {
    trades, livePrijzen, voegTradeToe, wijzigTrade, sluitTrade, verwijderTrade,
    syncing, laatsteSync, syncFout, etoroFout, synchroniseer,
  } = usePortfolio();
  const [formulierZichtbaar, setFormulierZichtbaar] = useState(false);
  const [bewerkTrade, setBewerkTrade] = useState<PortfolioTrade | null>(null);
  const [sluitVerzoek, setSluitVerzoek] = useState<{ trade: PortfolioTrade; status: 'gewonnen' | 'verloren' } | null>(null);
  const [detailCoin, setDetailCoin] = useState<CoinDetailData | null>(null);
  const [etoroBezig, setEtoroBezig] = useState(false);
  const [ververst, setVerverst] = useState(false);
  const [historieOpen, setHistorieOpen] = useState(false);

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
    const [apiKey, userKey] = await Promise.all([
      laadTekst(SLEUTELS.etoroApiKey, ''),
      laadTekst(SLEUTELS.etoroUserKey, ''),
    ]);
    if (!apiKey || !userKey) {
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

  return (
    <SafeAreaView style={[portfolioStyles.root, { backgroundColor: colors.achtergrond }]}>
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
        data={openTrades}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TradeRegel
            trade={item}
            livePrijs={livePrijzen[item.symbool]}
            onVraagSluiten={(t, status) => setSluitVerzoek({ trade: t, status })}
            onVerwijder={verwijderTrade}
            onBewerk={setBewerkTrade}
            onOpenDetail={t => setDetailCoin(vanPortfolioTrade(t, livePrijzen[t.symbool]))}
          />
        )}
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

      <CoinDetailScherm data={detailCoin} onSluiten={() => setDetailCoin(null)} />

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
  lijst: { paddingTop: spacing.md },
});
