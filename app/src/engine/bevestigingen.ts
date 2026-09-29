import { Trade } from './types';
import { fmtRR } from './format';
import { HIGH_CONVICTION_SCORE, HIGH_CONVICTION_VOLUME_MIN } from './drempels';
import { MIN_RISK_REWARD } from './analyzer';

// De vier eisen achter het BEVESTIGD-keurmerk, los van elkaar leesbaar. High conviction bestaat
// niet meer als eigen label: het is nu STERK KOOP plus dit keurmerk, en deze lijst laat zien welke
// van de vier eisen meedoen. Bewust puur, geen React, zodat de kop hieronder te toetsen is.
export interface Bevestiging {
  naam: 'Trend' | 'MACD' | 'Volume' | 'R/R';
  waarde: string;
  ok: boolean;
}

export interface BevestigingenUitkomst {
  lijst: Bevestiging[];
  aantal: number;
  kop: string;
  bevestigd: boolean;
}

// Afronden op één decimaal, zoals de rest van de kaart, behalve als een waarde die de eis niet
// haalt daardoor precies op de grens uitkomt: 1.27x wordt anders "1,3x" met een kruis ernaast,
// terwijl er bij de grens 1,3x staat. Dan naar beneden. Alleen in dat geval, anders zegt het
// raster "1 : 1.4" onder een kaart die "1 : 1.5" toont.
function eenDecimaal(waarde: number, ok: boolean, grens: number): number {
  const afgerond = Math.round(waarde * 10) / 10;
  return !ok && afgerond >= grens ? Math.floor(waarde * 10) / 10 : afgerond;
}

