// Alle score-drempels op één plek. De cijfers komen uit de backtest over negen jaar Binance-
// historie (app/scripts/backtest.ts, meting C/D): dat is de gemeten gemiddelde R per trade in die
// bucket, niet een gevoelsmatige keuze. Verander een drempel hier, niet op een van de plekken die
// er ooit een eigen kopie van maakten (coinInfo.ts, MarktBalk.tsx, WatKopenNu.tsx, ScoreBadge.tsx,
// TradeCard.tsx, MarktFilters.tsx).

// Vanaf hier krijgt een coin het signaal KOOP. Gemeten: ±0,06 R gemiddeld per trade.
export const DREMPEL_KOOP = 55;
// Onder deze score komt een coin in aanmerking voor een short. Gemeten (meting F, negen jaar, 5377
// trades): +0,064 R gemiddeld, en positief in alle vier de dalende jaren (2018 +0,15, 2022 +0,19,
// 2025 +0,13, 2026 +0,10). Strenger zetten maakt het slechter, score < 25 haalde nog maar +0,026.
// Bewust een eigen constante en niet DREMPEL_BADGE_MATIG hergebruiken: die is louter visueel en
// mag los bewegen zonder de strategie te veranderen.
export const DREMPEL_SHORT = 40;

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
