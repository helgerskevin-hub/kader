// De platforms waar een positie kan staan en waar een coin te koop is.
//
// Vandaag zijn dat er twee (eToro en handmatig ingevoerd), maar fase 4b van de to-do voegt er
// platforms aan toe en dan moet je kunnen kiezen waar een order heen gaat. Alles hier telt daarom
// op een id met een register erachter, en niet op "eToro of anders". Een nieuw platform is een
// regel in PLATFORMS plus een regel in handelbaarOp().
//
// Puur, geen React en geen thema: de kleur staat hier als INDEX in colors.verdeling, want welke
// hexwaarde daarbij hoort verschilt per thema en dat is een keuze van de themalaag.

import { PortfolioTrade, bronVan } from '../state/portfolioTypes';
import { ETORO_TRADABLE } from './opportunities';

export type PlatformId = 'etoro' | 'etoro-demo' | 'handmatig';

export interface PlatformInfo {
  id: PlatformId;
  naam: string;
  // Eén hoofdletter voor in de chip. Alleen zichtbaar als er geen echt logo van dit platform in de
  // app zit; welke dat zijn staat in LOGOS in PlatformChip.tsx, want een PNG hoort niet in dit
  // bestand. Nooit een nagetekend merk: alleen het echte bestand of een letter.
  monogram: string;
  // Index in colors.verdeling, of -1 voor het neutrale grijs.
  //
  // Bewust niet index 0 of 1: die zijn in een van beide thema's gelijk aan colors.primair of
  // colors.cta, en een merkje in exact de CTA-kleur leest als een knop.
  kleurIndex: number;
  // Speelgeld. Krijgt een DEMO-pil naast de naam, zodat een bedrag nooit voor echt geld doorgaat.
  demo?: boolean;
}

export const PLATFORMS: Record<PlatformId, PlatformInfo> = {
  etoro: { id: 'etoro', naam: 'eToro', monogram: 'E', kleurIndex: 2 },
  'etoro-demo': { id: 'etoro-demo', naam: 'eToro demo', monogram: 'E', kleurIndex: 2, demo: true },
  // Handmatig is geen platform met een merk, dus het krijgt ook geen merkkleur.
  handmatig: { id: 'handmatig', naam: 'Handmatig', monogram: 'H', kleurIndex: -1 },
};

export function platformInfo(id: PlatformId): PlatformInfo {
  return PLATFORMS[id] ?? PLATFORMS.handmatig;
}

export function platformNaam(id: PlatformId): string {
  return platformInfo(id).naam;
}

// Waar staat deze positie? Een eToro-positie zonder omgeving is per definitie echt: alles van vóór
// de demo-schakelaar kwam uit een echt account (zie etoroOmgeving in portfolioTypes.ts).
export function platformVanTrade(t: PortfolioTrade): PlatformId {
  if (bronVan(t) !== 'etoro') return 'handmatig';
  return (t.etoroOmgeving ?? 'real') === 'demo' ? 'etoro-demo' : 'etoro';
}

// Op welke platforms is deze coin te koop? Dit is kennis uit Kaders eigen lijsten en hangt dus
// niet af van een koppeling: ook zonder eToro-sleutel klopt het antwoord.
//
// Demo staat er bewust niet bij. "Verhandelbaar op eToro demo" is geen eigenschap van de coin maar
// van je account, en op een tradekaart zou dat beweren dat het een ander platform is.
export function handelbaarOp(symbool: string): PlatformId[] {
  return ETORO_TRADABLE.has(symbool.toUpperCase()) ? ['etoro'] : [];
}

// Voor de schermlezer: "eToro en Bitvavo", "eToro, Bitvavo en Coinbase". Een opsomming met een
// komma leest de schermlezer als een lijst zonder einde; het woord "en" maakt er een zin van.
export function noemPlatforms(ids: PlatformId[]): string {
  const namen = ids.map(platformNaam);
  if (namen.length === 0) return '';
  if (namen.length === 1) return namen[0];
  return `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`;
}

// ponytail: self-check ipv testframework, run met `npx tsx src/engine/platforms.ts` vanuit app/
if (require.main === module) {
  let missers = 0;
  const origineleAssert = console.assert.bind(console);
  console.assert = ((voorwaarde?: boolean, ...rest: unknown[]) => {
    if (!voorwaarde) missers++;
    origineleAssert(voorwaarde, ...rest);
  }) as typeof console.assert;

  const trade = (extra: Partial<PortfolioTrade>): PortfolioTrade => ({
    id: '1', symbool: 'BTC', naam: 'Bitcoin', entryPrijs: 100, stopLoss: 90, takeProfit: 130,
    rr: 3, datum: '', status: 'open', ...extra,
  });

  // ---------- Waar staat een positie ----------
  console.assert(platformVanTrade(trade({ bron: 'etoro' })) === 'etoro', 'een eToro-positie staat op eToro');
  console.assert(platformVanTrade(trade({ bron: 'etoro', etoroOmgeving: 'demo' })) === 'etoro-demo',
    'een demo-positie krijgt een eigen platform');
  console.assert(platformVanTrade(trade({ bron: 'etoro', etoroOmgeving: 'real' })) === 'etoro',
    'real is gewoon eToro');
  console.assert(platformVanTrade(trade({ bron: 'handmatig' })) === 'handmatig', 'handmatig blijft handmatig');
  // Alles van vóór het bron-veld is handmatig ingevoerd, zie bronVan().
  console.assert(platformVanTrade(trade({})) === 'handmatig', 'zonder bron is een positie handmatig');

  // ---------- Waar is een coin te koop ----------
  console.assert(handelbaarOp('BTC').join(',') === 'etoro', 'BTC is te koop op eToro');
  console.assert(handelbaarOp('btc').join(',') === 'etoro', 'kleine letters horen ook te werken');
  // Een coin uit de kansen-scanner die niet op eToro staat levert een lege lijst, en dan hoort er
  // op de kaart niets getekend te worden in plaats van een grijze chip die een platform belooft.
  console.assert(handelbaarOp('VERZONNENCOIN').length === 0, 'een onbekende coin staat nergens');
  console.assert(!handelbaarOp('BTC').includes('etoro-demo'), 'demo is geen eigenschap van een coin');

  // ---------- Opsomming voor de schermlezer ----------
  console.assert(noemPlatforms(['etoro']) === 'eToro', 'één platform is gewoon de naam');
  console.assert(noemPlatforms(['etoro', 'handmatig']) === 'eToro en Handmatig', 'twee platforms krijgen "en"');
  console.assert(noemPlatforms(['etoro', 'etoro-demo', 'handmatig']) === 'eToro, eToro demo en Handmatig',
    'drie platforms krijgen komma`s en één "en"');
  console.assert(noemPlatforms([]) === '', 'geen platforms geeft geen tekst');

  // ---------- Register ----------
  console.assert(PLATFORMS.etoro.kleurIndex >= 2, 'de merkkleur mag niet op index 0 of 1 vallen (primair/cta)');
  console.assert(PLATFORMS.handmatig.kleurIndex === -1, 'handmatig heeft geen merkkleur');
  console.assert(PLATFORMS['etoro-demo'].demo === true, 'demo moet als demo gemerkt zijn');
  console.assert(
    Object.values(PLATFORMS).every(p => p.monogram.length === 1 && p.monogram === p.monogram.toUpperCase()),
    'elk monogram is één hoofdletter',
  );

  if (missers > 0) {
    console.error(`platforms.ts self-check: ${missers} misser(s)`);
    process.exit(1);
  }
  console.log('platforms.ts self-check geslaagd');
}
