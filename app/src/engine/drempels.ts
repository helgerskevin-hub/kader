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
// Zet een schakelaar alleen op true als het label de lat uit docs/markt-kosten-plan.md (paragraaf
// 5) haalt op data die bij het afstellen niet gebruikt is. Niet omdat een scherm er leeg uitziet.
//
// Voor je er een aanzet, eerst nalopen (gevonden bij de review van nov 2026):
//   - teksten die nu zonder voorwaarde "AFWACHTEN" of "geen kooplabel" zeggen: informatie/
//     hoofdstukken.ts (score, advies, analyse, klimaat, meldingen), MarktBalk, BearModusKaart,
//     OnboardingScreen en het ijkpunt in SignaalScorebordScherm;
//   - coinInfo.ts geeft "Sterke koop" vanaf score 72 zonder LABEL_STERK_BEWEZEN te kennen, en
//     signaalLog.adviesVan groepeert het trackrecord ook op 72;
//   - gemisteKansen.ts telt bruto R, terwijl Signaalresultaat netto toont;
//   - de R/R is nu altijd 3: de takken en het filter die op "R/R onder 1 : 2" letten doen niets.
export const LABEL_KOOP_BEWEZEN: boolean = false;
// STERK KOOP en BEVESTIGD. Kan alleen aan als LABEL_KOOP_BEWEZEN aan staat.
export const LABEL_STERK_BEWEZEN: boolean = false;

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
