// Alle score-drempels op één plek. De cijfers komen uit de backtest over negen jaar Binance-
// historie (app/scripts/backtest.ts, meting C/D): dat is de gemeten gemiddelde R per trade in die
// bucket, niet een gevoelsmatige keuze. Verander een drempel hier, niet op een van de plekken die
// er ooit een eigen kopie van maakten (coinInfo.ts, MarktBalk.tsx, WatKopenNu.tsx, ScoreBadge.tsx,
// TradeCard.tsx, MarktFilters.tsx).

// LET OP: de cijfers in dit bestand zijn van voor de kosten. Meting M en N (docs/metingen.md, nov
// 2026) rekenden met eToro's 1% per kant en een aparte toetsperiode. Daarin haalde geen enkel
// kooplabel de lat: KOOP hield netto +0,11 R over maar niet aantoonbaar boven nul, en STERK KOOP en
// BEVESTIGD kozen niet beter dan gewone KOOP-coins. Een label dat zijn lat niet haalt toont Kader
// niet. De drempels hieronder blijven bestaan voor de kleur van de score en voor het trackrecord,
// dat het ruwe signaal blijft volgen zodat een label terug kan komen.
//
// Sinds 12 nov 2026 definitief uit (docs/mandje-lat.md): het koopadvies is het Kader-mandje
// (engine/naloopRustig.ts), met een eigen lat. Deze schakelaars blijven alleen bestaan zodat de
// takken die erop letten niet allemaal tegelijk weg hoeven; zet ze niet meer aan.
export const LABEL_KOOP_BEWEZEN: boolean = false;
// STERK KOOP en BEVESTIGD. Kan alleen aan als LABEL_KOOP_BEWEZEN aan staat.
export const LABEL_STERK_BEWEZEN: boolean = false;

// Het advies om je stop op te trekken (naar je instap of 1x ATR onder de koers), in Portfolio, op
// Vandaag en als melding. Uit sinds 12 nov 2026. Het plan sinds meting M en N is een stop op 3x ATR
// die blijft staan: zo is het gemeten, en een krappe stop droeg de kosten van eToro niet. Dit advies
// maakte van die ruime stop alsnog een krappe (op de emulator al bij +0,2 R naar de instap), en dat
// samenspel is nooit gemeten. Zet hem alleen op true na een meting die laat zien dat het plan met
// een meelopende stop na kosten beter doet dan het plan zonder, op signalen van na 11 nov 2026.
// Zie docs/markt-kosten-plan.md, paragraaf 10.
export const STOP_OPTREKKEN_BEWEZEN: boolean = false;

// Vanaf hier krijgt een coin het signaal KOOP. Gemeten: ±0,06 R gemiddeld per trade.
export const DREMPEL_KOOP = 55;

// "Sterk koop"-label in de tradekaart, een stap onder high conviction.
export const DREMPEL_STERK_KOOP = 72;

// Score 75+ zonder de extra eisen van high conviction. Gemeten +0,10 R gemiddeld.
export const DREMPEL_HOOG = 75;

// High conviction: score 75+ samen met opwaartse trend, bullish MACD en volume >= 1,3x het
// gemiddelde. Gemeten +0,16 R gemiddeld, de sterkste bucket die de backtest vond. Dit is het
// niveau waarop "wat moet ik nu kopen" en de eerlijke conviction-badges zich baseren.
export const HIGH_CONVICTION_SCORE = 75;
export const HIGH_CONVICTION_VOLUME_MIN = 1.3;

// Kleurdrempels voor de score-badge (louter visueel, geen koopsignaal op zich).
export const DREMPEL_BADGE_GOED = 70;
export const DREMPEL_BADGE_MATIG = 40;
