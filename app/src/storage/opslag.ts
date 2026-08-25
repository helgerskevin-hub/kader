import AsyncStorage from '@react-native-async-storage/async-storage';

export const SLEUTELS = {
  portfolio: 'portfolio_trades',
  traders: 'traders',
  onboarding: 'onboarding_klaar',
  thema: 'thema_modus',
  favorieten: 'favoriete_coins',
  changelogVersie: 'changelog_versie_gezien',
  // De ECHTE sleutels. Namen ongewijzigd, want ze staan al op de toestellen van gebruikers.
  // Let op: deze twee lopen sinds de handelskoppeling via state/etoroSleutels.ts en niet meer via
  // laadTekst/bewaarTekst; ze staan in expo-secure-store, niet in AsyncStorage.
  etoroApiKey: 'etoro_api_key',
  etoroUserKey: 'etoro_user_key',
  // Idem, maar voor het demo-account. Een demo-sleutel werkt niet op een echt pad en andersom.
  etoroDemoApiKey: 'etoro_demo_api_key',
  etoroDemoUserKey: 'etoro_demo_user_key',
  // Mag deze sleutel handelen? Afgeleid uit de scopes van /api/v1/me bij het koppelen. Geen
  // secure-store nodig: het is een ja/nee, geen geheim.
  etoroRealSchrijven: 'etoro_real_schrijven',
  etoroDemoSchrijven: 'etoro_demo_schrijven',
  // Welke omgeving actief is: 'demo' of 'real'. Standaard demo, zodat een verkeerde aanname geen
  // echt geld kost.
  etoroOmgeving: 'etoro_omgeving',
  // Symbool -> eToro instrumentId. Zonder TTL: die koppeling verandert niet en is gelijk in demo
  // en echt.
  etoroInstrumentIds: 'etoro_instrument_ids',
  // Verstuurde orders waarvan we niet weten of ze zijn doorgegaan (netwerk weggevallen, 5xx).
  // Staan op schijf voordat het verzoek uitgaat, zodat een app-kill ze niet kwijtraakt.
  onbekendeOrders: 'onbekende_orders',
  etoroSetupGevraagd: 'etoro_setup_gevraagd',
  laatsteSync: 'laatste_sync_tijd',
  // eToro-positie-ID's die de gebruiker uit zijn portfolio heeft verwijderd. Zonder deze lijst
  // zet de eerstvolgende sync ze er gewoon weer in, want ontdubbelen gebeurt op positie-ID.
  genegeerdeEtoroIds: 'genegeerde_etoro_ids',
  // Concept van het "Trade toevoegen"-formulier: overleeft een activity-restart door Android
  // terwijl je even naar eToro schakelt om de exacte prijs te checken.
  tradeConcept: 'trade_concept',
  // Stop-loss-grenzen per coin, opgehaald bij eToro. Gecachet omdat het endpoint een krap eigen
  // quotum heeft (20 per minuut) en de grenzen zelden wijzigen.
  etoroLimieten: 'etoro_limieten',
  // Gekozen weergave op het Portfolio-scherm: 'uitgebreid' of 'compact'.
  portfolioWeergave: 'portfolio_weergave',
  // Wanneer welke trade-melding voor het laatst verstuurd is. Zonder dit zou elke check dezelfde
  // melding opnieuw sturen. Gedeeld door de voorgrond-check en de achtergrondtaak, zodat die twee
  // elkaar niet dubbelen.
  meldingSuppressie: 'melding_suppressie',
  // Tijdstip van de laatst verstuurde trade-melding. Eén globale rem over alle triggers heen: de
  // suppressie hierboven voorkomt herhaling van dezelfde melding, dit voorkomt een stapel losse.
  laatsteMelding: 'laatste_melding_tijd',
  // Tijdstip van de laatste volledige sterke-koop-scan. Die scant het hele universum en is dus
  // te duur om bij elke check opnieuw te doen.
  laatsteSterkeKoopScan: 'laatste_sterke_koop_scan',
  // Log van verstuurde trade-meldingen (titel, tekst, tijdstip), nieuwste eerst, max 50. Terug te
  // lezen via het belletje in de header, ook als de melding zelf al uit de notificatiebalk is.
  meldingLog: 'melding_log',
  // Tijdstip waarop de gebruiker het meldingenlog voor het laatst geopend heeft, voor de ongelezen-
  // teller op het belletje.
  meldingenGezienTijd: 'meldingen_gezien_tijd',
  // Komma-gescheiden lijst van dichtgeklapte bron-groepen ('etoro'/'handmatig') op het
  // Portfolio-scherm.
  portfolioBronDicht: 'portfolio_bron_dicht',
  // Weergavevaluta: 'USD' of 'EUR'. Standaard USD, want dat is de valuta waarin alle marktdata
  // en eToro zelf rekenen.
  valuta: 'weergave_valuta',
  // Sinds wanneer Kader een ongunstig klimaat ziet, met de BTC-koers van dat moment. Nodig om te
  // kunnen tonen wat de markt sindsdien gedaan heeft. Wordt gewist zodra het klimaat niet langer
  // ongunstig is, dus de teller begint bij een volgende bearmarkt weer bij nul.
  bearModus: 'bear_modus_sinds',
  // Het handelskapitaal dat de gebruiker zelf invult, in dollars. Alleen nodig voor het
  // blootstellingsplafond: zonder noemer is "20% van je kapitaal" een lege uitspraak. Kader vraagt
  // dit nergens verplicht en verzint het nooit.
  handelskapitaal: 'handelskapitaal_usd',
  // Het laatst gemelde marktklimaat, zodat de achtergrondcheck een omslag kan herkennen. Zonder
  // dit zou elke ronde opnieuw "het klimaat is ongunstig" melden.
  laatsteKlimaat: 'laatste_gemelde_klimaat',
  // Laatst opgehaalde euro-per-dollar-koers met tijdstip. Gecachet zodat de app ook zonder
  // netwerk direct in euro's kan openen; ververst zodra hij ouder is dan een halve dag.
  wisselkoers: 'wisselkoers_eur_per_usd',
} as const;

