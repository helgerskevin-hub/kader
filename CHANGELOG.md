# Changelog

Alle noemenswaardige wijzigingen aan de Kader-app staan hier per versie,
nieuwste bovenaan. Zie ook `app/src/changelog.ts`, de bron die de app zelf
gebruikt voor het wijzigingen-scherm en de "nieuw in deze versie"-melding.

## 0.1.22

- Het balkje op de portfoliokaart laat nu echt zien hoe je geld verdeeld is over posities en cash. Het tekende al wel, maar zodra er weinig cash op je rekening stond was het grijze stukje een paar pixels breed, en onder een procent zag je alleen nog een effen blauwe lijn. Dat is precies de situatie waar de meeste mensen in zitten, dus in de praktijk liet de balk geen verdeling zien. Een klein aandeel krijgt nu een minimumbreedte zodat het altijd zichtbaar blijft, en het echte percentage staat ernaast in de legenda: IN POSITIES 99,7% tegenover BESCHIKBAAR 0,3%. Dat getal is altijd de waarheid, ook als het stukje op de balk iets breder getekend is dan het in werkelijkheid is. De balk zelf is ook iets dikker geworden
- Nieuw op de portfoliokaart: je resultaat over een periode, met knoppen voor Dag, 1M, 3M, 6M, 1J en Alles. De vijf tijdvakken zijn even grote rondjes, Alles is als enige een breder blokje omdat het geen tijdvak is maar de uitzondering erop. Dat cijfer telt twee dingen bij elkaar op, wat je in die periode hebt afgesloten en wat je nog open posities in diezelfde periode aan koers wonnen of verloren. Voor dat tweede deel haalt Kader de koers van toen op bij Binance, een keer per coin per dag, dus na het eerste ophalen is wisselen tussen de knoppen meteen klaar. Kan Kader de koers van toen voor een positie niet vinden, dan telt die positie niet mee en staat dat eronder. Lukt het voor geen enkele positie, dan verandert de kop in "Gerealiseerd resultaat", zodat je nooit denkt dat je een compleet cijfer ziet terwijl het de helft is. Dit is iets anders dan de groene of rode regel bovenaan de kaart: die gaat over je open posities sinds je ze kocht en heeft geen tijdvak
- Kader bewaart vanaf nu het exacte tijdstip waarop een positie geopend is. Dat is nodig voor het resultaat over een periode, want zonder dat tijdstip is niet te zeggen of een positie er aan het begin van die periode al was en of de koersbeweging van daarvoor wel van jou is geweest. Posities die uit eToro komen krijgen het bij de eerstvolgende synchronisatie vanzelf. Bij handmatige trades van voor deze versie ontbreekt het, en die tellen dan alleen mee bij Alles

## 0.1.21

- In het rondje rechtsboven op een kaart staat nu het echte logo van eToro in plaats van een letter E. Dat mocht eerder niet: hun logo zat niet in de app en een nagetekende versie is erger dan een eigen vorm. We hebben nu toestemming om het te gebruiken, dus het onbewerkte bestand zit er nu in. Een platform waar we geen logo van hebben of mogen gebruiken houdt gewoon zijn letter in een vaste kleur
- De regel onderaan het marktscherm noemde alleen Binance en CoinGecko als bron, terwijl de angst-en-hebzuchtmeter op datzelfde scherm van Alternative.me komt. Alle drie de bronnen staan er nu
- Wilde je een coin kopen die Kader nog niet eerder had opgezocht, dan stond er meteen in het rood dat Kader die coin niet aan een eToro-instrument kon koppelen. Dat was niet waar: hij was nog aan het zoeken. Voor BTC merkte je het niet, want die staat na een keer kopen in het geheugen. Nu staat er "Kader zoekt PEPE op bij eToro..." zolang dat loopt, en pas als het echt niets oplevert komt de rode melding, met wat het dan kan zijn. Daarnaast is het zoeken zelf minder streng geworden op één punt: voerde eToro hetzelfde symbool twee keer op, bijvoorbeeld een oude regel die niet meer verhandeld wordt naast de levende, dan gaf Kader het op terwijl er maar één echte kandidaat was. Die dubbele regels vallen nu eerst af. Blijven er daarna twee bruikbare over, dan blijft kopen geblokkeerd: een verkeerd instrument opent een positie in een andere coin
- In het gat van de ring op het verdelingsscherm stond niets. Daar staat nu je ongerealiseerde resultaat over alles wat in die ring zit: het percentage over je inleg, met het bedrag eronder. Het rekent over precies dezelfde posities als de ring zelf, dus over open posities waarvan Kader het aantal munten en de live koers kent
- Het balkje op de portfoliokaart dat laat zien hoe je geld verdeeld is over posities en cash was helemaal leeg. Er waren twee dingen mis. De twee stukken kregen hun breedte uit een verhouding tussen de bedragen zelf, en daar kwam op Android geen breedte uit: er bleef alleen de lege baan over, ongeacht wat er in je portfolio stond. En het cash-stuk had exact dezelfde kleur als die baan, dus zelfs met breedte was het onzichtbaar geweest. De breedte wordt nu als percentage uitgerekend en beide stukken hebben een eigen kleur, met het bolletje in de legenda erbij

## 0.1.20

