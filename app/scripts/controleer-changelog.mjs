// 0.4.3 en 0.4.4 zijn uitgebracht zonder `nieuweFeatures`, waardoor gebruikers na de update de
// oude changelog-melding zagen in plaats van de rondleiding "Nieuw in Kader". Deze check laat een
// release die dat opnieuw zou doen niet eens beginnen. De TS-bron wordt met de API van tsx (een
// directe devDependency) geladen, zodat we het echte object lezen en niet de tekst parsen.
// Geeft null terug als alles klopt, anders een Nederlandse foutmelding.

import { tsImport } from 'tsx/esm/api';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

export async function controleerChangelog(versionName) {
  const { CHANGELOG } = await tsImport(join(APP_DIR, 'src', 'changelog.ts'), import.meta.url);
  const nieuwste = CHANGELOG[0];
  if (nieuwste.versie !== versionName) {
    return `De nieuwste changelog-entry (${nieuwste.versie}) hoort bij versie ${versionName} uit app.json te staan. Pas app/src/changelog.ts aan.`;
  }
  if (!Array.isArray(nieuwste.nieuweFeatures) || nieuwste.nieuweFeatures.length === 0) {
    return `De changelog-entry voor ${versionName} heeft geen nieuweFeatures. Zonder die pagina's krijgen gebruikers de oude wijzigingenlijst in plaats van de rondleiding "Nieuw in Kader". Voeg minstens een pagina toe in app/src/changelog.ts.`;
  }
  return null;
}
