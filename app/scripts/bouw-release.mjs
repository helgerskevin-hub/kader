#!/usr/bin/env node
// Bouwt een release-APK die gegarandeerd de versionCode/versionName uit app.json
// bevat en met de verwachte (debug) sleutel is ondertekend. Voorkomt de bug waarbij
// `android/` een oude prebuild blijft en de native versionCode achterloopt op
// app.json, waardoor een update op een telefoon als "downgrade" wordt geweigerd.

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const VERWACHTE_SHA256 =
  'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';

function fout(bericht) {
  console.error(`\nFOUT: ${bericht}\n`);
  process.exit(1);
}

function vindBuildTools() {
  const androidHome = process.env.ANDROID_HOME || process.env.LOCALAPPDATA + '\\Android\\Sdk';
  const buildToolsDir = join(androidHome, 'build-tools');
  if (!existsSync(buildToolsDir)) {
    fout(`Kan build-tools niet vinden in ${buildToolsDir}. Zet ANDROID_HOME correct.`);
  }
  const versies = readdirSync(buildToolsDir).sort();
  const laatste = versies[versies.length - 1];
  return join(buildToolsDir, laatste);
}

function leesAppJson() {
  const appJson = JSON.parse(readFileSync(join(APP_DIR, 'app.json'), 'utf8'));
  return {
    versionName: appJson.expo.version,
    versionCode: appJson.expo.android.versionCode,
  };
}

console.log('== Kader release-build ==');
const { versionName, versionCode } = leesAppJson();
console.log(`app.json zegt: version=${versionName} versionCode=${versionCode}`);

const buildTools = vindBuildTools();
const aapt2 = join(buildTools, 'aapt2.exe');
const apksigner = join(buildTools, 'apksigner.bat');
if (!existsSync(aapt2) || !existsSync(apksigner)) {
  fout(`aapt2/apksigner niet gevonden in ${buildTools}`);
}

console.log('\n-- expo prebuild --clean --');
execFileSync('npx', ['expo', 'prebuild', '-p', 'android', '--clean'], {
  cwd: APP_DIR,
  stdio: 'inherit',
  shell: true,
});

console.log('\n-- gradlew assembleRelease --');
execFileSync('.\\gradlew.bat', ['assembleRelease'], {
  cwd: join(APP_DIR, 'android'),
  stdio: 'inherit',
  shell: true,
});

const apkPad = join(APP_DIR, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!existsSync(apkPad)) {
  fout(`Verwachte APK niet gevonden op ${apkPad}`);
}

console.log('\n-- Verificatie: versionCode/versionName --');
const badging = execFileSync(aapt2, ['dump', 'badging', apkPad], { encoding: 'utf8' });
const pakketRegel = badging.split('\n').find((r) => r.startsWith('package:'));
console.log(pakketRegel.trim());

const gevondenVersionCode = pakketRegel.match(/versionCode='(\d+)'/)?.[1];
const gevondenVersionName = pakketRegel.match(/versionName='([^']+)'/)?.[1];

if (gevondenVersionCode !== String(versionCode)) {
  fout(
    `versionCode in de gebouwde APK (${gevondenVersionCode}) komt niet overeen met app.json (${versionCode}). ` +
      `De prebuild is waarschijnlijk niet goed gegaan.`
  );
}
if (gevondenVersionName !== versionName) {
  fout(
    `versionName in de gebouwde APK (${gevondenVersionName}) komt niet overeen met app.json (${versionName}).`
  );
}
console.log('OK: versionCode en versionName kloppen.');

console.log('\n-- Verificatie: signing --');
const signOutput = execFileSync(apksigner, ['verify', '--print-certs', apkPad], {
  encoding: 'utf8',
  shell: true,
});
console.log(signOutput.trim());

const sha256Regel = signOutput
  .split('\n')
  .find((r) => r.includes('SHA-256 digest'));
if (!sha256Regel) {
  fout('Kon geen SHA-256-handtekening uitlezen uit apksigner-output.');
}
const gevondenSha256 = sha256Regel.split('digest:')[1].trim().toUpperCase().replace(/:/g, '');
if (gevondenSha256 !== VERWACHTE_SHA256.replace(/:/g, '')) {
  fout(
    `De APK is ondertekend met een andere sleutel dan verwacht.\n` +
      `  verwacht:  ${VERWACHTE_SHA256}\n` +
      `  gevonden:  ${gevondenSha256}\n` +
      `Dit zou een update op bestaande installaties breken (installatie geweigerd of ` +
      `data-verlies). Niet uploaden zonder dit eerst te begrijpen.`
  );
}
console.log('OK: handtekening komt overeen met de bekende debug-key.');

const doelPad = join(APP_DIR, `kader-${versionName}.apk`);
copyFileSync(apkPad, doelPad);
console.log(`\nKlaar. APK gekopieerd naar: ${doelPad}`);