export async function laadLijst<T>(sleutel: string): Promise<T[]> {
  try {
    const json = await AsyncStorage.getItem(sleutel);
    if (!json) return [];
    const data = JSON.parse(json);
    // corrupte/legacy sleutel kan een niet-array bevatten; callers doen direct .map/.filter/new Set
    return Array.isArray(data) ? data as T[] : [];
  } catch {
    return [];
  }
}

export async function bewaarLijst<T>(sleutel: string, lijst: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(sleutel, JSON.stringify(lijst));
  } catch {
    // schrijffout stilt neerzetten; data blijft in memory
  }
}

export async function laadVlag(sleutel: string): Promise<boolean> {
  try {
    const waarde = await AsyncStorage.getItem(sleutel);
    return waarde === '1';
  } catch {
    return false;
  }
}

export async function bewaarVlag(sleutel: string, waarde: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(sleutel, waarde ? '1' : '0');
  } catch {
    // schrijffout stilt neerzetten
  }
}

export async function laadTekst(sleutel: string, standaard: string): Promise<string> {
  try {
    const waarde = await AsyncStorage.getItem(sleutel);
    return waarde ?? standaard;
  } catch {
    return standaard;
  }
}

export async function bewaarTekst(sleutel: string, waarde: string): Promise<void> {
  try {
    await AsyncStorage.setItem(sleutel, waarde);
  } catch {
    // schrijffout stilt neerzetten
  }
}

export async function laadObject<T>(sleutel: string): Promise<T | null> {
  try {
    const json = await AsyncStorage.getItem(sleutel);
    return json ? JSON.parse(json) as T : null;
  } catch {
    return null;
  }
}

export async function bewaarObject<T>(sleutel: string, waarde: T): Promise<void> {
  try {
    await AsyncStorage.setItem(sleutel, JSON.stringify(waarde));
  } catch {
    // schrijffout stilt neerzetten; data blijft in memory
  }
}

export async function verwijderSleutel(sleutel: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(sleutel);
  } catch {
    // verwijderfout stilt neerzetten
  }
}
