import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Font, Size } from '../theme/typography';
import { fmtPrijs, haalLivePrijs } from '../engine/cryptoAnalyzer';
import {
  OpenTrade, GeslotenTrade,
  laadOpenTrades, laadGeslotenTrades,
  voegTradeToe, sluitTrade, verwijderTrade,
} from '../storage/storage';

// ---------------------------------------------------------------------------
// Advice logic (mirrors Python desktop app advice badges)
// ---------------------------------------------------------------------------
interface Advies {
  label: string;
  kleur: string;
  bgKleur: string;
}

function genereerAdvies(trade: OpenTrade, livePrijs: number): Advies {
  const { entry, stopLoss, takeProfit } = trade;
  const risk   = entry - stopLoss;
  const reward = takeProfit - entry;

  if (livePrijs <= stopLoss) return { label: 'VERKOOP NU',      kleur: Colors.red,   bgKleur: Colors.redBg };
  if (livePrijs >= takeProfit) return { label: 'NEEM WINST',    kleur: Colors.green, bgKleur: Colors.greenBg };
  if (livePrijs > entry && reward > 0 && (livePrijs - entry) >= 0.7 * reward)
    return { label: 'OVERWEEG WINST', kleur: Colors.amber, bgKleur: Colors.amberBg };
  if (livePrijs < entry && risk > 0 && (entry - livePrijs) >= 0.7 * risk)
    return { label: 'LET OP',         kleur: Colors.amber, bgKleur: Colors.amberBg };
  if (livePrijs >= entry) return { label: 'HOUD VAST',         kleur: Colors.dim,   bgKleur: Colors.muted };
  return                         { label: 'HOUD VAST',         kleur: Colors.dim,   bgKleur: Colors.muted };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function PortfolioScreen() {
  const [openTrades,    setOpenTrades]    = useState<OpenTrade[]>([]);
  const [geslotenTrades,setGeslotenTrades]= useState<GeslotenTrade[]>([]);
  const [livePrijzen,   setLivePrijzen]   = useState<Record<string, number>>({});
  const [ladenPrijzen,  setLadenPrijzen]  = useState(false);
  const [bijgewerktOm,  setBijgewerktOm]  = useState('');
  const [autoVernieuw,  setAutoVernieuw]  = useState(true);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [fSym,   setFSym]   = useState('');
  const [fEntry, setFEntry] = useState('');
  const [fStop,  setFStop]  = useState('');
  const [fTp,    setFTp]    = useState('');
  const [fAantal,setFAantal]= useState('');
  const [fFout,  setFFout]  = useState('');

  // Load from storage on mount
  useEffect(() => {
    (async () => {
      setOpenTrades(await laadOpenTrades());
      setGeslotenTrades(await laadGeslotenTrades());
    })();
  }, []);

  const vernieuwPrijzen = useCallback(async (trades?: OpenTrade[]) => {
    const lijst = trades ?? openTrades;
    if (!lijst.length) return;
    setLadenPrijzen(true);
    const nieuw: Record<string, number> = { ...livePrijzen };
    for (const t of lijst) {
      const p = await haalLivePrijs(t.symbool);
      if (p != null) nieuw[t.symbool] = p;
    }
    setLivePrijzen(nieuw);
    setBijgewerktOm(new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }));
    setLadenPrijzen(false);
  }, [openTrades, livePrijzen]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    if (autoVernieuw && openTrades.length) {
      vernieuwPrijzen();
      autoRef.current = setInterval(() => vernieuwPrijzen(), 60_000);
    }
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoVernieuw, openTrades.length]);

  async function voegToe() {
    setFFout('');
    const sym   = fSym.trim().toUpperCase();
    const entry = parseFloat(fEntry.replace(',', '.'));
    const stop  = parseFloat(fStop.replace(',', '.'));
    const tp    = parseFloat(fTp.replace(',', '.'));
    const aantal = fAantal ? parseFloat(fAantal.replace(',', '.')) : 0;

    if (!sym)            { setFFout('Vul een symbool in.'); return; }
    if (isNaN(entry) || entry <= 0) { setFFout('Vul een geldige entry-prijs in.'); return; }
    if (isNaN(stop)  || stop  <= 0) { setFFout('Vul een geldige stop loss in.'); return; }
    if (isNaN(tp)    || tp    <= 0) { setFFout('Vul een geldige take profit in.'); return; }
    if (stop >= entry)              { setFFout('Stop loss moet lager zijn dan de entry.'); return; }
    if (tp   <= entry)              { setFFout('Take profit moet hoger zijn dan de entry.'); return; }

    const nieuw = await voegTradeToe({ symbool: sym, entry, stopLoss: stop, takeProfit: tp, aantal });
    const bijgewerkt = [...openTrades, nieuw];
    setOpenTrades(bijgewerkt);
    setFSym(''); setFEntry(''); setFStop(''); setFTp(''); setFAantal('');
    vernieuwPrijzen(bijgewerkt);
  }

  async function sluit(trade: OpenTrade) {
    const livePrijs = livePrijzen[trade.symbool];
    const standaard = livePrijs ? fmtPrijs(livePrijs).replace('$', '') : '';
    Alert.prompt(
      'Trade sluiten',
      `Tegen welke prijs sluit je ${trade.symbool}?`,
      async (input) => {
        if (!input) return;
        const prijs = parseFloat(input.replace(',', '.'));
        if (isNaN(prijs) || prijs <= 0) return;
        await sluitTrade(trade.id, prijs);
        setOpenTrades(await laadOpenTrades());
        setGeslotenTrades(await laadGeslotenTrades());
      },
      'plain-text',
      standaard,
    );
  }

  async function verwijder(id: string) {
    await verwijderTrade(id);
    const bijgewerkt = openTrades.filter(t => t.id !== id);
    setOpenTrades(bijgewerkt);
  }

  // Summary stats
  const totaalIngelegd = openTrades.reduce((s, t) => s + (t.aantal > 0 ? t.entry * t.aantal : 0), 0);
  const totaalWaarde   = openTrades.reduce((s, t) => {
    const p = livePrijzen[t.symbool];
    return s + (p && t.aantal > 0 ? p * t.aantal : 0);
  }, 0);
  const totaalWV = totaalWaarde - totaalIngelegd;
  const actieNodig = openTrades.filter(t => {
    const p = livePrijzen[t.symbool];
    if (!p) return false;
    const adv = genereerAdvies(t, p);
    return adv.label === 'VERKOOP NU' || adv.label === 'NEEM WINST';
  }).length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Mijn Trades</Text>
          <Text style={s.sub}>Volg je open posities met live prijs en een HOUD / VERKOOP / WINST-advies.</Text>

          {/* Summary KPI bar */}
          {openTrades.length > 0 && (
            <View style={s.kpiRij}>
              <KpiVak label="Open"    waarde={String(openTrades.length)} />
              <KpiVak label="Ingelegd" waarde={totaalIngelegd > 0 ? `$${totaalIngelegd.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}` : '—'} />
              <KpiVak label="Waarde"  waarde={totaalWaarde > 0 ? `$${totaalWaarde.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}` : '—'} />
              <KpiVak label="W/V"     waarde={totaalWaarde > 0 ? (totaalWV >= 0 ? '+' : '') + `$${Math.round(totaalWV)}` : '—'}
                       kleur={totaalWaarde > 0 ? (totaalWV >= 0 ? Colors.green : Colors.red) : undefined} />
              <KpiVak label="Actie"   waarde={actieNodig > 0 ? String(actieNodig) : '✓'} kleur={actieNodig > 0 ? Colors.red : Colors.green} />
            </View>
          )}

          {/* Add trade form */}
          <View style={s.card}>
            <Text style={s.cardTitel}>Trade toevoegen</Text>
            <View style={s.formGrid}>
              <Veld label="Symbool"         value={fSym}    onChangeText={t => setFSym(t.toUpperCase())} placeholder="BTC" style={{ flex: 1 }} />
              <Veld label="Aantal (optioneel)" value={fAantal} onChangeText={setFAantal} placeholder="0.05"  keyboardType="decimal-pad" style={{ flex: 1 }} />
            </View>
            <View style={s.formGrid}>
              <Veld label="Entry ($)" value={fEntry} onChangeText={setFEntry} placeholder="65000" keyboardType="decimal-pad" style={{ flex: 1 }} />
              <Veld label="Stop loss ($)" value={fStop} onChangeText={setFStop} placeholder="63000" keyboardType="decimal-pad" style={{ flex: 1 }} />
              <Veld label="Take profit ($)" value={fTp} onChangeText={setFTp} placeholder="70000" keyboardType="decimal-pad" style={{ flex: 1 }} />
            </View>
            {!!fFout && <Text style={s.fout}>{fFout}</Text>}
            <Text style={s.hint}>Tip: klik op "Getrade" op een analysekaart om automatisch in te vullen.</Text>
            <TouchableOpacity style={s.btn} onPress={voegToe} activeOpacity={0.8}>
              <Text style={s.btnTxt}>+ Trade toevoegen</Text>
            </TouchableOpacity>
          </View>

          {/* Refresh controls */}
          {openTrades.length > 0 && (
            <View style={s.refreshRij}>
              {!!bijgewerktOm && <Text style={s.tijdTxt}>{ladenPrijzen ? 'Prijzen vernieuwen…' : `Bijgewerkt om ${bijgewerktOm}`}</Text>}
              <View style={s.refreshKnoppen}>
                <TouchableOpacity style={s.autoToggle} onPress={() => setAutoVernieuw(v => !v)}>
                  <View style={[s.checkbox, autoVernieuw && s.checkboxAan]} />
                  <Text style={s.autoTxt}>Auto (1 min)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.vernieuwKnop} onPress={() => vernieuwPrijzen()} activeOpacity={0.8}>
                  <Text style={s.vernieuwTxt}>🔄 Vernieuwen</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Open positions */}
          {openTrades.length === 0 && (
            <View style={s.leeg}><Text style={s.leegTxt}>Nog geen open trades. Voeg er een toe hierboven.</Text></View>
          )}
          {openTrades.map(t => (
            <TradeKaart
              key={t.id}
              trade={t}
              livePrijs={livePrijzen[t.symbool]}
              onSluit={() => sluit(t)}
              onVerwijder={() => verwijder(t.id)}
            />
          ))}

          {/* Closed positions */}
          {geslotenTrades.length > 0 && (
            <>
              <Text style={s.sectieKop}>Gesloten</Text>
              <View style={s.card}>
                {geslotenTrades.map(t => (
                  <View key={t.id} style={s.geslotenRij}>
                    <Text style={s.geslotenSym}>{t.symbool}</Text>
                    <Text style={s.geslotenDatum}>{new Date(t.datumGesloten).toLocaleDateString('nl-NL')}</Text>
                    <Text style={[s.geslotenPct, { color: t.resultaatPct >= 0 ? Colors.green : Colors.red }]}>
                      {t.resultaatPct >= 0 ? '+' : ''}{t.resultaatPct}%
                    </Text>
                    <Text style={s.geslotenSlot}>{fmtPrijs(t.slotPrijs)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={s.disc}>Geen financieel advies. Controleer altijd de live koers op eToro voordat je een order plaatst.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function KpiVak({ label, waarde, kleur }: { label: string; waarde: string; kleur?: string }) {
  return (
    <View style={s.kpiVak}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiWaarde, kleur ? { color: kleur } : null]}>{waarde}</Text>
    </View>
  );
}

function Veld({ label, style: outerStyle, ...props }: { label: string; style?: object } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[s.veld, outerStyle]}>
      <Text style={s.veldLabel}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={Colors.dim} inputMode="decimal" {...props} />
    </View>
  );
}

function TradeKaart({ trade: t, livePrijs, onSluit, onVerwijder }: {
  trade: OpenTrade;
  livePrijs?: number;
  onSluit: () => void;
  onVerwijder: () => void;
}) {
  const heeftPrijs = livePrijs != null;
  const advies     = heeftPrijs ? genereerAdvies(t, livePrijs!) : null;
  const wvPct      = heeftPrijs ? ((livePrijs! - t.entry) / t.entry) * 100 : null;
  const wvEur      = heeftPrijs && t.aantal > 0 ? (livePrijs! - t.entry) * t.aantal : null;

  // Progress bar: 0% = stop, 100% = TP. Entry is the midpoint reference.
  const bereik  = t.takeProfit - t.stopLoss;
  const positie = heeftPrijs ? Math.max(0, Math.min(100, ((livePrijs! - t.stopLoss) / bereik) * 100)) : null;
  const entryPct= Math.max(0, Math.min(100, ((t.entry - t.stopLoss) / bereik) * 100));

  return (
    <View style={[s.card, advies && { borderLeftWidth: 3, borderLeftColor: advies.kleur }]}>
      <View style={s.tradeTop}>
        <Text style={s.tradeSym}>{t.symbool}</Text>
        {advies && (
          <View style={[s.badge, { backgroundColor: advies.bgKleur }]}>
            <Text style={[s.badgeTxt, { color: advies.kleur }]}>{advies.label}</Text>
          </View>
        )}
      </View>

      {heeftPrijs && (
        <View style={s.prijsRij}>
          <Text style={s.livePrijs}>{fmtPrijs(livePrijs)}</Text>
          {wvPct != null && (
            <Text style={[s.wvPct, { color: wvPct >= 0 ? Colors.green : Colors.red }]}>
              {wvPct >= 0 ? '+' : ''}{wvPct.toFixed(2)}%
              {wvEur != null ? ` · ${wvEur >= 0 ? '+' : ''}$${Math.abs(wvEur).toFixed(2)}` : ''}
            </Text>
          )}
        </View>
      )}
      {!heeftPrijs && <Text style={s.ladenTxt}>Prijs laden…</Text>}

      <View style={s.niveauRij}>
        <Text style={[s.niveau, { color: Colors.red }]}>🛑 {fmtPrijs(t.stopLoss)}</Text>
        <Text style={[s.niveau, { color: Colors.dim }]}>Entry {fmtPrijs(t.entry)}</Text>
        <Text style={[s.niveau, { color: Colors.green }]}>🎯 {fmtPrijs(t.takeProfit)}</Text>
      </View>

      {/* Progress bar */}
      <View style={s.balk}>
        {/* Entry marker */}
        <View style={[s.balkMarker, { left: `${entryPct}%` as any }]} />
        {/* Current price fill */}
        {positie != null && (
          <View style={[s.balkVul, {
            width: `${positie}%` as any,
            backgroundColor: positie > entryPct ? Colors.green : Colors.red,
          }]} />
        )}
      </View>

      <Text style={s.tradeInfo}>
        Geopend {new Date(t.datumOpen).toLocaleDateString('nl-NL')}
        {t.aantal > 0 ? ` · ${t.aantal} stuks` : ''}
      </Text>

      <View style={s.actieRij}>
        <TouchableOpacity style={[s.actieKnop, s.actieKnopPrimair]} onPress={onSluit} activeOpacity={0.8}>
          <Text style={s.actieKnopTxt}>✓ Gesloten</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onVerwijder} style={s.verwijderKnop}>
          <Text style={s.verwijderTxt}>Verwijderen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title:   { fontFamily: Font.sansBd, fontSize: Size.title, color: Colors.text, marginBottom: 4 },
  sub:     { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim, marginBottom: 16, lineHeight: 22 },
  disc:    { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim, marginTop: 24, lineHeight: 18, textAlign: 'center' },
  sectieKop: { fontFamily: Font.sansSb, fontSize: Size.section, color: Colors.text, marginTop: 24, marginBottom: 8 },

  kpiRij:    { flexDirection: 'row', gap: 6, marginBottom: 16 },
  kpiVak:    { flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  kpiLabel:  { fontFamily: Font.sans, fontSize: Size.over, color: Colors.dim, marginBottom: 2 },
  kpiWaarde: { fontFamily: Font.monoMd, fontSize: Size.caption, color: Colors.text },

  card:      { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardTitel: { fontFamily: Font.sansSb, fontSize: Size.section, color: Colors.text, marginBottom: 12 },

  formGrid:  { flexDirection: 'row', gap: 8, marginBottom: 4 },
  veld:      { marginBottom: 8 },
  veldLabel: { fontFamily: Font.sansMd, fontSize: Size.caption, color: Colors.text, marginBottom: 4 },
  input:     { backgroundColor: Colors.muted, borderRadius: 8, padding: 12, fontFamily: Font.sans, fontSize: Size.body, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  hint:      { fontFamily: Font.sans, fontSize: Size.over, color: Colors.dim, marginBottom: 8 },
  fout:      { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.red, marginBottom: 8 },
  btn:       { backgroundColor: Colors.cta, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnTxt:    { fontFamily: Font.sansSb, fontSize: Size.body, color: '#fff' },

  refreshRij:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tijdTxt:       { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim },
  refreshKnoppen:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  autoToggle:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox:      { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.border },
  checkboxAan:   { backgroundColor: Colors.cta, borderColor: Colors.cta },
  autoTxt:       { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim },
  vernieuwKnop:  { backgroundColor: Colors.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  vernieuwTxt:   { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.text },

  leeg:     { backgroundColor: Colors.muted, borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 12 },
  leegTxt:  { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim, textAlign: 'center', lineHeight: 22 },

  tradeTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tradeSym:  { fontFamily: Font.sansBd, fontSize: Size.title, color: Colors.text },
  badge:     { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt:  { fontFamily: Font.sansSb, fontSize: Size.caption },

  prijsRij:  { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  livePrijs: { fontFamily: Font.monoMd, fontSize: Size.display, color: Colors.text },
  wvPct:     { fontFamily: Font.monoMd, fontSize: Size.body },
  ladenTxt:  { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim, marginBottom: 8 },

  niveauRij: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  niveau:    { fontFamily: Font.mono, fontSize: Size.caption },

  balk:       { height: 8, backgroundColor: Colors.muted, borderRadius: 4, overflow: 'visible', marginBottom: 4, position: 'relative' },
  balkVul:    { height: 8, borderRadius: 4, position: 'absolute', left: 0, top: 0 },
  balkMarker: { position: 'absolute', top: -2, width: 2, height: 12, backgroundColor: Colors.dim, borderRadius: 1 },

  tradeInfo: { fontFamily: Font.sans, fontSize: Size.over, color: Colors.dim, marginTop: 6, marginBottom: 10 },

  actieRij:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actieKnop:       { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  actieKnopPrimair:{ backgroundColor: Colors.greenBg, borderWidth: 1, borderColor: Colors.green },
  actieKnopTxt:    { fontFamily: Font.sansSb, fontSize: Size.caption, color: Colors.green },
  verwijderKnop:   {},
  verwijderTxt:    { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.red },

  geslotenRij:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  geslotenSym:   { fontFamily: Font.sansSb, fontSize: Size.body, color: Colors.text, flex: 1 },
  geslotenDatum: { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim, flex: 1.5 },
  geslotenPct:   { fontFamily: Font.monoMd, fontSize: Size.body, flex: 1, textAlign: 'right' },
  geslotenSlot:  { fontFamily: Font.mono, fontSize: Size.caption, color: Colors.dim, flex: 1.5, textAlign: 'right' },
});