- De melding "nieuw in deze versie" is eindelijk te scrollen, en met hem elke andere sheet met een lijst erin, zoals het formulier om een trade bij te houden. Daar viel de knop onderaan buiten beeld. Er waren twee dingen aan de hand. De lijst had geen eigen hoogte, en in React Native krimpt een lijst niet vanzelf binnen een venster: hij groeide door tot zijn volle inhoud en liep er onderaan uit, waar hij werd afgekapt. En het vel van een sheet zat zelf in een aantikbaar vlak, dat op Android de veeg opving voordat de lijst hem kon zien. Dat vlak ligt nu naast het vel in plaats van eromheen, en de lijst heeft een uitgerekende hoogte met een scrollbalk ernaast
- De verdelingskaart in Portfolio zet de percentages in een rechte kolom aan de rechterkant, in plaats van achter de naam van de coin. Ze stonden daardoor per rij op een andere plek, en juist dat getal is waar de kaart om draait: nu kun je met je oog van boven naar beneden lopen
- Tik op de verdelingskaart en je krijgt het volledige overzicht op een eigen scherm. Alle coins zonder samenvouwing tot Overig, met een staafje per coin. Daaronder je verdeling per platform, dus hoeveel er bij eToro staat en hoeveel je zelf hebt ingevoerd, en welke coin op meer dan één plek staat. Onderaan een blok "Wat opvalt" met feitelijke observaties over je concentratie, en een blok met de posities die Kader niet kon wegen, met de reden erbij. Nu zijn dat twee bronnen; het scherm is gebouwd om er platforms bij te krijgen
- Na een geplaatste order staat er naast Oké een tweede knop, "Naar portfolio", die je meteen naar je posities brengt. De tekst van die melding verwees al naar je portfolio, dus er hoorde ook een knop naartoe te gaan
- Bij een coin die de risico-opbrengstverhouding niet haalt stond onder "1 : 1.3" de melding "onder 1:2". Dat las als "onder 1,2", een grens die het getal erboven ruim haalt. Er staat nu "onder 1 : 2.0", in dezelfde schaal als de waarde zelf
- De kaarten op Markt laten hun niveau weer zien zonder dat je de badge hoeft te lezen. Sinds de gekleurde streep weg is verschilden ze alleen nog in een randje en een schaduw, en dat was in een lijst van twintig kaarten te weinig. Het verschil loopt nu over vier dingen tegelijk: high conviction krijgt een volle rand en als enige een gevulde badge, sterk koop een groene haarlijn, koopzone is de gewone kaart, en afwachten krijgt de achtergrond van het scherm zelf en geen schaduw, en ligt daarmee plat op de pagina. Bij de bovenste twee staat het symbool ook groter
- Het scorecijfer staat nu in de adviesbadge zelf, als "STERK KOOP · 74". Het stond onderaan in de rij naast R/R en RSI, in dezelfde grootte en kleur, terwijl het het cijfer is dat het meest zegt. Zo draagt een element zowel het oordeel als de maat ervan, en staat het nog steeds maar een keer op de kaart
- Rechtsboven op elke kaart staat nu op welke platforms die coin te koop is, als klein merkje. Er kunnen er meerdere naast elkaar staan zodra er een tweede platform bij komt
- Het woord ETORO naast STOP is vervangen door een pil AANGEPAST. Dat woord betekende namelijk niet "verhandelbaar op eToro" maar "deze stop is opgeschoven naar het niveau dat eToro nog accepteert", en als merknaam naast een prijs las het als een logo op een rare plek. Waarom hij is opgeschoven staat nog steeds voluit in de uitklap van de kaart
- De aanwijzer op de koersgrafiek volgt je vinger nu op elke periode. Hij liep alleen goed op 3M: op 1M schoot de lijn bijna drie keer zo hard als je vinger en viel hij na een derde van de breedte weg, op 6M en Alles kroop hij er juist achteraan. De grafiek bleef namelijk rekenen met het aantal punten van de periode waarin het scherm was geopend
- Geld dat vastzit in een order die eToro nog niet heeft gevuld telt niet meer mee als beschikbaar. Staat er bijvoorbeeld een kooporder op een aandeel terwijl de beurs dicht is, dan houdt eToro dat bedrag vast maar toont het nog gewoon als cash. Kader liet je daardoor kopen met geld dat er niet was, en eToro weigerde die order. Zowel de kooporder als de portfoliokaart trekken dat bedrag er nu af, met een regel erbij waarom je beschikbare bedrag lager is dan de cash die eToro toont. Kan Kader het bedrag van zo'n order niet lezen, dan trekt hij niets af en meldt hij alleen dat er iets in de wacht staat
- Tik op het merkje rechtsboven op een kaart en je ziet bij welke providers je die coin kunt kopen. Het merkje staat er vanaf nu alleen als Kader de order zélf kan plaatsen. Moet je het bij de provider zelf doen, dan staat er niets, en dan is er ook geen koopknop. Dat betekent niet dat de coin nergens te koop is, alleen dat Kader het niet voor je doet. Zonder die regel zou een merkje "hier kun je terecht" beloven terwijl de knop niets doet
- Nieuw hoofdstuk onder Informatie: "Waar je kunt kopen". Daar staat diezelfde regel, plus waarom het merkje een letter in een rondje is en niet het logo van de provider. Die logo's zijn niet van Kader en zitten niet in de app, en een zelfgetekende benadering van andermans merk is erger dan een eigen vorm. Elke provider krijgt een vaste letter en een vaste kleur
- VS BTC staat alleen nog op de kaart als het cijfer iets zegt. Tussen 10 procent achter en 25 procent voor op bitcoin is het gemeten verschil verwaarloosbaar, en dan stond er een kaal getal zonder betekenis naast R/R en RSI, die wél altijd iets zeggen. Daarbuiten is het een gemeten voordeel of nadeel en staat het woord achterblijver of voorloper er meteen bij. Op het coinscherm blijft het cijfer altijd staan, met de uitleg erbij
- De sterkste kaarten vallen beter op. Sterk koop had een groene haarlijn van 1 punt op 20 procent dekking, en die was in een scrollende lijst simpelweg niet te zien. Hij heeft nu een rand van 2 punten op 60 procent plus een zachte groene gloed eromheen. High conviction wordt in verhouding mee opgetrokken: een volle rand van 2 punten in het donkerblauw en een sterkere gloed, zodat die het hoogste niveau blijft

## 0.1.19

- Portfolio heeft een dashboard gekregen. Bovenaan staat je totale vermogen: de waarde van je open posities plus het geld dat nog vrij op je eToro-account staat, met een balkje dat laat zien hoe dat verdeeld is. Kent Kader je vrije saldo niet, omdat je niet gekoppeld bent of omdat eToro het veld niet meestuurt, dan staat er geen totaal maar alleen de waarde van je open posities, met de reden erbij. Een verzonnen bedrag is erger dan geen bedrag
- Nieuwe kaart eronder met een ring die laat zien hoe je posities verdeeld zijn, per coin het percentage en het bedrag. Heb je meer dan zeven posities, dan staan de zes grootste apart en vat Kader de rest samen als Overig, uitklapbaar. Posities waarvan Kader het aantal of de live koers niet kent tellen niet mee, en dat staat eronder
- De vierkante systeemvensters zijn vervangen door dialogen in de stijl van de app. Dat waren de meldingen van Android zelf, met een eigen lettertype en eigen knoppen die niets met Kader te maken hadden. Ze gaan nu over dezelfde vier soorten: informatie, gelukt, let op en fout
- Na een order krijg je nu een bevestiging. Die was er niet: de app had er wel code voor, maar geen enkel scherm gebruikte hem, dus je zag na het bevestigen alleen de sheet dichtgaan. Bij een verkoop staat het geschatte resultaat erbij, in procenten en in geld, met het aantal coins, je aankoopkoers en de koers van dat moment. Het is een schatting: eToro sluit op zijn eigen koers en rekent kosten, dus het echte bedrag komt binnen bij de volgende sync
- Weet Kader niet of je order is doorgegaan, dan zegt hij dat nu meteen, met de waarschuwing om niet opnieuw te versturen voordat je bij eToro hebt gekeken. Er staat bewust geen bedrag bij, ook al valt het uit te rekenen: een resultaat tonen bij een order waarvan we niet weten of hij is uitgevoerd, doet alsof we weten wat er gebeurd is
- Het scherm voor stop-loss en doel verspringt niet meer. Zette je een schakelaar om, dan verdween de regel eronder uit beeld en kromp het hele venster mee. De regel heeft nu een vaste plek die er ook is als hij leeg is, en er zit eindelijk ruimte onder. De schakelaar zelf is grijs geworden in plaats van groen: hij haalt je stop-loss wég, en dat is geen goedkeuring. Staat hij aan, dan kleurt die regel oranje met een waarschuwingsdriehoekje
- De gekleurde streep links op de trade-kaarten is weg. Die zei hetzelfde als de badge eronder en het scorecijfer ernaast, en stond ook op kaarten waar je juist niets hoefde te doen, waardoor alles even hard riep. Het oordeel staat nu bovenaan de kaart en het verschil zit in de kaart zelf: een high conviction-kans krijgt een rand en springt eruit, een afwachten-kaart verliest zijn schaduw en ligt plat op de achtergrond. In je portfolio zakt een afgesloten positie op dezelfde manier weg achter wat nog loopt
- Het scorecijfer stond twee keer op dezelfde kaart: als gekleurde badge naast de koers en nog eens als SCORE in de rij eronder. De badge is weg, het cijfer in de rij blijft. Samen met de adviesbadge waren dat drie kleuroordelen naast elkaar over hetzelfde signaal
- Skeleton-laadschermen pulseren nu zachtjes in plaats van een statisch grijs blok te tonen, zodat duidelijker is dat de app nog aan het laden is en niet is vastgelopen. Het coin-detailscherm toont tijdens het laden nu een skeleton in de vorm van de grafiek en de niveaus in plaats van alleen een spinner, en Portfolio en eToro-traders tonen bij de allereerste keer laden na het openen van de app skeleton-kaarten in plaats van eventjes de lege staat te tonen voordat de echte data verschijnt. Ververs je daarna (swipe of de eToro-knop), dan blijft de bestaande data gewoon staan; dat gedrag verandert niet. Staat verminderde beweging aan op je toestel, dan blijft het statische blok van vroeger staan
- "Mijn trades" heet vanaf nu Portfolio, en de kop boven je open posities heet "Open posities" in plaats van "Open trades". Dat geldt overal: de schermtitel, de meldingen die naar je trades verwijzen, en de uitleg onder het boek-icoon
- Stond er precies één sterk koopadvies in het vak "Wat moet ik nu kopen?", dan plakte die kaart tegen de linkerrand terwijl er rechts 32 punten ruimte wegviel. Bij twee of meer kandidaten, de swipe-carrousel, stonden de marges wel goed. Een enkele kaart krijgt nu dezelfde marges als een kaart in de carrousel

