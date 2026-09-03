import React, { useState } from 'react';
import {
  Modal, ScrollView, View, Text, Pressable, StyleSheet,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Candle } from '../engine/types';
import { useTheme } from '../theme/ThemeProvider';
import { useModalKopruimte } from '../theme/useModalKopruimte';
import { Type } from '../theme/typography';
import { spacing, radii } from '../theme/tokens';
import { useReduceMotion } from '../theme/useReduceMotion';
import { ScoreBadge } from './ScoreBadge';
import { AdviceBadge } from './AdviceBadge';
import { LevelRow } from './LevelRow';
import { MarktBalk } from './MarktBalk';
import { Marktklimaat } from '../engine/marktklimaat';
import { AngstHebzucht } from './AngstHebzucht';
import { PrijsGrafiek } from './PrijsGrafiek';
import { Disclaimer } from './Disclaimer';

interface Props {
  zichtbaar: boolean;
  onSluiten: () => void;
}

// ponytail: vaste demo-reeks in plaats van live data, zodat de uitleg altijd hetzelfde toont
const DEMO_CANDLES: Candle[] = Array.from({ length: 40 }, (_, i) => {
  const close = 100 + i * 0.4 + Math.sin(i / 4) * 6;
  return { open: close - 0.5, high: close + 1, low: close - 1, close, volume: 1000, tijd: Date.now() - (40 - i) * 864e5 };
});

const DEMO_KLIMAAT: Marktklimaat = {
  klimaat: 'ongunstig', btcBovenEma50: false, breedte: 0.28, breedteStijgend: false, btcPrijs: 64000,
};

// Alleen de id's doen ertoe: hieruit komt SectieId. De titels staan erbij als inhoudsopgave voor
// wie dit bestand leest, de getoonde titel komt uit de `titel`-prop van elke Sectie hieronder.
const SECTIES = [
  { id: 'score', titel: 'De Kader-score' },
  { id: 'advies', titel: 'Advieslabels' },
  { id: 'grafiek', titel: 'De prijsgrafiek' },
  { id: 'atr', titel: 'Stop en doel (ATR)' },
  { id: 'indicatoren', titel: 'De indicatoren' },
  { id: 'marktklimaat', titel: 'Het marktklimaat' },
  { id: 'bearmodus', titel: 'Bear-modus (dalende markt)' },
  { id: 'shorts', titel: 'Shorts' },
  { id: 'relatievesterkte', titel: 'Wie houdt stand? en VS BTC' },
  { id: 'blootstelling', titel: 'Blootstelling en afbouwen' },
  { id: 'feargreed', titel: 'Fear & Greed' },
  { id: 'kansscore', titel: 'Kansscore (Grote Kansen)' },
  { id: 'statistieken', titel: 'Portfolio-statistieken' },
  { id: 'oordeel', titel: 'Het trader-oordeel' },
  { id: 'etoro', titel: 'Portfolio importeren uit eToro' },
  { id: 'etorostop', titel: 'Waarom de stop soms opschuift' },
  { id: 'prijsalerts', titel: 'Prijsalerts' },
] as const;

type SectieId = typeof SECTIES[number]['id'];

