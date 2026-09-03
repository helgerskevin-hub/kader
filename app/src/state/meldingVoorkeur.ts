// Staan Kaders meldingen aan? Eén vlag, gelezen door de dagelijkse herinnering, de trade-checks en
// de prijsalerts.
//
// Dit bestand doet met opzet NIETS anders dan die vlag lezen en schrijven, en importeert dus niets
// uit notifications/. Reden: tradeChecks leest de vlag, en zou dit bestand ook de achtergrondtaak
// importeren, dan ontstaat de cyclus tradeChecks -> meldingVoorkeur -> achtergrondtaak ->
// tradeChecks. Metro laat zo'n cyclus toe maar levert er een half geïnitialiseerde module bij op,
// en achtergrondtaak.ts registreert op module-niveau de taak die Android wakker maakt. Dat is
// precies het bestand waar je geen halve initialisatie wil.
//
// Het daadwerkelijk aan- en uitzetten (herinnering wissen, taak uitschrijven) staat daarom in
// state/meldingSchakelaar.ts, dat alleen door de UI aangeroepen wordt.
//
// Standaard AAN. Dat is het gedrag van elke versie tot nu toe, en een update die stilletjes de
// meldingen uitzet is erger dan een update die niets doet.
import { SLEUTELS, bewaarTekst, laadTekst } from '../storage/opslag';

// undefined = nog niet van schijf gelezen. Zodra hij gelezen is blijft hij hier staan, zodat de
// checks er niet bij elke ronde AsyncStorage voor hoeven aan te spreken.
let geheugen: boolean | undefined;

export async function meldingenAan(): Promise<boolean> {
  if (geheugen !== undefined) return geheugen;
  // Alles behalve een expliciete 'uit' telt als aan, inclusief een ontbrekende of corrupte waarde.
  // Dat is de kant waar een fout het minst kost: hooguit een melding die je niet wilde.
  geheugen = (await laadTekst(SLEUTELS.meldingenAan, 'aan')) !== 'uit';
  return geheugen;
}

/** Alleen de vlag. Het gevolg ervan regelt state/meldingSchakelaar.ts. */
export async function bewaarMeldingVoorkeur(aan: boolean): Promise<void> {
  geheugen = aan;
  await bewaarTekst(SLEUTELS.meldingenAan, aan ? 'aan' : 'uit');
}
