// Bron voor het in-app wijzigingenscherm en de "nieuw in deze versie"-melding.
// Handmatig gelijk houden met CHANGELOG.md in de projectmap. Nieuwste eerst.

export interface ChangelogEntry {
  versie: string;
  datum: string;
  punten: string[];
  // Mijlpaal-release: toont de feestelijke opening (vallende bitcoins) bij de
  // "nieuw in deze versie"-melding.
  feest?: boolean;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    // Nog niet uitgebracht: versie en datum worden pas ingevuld als er een release-APK gebouwd wordt.
    versie: 'Nog niet uitgebracht',
    datum: '',
    punten: [
      'Het boek-icoon heeft er twee hoofdstukken bij en een uitgebreid hoofdstuk. "Waarom de stop soms opschuift" legt uit waarom Kaders eigen stop-loss en die van eToro botsen en wat dat met de verhouding tussen risico en opbrengst doet. "Prijsalerts" legt uit hoe de richting van een alert wordt bepaald, waarom hij maar een keer afgaat en waarom een melding via de achtergrondtaak wat later kan komen. En "Wie houdt stand?" heet nu "Wie houdt stand? en VS BTC", want datzelfde cijfer betekent bij een koopsignaal iets anders dan in die lijst; de meting erachter staat erbij',
      'Je wachtende prijsalerts staan nu bij elkaar onder Meldingen, met bovenaan hoeveel het er zijn. Tot nu toe waren ze alleen per coin te vinden: zette je er een op ICP en keek je drie weken later, dan was elke coin apart openen de enige manier om erachter te komen welke er nog stonden. Tik op een alert om naar die coin te gaan, of gooi hem daar meteen weg. Alerts die al zijn afgegaan staan er niet bij, die zijn als melding langsgekomen en staan in de lijst eronder',
      'Elke coin toont nu hoeveel hij de afgelopen 30 dagen achterbleef of voorliep op bitcoin, op de kaart als "VS BTC" en op het coin-detailscherm met uitleg erbij. Dat cijfer is niet zomaar informatie: uit een meting over negen jaar en 3251 trades blijkt dat koopsignalen op coins die zijn ACHTERGEBLEVEN het duidelijk beter doen dan dezelfde signalen op coins die bitcoin al ver voorbij zijn gelopen. Achterblijvers leverden gemiddeld +0,17 op waar voorlopers -0,03 opleverden, en dat patroon loopt netjes op: hoe verder achter, hoe beter. De reden erachter is dat een koopsignaal al een stijgende trend eist, dus een coin die daarbovenop 25 procent harder steeg dan bitcoin heeft het makkelijke deel gehad, terwijl dezelfde coin die achterbleef juist een terugval binnen een opgaande trend is. Het cijfer telt bewust niet mee in de score en filtert niets weg, want dat zou elk signaal in de app veranderen',
      'Een short-signaal is nu aan te tikken. Tot nu toe kon dat niet, want het coin-detailscherm bouwde zijn "Waarom" alleen op met koop-argumenten en dan stond er onder een short letterlijk het tegenovergestelde: "geen opwaartse trend, let op" onder een signaal dat juist op die dalende trend instapt, met een rood "nu niet kopen" erboven. Er staat nu short-onderbouwing: een dalende trend en negatief momentum tellen als plus, een RSI die al diep oversold staat als waarschuwing omdat de val dan grotendeels geweest is, en een hoge score als reden om het juist niet te doen. Het scherm draagt een SHORT-label in de kop, de kop heet "Waarom short" en de knop onderin zegt "Short via eToro"',
      'Prijsalerts. Tik op het belletje rechtsboven in een coinscherm en stel zelf een prijs in; Kader stuurt een melding zodra de koers daar is. Onder het veld staat in gewone taal wat er straks gebeurt, en er zijn knoppen voor 5 en 10 procent boven of onder de huidige koers zodat je geen cryptokoers hoeft over te tikken. Een alert gaat precies een keer af en blijft daarna in de lijst staan met de koers waarop hij afging, zodat je hem kunt wissen of opnieuw kunt zetten. Maximaal twintig tegelijk',
      'Meldingen zijn nu uit te zetten onder Instellingen. Tot nu toe stonden de dagelijkse herinnering en de trade-meldingen altijd aan zodra je meldingen toestond op je toestel. Uit betekent echt uit: de geplande herinnering wordt gewist en de achtergrondcontrole stopt, dus er komt ook geen prijsalert meer doorheen. Je alerts en trades blijven gewoon staan en gaan weer werken zodra je het aanzet',
      'Zijn er meer coins tegelijk met een sterk koopsignaal, dan zie je ze nu allemaal. Het blauwe vak "Wat moet ik nu kopen?" toonde er altijd maar een, de hoogst scorende, en de rest verdween zonder dat je wist dat hij er was. Je veegt er nu horizontaal doorheen; de puntjes eronder laten zien hoeveel er zijn en waar je bent. Is er maar een kans, dan blijft het vak precies zoals het was',
      'De stop-loss die Kader toont is nu de stop die je bij eToro werkelijk kunt zetten. eToro eist per coin een minimale afstand tussen je aankoopprijs en je stop (bij bitcoin 10%), en Kaders eigen stop ligt daar meestal ruim binnen. Tot nu toe corrigeerde alleen de kooporder-sheet dat, dus op het marktscherm, bij Grote Kansen en op het coin-detailscherm stond een niveau dat je nergens kon invoeren. Die schermen tonen nu de bijgestelde stop met een klein ETORO-merkje erbij, plus de verhouding tussen risico en opbrengst die daar echt bij hoort. Dat cijfer valt vaak lager uit dan voorheen, en dat is het punt: met een stop van 10% en een doel van 9% verdien je niets, hoe hoog de score ook is. Zonder eToro-koppeling verandert er niets, dan blijft het niveau van Kader staan',
      'Op het coin-detailscherm staat nu altijd een knop "Trade via eToro". Die stond er alleen als je sleutel handelsrechten had, en anders was er niets: geen knop, geen uitleg, en geen manier om te weten of Kader dit uberhaupt kon. Tik je hem zonder koppeling of zonder handelsrecht, dan staat er nu wat er ontbreekt en waar je het oplost',
      'In het orderscherm staat je te besteden saldo nu boven het bedragveld in plaats van als voetnoot eronder, dus je weet wat er in kan voor je begint te tikken. Lukt het ophalen bij eToro niet, dan zegt de app dat ook. Stop-loss en take-profit vult Kader zelf in en stuurt hij mee met de order; het bedrag is het enige dat je nog invult',
    ],
  },
  {
    versie: '0.1.15',
    datum: '2026-08-25',
    punten: [
      'Shortposities uit eToro komen nu gewoon in de app. Tot nu toe sloeg de import ze over met de melding "short, nog niet ondersteund", want Kader ging er overal van uit dat een trade een koop was: stop eronder, doel erboven. Een short staat nu met de juiste richting in Mijn trades, met een kloppende winst- en verliesberekening, een kloppende verhouding tussen risico en opbrengst en een balk die de goede kant op leest. Ook de meldingen en het afbouwadvies weten nu welke kant een positie op staat, dus een short die in de winst loopt krijgt het voorstel om zijn stop te verlagen in plaats van te verhogen. Een short zelf invoeren kan ook',
      'Meldingen zijn aantikbaar geworden. Tik in het meldingenoverzicht op een melding en je gaat naar waar hij over gaat: de trade in Mijn trades, of de coin op het marktscherm. Onder elke melding staat waar je uitkomt, zodat je het vóór het tikken weet. Meldingen van vóór deze versie hebben die verwijzing niet en blijven gewoon leesbaar. Is de trade inmiddels gesloten of verwijderd, dan zegt de app dat in plaats van niets te doen',
      'Kader schakelt in een dalende markt over op bear-modus. Zodra het marktklimaat ongunstig is, maakt het vak "Wat moet ik nu kopen?" plaats voor een vak dat vertelt wat er aan de hand is, hoe lang dat al zo is en wat bitcoin sindsdien gedaan heeft. Dat laatste staat er met opzet bij: niet kopen voelt als niets doen, maar in een markt die 18% daalt is niet kopen een resultaat. De drempels blijven ongewijzigd, want ze verlagen om toch iets te kunnen tonen is precies de fout die geld kost',
      'Kader toont nu concrete short-signalen op het marktscherm zodra het klimaat ongunstig is: coins die het zwakst scoren, met stop, doel en risico/beloning erbij, klaar om te traden. Kies je voor direct handelen via eToro, dan maakt de kooporder-sheet onmiskenbaar duidelijk dat je een short opent: je verkoopt om de positie te beginnen en verdient als de koers daalt, met stop en doel in de juiste, omgekeerde volgorde. Het boek-icoon heeft er een hoofdstuk bij dat uitlegt wat een short is, wanneer Kader er een toont en waarom, en hoe dat bij eToro werkt',
      'Nieuw op het marktscherm zodra het klimaat niet gunstig is: "Wie houdt stand?". Die lijst toont per coin het rendement over 30 dagen min dat van bitcoin over dezelfde periode. In een dalende markt daalt alles en scoort dus alles laag op de gewone Kader-score, waardoor die nauwelijks nog onderscheid maakt. Wie minder hard daalt heeft kopers die blijven zitten, en dat zijn doorgaans de coins die als eerste omhoog gaan als de markt draait. Het is nadrukkelijk geen koopsignaal en telt niet mee in de score',
      'Mijn trades toont nu hoeveel van je kapitaal er in de markt staat, afgezet tegen wat bij het huidige klimaat past: geen plafond bij gunstig, de helft bij gemengd, een vijfde bij ongunstig. Het percentage verschijnt alleen als je zelf je handelskapitaal invult, want zonder dat bedrag zou het verzonnen zijn. Dat bedrag blijft op je telefoon staan',
      'Per open positie kan er een advies onder de trade staan over wat de markt eromheen betekent. Staat een coin in winst maar zakt hij onder zijn 50-daags gemiddelde terwijl de markt daalt, dan stelt Kader voor om winst te nemen of de stop op te trekken, met het niveau erbij. Staat hij onder je entry en onder dat gemiddelde, dan is het advies juist om niets te doen: stop niet verlagen, niet bijkopen om je gemiddelde te drukken. Is er niets bijzonders, dan staat er ook niets',
      'Je krijgt voortaan een pushmelding als het marktklimaat omslaat, in beide richtingen. De belangrijkste is die tweede: in een bearmarkt wacht je maandenlang op het moment dat de poort weer opengaat, en dat hoef je nu niet meer zelf in de gaten te houden. Daarnaast waarschuwt Kader als meer van je posities zwak komen te staan dan waarover hij al gewaarschuwd had, dus zonder elke zes uur hetzelfde te herhalen',
      'Het boek-icoon heeft er drie hoofdstukken bij: bear-modus, "Wie houdt stand?" en blootstelling en afbouwen. Daar staat per onderwerp wat er berekend wordt, waarom, en waar het cijfer vandaan komt',
      'De eToro-koppeling vroeg om twee sleutels terwijl eToro er maar een uitgeeft. Kader bewaarde een sleutel voor demo en een voor echt, en stond jouw sleutel in het andere vakje dan de omgeving waar de app op stond, dan gebeurde er domweg niets: Instellingen zei dat je gekoppeld was terwijl de importknop meldde dat er geen koppeling was. Er is nu nog een rij "eToro-sleutel", en die sleutel werkt in allebei de omgevingen. Wat naar je echte account gaat en wat naar je oefenaccount hangt alleen nog af van de schakelaar Demo/Echt',
      'Sleutels die al op je toestel staan blijven gewoon werken en je begint in dezelfde omgeving als voorheen. Stond je enige sleutel onder "demo", dan pakt Kader hem daar op en ben je meteen weer gekoppeld. Stonden er twee verschillende sleutels, dan houdt Kader de echte aan en laat hij de andere met rust: een User Key laat eToro maar een keer zien, dus die gooien we niet weg',
      'De melding "ongeldige API-sleutel" wees de verkeerde kant op. Die zei dat je waarschijnlijk op de verkeerde omgeving stond, maar dezelfde sleutel hoort in demo en in echt te werken, dus daar lag het nooit aan. De melding vertelt nu wat er wel aan de hand kan zijn: je sleutel is bij eToro ingetrokken of opnieuw aangemaakt, en dan moet je beide velden opnieuw invullen',
      'De verbindingstest in de koppelwizard toetst nu allebei de omgevingen en zet de uitslag er per omgeving bij. Weigert eToro je sleutel op een van de twee, dan zie je dat meteen in plaats van pas bij het omschakelen',
      'Kon Kader de beveiligde opslag van je toestel even niet bereiken, dan meldde de app opgewekt dat er geen koppeling was en bleef de statusindicator groen. Nu staat er wat er werkelijk aan de hand is',
    ],
  },
  {
    versie: '0.1.14',
    datum: '2026-08-25',
    punten: [
      'Het Markt-scherm kwam na een analyse leeg terug: er stond "0 coins geanalyseerd" terwijl alle 57 coins wel degelijk opgehaald waren. De oorzaak was de eis van minimaal 1:2 tussen risico en opbrengst. Ligt de steun ver onder de koers, zoals op dit moment bij vrijwel de hele markt, dan haalt geen enkele coin die verhouding en verdween dus de complete lijst, zonder enige uitleg. Coins die de drempel niet halen blijven nu staan met hun werkelijke verhouding er oranje bij, maar krijgen nooit een koopsignaal en tellen niet mee voor "Wat moet ik nu kopen?". Haalt geen enkele coin de drempel, dan legt een balk bovenaan uit waarom er die dag niets tussen staat',
      'Koersen onder een cent waren niet af te lezen. SHIB en PEPE stonden allebei op "$0.00001", en alles onder een half miljoenste dollar werd zelfs "$0.00000". Kleine koersen krijgen nu zoveel decimalen als ze nodig hebben, dus SHIB staat er nu als "$0.00000547"',
      'Nieuw onder Instellingen: kies of je bedragen in dollars of in euro\'s ziet. De keuze geldt voor koersen, je portfolio, winst en verlies, en de meldingen, en wordt onthouden. De wisselkoers komt van CoinGecko en wordt een halve dag bewaard, zodat de app ook zonder internet in euro\'s opent. Lukt het ophalen niet, dan blijft de app in dollars staan in plaats van met een verzonnen koers te rekenen. De orderschermen blijven altijd in dollars, want eToro rekent daarin af; tik je daar een bedrag in, dan staat de euro-tegenwaarde eronder',
      'De melding "ongeldige API-sleutel" bij het synchroniseren zei niet waar het misging. eToro geeft dezelfde weigering voor een sleutel die echt fout is en voor een goede sleutel die naar de verkeerde omgeving ging. De melding noemt nu de omgeving en vertelt wat je kunt doen: staat Kader op demo terwijl je alleen een sleutel voor je echte account hebt, dan zet je de schakelaar bij Instellingen op Echt',
      'De verbindingstest in de koppelwizard controleerde alleen je account, en dat adres is gelijk voor demo en echt. Een sleutel die in demo nergens werkt kreeg daardoor toch een groene "verbinding OK" en viel pas om bij de eerste synchronisatie. De test haalt nu ook je portfolio op en toetst zo echt de gekozen omgeving',
      'Bij het opstarten konden twee gelijktijdige lezingen van je opgeslagen eToro-sleutels elkaar in de weg zitten tijdens de verhuizing naar de beveiligde opslag. In het ongelukkigste geval las de app een lege sleutel en dacht hij de rest van de sessie dat je niet gekoppeld was. Die verhuizing gebeurt nu nog maar één keer tegelijk',
    ],
  },
  {
    versie: '0.1.13',
    datum: '2026-08-07',
    punten: [
      'Direct handelen via eToro. Vanaf het Markt-scherm, Grote Kansen en het coin-detailscherm kun je een coin nu meteen kopen: Kader vult het bedrag, de stop-loss en het doel voor je in en stuurt de order pas nadat je die in de sheet bevestigt',
      'Vanuit je portfolio kun je een eToro-positie verkopen en de stop-loss of het doel van een lopende positie aanpassen, zonder over te tikken in de eToro-app',
      'Een schakelaar tussen demo en echt onder Instellingen. Kader staat standaard op demo, zodat orders naar je oefenaccount bij eToro gaan; overschakelen naar echt vraagt eerst een bevestiging. Zolang demo actief is staat er een oranje DEMO-label bovenin het scherm',
      'eToro eist voor sommige coins een minimale afstand tussen je aankoopprijs en je stop-loss (bij bitcoin bijvoorbeeld 10%). Ligt de stop van Kader dichterbij, dan schuift Kader hem op naar de dichtstbijzijnde waarde die eToro accepteert en zie je dat in de sheet staan, inclusief wat dat met je risico doet',
      'Je eToro-sleutels staan nu in de beveiligde opslag van je toestel in plaats van in de gewone app-opslag. Bestaande sleutels verhuizen automatisch bij de eerste start',
      'De app doet niet meer mee aan Android\'s automatische back-up naar Google Drive. Dat hield een kopie van je sleutels buiten je toestel. Gevolg: stap je over naar een nieuw toestel, dan komt je lokale portfolio niet meer vanzelf mee. Je posities uit eToro haalt Kader daar gewoon opnieuw op',
    ],
  },
  {
    versie: '0.1.12',
    datum: '2026-07-29',
    punten: [
      'Je open trades staan nu gegroepeerd per bron: posities die uit eToro komen en posities die je zelf hebt ingevoerd staan onder een eigen balk, die je kunt in- en uitklappen. Die keuze onthoudt de app. Heb je maar één bron, dan blijft het overzicht ongewijzigd',
      'Op het trade-toevoegen-scherm stond een voorgestelde stop-loss met daaronder soms de melding dat eToro die waarde niet accepteert. Ligt de stop buiten eToro\'s grens, dan schuift Kader hem nu naar de dichtstbijzijnde waarde die eToro wel neemt, met de uitleg erbij. Laat eToro de stop voor die coin helemaal niet instellen, dan staat het niveau er als "STOP (KADER)": het niveau dat je terugziet bij je trade in het portfolio, niet iets om op eToro in te vullen',
      'De R/R op dat scherm rekent nu mee met de aankoopprijs die je zelf invult en met de eventueel bijgestelde stop. Wat je ziet is ook wat er opgeslagen wordt',
      'Tik je een aankoopprijs in die onder de voorgestelde stop-loss ligt, dan slaat Kader die trade niet meer op maar vraagt hij je de aankoopprijs na te kijken. Zo\'n trade stond anders meteen als "stop geraakt" in je portfolio',
      'Sheets en pop-ups openen nu met een fadende donkere achtergrond in plaats van een donker vlak dat van onderaf mee omhoog schoof. Het witte vel komt daar rustig overheen op. Geldt voor alle sheets in de app, en respecteert nu ook de systeeminstelling voor verminderde beweging',
    ],
  },
  {
    versie: '0.1.11',
    datum: '2026-07-22',
    punten: [
      'Belletje, boek en tandwiel in de header zijn samengevoegd tot één kebab-menu (drie puntjes) om de balk minder vol te maken. Een rood bolletje op het icoon geeft aan dat er ongelezen meldingen zijn; het aantal staat op de "Meldingen"-regel in het uitklapmenu zelf',
    ],
  },
  {
    versie: '0.1.10',
    datum: '2026-07-20',
    punten: [
      'Dagelijkse analyse-herinnering kwam elke ochtend twee keer binnen. Oorzaak: een dagelijkse melding die een oudere app-versie ooit onder een andere identifier insplande werd bij het opruimen nooit geraakt en bleef naast de nieuwe afgaan. Bij het opstarten worden nu alle ingeplande meldingen gewist voordat de herinnering opnieuw wordt ingepland',
      'De uurrem voor trade-meldingen wordt nu geclaimd vóórdat het werk begint in plaats van pas na het versturen, zodat een overlap tussen de voorgrondcheck en de achtergrondtaak dezelfde melding niet meer dubbel kan sturen',
      'Meldingen zijn nu terug te lezen in de app: het belletje in de header toont een teller en opent een overzicht met titel, uitleg en tijdstip, ook als de melding zelf al uit de notificatiebalk is verdwenen',
    ],
  },
  {
    versie: '0.1.9',
    datum: '2026-07-17',
    punten: [
      'Meldingenbom bij het openen van de app opgelost. Het plafond van drie meldingen per ronde uit 0.1.8 knipte de lijst wel af, maar gooide de rest niet weg: die kwam vijf minuten later alsnog binnen, met exact dezelfde titel. Zo kreeg je alsnog een stapel meldingen die op duplicaten leken. Alle signalen van een ronde gaan nu in één melding en Kader stuurt er hooguit één per uur',
      'Een nieuwe trade-melding vervangt de vorige in je meldingsbalk in plaats van erbovenop te stapelen. Draaide de achtergrondcheck \'s nachts een paar keer, dan stond er \'s ochtends een rij klaar; nu staat er altijd hooguit één',
      'Dezelfde melding komt weer echt hooguit eens per zes uur terug. De uitzondering "tenzij het voorgestelde niveau meer dan 2% verschuift" is vervallen: dat niveau volgt de live koers, en omdat crypto routineus 2% per uur beweegt herlaadde die uitzondering zichzelf op koersruis in plaats van op nieuws',
    ],
  },
  {
    versie: '0.1.8',
    datum: '2026-07-16',
    punten: [
      'Notificatiewaslijst bij het openen van de app opgelost: trade-meldingen hadden geen totaalplafond, dus als meerdere open trades tegelijk een trigger raakten (typisch na een tijdje afwezigheid) kwamen ze allemaal los binnen. Nu worden meerdere meldingen in één ronde gebundeld tot één melding, met een maximum van drie per ronde',
    ],
  },
  {
    versie: '0.1.7',
    datum: '2026-07-16',
    punten: [
      'Trade-bewuste meldingen: Kader checkt nu periodiek je open trades en stuurt alleen een melding als er iets te doen valt. Je doel komt in zicht terwijl het momentum nog sterk is (met een voorstel om je doel te verhogen), of je staat in winst terwijl het momentum afvlakt (met een voorstel om je stop aan te trekken en die winst vast te zetten)',
      'Melding bij een heel sterk koopsignaal: alleen voor high conviction-kansen in coins die je nog niet in je portfolio hebt. De marktklimaat-poort geldt ook hier, dus in een ongunstig klimaat blijft het stil',
      'Deze checks lopen ook door als de app dicht is. Android bepaalt zelf wanneer, met een ondergrens van een kwartier, dus een melding kan iets later komen dan het moment zelf. Zolang de app open staat wordt er elke vijf minuten gekeken',
      'Dezelfde melding komt hooguit eens per zes uur terug, tenzij het voorgestelde niveau meer dan 2% verschuift',
      'Overgang tussen tabbladen flitst niet meer op 60Hz-toestellen: er zat nog één leeg beeldje tussen het oude en het nieuwe scherm. Ook worden de schermen die je niet bekijkt niet langer opnieuw getekend als de koersen op de achtergrond ververst worden',
    ],
  },
  {
    versie: '0.1.6',
    datum: '2026-07-13',
    punten: [
      'Marktsentiment op het Marktscherm vervangen door het marktklimaat: in plaats van het gemiddelde van de al berekende scores kijkt Kader nu naar BTC ten opzichte van zijn eigen 50-daags gemiddelde en naar de richting van de marktbreedte. Bij een ongunstig klimaat toont de balk een expliciete waarschuwing',
      'Poort op de koopsignalen: staat het marktklimaat niet gunstig, dan toont Kader geen enkel KOOP-signaal meer, ongeacht de score. Uit een meting over negen jaar historie bleek dat koopsignalen in zo\'n klimaat (2018, 2022, begin 2026) gemiddeld geld verloren. Sommige dagen toont de app daardoor bewust niets',
      '"Wat moet ik nu kopen" toont voortaan alleen nog high conviction-kansen in plaats van elke coin vanaf score 60',
      'Alle score-drempels staan nu op één plek in de code met de gemeten resultaten erbij. De achtergrondinformatie en de onboarding zijn bijgewerkt op een paar plekken die niet meer klopten',
    ],
  },
  {
    versie: '0.1.5',
    datum: '2026-07-13',
    punten: [
      'Onderste tradekaart op het Portfolio-scherm werd afgekapt boven een lege grijze strook (bij 3-knops-navigatie op Android). De ruimte onder de tabbalk werd dubbel opgeteld; nu klopt de ruimte weer op alle vier de tabbladen',
      'De overgang tussen tabbladen kon knipperen op sommige toestellen (met name Samsung, 120 Hz). Schermen blijven nu gemount na een eerste bezoek en faden over elkaar heen in plaats van eerst helemaal te verdwijnen, dus geen leeg frame meer. Als bonus onthouden Grote Kansen en de Markt-filters nu ook hun stand bij het wisselen van tabblad',
      'Compacte weergave toegevoegd op het Portfolio-scherm: een schakelaar boven de tradelijst wisselt tussen de bestaande uitgebreide kaarten en compacte regels, zodat je in één oogopslag meer open trades ziet. Elke compacte regel toont het symbool, een kort advies, de live prijs, het resultaat en een dunne balk die laat zien waar de koers tussen stop en doel staat. Acties (Gewonnen/Verloren/Aanpassen/Verwijderen) zijn bereikbaar via een kebab-menu per regel. De gekozen weergave wordt onthouden',
    ],
  },
  {
    versie: '0.1.4',
    datum: '2026-07-13',
    punten: [
      'De app kon niet meer bijgewerkt worden over een bestaande installatie heen ("App niet geïnstalleerd"). Dat lag niet aan de app zelf, maar aan een verkeerd versienummer in de build: sinds versie 0.1.0 was de native build niet meer opnieuw gegenereerd, waardoor eerdere releases in werkelijkheid een lager versienummer bevatten dan wat er al op sommige telefoons stond. Vanaf nu installeert de update gewoon over de vorige versie heen, met behoud van je portfolio',
    ],
  },
  {
    versie: '0.1.3',
    datum: '2026-07-12',
    punten: [
      'Het import-wolkje bij je portfoliowaarde kleurt nu mee met de sync-status (groen/oranje/rood), net als het ernaast staande verversicoon, in plaats van altijd blauw te blijven. Eronder staat nu ook een adviesregel zodra de gegevens niet meer actueel zijn',
      'De app synchroniseert nu ook je eToro-posities en -historie zodra je terugkeert uit de achtergrond (niet alleen de koersen), met een korte pauze tussen synchronisaties zodat eToro\'s aanvraaglimiet niet te snel vol loopt',
      'Naar beneden swipen op het Marktscherm liet je hele lijst verdwijnen voor een laadscherm. Ververst nu op de achtergrond terwijl je lijst gewoon zichtbaar blijft, met dezelfde verbetering op het Grote Kansen-scherm',
      'Instellingen, Wijzigingen, filters, de eToro-koppelvraag en alle formulieren sluiten nu ook als je buiten het venster tikt, niet alleen met het kruisje. Ze houden ook rekening met de gesturebalk onderaan, zodat de onderste knop niet meer verstopt zit',
      'Het "Trade toevoegen"-formulier onthoudt nu wat je hebt ingevuld als je tussendoor naar eToro schakelt om de prijs te checken en terugkomt',
      'eToro accepteert niet elke stop-loss: ligt die te dicht op of te ver van je aankoopprijs, dan weigert eToro de order. Het Getrade-formulier waarschuwt nu vooraf, met de echte grenzen die eToro voor die coin hanteert. Zonder eToro-koppeling zie je geen waarschuwing',
    ],
  },
  {
    versie: '0.1.2',
    datum: '2026-07-10',
    punten: [
      'Sync-status bij je portfoliowaarde: het sync-icoon boven de portfoliokaart kleurt nu mee zodat je in één oogopslag ziet of je gegevens actueel zijn. Grijsgroen = net bijgewerkt, oranje = raakt verouderd, rood = te lang niet gesynchroniseerd of de laatste poging mislukte. Eronder staat wanneer er voor het laatst is gesynchroniseerd',
      'De app ververst nu automatisch zodra je hem weer opent, zodat de koersen niet verouderd op je scherm blijven staan nadat de app op de achtergrond stond',
      'Het app-icoon is kleiner gemaakt zodat het Kader-merkteken netjes binnen de ronde cirkel op je startscherm valt in plaats van tegen de rand aan te lopen',
      'Het opstartscherm (splash) toont weer het juiste Kader-logo op een blauwe achtergrond in plaats van het oude ontwerp',
      'Een mislukte eToro-synchronisatie wordt nu ook echt gemeld. Zolang de koersen binnenkwamen kleurde de status groen met "bijgewerkt", ook als je posities helemaal niet waren opgehaald (bijvoorbeeld door een verlopen sleutel). De status staat nu oranje met de reden erbij',
      'Het totaalresultaat in je statistieken gebruikt voortaan het werkelijke bedrag van eToro, inclusief kosten, in plaats van alleen het koersverschil. Daardoor spraken je trefferpercentage en je totaalbedrag elkaar niet meer tegen',
      'Trades zonder stop-loss tellen niet langer mee in je gemiddelde behaalde R/R. Zonder stop-loss valt er geen R te berekenen, en die trades trokken het gemiddelde naar nul zodra je eToro-historie was ingelezen',
      'Een trade die net boven je instapprijs sloot maar door de kosten toch verlies opleverde, liet een groen plusje zien naast een rood "verloren". Kleur en bedrag tonen nu allebei het werkelijke resultaat',
      'Een verwijderde eToro-trade blijft nu verwijderd. Eerder zette de eerstvolgende synchronisatie hem er gewoon weer bij',
      'Had je een trade zelf ingevoerd voordat je eToro koppelde, dan kwam dezelfde trade via de historie een tweede keer in je overzicht. Die worden nu herkend en samengevoegd',
      'Net geïmporteerde eToro-posities tonen meteen hun koers en waarde, in plaats van pas na een minuut',
      'TON werd bij het importeren ten onrechte niet als crypto herkend en dus overgeslagen',
      'Synchroniseren doet minder verzoeken aan eToro, waardoor je minder snel tegen de aanvraaglimiet aanloopt',
    ],
  },
  {
    versie: '0.1.1',
    datum: '2026-07-10',
    punten: [
      'De marktanalyse doorzoekt nu 57 coins in plaats van 24 (dezelfde lijst als wat je op eToro kunt kopen), toont tot 20 kansen in plaats van 10, en draait merkbaar sneller doordat coins nu in groepjes tegelijk worden opgehaald in plaats van één voor één. Twee coins (MATIC, RNDR) draaiden op de koersbron al een tijdje onder een andere naam (POL, RENDER) en misten daardoor stil; dat is nu opgelost',
      'Grote Kansen-scan toont nu ook tot 20 kansen in plaats van 10, en haalt de koersdata voor de kandidaten net als de marktanalyse in groepjes tegelijk op in plaats van één voor één, dus de scan is merkbaar sneller klaar',
      'Trades die je op eToro sluit, worden nu automatisch afgesloten in je portfolio, met de echte verkoopprijs en het werkelijke resultaat inclusief kosten. Gebeurt bij het openen van de app, bij het naar beneden swipen op Mijn Trades en bij de eToro-knop',
      'Je eToro-handelshistorie van het afgelopen jaar wordt eenmalig ingelezen, zodat je Historie-scherm en de statistieken (trefferpercentage, gemiddelde R/R, totaal resultaat) meteen kloppen. Posities die Kader al kende worden niet dubbel toegevoegd',
      'Na het instellen van de eToro-koppeling wordt er meteen gesynchroniseerd, je hoeft de app niet opnieuw te openen',
      'Naar beneden swipen op Mijn Trades synchroniseert nu: koersen verversen, open eToro-posities bijwerken en gesloten posities afsluiten',
      'De tabbalk onderaan valt niet langer onder de menu-, home- en terugknoppen van je toestel (viel op onder meer Samsung-toestellen)',
      'De eToro-knop op de portfoliokaart heeft een duidelijker icoon (wolk met pijl) in plaats van het downloadsymbool',
      'Een verlies in dollars toont nu een minteken. Eerder stond er bijvoorbeeld "$4.21" waar "−$4.21" hoorde, en verried alleen de rode kleur dat het een verlies was',
    ],
  },
  {
    versie: '0.1.0',
    datum: '2026-07-07',
    feest: true,
    punten: [
      'Portfolio importeren uit eToro: koppel een alleen-lezen API-sleutel en haal je open crypto-posities op. Bestaande geïmporteerde posities worden bijgewerkt in plaats van dubbel toegevoegd',
      'eToro-koppeling instellen gaat nu via een stap-voor-stap wizard onder Instellingen (uitleg, publieke sleutel, privésleutel, en testen met bevestiging aan het eind) in plaats van een altijd zichtbaar invulblok',
      'Tonen/verbergen-oogje zit nu bij beide sleutelvelden en is per veld te bedienen',
      'eToro-koppeling kun je nu ook weer verwijderen van het toestel',
      'Nieuwe portfolio-statuskaart bovenaan Mijn Trades: huidige waarde van je open posities, ingelegd bedrag en ongerealiseerd resultaat (bedrag en percentage), met de live-koersstatus erbij',
      'Topbalk op Mijn Trades opgeschoond: de titel past weer op één regel. De ververs- en eToro-importknop zijn verhuisd naar de statuskaart',
      'Afgesloten trades staan nu in een apart historie-scherm (via de knop op de statuskaart) met trefferpercentage, gemiddelde behaalde R/R en totaal resultaat. Het hoofdscherm toont voortaan alleen je open trades',
      'De portfoliowaarde en het ongerealiseerd resultaat tellen nu soepel mee (count-up) bij elke koers-sync',
      'Soepele slide/fade-overgangen tussen de stappen van de eToro-wizard en de onboarding',
      'Als eToro nog niet gekoppeld is, verwijzen we je bij de eerste start van v0.1 direct naar de koppeling',
      'Feestelijke opening van v0.1: een welkomscherm met confetti en vallende gouden bitcoins',
      '"Wat moet ik nu kopen?"-kaart houdt nu rekening met de actieve tab- en filterkeuzes op het Marktscherm in plaats van altijd alle coins te wegen',
      'Achtergrondinformatie staat weer als los boek-icoon in de schermheader, niet meer onder Instellingen',
      'Schermovergang bij tabwissel flitst niet meer kort volledig zichtbaar voordat hij infadet',
      'App-icoon (Kader-logo v2) wordt weer correct meegebouwd, zodat het nieuwe icoon ook bij een update op je startscherm verschijnt',
    ],
  },
  {
    versie: '0.0.8',
    datum: '2026-07-07',
    punten: [
      'Tikfout in het kopje "MARKTSENTIMENT" boven de marktbalk hersteld',
      'Op het tabblad Favorieten zonder favorieten zie je nu altijd de uitleg om coins met de ster te verzamelen, ook als er een filter actief staat',
    ],
  },
  {
    versie: '0.0.7',
    datum: '2026-07-07',
    punten: [
      'Vloeiende overgangsanimatie bij het wisselen tussen Markt, Kansen, Portfolio en Traders',
      'Filters op RSI (oversold/overbought), minimale score en minimale R/R op het Marktscherm, naast de tabs Alle coins/Favorieten, met een vloeiende overgang bij het wisselen',
      'Achtergrondinformatie is verplaatst van een los boekje in de schermheader naar Instellingen (boven Wijzigingen); dat lost ook een te krappe titel op het Mijn Trades-scherm op',
      '"Wat moet ik nu kopen?"-kaart toont nu een duidelijke "Tik voor meer info"-hint rechtsonder',
    ],
  },
  {
    versie: '0.0.6',
    datum: '2026-07-07',
    punten: [
      'Nieuw Kader-logo (open kader-mark): outline-variant linksboven in elke schermheader, donker-thema variant in het app-icoon, adaptive icon en de splash',
      '"Wat moet ik nu kopen?": nieuwe kaart bovenaan het Marktscherm met de best scorende koopkans en de reden in één zin, of een neutrale melding als niets sterk genoeg scoort',
      'Filtertabs "Alle coins" / "Favorieten" boven de tradelijst op het Marktscherm',
      'Uitklapbare uitleg bij de Fear & Greed-index en bij de marktsentimentbalk over wat de waarde betekent',
      'Coin-detailscherm heeft nu ook een Getrade-knop, zodat je vanuit het detailscherm direct een trade kunt vastleggen',
      'Laadbalk tijdens het analyseren (Markt) en scannen (Grote Kansen): vloeiend geanimeerd, toont het percentage en heeft meer ruimte voordat de skeletkaarten beginnen',
    ],
  },
  {
    versie: '0.0.5',
    datum: '2026-07-03',
    punten: [
      'Stop-loss ligt nu net onder de recente steun (laagste van de laatste tien candles) in plaats van een vaste 1,5 keer ATR; daardoor verschilt de risico/beloning per coin en filtert de app coins met te weinig ruimte nu ook echt weg',
      'Bij het sluiten van een trade vraagt de app tegen welke prijs je hebt verkocht: take-profit of stop-loss zijn voorgevuld, maar je kunt de werkelijke verkoopprijs invullen zodat trefferpercentage en behaald resultaat niet meer uiteenlopen',
      'Prijzen ophalen is robuuster: een kapot of afgekapt netwerkantwoord laat de app niet meer één keer per coin de hele prijs-sync afbreken, en de noodterugval op koersdata werkt nu daadwerkelijk als de directe prijs-endpoints geblokkeerd zijn',
      'Kleinere correcties in de score: een volumepiek wordt eerlijker gemeten (de piek-candle telt niet meer in zijn eigen gemiddelde mee) en het MACD-histogram levert alleen extra punten op als het echt stijgt',
    ],
  },
  {
    versie: '0.0.4',
    datum: '2026-07-03',
    punten: [
      'Trade opslaan vanuit Grote Kansen: kaarten met technische niveaus hebben nu een Getrade-knop, identiek aan het Marktscherm',
      'Bedrag in $ en aantal coins zijn nu ook in te vullen bij het handmatig toevoegen of aanpassen van een trade in Mijn Trades (aantal coins wordt automatisch berekend uit bedrag en aankoopprijs)',
      'Open trades in Mijn Trades hebben nu een meekleurende zijkant op basis van het actuele advies, net als op het Marktscherm',
      'Grote Kansen-kaarten tonen nu ook marktcap, trend, MACD en de kansscore waarop gesorteerd wordt',
      'Gesloten trades in Mijn Trades leggen nu de exitprijs vast en tonen het behaalde resultaat; een nieuwe statistiekenrij toont trefferpercentage, gemiddelde behaalde R/R en totaal resultaat zodra er gesloten trades zijn',
      'Coin-detailscherm voor een open trade toont nu ook de afstand tot stop-loss en take-profit; voor een gesloten trade toont het de exitprijs, slotdatum en het behaalde resultaat',
      'Achtergrond informatie: een boek-icoon in de header van elk scherm opent uitleg over de Kader-score, indicatoren, stop/doel-berekening, marktbalk, Fear & Greed, kansscore, portfolio-statistieken en het trader-oordeel, met grafische voorbeelden',
    ],
  },
  {
    versie: '0.0.3',
    datum: '2026-07-02',
    punten: [
      'Coin detail-scherm: tik op een coin op Markt, Grote Kansen of in je portfolio voor een full-screen overzicht met koersgrafiek, entry/stop/take-profit-lijnen, verse indicatoren en een onderbouwing van het advies. De grafiek toont datum- en prijslabels en reageert op aanraken: sleep over de lijn voor de exacte datum en koers op dat punt',
      'Meer "waarom kopen"-onderbouwing in het uitklapvak van de kaart op het Marktscherm',
      'Wijzigingenoverzicht in de app onder Instellingen, plus een eenmalige melding bij de eerste start na een update',
      'Dark/light mode: systeem, licht of donker via het tandwiel-icoon',
      'Error boundary zodat een kapotte component niet de hele app laat crashen',
      'Offline-melding op Markt- en Kansen-scherm gedeeld via één component',
      'Trade aanpassen in Mijn Trades: stop-loss en take-profit wijzigen, R/R herberekend',
      'Favorietenlijst op het Marktscherm: coins markeren met een ster, sorteren bovenaan',
      'Fear & Greed Index zichtbaar op het Marktscherm naast de Kader-marktbalk',
    ],
  },
  {
    versie: '0.0.2',
    datum: '2026-07-02',
    punten: [
      'Toetsenbord bedekte niet langer de invulvelden in de modal-formulieren (Trade toevoegen, Trade bijhouden, Trader beoordelen)',
    ],
  },
  {
    versie: '0.0.1',
    datum: '2026-06-28',
    punten: [
      'Eerste volledige release van de Kader-app (com.kader.app)',
      'Officieel Kader-logo in iconen en in de app',
      'Marktsentimentbalk (SELL/BALANCED/BUY)',
      'Skeleton-laadstate en pull-to-refresh op Markt en Kansen',
      'LayoutAnimation respecteert reduced-motion',
    ],
  },
];

export function nieuwsteVersie(): string {
  return CHANGELOG[0]?.versie ?? '0.0.0';
}
