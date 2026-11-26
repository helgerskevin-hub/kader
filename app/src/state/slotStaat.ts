// Staat het app-slot aan? Voor wat buiten de provider draait en geen React heeft: de widget-taak,
// de achtergrondtaak en het versturen van meldingen. Een eigen bestand omdat etoroSleutels.ts
// slotOpslag.ts importeert; hier kunnen beide zonder importcirkel.
//
// Aan als er een pincode-record is, anders als de hint aan staat (pincodeOfHintAan), of als er een
// eToro-koppeling is zonder pincode (de verplichte setup: dan is de app ook dicht). Fail-closed: een
// kluisfout of leesfout in een van beide telt als aan. Geen van beide gebruikt inSlotRij, dus dit
// kan ook vlak na werk in de rij aangeroepen worden zonder op zichzelf te wachten.
import { pincodeOfHintAan } from './slotOpslag';
import { sleutelUitkomst } from './etoroSleutels';

export async function slotStaatAan(): Promise<boolean> {
  try {
    if (await pincodeOfHintAan()) return true;
    // Zoals leesEtoro in de provider: alles behalve 'geen' (ook 'kluisfout') telt als gekoppeld.
    return (await sleutelUitkomst()).soort !== 'geen';
  } catch {
    return true;
  }
}
