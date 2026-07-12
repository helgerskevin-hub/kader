# Changelog

Alle noemenswaardige wijzigingen aan de Kader-app staan hier per versie,
nieuwste bovenaan. Zie ook `app/src/changelog.ts`, de bron die de app zelf
gebruikt voor het wijzigingen-scherm en de "nieuw in deze versie"-melding.

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
