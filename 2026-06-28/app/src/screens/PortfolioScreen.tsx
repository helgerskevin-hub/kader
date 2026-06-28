import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Font, Size } from '../theme/typography';

// Full implementation comes in the "Mijn Trades" screen build task.
// Placeholder keeps navigation working while engine is verified first.
export default function PortfolioScreen() {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.title}>Mijn Trades</Text>
        <Text style={s.sub}>Volg je open posities met live prijs en een HOUD / VERKOOP / WINST-advies.</Text>
        <View style={s.leeg}>
          <Text style={s.leegTxt}>Scherm in aanbouw — voeg trades toe zodra dit scherm volledig is.</Text>
        </View>
        <Text style={s.disc}>Geen financieel advies. Controleer altijd de live koers op eToro voordat je een order plaatst.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title:   { fontFamily: Font.sansBd, fontSize: Size.title, color: Colors.text, marginBottom: 4 },
  sub:     { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim, marginBottom: 16, lineHeight: 22 },
  leeg:    { backgroundColor: Colors.muted, borderRadius: 12, padding: 20, alignItems: 'center' },
  leegTxt: { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim, textAlign: 'center', lineHeight: 22 },
  disc:    { fontFamily: Font.sans, fontSize: Size.caption, color: Colors.dim, marginTop: 24, lineHeight: 18, textAlign: 'center' },
});
