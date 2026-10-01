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
    doe: 'Vanaf 55 geeft Kader een koopsignaal, als de R/R minstens 1 : 2 is en het marktklimaat gunstig. Klap een kaart op Markt uit om te zien wat meetelt.',
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
    kort: 'Afwachten, koopzone, sterk koop, en wanneer er BEVESTIGD bij staat.',
    zie: 'Elke coin krijgt een van drie labels. Staat alles mee, dan komt het keurmerk BEVESTIGD ernaast.',
    reken: 'Het label volgt de score: onder 55 AFWACHTEN, vanaf 55 KOOPZONE, vanaf 72 STERK KOOP. BEVESTIGD vraagt een score van 75 of hoger en vier bevestigingen: een stijgende trend, een positieve MACD, volume van minstens 1,3x het gemiddelde en een R/R van minstens 1 : 2.',
    doe: 'Is het marktklimaat niet gunstig (gemengd of ongunstig), dan staat elke coin op AFWACHTEN, hoe hoog de score ook is. Een koopsignaal is een startpunt om zelf te kijken.',
    detail: [
      'AFWACHTEN: score onder 55, R/R onder 1 : 2.0, of een klimaat dat niet gunstig is',
      'KOOPZONE: score 55 tot en met 71',
      'STERK KOOP: score 72 of hoger',
      'BEVESTIGD: score 75+, trend op, MACD positief, volume 1,3x of meer, R/R 1 : 2.0 of beter',
    ],
  },
  {
    id: 'atr',
    groep: 'signalen',
    titel: 'Stop en doel',
    icoon: 'Shield',
    kort: 'Waar de stop-loss en het doel liggen, en waarom.',
    zie: 'Bij elke coin staan drie niveaus: de stop (waar je eruit gaat als het tegenzit), de entry en het doel.',
    reken: 'De stop ligt net onder het laagste punt van de laatste tien dagen. Die afstand blijft tussen een halve en drie keer de gemiddelde dagbeweging (de ATR), zodat de stop niet te krap en niet te ruim ligt. Het doel ligt drie keer de ATR boven de entry.',
    doe: 'Kijk naar de R/R: wat je kunt winnen gedeeld door wat je riskeert. Onder 1 : 2 geeft Kader geen koopsignaal.',
    detail: [
      'ATR (14): gemiddelde dagbeweging over 14 dagen',
      'Stop: net onder de laagste koers van 10 dagen (0,1x ATR eronder), tussen 0,5x en 3x ATR',
      'Doel: entry plus 3x ATR',
      'Entry-zone: entry plus of min 0,2x ATR',
      'Minimale R/R voor een koopsignaal: 1 : 2.0',
    ],
  },
  {
    id: 'etorostop',
    groep: 'signalen',
    titel: 'Waarom de stop soms opschuift',
    icoon: 'ShieldAlert',
    kort: 'eToro eist een minimale afstand voor je stop.',
    zie: 'Soms staat AANGEPAST naast de stop. Kader heeft zijn stop dan verschoven naar een niveau dat eToro accepteert.',
    reken: 'eToro eist per coin een minimale en maximale afstand tussen je stop en een referentieprijs. Voor bitcoin is dat minimaal 10%. Bij een nieuwe kooporder is die referentie je aankoopprijs; bij het wijzigen van de stop van een lopende positie is het de huidige koers. Ligt de stop van Kader buiten die grenzen, dan schuift hij naar de dichtstbijzijnde grens van eToro.',
    doe: 'Een verdere stop betekent meer risico bij hetzelfde doel. Zakt de R/R daardoor onder 1 : 2, dan kleurt de R/R oranje, vervalt BEVESTIGD en wordt het label op Markt AFWACHTEN. De uitgeklapte kaart zegt dat Kader hier geen koopsignaal geeft. Op Kansen verdwijnt KOOP dan. Staat je positie ver genoeg in winst, dan kun je in het stopvenster een stop boven je aankoopprijs zetten, zolang hij minstens het minimum onder de koers blijft (bij bitcoin 10%).',
    detail: [
      'Werkt alleen met een eToro-koppeling; zonder koppeling blijft de eigen stop van Kader staan',
      'Laat eToro voor een coin geen stop toe, dan staat er STOP (KADER): een niveau om zelf in de gaten te houden',
      'Kader bewaart de grenzen van eToro een dag',
      'Bij een lopende positie meet Kader de minimale afstand vanaf de huidige koers, bij een nieuwe kooporder vanaf je aankoopprijs',
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
    zie: 'De grafiek toont de koers over de gekozen periode: groen als hij in die periode steeg, rood als hij daalde.',
    reken: 'De stippellijnen zijn de stop (rood), de entry (blauw) en het doel (groen). Met 1M, 3M, 6M en Alles kies je de periode; een periode waarvoor te weinig koershistorie is, staat er niet bij.',
    doe: 'Houd je vinger stil op de grafiek of schuif er zijwaarts overheen: je ziet de datum en de koers van elk punt. Op de hoogste en laagste koers voel je een tik.',
    detail: [],
  },

  // ---------- Markt ----------
  {
    id: 'klimaat',
    groep: 'markt',
    titel: 'Het marktklimaat',
    icoon: 'CloudSun',
    kort: 'Gunstig, gemengd of ongunstig, en waarom dat telt.',
    zie: 'Bovenaan Markt staat of het klimaat gunstig, gemengd of ongunstig is.',
    reken: 'Kader stelt twee vragen. Staat bitcoin boven zijn 50-daags gemiddelde? En stijgt het aandeel coins dat boven hun eigen 50-daags gemiddelde staat? Twee keer ja is gunstig, twee keer nee is ongunstig, anders gemengd.',
    doe: 'Alleen in een gunstig klimaat toont Kader koopsignalen op Markt. Over negen jaar gemeten verloren koopsignalen in een ongunstig klimaat gemiddeld geld, ook bij een hoge score.',
    detail: [
      'Het aandeel coins wordt vergeleken met 20 dagen eerder',
      'Bij gemengd staat elke coin op Markt ook op AFWACHTEN',
      'Voorbeelden van ongunstige perioden: 2018, 2022 en begin 2026',
      'Je krijgt een melding als het klimaat omslaat',
      'De Momentum-radar op Kansen kijkt niet naar het klimaat',
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
      'Geen koopsignalen op Markt zolang het klimaat ongunstig is',
      'Op Markt verschijnt de lijst Wie houdt stand?',
      'Op Portfolio verschijnt per positie een afbouwadvies als daar reden voor is',
      'Je krijgt een melding als de bear-modus begint en als hij voorbij is',
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
    doe: 'De lijst is om te volgen: er hangt geen entry, stop of doel aan. Bij een koopsignaal deden coins die achterbleven op bitcoin het in de meting beter dan coins die al ver voorliepen.',
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
    id: 'radar',
    groep: 'markt',
    titel: 'De Momentum-radar',
    icoon: 'Zap',
    nieuw: true,
    kort: 'Welke coins dicht bij hun hoogste koers van 90 dagen staan.',
    zie: 'Het tabblad Kansen toont coins die vlak onder hun hoogste koers van de laatste 90 dagen staan. Staan er minstens drie op de radar, dan staan de drie die er het dichtst bij zitten bovenaan, onder "In het kader".',
    reken: 'De momentumscore is 100 op de top en loopt terug naar 0 bij 30% eronder. Vanaf 70, ongeveer 9% onder de top, staat een coin op de radar. Het plan is een uitbraakplan: de stop op de EMA20, het doel twee keer de ATR boven de top.',
    doe: 'KOOP staat er alleen als de R/R minstens 1 : 2 haalt, ook na een aanpassing door eToro, en de Kader-score minstens 55 is. Is de scan ouder dan 30 minuten, dan ververst Kader hem als je het tabblad opent; tot die tijd staat er geen koopknop.',
    detail: [
      'Gemiddeld staan er zo\'n drie coins op de radar; op ongeveer 4 van de 10 dagen geen enkele',
      'Staat er niets op de radar, dan toont Kader de drie sterkste coins, zonder koopsignaal',
      '▲ en ▼ tonen hoeveel plekken een coin steeg of zakte sinds de vorige scan',
      'Staat de koers onder de EMA20, dan is er geen instap-plan',
      'De stop op de EMA20 blijft tussen 0,5x en 3x ATR',
      'De niveaus wijken af van Markt, omdat dit een ander plan is',
      'De radar kijkt niet naar het marktklimaat',
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
    reken: 'Bij een gunstig klimaat is er geen plafond, bij gemengd de helft, bij ongunstig een vijfde. Het percentage verschijnt alleen als je zelf je handelskapitaal invult; dat bedrag blijft op je telefoon.',
    doe: 'Boven het plafond zitten is geen verkoopopdracht, wel een reden om niet bij te kopen. Onder een positie kan een afbouwadvies staan, maar alleen als er iets te melden is.',
    detail: [
      'In winst, maar onder de eigen EMA50 in een dalende markt: winst nemen of de stop optrekken',
      'Onder je entry en onder de EMA50 in een dalende markt: niets doen, de stop niet verlagen en niet bijkopen',
      'Houdt een coin stand terwijl de rest daalt: niets hoeft te gebeuren',
      'Ook buiten een dalende markt: in winst maar onder de EMA50, dan stelt Kader voor de stop op te trekken',
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
    zie: 'Kader stuurt een melding als er iets verandert dat je moet weten. Je vindt ze terug onder Meldingen in het menu; tik daar op een melding om naar de positie of coin te gaan.',
    reken: 'Voor je posities: als de koers je doel nadert terwijl het momentum nog sterk is ("nadert de rand van je kader"), als je in winst staat en het momentum afvlakt, als je stop of doel geraakt is, en in een dalende markt als meerdere posities zwak staan. Voor de markt: als het klimaat omslaat, of bij een koopsignaal met BEVESTIGD. Daarnaast je eigen prijsalerts en elke ochtend om 9:00 "Het kader van vandaag staat klaar".',
    doe: 'Dezelfde melding over dezelfde positie komt hooguit één keer per zes uur. Een geraakte stop, een geraakt doel en je prijsalerts komen meteen; de rest bundelt Kader tot hooguit één melding per uur.',
    detail: [
      'Terwijl de app open is: controle elke 5 minuten',
      'Buiten de app: Android kiest zelf het moment, minimaal elk kwartier, dus een melding kan later komen',
      'Hooguit drie nieuwe koopsignalen per keer',
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
    id: 'trader',
    groep: 'handelen',
    titel: 'Het trader-oordeel',
    icoon: 'Users',
    kort: 'Hoe Kader een eToro-trader beoordeelt.',
    zie: 'Op Traders beoordeelt Kader een eToro-trader met groen, geel of rood, en een voorstel voor je Copy Stop Loss.',
    reken: 'Het oordeel weegt drie deelscores: consistentie (35%), risicobeheer (40%) en spreiding (25%). Vanaf 70 punten is het groen, vanaf 50 geel, daaronder rood.',
    doe: 'De Copy Stop Loss volgt uit de grootste daling die de trader eerder had, afgerond op 5%. Die stel je bij eToro in als je de trader kopieert.',
    detail: [
      'Groen: 1,2x de grootste daling, tussen 20% en 40%',
      'Geel: 1x de grootste daling, tussen 15% en 30%',
      'Rood: 0,6x de grootste daling, tussen 10% en 20%',
    ],
  },
];

// Shorts blijft voorlopig een los hoofdstuk, met de tekst zoals die in AchtergrondScherm stond.
// Het blijft staan tot Thom en Kevin besluiten wat er met shorts gebeurt; tot dan niet in
// HOOFDSTUKKEN opnemen en niet herschrijven.
export const SHORTS_HOOFDSTUK: Hoofdstuk = {
  id: 'shorts',
  groep: 'handelen',
  titel: 'Shorts',
  icoon: 'TrendingDown',
  kort: 'Verdienen aan een dalende koers, en wanneer Kader dat toont.',
  zie: 'Een short verdient geld als de koers daalt in plaats van stijgt. Je opent \'m door de coin te verkopen zonder \'m te bezitten en sluit \'m af door \'m terug te kopen; het verschil tussen die twee prijzen is je resultaat. De niveaus liggen daarom gespiegeld ten opzichte van een gewone trade: de stop-loss ligt boven de entry, het doel eronder.',
  reken: 'Kader toont short-signalen alleen zolang het marktklimaat ONGUNSTIG is, en alleen voor coins met een score onder de 40: hoe zwakker het momentum, hoe sterker het short-signaal. Het doel ligt op 2 keer de ATR onder de entry, de stop op dezelfde swing-structuur als bij een gewone trade maar dan gespiegeld: net boven de recente weerstand. Ook hier geldt de minimale verhouding van 1:2 tussen risico en beloning, dus alleen coins die daaraan voldoen krijgen het signaal.',
  doe: 'Zoals bij elk signaal in Kader: dit is een technische uitkomst van de analyse. Geen financieel advies. De koers op eToro kan afwijken, dus kijk daar voor je een order plaatst.',
  detail: [
    'Diezelfde score, dezelfde 0 tot 100, alleen omgekeerd gelezen',
    'Gemeten over negen jaar Binance-historie leverden shorts op die drempel in alle vier de dalende jaren geld op (2018, 2022, 2025 en het lopende 2026) en verloren ze juist in de stijgende jaren. Daarom zit er een klimaatpoort voor: buiten een ongunstig klimaat toont Kader nooit een short',
    'Bij eToro kan een crypto-short alleen als CFD, maar wel op dezelfde hefboom x1 als een gewone koop: Kader rekent nergens met hefboom, ook niet bij een short',
    'eToro staat voor een short wel een krappere stop toe dan bij een koop (gemeten: maximaal 50% van je inleg tegen 100% bij een koop), en Kader toetst je stop tegen precies die grens voordat de order de deur uitgaat',
  ],
};

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
  const alle = [...HOOFDSTUKKEN, SHORTS_HOOFDSTUK];

  console.assert(HOOFDSTUKKEN.length === 21, `er horen 21 hoofdstukken te zijn, was ${HOOFDSTUKKEN.length}`);

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

  console.assert(HOOFDSTUKKEN.filter(h => h.nieuw).map(h => h.id).sort().join(',') === 'meldingen,radar',
    'alleen radar en meldingen horen nieuw te zijn');
  console.assert(!ids.includes('kansscore'), 'het oude kansscore-hoofdstuk hoort er niet meer in');

  console.log('hoofdstukken.ts self-check geslaagd');
}
