import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView,
  StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Plus, X, Wallet } from 'lucide-react-native';
import { fmtBedrag } from '../engine/format';
import { useTheme } from '../theme/ThemeProvider';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { schuifOvergang, uitklapIn, uitklapUit } from '../theme/lijstBeweging';
import { haptiek } from '../theme/haptiek';
import { UitklapPijl } from '../components/UitklapPijl';
import { LegeStaatBeeld, Opkomst } from '../components/LegeStaatBeeld';
import { BottomSheet } from '../components/BottomSheet';
import { Disclaimer } from '../components/Disclaimer';
import { ScreenHeader } from '../components/ScreenHeader';
import { PortfolioStatusKaart } from '../components/PortfolioStatusKaart';
import { VerdelingKaart } from '../components/VerdelingKaart';
import { WachtendeOrdersKaart } from '../components/WachtendeOrdersKaart';
import { SkeletonKaart } from '../components/SkeletonKaart';
import { HistorieScherm } from '../components/HistorieScherm';
import { VerdelingScherm } from '../components/VerdelingScherm';
import { PositieKaart } from '../components/PositieKaart';
import { VerkoopOrderSheet } from '../components/VerkoopOrderSheet';
import { NiveausSheet } from '../components/NiveausSheet';
import { EtoroOmgeving, WachtendeOrder } from '../engine/etoro';
import { omschrijfOnbekendeOrder } from '../state/lopendeOrders';
import { adviesBijUitkomst, meldingNaAnnuleren, omschrijfUitkomst } from '../state/orderUitkomsten';
import { PortfolioTrade, Richting, bronVan, nieuweId, richtingVan } from '../state/portfolioTypes';
import { usePortfolio } from '../state/PortfolioProvider';
import { useDialoog } from '../state/DialoogProvider';
import { bepaalAfbouwAdvies, AfbouwAdvies } from '../state/afbouw';
import { BlootstellingKaart } from '../components/BlootstellingKaart';
import { KapitaalSheet } from '../components/KapitaalSheet';
import { useHandelskapitaal } from '../state/useHandelskapitaal';
import { useMarkt } from '../state/MarktProvider';
import { useNavigatie } from '../state/navigatie';
import { MeldingNotitie } from '../components/MeldingNotitie';
import { berekenPortfolioWaarde } from '../state/statistieken';
import { useCoinDetail } from '../components/CoinDetailScherm';
import { vanPortfolioTrade } from '../engine/coinDetailData';
import { laadTekst, bewaarTekst, laadObject, bewaarObject, verwijderSleutel, SLEUTELS } from '../storage/opslag';
import { sleutelUitkomst } from '../state/etoroSleutels';
import { useValutaStand } from '../state/useValuta';

// ---------- eToro-bestuurbaarheid ----------
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

// ---------- Formulier (handmatig toevoegen vanuit Portfolio) ----------
interface VormData {
  symbool: string;
  naam: string;
  richting: Richting;
  entryPrijs: string;
  stopLoss: string;
  takeProfit: string;
  bedragUsd: string;
  aantalCoins: string;
  notitie: string;
}

const leegForm: VormData = {
  symbool: '', naam: '', richting: 'long', entryPrijs: '', stopLoss: '', takeProfit: '', bedragUsd: '', aantalCoins: '', notitie: '',
};

