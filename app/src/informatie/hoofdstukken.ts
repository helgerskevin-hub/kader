// Alle teksten van het scherm Informatie staan in dit ene bestand. Dit is de plek om ze te lezen,
// na te lopen en te verbeteren: een tekst aanpassen vraagt nooit een wijziging in de code, alleen
// hier. Elk getal hoort te kloppen met wat de app echt doet (zie de verwijzingen naar engine/ en
// state/ in de reviewnotities), dus verander je een drempel in de code, pas dan ook de tekst hier aan.
//
// Opbouw per hoofdstuk:
//   kort    de regel onder de titel in de lijst
//   zie     wat je op het scherm ziet
//   reken   hoe Kader het berekent
//   doe     wat je ermee doet
//   detail  losse feiten, als opsomming onder het hoofdstuk (mag leeg zijn)
//   icoon   naam van een lucide-react-native-icoon
//
// Taalregels: Nederlands, sober, geen gedachtestreepjes. Het woord "kader" (klein, als beeld) komt
// alleen voor in de drie vaste app-zinnen, en dan tussen aanhalingstekens: "In het kader",
// "Binnen je kader" / "nadert de rand van je kader" en "Het kader van vandaag staat klaar".

export type InfoGroep = 'signalen' | 'markt' | 'portfolio' | 'handelen';

export interface Hoofdstuk {
  id: string;
  groep: InfoGroep;
  titel: string;
  kort: string;
  zie: string;
  reken: string;
  doe: string;
  detail: string[];
  nieuw?: boolean;
  // Naam van een component uit lucide-react-native, bijvoorbeeld 'Gauge'.
  icoon: string;
}

export const GROEPEN: { id: InfoGroep; titel: string }[] = [
  { id: 'signalen', titel: 'Signalen' },
  { id: 'markt', titel: 'Markt' },
  { id: 'portfolio', titel: 'Portfolio' },
  { id: 'handelen', titel: 'Handelen' },
];

