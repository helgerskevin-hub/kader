import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Font, Size } from '../theme/typography';
import { beoordeel, TraderBeoordeling } from '../engine/etoroAuditor';

export default function TradersScreen() {
  const [naam, setNaam] = useState('');
  const [riskScore, setRiskScore] = useState('');
  const [maanden, setMaanden] = useState('');
  const [drawdown, setDrawdown] = useState('');
  const [jaarrendement, setJaarrendement] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [beoordelingen, setBeoordelingen] = useState<TraderBeoordeling[]>([]);
  const [fout, setFout] = useState('');

  function beoordelen() {
    setFout('');
    if (!naam.trim()) { setFout('Vul de naam in.'); return; }
    const risk = parseInt(riskScore, 10);
    if (isNaN(risk) || risk < 1 || risk > 7) { setFout('Risk Score moet 1–7 zijn.'); return; }
    const mnd = maanden.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (mnd.length < 3) { setFout('Vul minimaal 3 maandrendementen in.'); return; }
    const dd = parseFloat(drawdown);
    if (isNaN(dd) || dd <= 0) { setFout('Vul een geldige max. drawdown in (%).'); return; }

    const port: Record<string, number> = {};
    portfolio.split(',').forEach(item => {
      const [sym, pct] = item.trim().split(':');
      if (sym && pct) { const n = parseFloat(pct); if (!isNaN(n)) port[sym.trim().toUpperCase()] = n; }
    });

    const result = beoordeel({
      naam: naam.trim(),
      maandrendementen: mnd,
      maxDrawdown: dd,
      jaarrendement: jaarrendement ? parseFloat(jaarrendement) : null,
      riskScore: risk,
      portfolio: port,
    });

    setBeoordelingen(prev => [result, ...prev.filter(b => b.naam !== result.naam)]);
    setNaam(''); setRiskScore(''); setMaanden(''); setDrawdown(''); setJaarrendement(''); setPortfolio('');
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>eToro Traders</Text>
          <Text style={s.sub}>Beoordeel een Popular Investor en krijg een 🟢/🟡/🔴-oordeel plus aanbevolen Copy Stop Loss.</Text>

          <View style={s.card}>
            <Veld label="Naam trader" value={naam} onChangeText={setNaam} placeholder="bv. JeppeKirkBonde" />
            <Veld label="eToro Risk Score (1–7)" value={riskScore} onChangeText={setRiskScore} placeholder="bv. 4" keyboardType="numeric" />
            <Veld label="Maandrendementen laatste 12 mnd (%)" value={maanden} onChangeText={setMaanden} placeholder="bv. 3.1, -1.2, 5.4, 2.2, -0.8, 4.0" hint="Komma-gescheiden. Negatief = verliesmaand." />
            <Veld label="Max. drawdown (%)" value={drawdown} onChangeText={setDrawdown} placeholder="bv. 18" keyboardType="decimal-pad" />
            <Veld label="Jaarrendement (%, optioneel)" value={jaarrendement} onChangeText={setJaarrendement} placeholder="leeg = auto" keyboardType="decimal-pad" />
            <Veld label="Portfolio-allocatie (optioneel)" value={portfolio} onChangeText={setPortfolio} placeholder="bv. BTC:35, ETH:25, SOL:15, Cash:25" hint="Formaat SYMBOOL:percentage, komma-gescheiden." />

            {!!fout && <Text style={s.fout}>{fout}</Text>}

            <TouchableOpacity style={s.btn} onPress={beoordelen} activeOpacity={0.8}>
              <Text style={s.btnTxt}>Beoordelen &amp; bewaren</Text>
            </TouchableOpacity>
          </View>

          {beoordelingen.map(b => <BeoordelingKaart key={b.naam} b={b} onVerwijder={() => setBeoordelingen(prev => prev.filter(x => x.naam !== b.naam))} />)}

          <Text style={s.disc}>Geen financieel advies. Controleer altijd de live koers op eToro voordat je een order plaatst.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Veld({ label, hint, ...props }: { label: string; hint?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={s.veld}>
      <Text style={s.veldLabel}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={Colors.dim} {...props} />
      {!!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

function BeoordelingKaart({ b, onVerwijder }: { b: TraderBeoordeling; onVerwijder: () => void }) {
  const emojiMap: Record<string, string> = { GROEN: '🟢', GEEL: '🟡', ROOD: '🔴' };
  const kleurMap: Record<string, string> = { GROEN: Colors.green, GEEL: Colors.amber, ROOD: Colors.red };
  const bgMap:    Record<string, string> = { GROEN: Colors.greenBg, GEEL: Colors.amberBg, ROOD: Colors.redBg };
  const kleur = kleurMap[b.oordeel] ?? Colors.dim;

  return (
    <View style={s.bCard}>
      <View style={s.bTop}>
        <Text style={s.bNaam}>{b.naam}</Text>
        <View style={[s.badge, { backgroundColor: bgMap[b.oordeel] }]}>
          <Text style={[s.badgeTxt, { color: kleur }]}>{emojiMap[b.oordeel]} {b.oordeel} · {b.totaalscore}/100</Text>
        </View>
      </View>

      <View style={s.cslVak}>
        <Text style={s.cslLabel}>Aanbevolen Copy Stop Loss</Text>
        <Text style={[s.cslWaarde, { color: kleur }]}>{b.csl}%</Text>
      </View>

      <View style={s.deelRij}>
        <DeelScore label="Consistentie" score={b.consistentie.score} opmerking={b.consistentie.opmerking} />
        <DeelScore label="Risico/Return" score={b.risico.score} opmerking={`jaar ${b.risico.jaarrendement}% / DD ${b.risico.maxDrawdown}%`} />
        <DeelScore label="Portfolio" score={b.portfolio.score} opmerking={b.portfolio.opmerking} />
      </View>

      <TouchableOpacity onPress={onVerwijder} style={s.verwijderKnop}>
        <Text style={s.verwijderTxt}>Verwijderen</Text>
      </TouchableOpacity>
    </View>
  );
}

function DeelScore({ label, score, opmerking }: { label: string; score: number; opmerking: string }) {
  const kleur = score >= 70 ? Colors.green : score >= 50 ? Colors.amber : Colors.red;
  return (
    <View style={s.deel}>
      <Text style={s.deelLabel}>{label}</Text>
      <Text style={[s.deelScore, { color: kleur }]}>{score}/100</Text>
      <Text style={s.deelOpm}>{opmerking}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title:   { fontFamily: Font.sansBd, fontSize: Size.title, color: Colors.text, marginBottom: 4 },
  sub:     { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim, marginBottom: 16, lineHeight: 22 },
  disc:    { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim, marginTop: 24, lineHeight: 18, textAlign: 'center' },

  card:   { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  veld:   { marginBottom: 12 },
  veldLabel: { fontFamily: Font.sansMd, fontSize: Size.caption, color: Colors.text, marginBottom: 4 },
  input:  { backgroundColor: Colors.muted, borderRadius: 8, padding: 12, fontFamily: Font.sans, fontSize: Size.body, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  hint:   { fontFamily: Font.sans, fontSize: Size.over, color: Colors.dim, marginTop: 3 },
  fout:   { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.red, marginBottom: 8 },
  btn:    { backgroundColor: Colors.cta, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnTxt: { fontFamily: Font.sansSb, fontSize: Size.body, color: '#fff' },

  bCard:  { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  bTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bNaam:  { fontFamily: Font.sansBd, fontSize: Size.section, color: Colors.text, flex: 1, marginRight: 8 },
  badge:  { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt: { fontFamily: Font.sansSb, fontSize: Size.caption },

  cslVak:   { backgroundColor: Colors.muted, borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cslLabel: { fontFamily: Font.sansMd, fontSize: Size.body, color: Colors.dim },
  cslWaarde:{ fontFamily: Font.monoMd, fontSize: Size.title },

  deelRij:  { gap: 8 },
  deel:     { backgroundColor: Colors.muted, borderRadius: 8, padding: 10 },
  deelLabel:{ fontFamily: Font.sansSb, fontSize: Size.caption, color: Colors.text, marginBottom: 2 },
  deelScore:{ fontFamily: Font.monoMd, fontSize: Size.caption, marginBottom: 2 },
  deelOpm:  { fontFamily: Font.sans, fontSize: Size.over, color: Colors.dim, lineHeight: 16 },

  verwijderKnop: { marginTop: 12, alignSelf: 'flex-end' },
  verwijderTxt:  { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.red },
});