## 0.1.18

- De koersgrafiek op een coinscherm heeft nu knoppen voor de periode: 1M, 3M, 6M en Alles. De grafiek stond altijd vast op ongeveer drie maanden, dus een langere trend was er niet uit te lezen en een recente beweging verdronk in de rest. Drie maanden blijft de stand waarin het scherm opent. Er staan alleen knoppen die echt iets veranderen: geeft de bron voor die coin maar een maand geschiedenis terug, dan zou elke knop dezelfde lijn tonen en verdwijnt de rij helemaal. Kies je een periode die langer is dan wat er beschikbaar is, dan valt de grafiek terug op Alles in plaats van leeg te blijven
- De melding "nieuw in deze versie" en het scherm Wijzigingen onder Instellingen waren niet te scrollen: alles onder de eerste paar punten was simpelweg niet te bereiken. De lijst kon niet krimpen binnen het venster en liep er dus onderuit voorbij, waar hij werd afgekapt. Dat gold ook voor het meldingenoverzicht, dat sinds de prijsalerts lang genoeg kan worden om hetzelfde te raken
- Het menu rechtsboven noemt de uitleg nu "Informatie" in plaats van "Achtergrond", en het scherm zelf heet ook zo. "Achtergrond" leest als iets dat op de achtergrond draait, terwijl het gewoon de uitleg bij de app is

## 0.1.17

- Maakte je bij eToro een nieuwe API-sleutel aan, dan bleef Kader je oude User Key voorgevuld tonen. Gemaskeerd als bolletjes, dus stap 2 van de koppelwizard zag er ingevuld uit en je klikte eroverheen. Je koppelde daarmee een nieuwe publieke sleutel aan een oude User Key, en dat is precies de combinatie die eToro weigert. De verbindingstest zei dan dat je je sleutel opnieuw moest invullen, wat je net gedaan dacht te hebben. Vul je nu een andere publieke sleutel in, dan maakt Kader het User Key-veld leeg en legt uit waarom: eToro geeft bij een nieuwe sleutel ook een nieuwe User Key, en toont die maar een keer. Zet je de oude sleutel terug, dan komt de oude User Key ook weer terug
- Zegt eToro bij een geweigerde sleutel iets specifieks, dan staat dat er nu bij. Die uitleg werd weggegooid terwijl de app hem bij elke andere fout wel doorgaf. Gemeten antwoordt eToro op een geweigerde sleutel overigens alleen met "Unauthorized", ongeacht of je publieke sleutel fout is of je User Key; dat voegt niets toe aan de melding eromheen, dus in dat geval blijft het er bewust af. Gaat het om ontbrekende rechten, of zegt eToro ooit wel welk veld fout is, dan lees je het
- "Sleutel klopt niet" en "sleutel mag dit niet" zijn nu twee verschillende meldingen. Bij een geweigerde sleutel helpt opnieuw invullen; ontbreken alleen de rechten, dan is overtikken zinloos en moet je bij eToro een sleutel met leesrecht voor die omgeving maken. Tot nu toe kreeg je in beide gevallen het advies om over te tikken
- Werkte je sleutel in geen van beide omgevingen, dan toonde de test alleen de fout van je echte account, met de mededeling dat het niet aan de schakelaar lag. Dat las als een probleem met een omgeving terwijl er twee weigerden. Nu staat erbij dat het er twee waren, en als demo iets anders meldt dan echt staan ze allebei

## 0.1.16

- De schermen die over het hele beeld openen (coin-detail, achtergrond, historie en de eToro-wizard) hadden bovenin een lege band van ruim honderd punten. De statusbalk werd twee keer gecompenseerd: de app telde de hoogte ervan er handmatig bij op terwijl de veilige-zone er al rekening mee hield. Dat kostte op elk van die schermen ongeveer een hele sectie aan zichtbare inhoud. De band is weg, en op toestellen waar die veilige zone er niet is vult Kader hem nog steeds zelf aan, zodat de titel daar niet alsnog onder de klok verdwijnt
- Nieuw filter op het marktscherm: VS BTC. Kies "Geen voorlopers" om coins weg te laten die meer dan 25 procent voorliggen op bitcoin, of "Alleen achterblijvers" voor coins die 10 procent of meer achterlopen. Dat zijn precies de grenzen uit de meting: koopsignalen op achterblijvers deden het over negen jaar beter dan dezelfde signalen op coins die al ver voorliepen. Onder het filter staat wat je ermee wegfiltert. Standaard staat het uit en verandert er niets aan de lijst, en een coin waarvan Kader het cijfer niet kent valt nooit weg
- Het boek-icoon heeft er twee hoofdstukken bij en een uitgebreid hoofdstuk. "Waarom de stop soms opschuift" legt uit waarom Kaders eigen stop-loss en die van eToro botsen en wat dat met de verhouding tussen risico en opbrengst doet. "Prijsalerts" legt uit hoe de richting van een alert wordt bepaald, waarom hij maar een keer afgaat en waarom een melding via de achtergrondtaak wat later kan komen. En "Wie houdt stand?" heet nu "Wie houdt stand? en VS BTC", want datzelfde cijfer betekent bij een koopsignaal iets anders dan in die lijst; de meting erachter staat erbij
- Je wachtende prijsalerts staan nu bij elkaar onder Meldingen, met bovenaan hoeveel het er zijn. Tot nu toe waren ze alleen per coin te vinden: zette je er een op ICP en keek je drie weken later, dan was elke coin apart openen de enige manier om erachter te komen welke er nog stonden. Tik op een alert om naar die coin te gaan, of gooi hem daar meteen weg. Alerts die al zijn afgegaan staan er niet bij, die zijn als melding langsgekomen en staan in de lijst eronder
- Elke coin toont nu hoeveel hij de afgelopen 30 dagen achterbleef of voorliep op bitcoin, op de kaart als "VS BTC" en op het coin-detailscherm met uitleg erbij. Dat cijfer is niet zomaar informatie: uit een meting over negen jaar en 3251 trades blijkt dat koopsignalen op coins die zijn ACHTERGEBLEVEN het duidelijk beter doen dan dezelfde signalen op coins die bitcoin al ver voorbij zijn gelopen. Achterblijvers leverden gemiddeld +0,17 op waar voorlopers -0,03 opleverden, en dat patroon loopt netjes op: hoe verder achter, hoe beter. De reden erachter is dat een koopsignaal al een stijgende trend eist, dus een coin die daarbovenop 25 procent harder steeg dan bitcoin heeft het makkelijke deel gehad, terwijl dezelfde coin die achterbleef juist een terugval binnen een opgaande trend is. Het cijfer telt bewust niet mee in de score en filtert niets weg, want dat zou elk signaal in de app veranderen
- Een short-signaal is nu aan te tikken. Tot nu toe kon dat niet, want het coin-detailscherm bouwde zijn "Waarom" alleen op met koop-argumenten en dan stond er onder een short letterlijk het tegenovergestelde: "geen opwaartse trend, let op" onder een signaal dat juist op die dalende trend instapt, met een rood "nu niet kopen" erboven. Er staat nu short-onderbouwing: een dalende trend en negatief momentum tellen als plus, een RSI die al diep oversold staat als waarschuwing omdat de val dan grotendeels geweest is, en een hoge score als reden om het juist niet te doen. Het scherm draagt een SHORT-label in de kop, de kop heet "Waarom short" en de knop onderin zegt "Short via eToro"
- Prijsalerts. Tik op het belletje rechtsboven in een coinscherm en stel zelf een prijs in; Kader stuurt een melding zodra de koers daar is. Onder het veld staat in gewone taal wat er straks gebeurt, en er zijn knoppen voor 5 en 10 procent boven of onder de huidige koers zodat je geen cryptokoers hoeft over te tikken. Een alert gaat precies een keer af en blijft daarna in de lijst staan met de koers waarop hij afging, zodat je hem kunt wissen of opnieuw kunt zetten. Maximaal twintig tegelijk
- Meldingen zijn nu uit te zetten onder Instellingen. Tot nu toe stonden de dagelijkse herinnering en de trade-meldingen altijd aan zodra je meldingen toestond op je toestel. Uit betekent echt uit: de geplande herinnering wordt gewist en de achtergrondcontrole stopt, dus er komt ook geen prijsalert meer doorheen. Je alerts en trades blijven gewoon staan en gaan weer werken zodra je het aanzet
- Zijn er meer coins tegelijk met een sterk koopsignaal, dan zie je ze nu allemaal. Het blauwe vak "Wat moet ik nu kopen?" toonde er altijd maar een, de hoogst scorende, en de rest verdween zonder dat je wist dat hij er was. Je veegt er nu horizontaal doorheen; de puntjes eronder laten zien hoeveel er zijn en waar je bent. Is er maar een kans, dan blijft het vak precies zoals het was
- De stop-loss die Kader toont is nu de stop die je bij eToro werkelijk kunt zetten. eToro eist per coin een minimale afstand tussen je aankoopprijs en je stop (bij bitcoin 10%), en Kaders eigen stop ligt daar meestal ruim binnen. Tot nu toe corrigeerde alleen de kooporder-sheet dat, dus op het marktscherm, bij Grote Kansen en op het coin-detailscherm stond een niveau dat je nergens kon invoeren. Die schermen tonen nu de bijgestelde stop met een klein ETORO-merkje erbij, plus de verhouding tussen risico en opbrengst die daar echt bij hoort. Dat cijfer valt vaak lager uit dan voorheen, en dat is het punt: met een stop van 10% en een doel van 9% verdien je niets, hoe hoog de score ook is. Zonder eToro-koppeling verandert er niets, dan blijft het niveau van Kader staan
- Op het coin-detailscherm staat nu altijd een knop "Trade via eToro". Die stond er alleen als je sleutel handelsrechten had, en anders was er niets: geen knop, geen uitleg, en geen manier om te weten of Kader dit uberhaupt kon. Tik je hem zonder koppeling of zonder handelsrecht, dan staat er nu wat er ontbreekt en waar je het oplost
- In het orderscherm staat je te besteden saldo nu boven het bedragveld in plaats van als voetnoot eronder, dus je weet wat er in kan voor je begint te tikken. Lukt het ophalen bij eToro niet, dan zegt de app dat ook. Stop-loss en take-profit vult Kader zelf in en stuurt hij mee met de order; het bedrag is het enige dat je nog invult