// `rr` en `haaltRr` komen van de kaart en niet uit de trade: schuift eToro de stop op, dan zakt de
// R/R mee en is dat de waarde die je werkelijk krijgt (zie haaltRr in TradeCard).
export function bevestigingen(
  trade: Pick<Trade, 'ema20' | 'ema50' | 'macdBullish' | 'volumeRatio' | 'score' | 'highConviction' | 'voldoetAanRR' | 'signaal'>,
  rr: number,
  haaltRr: boolean,
): BevestigingenUitkomst {
  const trendOp = trade.ema20 > trade.ema50;
  const volumeOk = trade.volumeRatio >= HIGH_CONVICTION_VOLUME_MIN;
  const lijst: Bevestiging[] = [
    { naam: 'Trend', waarde: trendOp ? 'Op' : 'Neer', ok: trendOp },
    { naam: 'MACD', waarde: trade.macdBullish ? 'Bullish' : 'Bearish', ok: trade.macdBullish },
    {
      naam: 'Volume',
      waarde: `${eenDecimaal(trade.volumeRatio, volumeOk, HIGH_CONVICTION_VOLUME_MIN).toFixed(1).replace('.', ',')}x`,
      ok: volumeOk,
    },
    { naam: 'R/R', waarde: fmtRR(eenDecimaal(rr, haaltRr, MIN_RISK_REWARD)), ok: haaltRr },
  ];
  const aantal = lijst.filter(b => b.ok).length;
  const bevestigd = trade.highConviction && haaltRr;

  let kop: string;
  if (bevestigd) {
    kop = '4 VAN 4 BEVESTIGD';
  } else if (aantal < 4) {
    const missend = lijst.filter(b => !b.ok).map(b => b.naam.toUpperCase()).join(', ');
    kop = `${aantal} VAN 4 · MIST: ${missend}`;
  } else if (trade.score < HIGH_CONVICTION_SCORE) {
    kop = `4 VAN 4 · SCORE ONDER ${HIGH_CONVICTION_SCORE}`;
  } else if (!trade.voldoetAanRR) {
    // De R/R hierboven is die van de kaart, en die kan door eToro's stopgrens hoger uitvallen dan
    // die van Kader zelf. High conviction kijkt naar Kaders eigen R/R.
    kop = `4 VAN 4 · R/R VAN KADER ONDER ${fmtRR(MIN_RISK_REWARD)}`;
  } else if (trade.signaal !== 'KOOP') {
    // Score en R/R halen het en toch geen koopsignaal: dat doet alleen het marktklimaat (zie
    // analyseerMarkt, dat bij een ongunstig klimaat elk KOOP terugzet naar WATCH).
    kop = '4 VAN 4 · MARKTKLIMAAT WERKT NIET MEE';
  } else {
    kop = '4 VAN 4 · NIET BEVESTIGD';
  }

  return { lijst, aantal, kop, bevestigd };
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/bevestigingen.ts`
if (require.main === module) {
  const basis = { ema20: 110, ema50: 100, macdBullish: true, volumeRatio: 1.8, score: 80, highConviction: true, voldoetAanRR: true, signaal: 'KOOP' as const };

  const alles = bevestigingen(basis, 2.5, true);
  console.assert(alles.bevestigd, 'highConviction met R/R hoort BEVESTIGD te geven');
  console.assert(alles.aantal === 4, 'alle vier moeten meetellen');
  console.assert(alles.kop === '4 VAN 4 BEVESTIGD', `kop was ${alles.kop}`);
  console.assert(alles.lijst[2].waarde === '1,8x', `volumewaarde was ${alles.lijst[2].waarde}`);
  console.assert(alles.lijst[3].waarde === fmtRR(2.5), `R/R-waarde was ${alles.lijst[3].waarde}`);

  const mistVolume = bevestigingen({ ...basis, volumeRatio: 1.2, highConviction: false }, 2.5, true);
  console.assert(!mistVolume.bevestigd, 'zonder highConviction geen keurmerk');
  console.assert(mistVolume.aantal === 3, 'drie van vier');
  console.assert(mistVolume.kop === '3 VAN 4 · MIST: VOLUME', `kop was ${mistVolume.kop}`);

  const mistTwee = bevestigingen({ ...basis, macdBullish: false, ema20: 90, highConviction: false }, 1.5, false);
  console.assert(mistTwee.kop === '1 VAN 4 · MIST: TREND, MACD, R/R', `kop was ${mistTwee.kop}`);

  // De volumegrens zelf telt mee, net eronder niet.
  console.assert(bevestigingen({ ...basis, volumeRatio: HIGH_CONVICTION_VOLUME_MIN }, 2, true).lijst[2].ok, 'volume op de grens telt mee');
  console.assert(!bevestigingen({ ...basis, volumeRatio: HIGH_CONVICTION_VOLUME_MIN - 0.01 }, 2, true).lijst[2].ok, 'volume net onder de grens telt niet');

  const laagScore = bevestigingen({ ...basis, score: 70, highConviction: false }, 2.5, true);
  console.assert(laagScore.kop === `4 VAN 4 · SCORE ONDER ${HIGH_CONVICTION_SCORE}`, `kop was ${laagScore.kop}`);

  const klimaat = bevestigingen({ ...basis, highConviction: false, signaal: 'WATCH' }, 2.5, true);
  console.assert(klimaat.kop === '4 VAN 4 · MARKTKLIMAAT WERKT NIET MEE', `kop was ${klimaat.kop}`);
  console.assert(!klimaat.bevestigd, 'ongunstig klimaat geeft geen keurmerk');

  const kaderRr = bevestigingen({ ...basis, highConviction: false, voldoetAanRR: false, signaal: 'WATCH' }, 2.2, true);
  console.assert(kaderRr.kop === `4 VAN 4 · R/R VAN KADER ONDER ${fmtRR(MIN_RISK_REWARD)}`, `kop was ${kaderRr.kop}`);

  // Een kruis mag nooit naast "1 : 2.0" staan.
  const krap = bevestigingen({ ...basis, highConviction: false }, 1.97, false);
  console.assert(krap.lijst[3].waarde === fmtRR(1.9), `R/R net onder de eis was ${krap.lijst[3].waarde}`);

  const ruim = bevestigingen({ ...basis, highConviction: false }, 1.46, false);
  console.assert(ruim.lijst[3].waarde === fmtRR(1.5), `R/R ver onder de eis hoort gewoon af te ronden, was ${ruim.lijst[3].waarde}`);
  const krapVolume = bevestigingen({ ...basis, volumeRatio: 1.27, highConviction: false }, 2.5, true);
  console.assert(krapVolume.lijst[2].waarde === '1,2x', `volume net onder de grens was ${krapVolume.lijst[2].waarde}`);

  console.log('bevestigingen.ts self-check geslaagd');
}
