import { Marktklimaat } from '../engine/marktklimaat';
import { laadObject, bewaarObject, verwijderSleutel, SLEUTELS } from '../storage/opslag';

// Houdt bij sinds wanneer Kader een ongunstig klimaat ziet, en wat de markt sindsdien gedaan heeft.
//
// Waarom: in een bearmarkt sluit de klimaatpoort en toont Kader geen koopsignalen meer. Dat is de
// juiste beslissing maar het voelt als een kapotte app, want niet-handelen levert zichtbaar niets
// op. Met deze teller wordt het wél zichtbaar: "34 dagen geen koopsignaal, de markt is in die
// periode 18% gedaald" is een resultaat, geen leeg scherm.
//
// De teller meet vanaf het moment dat Kader het ongunstige klimaat voor het eerst zág, niet vanaf
// het moment dat de bearmarkt objectief begon. Wie de app een maand niet opent, begint dus later te
// tellen. Dat is de eerlijke uitspraak en zo is de tekst ook geformuleerd.

interface BewaardeStand {
  vanaf: number;    // epoch ms
  btcPrijs: number; // BTC-slotkoers op dat moment
}

export interface BearModusStand {
  vanaf: number;
  dagen: number;
  btcToen: number;
  btcNu: number;
  // Verandering van BTC sinds het begin van de bear-modus, in procenten. Negatief in het geval
  // waarvoor dit bedoeld is.
  btcVeranderingPct: number;
}

const DAG_MS = 24 * 60 * 60 * 1000;

function geldig(stand: BewaardeStand | null): stand is BewaardeStand {
  return stand !== null
    && typeof stand.vanaf === 'number' && Number.isFinite(stand.vanaf) && stand.vanaf > 0
    && typeof stand.btcPrijs === 'number' && Number.isFinite(stand.btcPrijs) && stand.btcPrijs > 0;
}

/**
 * Werkt de bear-modus-teller bij op basis van een verse klimaatmeting.
 *
 * Ongunstig klimaat: start de teller als hij nog niet liep, en geef de stand terug.
 * Elk ander klimaat (of geen klimaatdata): wist de teller en geeft null terug, zodat een volgende
 * bearmarkt weer bij nul begint in plaats van bij de vorige.
 */
export async function bijwerkenBearModus(
  klimaat: Marktklimaat | null,
  nu: number = Date.now(),
): Promise<BearModusStand | null> {
  if (!klimaat || klimaat.klimaat !== 'ongunstig') {
    await verwijderSleutel(SLEUTELS.bearModus);
    return null;
  }

  const bewaard = await laadObject<BewaardeStand>(SLEUTELS.bearModus);
  let stand: BewaardeStand;
  if (geldig(bewaard)) {
    stand = bewaard;
  } else {
    stand = { vanaf: nu, btcPrijs: klimaat.btcPrijs };
    await bewaarObject(SLEUTELS.bearModus, stand);
  }

  return {
    vanaf: stand.vanaf,
    dagen: Math.max(0, Math.floor((nu - stand.vanaf) / DAG_MS)),
    btcToen: stand.btcPrijs,
    btcNu: klimaat.btcPrijs,
    btcVeranderingPct: ((klimaat.btcPrijs - stand.btcPrijs) / stand.btcPrijs) * 100,
  };
}
