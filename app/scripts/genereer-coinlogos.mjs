/**
 * Bundelt alle coinlogo's uit assets/coins/*.svg in src/components/coinLogos.ts.
 * Gebruik: node scripts/genereer-coinlogos.mjs  (vanuit de app/-map)
 * Geen extra dependencies.
 *
 * Bestandsnaam = Kader-symbool in kleine letters (btc.svg, 1inch.svg). De volgorde en de
 * verzameling komen uit STANDAARD_UNIVERSUM in src/engine/analyzer.ts: het script faalt hard als
 * een coin geen logo heeft of als er een logo is dat bij geen enkele coin hoort.
 *
 * Elke SVG wordt compact gemaakt voor SvgXml (react-native-svg): width/height/class weg van het
 * <svg>-element (viewBox blijft, de grootte komt van de component), <?xml?> en commentaar weg,
 * witruimte tussen tags samengevouwen. De tekening zelf blijft ongemoeid.
 * Herkomst en licenties: assets/coins/LICENTIES.md.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const COINS = resolve(__dir, '..', 'assets', 'coins');
const ANALYZER = resolve(__dir, '..', 'src', 'engine', 'analyzer.ts');
const UIT = resolve(__dir, '..', 'src', 'components', 'coinLogos.ts');

function faal(melding) {
  console.error(`FOUT: ${melding}`);
  process.exit(1);
}

// STANDAARD_UNIVERSUM staat bovenaan analyzer.ts als een array met losse string-literals.
function leesUniversum() {
  const bron = readFileSync(ANALYZER, 'utf8');
  const blok = bron.match(/export const STANDAARD_UNIVERSUM\s*=\s*\[([\s\S]*?)\]/);
  if (!blok) faal('STANDAARD_UNIVERSUM niet gevonden in src/engine/analyzer.ts.');
  const symbolen = [...blok[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (symbolen.length === 0) faal('STANDAARD_UNIVERSUM is leeg of is niet als string-array te lezen.');
  return symbolen;
}

// Alleen width/height/class van het openingstag <svg ...> gaan weg, niet van de rest van de tekening.
function maakCompact(svg) {
  let uit = svg
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(?:width|height|class)="[^"]*"/g, ''))
    .replace(/>\s+</g, '><')
    .trim();
  if (!uit.startsWith('<svg')) faal('een logo begint na het opschonen niet met <svg.');
  // Wat react-native-svg niet of niet betrouwbaar tekent, of wat per render het netwerk op zou
  // gaan (een externe href). Zie LICENTIES.md voor hoe ADA, GRT en MANA daarom zijn aangepast.
  const verboden = uit.match(/<(?:style|filter|mask|image|script|foreignObject)|currentColor|href="(?!#)/);
  if (verboden) faal(`een logo bevat ${verboden[0]}, dat tekent react-native-svg niet goed.`);
  return uit;
}

const universum = leesUniversum();
const bestanden = readdirSync(COINS).filter((f) => f.toLowerCase().endsWith('.svg'));

const perSymbool = new Map();
for (const f of bestanden) perSymbool.set(f.slice(0, -4).toUpperCase(), f);

const ontbreekt = universum.filter((s) => !perSymbool.has(s));
if (ontbreekt.length > 0) faal(`geen logo in assets/coins/ voor: ${ontbreekt.join(', ')}`);

const teveel = [...perSymbool.keys()].filter((s) => !universum.includes(s));
if (teveel.length > 0) {
  faal(`logo's die niet in STANDAARD_UNIVERSUM staan: ${teveel.map((s) => perSymbool.get(s)).join(', ')}`);
}

const regels = universum.map((symbool) => {
  const svg = maakCompact(readFileSync(resolve(COINS, perSymbool.get(symbool)), 'utf8'));
  const sleutel = /^[A-Z_$][A-Z0-9_$]*$/.test(symbool) ? symbool : JSON.stringify(symbool);
  return `  ${sleutel}: ${JSON.stringify(svg)},`;
});

const uitvoer = `// Gegenereerd door scripts/genereer-coinlogos.mjs uit assets/coins/, niet met de hand bewerken.
// Licenties: assets/coins/LICENTIES.md
//
// Sleutel = Kader-symbool in hoofdletters, waarde = compacte SVG voor SvgXml (react-native-svg).
export const COIN_LOGOS: Readonly<Record<string, string>> = {
${regels.join('\n')}
};

// ponytail: self-check ipv testframework, run met \`npx tsx app/src/components/coinLogos.ts\`
if (require.main === module) {
  // require binnen de if: analyzer.ts draait zo alleen bij de self-check. Metro ziet de require
  // wel, maar analyzer.ts zit via MarktProvider toch al in de bundel.
  const { STANDAARD_UNIVERSUM } = require('../engine/analyzer') as { STANDAARD_UNIVERSUM: string[] };

  for (const symbool of STANDAARD_UNIVERSUM) {
    const logo = COIN_LOGOS[symbool];
    console.assert(typeof logo === 'string', \`\${symbool} moet een logo hebben\`);
    console.assert(logo?.startsWith('<svg'), \`het logo van \${symbool} moet met <svg beginnen\`);
    console.assert(logo?.includes('viewBox'), \`het logo van \${symbool} moet een viewBox hebben\`);
  }
  console.assert(
    Object.keys(COIN_LOGOS).length === STANDAARD_UNIVERSUM.length,
    \`er moeten precies \${STANDAARD_UNIVERSUM.length} logo's zijn, gevonden: \${Object.keys(COIN_LOGOS).length}\`,
  );

  console.log('coinLogos.ts self-check geslaagd');
}
`;

writeFileSync(UIT, uitvoer);
console.log(`${universum.length} logo's geschreven naar src/components/coinLogos.ts`);