## 0.1.15

- Shortposities uit eToro komen nu gewoon in de app. Tot nu toe sloeg de import ze over met de melding "short, nog niet ondersteund", want Kader ging er overal van uit dat een trade een koop was: stop eronder, doel erboven. Een short staat nu met de juiste richting in Mijn trades, met een kloppende winst- en verliesberekening, een kloppende verhouding tussen risico en opbrengst en een balk die de goede kant op leest. Ook de meldingen en het afbouwadvies weten nu welke kant een positie op staat, dus een short die in de winst loopt krijgt het voorstel om zijn stop te verlagen in plaats van te verhogen. Een short zelf invoeren kan ook
- Meldingen zijn aantikbaar geworden. Tik in het meldingenoverzicht op een melding en je gaat naar waar hij over gaat: de trade in Mijn trades, of de coin op het marktscherm. Onder elke melding staat waar je uitkomt, zodat je het vóór het tikken weet. Meldingen van vóór deze versie hebben die verwijzing niet en blijven gewoon leesbaar. Is de trade inmiddels gesloten of verwijderd, dan zegt de app dat in plaats van niets te doen
- Kader schakelt in een dalende markt over op bear-modus. Zodra het marktklimaat ongunstig is, maakt het vak "Wat moet ik nu kopen?" plaats voor een vak dat vertelt wat er aan de hand is, hoe lang dat al zo is en wat bitcoin sindsdien gedaan heeft. Dat laatste staat er met opzet bij: niet kopen voelt als niets doen, maar in een markt die 18% daalt is niet kopen een resultaat. De drempels blijven ongewijzigd, want ze verlagen om toch iets te kunnen tonen is precies de fout die geld kost
- Kader toont nu concrete short-signalen op het marktscherm zodra het klimaat ongunstig is: coins die het zwakst scoren, met stop, doel en risico/beloning erbij, klaar om te traden. Kies je voor direct handelen via eToro, dan maakt de kooporder-sheet onmiskenbaar duidelijk dat je een short opent: je verkoopt om de positie te beginnen en verdient als de koers daalt, met stop en doel in de juiste, omgekeerde volgorde. Het boek-icoon heeft er een hoofdstuk bij dat uitlegt wat een short is, wanneer Kader er een toont en waarom, en hoe dat bij eToro werkt
- Nieuw op het marktscherm zodra het klimaat niet gunstig is: "Wie houdt stand?". Die lijst toont per coin het rendement over 30 dagen min dat van bitcoin over dezelfde periode. In een dalende markt daalt alles en scoort dus alles laag op de gewone Kader-score, waardoor die nauwelijks nog onderscheid maakt. Wie minder hard daalt heeft kopers die blijven zitten, en dat zijn doorgaans de coins die als eerste omhoog gaan als de markt draait. Het is nadrukkelijk geen koopsignaal en telt niet mee in de score
- Mijn trades toont nu hoeveel van je kapitaal er in de markt staat, afgezet tegen wat bij het huidige klimaat past: geen plafond bij gunstig, de helft bij gemengd, een vijfde bij ongunstig. Het percentage verschijnt alleen als je zelf je handelskapitaal invult, want zonder dat bedrag zou het verzonnen zijn. Dat bedrag blijft op je telefoon staan
- Per open positie kan er een advies onder de trade staan over wat de markt eromheen betekent. Staat een coin in winst maar zakt hij onder zijn 50-daags gemiddelde terwijl de markt daalt, dan stelt Kader voor om winst te nemen of de stop op te trekken, met het niveau erbij. Staat hij onder je entry en onder dat gemiddelde, dan is het advies juist om niets te doen: stop niet verlagen, niet bijkopen om je gemiddelde te drukken. Is er niets bijzonders, dan staat er ook niets
- Je krijgt voortaan een pushmelding als het marktklimaat omslaat, in beide richtingen. De belangrijkste is die tweede: in een bearmarkt wacht je maandenlang op het moment dat de poort weer opengaat, en dat hoef je nu niet meer zelf in de gaten te houden. Daarnaast waarschuwt Kader als meer van je posities zwak komen te staan dan waarover hij al gewaarschuwd had, dus zonder elke zes uur hetzelfde te herhalen
- Het boek-icoon heeft er drie hoofdstukken bij: bear-modus, "Wie houdt stand?" en blootstelling en afbouwen. Daar staat per onderwerp wat er berekend wordt, waarom, en waar het cijfer vandaan komt
- De eToro-koppeling vroeg om twee sleutels terwijl eToro er maar een uitgeeft. Kader bewaarde een sleutel voor demo en een voor echt, en stond jouw sleutel in het andere vakje dan de omgeving waar de app op stond, dan gebeurde er domweg niets: Instellingen zei dat je gekoppeld was terwijl de importknop meldde dat er geen koppeling was. Er is nu nog een rij "eToro-sleutel", en die sleutel werkt in allebei de omgevingen. Wat naar je echte account gaat en wat naar je oefenaccount hangt alleen nog af van de schakelaar Demo/Echt
- Sleutels die al op je toestel staan blijven gewoon werken en je begint in dezelfde omgeving als voorheen. Stond je enige sleutel onder "demo", dan pakt Kader hem daar op en ben je meteen weer gekoppeld. Stonden er twee verschillende sleutels, dan houdt Kader de echte aan en laat hij de andere met rust: een User Key laat eToro maar een keer zien, dus die gooien we niet weg
- De melding "ongeldige API-sleutel" wees de verkeerde kant op. Die zei dat je waarschijnlijk op de verkeerde omgeving stond, maar dezelfde sleutel hoort in demo en in echt te werken, dus daar lag het nooit aan. De melding vertelt nu wat er wel aan de hand kan zijn: je sleutel is bij eToro ingetrokken of opnieuw aangemaakt, en dan moet je beide velden opnieuw invullen
- De verbindingstest in de koppelwizard toetst nu allebei de omgevingen en zet de uitslag er per omgeving bij. Weigert eToro je sleutel op een van de twee, dan zie je dat meteen in plaats van pas bij het omschakelen
- Kon Kader de beveiligde opslag van je toestel even niet bereiken, dan meldde de app opgewekt dat er geen koppeling was en bleef de statusindicator groen. Nu staat er wat er werkelijk aan de hand is

