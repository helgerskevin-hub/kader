import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, FlatList, Modal, TextInput, ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, RefreshCw, X, Wallet, CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { fmtPrijs, fmtPct, fmtRR } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii, shadow } from '../theme/tokens';
import { useToetsenbordHoogte } from '../theme/useToetsenbordHoogte';
import { Disclaimer } from '../components/Disclaimer';
import { ScreenHeader } from '../components/ScreenHeader';
import { PortfolioTrade, nieuweId } from '../state/portfolioTypes';
import { usePortfolio } from '../state/PortfolioProvider';
import { bepaalAdvies } from '../state/advies';
import { berekenStatistieken } from '../state/statistieken';
import { CoinDetailScherm } from '../components/CoinDetailScherm';
import { CoinDetailData, vanPortfolioTrade } from '../engine/coinDetailData';

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
  const behaaldUsd = trade.exitPrijs !== undefined && heeftAantal
    ? (trade.exitPrijs - trade.entryPrijs) * trade.aantalCoins!
    : null;
  const behaaldKleur = behaaldPct !== null
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
          <Text style={[Type.prijs, { color: colors.verlies, fontSize: 13 }]}>{fmtPrijs(trade.stopLoss)}</Text>
        </View>
        <View style={tradeStyles.niveau}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>ENTRY</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>{fmtPrijs(trade.entryPrijs)}</Text>
        </View>
        <View style={tradeStyles.niveau}>
          <Text style={[Type.overline, { color: colors.winst }]}>DOEL</Text>
          <Text style={[Type.prijs, { color: colors.winst, fontSize: 13 }]}>{fmtPrijs(trade.takeProfit)}</Text>
        </View>
        <View style={tradeStyles.niveau}>
          <Text style={[Type.overline, { color: colors.tekstGedimd }]}>R/R</Text>
          <Text style={[Type.prijs, { color: colors.tekstPrimair, fontSize: 13 }]}>{fmtRR(trade.rr)}</Text>
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
                {resultaatUsd !== null ? `  ${resultaatUsd >= 0 ? '+' : ''}$${Math.abs(resultaatUsd).toFixed(2)}` : ''}
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
                {behaaldUsd !== null ? `  ${behaaldUsd >= 0 ? '+' : ''}$${Math.abs(behaaldUsd).toFixed(2)}` : ''}
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
  const toetsenbordHoogte = useToetsenbordHoogte();

  useEffect(() => {
    if (zichtbaar) {
      setForm(bestaand ? formVanTrade(bestaand) : leegForm);
      setFout('');
    }
  }, [zichtbaar, bestaand]);

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
    <Modal visible={zichtbaar} animationType="slide" transparent onRequestClose={onSluiten}>
      <View style={formStyles.overlay}>
        <View style={[
          formStyles.vel, shadow.modal,
          { backgroundColor: colors.kaart, paddingBottom: Math.max(spacing.xl, toetsenbordHoogte) },
        ]}>
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
        </View>
      </View>
    </Modal>
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
  const toetsenbordHoogte = useToetsenbordHoogte();

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
    <Modal visible={verzoek !== null} animationType="slide" transparent onRequestClose={onSluiten}>
      <View style={formStyles.overlay}>
        <View style={[
          formStyles.vel, shadow.modal,
          { backgroundColor: colors.kaart, paddingBottom: Math.max(spacing.xl, toetsenbordHoogte) },
        ]}>
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
        </View>
      </View>
    </Modal>
  );
}

