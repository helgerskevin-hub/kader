// Rekenwerk achter de candle-weergave van de prijsgrafiek. Apart van PrijsGrafiek.tsx omdat dat
// bestand react-native binnentrekt en niet in Node draait; dit bestand wel, met de self-check
// onderaan.
//
// Twee vragen: heeft deze reeks echte candles, en hoeveel candles passen er in de breedte?
import { Candle } from './types';

// Heeft deze reeks echte open, hoog, laag en slot? De CoinGecko-fallback (/market_chart) geeft
// één prijs per punt en vult alle vier met dezelfde waarde. Daar candles van tekenen levert een
// rij streepjes op die doen alsof er een spreiding is. Dan liever de lijn.
export function heeftEchteOhlc(candles: Candle[]): boolean {
  if (candles.length < 2) return false;
  const allesGeldig = candles.every(c =>
    Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close));
  return allesGeldig && candles.some(c => c.high > c.low);
}

// Voegt opeenvolgende candles samen tot hooguit `maxAantal`: open van de eerste, hoogste hoog,
// laagste laag, slot van de laatste. Bij 400 dagcandles op een telefoonbreedte worden de lijfjes
// anders haarlijnen en zie je gevuld en hol niet meer uit elkaar.
//
// Elke groep is even groot (bijvoorbeeld steeds twee dagen), zodat een candle overal in de
// grafiek dezelfde tijd beslaat. De groepen tellen terug vanaf de nieuwste candle: die is de
// candle waar je naar kijkt, dus hij hoort compleet te zijn. Een kortere groep valt aan het begin.
export function bundelCandles(candles: Candle[], maxAantal: number): Candle[] {
  const max = Math.max(1, Math.floor(maxAantal));
  if (candles.length <= max) return candles;
  const perGroep = Math.ceil(candles.length / max);
  const uit: Candle[] = [];
  for (let eind = candles.length; eind > 0; eind -= perGroep) {
    const begin = Math.max(0, eind - perGroep);
    const eerste = candles[begin];
    const laatste = candles[eind - 1];
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    for (let i = begin; i < eind; i++) {
      high = Math.max(high, candles[i].high);
      low = Math.min(low, candles[i].low);
      volume += candles[i].volume;
    }
    // De tijd van de eerste candle in de groep: zo werkt een Binance-kline ook, die draagt het
    // begin van zijn periode.
    uit.push({ open: eerste.open, high, low, close: laatste.close, volume, tijd: eerste.tijd });
  }
  return uit.reverse();
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/kaarsen.ts`
if (require.main === module) {
  const c = (open: number, high: number, low: number, close: number, tijd?: number): Candle =>
    ({ open, high, low, close, volume: 1, tijd });

  // ---------- Echte candles of niet ----------
  const vlak = [c(1, 1, 1, 1), c(2, 2, 2, 2), c(3, 3, 3, 3)];
  console.assert(!heeftEchteOhlc(vlak), 'CoinGecko-punten met vier gelijke waarden zijn geen candles');
  console.assert(heeftEchteOhlc([c(1, 2, 0.5, 1.5), c(1.5, 1.5, 1.5, 1.5)]),
    'één candle met spreiding is genoeg');
  console.assert(!heeftEchteOhlc([c(1, 2, 0.5, 1.5)]), 'één candle is geen grafiek');
  console.assert(!heeftEchteOhlc([]), 'geen candles is geen grafiek');
  console.assert(!heeftEchteOhlc([c(1, 2, 0.5, 1.5), c(1, NaN, 0.5, 1.5)]),
    'een kapotte waarde laat de grafiek terugvallen op de lijn');

  // ---------- Bundelen ----------
  const kort = [c(1, 2, 0.5, 1.5), c(1.5, 3, 1, 2)];
  console.assert(bundelCandles(kort, 10) === kort, 'past het al, dan blijft de reeks dezelfde');

  // 400 dagcandles met oplopende koers: candle i heeft open i, hoog i+0.5, laag i-0.5, slot i+0.2.
  const vierhonderd = Array.from({ length: 400 }, (_, i) => c(i, i + 0.5, i - 0.5, i + 0.2, i * 1000));
  const vijftig = bundelCandles(vierhonderd, 50);
  console.assert(vijftig.length === 50, `400 naar hooguit 50 geeft 50 groepen van 8, was: ${vijftig.length}`);
  const eersteGroep = vijftig[0];
  console.assert(eersteGroep.open === 0 && eersteGroep.close === 7.2,
    `eerste groep: open van candle 0, slot van candle 7, was: ${eersteGroep.open}/${eersteGroep.close}`);
  console.assert(eersteGroep.high === 7.5 && eersteGroep.low === -0.5,
    `eerste groep: hoogste hoog en laagste laag, was: ${eersteGroep.high}/${eersteGroep.low}`);
  console.assert(eersteGroep.volume === 8, `volume telt op, was: ${eersteGroep.volume}`);
  console.assert(eersteGroep.tijd === 0, 'een groep draagt de tijd van zijn eerste candle');
  const laatsteGroep = vijftig[vijftig.length - 1];
  console.assert(laatsteGroep.close === 399.2, 'de laatste groep eindigt op de nieuwste slotkoers');

  // Niet deelbaar: 91 candles naar hooguit 50 geeft groepen van 2, met één losse candle vooraan.
  const negentigEen = Array.from({ length: 91 }, (_, i) => c(i, i + 1, i - 1, i + 0.5, i));
  const gebundeld = bundelCandles(negentigEen, 50);
  console.assert(gebundeld.length === 46, `91 in groepen van 2 geeft 46, was: ${gebundeld.length}`);
  console.assert(gebundeld[0].open === 0 && gebundeld[0].close === 0.5,
    'de korte groep valt aan het begin, niet aan het eind');
  const nieuwste = gebundeld[gebundeld.length - 1];
  console.assert(nieuwste.open === 89 && nieuwste.close === 90.5 && nieuwste.high === 91 && nieuwste.low === 88,
    'de nieuwste groep bevat de laatste twee candles compleet');
  // Elke candle hoort in precies één groep: de slotkoersen van de groepen komen terug in de reeks.
  console.assert(gebundeld.every(g => negentigEen.some(o => o.close === g.close)),
    'elke slotkoers van een groep is een echte slotkoers');

  // Een onzinnige grens laat de functie niet vastlopen.
  console.assert(bundelCandles(vierhonderd, 0).length === 1, 'hooguit 0 wordt hooguit 1');

  console.log('kaarsen.ts self-check geslaagd');
}