## 0.1.14

- Het Markt-scherm kwam na een analyse leeg terug: er stond "0 coins geanalyseerd" terwijl alle 57 coins wel degelijk opgehaald waren. De oorzaak was de eis van minimaal 1:2 tussen risico en opbrengst. Ligt de steun ver onder de koers, zoals op dit moment bij vrijwel de hele markt, dan haalt geen enkele coin die verhouding en verdween dus de complete lijst, zonder enige uitleg. Coins die de drempel niet halen blijven nu staan met hun werkelijke verhouding er oranje bij, maar krijgen nooit een koopsignaal en tellen niet mee voor "Wat moet ik nu kopen?". Haalt geen enkele coin de drempel, dan legt een balk bovenaan uit waarom er die dag niets tussen staat
- Koersen onder een cent waren niet af te lezen. SHIB en PEPE stonden allebei op "$0.00001", en alles onder een half miljoenste dollar werd zelfs "$0.00000". Kleine koersen krijgen nu zoveel decimalen als ze nodig hebben, dus SHIB staat er nu als "$0.00000547"
- Nieuw onder Instellingen: kies of je bedragen in dollars of in euro's ziet. De keuze geldt voor koersen, je portfolio, winst en verlies, en de meldingen, en wordt onthouden. De wisselkoers komt van CoinGecko en wordt een halve dag bewaard, zodat de app ook zonder internet in euro's opent. Lukt het ophalen niet, dan blijft de app in dollars staan in plaats van met een verzonnen koers te rekenen. De orderschermen blijven altijd in dollars, want eToro rekent daarin af; tik je daar een bedrag in, dan staat de euro-tegenwaarde eronder
- De melding "ongeldige API-sleutel" bij het synchroniseren zei niet waar het misging. eToro geeft dezelfde weigering voor een sleutel die echt fout is en voor een goede sleutel die naar de verkeerde omgeving ging. De melding noemt nu de omgeving en vertelt wat je kunt doen: staat Kader op demo terwijl je alleen een sleutel voor je echte account hebt, dan zet je de schakelaar bij Instellingen op Echt
- De verbindingstest in de koppelwizard controleerde alleen je account, en dat adres is gelijk voor demo en echt. Een sleutel die in demo nergens werkt kreeg daardoor toch een groene "verbinding OK" en viel pas om bij de eerste synchronisatie. De test haalt nu ook je portfolio op en toetst zo echt de gekozen omgeving
- Bij het opstarten konden twee gelijktijdige lezingen van je opgeslagen eToro-sleutels elkaar in de weg zitten tijdens de verhuizing naar de beveiligde opslag. In het ongelukkigste geval las de app een lege sleutel en dacht hij de rest van de sessie dat je niet gekoppeld was. Die verhuizing gebeurt nu nog maar één keer tegelijk

## 0.1.13

- Direct handelen via eToro. Vanaf het Markt-scherm, Grote Kansen en het coin-detailscherm kun je een
  coin nu meteen kopen: Kader vult het bedrag, de stop-loss en het doel voor je in en stuurt de order
  pas nadat je die in de sheet bevestigt
- Vanuit je portfolio kun je een eToro-positie verkopen en de stop-loss of het doel van een lopende
  positie aanpassen, zonder over te tikken in de eToro-app
- Een schakelaar tussen demo en echt onder Instellingen. Kader staat standaard op demo, zodat orders
  naar je oefenaccount bij eToro gaan; overschakelen naar echt vraagt eerst een bevestiging. Zolang
  demo actief is staat er een oranje DEMO-label bovenin het scherm
- eToro eist voor sommige coins een minimale afstand tussen je aankoopprijs en je stop-loss (bij
  bitcoin bijvoorbeeld 10%). Ligt de stop van Kader dichterbij, dan schuift Kader hem op naar de
  dichtstbijzijnde waarde die eToro accepteert en zie je dat in de sheet staan, inclusief wat dat met
  je risico doet
- Je eToro-sleutels staan nu in de beveiligde opslag van je toestel in plaats van in de gewone
  app-opslag. Bestaande sleutels verhuizen automatisch bij de eerste start
- De app doet niet meer mee aan Android's automatische back-up naar Google Drive. Dat hield een kopie
  van je sleutels buiten je toestel. Gevolg: stap je over naar een nieuw toestel, dan komt je lokale
  portfolio niet meer vanzelf mee. Je posities uit eToro haalt Kader daar gewoon opnieuw op

## 0.1.12

- Je open trades staan nu gegroepeerd per bron: posities die uit eToro komen en posities die je zelf
  hebt ingevoerd staan onder een eigen balk, die je kunt in- en uitklappen. Die keuze onthoudt de app.
  Heb je maar één bron, dan blijft het overzicht ongewijzigd
- Op het trade-toevoegen-scherm stond een voorgestelde stop-loss met daaronder soms de melding dat
  eToro die waarde niet accepteert. Dat sprak zichzelf tegen. Ligt de stop buiten eToro's grens, dan
  schuift Kader hem nu naar de dichtstbijzijnde waarde die eToro wel neemt, met de uitleg erbij.
  Laat eToro de stop voor die coin helemaal niet instellen, dan staat het niveau er als "STOP
  (KADER)": het niveau dat je terugziet bij je trade in het portfolio, niet iets om op eToro in te
  vullen
- De R/R op dat scherm rekent nu mee met de aankoopprijs die je zelf invult en met de eventueel
  bijgestelde stop, in plaats van het cijfer uit de analyse te tonen. Wat je ziet is ook wat er
  opgeslagen wordt
- Tik je een aankoopprijs in die onder de voorgestelde stop-loss ligt, dan slaat Kader die trade niet
  meer op maar vraagt hij je de aankoopprijs na te kijken. Zo'n trade stond anders meteen als "stop
  geraakt" in je portfolio. Het handmatige formulier onder Mijn trades deed dit al
- Sheets en pop-ups openen nu met een fadende donkere achtergrond in plaats van een donker vlak dat
  van onderaf mee omhoog schoof. Het witte vel komt daar rustig overheen op. Geldt voor alle sheets
  in de app (instellingen, meldingen, filters, trade toevoegen, wijzigingen en de formulieren), en
  respecteert nu ook de systeeminstelling voor verminderde beweging

## 0.1.11

- Belletje, boek en tandwiel in de header zijn samengevoegd tot één kebab-menu (drie puntjes) om de
  balk minder vol te maken. Een rood bolletje op het icoon geeft aan dat er ongelezen meldingen zijn;
  het aantal staat op de "Meldingen"-regel in het uitklapmenu zelf

