// Het weekrapport: elke zondag vanaf 18:00 één melding met je week in R en hoe de signalen van
// Kader het deden. Een vaste ingeplande melding kan dat niet, want de tekst hangt van die week af.
// Daarom stuurt de achtergrondtaak hem, de eerste keer dat hij op zondag na 18:00 draait.
//
// De tekst zelf staat puur en getoetst in weekrapportTekst.ts.

import { laadLijst, laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import type { PortfolioTrade } from '../state/portfolioTypes';
import { bouwWeekrapport, weekSleutel } from './weekrapportTekst';
import { meldingenAan } from '../state/meldingVoorkeur';
import { laadSignalen } from '../state/signaalBoek';
import { stuurTradeMelding } from './meldingen';
import { loggeMeldingen } from './tradeChecks';

export const WEEKRAPPORT_UUR = 18;

export async function weekrapportAan(): Promise<boolean> {
  return (await laadTekst(SLEUTELS.weekrapportAan, 'aan')) !== 'uit';
}

export async function zetWeekrapport(aan: boolean): Promise<void> {
  await bewaarTekst(SLEUTELS.weekrapportAan, aan ? 'aan' : 'uit');
}

// Aangeroepen vanuit de achtergrondtaak. Doet niets buiten zondag na 18:00, of als het rapport van
// deze week al weg is.
export async function checkWeekrapport(nu: number = Date.now()): Promise<void> {
  const d = new Date(nu);
  if (d.getDay() !== 0 || d.getHours() < WEEKRAPPORT_UUR) return;
  if (!(await meldingenAan()) || !(await weekrapportAan())) return;
  const sleutel = weekSleutel(nu);
  if ((await laadTekst(SLEUTELS.laatsteWeekrapport, '')) === sleutel) return;

  const [trades, signalen] = await Promise.all([
    laadLijst<PortfolioTrade>(SLEUTELS.portfolio),
    laadSignalen(),
  ]);
  const tekst = bouwWeekrapport(trades, signalen, nu);
  // Een lege week is ook afgehandeld: geen melding om niets te melden.
  if (tekst) {
    const titel = 'Je week in Kader';
    if (!(await stuurTradeMelding(titel, tekst, { soort: 'portfolio' }))) return;
    await loggeMeldingen([{ sleutel: `weekrapport:${sleutel}`, titel, tekst, doel: { soort: 'portfolio' } }], nu);
  }
  await bewaarTekst(SLEUTELS.laatsteWeekrapport, sleutel);
}
