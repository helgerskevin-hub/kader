# Changelog

Alle noemenswaardige wijzigingen aan de Kader-app staan hier per versie,
nieuwste bovenaan. Zie ook `app/src/changelog.ts`, de bron die de app zelf
gebruikt voor het wijzigingen-scherm en de "nieuw in deze versie"-melding.

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