## 0.1.10

- Dagelijkse analyse-herinnering kwam elke ochtend twee keer binnen. Oorzaak: een dagelijkse melding
  die een oudere app-versie ooit onder een andere identifier insplande werd bij het opruimen nooit
  geraakt en bleef naast de nieuwe afgaan. Bij het opstarten worden nu alle ingeplande meldingen
  gewist voordat de herinnering opnieuw wordt ingepland
- De uurrem voor trade-meldingen wordt nu geclaimd vóórdat het werk begint, in plaats van pas na het
  versturen. Zo kan een overlap tussen de voorgrondcheck en de achtergrondtaak dezelfde melding niet
  meer dubbel sturen. Een ronde zonder iets te melden geeft de rem meteen weer terug, zodat een
  echte melding niet onnodig tot bijna een uur later hoeft te wachten
- Meldingen zijn nu terug te lezen in de app: het belletje in de header toont een teller en opent een
  overzicht met titel, uitleg en tijdstip, ook als de melding zelf al uit de notificatiebalk is
  verdwenen of nooit doorkwam terwijl het toestel vergrendeld was

## 0.1.9

- Meldingenbom bij het openen van de app opgelost. Het plafond van drie meldingen per ronde uit
  0.1.8 knipte de kandidatenlijst wel af, maar gooide de rest niet weg: kandidaat vier en verder
  waren de volgende ronde nog steeds niet gesuppresseerd en kwamen vijf minuten later alsnog binnen,
  met exact dezelfde gebundelde titel. Dat waren de meldingen die op duplicaten leken. Alle signalen
  van een ronde gaan nu in één melding en er gaat er hooguit één per uur uit
- Een nieuwe trade-melding vervangt de vorige in de meldingsbalk (vaste notificatie-identifier) in
  plaats van erbovenop te stapelen. Draaide de achtergrondcheck 's nachts een paar keer, dan stond
  er 's ochtends een rij klaar; nu staat er altijd hooguit één
- Dezelfde melding komt weer echt hooguit eens per zes uur terug. De uitzondering "tenzij het
  voorgestelde niveau meer dan 2% verschuift" is vervallen: dat niveau is afgeleid van de live koers
  (doel = koers + 3xATR, stop = koers - ATR) en crypto beweegt routineus 2% per uur, dus de
  suppressie herlaadde zichzelf op koersruis in plaats van op nieuws
- De uurrem wordt gecheckt voordat er koersdata opgehaald wordt, dus een ronde die toch niets mag
  sturen kost geen netwerkverkeer meer. Dat sluit meteen de kans dat de voorgrondcheck en de
  achtergrondtaak elkaar overlappen en dezelfde melding dubbel sturen

## 0.1.8

- Notificatiewaslijst bij het openen van de app opgelost: trade-meldingen hadden geen totaalplafond,
  dus als meerdere open trades tegelijk een trigger raakten (typisch na een tijdje afwezigheid, als
  de voorgrond-poll voor het eerst weer draait) kwamen ze allemaal los binnen. Nu worden meerdere
  meldingen in één ronde gebundeld tot één melding, met een maximum van drie per ronde

## 0.1.7

- Trade-bewuste meldingen: Kader checkt nu periodiek je open trades en stuurt alleen een melding als
  er iets te doen valt. Twee gevallen: je doel komt in zicht terwijl het momentum nog sterk is (met
  een voorstel om je doel te verhogen), of je staat in winst terwijl het momentum afvlakt (met een
  voorstel om je stop aan te trekken en die winst vast te zetten). Het voorgestelde doel is hetzelfde
  ATR-doel dat de analyse zelf gebruikt; de voorgestelde stop is break-even of een ATR onder de
  koers, welke van die twee het hoogst uitkomt
- Melding bij een heel sterk koopsignaal: alleen voor high conviction-kansen (de sterkste bucket uit
  de backtest) in coins die je nog niet in je portfolio hebt. De marktklimaat-poort geldt ook hier,
  dus in een ongunstig klimaat blijft het stil, net als op het Marktscherm
- Deze checks lopen ook door als de app dicht is. Android bepaalt zelf wanneer, met een ondergrens
  van een kwartier, dus een melding kan iets later komen dan het moment zelf. Zolang de app open
  staat wordt er elke vijf minuten gekeken
- Dezelfde melding komt hooguit eens per zes uur terug, tenzij het voorgestelde niveau meer dan 2%
  verschuift. Zo blijft een trade die dagenlang tegen zijn doel aan schurkt niet doormelden
- Overgang tussen tabbladen flitst niet meer op 60Hz-toestellen: er zat nog één leeg beeldje tussen
  het oude en het nieuwe scherm. Ook worden de schermen die je niet bekijkt niet langer opnieuw
  getekend als de koersen op de achtergrond ververst worden

## 0.1.6

- Marktsentiment op het Marktscherm vervangen door het marktklimaat: in plaats van het gemiddelde
  van de al berekende scores (die alleen de coins toont die de top 20 haalden) kijkt Kader nu naar
  BTC ten opzichte van zijn eigen 50-daags gemiddelde en naar de richting van de marktbreedte (het
  aandeel van het hele universum boven zijn eigen 50-daags gemiddelde). Bij een ongunstig klimaat
  toont de balk een expliciete waarschuwing
- Poort op de koopsignalen: staat het marktklimaat niet gunstig, dan toont Kader geen enkel
  KOOP-signaal meer, ongeacht de score. Uit een meting over negen jaar historie bleek dat
  koopsignalen in zo'n klimaat (2018, 2022, begin 2026) gemiddeld geld verloren. Sommige dagen
  toont de app daardoor bewust niets
- "Wat moet ik nu kopen" toont voortaan alleen nog high conviction-kansen (score 75+ met een
  stijgende trend, bullish MACD en verhoogd volume) in plaats van elke coin vanaf score 60. Dat is
  de sterkste bucket uit de meting hierboven
- Alle score-drempels (KOOP, sterk koop, high conviction) staan nu op één plek in de code met de
  gemeten resultaten erbij, in plaats van negen keer los gekopieerd. De achtergrondinformatie en de
  onboarding zijn bijgewerkt; de onboarding beschreef de stop-loss nog als een vast ATR-veelvoud,
  terwijl die al sinds een eerdere versie op de recente steun is gebaseerd

## 0.1.5

- Onderste tradekaart op het Portfolio-scherm werd afgekapt boven een lege
  grijze strook (bij 3-knops-navigatie op Android). De ruimte onder de
  tabbalk werd dubbel opgeteld; nu klopt de ruimte weer op alle vier de
  tabbladen
- De overgang tussen tabbladen kon knipperen op sommige toestellen (met name
  Samsung, 120 Hz). Schermen blijven nu gemount na een eerste bezoek en faden
  over elkaar heen in plaats van eerst helemaal te verdwijnen, dus geen leeg
  frame meer. Als bonus onthouden Grote Kansen en de Markt-filters nu ook hun
  stand bij het wisselen van tabblad
- Compacte weergave toegevoegd op het Portfolio-scherm: een schakelaar boven
  de tradelijst wisselt tussen de bestaande uitgebreide kaarten en compacte
  regels, zodat je in één oogopslag meer open trades ziet. Elke compacte
  regel toont het symbool, een kort advies, de live prijs, het resultaat en
  een dunne balk die laat zien waar de koers tussen stop en doel staat.
  Acties (Gewonnen/Verloren/Aanpassen/Verwijderen) zijn bereikbaar via een
  kebab-menu per regel. De gekozen weergave wordt onthouden

## 0.1.4