export const HOOFDSTUKKEN: Hoofdstuk[] = [
  // ---------- Signalen ----------
  {
    id: 'score',
    groep: 'signalen',
    titel: 'De Kader-score',
    icoon: 'Gauge',
    kort: 'Hoe sterk een coin er technisch voor staat, van 0 tot 100.',
    zie: 'Elke coin op Markt krijgt een score van 0 tot 100. Hoe hoger, hoe meer technische signalen tegelijk gunstig staan.',
    reken: 'Kader telt vijf onderdelen op: een stijgende trend, een koers boven het 20-daags gemiddelde, een gezonde RSI, een positieve MACD en een volumepiek. Elk onderdeel levert een vast aantal punten, samen maximaal 100.',
    doe: 'De score vat samen wat technisch gunstig staat. Een koopsignaal hangt er op dit moment niet aan: na de kosten van eToro bleek een hoge score niet aantoonbaar beter te kiezen dan een willekeurige coin op dezelfde dag. Zie Advieslabels. Klap een kaart op Markt uit om te zien wat meetelt.',
    detail: [
      'Trend (EMA20 boven EMA50): 25 punten',
      'Koers boven EMA20: 15 punten',
      'RSI tussen 45 en 68: 20 punten; RSI onder 35: 10 punten',
      'MACD boven de signaallijn: 20 punten, plus 5 als het histogram oploopt',
      'Volume minstens 1,5x het gemiddelde: 15 punten; minstens 1,2x: 8 punten',
    ],
  },
  {
    id: 'advies',
    groep: 'signalen',
    titel: 'Advieslabels',
    icoon: 'BadgeCheck',
    kort: 'Waarom er nu AFWACHTEN staat, en wanneer een kooplabel terugkomt.',
    zie: 'Op dit moment staat elke coin op AFWACHTEN. De labels KOOPZONE en STERK KOOP en het keurmerk BEVESTIGD toont Kader pas weer als ze zich na kosten bewezen hebben.',
    reken: 'Kader heeft de labels in november 2026 opnieuw gemeten, met de kosten van eToro erbij (1% bij kopen, 1% bij verkopen) en op jaren die bij het afstellen niet gebruikt waren. Een koopsignaal (score 55 of hoger bij een gunstig klimaat) hield met het plan van de kaart gemiddeld +0,11 R per trade over, maar dat is niet aantoonbaar meer dan nul. STERK KOOP en BEVESTIGD kozen niet beter dan gewone koopsignalen.',
    doe: 'Kopen kan altijd, met de knop Koop en het plan van de kaart. Kader zegt er alleen niet bij dat dit een goed moment is, omdat dat niet bewezen is. In Signaalresultaat loopt het trackrecord door. Haalt een label daar of in een nieuwe meting zijn lat, dan komt het terug.',
    detail: [
      'De drempels van voorheen: KOOPZONE vanaf score 55, STERK KOOP vanaf 72, BEVESTIGD vanaf 75 met trend, MACD en volume',
      'Die drempels kleuren nog de score en voeden het trackrecord, maar staan niet meer als advies op de kaart',
      'De lat voor een label: na kosten aantoonbaar boven nul, in minstens 3 van de 4 toetsjaren',
      'Met het oude plan (stop onder het laagste punt van tien dagen) verloor een koopsignaal na kosten gemiddeld 0,14 R per trade',
    ],
  },
  {
    id: 'r',
    groep: 'signalen',
    titel: 'Wat betekent R?',
    icoon: 'Ruler',
    nieuw: true,
    kort: 'De maat voor winst en verlies: hoeveel keer je risico.',
    zie: 'Bij signalen, in Signaalresultaat en in Historie staan getallen als +0,11 R, +2 R of -1 R. De R staat voor risico: het bedrag dat je kwijt bent als je stop geraakt wordt.',
    reken: 'Een voorbeeld. Je koopt voor 200 euro en je stop ligt 10% lager. Raakt de koers je stop, dan ben je 20 euro kwijt. Die 20 euro is 1 R. Verkoop je met 40 euro winst, dan is dat +2 R: twee keer wat je riskeerde. Raakt de koers je stop, dan is dat -1 R.',
    doe: 'Met R vergelijk je trades eerlijk, hoe groot of klein ze ook zijn. Een gemiddelde van +0,11 R per trade betekent: elke trade hield gemiddeld 11% van zijn risico over, winst en verlies door elkaar. Riskeer je 20 euro per trade, dan is dat ongeveer 2,20 euro per trade. Dat is weinig, en zo weinig dat het ook toeval kan zijn. Daarom zegt Kader er dan bij: niet aantoonbaar meer dan nul.',
    detail: [
      '+1 R: je won evenveel als je riskeerde',
      '-1 R: je stop is geraakt en je bent je risico kwijt',
      '0 R: je speelde quitte',
      'R/R 1 : 3 op een kaart: het doel ligt drie keer zo ver van de koers als de stop. Haalt de koers het doel, dan is dat +3 R',
      'Na kosten: de 1% die eToro bij kopen en bij verkopen rekent is er al af',
      'Niet aantoonbaar meer dan nul: het gemiddelde is klein en wisselt sterk per periode, dus het kan ook toeval zijn',
    ],
  },
  {
    id: 'atr',
    groep: 'signalen',
    titel: 'Stop en doel',
    icoon: 'Shield',
    kort: 'Waar de stop-loss en het doel liggen, en waarom.',
    zie: 'Bij elke coin staan drie niveaus: de stop (waar je eruit gaat als het tegenzit), de entry en het doel.',
    reken: 'De stop ligt drie keer de gemiddelde dagbeweging (de ATR) onder de koers van nu. Het doel ligt op drie keer dat risico. Dat is ruim: de stop ligt vaak 15 tot 25% onder de koers.',
    doe: 'De ruime stop is er om de kosten. eToro rekent 1% bij kopen en 1% bij verkopen; bij een krappe stop is die 2% een groot deel van je risico. Bij hetzelfde risico per trade koop je met een ruime stop een kleinere positie. De R/R is 1 : 3, tenzij eToro een nog ruimere stop eist.',
    detail: [
      'ATR (14): gemiddelde dagbeweging over 14 dagen',
      'Stop: 3x ATR onder de koers van nu',
      'Doel: drie keer het risico boven de koers van nu',
      'Entry-zone: entry plus of min 0,2x ATR',
      'Tot november 2026 lag de stop onder het laagste punt van tien dagen; met de kosten erbij verloor dat plan gemiddeld geld',
    ],
  },
  {
    id: 'etorostop',
    groep: 'signalen',
    titel: 'Waarom de stop soms opschuift',
    icoon: 'ShieldAlert',
    kort: 'eToro eist een minimale afstand voor je stop.',
    zie: 'De stop die Kader toont is altijd een niveau dat eToro accepteert. Ligt Kaders eigen stop te krap of te ver, dan staat er meteen de stop die je bij eToro echt kunt zetten.',
    reken: 'eToro eist per coin een minimale en maximale afstand tussen je stop en een referentieprijs. Voor bitcoin is dat minimaal 10%. Bij een nieuwe kooporder is die referentie je aankoopprijs; bij het wijzigen van de stop van een lopende koop-positie is het de huidige koers. Ligt de stop van Kader buiten die grenzen, dan schuift hij naar de dichtstbijzijnde grens van eToro.',
    doe: 'Een verdere stop betekent meer risico bij hetzelfde doel. Zakt de R/R daardoor onder 1 : 2, dan kleurt de R/R oranje en zegt de uitgeklapte kaart het erbij. Op Kansen schuift de stop op dezelfde manier op en zakt de R/R mee. Staat je positie ver genoeg in winst, dan kun je in het stopvenster een stop boven je aankoopprijs zetten, zolang hij minstens het minimum onder de koers blijft (bij bitcoin 10%). Dat kan in demo en in je echte account.',
    detail: [
      'Werkt alleen met een eToro-koppeling; zonder koppeling blijft de eigen stop van Kader staan',
      'Laat eToro voor een coin geen stop toe, dan staat er STOP (KADER): een niveau om zelf in de gaten te houden',
      'Kader bewaart de grenzen van eToro een dag',
      'Bij een lopende koop-positie meet Kader de minimale afstand vanaf de huidige koers, bij een nieuwe kooporder vanaf je aankoopprijs',
    ],
  },
  {
    id: 'indicatoren',
    groep: 'signalen',
    titel: 'De indicatoren',
    icoon: 'Activity',
    kort: 'RSI, EMA, MACD en volume in gewone taal.',
    zie: 'Op het coinscherm staan vier indicatoren: RSI, trend, MACD en volume. Elk meet iets anders.',
    reken: 'RSI meet of een coin de laatste tijd vooral steeg of daalde. EMA20 en EMA50 zijn de gemiddelde koersen over 20 en 50 dagen; ligt de korte boven de lange, dan stijgt de trend. MACD laat zien of die beweging versnelt of afzwakt. Volume vergelijkt de handel van de laatste dag met het gemiddelde van de 20 dagen ervoor.',
    doe: 'Geen van de vier is op zichzelf een reden om te kopen. De Kader-score telt ze samen.',
    detail: [
      'RSI (14): boven 70 oververhit, onder 30 sterk verkocht',
      'EMA20 boven EMA50: opwaartse trend',
      'MACD (12/26/9): histogram dat oploopt betekent versnellend momentum',
      'Volume: laatste dag gedeeld door het gemiddelde van de 20 dagen ervoor',
    ],
  },
  {
    id: 'grafiek',
    groep: 'signalen',
    titel: 'De prijsgrafiek',
    icoon: 'ChartSpline',
    kort: 'De lijn, de niveaus en vasthouden om te lezen.',
    zie: 'De grafiek toont de koers over de gekozen periode: groen als hij in die periode steeg, rood als hij daalde. Kies je in Instellingen bij Grafiek voor Candles, dan staat er per dag of uur een candle met open, hoog, laag en slot: hol als de koers steeg, gevuld als hij daalde.',
    reken: 'De stippellijnen zijn de stop (rood), de entry (blauw) en het doel (groen). Met 1M, 3M, 6M en Alles kies je de periode; een periode waarvoor te weinig koershistorie is, staat er niet bij.',
    doe: 'Houd je vinger stil op de grafiek of schuif er zijwaarts overheen: je ziet de datum en de koers van elk punt. Op de hoogste en laagste koers voel je een tik.',
    detail: [],
  },

  // ---------- Markt ----------
  {
    id: 'marktanalyse',
    groep: 'markt',
    titel: 'Zo komt de analyse tot stand',
    icoon: 'ChartCandlestick',
    nieuw: true,
    kort: 'Van 148 coins naar de lijst op Markt, stap voor stap.',
    zie: 'De lijst op Markt toont standaard de 20 coins die er na de analyse het best voor staan, met je favorieten erbij. Met één tik zie je alle geanalyseerde coins. Elke coin heeft een score, een label en drie niveaus: entry, stop en doel.',
    reken: 'Kader kijkt naar 148 coins: allemaal koopbaar op eToro en met een USDT-paar op Binance. Het marktklimaat rekent op de 57 coins waarop het gemeten is. Per coin komen er 200 dagcandles van Binance, of van CoinGecko als Binance geen data geeft. Daar is geen account of sleutel voor nodig. Op die candles rekent Kader de indicatoren uit en daaruit de score van 0 tot 100. De score rekent op de laatste afgesloten dag, zodat hij in de loop van de dag niet verspringt. Het plan rekent met de koers van nu: de stop 3x de ATR eronder, het doel op drie keer dat risico. Daarna bepaalt Kader het klimaat. Tot slot sorteert Kader de coins op score en houdt de eerste 20 over.',
    doe: 'De analyse start met de knop Start analyse of als je op Markt omlaag veegt. Er loopt geen timer: de lijst is zo vers als je laatste scan. De radar op Kansen is een aparte scan, die opnieuw loopt als hij ouder is dan 30 minuten. In de achtergrond controleert Kader je open posities, zie Meldingen.',
    detail: [
      'Indicatoren: RSI (14), EMA20 en EMA50, MACD (12/26/9), ATR (14) en het volume tegenover het gemiddelde van 20 dagen; zie De indicatoren',
      'De score, de labels en BEVESTIGD staan bij De Kader-score en Advieslabels',
      'Stop en doel staan bij Stop en doel; de klimaatpoort bij Het marktklimaat',
      'Op dit moment staat elke coin op AFWACHTEN; zie Advieslabels',
      'Heeft een coin alleen CoinGecko-data, dan zijn de candles grover en wijken stop en doel iets af',
      'De radar is een aparte scan met eigen niveaus; zie De Momentum-radar',
    ],
  },
  {
    id: 'klimaat',
    groep: 'markt',
    titel: 'Het marktklimaat',
    icoon: 'CloudSun',
    kort: 'Gunstig, gemengd of ongunstig, en waarom dat telt.',
    zie: 'Bovenaan Markt staat of het klimaat gunstig, gemengd of ongunstig is.',
    reken: 'Kader stelt twee vragen. Staat bitcoin boven zijn 50-daags gemiddelde? En stijgt het aandeel coins dat boven hun eigen 50-daags gemiddelde staat? Twee keer ja is gunstig, twee keer nee is ongunstig, anders gemengd.',
    doe: 'Het klimaat zegt hoe de wind staat. Kopen bij een gunstig klimaat deed het na kosten beter dan zonder die voorwaarde: +0,11 tegen +0,02 R per trade over 2023 tot en met 2026. Ook dat is niet aantoonbaar meer dan nul, dus het klimaat is achtergrond en geen koopsignaal. In een ongunstig klimaat verloor kopen gemiddeld geld.',
    detail: [
      'Het aandeel coins wordt vergeleken met 20 dagen eerder',
      'Kader toont nu bij geen enkel klimaat een kooplabel; zie Advieslabels',
      'Voorbeelden van ongunstige perioden: 2018, 2022 en begin 2026',
      'Kansen toont het klimaat boven de lijst als het gemengd of ongunstig is, gerekend op de laatste afgesloten dag. Markt rekent met de lopende dag, dus rond een omslag kunnen de twee een dag verschillen',
    ],
  },
  {
    id: 'bear',
    groep: 'markt',
    titel: 'Bear-modus',
    icoon: 'CloudRain',
    kort: 'Wat er verandert als de markt daalt.',
    zie: 'In een ongunstig klimaat verandert het bovenste vak van Markt. Het laat zien hoe lang de daling al duurt en wat bitcoin sindsdien deed.',
    reken: 'De teller loopt vanaf het moment dat Kader het ongunstige klimaat voor het eerst zag. De drempels blijven gelijk: Kader verlaagt ze niet om toch iets te kunnen tonen.',
    doe: 'In een dalende markt is niet kopen ook een resultaat. Kijk intussen naar Wie houdt stand? en naar het afbouwadvies bij je posities.',
    detail: [
      'In de bear-modus verschuift de aandacht naar je open posities en de coins die standhouden',
      'Op Markt verschijnt de lijst Wie houdt stand?',
      'Op Portfolio verschijnt per positie een afbouwadvies als daar reden voor is',
    ],
  },
  {
    id: 'rs',
    groep: 'markt',
    titel: 'Wie houdt stand? en VS BTC',
    icoon: 'Scale',
    kort: 'Welke coins het beter doen dan bitcoin.',
    zie: 'Zodra het klimaat niet gunstig is, staat op Markt een lijst met de coins die het het best doen tegenover bitcoin. Bij elke coin staat daarnaast VS BTC.',
    reken: 'Het getal is het rendement van de coin over 30 dagen min dat van bitcoin, in procentpunten. +8 betekent 8 punten beter dan bitcoin, ook als de coin zelf daalde.',
    doe: 'De lijst is om te volgen: er hangt geen entry, stop of doel aan. Een eerdere meting leek te zeggen dat achterblijvers het na een koopsignaal beter deden. Met de kosten erbij, en vergeleken met de andere coins op dezelfde dag, bleek dat een markteffect.',
    detail: [
      'Telt niet mee in de Kader-score',
      'Het getal is bewust niet groen of rood gekleurd',
      'Gemeten over negen jaar koershistorie',
    ],
  },
  {
    id: 'fg',
    groep: 'markt',
    titel: 'Fear & Greed',
    icoon: 'Thermometer',
    kort: 'Het sentiment van de hele markt, los van Kader.',
    zie: 'Op Markt staat de Fear & Greed-index: een getal van 0 tot 100 voor de stemming in de markt.',
    reken: 'De index komt van Alternative.me, niet van Kader. Kader toont 45 of lager als angst, 55 of hoger als hebzucht, daartussen neutraal.',
    doe: 'Gebruik hem als achtergrond. Hij telt niet mee in de score of in de signalen.',
    detail: [],
  },
  {
    id: 'mandje',
    groep: 'markt',
    titel: 'Het Kader-mandje',
    icoon: 'ShoppingBasket',
    nieuw: true,
    kort: 'Vijf rustige coins tegelijk, in plaats van één koopsignaal.',
    zie: 'In Signaalresultaat staat de groep "Kader-mandje". Daar zie je wat het mandje sinds de start heeft gedaan, wat bitcoin houden in dezelfde tijd deed en welke coins er nu in zitten. Het is een proef op papier: Kader koopt niets en er gaat geen order uit.',
    reken: 'Is het marktklimaat gunstig, dan kiest Kader uit alle 148 coins de vijf die het rustigst bewegen: de kleinste dagbeweging ten opzichte van hun koers. Elke coin krijgt een vijfde van het geld. Er is geen doel. Een coin blijft in het mandje tot zijn stop geraakt wordt. Die stop begint 3x ATR onder de koers en schuift elke dag mee omhoog naar het laagste punt van de laatste 20 dagen, nooit omlaag. Valt er een coin uit, dan komt de rustigste coin van dat moment ervoor in de plaats. Is het klimaat niet gunstig, dan koopt het mandje niets bij.',
    doe: 'Je hoeft er niets mee te doen. Het mandje is de eerste regel in Kader die een toets haalde op coins die Kader nooit eerder had bekeken. Hier zie je of hij dat live ook doet. Vooraf is vastgelegd wanneer het mandje als advies mag gelden en wanneer het weer uit gaat. Die afspraak heet de lat.',
    detail: [
      'Het idee: niet één coin kiezen op een hoge score, maar het geld spreiden over vijf coins die weinig schommelen, en winnaars laten lopen tot hun stop geraakt wordt',
      'De lat: op 12 mei 2027 en 12 november 2027, en daarna elk jaar op 12 november, telt de stand op papier sinds 12 november 2026. Staat die lager dan -10%, dan gaat het advies uit',
      'De noodrem: zakt de stand meer dan 60% onder zijn hoogste punt, dan gaat het advies meteen uit',
      'Gaat het advies uit, dan loopt de proef op papier door. Het komt alleen terug na een nieuwe meting met regels die vooraf vastliggen',
      'Wat je mag verwachten: na kosten boven nul, met een kleinere terugval dan bitcoin. Niet: meer geld dan bitcoin houden. Van 2023 tot en met 2026 deed bitcoin houden het beter',
      'Een tegenvallende tussenstand is gewoon: in de meting sinds 2022 stond het mandje bij 43% van de startmaanden na een half jaar of een jaar onder de grens',
      'Na 365 dagen zonder geraakte stop verkoopt het mandje een coin op de slotkoers',
    ],
  },
  {
    id: 'radar',
    groep: 'markt',
    titel: 'De Momentum-radar',
    icoon: 'Zap',
    nieuw: true,
    kort: 'Welke coins dicht bij hun hoogste koers van 90 dagen staan.',
    zie: 'Het tabblad Kansen toont coins die vlak onder hun hoogste koers van de laatste 90 dagen staan. Staan er minstens drie op de radar, dan staan de drie die er het dichtst bij zitten bovenaan, onder "In het kader".',
    reken: 'De momentumscore is 100 op de top en loopt terug naar 0 bij 30% eronder. Vanaf 70, ongeveer 9% onder de top, staat een coin op de radar. De score kijkt naar de laatste afgesloten dag. Het plan rekent met de koers van nu: de stop 3x ATR eronder, het doel op drie keer dat risico.',
    doe: 'De radar is een volglijst, geen koopadvies: er staat altijd WATCH. Kopen kan wel, met de knop Koop op de kaart: Kader plaatst dan de order met het plan van de kaart, na jouw bevestiging. Met dit plan hielden coins op de radar na de kosten van eToro gemiddeld +0,29 R per trade over, gemeten over 2023 tot en met 2026 bij een gunstig klimaat. Dat gemiddelde is onzeker: het kan net zo goed rond nul liggen, en 2025 en 2026 waren verliesjaren. Het was ook niet aantoonbaar beter dan een willekeurige coin op dezelfde dag. Kocht je buiten Kader om, leg de trade dan vast met Getrade. Is de scan ouder dan 30 minuten, dan ververst Kader hem als je het tabblad opent; tot die tijd staat er geen koopknop.',
    detail: [
      'Gemiddeld staan er zo\'n drie coins op de radar; op ongeveer 4 van de 10 dagen geen enkele',
      'Staat er niets op de radar, dan toont Kader de drie coins die er het dichtst bij zitten',
      '▲ en ▼ tonen hoeveel plekken een coin steeg of zakte sinds de vorige scan',
      'De stop staat ruim, omdat eToro 1% rekent bij kopen en 1% bij verkopen: hoe krapper de stop, hoe zwaarder die 2% weegt tegenover je risico',
      'Met het oude plan (stop op de EMA20) ging een koopsignaal na kosten van +0,22 R naar -0,17 R per trade',
      'De prijs en het plan volgen de koers van nu; de score, de ring en de afstand tot de top zijn die van de laatste afgesloten dag. NU op de kaart is de beweging sinds dat slot',
      'Signaalresultaat houdt bij wat het plan van elke radar-coin na kosten gedaan zou hebben, zodat je ziet of de lijst live doet wat de meting zei',
      'Eist eToro een ruimere stop dan 3x ATR, dan schuift de stop op en zakt de R/R mee',
      'De niveaus wijken af van Markt, omdat dit een ander plan is',
      'Is het marktklimaat gemengd of ongunstig, dan staat dat boven de lijst',
      'Heb je de coin al, of beweegt hij sterk mee met een van je posities, dan staat dat op de kaart',
    ],
  },

  // ---------- Portfolio ----------
  {
    id: 'vermogen',
    groep: 'portfolio',
    titel: 'Vermogen en resultaat',
    icoon: 'Wallet',
    kort: 'Wat de getallen bovenaan Portfolio betekenen.',
    zie: 'Het grote bedrag is je vermogen nu: je open posities plus je vrije saldo bij eToro. De regel eronder is het resultaat van je open posities sinds je ze kocht.',
    reken: 'Resultaat per periode telt twee dingen op: wat je in die periode afsloot, en hoeveel je nog open posities in die periode bewogen. Kader gebruikt daarvoor de slotkoers op de eerste dag van de periode. Het percentage deelt dat resultaat door het geld dat in die periode in posities zat, niet door je hele vermogen.',
    doe: 'Kader bewaart geen historie van je saldo. Een grafiek van wat je een jaar geleden waard was kan het dus niet maken; het resultaat per periode is wat wel klopt.',
    detail: [
      'Kent Kader je vrije saldo niet, bijvoorbeeld zonder eToro-koppeling, dan is het grote bedrag alleen de waarde van je open posities',
      'Geld dat vastzit in wachtende orders telt niet als beschikbaar',
      'Periodes: Dag, 1M, 3M, 6M, 1J en Alles',
    ],
  },
  {
    id: 'verdeling',
    groep: 'portfolio',
    titel: 'Verdeling',
    icoon: 'ChartPie',
    kort: 'Hoe je geld over je coins verdeeld is.',
    zie: 'De ring op Portfolio toont welk deel van je open posities in welke coin zit. In het midden staat de waarde van die posities en hoeveel het er zijn.',
    reken: 'Elk stuk is de huidige waarde van een positie gedeeld door de waarde van al je open posities samen.',
    doe: 'Tik op de ring voor de uitsplitsing per coin en per platform, en voor wat Kader opvalt, bijvoorbeeld als één coin het grootste deel is.',
    detail: [
      'Posities zonder aantal munten of live koers tellen niet mee en staan apart vermeld',
      'De kleuren zijn bewust geen groen of rood: die betekenen winst en verlies',
    ],
  },
  {
    id: 'blootstelling',
    groep: 'portfolio',
    titel: 'Blootstelling en afbouwen',
    icoon: 'Layers',
    kort: 'Hoeveel geld er in de markt hoort, en wanneer je afbouwt.',
    zie: 'Op Portfolio staat hoeveel procent van je handelskapitaal in de markt zit, met een plafond dat bij het klimaat past.',
    reken: 'Bij een gunstig klimaat is er geen plafond, bij gemengd de helft, bij ongunstig een vijfde. Met een eToro-koppeling haalt Kader je handelskapitaal bij elke sync zelf uit eToro: vrij saldo, posities, copies en open resultaat samen. Zonder koppeling vul je het zelf in, en dan blijft dat bedrag op je telefoon.',
    doe: 'Boven het plafond zitten is geen verkoopopdracht, wel een reden om niet bij te kopen. Onder een positie kan een afbouwadvies staan, maar alleen als er iets te melden is.',
    detail: [
      'In winst, maar onder de eigen EMA50 in een dalende markt: overweeg (deels) winst te nemen',
      'Onder je entry en onder de EMA50 in een dalende markt: niets doen, de stop niet verlagen en niet bijkopen',
      'Houdt een coin stand terwijl de rest daalt: niets hoeft te gebeuren',
      'Kader stelt niet meer voor je stop op te trekken. Het plan is gemeten met een stop die blijft staan; een stop die je vroeg naar je instap haalt is weer de krappe stop die de kosten niet droeg',
      'Het plafond is een risicorichtlijn, geen uitkomst van de backtest',
    ],
  },
  {
    id: 'meldingen',
    groep: 'portfolio',
    titel: 'Meldingen',
    icoon: 'Bell',
    nieuw: true,
    kort: 'Wanneer Kader je een melding stuurt.',
    zie: 'Kader stuurt alleen een melding als je iets moet weten of doen. Je vindt ze terug onder Meldingen in het menu; tik daar op een melding om naar de positie of coin te gaan.',
    reken: 'Dat zijn er vier: elke ochtend om 9:00 "Het kader van vandaag staat klaar"; een geraakte stop of een geraakt doel, bij eigen trades en bij eToro-posities; je eigen prijsalerts; en een afbouwadvies per positie, alleen als Kader echt adviseert (deels) winst te nemen. De melding om je stop op te trekken staat uit: het plan is gemeten met een stop die blijft staan.',
    doe: 'Dezelfde melding over dezelfde positie komt hooguit één keer per zes uur. Een geraakte stop, een geraakt doel en je prijsalerts komen meteen; de overige trade-meldingen bundelt Kader tot hooguit één per uur. Een melding dat het marktklimaat omslaat, dat een doel hoger kan of dat meerdere posities zwak staan, stuurt Kader niet meer.',
    detail: [
      'Terwijl de app open is: controle elke 5 minuten',
      'Buiten de app: Android kiest zelf het moment, minimaal elk kwartier, dus een melding kan later komen',
      'De melding bij een sterk koopsignaal staat uit zolang BEVESTIGD zich niet bewezen heeft, en komt terug als het zijn lat haalt',
      'Meldingen uit in Instellingen zet ook je prijsalerts stil',
    ],
  },
  {
    id: 'alerts',
    groep: 'portfolio',
    titel: 'Prijsalerts',
    icoon: 'BellRing',
    kort: 'Zelf een prijs kiezen waarop Kader je waarschuwt.',
    zie: 'Met het belletje op een coinscherm kies je zelf een prijs. Kader waarschuwt je als de koers daar komt.',
    reken: 'Of het een boven- of een onder-alert is, bepaalt Kader op het moment dat je hem instelt. Een alert gaat één keer af en blijft daarna in de lijst staan, met de koers waarop hij afging.',
    doe: 'Wil je hem nog een keer, zet hem dan opnieuw. Je wachtende alerts staan onder Meldingen.',
    detail: [
      'Maximaal 20 wachtende alerts tegelijk',
      'Dit is de enige plek in de app waar jij het niveau kiest',
      'Staan je meldingen uit, dan wachten je alerts tot je ze weer aanzet',
    ],
  },
  {
    id: 'stats',
    groep: 'portfolio',
    titel: 'Historie en statistieken',
    icoon: 'History',
    kort: 'Je gesloten trades in vier getallen.',
    zie: 'In Historie staan je gesloten trades, met vier getallen erboven.',
    reken: 'Trefferpercentage is het deel van je gesloten trades met winst. Gemiddelde R/R behaald is per trade de uitkomst gedeeld door wat je riskeerde (entry min stop), gemiddeld over alle trades. Totaal resultaat telt alles op.',
    doe: 'Een trefferpercentage onder de 50% kan kloppen met winst: een paar grote winsten wegen dan op tegen meer kleine verliezen.',
    detail: [
      'Sluit je een eigen trade af, dan vraagt Kader tegen welke prijs; vul de echte verkoopprijs in zodat het resultaat klopt',
    ],
  },

  // ---------- Handelen ----------
  {
    id: 'handelen',
    groep: 'handelen',
    titel: 'Direct handelen via eToro',
    icoon: 'ShoppingCart',
    kort: 'Demo en echt, bevestigen, en wat er daarna gebeurt.',
    zie: 'Met een Write-sleutel kun je vanuit Kader kopen, verkopen en je stop of doel aanpassen. Bovenin staat DEMO zolang je met oefengeld handelt.',
    reken: 'Elke order bevestig je zelf. In demo is een tik genoeg; bij echt geld houd je de knop ingedrukt. Kader stuurt de order tegen de marktprijs naar eToro, met stop en doel erbij als eToro die accepteert.',
    doe: 'Voert eToro een order niet meteen uit, dan staat hij onder Wachtende orders en kun je hem annuleren. Krijgt Kader geen antwoord, dan zie je dat meteen: koop dan niet opnieuw voordat je bij eToro hebt gekeken.',
    detail: [
      'Kader plaatst nooit een order zonder jouw bevestiging',
      'Naar echt overstappen vraagt een bevestiging; terug naar demo niet',
      'Bedragen in de ordervensters staan altijd in dollars, want eToro rekent in dollars af',
    ],
  },
  {
    id: 'koppelen',
    groep: 'handelen',
    titel: 'eToro koppelen',
    icoon: 'Link',
    kort: 'Wat de sleutel mag, en wanneer Kader bijwerkt.',
    zie: 'Met een sleutel van eToro haalt Kader je open posities en je handelshistorie van het afgelopen jaar op.',
    reken: 'Een Read-sleutel laat Kader alleen meekijken. Met Write kan Kader ook orders plaatsen, altijd na jouw bevestiging. Dezelfde sleutel werkt voor demo en echt, en staat alleen op je telefoon.',
    doe: 'Kader werkt je posities bij als je de app opent (hooguit eens per vijf minuten), als je op Portfolio omlaag veegt om te verversen en met de eToro-knop op Portfolio. Alleen crypto komt mee.',
    detail: [
      'Geld overmaken of je eToro-instellingen wijzigen kan Kader niet',
      'Een nieuwe synchronisatie werkt posities bij in plaats van ze dubbel toe te voegen',
      'Staat bij eToro geen stop of doel op een positie, dan komt hij zonder die niveaus binnen',
      'Aandelen en ETF\'s slaat Kader over',
    ],
  },
  {
    id: 'platforms',
    groep: 'handelen',
    titel: 'Waar je kunt kopen',
    icoon: 'Store',
    kort: 'Het rondje rechtsboven op een kaart.',
    zie: 'Rechtsboven op een kaart staat een klein rond merkje: de plek waar Kader de order voor je kan plaatsen. Tik erop voor uitleg.',
    reken: 'Het merkje staat er alleen als Kader die coin zelf voor je kan kopen. Zonder Write-sleutel is er dus geen merkje en ook geen koopknop.',
    doe: 'Geen merkje betekent niet dat de coin nergens te koop is; je koopt hem dan zelf bij een aanbieder. Nu is eToro de enige plek waar Kader kan handelen.',
    detail: [],
  },
  {
    id: 'copy',
    groep: 'handelen',
    titel: 'Copy: traders volgen en kopiëren',
    icoon: 'Copy',
    nieuw: true,
    kort: 'Hoe de Feed werkt en wat Kader doet als jij een trade kopieert.',
    zie: 'Op Copy staan drie delen. Ontdek is de ranglijst van crypto-traders met een Kader-score. De Feed toont de nieuwe trades van de traders met een ster. Mijn copies laat zien wat je kopieerde en welke traders je via eToro volledig kopieert.',
    reken: 'Een trade in de Feed is kopieerbaar zolang de koers hooguit 2% boven de instap van de trader ligt en nog boven zijn stop staat. Daarboven ben je te laat: je koopt duurder dan hij, en zijn stop en doel passen dan niet meer bij jouw instap.',
    doe: 'Tik op Kopieer. De kooporder staat klaar met je eigen bedrag, een stop en een doel; jij kijkt hem na en bevestigt. Sluit de trader zijn positie, dan krijg je een melding. Kader verkoopt nooit zelf.',
    detail: [
      'Alleen long en zonder hefboom. Een short-trade kun je niet kopiëren, en de hefboom van de trader neemt Kader niet over.',
      'Een stop gaat altijd mee. Heeft de trader er geen, dan neemt Kader zijn eigen stop. Kan Kader er ook geen bepalen, dan kopieert hij niet.',
      'Kader kijkt elke minuut zolang je op de Feed staat, elke vijf minuten als de app openstaat en ongeveer elk kwartier als de app dicht is.',
      'Kopieer alles loopt via eToro\'s eigen CopyTrader, met een Copy Stop Loss van hooguit 50%. eToro volgt dan elke trade, ook die buiten crypto.',
      'Een melding komt een paar minuten na de trade binnen. Kijk daarom altijd naar de koers op eToro voor je bevestigt.',
    ],
  },
  {
    id: 'trader',
    groep: 'handelen',
    titel: 'Het trader-oordeel',
    icoon: 'Users',
    kort: 'Waar de traders in Ontdek vandaan komen en hoe Kader ze beoordeelt.',
    zie: 'Op Copy, onder Ontdek, krijgt elke eToro-trader een Kader-score met KOPIEER, VOLG of VERMIJD, en een voorstel voor je Copy Stop Loss. Staat een trader er niet bij, dan beoordeel je hem handmatig.',
    reken: 'Kader vraagt eToro om de Popular Investors, gesorteerd op aantal copiers, en ververst die lijst elke zes uur. Erin komt alleen wie minstens 52 weken actief is, een eToro-risico van hooguit 6 heeft en vooral crypto handelt; Smart Portfolios vallen af. De score weegt drie delen: consistentie (35%), risicobeheer (40%) en spreiding (25%). Vanaf 70 punten is het oordeel KOPIEER, vanaf 50 VOLG, daaronder VERMIJD.',
    doe: 'De Copy Stop Loss volgt uit de grootste daling die de trader eerder had, afgerond op 5%. Die stel je bij eToro in als je de trader kopieert.',
    detail: [
      'Consistentie: het deel van de maanden met winst. 40% of minder telt niet, 80% of meer is vol.',
      'Risicobeheer: de grootste daling (bij eToro peakToValley) en eToro\'s eigen risicoscore.',
      'Spreiding: hoeveel van de handel in één coin zit (boven 20% kost punten) en hoe vaak met hoge hefboom.',
      'Alle cijfers komen van eToro, over de afgelopen twaalf maanden. Rendement uit het verleden is geen belofte.',
      'Copy Stop Loss bij KOPIEER: 1,2x de grootste daling, tussen 20% en 40%',
      'Bij VOLG: 1x de grootste daling, tussen 15% en 30%',
      'Bij VERMIJD: 0,6x de grootste daling, tussen 10% en 20%',
    ],
  },
];

