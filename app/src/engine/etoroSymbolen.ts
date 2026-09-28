// Zes coins voert eToro onder een andere naam of in een andere eenheid dan Kader. Dit bestand is de
// enige plek die dat weet; de rest van de app blijft in Kader-symbolen en Kader-koersen (per coin)
// en vertaalt alleen aan de grens met eToro (zoeken, orders, import). Bewust puur, geen imports van
// netwerk of storage.
//
// Gemeten op 28 sep 2026 tegen eToro's publieke instrumentenlijst
// (api.etorostatic.com/sapi/instrumentsmetadata/V1.1/instruments) en de live koersen
// (www.etoro.com/sapi/trade-real/instruments/?InstrumentDataFilters=Rates&InstrumentIds=...).
// Bewijs van de factor: eToro SHIBxM stond op 5.60 tegenover Binance SHIB 0.00000561, PEPExM op
// 4.16 tegenover Binance PEPE 0.00000417, allebei precies ×1.000.000. POL/S/SKY/RENDER staan bij
// eToro op exact de Binance-koers van diezelfde ticker (Kader haalt die al via BINANCE_ALIAS in
// marketData.ts), dus factor 1 voor die vier.
export const ETORO_ALIAS: Record<string, { symbool: string; factor: number }> = {
  SHIB: { symbool: 'SHIBxM', factor: 1_000_000 },
  PEPE: { symbool: 'PEPExM', factor: 1_000_000 },
  MATIC: { symbool: 'POL', factor: 1 },
  FTM: { symbool: 'S', factor: 1 },
  MKR: { symbool: 'SKY', factor: 1 },
  RNDR: { symbool: 'RENDER', factor: 1 },
};

// Kader-symbool naar eToro's eigen schrijfwijze (met kleine letters waar eToro die gebruikt, zoals
// SHIBxM). Geen alias bekend: het symbool zelf, in hoofdletters.
export function naarEtoroSymbool(kader: string): string {
  const sleutel = kader.trim().toUpperCase();
  return ETORO_ALIAS[sleutel]?.symbool ?? sleutel;
}

// Hoofdletterongevoelig de andere kant op: eToro's schrijfwijze (SHIBXM, SHIBxM, shibxm, ...) naar
// Kaders symbool. Onbekend eToro-symbool: het symbool zelf, in hoofdletters.
export function vanEtoroSymbool(etoro: string): string {
  const sleutel = etoro.trim().toUpperCase();
  for (const [kader, alias] of Object.entries(ETORO_ALIAS)) {
    if (alias.symbool.toUpperCase() === sleutel) return kader;
  }
  return sleutel;
}

// Koersfactor voor een Kader-symbool: eToro-koers = Kader-koers * factor. 1 voor elke coin die niet
// in de tabel staat.
export function koersFactor(kaderSymbool: string): number {
  return ETORO_ALIAS[kaderSymbool.trim().toUpperCase()]?.factor ?? 1;
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/etoroSymbolen.ts`
if (require.main === module) {
  for (const [kader, alias] of Object.entries(ETORO_ALIAS)) {
    console.assert(naarEtoroSymbool(kader) === alias.symbool, `${kader} moet naar ${alias.symbool} vertalen`);
    console.assert(naarEtoroSymbool(kader.toLowerCase()) === alias.symbool, `${kader} in kleine letters moet ook vertalen`);
    console.assert(vanEtoroSymbool(alias.symbool) === kader, `${alias.symbool} moet terug naar ${kader}`);
    console.assert(vanEtoroSymbool(alias.symbool.toUpperCase()) === kader, `${alias.symbool.toUpperCase()} moet ook terug naar ${kader}`);
    console.assert(vanEtoroSymbool(alias.symbool.toLowerCase()) === kader, `${alias.symbool.toLowerCase()} moet ook terug naar ${kader}`);
    console.assert(koersFactor(kader) === alias.factor, `koersfactor van ${kader} moet ${alias.factor} zijn`);
  }

  // Onbekend symbool (BTC) blijft zichzelf, met factor 1.
  console.assert(naarEtoroSymbool('BTC') === 'BTC', 'een onbekend symbool blijft zichzelf');
  console.assert(vanEtoroSymbool('BTC') === 'BTC', 'een onbekend eToro-symbool blijft zichzelf');
  console.assert(koersFactor('BTC') === 1, 'een onbekende coin heeft factor 1');
  console.assert(naarEtoroSymbool('btc') === 'BTC', 'kleine letters worden hoofdletters');

  console.log('etoroSymbolen.ts self-check geslaagd');
}
