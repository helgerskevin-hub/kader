import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Font, Size } from '../theme/typography';
import { analyseerMarkt, fmtPrijs, Trade } from '../engine/cryptoAnalyzer';
import { infoVoor } from '../engine/coinInfo';

export default function MarktScreen() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [laden, setLaden] = useState(false);
  const [voortgang, setVoortgang] = useState('');
  const [tijd, setTijd] = useState('');

  async function startAnalyse() {
    setLaden(true);
    setTrades([]);
    setVoortgang('');
    try {
      const result = await analyseerMarkt(undefined, 10, (sym, i, tot) => {
        setVoortgang(`${sym} analyseren… (${i}/${tot})`);
      });
      setTrades(result);
      setTijd(new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      setVoortgang('Fout bij ophalen marktdata.');
    } finally {
      setLaden(false);
      setVoortgang('');
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.title}>Marktanalyse</Text>
        <Text style={s.sub}>Klik Start om verse data op te halen en de beste kansen te zien.</Text>

        <TouchableOpacity style={[s.btn, laden && s.btnDisabled]} onPress={startAnalyse} disabled={laden} activeOpacity={0.8}>
          {laden
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.btnTxt}>Start analyse</Text>}
        </TouchableOpacity>

        {!!voortgang && <Text style={s.voortgang}>{voortgang}</Text>}
        {!!tijd && !laden && <Text style={s.tijdTxt}>Bijgewerkt om {tijd}</Text>}

        {trades.length === 0 && !laden && tijd !== '' && (
          <View style={s.leeg}><Text style={s.leegTxt}>Geen trades gevonden die aan de criteria voldoen. Markt mogelijk richtingloos — geduld is ook een positie.</Text></View>
        )}

        {trades.map(t => <TradeKaart key={t.symbool} trade={t} />)}

        <Text style={s.disc}>Geen financieel advies. Controleer altijd de live koers op eToro voordat je een order plaatst.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function TradeKaart({ trade: t }: { trade: Trade }) {
  const [open, setOpen] = useState(false);
  const info = infoVoor(t.symbool);

  const badgeBg    = t.highConviction ? Colors.greenBg : t.signaal === 'KOOP' ? Colors.blueBg : Colors.grayBg;
  const badgeColor = t.highConviction ? Colors.green   : t.signaal === 'KOOP' ? Colors.cta    : Colors.dim;
  const badgeTxt   = t.highConviction ? 'HIGH CONVICTION' : t.signaal;

  const scoreColor = t.score >= 75 ? Colors.green : t.score >= 55 ? Colors.cta : Colors.dim;

  return (
    <View style={[s.card, t.highConviction && s.cardHC]}>
      <View style={s.cardTop}>
        <Text style={s.sym}>{t.symbool}</Text>
        <View style={[s.badge, { backgroundColor: badgeBg }]}>
          <Text style={[s.badgeTxt, { color: badgeColor }]}>{badgeTxt}</Text>
        </View>
      </View>

      <View style={s.rij}><Text style={s.rijLabel}>Huidige prijs</Text><Text style={s.rijVal}>{fmtPrijs(t.prijs)}</Text></View>
      <View style={s.rij}><Text style={s.rijLabel}>Entry-zone</Text><Text style={s.rijVal}>{fmtPrijs(t.entryLaag)} – {fmtPrijs(t.entryHoog)}</Text></View>
      <View style={s.rij}><Text style={[s.rijLabel, { color: Colors.red }]}>Stop loss</Text><Text style={[s.rijVal, { color: Colors.red }]}>{fmtPrijs(t.stopLoss)}</Text></View>
      <View style={s.rij}><Text style={[s.rijLabel, { color: Colors.green }]}>Take profit</Text><Text style={[s.rijVal, { color: Colors.green }]}>{fmtPrijs(t.takeProfit)}</Text></View>
      <View style={s.rij}><Text style={s.rijLabel}>Risk / Reward</Text><Text style={s.rijVal}>1:{t.rr}</Text></View>

      <View style={s.scoreRij}>
        <Text style={s.scoreLabel}>Score <Text style={s.rsiSmall}>(RSI: {Math.round(t.rsi)})</Text></Text>
        <Text style={[s.scoreGetal, { color: scoreColor }]}>{t.score}/100</Text>
      </View>
      <View style={s.balk}>
        <View style={[s.balkVul, { width: `${t.score}%` as any, backgroundColor: scoreColor }]} />
      </View>

      <View style={s.tagsRij}>
        {t.redenen.map(r => (
          <View key={r} style={s.tag}><Text style={s.tagTxt}>{r}</Text></View>
        ))}
      </View>

      <TouchableOpacity onPress={() => setOpen(!open)} style={s.infoKnop}>
        <Text style={s.infoKnopTxt}>{open ? '▲ Verberg info' : 'ℹ️ Over deze coin'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={s.infoBlok}>
          <Text style={s.infoNaam}>{info.naam} <Text style={s.infoCat}>{info.categorie}</Text></Text>
          <Text style={s.infoWat}>{info.wat}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  scroll:    { flex: 1 },
  content:   { padding: 16, paddingBottom: 32 },
  title:     { fontFamily: Font.sansBd, fontSize: Size.title, color: Colors.text, marginBottom: 4 },
  sub:       { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim, marginBottom: 16, lineHeight: 22 },
  btn:       { backgroundColor: Colors.cta, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.6 },
  btnTxt:    { fontFamily: Font.sansSb, fontSize: Size.body, color: '#fff' },
  voortgang: { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim, textAlign: 'center', marginBottom: 8 },
  tijdTxt:   { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim, textAlign: 'center', marginBottom: 16 },
  leeg:      { backgroundColor: Colors.muted, borderRadius: 12, padding: 16, marginBottom: 16 },
  leegTxt:   { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim, lineHeight: 22 },
  disc:      { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim, marginTop: 24, lineHeight: 18, textAlign: 'center' },

  card:      { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardHC:    { borderColor: Colors.green, borderWidth: 2 },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sym:       { fontFamily: Font.sansBd, fontSize: Size.title, color: Colors.text },
  badge:     { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt:  { fontFamily: Font.sansSb, fontSize: Size.caption },

  rij:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rijLabel:  { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim },
  rijVal:    { fontFamily: Font.monoMd, fontSize: Size.body, color: Colors.text },

  scoreRij:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 4 },
  scoreLabel:{ fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim },
  rsiSmall:  { fontSize: Size.over },
  scoreGetal:{ fontFamily: Font.monoMd, fontSize: Size.caption },
  balk:      { height: 6, backgroundColor: Colors.muted, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  balkVul:   { height: 6, borderRadius: 3 },

  tagsRij:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  tag:       { backgroundColor: Colors.muted, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagTxt:    { fontFamily: Font.sans, fontSize: Size.over, color: Colors.dim },

  infoKnop:  { paddingVertical: 4 },
  infoKnopTxt:{ fontFamily: Font.sans, fontSize: Size.caption, color: Colors.cta },
  infoBlok:  { marginTop: 8, backgroundColor: Colors.muted, borderRadius: 8, padding: 10 },
  infoNaam:  { fontFamily: Font.sansSb, fontSize: Size.caption, color: Colors.text, marginBottom: 2 },
  infoCat:   { fontFamily: Font.sans, fontWeight: '400' as const, color: Colors.dim },
  infoWat:   { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim, lineHeight: 18 },
});
