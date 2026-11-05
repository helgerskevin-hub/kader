// De native kant van het exporteren: koersen ophalen, bestand schrijven, deelmenu openen. De
// rekenkundige kant staat puur in export.ts.

import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { haalDagHistorie } from '../engine/marketData';
import type { Candle } from '../engine/types';
import { dagSleutel, maakCsv, maakHtml, type DagKoersen, type ExportKoersen, type Jaaroverzicht } from './export';

// Openingskoers per UTC-dag. Een dagcandle zonder tijd of zonder koers laten we weg.
function perDag(candles: Candle[] | null): DagKoersen | null {
  if (!candles) return null;
  const uit: DagKoersen = {};
  for (const c of candles) {
    if (typeof c.tijd === 'number' && c.open > 0) uit[dagSleutel(c.tijd)] = c.open;
  }
  return Object.keys(uit).length > 0 ? uit : null;
}

// Haalt de dagkoersen die het jaaroverzicht nodig heeft: per coin dollars, plus EUR/USD uit
// Binance's EURUSDT (de enige historische wisselkoers die de app al kan bereiken). Binance geeft
// maximaal 1000 dagen terug; wat verder terug ligt blijft onbekend en komt als zodanig in het rapport.
export async function haalExportKoersen(symbolen: string[]): Promise<ExportKoersen> {
  const uniek = [...new Set(symbolen)];
  const [eurCandles, ...coinCandles] = await Promise.all([
    haalDagHistorie('EUR', 1000),
    ...uniek.map(s => haalDagHistorie(s, 1000)),
  ]);
  const coins: Record<string, DagKoersen> = {};
  uniek.forEach((s, i) => {
    const dagen = perDag(coinCandles[i]);
    if (dagen) coins[s] = dagen;
  });
  const eurUsdt = perDag(eurCandles);
  let eurPerUsd: DagKoersen | null = null;
  if (eurUsdt) {
    eurPerUsd = {};
    for (const [dag, usdPerEur] of Object.entries(eurUsdt)) eurPerUsd[dag] = 1 / usdPerEur;
  }
  return { coins, eurPerUsd };
}

function schrijfBestand(naam: string, inhoud: string): File {
  const bestand = new File(Paths.cache, naam);
  bestand.create({ overwrite: true });
  bestand.write(inhoud);
  return bestand;
}

export async function deelCsv(o: Jaaroverzicht): Promise<void> {
  const bestand = schrijfBestand(`kader-historie-${o.jaar}.csv`, maakCsv(o));
  await Sharing.shareAsync(bestand.uri, {
    mimeType: 'text/csv',
    dialogTitle: `Kader historie ${o.jaar}`,
    UTI: 'public.comma-separated-values-text',
  });
}

export async function deelPdf(o: Jaaroverzicht): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: maakHtml(o) });
  // printToFileAsync kiest een willekeurige bestandsnaam; geef hem een naam die in het deelmenu
  // en in de ontvangen mail iets zegt.
  const bestand = new File(Paths.cache, `kader-jaaroverzicht-${o.jaar}.pdf`);
  new File(uri).copy(bestand, { overwrite: true });
  await Sharing.shareAsync(bestand.uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Kader jaaroverzicht ${o.jaar}`,
    UTI: 'com.adobe.pdf',
  });
}
