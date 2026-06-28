import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Font, Size } from '../theme/typography';
import { markeerOnboardingGedaan } from '../storage/storage';

const { width } = Dimensions.get('window');

interface Stap {
  emoji: string;
  titel: string;
  body: string;
  knop: string;
  disclaimer?: boolean;
}

const STAPPEN: Stap[] = [
  {
    emoji: '📊',
    titel: 'Welkom bij Kader',
    body: 'Kader helpt je de crypto-markt te lezen en slimme copy-trade beslissingen te nemen op eToro — zonder ruis, zonder gedoe.\n\nDe app scant dagelijks tientallen coins en geeft je alleen de beste setups.',
    knop: 'Volgende →',
  },
  {
    emoji: '🔍',
    titel: 'Hoe werkt de analyse?',
    body: 'Kader berekent RSI, MACD, EMA en ATR voor elke coin. Op basis hiervan krijg je:\n\n• Een signaal: KOOP of NEUTRAAL\n• Een score van 0–100\n• High Conviction-setups (score ≥ 75 + bevestiging van alle indicatoren)\n\nHoe hoger de score, hoe sterker het setup.',
    knop: 'Volgende →',
  },
  {
    emoji: '🛑',
    titel: 'Altijd een stop loss',
    body: 'Iedere setup heeft een kant-en-klare stop loss en take profit gebaseerd op de ATR (volatiliteit van die coin).\n\nDe Risk/Reward is altijd minimaal 1:2 — je riskeert maximaal de helft van wat je kunt winnen.\n\nZet bij iedere trade de stop loss in eToro in. Zonder stop loss ben je gokker, geen trader.',
    knop: 'Volgende →',
  },
  {
    emoji: '⚠️',
    titel: 'Disclaimer',
    body: 'Kader geeft technische analyses op basis van openbare koersdata. Dit is geen financieel advies.\n\nCrypto is zeer volatiel. Je kunt (een deel van) je inleg verliezen. Investeer alleen geld dat je kunt missen.\n\nControleer altijd zelf de koers op eToro voordat je een order plaatst. De app is een hulpmiddel, geen garantie.',
    knop: 'Ik begrijp het — verder →',
    disclaimer: true,
  },
  {
    emoji: '🚀',
    titel: 'Klaar om te beginnen!',
    body: 'Je vindt de analyses op het Markt-tabblad. Gebruik de Kansen-scan voor speculatieve setups en voeg je eigen posities toe onder Mijn Trades.\n\nSucces — en vergeet nooit de stop loss.',
    knop: 'Start Kader',
  },
];

interface Props {
  onKlaar: () => void;
}

export default function OnboardingScreen({ onKlaar }: Props) {
  const [stapIndex, setStapIndex] = useState(0);
  const stap = STAPPEN[stapIndex];
  const isLaatste = stapIndex === STAPPEN.length - 1;

  async function volgende() {
    if (isLaatste) {
      await markeerOnboardingGedaan();
      onKlaar();
    } else {
      setStapIndex(i => i + 1);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.root}>
        {/* Progress dots */}
        <View style={s.dots}>
          {STAPPEN.map((_, i) => (
            <View key={i} style={[s.dot, i === stapIndex && s.dotActief]} />
          ))}
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.content} bounces={false}>
          <Text style={s.emoji}>{stap.emoji}</Text>
          <Text style={s.titel}>{stap.titel}</Text>
          <Text style={s.body}>{stap.body}</Text>

          {stap.disclaimer && (
            <View style={s.disclaimerBlok}>
              <Text style={s.disclaimerTxt}>Door verder te gaan bevestig je dat je de disclaimer hebt gelezen en begrijpt dat Kader geen financieel adviseur is.</Text>
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.knop, stap.disclaimer && s.knopDisclaimer]}
            onPress={volgende}
            activeOpacity={0.8}
          >
            <Text style={s.knopTxt}>{stap.knop}</Text>
          </TouchableOpacity>
          {stapIndex > 0 && !isLaatste && (
            <TouchableOpacity onPress={() => setStapIndex(i => i - 1)} style={s.terugKnop}>
              <Text style={s.terugTxt}>← Terug</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.bg },
  root:  { flex: 1, paddingHorizontal: 24 },
  dots:  { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 16, paddingBottom: 8 },
  dot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActief: { backgroundColor: Colors.cta, width: 24 },

  scroll:  { flex: 1 },
  content: { paddingTop: 32, paddingBottom: 24 },
  emoji:   { fontSize: 56, textAlign: 'center', marginBottom: 24 },
  titel:   { fontFamily: Font.sansBd, fontSize: Size.display, color: Colors.text, textAlign: 'center', marginBottom: 20, lineHeight: 36 },
  body:    { fontFamily: Font.sans, fontSize: Size.body + 1, color: Colors.dim, lineHeight: 26, textAlign: 'left' },

  disclaimerBlok: {
    marginTop: 20,
    backgroundColor: Colors.amberBg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 14,
  },
  disclaimerTxt: {
    fontFamily: Font.sansMd,
    fontSize: Size.caption,
    color: Colors.amber,
    lineHeight: 20,
  },

  footer:    { paddingBottom: 16, paddingTop: 8 },
  knop:      { backgroundColor: Colors.cta, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  knopDisclaimer: { backgroundColor: Colors.amber },
  knopTxt:   { fontFamily: Font.sansSb, fontSize: Size.body, color: '#fff' },
  terugKnop: { alignItems: 'center', paddingTop: 14 },
  terugTxt:  { fontFamily: Font.sans, fontSize: Size.body, color: Colors.dim },
});