function formVanTrade(trade: PortfolioTrade): VormData {
  return {
    symbool: trade.symbool,
    naam: trade.naam,
    richting: richtingVan(trade),
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

    const isShort = form.richting === 'short';

    if (!sym) { setFout('Voer een symbool in (bijv. BTC)'); return; }
    if (isNaN(entry) || entry <= 0) { setFout('Voer een geldige entryprijs in'); return; }
    // Bij een short liggen stop en doel aan de andere kant van de entry: de stop erboven (je verliest
    // als de koers stijgt), het doel eronder (je wint als de koers daalt).
    if (isShort) {
      if (isNaN(stop) || stop <= entry) { setFout('Stop-loss moet hoger zijn dan de entryprijs bij een short'); return; }
      if (isNaN(tp) || tp >= entry) { setFout('Take-profit moet lager zijn dan de entryprijs bij een short'); return; }
    } else {
      if (isNaN(stop) || stop >= entry) { setFout('Stop-loss moet lager zijn dan de entryprijs'); return; }
      if (isNaN(tp) || tp <= entry) { setFout('Take-profit moet hoger zijn dan de entryprijs'); return; }
    }

    const rr = isShort
      ? Math.round(((entry - tp) / (stop - entry)) * 10) / 10
      : Math.round(((tp - entry) / (entry - stop)) * 10) / 10;
    onOpslaan({
      id: bestaand ? bestaand.id : nieuweId(),
      symbool: sym,
      naam: form.naam.trim(),
      richting: form.richting,
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

        <Text style={[Type.overline, formStyles.label, { color: colors.tekstGedimd }]}>RICHTING</Text>
        <View style={formStyles.richtingRij}>
          <Pressable
            style={[
              formStyles.richtingKnop,
              { borderColor: form.richting === 'long' ? colors.primair : colors.rand },
              form.richting === 'long' && { backgroundColor: colors.primair + '1A' },
            ]}
            onPress={() => setForm(f => ({ ...f, richting: 'long' }))}
            accessibilityRole="button"
            accessibilityLabel="Long"
          >
            <Text style={[Type.body, { color: form.richting === 'long' ? colors.primair : colors.tekstGedimd, fontWeight: '600' }]}>Long</Text>
          </Pressable>
          <Pressable
            style={[
              formStyles.richtingKnop,
              { borderColor: form.richting === 'short' ? colors.goud : colors.rand },
              form.richting === 'short' && { backgroundColor: colors.goud + '1A' },
            ]}
            onPress={() => setForm(f => ({ ...f, richting: 'short' }))}
            accessibilityRole="button"
            accessibilityLabel="Short"
          >
            <Text style={[Type.body, { color: form.richting === 'short' ? colors.goud : colors.tekstGedimd, fontWeight: '600' }]}>Short</Text>
          </Pressable>
        </View>

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
  richtingRij: { flexDirection: 'row', gap: spacing.sm },
  richtingKnop: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radii.veld,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
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
        <UitklapPijl open={!dicht} richting="rechts" size={18} color={colors.tekstGedimd} />
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
  const { toonDialoog } = useDialoog();
  const {
    trades, livePrijzen, voegTradeToe, wijzigTrade, sluitTrade, verwijderTrade,
    syncing, laatsteSync, syncFout, etoroFout, synchroniseer, geladen,
    omgeving, magHandelen, verlopenOrders, controleerOnbekendeOrders,
    vrijSaldoUsd, gereserveerdUsd, wachtendeOrders, etoroGekoppeld,
    wachtendeOrderLijst, orderUitkomsten, annuleerWachtendeOrder, wisOrderUitkomst,
  } = usePortfolio();
  const [verkoopTrade, setVerkoopTrade] = useState<PortfolioTrade | null>(null);
  const [niveausTrade, setNiveausTrade] = useState<PortfolioTrade | null>(null);
  const [controleBezig, setControleBezig] = useState(false);
  // orderId van de wachtende order die op dit moment geannuleerd wordt, of null als er niets loopt.
  const [annuleerBezigId, setAnnuleerBezigId] = useState<number | null>(null);
  // orderIds waarvoor eToro het annuleerverzoek heeft aangenomen. Een 200 betekent alleen dat het
  // verzoek binnen is (gemeten: een al gevulde order geeft ook 200), dus de order blijft in de lijst
  // tot de sync hem niet meer meestuurt. Tot dan toont de kaart geen knop, zodat je niet dubbel
  // annuleert. Opgeruimd zodra de order uit de lijst verdwijnt.
  const [annuleringDoorgegeven, setAnnuleringDoorgegeven] = useState<ReadonlySet<number>>(new Set());
  const [formulierZichtbaar, setFormulierZichtbaar] = useState(false);
  const [bewerkTrade, setBewerkTrade] = useState<PortfolioTrade | null>(null);
  const [sluitVerzoek, setSluitVerzoek] = useState<{ trade: PortfolioTrade; status: 'gewonnen' | 'verloren' } | null>(null);
  const { openDetail, detailScherm } = useCoinDetail();
  // De koersen zitten in een ref zodat de callbacks hieronder stabiel blijven: een callback die op
  // livePrijzen leunt krijgt bij elke poll een nieuwe identiteit, en dan helpt de memo op
  // PositieKaart niet meer.
  const livePrijzenRef = useRef(livePrijzen);
  livePrijzenRef.current = livePrijzen;
  const opVraagSluiten = useCallback(
    (t: PortfolioTrade, status: 'gewonnen' | 'verloren') => setSluitVerzoek({ trade: t, status }),
    [],
  );
  const opOpenPositieDetail = useCallback(
    (t: PortfolioTrade) => openDetail(vanPortfolioTrade(t, livePrijzenRef.current[t.symbool])),
    [openDetail],
  );
  const [etoroBezig, setEtoroBezig] = useState(false);
  const [ververst, setVerverst] = useState(false);
  const [historieOpen, setHistorieOpen] = useState(false);
  const [verdelingOpen, setVerdelingOpen] = useState(false);
  const [kapitaalOpen, setKapitaalOpen] = useState(false);
  const { kapitaal, zetKapitaal } = useHandelskapitaal();
  // Het marktscherm heeft de analyse en het klimaat al opgehaald. Dit scherm leunt daarop en scant
  // niet zelf: dat zou 57 coins aan requests kosten voor data die al in het geheugen staat. Zonder
  // een gedraaide analyse blijft het klimaat null en verdwijnen het blootstellingsvak en de
  // afbouwadviezen gewoon; die zijn een aanvulling, geen voorwaarde om je trades te kunnen zien.
  const { state: marktState } = useMarkt();
  const { doel: navigatieDoel, wisDoel } = useNavigatie();
  const [meldingNotitie, setMeldingNotitie] = useState<string | null>(null);
  const reduceMotion = useReduceMotion();

  // Welke bron-groepen zijn dichtgeklapt, bewaard tussen app-starts. Standaard staan ze allebei open.
  const [dichteBronnen, setDichteBronnen] = useState<Set<'etoro' | 'handmatig'>>(new Set());
  useEffect(() => {
    laadTekst(SLEUTELS.portfolioBronDicht, '').then(tekst => {
      if (!tekst) return;
      setDichteBronnen(new Set(tekst.split(',').filter(Boolean) as ('etoro' | 'handmatig')[]));
    });
  }, []);

  // Aangetikt vanuit het meldingenlog: open meteen de trade waar die melding over ging. Het doel
  // wordt hier gewist, ook als de trade niet meer bestaat; anders blijft het staan en springt het
  // scherm bij de volgende render opnieuw open.
  useEffect(() => {
    if (!navigatieDoel) return;
    // Alleen doelen die op dit scherm thuishoren; de rest laat het Marktscherm staan.
    if (navigatieDoel.soort === 'portfolio') { wisDoel(); return; }
    if (navigatieDoel.soort !== 'trade') return;

    // Op id, met het symbool als terugval: een opnieuw geïmporteerde eToro-positie kan een ander
    // id hebben gekregen, en dan is de open trade in dezelfde coin wat je bedoelde.
    const trade = trades.find(t => t.id === navigatieDoel.tradeId)
      ?? trades.find(t => t.symbool === navigatieDoel.symbool && t.status === 'open');

    if (trade) {
      openDetail(vanPortfolioTrade(trade, livePrijzen[trade.symbool]));
    } else {
      setMeldingNotitie(
        `Die melding ging over ${navigatieDoel.symbool}, maar die positie is inmiddels gesloten of verwijderd.`,
      );
    }
    wisDoel();
  }, [navigatieDoel, trades, livePrijzen, wisDoel]);

  // Een groep dichtklappen animeert zichzelf: de rijen vervagen weg (exiting) en de groep eronder
  // schuift op via itemLayoutAnimation op de lijst. Openklappen laat de rijen weer invervagen.
  function wisselBron(bron: 'etoro' | 'handmatig') {
    setDichteBronnen(vorige => {
      const volgende = new Set(vorige);
      if (volgende.has(bron)) volgende.delete(bron); else volgende.add(bron);
      bewaarTekst(SLEUTELS.portfolioBronDicht, Array.from(volgende).join(','));
      return volgende;
    });
  }

  // Alleen de swipe krijgt een haptic, op het moment dat de lijst vastklikt. De verversknop in de
  // statuskaart heeft zijn eigen druk-feedback.
  function trekSync() {
    haptiek('vastklikken');
    swipeSync();
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
    const uitkomst = await sleutelUitkomst();
    if (uitkomst.soort === 'geen') {
      toonDialoog({
        variant: 'informatie',
        titel: 'Nog geen eToro-koppeling',
        tekst: 'Stel je API-sleutel in via Instellingen (het tandwiel rechtsboven) voordat je kunt importeren.',
        knoppen: [{ label: 'Oké' }],
      });
      return;
    }
    if (uitkomst.soort === 'kluisfout') {
      // Je bent gekoppeld, we kwamen alleen niet bij de sleutel. Dat is een ander verhaal dan
      // "stel je sleutel in", en dat verschil hoort hier te staan.
      toonDialoog({
        variant: 'informatie',
        titel: 'Sleutel niet te lezen',
        tekst: `Je eToro-sleutel staat op dit toestel, maar Kader kon er nu niet bij. ${uitkomst.bericht}`,
        knoppen: [{ label: 'Oké' }],
      });
      return;
    }
    setEtoroBezig(true);
    try {
      const uitkomst = await synchroniseer();
      if (uitkomst.fout) {
        toonDialoog({
          variant: 'fout',
          titel: 'Import mislukt',
          tekst: 'Kader kon je posities niet bij eToro ophalen.',
          details: uitkomst.fout,
          knoppen: [{ label: 'Oké' }],
        });
        return;
      }
      const delen = [`${uitkomst.toegevoegd} nieuw`];
      if (uitkomst.bijgewerkt > 0) delen.push(`${uitkomst.bijgewerkt} bijgewerkt`);
      if (uitkomst.gesloten > 0) delen.push(`${uitkomst.gesloten} automatisch gesloten`);
      if (uitkomst.uitHistorie > 0) delen.push(`${uitkomst.uitHistorie} uit je eToro-historie`);
      if (uitkomst.overgeslagen.length > 0) delen.push(`${uitkomst.overgeslagen.length} overgeslagen`);
      // Shorts komen nu gewoon binnen; wat hier nog overblijft is geen crypto-instrument. De lijst
      // gaat in het detailblok en niet achter de tekst aan: hij kan lang worden.
      const overgeslagen = uitkomst.overgeslagen.length > 0
        ? 'Overgeslagen:\n' + uitkomst.overgeslagen.map(o => `- ${o.naam} (geen crypto)`).join('\n')
        : undefined;
      toonDialoog({
        variant: 'gelukt',
        titel: 'Import voltooid',
        tekst: delen.join(', ') + '.',
        details: overgeslagen,
        knoppen: [{ label: 'Oké' }],
      });
    } finally {
      setEtoroBezig(false);
    }
  }

  // Een doorgegeven annulering vergeten zodra de order niet meer in de lijst staat: dan heeft eToro
  // hem verwerkt (geannuleerd of gevuld), en een oud id hoort de Set niet eeuwig te laten groeien.
  useEffect(() => {
    setAnnuleringDoorgegeven(vorige => {
      const nogAanwezig = new Set(wachtendeOrderLijst.map(o => o.orderId));
      const over = [...vorige].filter(id => nogAanwezig.has(id));
      return over.length === vorige.size ? vorige : new Set(over);
    });
  }, [wachtendeOrderLijst]);

  // Annuleren van een wachtende order: eerst een expliciete bevestiging, pas daarna het verzoek
  // naar eToro. Nooit automatisch herhaald, ook niet bij een onbekende uitkomst (zie INVARIANT in
  // engine/etoro.ts).
  function vraagOmAnnuleren(order: WachtendeOrder) {
    if (order.orderId === null) return;
    const bedragTekst = order.bedragUsd !== null ? fmtBedrag(order.bedragUsd, { valuta: 'USD' }) : 'onbekend bedrag';
    toonDialoog({
      variant: 'waarschuwing',
      titel: 'Order annuleren?',
      // De omgeving van de order zelf, niet de actieve: daar gaat het verzoek over.
      tekst: `Je annuleert de ${order.richting === 'short' ? 'short' : 'koop'} van ${bedragTekst} in ${order.symbool}.${order.omgeving === 'real' ? ' Dit is je echte account.' : ''}`,
      knoppen: [
        { label: 'Terug' },
        { label: 'Order annuleren', soort: 'destructief', onDruk: () => voerAnnuleringUit(order) },
      ],
    });
  }

  async function voerAnnuleringUit(order: WachtendeOrder) {
    const orderId = order.orderId;
    if (orderId === null) return;
    setAnnuleerBezigId(orderId);
    try {
      const { uitkomst, statusNa } = await annuleerWachtendeOrder(order);
      if (uitkomst.soort === 'ok') {
        // Alleen als het nog onderweg kan zijn (6 of onbekend). Wacht de order gewoon door (1, 2, 5,
        // 11, 12), dan moet de knop blijven, anders kun je niet opnieuw annuleren zolang dit scherm
        // gemount is. Definitieve statussen verdwijnen bij de volgende sync vanzelf uit de lijst.
        if (statusNa === null || statusNa === 6) {
          setAnnuleringDoorgegeven(vorige => new Set(vorige).add(orderId));
        }
        // Niet op de 200 alleen: eToro geeft die ook op een order die al gevuld was. De melding (en
        // of er succeshaptiek bij hoort) volgt uit de status die daarna is opgevraagd.
        const melding = meldingNaAnnuleren(statusNa);
        if (melding.succes) haptiek('succes');
        toonDialoog({
          variant: melding.variant,
          titel: melding.titel,
          tekst: melding.tekst,
          knoppen: [{ label: 'Oké' }],
        });
      } else if (uitkomst.soort === 'fout') {
        toonDialoog({
          variant: 'fout',
          titel: 'Annuleren is niet gelukt',
          tekst: uitkomst.bericht,
          knoppen: [{ label: 'Oké' }],
        });
      } else {
        toonDialoog({
          variant: 'waarschuwing',
          titel: 'We weten niet of het gelukt is',
          tekst: 'Kader kijkt zo opnieuw bij eToro. Controleer het bij eToro als de order blijft staan.',
          knoppen: [{ label: 'Oké' }],
        });
      }
    } finally {
      setAnnuleerBezigId(null);
    }
  }

  const openTrades = trades.filter(t => t.status === 'open');
  const afgeslotenCount = trades.length - openTrades.length;
  const waarde = berekenPortfolioWaarde(trades, livePrijzen);



  const klimaat = marktState.status === 'success' ? marktState.klimaat : null;
  // `alle` en niet `trades`: een positie kan best buiten de top-20 van het marktscherm vallen, en
  // juist over die posities zou de app dan zwijgen.
  const marktPerSymbool = useMemo(
    () => marktState.status === 'success'
      ? Object.fromEntries(marktState.alle.map(t => [t.symbool, t]))
      : {},
    [marktState],
  );
  const afbouwPerTrade = useMemo(() => {
    const uit: Record<string, AfbouwAdvies | null> = {};
    for (const trade of openTrades) {
      uit[trade.id] = bepaalAfbouwAdvies(
        trade,
        livePrijzen[trade.symbool],
        marktPerSymbool[trade.symbool],
        klimaat?.klimaat ?? null,
      );
    }
    return uit;
  }, [openTrades, livePrijzen, marktPerSymbool, klimaat]);

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
        titel="Portfolio"
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

      {/* Eén keer per app-start, tot de trades uit de opslag binnen zijn: skeleton-kaarten in
          plaats van de statuskaart en de lege "Geen open posities"-staat, anders knippert die
          eerst leeg voordat de echte trades verschijnen. Ververst je daarna (swipe of eToro-
          import), dan blijft de bestaande lijst gewoon staan; dat gebeurt hier niet opnieuw. */}
      {!geladen ? (
        <View style={portfolioStyles.laadWrapper}>
          <SkeletonKaart />
          <SkeletonKaart />
          <SkeletonKaart />
        </View>
      ) : (
      <Animated.FlatList
        data={lijstData}
        keyExtractor={item => item.soort === 'kop' ? `kop-${item.bron}` : item.trade.id}
        itemLayoutAnimation={schuifOvergang(reduceMotion)}
        // De eerste keer staan de trades er in één keer, net als voorheen na de skeletons. Alleen
        // wat er daarna bijkomt of weggaat (een groep open- of dichtklappen, een trade toevoegen of
        // sluiten) vervaagt in of uit.
        skipEnteringExitingAnimations
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
          return (
            <Animated.View entering={uitklapIn(reduceMotion)} exiting={uitklapUit()}>
              <PositieKaart
                trade={trade}
                livePrijs={livePrijzen[trade.symbool]}
                afbouw={afbouwPerTrade[trade.id]}
                onVraagSluiten={opVraagSluiten}
                onVerwijder={verwijderTrade}
                onBewerk={setBewerkTrade}
                onVerkoop={magHandelen && isEtoroBestuurbaar(trade, omgeving) ? setVerkoopTrade : undefined}
                onNiveaus={magHandelen && isEtoroBestuurbaar(trade, omgeving) ? setNiveausTrade : undefined}
                onOpenDetail={opOpenPositieDetail}
              />
            </Animated.View>
          );
        }}
        contentContainerStyle={portfolioStyles.lijst}
        refreshControl={
          <RefreshControl
            refreshing={ververst}
            onRefresh={trekSync}
            tintColor={colors.cta}
            colors={[colors.cta]}
          />
        }
        ListHeaderComponent={
          <>
            <PortfolioStatusKaart
              waarde={waarde}
              trades={trades}
              livePrijzen={livePrijzen}
              vrijSaldoUsd={vrijSaldoUsd}
              gereserveerdUsd={gereserveerdUsd}
              wachtendeOrders={wachtendeOrders}
              etoroGekoppeld={etoroGekoppeld}
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

            {/* Rendert zichzelf niet als er geen open posities zijn, dus geen voorwaarde nodig. */}
            <VerdelingKaart
              trades={trades}
              livePrijzen={livePrijzen}
              onOpenDetail={() => setVerdelingOpen(true)}
            />

            {/* Uitkomst van orders die Kader zelf plaatste: geweigerd, geannuleerd of verlopen.
                Gevuld geeft hier geen melding, die positie verschijnt vanzelf in de lijst hieronder. */}
            {orderUitkomsten.length > 0 && (
              <View style={[portfolioStyles.onbevestigd, { backgroundColor: colors.letOp + '1A', borderColor: colors.letOp }]}>
                {orderUitkomsten.map(uitkomst => (
                  <View key={uitkomst.verzoekId} style={portfolioStyles.uitkomstRegel}>
                    <Text style={[Type.caption, { color: colors.tekstPrimair, lineHeight: 18 }]}>
                      {omschrijfUitkomst(uitkomst)}
                    </Text>
                    {/* Per melding: bij een gedeeltelijke vulling of een verkoop klopt "er is geen
                        positie geopend" niet. */}
                    <Text style={[Type.caption, { color: colors.tekstGedimd, lineHeight: 18 }]}>
                      {adviesBijUitkomst(uitkomst)}
                    </Text>
                    <Pressable
                      onPress={() => wisOrderUitkomst(uitkomst.verzoekId)}
                      accessibilityRole="button"
                      accessibilityLabel="Melding begrepen, verbergen"
                      style={[portfolioStyles.onbevestigdKnop, { borderColor: colors.letOp }]}
                    >
                      <Text style={[Type.caption, { color: colors.letOp, fontWeight: '600' }]}>Begrepen</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <WachtendeOrdersKaart
              orders={wachtendeOrderLijst}
              magHandelen={magHandelen}
              onAnnuleer={vraagOmAnnuleren}
              bezigId={annuleerBezigId}
              doorgegevenIds={annuleringDoorgegeven}
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
            {meldingNotitie && (
              <MeldingNotitie tekst={meldingNotitie} onSluiten={() => setMeldingNotitie(null)} />
            )}

            {klimaat && openTrades.length > 0 && (
              <BlootstellingKaart
                inMarktUsd={waarde.huidigeWaardeUsd}
                nietGewaardeerd={waarde.zonderLivePrijs}
                klimaat={klimaat.klimaat}
                kapitaalUsd={kapitaal}
                onKapitaalWijzigen={() => setKapitaalOpen(true)}
              />
            )}

            {/* Schuift op een veer mee als de blootstellingskaart erboven zijn uitleg openklapt. */}
            {openTrades.length > 0 && (
              <Animated.View layout={schuifOvergang(reduceMotion)} style={portfolioStyles.lijstKop}>
                <Text style={[Type.overline, { color: colors.tekstGedimd }]}>
                  {openTrades.length} {openTrades.length === 1 ? 'OPEN POSITIE' : 'OPEN POSITIES'}
                </Text>
              </Animated.View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={portfolioStyles.leeg}>
            {/* De portemonnee blijft, nu tussen de ademende hoekhaken van het logo. */}
            <Opkomst volgorde={0}>
              <LegeStaatBeeld>
                <Wallet size={26} color={colors.tekstGedimd} strokeWidth={1.5} />
              </LegeStaatBeeld>
            </Opkomst>
            <Opkomst volgorde={1}>
              <Text style={[Type.titel, { color: colors.tekstPrimair, textAlign: 'center', marginTop: spacing.base }]}>
                Geen open posities
              </Text>
            </Opkomst>
            <Opkomst volgorde={2}>
              <Text style={[Type.body, { color: colors.tekstGedimd, textAlign: 'center', marginTop: spacing.sm, lineHeight: 24 }]}>
                Voeg een trade toe vanuit het Markt-scherm of via de knop rechtsboven{afgeslotenCount > 0 ? ', of bekijk je afgesloten trades in de historie' : ''}.
              </Text>
            </Opkomst>
            <Opkomst volgorde={3}>
              <Pressable
                style={[portfolioStyles.leegKnop, { backgroundColor: colors.cta }]}
                onPress={() => setFormulierZichtbaar(true)}
                accessibilityRole="button"
              >
                <Plus size={16} color="white" strokeWidth={2} />
                <Text style={[Type.body, { color: 'white', fontWeight: '600' }]}>Trade toevoegen</Text>
              </Pressable>
            </Opkomst>
          </View>
        }
        ListFooterComponent={<Disclaimer metRand={openTrades.length > 0} />}
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
          huidigePrijs={livePrijzen[niveausTrade.symbool]}
          afbouwAdvies={afbouwPerTrade[niveausTrade.id] ?? null}
          onSluiten={() => setNiveausTrade(null)}
        />
      )}

      {detailScherm}

      <HistorieScherm
        zichtbaar={historieOpen}
        trades={trades}
        onSluiten={() => setHistorieOpen(false)}
        onOpenDetail={t => openDetail(vanPortfolioTrade(t, livePrijzen[t.symbool]))}
        onVerwijder={verwijderTrade}
      />

      <VerdelingScherm
        zichtbaar={verdelingOpen}
        trades={trades}
        livePrijzen={livePrijzen}
        onSluiten={() => setVerdelingOpen(false)}
      />

      <KapitaalSheet
        zichtbaar={kapitaalOpen}
        huidig={kapitaal}
        onOpslaan={zetKapitaal}
        onSluiten={() => setKapitaalOpen(false)}
      />
    </SafeAreaView>
  );
}

const portfolioStyles = StyleSheet.create({
  root: { flex: 1 },
  laadWrapper: { paddingTop: spacing.md },
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
  uitkomstRegel: {
    gap: spacing.sm,
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
  lijstKop: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
});
