#!/usr/bin/env node
// Bouwt een release-APK die gegarandeerd de versionCode/versionName uit app.json
// bevat en met de verwachte (debug) sleutel is ondertekend. Voorkomt de bug waarbij
// `android/` een oude prebuild blijft en de native versionCode achterloopt op
// app.json, waardoor een update op een telefoon als "downgrade" wordt geweigerd.

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Thom en Kevin bouwen allebei, de een op Windows en de ander op macOS. De namen van de
// SDK-tools en de Gradle-wrapper verschillen per platform, en dit script moet op allebei
// draaien: het is de enige route naar een release-APK, dus een uitzondering "even zelf
// gradlew draaien" is precies waar dit script tegen beschermt.
const OP_WINDOWS = process.platform === 'win32';

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const VERWACHTE_SHA256 =
  'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';

function fout(bericht) {
  console.error(`\nFOUT: ${bericht}\n`);
  process.exit(1);
}

function standaardAndroidHome() {
  if (OP_WINDOWS) return join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Android', 'sdk');
  return join(homedir(), 'Android', 'Sdk');
}

// Numeriek sorteren, niet alfabetisch: anders wint "9.0.0" ooit van "10.0.0".
function nieuwsteVersie(versies) {
  return versies
    .filter((v) => /^\d+\.\d+\.\d+/.test(v))
    .sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
      return 0;
    })
    .pop();
}

function vindBuildTools() {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || standaardAndroidHome();
  const buildToolsDir = join(androidHome, 'build-tools');
  if (!existsSync(buildToolsDir)) {
    fout(`Kan build-tools niet vinden in ${buildToolsDir}. Zet ANDROID_HOME correct.`);
  }
  const laatste = nieuwsteVersie(readdirSync(buildToolsDir));
  if (!laatste) fout(`Geen bruikbare build-tools-versie gevonden in ${buildToolsDir}.`);
  return join(buildToolsDir, laatste);
}

function leesAppJson() {
  const appJson = JSON.parse(readFileSync(join(APP_DIR, 'app.json'), 'utf8'));
  return {
    versionName: appJson.expo.version,
    versionCode: appJson.expo.android.versionCode,
  };
}

// 0.4.3 en 0.4.4 zijn uitgebracht zonder `nieuweFeatures`, waardoor gebruikers na de update de
// oude changelog-melding zagen in plaats van de rondleiding "Nieuw in Kader". Deze check laat een
// release die dat opnieuw zou doen niet eens beginnen. De TS-bron wordt met esbuild (zit in de
// dependencies van Expo) naar een data-URL-module omgezet, zodat we het echte object lezen en niet
// de tekst parsen.
export async function controleerChangelog(versionName) {
  const { buildSync } = await import('esbuild');
  const code = buildSync({
    entryPoints: [join(APP_DIR, 'src', 'changelog.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  }).outputFiles[0].text;
  const { CHANGELOG } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const nieuwste = CHANGELOG[0];
  if (nieuwste.versie !== versionName) {
    return `De nieuwste changelog-entry (${nieuwste.versie}) hoort bij versie ${versionName} uit app.json te staan. Pas app/src/changelog.ts aan.`;
  }
  if (!Array.isArray(nieuwste.nieuweFeatures) || nieuwste.nieuweFeatures.length === 0) {
    return `De changelog-entry voor ${versionName} heeft geen nieuweFeatures. Zonder die pagina's krijgen gebruikers de oude wijzigingenlijst in plaats van de rondleiding "Nieuw in Kader". Voeg minstens een pagina toe in app/src/changelog.ts.`;
  }
  return null;
}

// Alleen uitvoeren als dit bestand zelf gestart wordt, zodat de check ook los te testen is.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
console.log('== Kader release-build ==');
const { versionName, versionCode } = leesAppJson();
console.log(`app.json zegt: version=${versionName} versionCode=${versionCode}`);

const changelogFout = await controleerChangelog(versionName);
if (changelogFout) fout(changelogFout);
console.log('OK: changelog heeft een rondleiding voor deze versie.');

const buildTools = vindBuildTools();
const aapt2 = join(buildTools, OP_WINDOWS ? 'aapt2.exe' : 'aapt2');
const apksigner = join(buildTools, OP_WINDOWS ? 'apksigner.bat' : 'apksigner');
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
execFileSync(OP_WINDOWS ? '.\\gradlew.bat' : './gradlew', ['assembleRelease'], {
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
// shell alleen op Windows, waar apksigner een .bat is die anders niet start. Op macOS/Linux
// zou shell:true het APK-pad op spaties splitsen, en het projectpad van Kevin bevat er twee
// ("Claude Copy trading/Claude access"); apksigner zag daardoor losse parameters.
const signOutput = execFileSync(apksigner, ['verify', '--print-certs', apkPad], {
  encoding: 'utf8',
  shell: OP_WINDOWS,
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
}
