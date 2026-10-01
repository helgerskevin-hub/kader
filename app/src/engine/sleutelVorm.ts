// Kijkt of geplakte tekst eruitziet als een eToro-sleutel. Bewust alleen een hint en nooit een
// blokkade: eToro legt het formaat van zijn sleutels nergens vast, dus een strenge controle zou op
// een dag een goede sleutel weigeren. Wat hier wel gevangen wordt zijn de gewone plakfouten: een
// halve regel, een spatie midden in, of per ongeluk een hele zin uit de mail van eToro.
//
// Deze module is puur en draait onder `npx tsx` voor de self-check. De sleutel zelf komt nooit in
// een hint terecht, alleen het aantal tekens.

export interface SleutelBeoordeling {
  // De tekst zonder witruimte aan begin en eind, zoals hij in het veld hoort.
  schoon: string;
  tekens: number;
  // null als het eruitziet als een sleutel, anders een korte uitleg in gewone taal.
  hint: string | null;
}

// Kortere sleutels hebben we bij eToro nooit gezien. Het is een ondergrens voor "dit is geen halve
// plak", geen formaatregel.
const MIN_TEKENS = 16;

export function beoordeelGeplakteSleutel(tekst: string): SleutelBeoordeling {
  const schoon = tekst.trim();
  const tekens = schoon.length;
  if (tekens === 0) return { schoon, tekens, hint: 'Het klembord is leeg. Kopieer de sleutel bij eToro en tik opnieuw op Plak.' };
  if (/\s/.test(schoon)) return { schoon, tekens, hint: 'Dit lijkt geen sleutel: er staan spaties of regels in. Kopieer alleen de sleutel zelf.' };
  if (tekens < MIN_TEKENS) return { schoon, tekens, hint: `Dit lijkt te kort voor een sleutel (${tekens} tekens). Kopieer de hele sleutel.` };
  return { schoon, tekens, hint: null };
}

if (require.main === module) {
  const goed = beoordeelGeplakteSleutel('  abcDEF0123456789-_ghijklmnop \n');
  console.assert(goed.hint === null, 'nette sleutel geeft geen hint');
  console.assert(goed.schoon === 'abcDEF0123456789-_ghijklmnop', 'witruimte eromheen gaat eraf');
  console.assert(goed.tekens === 28, 'tekens tellen na het schoonmaken');

  console.assert(beoordeelGeplakteSleutel('   ').hint !== null, 'leeg klembord geeft een hint');
  console.assert(beoordeelGeplakteSleutel('abcdefgh ijklmnopqrstu').hint !== null, 'spatie midden in geeft een hint');
  console.assert(beoordeelGeplakteSleutel('abcdefgh\nijklmnopqrstu').hint !== null, 'regelovergang midden in geeft een hint');
  console.assert(beoordeelGeplakteSleutel('abc123').hint !== null, 'te kort geeft een hint');

  const kort = beoordeelGeplakteSleutel('geheim12');
  console.assert(kort.hint !== null && !kort.hint.includes('geheim12'), 'de sleutel zelf staat nooit in de hint');

  console.log('sleutelVorm.ts self-check geslaagd');
}
