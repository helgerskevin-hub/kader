// Sleutel voor een eToro-positie: omgeving plus positionID. eToro nummert demo- en echte posities
// los van elkaar, dus alleen het positionID kan in beide omgevingen voorkomen. Ontdubbelen op het
// kale ID liet dan een demo-positie een echte overschrijven (of andersom), en de verkoopknop hangt
// aan die omgeving.
import type { PortfolioTrade } from './portfolioTypes';

type MetPositie = Pick<PortfolioTrade, 'etoroPositionID' | 'etoroOmgeving'>;

export function positieSleutel(t: MetPositie): string | null {
  return t.etoroPositionID === undefined ? null : `${t.etoroOmgeving ?? 'real'}:${t.etoroPositionID}`;
}

// De negeerlijst bewaarde vroeger alleen het kale ID (een getal). Zo'n oude regel blijft in beide
// omgevingen gelden: liever een positie te veel verborgen (zelf terug te zien op eToro) dan een
// verwijderde trade die bij elke sync terugkomt. Nieuwe regels zijn de volledige sleutel.
export function isGenegeerd(genegeerd: Set<number | string>, t: MetPositie): boolean {
  if (t.etoroPositionID === undefined) return false;
  return genegeerd.has(t.etoroPositionID) || genegeerd.has(positieSleutel(t)!);
}

function selfCheck() {
  const check = (ok: boolean, m: string) => { if (!ok) throw new Error(m); };
  check(positieSleutel({ etoroPositionID: 5 }) === 'real:5', 'zonder omgeving is het echt');
  check(positieSleutel({ etoroPositionID: 5, etoroOmgeving: 'demo' }) === 'demo:5', 'demo telt mee');
  check(positieSleutel({}) === null, 'zonder ID geen sleutel');
  check(isGenegeerd(new Set([5]), { etoroPositionID: 5, etoroOmgeving: 'demo' }), 'oud getal geldt overal');
  check(!isGenegeerd(new Set(['real:5']), { etoroPositionID: 5, etoroOmgeving: 'demo' }), 'nieuwe sleutel alleen eigen omgeving');
  check(isGenegeerd(new Set(['demo:5']), { etoroPositionID: 5, etoroOmgeving: 'demo' }), 'nieuwe sleutel treft');
}
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) selfCheck();
