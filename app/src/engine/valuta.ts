// Weergavevaluta van de app. Bewust een kale module met eigen abonnees in plaats van een React
// context: de meldingen (notifications/) en state/advies.ts stellen ook teksten met bedragen samen
// en die draaien buiten de React-boom, soms zelfs terwijl de app niet op de voorgrond staat.
// state/useValuta.ts hangt hier de persistentie en de React-hook omheen.

export type Valuta = 'USD' | 'EUR';

export interface ValutaStand {
  valuta: Valuta;
  // Euro per dollar. null zolang er nog geen koers opgehaald is. In dat geval tonen we dollars,
  // ook als de gebruiker euro's koos: een verzonnen wisselkoers is erger dan geen wisselkoers.
  eurPerUsd: number | null;
}

let stand: ValutaStand = { valuta: 'USD', eurPerUsd: null };
const luisteraars = new Set<() => void>();

export function haalValutaStand(): ValutaStand {
  return stand;
}

// Vervangt het object alleen als er echt iets wijzigt, zodat useSyncExternalStore een stabiele
// snapshot houdt en niet elke render opnieuw afgaat.
export function zetValutaStand(volgende: Partial<ValutaStand>): void {
  const nieuw: ValutaStand = { ...stand, ...volgende };
  if (nieuw.valuta === stand.valuta && nieuw.eurPerUsd === stand.eurPerUsd) return;
  stand = nieuw;
  for (const luisteraar of luisteraars) luisteraar();
}

export function abonneerValuta(luisteraar: () => void): () => void {
  luisteraars.add(luisteraar);
  return () => {
    luisteraars.delete(luisteraar);
  };
}

// Wat er daadwerkelijk getoond wordt. Wijkt af van stand.valuta zolang de koers ontbreekt.
export function actieveValuta(): Valuta {
  return stand.valuta === 'EUR' && stand.eurPerUsd !== null ? 'EUR' : 'USD';
}

export const VALUTA_TEKEN: Record<Valuta, string> = { USD: '$', EUR: '€' };

// Rekent een dollarbedrag om naar de weergavevaluta. Alle marktdata (Binance, CoinGecko, eToro)
// komt in dollars binnen, dus dit is altijd de richting.
export function naarWeergave(bedragUsd: number, forceer?: Valuta): { waarde: number; teken: string } {
  const valuta = forceer ?? actieveValuta();
  if (valuta === 'EUR' && stand.eurPerUsd !== null) {
    return { waarde: bedragUsd * stand.eurPerUsd, teken: VALUTA_TEKEN.EUR };
  }
  return { waarde: bedragUsd, teken: VALUTA_TEKEN.USD };
}

// De andere kant op: een bedrag zoals de gebruiker het intikt terug naar dollars. Nodig zodra een
// scherm een bedrag laat INVULLEN in plaats van tonen (de prijsalerts), want alles wat we opslaan
// en met marktdata vergelijken is in dollars. Staat de app in dollars, of ontbreekt de koers, dan
// is dit de identiteit.
export function vanWeergave(bedrag: number): number {
  if (actieveValuta() === 'EUR' && stand.eurPerUsd !== null && stand.eurPerUsd > 0) {
    return bedrag / stand.eurPerUsd;
  }
  return bedrag;
}
