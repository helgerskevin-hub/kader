// Het handelskapitaal dat Kader zelf uit eToro haalt, per omgeving. De sync in PortfolioProvider
// schrijft het, useHandelskapitaal en laadHandelskapitaal lezen het. Los bestand zonder React-
// provider, zodat beide kanten het kunnen importeren zonder elkaar te importeren.
import type { EtoroOmgeving, HandelskapitaalStand } from '../engine/etoro';
import { SLEUTELS, bewaarObject, laadObject, verwijderSleutel } from '../storage/opslag';
import { heeftSleutels } from './etoroSleutels';

export interface AutoKapitaal extends HandelskapitaalStand {
  // Wanneer de sync dit ophaalde.
  tijd: number;
}

export type AutoKapitaalPerOmgeving = Partial<Record<EtoroOmgeving, AutoKapitaal>>;

let geheugen: AutoKapitaalPerOmgeving | null = null;
// Schrijven gaat een voor een. Anders kan een trage sync na een wis (ontkoppelen) het kapitaal van
// het oude account terugzetten, omdat noteren eerst leest en daarna schrijft.
let rij: Promise<void> = Promise.resolve();
function naDeRij(werk: () => Promise<void>): Promise<void> {
  rij = rij.then(werk, werk);
  return rij;
}
const luisteraars = new Set<(waarde: AutoKapitaalPerOmgeving) => void>();

export async function laadAutoKapitaal(): Promise<AutoKapitaalPerOmgeving> {
  if (geheugen) return geheugen;
  geheugen = (await laadObject<AutoKapitaalPerOmgeving>(SLEUTELS.handelskapitaalAuto)) ?? {};
  return geheugen;
}

function meld(waarde: AutoKapitaalPerOmgeving) {
  for (const l of luisteraars) l(waarde);
}

// Na een geslaagde sync. null = eToro stuurde geen credit: dan het oude getal van deze omgeving
// weg, anders blijft een verouderd kapitaal staan alsof het vers is.
export function noteerAutoKapitaal(omgeving: EtoroOmgeving, stand: HandelskapitaalStand | null): Promise<void> {
  return naDeRij(async () => {
    // De sleutel kan weg zijn terwijl deze sync liep. Dan hoort er niets meer te staan.
    if (!(await heeftSleutels())) return;
    const huidig = { ...(await laadAutoKapitaal()) };
    if (stand) huidig[omgeving] = { ...stand, tijd: Date.now() };
    else delete huidig[omgeving];
    geheugen = huidig;
    meld(huidig);
    await bewaarObject(SLEUTELS.handelskapitaalAuto, huidig);
  });
}

// Koppeling verwijderd: een kapitaal van een account dat Kader niet meer ziet hoort niet te blijven.
export function wisAutoKapitaal(): Promise<void> {
  return naDeRij(async () => {
    geheugen = {};
    meld({});
    await verwijderSleutel(SLEUTELS.handelskapitaalAuto);
  });
}

export function luisterNaarAutoKapitaal(l: (waarde: AutoKapitaalPerOmgeving) => void): () => void {
  luisteraars.add(l);
  return () => { luisteraars.delete(l); };
}