export function AchtergrondScherm({ zichtbaar, onSluiten }: Props) {
  const { colors } = useTheme();
  const extraKopruimte = useModalKopruimte();
  const reduceMotion = useReduceMotion();
  const [open, setOpen] = useState<SectieId | null>(null);

  function wisselOpen(id: SectieId) {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpen(v => (v === id ? null : id));
  }

  if (!zichtbaar) return null;

  return (
    <Modal visible={zichtbaar} animationType="slide" onRequestClose={onSluiten} presentationStyle="fullScreen">
      <SafeAreaView style={[styles.root, { backgroundColor: colors.achtergrond }]}>
        <View style={[styles.header, { borderBottomColor: colors.rand, paddingTop: spacing.base + extraKopruimte }]}>
          <Text style={[Type.titel, { color: colors.tekstPrimair }]}>Informatie</Text>
          <Pressable
            onPress={onSluiten}
            style={styles.sluitKnop}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
            hitSlop={8}
          >
            <X size={22} color={colors.tekstGedimd} strokeWidth={1.75} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[Type.body, styles.intro, { color: colors.tekstGedimd }]}>
            Hoe rekent Kader? Hieronder staat per weergave in de app hoe die tot stand komt.
          </Text>

          <Sectie id="score" titel="De Kader-score" open={open === 'score'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              De score van 0 tot 100 is een optelsom van technische signalen: EMA20 boven EMA50 (opwaartse trend) telt
              25 punten, koers boven EMA20 telt 15 punten, een gezonde RSI tussen 45 en 68 telt 20 punten (RSI onder
              35, mogelijk herstel, telt 10 punten), een bullish MACD telt 20 punten (met 5 punten extra bij een
              positief histogram), en een volumepiek van minstens 1,5 keer het gemiddelde telt 15 punten (1,2 keer
              telt 8 punten). Vanaf een score van 55 krijgt een coin het signaal KOOP.
            </Text>
            <View style={styles.badgeRij}>
              <ScoreBadge score={25} />
              <ScoreBadge score={55} />
              <ScoreBadge score={80} />
            </View>
          </Sectie>

          <Sectie id="advies" titel="Advieslabels" open={open === 'advies'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              AFWACHTEN betekent geen koopsignaal. KOOPZONE betekent score 55 of hoger. STERK KOOP betekent score 72
              of hoger. HIGH CONVICTION is de sterkste combinatie: score 75 of hoger, samen met een stijgende trend,
              een bullish MACD en een volume van minstens 1,3 keer het gemiddelde. Werkt het marktklimaat niet mee
              (zie hieronder), dan valt elk koopsignaal terug op AFWACHTEN, ongeacht de score.
            </Text>
            <View style={styles.badgeRij}>
              <AdviceBadge advies="AFWACHTEN" />
              <AdviceBadge advies="KOOPZONE" />
              <AdviceBadge advies="STERK KOOP" />
              <AdviceBadge advies="HIGH CONVICTION" />
            </View>
          </Sectie>

          <Sectie id="grafiek" titel="De prijsgrafiek" open={open === 'grafiek'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              De grafiek toont de laatste koersen als lijn: groen als de koers over de weergegeven periode is
              gestegen, rood als die is gedaald. De stippellijnen zijn de STOP (rood), ENTRY (blauw) en DOEL (groen)
              van een trade. Sleep met je vinger over de grafiek voor de exacte datum en koers op dat punt.
            </Text>
            <PrijsGrafiek
              candles={DEMO_CANDLES}
              toonPeriodes={false}
              niveaus={[
                { waarde: 85, kleur: colors.verlies },
                { waarde: 100, kleur: colors.cta },
                { waarde: 130, kleur: colors.winst },
              ]}
            />
          </Sectie>

          <Sectie id="atr" titel="Stop en doel (ATR)" open={open === 'atr'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              ATR (14) meet de gemiddelde dagbeweging van een coin over de laatste 14 candles. De stop-loss ligt net
              onder het laagste punt van de laatste tien candles (de recente steun), begrensd tussen 0,5 en 3 keer de
              ATR zodat hij niet te krap of te ruim komt te liggen. Het doel ligt op 3 keer de ATR boven de entry.
              De verhouding risico/beloning verschilt daardoor per coin; bij minder dan 2 vervalt het signaal helemaal.
              De entry-zone ligt op plus of min 0,2 keer de ATR rond de entryprijs.
            </Text>
            <LevelRow stop={85} entry={100} doel={130} />
          </Sectie>

          <Sectie id="indicatoren" titel="De indicatoren" open={open === 'indicatoren'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              RSI (14) meet of een coin recent overwegend is gestegen of gedaald, op een schaal van 0 tot 100. EMA20
              en EMA50 zijn voortschrijdende gemiddelden over 20 en 50 candles; ligt de korte boven de lange, dan is
              de trend opwaarts. MACD (12/26/9) volgt het verschil tussen twee EMA's om te zien of het momentum
              versnelt of afzwakt. ATR (14) meet de gemiddelde dagbeweging en bepaalt de stop en het doel. Het
              volumecijfer vergelijkt de laatste candle met het gemiddelde volume van de afgelopen 20 candles.
            </Text>
          </Sectie>

          <Sectie id="marktklimaat" titel="Het marktklimaat" open={open === 'marktklimaat'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Het marktklimaat kijkt naar twee dingen: staat Bitcoin boven zijn eigen 50-daags gemiddelde, en stijgt
              het aandeel coins in het universum dat boven zijn eigen 50-daags gemiddelde staat (de marktbreedte)?
              Zijn beide gunstig, dan is het klimaat GUNSTIG. Zijn beide ongunstig, dan is het ONGUNSTIG, anders
              GEMENGD. Uit een negen jaar durende meting over de historie bleek dat koopsignalen in een ongunstig
              klimaat (zoals 2018, 2022 en begin 2026) gemiddeld geld verloren, ook als de score hoog was. Daarom
              toont Kader in dat klimaat geen enkel KOOP-signaal meer, hoe sterk een coin er los van staat ook uitziet.
            </Text>
            <MarktBalk klimaat={DEMO_KLIMAAT} />
          </Sectie>

          <Sectie id="bearmodus" titel="Bear-modus (dalende markt)" open={open === 'bearmodus'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Zodra het marktklimaat ONGUNSTIG wordt, schakelt Kader over op bear-modus. Het vak "Wat moet ik nu
              kopen?" bovenaan het marktscherm maakt dan plaats voor een vak dat vertelt wat er aan de hand is, hoe
              lang dat al zo is, en wat bitcoin sindsdien gedaan heeft. Dat laatste cijfer staat er met opzet bij:
              niet kopen voelt als niets doen, maar in een markt die 18% daalt is niet kopen een resultaat.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Wat Kader in die modus níet doet, is zijn drempels verlagen om toch iets te kunnen tonen. De score, de
              minimale risk/reward van 1:2 en de klimaatpoort blijven precies zoals ze zijn. De analyse per coin blijft
              gewoon zichtbaar in de lijst, alleen zonder koopsignaal. Wat er wel bijkomt is de lijst "Wie houdt stand?"
              op het marktscherm, en per open positie een advies over afbouwen in Mijn trades.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              De dagenteller loopt vanaf het moment dat Kader het ongunstige klimaat voor het eerst zag, niet vanaf het
              begin van de daling. Open je de app een maand niet, dan begint de teller dus later. Je krijgt ook een
              pushmelding zodra het klimaat omslaat, in beide richtingen: als de bear-modus aangaat, en als hij weer
              voorbij is.
            </Text>
          </Sectie>

          <Sectie id="shorts" titel="Shorts" open={open === 'shorts'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Een short verdient geld als de koers daalt in plaats van stijgt. Je opent 'm door de coin
              te verkopen zonder 'm te bezitten en sluit 'm af door 'm terug te kopen; het verschil
              tussen die twee prijzen is je resultaat. De niveaus liggen daarom gespiegeld ten opzichte
              van een gewone trade: de stop-loss ligt boven de entry, het doel eronder.
            </Text>
            <LevelRow stop={118} entry={100} doel={82} richting="short" />
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Kader toont short-signalen alleen zolang het marktklimaat ONGUNSTIG is, en alleen voor
              coins met een score onder de 40: hoe zwakker het momentum, hoe sterker het short-signaal.
              Diezelfde score, dezelfde 0 tot 100, alleen omgekeerd gelezen. Gemeten over negen jaar
              Binance-historie leverden shorts op die drempel in alle vier de dalende jaren geld op
              (2018, 2022, 2025 en het lopende 2026) en verloren ze juist in de stijgende jaren. Daarom
              zit er een klimaatpoort voor: buiten een ongunstig klimaat toont Kader nooit een short.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Het doel ligt op 2 keer de ATR onder de entry, de stop op dezelfde swing-structuur als bij
              een gewone trade maar dan gespiegeld: net boven de recente weerstand. Ook hier geldt de
              minimale verhouding van 1:2 tussen risico en beloning, dus alleen coins die daaraan
              voldoen krijgen het signaal.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Bij eToro kan een crypto-short alleen als CFD, maar wel op dezelfde hefboom x1 als een
              gewone koop: Kader rekent nergens met hefboom, ook niet bij een short. eToro staat voor
              een short wel een krappere stop toe dan bij een koop (gemeten: maximaal 50% van je inleg
              tegen 100% bij een koop), en Kader toetst je stop tegen precies die grens voordat de order
              de deur uitgaat.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Zoals bij elk signaal in Kader: dit is een technische uitkomst van de analyse, geen
              financieel advies. Check altijd de actuele koers op eToro voor je een order plaatst.
            </Text>
          </Sectie>

          <Sectie id="relatievesterkte" titel="Wie houdt stand? en VS BTC" open={open === 'relatievesterkte'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Deze lijst staat op het marktscherm zodra het klimaat niet gunstig is. Hij toont per coin het rendement
              over 30 dagen min het rendement van bitcoin over diezelfde 30 dagen, in procentpunten. Staat er +8 pt,
              dan deed die coin het 8 procentpunten beter dan bitcoin, ook als hij zelf gedaald is.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Waarom dit los van de gewone score staat: de Kader-score beloont trend, momentum en volume. In een
              dalende markt daalt alles en scoort dus alles laag, waardoor die score bijna geen onderscheid meer maakt.
              Relatieve sterkte maakt dat onderscheid wel. Coins die minder hard dalen hebben kopers die blijven zitten,
              en dat zijn doorgaans de coins die als eerste omhoog gaan als de markt draait.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Het is uitdrukkelijk geen koopsignaal. Er hangt geen entry, stop of doel aan, en de sterkste coin van een
              dalende markt kan gewoon blijven dalen. Zie het als een lijst om te volgen, niet om vandaag iets mee te
              doen. Het cijfer telt ook niet mee in de 0-100 score: die is met de backtest gekalibreerd, en er een
              ongemeten onderdeel in mengen zou alle drempels stilzwijgend verschuiven.
            </Text>
            <Text style={[Type.sectiekop, styles.subkop, { color: colors.tekstPrimair }]}>
              Hetzelfde cijfer bij een koopsignaal: VS BTC
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Datzelfde getal staat sinds kort bij elke coin op het marktscherm, als VS BTC, en op het
              coin-detailscherm als 30D VS BTC. Daar betekent het iets anders dan in de lijst hierboven, en het is
              gemeten: over negen jaar en 3251 trades deden koopsignalen op coins die waren ACHTERGEBLEVEN op bitcoin
              het duidelijk beter dan dezelfde signalen op coins die bitcoin al ver voorbij waren gelopen.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Achterblijvers leverden gemiddeld +0,17 op, voorlopers -0,03, en die helling loopt netjes door: hoe
              verder achter, hoe beter. De uitleg erachter is simpel. Een koopsignaal eist al een stijgende trend en
              positief momentum. Een coin die daar bovenop ook nog eens 25 procent harder is gestegen dan bitcoin in
              een maand, heeft het makkelijke deel gehad. Dezelfde coin die juist achterbleef is een terugval binnen
              een opgaande trend, en dat is precies waar je wil instappen.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Het cijfer is met opzet neutraal gekleurd en filtert niets weg. Een achterblijver is gunstig om IN te
              stappen, maar het is geen coin die het goed doet, en een groen cijfer zou dat laatste beweren. Of het
              alsnog een echte regel wordt (bijvoorbeeld: coins die meer dan 25 procent voorliggen nooit meer als
              KOOP tonen) is een keuze die nog gemaakt moet worden.
            </Text>
          </Sectie>

          <Sectie id="blootstelling" titel="Blootstelling en afbouwen" open={open === 'blootstelling'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Op het scherm Mijn trades staat hoeveel van je kapitaal er in de markt zit, afgezet tegen wat bij het
              huidige klimaat past: geen plafond bij een gunstig klimaat, de helft bij gemengd, een vijfde bij
              ongunstig. Dat plafond is een risicorichtlijn en geen uitkomst van de backtest. Die meet losse trades en
              kan dus niets zeggen over hoeveel geld er in totaal in de markt hoort te staan. De redenering erachter is
              wel dezelfde: in een klimaat waarin koopsignalen gemiddeld geld verloren, hoort er minder geld in te
              staan.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Het percentage verschijnt alleen als je zelf je handelskapitaal invult, want zonder dat bedrag is er geen
              noemer en zou elk percentage verzonnen zijn. Dat bedrag blijft op je telefoon en gaat nergens heen. Zit je
              boven het plafond, dan is dat geen verkoopopdracht: het is een cijfer om naar te kijken voordat je iets
              bijkoopt. Posities waarvan Kader het aantal munten of de live koers niet kent tellen niet mee, en dat
              staat er dan bij.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Per open positie kan er daarnaast een advies onder de trade staan. Staat een coin in winst maar is hij
              onder zijn eigen 50-daags gemiddelde gezakt terwijl de markt daalt, dan is dat het geval waarin winst het
              vaakst weer wordt teruggegeven, en stelt Kader voor om (deels) winst te nemen of de stop op te trekken
              naar break-even of één ATR onder de koers. Staat een coin onder je entry én onder dat gemiddelde, dan is
              het advies juist om niets te doen: je stop niet verlagen en niet bijkopen om je gemiddelde te drukken.
              Houdt een coin stand terwijl de rest daalt, dan zegt Kader dat er niets hoeft te gebeuren. Is er niets
              bijzonders, dan staat er ook niets: een zin die altijd verschijnt leert je alleen om hem over te slaan.
            </Text>
          </Sectie>

          <Sectie id="feargreed" titel="Fear & Greed" open={open === 'feargreed'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              De Fear & Greed-index (0 tot 100) komt van Alternative.me en meet het algemene marktsentiment, los van
              de Kader-score. Een waarde van 45 of lager is angst (rood), 55 of hoger is hebzucht (groen), daartussen
              is neutraal.
            </Text>
            <AngstHebzucht waarde={28} klasse="Fear" />
          </Sectie>

          <Sectie id="kansscore" titel="Kansscore (Grote Kansen)" open={open === 'kansscore'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Grote Kansen scant een breder aanbod aan coins op basis van marktdata van CoinGecko in plaats van
              candle-indicatoren. De kansscore telt op: 7-daagse koersverandering keer 1,2, 30-daagse verandering keer
              0,5, de verhouding volume/marktcap (tot 25 punten), de afstand onder de all-time high, en een
              rank-bonus. Een stijging van meer dan 35% in 24 uur levert juist een straf van 25 punten op
              (oververhitting), tussen 20 en 35% een straf van 10 punten. Alleen coins met marktcap-rang 12 tot 260,
              minstens 15 miljoen dollar 24-uurs volume en geen stablecoins komen mee. Stop en doel komen uit ATR
              als er candle-data beschikbaar is, anders geldt de richtlijn min 12,5% / plus 25%.
            </Text>
          </Sectie>

          <Sectie id="statistieken" titel="Portfolio-statistieken" open={open === 'statistieken'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Het trefferpercentage is het aandeel gesloten trades dat is gewonnen. De gemiddelde behaalde R/R is
              (exitprijs min entry) gedeeld door (entry min stop). Het totaal resultaat telt alle gesloten trades bij
              elkaar op. Bij het sluiten van een trade vraagt de app tegen welke prijs je hebt verkocht: de take-profit
              of stop-loss zijn voorgevuld, maar je kunt de werkelijke verkoopprijs invullen zodat het behaalde
              resultaat klopt.
            </Text>
          </Sectie>

          <Sectie id="oordeel" titel="Het trader-oordeel" open={open === 'oordeel'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Het totaaloordeel over een trader weegt drie deelscores: 35% consistentie, 40% risicobeheer en 25%
              portfoliospreiding. Vanaf 70 punten is het oordeel GROEN, vanaf 50 GEEL, daaronder ROOD. De aanbevolen
              Copy Stop Loss is afgeleid van de maximale drawdown van de trader en wordt afgerond op een veelvoud van
              5 procent.
            </Text>
          </Sectie>

          <Sectie id="etoro" titel="Portfolio importeren uit eToro" open={open === 'etoro'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Kader kan je open crypto-posities rechtstreeks bij eToro ophalen via hun officiële API.
              Wat de koppeling mag, bepaalt je sleutel: met een Read-sleutel kijkt Kader alleen mee,
              met een Write-sleutel kan Kader ook kopen, verkopen en je stop-loss of doel aanpassen,
              maar altijd pas nadat jij die order zelf bevestigt. Kader kan nooit geld overmaken of je
              eToro-instellingen wijzigen. Je sleutels staan alleen op je eigen toestel, in de
              beveiligde opslag.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Zo stel je hem in: log in op eToro (web) en ga naar Settings, dan Trading, dan API Key
              Management. Maak een sleutel aan (Read om alleen te importeren, Write om ook te kunnen
              handelen) en bevestig met de sms-code op je telefoon. Je kiest daarbij geen omgeving:
              dezelfde sleutel werkt voor demo en voor echt. De User Key krijg je maar één keer te
              zien, dus kopieer hem meteen. Plak de sleutels daarna in Kader onder Instellingen, bij
              "eToro-sleutel demo" of "eToro-sleutel echt". Ga daarna naar de portfolio-tab en druk op
              "Importeer uit eToro".
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Onder Instellingen staat ook de schakelaar tussen demo en echt. Kader start in demo:
              orders gaan dan naar je oefenaccount bij eToro. Zolang demo actief is staat er een oranje
              DEMO-label bovenin het scherm. Overschakelen naar echt vraagt eerst een bevestiging.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Alleen crypto-posities komen mee; aandelen en ETF's worden overgeslagen. Heb je bij een
              positie op eToro geen stop-loss of take-profit ingesteld, dan importeert Kader die
              positie zonder die niveaus. Je kunt ze daarna gewoon aanvullen via het bewerk-formulier.
              Een tweede import werkt je bestaande eToro-posities bij in plaats van dat hij ze
              dubbel toevoegt.
            </Text>
          </Sectie>

          <Sectie id="etorostop" titel="Waarom de stop soms opschuift" open={open === 'etorostop'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Kader zet zijn stop-loss net onder de laatste steun in de koers, en begrenst die afstand op een halve
              tot drie keer de ATR. Dat is een niveau dat volgt uit de grafiek. eToro werkt anders: die eist per coin
              een minimale en maximale afstand tussen je aankoopprijs en je stop, als percentage. Voor bitcoin is dat
              minimaal 10 procent.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Die twee botsen vaker wel dan niet: de stop van Kader ligt meestal binnen de 10 procent. Ligt jouw
              niveau buiten wat eToro accepteert, dan schuift Kader het op naar de dichtstbijzijnde waarde die eToro
              wel neemt, en zet er een klein ETORO-merkje bij het STOP-label. Zo staat er nergens in de app een
              niveau dat je niet kunt invoeren.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Let op wat dat met de verhouding tussen risico en opbrengst doet. Een stop die van 3 naar 10 procent
              schuift verdrievoudigt je risico terwijl het doel blijft staan, en dan kan een coin met een prachtige
              score alsnog onder de 1:2 zakken. Die verhouding staat er daarom bij, en oranje als hij de drempel niet
              haalt. Dat is geen fout in de berekening: dat is wat de trade werkelijk waard is bij eToro.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Zonder eToro-koppeling weet Kader die grenzen niet en verandert er niets: je ziet dan gewoon het niveau
              dat Kader zelf berekende. Een verzonnen grens is erger dan geen grens. Laat eToro de stop voor een coin
              helemaal niet instellen, dan staat het niveau er als "STOP (KADER)": dat is dan het niveau om zelf in de
              gaten te houden, niet iets om bij eToro in te vullen.
            </Text>
          </Sectie>

          <Sectie id="prijsalerts" titel="Prijsalerts" open={open === 'prijsalerts'} onToggle={wisselOpen}>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Het belletje bovenin een coinscherm laat je zelf een prijs kiezen. Kader stuurt een melding zodra de
              koers daar is. Dit is het enige plek in de app waar jij het niveau bepaalt: al het andere komt uit de
              analyse.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Of het een boven- of een onder-alert wordt, bepaalt Kader op het moment dat je hem instelt, aan de hand
              van de koers van dat moment. Ligt je prijs erboven, dan is het "boven"; eronder, dan "onder". Dat ligt
              daarna vast. Zou de richting later opnieuw uit de koers worden afgeleid, dan draaide hij om zodra de
              koers erlangs ging en zou de alert nooit afgaan.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Een alert gaat precies één keer af en blijft daarna in de lijst staan, met de koers waarop hij afging.
              Dat is met opzet: een koers die rond jouw niveau schommelt zou anders elke ronde opnieuw melden. Wil je
              hem opnieuw, zet hem dan zelf opnieuw. Je wachtende alerts staan bij elkaar onder Meldingen, en er
              kunnen er twintig tegelijk openstaan.
            </Text>
            <Text style={[Type.body, styles.tekst, { color: colors.tekstPrimair }]}>
              Kader kijkt elke paar minuten terwijl de app openstaat, en daarbuiten via een achtergrondtaak. Android
              bepaalt zelf wanneer die draait en houdt een ondergrens van een kwartier aan, dus een alert kan met een
              vertraging binnenkomen. Staan je meldingen uit onder Instellingen, dan komt er ook geen prijsalert
              doorheen; je alerts blijven dan gewoon wachten tot je het weer aanzet.
            </Text>
          </Sectie>

          <Text style={[Type.caption, styles.slotnoot, { color: colors.tekstGedimd }]}>
            Deze uitleg beschrijft hoe de app rekent. Geen financieel advies.
          </Text>
        </ScrollView>

        <Disclaimer />
      </SafeAreaView>
    </Modal>
  );
}

function Sectie({
  titel, open, onToggle, id, children,
}: {
  id: SectieId;
  titel: string;
  open: boolean;
  onToggle: (id: SectieId) => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectie, { borderColor: colors.rand }]}>
      <Pressable
        onPress={() => onToggle(id)}
        style={styles.sectieKop}
        accessibilityRole="button"
        accessibilityLabel={titel}
        accessibilityState={{ expanded: open }}
      >
        <Text style={[Type.sectiekop, { color: colors.tekstPrimair }]}>{titel}</Text>
        {open
          ? <ChevronUp size={18} color={colors.tekstGedimd} strokeWidth={1.75} />
          : <ChevronDown size={18} color={colors.tekstGedimd} strokeWidth={1.75} />}
      </Pressable>
      {open && <View style={styles.sectieInhoud}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sluitKnop: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', marginTop: -spacing.xs },
  scroll: { paddingBottom: spacing.xl },
  intro: { paddingHorizontal: spacing.base, paddingTop: spacing.base, paddingBottom: spacing.sm, lineHeight: 20 },
  sectie: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.kaart,
    overflow: 'hidden',
  },
  sectieKop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    minHeight: 44,
  },
  sectieInhoud: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    gap: spacing.md,
  },
  tekst: { lineHeight: 21 },
  subkop: { marginTop: spacing.sm },
  badgeRij: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  slotnoot: { paddingHorizontal: spacing.base, paddingTop: spacing.md, textAlign: 'center' },
});
