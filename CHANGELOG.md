# Changelog

Alle noemenswaardige wijzigingen aan de Kader-app staan hier per versie,
nieuwste bovenaan. Zie ook `app/src/changelog.ts`, de bron die de app zelf
gebruikt voor het wijzigingen-scherm en de "nieuw in deze versie"-melding.

## 0.0.8

- Tikfout in het kopje "MARKTSENTIMENT" boven de marktbalk hersteld
- Op het tabblad Favorieten zonder favorieten verschijnt nu altijd de uitleg om
  coins met de ster te verzamelen, ook als er een filter actief staat
- Achtergrondinformatie staat weer als los boek-icoon in de schermheader,
  niet meer onder Instellingen
- Schermovergang bij tabwissel flitst niet meer kort volledig zichtbaar voordat
  hij infadet
- "Wat moet ik nu kopen?"-kaart houdt nu rekening met de actieve tab- en
  filterkeuzes op het Marktscherm in plaats van altijd alle coins te wegen
- Portfolio importeren uit eToro: onder Instellingen (tandwiel) kun je een
  eToro API-sleutel koppelen (alleen-lezen), en op het Mijn Trades-scherm haalt
  de nieuwe importknop je open crypto-posities op. Bestaande geïmporteerde
  posities worden bijgewerkt in plaats van dubbel toegevoegd; posities zonder
  stop-loss/take-profit kun je aanvullen via het bewerk-formulier. Uitleg over
  de koppeling staat in het boek-icoon

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