- De app kon niet meer bijgewerkt worden over een bestaande installatie heen
  ("App niet geïnstalleerd"). Dat lag niet aan de app zelf, maar aan een
  verkeerd versienummer in de build: sinds versie 0.1.0 was de native build
  niet meer opnieuw gegenereerd, waardoor eerdere releases in werkelijkheid
  een lager versienummer bevatten dan wat er al op sommige telefoons stond.
  Vanaf nu installeert de update gewoon over de vorige versie heen, met
  behoud van je portfolio

## 0.1.3

- Het import-wolkje bij je portfoliowaarde kleurt nu mee met de sync-status
  (groen/oranje/rood), net als het ernaast staande verversicoon, in plaats van
  altijd blauw te blijven. Eronder staat nu ook een adviesregel zodra de
  gegevens niet meer actueel zijn
- De app synchroniseert nu ook je eToro-posities en -historie zodra je
  terugkeert uit de achtergrond (niet alleen de koersen), met een korte pauze
  tussen synchronisaties zodat eToro's aanvraaglimiet niet te snel vol loopt
- Naar beneden swipen op het Marktscherm liet je hele lijst verdwijnen voor een
  laadscherm. Ververst nu op de achtergrond terwijl je lijst gewoon zichtbaar
  blijft, met dezelfde verbetering op het Grote Kansen-scherm
- Instellingen, Wijzigingen, filters, de eToro-koppelvraag en alle formulieren
  sluiten nu ook als je buiten het venster tikt, niet alleen met het kruisje.
  Ze houden ook rekening met de gesturebalk onderaan, zodat de onderste knop
  niet meer verstopt zit
- Het "Trade toevoegen"-formulier onthoudt nu wat je hebt ingevuld als je
  tussendoor naar eToro schakelt om de prijs te checken en terugkomt
- eToro accepteert niet elke stop-loss: ligt die te dicht op of te ver van je
  aankoopprijs, dan weigert eToro de order. Het Getrade-formulier waarschuwt nu
  vooraf, met de echte grenzen die eToro voor die coin hanteert. Zonder
  eToro-koppeling zie je geen waarschuwing

## 0.1.2

- Sync-status bij je portfoliowaarde: het sync-icoon boven de portfoliokaart
  kleurt nu mee zodat je in één oogopslag ziet of je gegevens actueel zijn.
  Grijsgroen = net bijgewerkt, oranje = raakt verouderd, rood = te lang niet
  gesynchroniseerd of de laatste poging mislukte. Eronder staat wanneer er voor
  het laatst is gesynchroniseerd
- De app ververst nu automatisch zodra je hem weer opent, zodat de koersen niet
  verouderd op je scherm blijven staan nadat de app op de achtergrond stond
- Het app-icoon is kleiner gemaakt zodat het Kader-merkteken netjes binnen de
  ronde cirkel op je startscherm valt in plaats van tegen de rand aan te lopen
- Het opstartscherm (splash) toont weer het juiste Kader-logo op een blauwe
  achtergrond in plaats van het oude ontwerp
- Een mislukte eToro-synchronisatie wordt nu ook echt gemeld. Zolang de koersen
  binnenkwamen, kleurde de status groen met "bijgewerkt", ook als je posities
  helemaal niet waren opgehaald (bijvoorbeeld door een verlopen sleutel). De
  status staat nu oranje met de reden erbij
- Het totaalresultaat in je statistieken gebruikt voortaan het werkelijke bedrag
  van eToro, inclusief kosten, in plaats van alleen het koersverschil. Daardoor
  spraken je trefferpercentage en je totaalbedrag elkaar niet meer tegen
- Trades zonder stop-loss tellen niet langer mee in je gemiddelde behaalde R/R.
  Zonder stop-loss valt er geen R te berekenen, en die trades trokken het
  gemiddelde naar nul zodra je eToro-historie was ingelezen
- Een trade die net boven je instapprijs sloot maar door de kosten toch verlies
  opleverde, liet een groen plusje zien naast een rood "verloren". Kleur en
  bedrag tonen nu allebei het werkelijke resultaat
- Een verwijderde eToro-trade blijft nu verwijderd. Eerder zette de
  eerstvolgende synchronisatie hem er gewoon weer bij
- Had je een trade zelf ingevoerd voordat je eToro koppelde, dan kwam dezelfde
  trade via de historie een tweede keer in je overzicht. Die worden nu herkend
  en samengevoegd
- Net geïmporteerde eToro-posities tonen meteen hun koers en waarde, in plaats
  van pas na een minuut
- TON werd bij het importeren ten onrechte niet als crypto herkend en dus
  overgeslagen
- Synchroniseren doet minder verzoeken aan eToro, waardoor je minder snel tegen
  de aanvraaglimiet aanloopt

## 0.1.1

- De marktanalyse doorzoekt nu 57 coins in plaats van 24 (dezelfde lijst als
  wat je op eToro kunt kopen), toont tot 20 kansen in plaats van 10, en draait
  merkbaar sneller doordat coins nu in groepjes tegelijk worden opgehaald in
  plaats van één voor één. Twee coins in de lijst (MATIC, RNDR) waren zonder
  dat het opviel al een tijdje niet meer terug te vinden op de koersbron
  omdat die daar inmiddels onder een andere naam draaien (POL, RENDER); dat
  is nu opgelost, dus die coins doen weer mee
- Grote Kansen-scan toont nu ook tot 20 kansen in plaats van 10, en haalt de
  koersdata voor de kandidaten net als de marktanalyse in groepjes tegelijk
  op in plaats van één voor één, dus de scan is merkbaar sneller klaar
- Trades die je op eToro sluit, worden nu automatisch afgesloten in je
  portfolio, met de echte verkoopprijs en het werkelijke resultaat inclusief
  kosten. Kader leest daarvoor je eToro-handelshistorie. Dit gebeurt bij het
  openen van de app, bij het naar beneden swipen op Mijn Trades en bij de
  eToro-knop op de portfoliokaart
- Je eToro-handelshistorie van het afgelopen jaar wordt ingelezen, zodat je
  Historie-scherm en de statistieken (trefferpercentage, gemiddelde behaalde
  R/R, totaal resultaat) meteen kloppen in plaats van pas vanaf de eerste
  trade die je via Kader sluit. Posities die Kader al kende worden niet dubbel
  toegevoegd; shorts en niet-crypto worden overgeslagen
- Na het instellen van de eToro-koppeling wordt er meteen gesynchroniseerd, je
  hoeft de app niet opnieuw te openen
- Naar beneden swipen op Mijn Trades synchroniseert nu: koersen verversen, open
  eToro-posities bijwerken en gesloten posities afsluiten. Zonder
  eToro-koppeling ververst swipen alleen de koersen
- De tabbalk onderaan valt niet langer onder de menu-, home- en terugknoppen van
  je toestel. Dit viel op onder meer Samsung-toestellen op
- De eToro-knop op de portfoliokaart heeft een duidelijker icoon (wolk met pijl)
  in plaats van het downloadsymbool
- Een verlies in dollars toont nu een minteken. Eerder stond er bijvoorbeeld
  "$4.21" waar "−$4.21" hoorde, en verried alleen de rode kleur dat het om een
  verlies ging. Speelde op Mijn Trades, in de historie en op het
  coin-detailscherm

## 0.1.0

- Portfolio importeren uit eToro: onder Instellingen kun je een eToro
  API-sleutel koppelen (alleen-lezen), en op het Mijn Trades-scherm haalt de
  importknop je open crypto-posities op. Bestaande geïmporteerde posities
  worden bijgewerkt in plaats van dubbel toegevoegd; posities zonder
  stop-loss/take-profit kun je aanvullen via het bewerk-formulier
- eToro-koppeling instellen gaat nu via een stap-voor-stap wizard onder
  Instellingen (uitleg, publieke sleutel, privésleutel, en testen met
  bevestiging aan het eind) in plaats van een altijd zichtbaar invulblok
