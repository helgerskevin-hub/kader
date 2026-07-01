/**
 * Genereert alle Kader-app-iconen uit de officiële SVG-definitie.
 * Gebruik: node scripts/genereer-iconen.mjs  (vanuit de app/-map)
 * Vereist: npm i -D @resvg/resvg-js
 */

import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dir, '..', 'assets');
const ANDROID_RES = resolve(__dir, '..', 'android', 'app', 'src', 'main', 'res');

// ── Merkmarkeringen: vier hoeken + chart-polyline ──────────────────────────────
function marksGroup(size) {
  const s = size;
  const sw  = +(s * 0.0467).toFixed(2);
  const swp = +(s * 0.0367).toFixed(2);
  const a   = +(s * 0.233).toFixed(2);
  const b   = +(s * 0.767).toFixed(2);
  const pp  = [
    [s * 0.3, s * 0.633],
    [s * 0.4, s * 0.517],
    [s * 0.5, s * 0.567],
    [s * 0.7, s * 0.333],
  ].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return `<g stroke="white" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M${a} ${+(a*1.7).toFixed(2)} L${a} ${a} L${+(a*1.7).toFixed(2)} ${a}"/>
    <path d="M${+(b-a*0.7).toFixed(2)} ${a} L${b} ${a} L${b} ${+(a*1.7).toFixed(2)}"/>
    <path d="M${a} ${+(b-a*0.7).toFixed(2)} L${a} ${b} L${+(a*1.7).toFixed(2)} ${b}"/>
    <path d="M${+(b-a*0.7).toFixed(2)} ${b} L${b} ${b} L${b} ${+(b-a*0.7).toFixed(2)}"/>
  </g>
  <polyline points="${pp}" stroke="white" stroke-width="${swp}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.92"/>`;
}

// ── SVG-templates ──────────────────────────────────────────────────────────────

// Gradient afgerond vlak + merkteken (launcher-icoon)
function gradientSvg(px, size = 60) {
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1E3A8A"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.267)}" fill="url(#g)"/>
  ${marksGroup(size)}
</svg>`;
}

// Merkteken op transparant (splash, foreground)
function transparentSvg(px, size = 60) {
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${marksGroup(size)}
</svg>`;
}

// Gradient zonder merkteken (achtergrond)
function gradientOnlySvg(px, size = 60) {
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1E3A8A"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
</svg>`;
}

// Adaptive foreground: merkteken binnen safe zone (centrum 72×72 van 108×108)
function adaptiveForegroundSvg(px) {
  return `<svg width="${px}" height="${px}" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(18,18)">${marksGroup(72)}</g>
</svg>`;
}

// Adaptive background: gradient zonder afgeronde hoeken (Android knipt zelf)
function adaptiveBackgroundSvg(px) {
  return `<svg width="${px}" height="${px}" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1E3A8A"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
  </defs>
  <rect width="108" height="108" fill="url(#g)"/>
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

console.log('Kader-iconen genereren...\n[Expo assets]');

render(gradientSvg(1024),     resolve(ASSETS, 'icon.png'));
render(transparentSvg(1024),  resolve(ASSETS, 'splash-icon.png'));
render(transparentSvg(1024),  resolve(ASSETS, 'android-icon-foreground.png'));
render(gradientOnlySvg(1024), resolve(ASSETS, 'android-icon-background.png'));
render(transparentSvg(1024),  resolve(ASSETS, 'android-icon-monochrome.png'));
render(gradientSvg(196),      resolve(ASSETS, 'favicon.png'));

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
  render(gradientSvg(px), resolve(dir, 'ic_launcher.png'));
  render(gradientSvg(px), resolve(dir, 'ic_launcher_round.png'));
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
  render(adaptiveBackgroundSvg(px), resolve(dir, 'ic_launcher_background.png'));
  render(adaptiveForegroundSvg(px), resolve(dir, 'ic_launcher_monochrome.png'));
}

console.log('\nKlaar.');
