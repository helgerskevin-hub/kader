import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Font, Size } from '../theme/typography';
import { zoekKansen, fmtPrijs, Kans } from '../engine/cryptoAnalyzer';

export default function KansenScreen() {
  const [kansen, setKansen] = useState<Kans[]>([]);
  const [laden, setLaden] = useState(false);
  const [tijd, setTijd] = useState('');

  async function scan() {
    setLaden(true);
    setKansen([]);
    try {
      const result = await zoekKansen(10);
      setKansen(result);
      setTijd(new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }));
    } catch { /* ignore */ }
    finally { setLaden(false); }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.title}>Grote kansen</Text>
        <Text style={s.sub}>Scant honderden coins op sterk momentum, kleinere marktcap en herstelruimte. Speculatief en volatiel — gebruik altijd de stop loss.</Text>

        <View style={s.waarschuwing}>
          <Text style={s.waarschuwingTxt}>⚠️ Dit zijn speculatieve, volatiele coins. Ze kunnen hard stijgen maar ook hard dalen. Gebruik altijd de stop loss en investeer alleen wat je kunt missen.</Text>
        </View>

        <TouchableOpacity style={[s.btn, laden && s.btnDisabled]} onPress={scan} disabled={laden} activeOpacity={0.8}>
          {laden
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.btnTxt}>Zoek grote kansen</Text>}
        </TouchableOpacity>

        {!!tijd && !laden && <Text style={s.tijdTxt}>Bijgewerkt om {tijd}</Text>}

        {kansen.map(k => <KansKaart key={k.symbool} kans={k} />)}

        <Text style={s.disc}>Geen financieel advies. Controleer altijd de live koers op eToro voordat je een order plaatst.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function KansKaart({ kans: k }: { kans: Kans }) {
  const trendKleur = k.trendOp === true ? Colors.green : k.trendOp === false ? Colors.red : Colors.dim;

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View>
          <Text style={s.sym}>{k.symbool}</Text>
          <Text style={s.naam}>{k.naam}</Text>
        </View>
        <View style={s.statCol}>
          <Text style={[s.pct, { color: k.p7 >= 0 ? Colors.green : Colors.red }]}>
            {k.p7 >= 0 ? '+' : ''}{k.p7}% <Text style={s.pctLabel}>7d</Text>
          </Text>
          {k.rang != null && <Text style={s.rang}>#{k.rang}</Text>}
        </View>
      </View>

      <View style={s.niveauRij}>
        <NiveauVak label="Stop loss"   waarde={fmtPrijs(k.stopLoss)}   kleur={Colors.red} />
        <NiveauVak label="Entry"        waarde={fmtPrijs(k.entry)}       kleur={Colors.dim} />
        <NiveauVak label="Take profit"  waarde={fmtPrijs(k.takeProfit)}  kleur={Colors.green} />
      </View>

      <View style={s.rij}>
        <Text style={s.rijLabel}>R/R</Text>
        <Text style={s.rijVal}>1:{k.rr}</Text>
      </View>
      {k.rsi != null && (
        <View style={s.rij}>
          <Text style={s.rijLabel}>RSI</Text>
          <Text style={s.rijVal}>{k.rsi}</Text>
        </View>
      )}
      {k.trendOp != null && (
        <View style={s.rij}>
          <Text style={s.rijLabel}>Trend</Text>
          <Text style={[s.rijVal, { color: trendKleur }]}>{k.trendOp ? '↑ Opwaarts' : '↓ Neerwaarts'}</Text>
        </View>
      )}

      <View style={s.redenenRij}>
        {k.redenen.map(r => (
          <View key={r} style={s.tag}><Text style={s.tagTxt}>{r}</Text></View>
        ))}
      </View>

      <Text style={s.methode}>{k.methode}</Text>
    </View>
  );
}

function NiveauVak({ label, waarde, kleur }: { label: string; waarde: string; kleur: string }) {
  return (
    <View style={s.niveauVak}>
      <Text style={[s.niveauLabel, { color: kleur }]}>{label}</Text>
      <Text style={[s.niveauWaarde, { color: kleur }]}>{waarde}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.bg },
  scroll:   { flex: 1 },
  content:  { padding: 16, paddingBottom: 32 },
  title:    { fontFamily: Font.sansBd, fontSize: Size.title, color: Colors.text, marginBottom: 4 },
  sub:      { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim, marginBottom: 12, lineHeight: 22 },
  waarschuwing: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, padding: 12, marginBottom: 16 },
  waarschuwingTxt: { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.amber, lineHeight: 18 },
  btn:      { backgroundColor: Colors.cta, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.6 },
  btnTxt:   { fontFamily: Font.sansSb, fontSize: Size.body, color: '#fff' },
  tijdTxt:  { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim, textAlign: 'center', marginBottom: 16 },
  disc:     { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim, marginTop: 24, lineHeight: 18, textAlign: 'center' },

  card:     { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  sym:      { fontFamily: Font.sansBd, fontSize: Size.title, color: Colors.text },
  naam:     { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim },
  statCol:  { alignItems: 'flex-end' },
  pct:      { fontFamily: Font.monoMd, fontSize: Size.section },
  pctLabel: { fontFamily: Font.sans, fontSize: Size.over, color: Colors.dim },
  rang:     { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim },

  niveauRij:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  niveauVak:    { flex: 1, backgroundColor: Colors.muted, borderRadius: 8, padding: 8, alignItems: 'center' },
  niveauLabel:  { fontFamily: Font.sans, fontSize: Size.over, marginBottom: 2 },
  niveauWaarde: { fontFamily: Font.monoMd, fontSize: Size.caption },

  rij:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rijLabel: { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim },
  rijVal:   { fontFamily: Font.monoMd, fontSize: Size.body, color: Colors.text },

  redenenRij: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  tag:        { backgroundColor: Colors.muted, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagTxt:     { fontFamily: Font.sans, fontSize: Size.over, color: Colors.dim },
  methode:    { fontFamily: Font.sans, fontSize: Size.over, color: Colors.dim, marginTop: 8 },
});