- Tonen/verbergen-oogje zit nu bij beide sleutelvelden en is per veld te bedienen
- eToro-koppeling kun je nu ook weer verwijderen van het toestel
- Nieuwe portfolio-statuskaart bovenaan Mijn Trades: huidige waarde van je open
  posities, ingelegd bedrag en ongerealiseerd resultaat (bedrag en percentage),
  met de live-koersstatus erbij
- Topbalk op Mijn Trades opgeschoond: de titel past weer op één regel. De
  ververs- en eToro-importknop zijn verhuisd naar de statuskaart
- Afgesloten trades staan nu in een apart historie-scherm (via de knop op de
  statuskaart) met trefferpercentage, gemiddelde behaalde R/R en totaal
  resultaat. Het hoofdscherm toont voortaan alleen je open trades
- De portfoliowaarde en het ongerealiseerd resultaat tellen nu soepel mee
  (count-up) bij elke koers-sync
- Soepele slide/fade-overgangen tussen de stappen van de eToro-wizard en de
  onboarding
- Als eToro nog niet gekoppeld is, verwijzen we je bij de eerste start van v0.1
  direct naar de koppeling
- Feestelijke opening van v0.1: een welkomscherm met confetti en vallende
  gouden bitcoins
- "Wat moet ik nu kopen?"-kaart houdt nu rekening met de actieve tab- en
  filterkeuzes op het Marktscherm in plaats van altijd alle coins te wegen
- Achtergrondinformatie staat weer als los boek-icoon in de schermheader,
  niet meer onder Instellingen
- Schermovergang bij tabwissel flitst niet meer kort volledig zichtbaar voordat
  hij infadet
- App-icoon (Kader-logo v2) wordt weer correct meegebouwd, zodat het nieuwe
  icoon ook bij een update op je startscherm verschijnt

## 0.0.8

- Tikfout in het kopje "MARKTSENTIMENT" boven de marktbalk hersteld
- Op het tabblad Favorieten zonder favorieten verschijnt nu altijd de uitleg om
  coins met de ster te verzamelen, ook als er een filter actief staat

## 0.0.7

- Vloeiende overgangsanimatie bij het wisselen tussen Markt, Kansen,
  Portfolio en Traders
- Filters op RSI (oversold/overbought), minimale score en minimale R/R op
  het Marktscherm, naast de tabs Alle coins/Favorieten, met een vloeiende
  overgang bij het wisselen
- Achtergrondinformatie is verplaatst van een los boekje in de schermheader
  naar Instellingen (boven Wijzigingen); dat lost ook een te krappe titel op
  het Mijn Trades-scherm op
- "Wat moet ik nu kopen?"-kaart toont nu een duidelijke "Tik voor meer
  info"-hint rechtsonder

## 0.0.6

- Nieuw Kader-logo (open kader-mark): outline-variant linksboven in elke
  schermheader, donker-thema variant in het app-icoon, adaptive icon en de
  splash
- "Wat moet ik nu kopen?": nieuwe kaart bovenaan het Marktscherm met de best
  scorende koopkans en de reden in één zin, of een neutrale melding als niets
  sterk genoeg scoort
- Filtertabs "Alle coins" / "Favorieten" boven de tradelijst op het
  Marktscherm
- Uitklapbare uitleg bij de Fear & Greed-index en bij de marktsentimentbalk
  over wat de waarde betekent
- Coin-detailscherm heeft nu ook een Getrade-knop, zodat je vanuit het
  detailscherm direct een trade kunt vastleggen
- Laadbalk tijdens het analyseren (Markt) en scannen (Grote Kansen): vloeiend
  geanimeerd, toont het percentage en heeft meer ruimte voordat de
  skeletkaarten beginnen

## 0.0.5

- Stop-loss ligt nu net onder de recente steun (laagste van de laatste tien
  candles) in plaats van een vaste 1,5 keer ATR; daardoor verschilt de
  risico/beloning per coin en filtert de app coins met te weinig ruimte nu ook
  echt weg
- Bij het sluiten van een trade vraagt de app tegen welke prijs je hebt
  verkocht: take-profit of stop-loss zijn voorgevuld, maar je kunt de
  werkelijke verkoopprijs invullen zodat trefferpercentage en behaald resultaat
  niet meer uiteenlopen
- Prijzen ophalen is robuuster: een kapot of afgekapt netwerkantwoord laat de
  app niet meer één keer per coin de hele prijs-sync afbreken, en de
  noodterugval op koersdata werkt nu daadwerkelijk als de directe
  prijs-endpoints geblokkeerd zijn
- Kleinere correcties in de score: een volumepiek wordt eerlijker gemeten (de
  piek-candle telt niet meer in zijn eigen gemiddelde mee) en het
  MACD-histogram levert alleen extra punten op als het echt stijgt

## 0.0.4

- Trade opslaan vanuit Grote Kansen: kaarten met technische niveaus hebben nu
  een Getrade-knop, identiek aan het Marktscherm
- Bedrag in $ en aantal coins zijn nu ook in te vullen bij het handmatig
  toevoegen of aanpassen van een trade in Mijn Trades (aantal coins wordt
  automatisch berekend uit bedrag en aankoopprijs)
- Open trades in Mijn Trades hebben nu een meekleurende zijkant op basis van
  het actuele advies, net als op het Marktscherm
- Grote Kansen-kaarten tonen nu ook marktcap, trend, MACD en de kansscore
  waarop gesorteerd wordt
- Gesloten trades in Mijn Trades leggen nu de exitprijs vast en tonen het
  behaalde resultaat; een nieuwe statistiekenrij toont trefferpercentage,
  gemiddelde behaalde R/R en totaal resultaat zodra er gesloten trades zijn
- Coin-detailscherm voor een open trade toont nu ook de afstand tot
  stop-loss en take-profit; voor een gesloten trade toont het de exitprijs,
  slotdatum en het behaalde resultaat
- Achtergrond informatie: een boek-icoon in de header van elk scherm opent
  uitleg over de Kader-score, indicatoren, stop/doel-berekening, marktbalk,
  Fear & Greed, kansscore, portfolio-statistieken en het trader-oordeel, met
  grafische voorbeelden

## 0.0.3

- Coin detail-scherm: tik op een coin op Markt, Grote Kansen of in je portfolio
  voor een full-screen overzicht met koersgrafiek, entry/stop/take-profit-lijnen,
  verse indicatoren (RSI, trend, MACD, volume) en een onderbouwing van het advies.
  De grafiek toont datum- en prijslabels en reageert op aanraken: sleep met je
  vinger over de lijn voor de exacte datum en koers op dat punt
- Meer "waarom kopen"-onderbouwing in het uitklapvak van de kaart op het Marktscherm
- Wijzigingenoverzicht in de app: knop "Wijzigingen" onder Instellingen, plus een
  eenmalige "nieuw in deze versie"-melding bij de eerste start na een update
- Dark/light mode: systeem, licht of donker via het tandwiel-icoon, opgeslagen op
  het toestel
- Error boundary zodat een kapotte component niet de hele app laat crashen
- Offline-melding op Markt- en Kansen-scherm gedeeld via één component
- Trade aanpassen in Mijn Trades: stop-loss en take-profit wijzigen op een
  bestaande open trade, R/R wordt herberekend
- Favorietenlijst op het Marktscherm: coins markeren met een ster, favorieten
  sorteren bovenaan en blijven bewaard op het toestel
- Fear & Greed Index (Alternative.me) zichtbaar op het Marktscherm naast de
  Kader-marktbalk

## 0.0.2

- Toetsenbord bedekte niet langer de invulvelden in de modal-formulieren
  (Trade toevoegen, Trade bijhouden, Trader beoordelen)

## 0.0.1

Eerste volledige release van de Kader-app.

- App-id: com.kader.app
- Officieel Kader-logo in iconen en in de app
- Marktsentimentbalk (SELL/BALANCED/BUY)
- Skeleton-laadstate
- Pull-to-refresh op Markt en Kansen
- LayoutAnimation respecteert reduced-motion
