# De lat voor het Kader-mandje

Vastgesteld door Thom op 12 nov 2026, voordat het mandje als advies in de app staat. De noodrem is
gekozen na meting Q (`docs/metingen.md`). Kevin tekent mee bij de merge.

## Waarom een nieuwe lat

De oude lat (`docs/markt-kosten-plan.md`, paragraaf 5) vraagt dat de ondergrens van het
90%-interval boven nul ligt. Voor KOOP (+0,11 R per trade) is daar grofweg 25 tot 30 jaar data voor
nodig: het label komt in de praktijk nooit terug. Ondertussen haalde regel C uit meting O wel een
toets op 359 coins die nooit in een meting zaten. Die regel wordt het advies, met een lat die
binnen een jaar iets zegt.

## Het mandje

Bij open klimaat de 5 rustigste coins (laagste ATR ten opzichte van de koers) uit alle 148 coins.
Beginstop 3x ATR, geen doel, de stop schuift elke dag mee naar het laagste punt van de laatste 20
dagen (alleen omhoog). Elke plek is 1/5 van het vermogen.

## De lat

| Onderdeel | Keuze |
|---|---|
| Ijklijn | Boven nul, na kosten. BTC houden staat ernaast als informatie, niet als eis. |
| Start | Het mandje gaat meteen aan. De holdout-toets uit meting O is het startbewijs. |
| Bron | Alleen de papieren naloop (`app/src/state/naloopBoek.ts`), niet de echte trades. |
| Startdatum klok | 12 nov 2026, de start van de naloop. |
| Ijkmomenten | 12 mei 2027 en 12 nov 2027, daarna elk jaar op 12 nov. |
| Grens op een ijkmoment | Papieren vermogen sinds de start lager dan -10%: advies uit. |
| Noodrem | Terugval vanaf de hoogste stand voorbij -60%: advies direct uit. |
| Kosten | 1,5% per kant (1% eToro plus een marge voor de spread). |
| Lege tijd | De klok loopt door. Een leeg mandje bij dicht klimaat telt als 0%. |
| Naloopboek | Herrekend met 1,5%, de startdatum blijft. |
| Bij falen | Advies uit, de naloop draait door. Terug alleen na een nieuwe meting met beslisregels vooraf. |
| Oude labels | KOOP, STERK KOOP en BEVESTIGD zijn definitief weg. De score blijft als informatie. |
| De lat wijzigen | Alleen Thom en Kevin samen, vastgelegd in dit bestand vóór het volgende ijkmoment. Nooit na het zien van een uitkomst. |

## Wat je ervan mag verwachten (meting Q)

- Het ijkmoment gaat vaak af: sinds 2022 bij 43% van de startmaanden. Dat is een
  eerlijkheidsschakelaar, geen geldredder. Die periodes eindigden na 2 jaar mediaan op -12%;
  stoppen maakte dat niet beter (-21%), omdat er herstel volgde.
- De noodrem op -60% ging sinds 2022 nooit af en kostte in de meting niets. Hij is er voor iets
  ergers dan de historie. Een rem op -40% was in 9 van de 10 periodes afgegaan.
- Het mandje wint over 2019 t/m 2026 ruim van BTC houden (+79% tegen +36% per jaar), maar vrijwel
  alles daarvan komt uit 2020 en 2021. Van 2023 t/m 2026 deed BTC houden het beter. "Meer geld dan
  BTC houden" is dus niet de belofte; "na kosten boven nul, met een kleinere terugval" wel.