const formStyles = StyleSheet.create({
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
  const { trades, livePrijzen, voegTradeToe, wijzigTrade, sluitTrade, verwijderTrade, syncing, volgendeVerversing, verversPrijzen } = usePortfolio();
  const [formulierZichtbaar, setFormulierZichtbaar] = useState(false);
  const [bewerkTrade, setBewerkTrade] = useState<PortfolioTrade | null>(null);
  const [sluitVerzoek, setSluitVerzoek] = useState<{ trade: PortfolioTrade; status: 'gewonnen' | 'verloren' } | null>(null);
  const [detailCoin, setDetailCoin] = useState<CoinDetailData | null>(null);
  const [seconden, setSeconden] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (volgendeVerversing) {
        setSeconden(Math.max(0, Math.round((volgendeVerversing.getTime() - Date.now()) / 1000)));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [volgendeVerversing]);

  const openCount = trades.filter(t => t.status === 'open').length;
  const gewonnenCount = trades.filter(t => t.status === 'gewonnen').length;
  const verlorenCount = trades.filter(t => t.status === 'verloren').length;
  const statistieken = berekenStatistieken(trades);

  return (
    <SafeAreaView style={[portfolioStyles.root, { backgroundColor: colors.achtergrond }]}>
      <ScreenHeader
        titel="Mijn trades"
        meta={syncing ? 'Prijzen ophalen...' : seconden !== null ? `Sync over ${seconden}s` : undefined}
        rechts={
          <View style={portfolioStyles.headerActies}>
            <Pressable
              onPress={verversPrijzen}
              disabled={syncing}
              accessibilityRole="button"
              accessibilityLabel="Prijzen verversen"
              style={portfolioStyles.syncKnop}
            >
              <RefreshCw size={18} color={syncing ? colors.tekstGedimd : colors.cta} strokeWidth={1.75} />
            </Pressable>
            <Pressable
              style={[portfolioStyles.toevoegenKnop, { backgroundColor: colors.cta }]}
              onPress={() => setFormulierZichtbaar(true)}
              accessibilityRole="button"
              accessibilityLabel="Trade toevoegen"
            >
              <Plus size={16} color="white" strokeWidth={2} />
              <Text style={[Type.caption, { color: 'white', fontWeight: '600' }]}>Voeg toe</Text>
            </Pressable>
          </View>
        }
      />

      {trades.length === 0 ? (
        <View style={portfolioStyles.leeg}>
          <Wallet size={40} color={colors.tekstGedimd} strokeWidth={1.5} />
          <Text style={[Type.titel, { color: colors.tekstPrimair, textAlign: 'center', marginTop: spacing.base }]}>
            Geen trades bijgehouden
          </Text>
          <Text style={[Type.body, { color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.sm, lineHeight: 24 }]}>
            Voeg een trade toe vanuit het Markt-scherm of via de knop hierboven.
          </Text>
          <Pressable
            style={[portfolioStyles.leegKnop, { backgroundColor: colors.cta }]}
            onPress={() => setFormulierZichtbaar(true)}
            accessibilityRole="button"
          >
            <Plus size={16} color="white" strokeWidth={2} />
            <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Eerste trade toevoegen</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={trades}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TradeRegel
              trade={item}
              livePrijs={item.status === 'open' ? livePrijzen[item.symbool] : undefined}
              onVraagSluiten={(t, status) => setSluitVerzoek({ trade: t, status })}
              onVerwijder={verwijderTrade}
              onBewerk={setBewerkTrade}
              onOpenDetail={t => setDetailCoin(vanPortfolioTrade(t, livePrijzen[t.symbool]))}
            />
          )}
          contentContainerStyle={portfolioStyles.lijst}
          ListHeaderComponent={
            <>
              <View style={portfolioStyles.stats}>
                <View style={portfolioStyles.stat}>
                  <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>{openCount}</Text>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]}>OPEN</Text>
                </View>
                <View style={portfolioStyles.stat}>
                  <Text style={[Type.prijsGroot, { color: colors.winst }]}>{gewonnenCount}</Text>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]}>GEWONNEN</Text>
                </View>
                <View style={portfolioStyles.stat}>
                  <Text style={[Type.prijsGroot, { color: colors.verlies }]}>{verlorenCount}</Text>
                  <Text style={[Type.overline, { color: colors.tekstGedimd }]}>VERLOREN</Text>
                </View>
              </View>
              {statistieken.afgesloten > 0 && (
                <View style={[portfolioStyles.stats, { paddingTop: 0 }]}>
                  <View style={portfolioStyles.stat}>
                    <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>
                      {statistieken.trefferpercentage !== null ? `${Math.round(statistieken.trefferpercentage)}%` : '—'}
                    </Text>
                    <Text style={[Type.overline, { color: colors.tekstGedimd }]}>TREFFERPERCENTAGE</Text>
                  </View>
                  <View style={portfolioStyles.stat}>
                    <Text style={[Type.prijsGroot, { color: colors.tekstPrimair }]}>
                      {statistieken.gemBehaaldeRR !== null ? fmtRR(statistieken.gemBehaaldeRR) : '—'}
                    </Text>
                    <Text style={[Type.overline, { color: colors.tekstGedimd }]}>GEM. R/R BEHAALD</Text>
                  </View>
                  {statistieken.totaalResultaatUsd !== null && (
                    <View style={portfolioStyles.stat}>
                      <Text style={[Type.prijsGroot, { color: statistieken.totaalResultaatUsd >= 0 ? colors.winst : colors.verlies }]}>
                        {statistieken.totaalResultaatUsd >= 0 ? '+' : ''}${Math.abs(statistieken.totaalResultaatUsd).toFixed(2)}
                      </Text>
                      <Text style={[Type.overline, { color: colors.tekstGedimd }]}>TOTAAL RESULTAAT</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          }
          ListFooterComponent={<Disclaimer />}
        />
      )}

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
    </SafeAreaView>
  );
}

const portfolioStyles = StyleSheet.create({
  root: { flex: 1 },
  headerActies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncKnop: {
    minHeight: 36,
    minWidth: 36,
    alignItems: 'center',
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
  lijst: { paddingTop: spacing.md },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  stat: { alignItems: 'center', gap: 4 },
});
