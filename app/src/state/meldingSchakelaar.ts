// De knop "Meldingen aan/uit" uit Instellingen, en wat er daadwerkelijk moet gebeuren als je hem
// omzet. Staat los van state/meldingVoorkeur.ts (dat alleen de vlag bewaart) omdat de trade-checks
// die vlag lezen en niet aan de achtergrondtaak mogen hangen, zie de uitleg daar.
import { registreerAchtergrondtaak, stopAchtergrondtaak } from '../notifications/achtergrondtaak';
import { stelDagelijkseMeldingIn, wisAlleGeplandeMeldingen } from '../notifications/meldingen';
import { bewaarMeldingVoorkeur } from './meldingVoorkeur';
import { heeftWidgets } from '../widget/widgetVerversen';

/**
 * Zet alle Kader-meldingen aan of uit, en maakt dat meteen waar.
 *
 * Uit betekent echt uit: de geplande dagelijkse herinnering wordt gewist en de achtergrondtaak
 * uitgeschreven, behalve als er een widget op het startscherm staat (dan ververst hij alleen die). Alleen een vlag zetten zou de dagelijkse melding gewoon laten doorgaan, want die
 * staat al bij Android in de wachtrij en heeft de app niet meer nodig om af te gaan.
 */
export async function zetMeldingen(aan: boolean): Promise<void> {
  await bewaarMeldingVoorkeur(aan);
  if (aan) {
    await stelDagelijkseMeldingIn();
    await registreerAchtergrondtaak();
  } else {
    await wisAlleGeplandeMeldingen();
    // Met een widget op het startscherm blijft de taak draaien, alleen voor de widget: de taak
    // slaat de meldingen zelf over zolang ze uit staan.
    if (!(await heeftWidgets())) await stopAchtergrondtaak();
  }
}
