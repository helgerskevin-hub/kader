/**
 * Genereert alle Kader-app-iconen uit de officiële v2-logodefinitie.
 * Gebruik: node scripts/genereer-iconen.mjs  (vanuit de app/-map)
 * Vereist: npm i -D @resvg/resvg-js
 *
 * v2-mark = open vierkant kader van 4 losse hoekhaken (geen gradient, geen trendlijn),
 * identiek aan components/KaderLogo.tsx. Achtergrondvlak = effen #2563EB (donker-variant,
 * gelijk aan android.adaptiveIcon.backgroundColor in app.json).
 *
 * Dit script schrijft zowel de Expo-assets als de Android mipmap-iconen. Draai het na
 * elke logowijziging en bouw daarna opnieuw, zodat het launcher-icoon meekomt met een update.
 */

import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dir, '..', 'assets');
const ANDROID_RES = resolve(__dir, '..', 'android', 'app', 'src', 'main', 'res');

const VLAK = '#2563EB';

// v2-geometrie: 4 hoekhaken in een 96×96 viewBox, identiek aan KaderLogo.tsx (HOEKEN).
const HOEKEN = [
  'M24 40 L24 24 L40 24',
  'M56 24 L72 24 L72 40',
  'M24 56 L24 72 L40 72',
  'M56 72 L72 72 L72 56',
];

// Groep met de 4 witte hoekhaken (viewBox 0 0 96 96, stroke-breedte 6, ronde hoeken).
function marks() {
  return `<g stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${HOEKEN.map((d) => `<path d="${d}"/>`).join('\n    ')}
  </g>`;
}

// ── SVG-templates ──────────────────────────────────────────────────────────────

// Effen vlak met afgeronde hoeken + merkteken (launcher-icoon en Expo icon.png).
function vlakSvg(px) {
  return `<svg width="${px}" height="${px}" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" rx="22" fill="${VLAK}"/>
  ${marks()}
</svg>`;
}

// Merkteken op transparant (splash, adaptive/legacy foreground, monochrome).
function transparentSvg(px) {
  return `<svg width="${px}" height="${px}" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  ${marks()}
</svg>`;
}

// Effen vlak zonder merkteken, zonder afronding (adaptive background; Android knipt zelf).
function vlakOnlySvg(px) {
  return `<svg width="${px}" height="${px}" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" fill="${VLAK}"/>
</svg>`;
}

// Adaptive foreground: merkteken ruim binnen de safe zone. Android (en Expo's prebuild, die
// dit als foregroundImage gebruikt) maskeert het icoon tot een cirkel; met scale 0.65 blijft
// het merkteken binnen die cirkel maar iets forser dan bij 0.58.
// translate = (108 - 96*0.65) / 2 = 22.8, zodat het gecentreerd blijft.
function adaptiveForegroundSvg(px) {
  return `<svg width="${px}" height="${px}" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(22.8,22.8) scale(0.65)">${marks()}</g>
</svg>`;
}

// ── Render ─────────────────────────────────────────────────────────────────────

function render(svg, outPath) {
  const resvg = new Resvg(svg);
  writeFileSync(outPath, resvg.render().asPng());
  console.log(`  ${outPath.replace(resolve(__dir, '..'), '.')}`);
}

function vervangWebp(dir, namen) {
  for (const naam of namen) {
    const webp = resolve(dir, naam + '.webp');
    if (existsSync(webp)) unlinkSync(webp);
  }
}

console.log('Kader-iconen genereren (v2)...\n[Expo assets]');

render(vlakSvg(1024),               resolve(ASSETS, 'icon.png'));
render(transparentSvg(1024),        resolve(ASSETS, 'splash-icon.png'));
// Foreground + monochrome met ingebakken safe-zone-padding: Expo's prebuild maakt hier de
// adaptive launcher-iconen van, dus de padding moet in de bron zitten, niet alleen in de mipmaps.
render(adaptiveForegroundSvg(1024), resolve(ASSETS, 'android-icon-foreground.png'));
render(vlakOnlySvg(1024),           resolve(ASSETS, 'android-icon-background.png'));
render(adaptiveForegroundSvg(1024), resolve(ASSETS, 'android-icon-monochrome.png'));
render(vlakSvg(196),          resolve(ASSETS, 'favicon.png'));

console.log('\n[Android mipmap - launcher]');
for (const [density, px] of [
  ['mipmap-mdpi',    48],
  ['mipmap-hdpi',    72],
  ['mipmap-xhdpi',   96],
  ['mipmap-xxhdpi',  144],
  ['mipmap-xxxhdpi', 192],
]) {
  const dir = resolve(ANDROID_RES, density);
  vervangWebp(dir, ['ic_launcher', 'ic_launcher_round']);
  render(vlakSvg(px), resolve(dir, 'ic_launcher.png'));
  render(vlakSvg(px), resolve(dir, 'ic_launcher_round.png'));
}

console.log('\n[Android mipmap - adaptive]');
for (const [density, px] of [
  ['mipmap-mdpi',    108],
  ['mipmap-hdpi',    162],
  ['mipmap-xhdpi',   216],
  ['mipmap-xxhdpi',  324],
  ['mipmap-xxxhdpi', 432],
]) {
  const dir = resolve(ANDROID_RES, density);
  vervangWebp(dir, ['ic_launcher_foreground', 'ic_launcher_background', 'ic_launcher_monochrome']);
  render(adaptiveForegroundSvg(px), resolve(dir, 'ic_launcher_foreground.png'));
  render(vlakOnlySvg(px),           resolve(dir, 'ic_launcher_background.png'));
  render(adaptiveForegroundSvg(px), resolve(dir, 'ic_launcher_monochrome.png'));
}

console.log('\nKlaar.');