const MIT_LICENTIE_WEB3ICONS = `MIT License

Copyright (c) 2024 0xa3k5

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export const BRONNEN: { titel: string; tekst: string; licentie?: string }[] = [
  {
    titel: 'Binance',
    tekst: 'Koersen en dagcandles voor de analyse, de radar en de prijsalerts komen van de openbare marktdata van Binance (USDT-paren). Daar is geen account of sleutel voor nodig.',
  },
  {
    titel: 'CoinGecko',
    tekst: 'Geeft Binance voor een coin geen data, dan haalt Kader de koersen bij CoinGecko. Kansen gebruikt CoinGecko ook voor de naam en de marktwaarde van een coin, en de wisselkoers van dollar naar euro komt er ook vandaan.',
  },
  {
    titel: 'Alternative.me',
    tekst: 'De Fear & Greed-index op Markt.',
  },
  {
    titel: 'eToro',
    tekst: 'Met een koppeling haalt Kader je posities, handelshistorie, saldo en de stop-grenzen op via de officiële API van eToro, en plaatst het daar de orders die jij bevestigt.',
  },
  {
    titel: 'Coinlogo\'s: cryptocurrency-icons 0.18.1',
    tekst: '38 logo\'s komen uit cryptocurrency-icons 0.18.1, onder de licentie Creative Commons Zero v1.0 Universal (CC0 1.0, publiek domein).',
  },
  {
    titel: 'Coinlogo\'s: web3icons',
    tekst: '18 logo\'s komen uit web3icons (@web3icons/core 4.0.56), onder de MIT-licentie. Copyright (c) 2024 0xa3k5.',
    licentie: MIT_LICENTIE_WEB3ICONS,
  },
  {
    titel: 'Merken',
    tekst: 'De coinlogo\'s zijn merken van de projecten zelf. Kader gebruikt ze alleen om een coin te herkennen, niet om een band met het project te suggereren. Het SOL-logo is voor Kader nagetekend naar de officiële Solana-vorm.',
  },
];

// ponytail: self-check ipv testframework, run met `npx tsx src/informatie/hoofdstukken.ts`
if (require.main === module) {
  const alle = HOOFDSTUKKEN;

  console.assert(HOOFDSTUKKEN.length === 22, `er horen 22 hoofdstukken te zijn, was ${HOOFDSTUKKEN.length}`);

  const ids = alle.map(h => h.id);
  console.assert(new Set(ids).size === ids.length, `ids moeten uniek zijn: ${ids.join(', ')}`);

  for (const g of GROEPEN) {
    console.assert(HOOFDSTUKKEN.some(h => h.groep === g.id), `groep ${g.id} is leeg`);
  }

  for (const h of alle) {
    for (const veld of ['zie', 'reken', 'doe'] as const) {
      console.assert(h[veld].trim().length > 0, `${h.id}: ${veld} is leeg`);
    }
  }

  // Elke string in het bestand: hoofdstukken, groepen en bronnen.
  const teksten: string[] = [
    ...GROEPEN.map(g => g.titel),
    ...alle.flatMap(h => [h.titel, h.kort, h.zie, h.reken, h.doe, h.icoon, ...h.detail]),
    ...BRONNEN.flatMap(b => [b.titel, b.tekst, b.licentie ?? '']),
  ];
  for (const t of teksten) {
    console.assert(!t.includes(String.fromCharCode(0x2014)), `gedachtestreepje gevonden in: ${t}`);
  }

  // "kader" als beeld alleen in de drie vaste app-zinnen. Kader (de naam) met hoofdletter mag altijd.
  const vasteZinnen = ['In het kader', 'Binnen je kader', 'nadert de rand van je kader', 'Het kader van vandaag staat klaar'];
  for (const t of teksten) {
    const zonderVast = vasteZinnen.reduce((s, z) => s.split(z).join(''), t);
    console.assert(!/\bkader\b/.test(zonderVast), `"kader" buiten een vaste zin in: ${t}`);
  }

  console.assert(HOOFDSTUKKEN.filter(h => h.nieuw).map(h => h.id).sort().join(',') === 'marktanalyse,meldingen,radar',
    'alleen marktanalyse, radar en meldingen horen nieuw te zijn');
  console.assert(!ids.includes('kansscore'), 'het oude kansscore-hoofdstuk hoort er niet meer in');

  console.log('hoofdstukken.ts self-check geslaagd');
}
