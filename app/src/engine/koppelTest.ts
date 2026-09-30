// Vertaalt de uitslag van de verbindingstest in de wizard naar de vijf rijen die stap 4 toont, en
// naar de foutstaat. Wat er getest wordt staat in de wizard (/me voor de scopes, daarna het
// portfolio per omgeving); hier staat alleen wat je daarvan te zien krijgt, zodat die regels los te
// toetsen zijn onder `npx tsx`.
//
// De regels zijn dezelfde als vóór de nieuwe wizard: faalt /me, dan werkt de sleutel niet. Werkt
// geen van beide omgevingen, dan ook niet. Werkt er minstens één, dan mag je opslaan, en zie je per
// omgeving wat er misging.

import type { EtoroOmgeving } from './etoro';

export type OmgevingToets = { ok: true; posities: number } | { ok: false; fout: string };

export type KoppelUitslag =
  | { soort: 'meFout'; fout: string }
  | {
      soort: 'getest';
      magSchrijven: Record<EtoroOmgeving, boolean>;
      omgeving: Record<EtoroOmgeving, OmgevingToets>;
    };

export type RijStaat = 'ok' | 'nee' | 'fout';

export interface TestRij {
  id: 'sleutel' | 'demo' | 'real' | 'schrijfDemo' | 'schrijfReal';
  titel: string;
  sub: string;
  waarde: string | null;
  staat: RijStaat;
}

export interface FoutRegel {
  naam: string;
  fout: string;
}

export interface KoppelBeeld {
  rijen: TestRij[];
  kanOpslaan: boolean;
  // Gevuld als de sleutel nergens werkt: dan toont de wizard het foutscherm in plaats van de lijst.
  foutstaat: FoutRegel[] | null;
}

function aantalPosities(n: number): string {
  return n === 1 ? '1 positie' : `${n} posities`;
}

export function bouwKoppelBeeld(uitslag: KoppelUitslag): KoppelBeeld {
  if (uitslag.soort === 'meFout') {
    return { rijen: [], kanOpslaan: false, foutstaat: [{ naam: 'Sleutel', fout: uitslag.fout }] };
  }

  const { magSchrijven, omgeving } = uitslag;
  const { demo, real } = omgeving;

  if (!demo.ok && !real.ok) {
    return {
      rijen: [],
      kanOpslaan: false,
      foutstaat: [
        { naam: 'Demo', fout: demo.fout },
        { naam: 'Echt', fout: real.fout },
      ],
    };
  }

  const omgevingRij = (id: 'demo' | 'real', toets: OmgevingToets): TestRij => ({
    id,
    titel: id === 'demo' ? 'Demo: posities ophalen' : 'Echt: posities ophalen',
    sub: toets.ok ? (id === 'demo' ? 'Oefenaccount' : 'Je echte account') : toets.fout,
    waarde: toets.ok ? aantalPosities(toets.posities) : null,
    staat: toets.ok ? 'ok' : 'fout',
  });

  // Handelen hangt aan de scope, niet aan of het portfolio lukte. Werkt een omgeving niet, dan
  // zegt "mag" daar niets bruikbaars, dus dan staat er "mag niet".
  const schrijfRij = (id: 'schrijfDemo' | 'schrijfReal', o: EtoroOmgeving): TestRij => {
    const mag = magSchrijven[o] && omgeving[o].ok;
    return {
      id,
      titel: o === 'demo' ? 'Handelen in demo' : 'Handelen in echt',
      sub: mag ? 'Orders pas na jouw bevestiging' : 'Alleen meekijken',
      waarde: mag ? 'mag' : 'mag niet',
      staat: mag ? 'ok' : 'nee',
    };
  };

  return {
    rijen: [
      { id: 'sleutel', titel: 'Sleutel geldig', sub: 'eToro herkent de sleutel', waarde: null, staat: 'ok' },
      omgevingRij('demo', demo),
      omgevingRij('real', real),
      schrijfRij('schrijfDemo', 'demo'),
      schrijfRij('schrijfReal', 'real'),
    ],
    kanOpslaan: true,
    foutstaat: null,
  };
}

if (require.main === module) {
  const alles = bouwKoppelBeeld({
    soort: 'getest',
    magSchrijven: { demo: true, real: true },
    omgeving: { demo: { ok: true, posities: 3 }, real: { ok: true, posities: 1 } },
  });
  console.assert(alles.kanOpslaan && alles.foutstaat === null, 'alles werkt: opslaan mag');
  console.assert(alles.rijen.length === 5, 'vijf rijen');
  console.assert(alles.rijen[1].waarde === '3 posities' && alles.rijen[2].waarde === '1 positie', 'aantal posities, enkelvoud klopt');
  console.assert(alles.rijen[3].waarde === 'mag' && alles.rijen[4].waarde === 'mag', 'schrijfrecht uit de scopes');

  const leesDemo = bouwKoppelBeeld({
    soort: 'getest',
    magSchrijven: { demo: false, real: false },
    omgeving: { demo: { ok: true, posities: 0 }, real: { ok: true, posities: 0 } },
  });
  console.assert(leesDemo.kanOpslaan, 'leessleutel mag bewaard worden');
  console.assert(leesDemo.rijen[3].staat === 'nee' && leesDemo.rijen[4].staat === 'nee', 'leessleutel: handelen mag niet');

  const eenFaalt = bouwKoppelBeeld({
    soort: 'getest',
    magSchrijven: { demo: true, real: true },
    omgeving: { demo: { ok: true, posities: 2 }, real: { ok: false, fout: 'Geweigerd.' } },
  });
  console.assert(eenFaalt.kanOpslaan && eenFaalt.foutstaat === null, 'één omgeving werkt: opslaan mag, zoals voorheen');
  console.assert(eenFaalt.rijen[2].staat === 'fout' && eenFaalt.rijen[2].sub === 'Geweigerd.', 'de echte foutregel staat bij de rij');
  console.assert(eenFaalt.rijen[4].waarde === 'mag niet', 'geen handelen in een omgeving die niet werkt');

  const beideFalen = bouwKoppelBeeld({
    soort: 'getest',
    magSchrijven: { demo: true, real: true },
    omgeving: { demo: { ok: false, fout: 'A' }, real: { ok: false, fout: 'B' } },
  });
  console.assert(!beideFalen.kanOpslaan, 'beide falen: niet opslaan');
  console.assert(beideFalen.foutstaat?.length === 2 && beideFalen.foutstaat[0].fout === 'A', 'foutstaat per omgeving');

  const meFout = bouwKoppelBeeld({ soort: 'meFout', fout: 'Niet geaccepteerd.' });
  console.assert(!meFout.kanOpslaan && meFout.foutstaat?.[0].fout === 'Niet geaccepteerd.', '/me faalt: foutstaat');

  console.log('koppelTest.ts self-check geslaagd');
}
