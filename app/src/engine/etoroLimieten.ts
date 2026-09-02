// eToro weigert een order als de stop-loss te dicht bij of te ver van je entry ligt. Die grenzen
// verzinnen we niet: ze komen per instrument uit POST /api/v2/trading/info/eligibility.
//
// Dit bestand is bewust puur (geen netwerk, geen AsyncStorage): het ophalen zit in etoro.ts en het
// cachen in state/useStopLossLimiet.ts, zodat de rekenregels los te draaien zijn met de self-check
// onderaan.
import { fmtPrijs } from './format';
import type { Richting } from './types';

// Deze adviezen verschijnen alleen op de orderschermen (koop, verkoop-niveaus, trade toevoegen) en
// die rekenen in dollars, omdat eToro dat doet. Dus hier expliciet dollars, ook als de gebruiker
// de app op euro's heeft staan: het getal moet één op één matchen met wat hij intikt.
const DOLLARS = { valuta: 'USD' } as const;

// Alle velden optioneel: eToro mag er morgen een weglaten zonder dat wij crashen.
export interface EtoroLeverageConfig {
  settlementType?: string;
  direction?: string;
  leverageValues?: number[];
  allowEditStopLoss?: boolean;
  minStopLossPercentage?: number;
  maxStopLossPercentage?: number;
  defaultStopLossPercentage?: number;
}

export interface EtoroEligibility {
  instrumentId?: number;
  symbol?: string;
  leverageConfigs?: EtoroLeverageConfig[];
}

export interface StopLossLimiet {
  symbool: string;
  // Voor welke richting deze grenzen gelden. Gemeten (26 aug 2026, zie docs/etoro-direct-handelen-
  // plan.md paragraaf 10): eToro geeft voor een short een MAXIMUM van 50% waar long 100% mag. Zonder
  // dit veld zou een short tegen de long-grens getoetst worden en zou Kader een stop goedkeuren die
  // eToro weigert.
  richting: Richting;
  // false = eToro zet de stop zelf en laat 'm niet aanpassen.
  bewerkbaar: boolean;
  // Percentage van je inleg, of null als eToro geen grens meegaf.
  minPct: number | null;
  maxPct: number | null;
}

const isKoop = (richting?: string) => !richting || /buy|long/i.test(richting);
const isVerkoop = (richting?: string) => !!richting && /sell|short/i.test(richting);

// Alleen echte, positieve getallen tellen als grens. Een 0 of een null uit de API betekent
// "geen grens", niet "stop op 0% van de entry".
const grens = (waarde: unknown): number | null =>
  typeof waarde === 'number' && isFinite(waarde) && waarde > 0 ? waarde : null;

// eToro geeft per instrument meerdere leverageConfigs terug (per hefboom en per richting). Kader
// rekent altijd zonder hefboom, dus we zoeken de config met hefboom x1 in de gevraagde richting. Dat is belangrijk voor de vergelijking verderop: bij x1 is het verliespercentage van je
// inleg gelijk aan de koersdaling, bij x5 zou een stop van 2% onder de entry 10% van je inleg zijn.
export function kiesLimiet(item: EtoroEligibility, richting: Richting = 'long'): StopLossLimiet | null {
  const symbool = (item.symbol ?? '').toUpperCase();
  const configs = item.leverageConfigs ?? [];
  if (!symbool || configs.length === 0) return null;

  // Gemeten: shorten kan op hefboom x1, alleen met settlementType 'cfd' in plaats van 'real'. Dus
  // ook hier blijft de eis hefboom x1 staan; Kader rekent nergens met hefboom. Valt de config voor
  // de gevraagde richting weg, dan geven we null terug in plaats van terug te vallen op de andere
  // richting: de grenzen verschillen (short max 50%, long max 100%) en een grens van de verkeerde
  // richting is erger dan geen grens.
  const wil = richting === 'short' ? isVerkoop : isKoop;
  const config = configs.find(c => wil(c.direction) && c.leverageValues?.includes(1));
  if (!config) return null;

  return {
    symbool,
    richting,
    // Ontbreekt het veld, dan gaan we ervan uit dat je 'm mag zetten: liever geen waarschuwing dan
    // een onterechte.
    bewerkbaar: config.allowEditStopLoss !== false,
    minPct: grens(config.minStopLossPercentage),
    maxPct: grens(config.maxStopLossPercentage),
  };
}

const pct = (waarde: number) => `${waarde.toFixed(1).replace('.', ',')}%`;

export type StopAdvies =
  | { soort: 'ok' }
  | { soort: 'vast'; uitleg: string }
  | { soort: 'aangepast'; stop: number; uitleg: string }
  | { soort: 'waarschuwing'; uitleg: string };

// Kader rekent zijn eigen stop uit, eToro accepteert niet elke afstand. Waar het kan schuiven we de
// stop naar de dichtstbijzijnde waarde die eToro wel neemt, zodat het formulier geen niveau toont
// dat het tegelijk afkeurt. Zonder limiet (geen koppeling of een API-fout) zeggen we niets: een
// verzonnen grens is erger dan geen grens.
export function bepaalStop(entry: number, stop: number, limiet: StopLossLimiet | null): StopAdvies {
  if (!limiet) return { soort: 'ok' };
  if (!isFinite(entry) || !isFinite(stop) || entry <= 0 || stop <= 0) return { soort: 'ok' };

  if (!limiet.bewerkbaar) {
    return {
      soort: 'vast',
      uitleg: `eToro laat de stop-loss voor ${limiet.symbool} niet zelf instellen. Je houdt de standaardstop van eToro. Het niveau hierboven is dat van Kader, je ziet het terug bij je trade in het portfolio.`,
    };
  }

  // Ligt de stop op of boven de aankoopprijs, dan klopt er iets niet aan de invoer: je koopt onder
  // je eigen uitstapniveau. Hier verzinnen we geen niveau, want geen van eToro's grenzen is dan een
  // zinnig antwoord (het minimum is ruis-krap, het maximum is het maximale verlies). Zeggen wat er
  // mis is en de gebruiker de aankoopprijs laten nakijken.
  // Bij een long hoort de stop onder de entry, bij een short erboven. Staat hij aan de verkeerde
  // kant, dan verzinnen we geen niveau: geen van eToro's grenzen is dan een zinnig antwoord (het
  // minimum is ruis-krap, het maximum is het maximale verlies). Zeggen wat er mis is en de
  // gebruiker zijn prijs laten nakijken.
  const short = limiet.richting === 'short';
  const kant = short ? 'boven' : 'onder';
  const verkeerdeKant = short ? stop <= entry : stop >= entry;
  if (verkeerdeKant) {
    return {
      soort: 'waarschuwing',
      uitleg: short
        ? `Je stop ligt op of onder de prijs waarop je short gaat. Kijk die prijs na, bij een short hoort de stop erboven te liggen.`
        : `Je stop ligt op of boven de aankoopprijs. Kijk je aankoopprijs na, een stop hoort daaronder te liggen.`,
    };
  }

  const naar = (grensPct: number, reden: string): StopAdvies => {
    const nieuw = entry * (short ? 1 + grensPct / 100 : 1 - grensPct / 100);
    return { soort: 'aangepast', stop: nieuw, uitleg: `Stop aangepast naar ${fmtPrijs(nieuw, DOLLARS)}. ${reden}` };
  };

  // Altijd een positieve afstand, ongeacht de richting, zodat de vergelijking met de grenzen
  // dezelfde regel blijft.
  const afstand = (short ? (stop - entry) / entry : (entry - stop) / entry) * 100;
  const prijsNaam = short ? 'de prijs waarop je short gaat' : 'je aankoopprijs';

  if (limiet.minPct !== null && afstand < limiet.minPct) {
    return naar(limiet.minPct, `eToro accepteert voor ${limiet.symbool} minimaal ${pct(limiet.minPct)} ${kant} ${prijsNaam}, jouw stop lag ${pct(afstand)} er${kant}.`);
  }

  if (limiet.maxPct !== null && afstand > limiet.maxPct) {
    return naar(limiet.maxPct, `eToro accepteert voor ${limiet.symbool} maximaal ${pct(limiet.maxPct)} ${kant} ${prijsNaam}, jouw stop lag ${pct(afstand)} er${kant}.`);
  }

  return { soort: 'ok' };
}

// De stop van Kader is een structuurniveau (net onder de swing low), de grenzen van eToro zijn een
// percentage van je entry. Die twee botsen vaker wel dan niet: voor BTC x1 eist eToro minimaal 10%
// en Kaders ATR-stop ligt daar meestal ruim binnen. Tot nu toe corrigeerde alleen de kooporder-sheet
// dat, dus de rest van de app toonde een stop die je bij eToro nooit kon zetten, met een R/R die
// daarop gebaseerd was.
//
// Deze functie is het gedeelde antwoord: geef 'm Kaders eigen niveaus en de grens van eToro, en je
// krijgt terug wat er werkelijk te zetten valt, met de R/R die daarbij hoort. Zonder limiet (geen
// koppeling, of een API-fout) komt Kaders eigen stop er onveranderd uit.
export interface EtoroNiveaus {
  // De stop zoals hij bij eToro te zetten is. Gelijk aan de eigen stop als er niets te corrigeren viel.
  stop: number;
  // Risico tegenover beloning bij DIE stop. Verschilt van trade.rr zodra de stop verschoven is.
  rr: number;
  // Is de stop verschoven ten opzichte van wat Kader zelf berekende?
  aangepast: boolean;
  // eToro laat de stop voor deze coin helemaal niet instellen; het niveau blijft dat van Kader.
  vast: boolean;
  // Eén regel uitleg, of leeg als er niets te melden valt.
  uitleg: string;
}

export function etoroNiveaus(
  entry: number,
  eigenStop: number,
  doel: number,
  limiet: StopLossLimiet | null,
): EtoroNiveaus {
  const risico = Math.abs(entry - eigenStop);
  const beloning = Math.abs(doel - entry);
  const eigen: EtoroNiveaus = {
    stop: eigenStop,
    rr: risico > 0 ? beloning / risico : 0,
    aangepast: false,
    vast: false,
    uitleg: '',
  };

  const advies = bepaalStop(entry, eigenStop, limiet);

  // 'waarschuwing' betekent dat de stop aan de verkeerde kant van de entry ligt. Dat komt uit de
  // engine niet voor, en als het toch gebeurt is Kaders eigen niveau tonen eerlijker dan een
  // verzonnen correctie.
  if (advies.soort === 'ok' || advies.soort === 'waarschuwing') return eigen;

  if (advies.soort === 'vast') {
    return { ...eigen, vast: true, uitleg: advies.uitleg };
  }

  const nieuwRisico = Math.abs(entry - advies.stop);
  return {
    stop: advies.stop,
    rr: nieuwRisico > 0 ? beloning / nieuwRisico : 0,
    aangepast: true,
    vast: false,
    uitleg: advies.uitleg,
  };
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/engine/etoroLimieten.ts`
if (require.main === module) {
  const ruw: EtoroEligibility = {
    instrumentId: 100000, symbol: 'BTC',
    leverageConfigs: [
      // Volgorde bewust omgedraaid: de x2-config staat vooraan, dus een naïeve [0] pakt de verkeerde.
      { direction: 'Buy', leverageValues: [2], allowEditStopLoss: true, minStopLossPercentage: 20, maxStopLossPercentage: 50 },
      { direction: 'Sell', leverageValues: [1], allowEditStopLoss: true, minStopLossPercentage: 9, maxStopLossPercentage: 9 },
      { direction: 'Buy', leverageValues: [1], allowEditStopLoss: true, minStopLossPercentage: 1, maxStopLossPercentage: 50 },
    ],
  };

  const limiet = kiesLimiet(ruw)!;
  console.assert(limiet.symbool === 'BTC', 'symbool moet BTC zijn');
  console.assert(limiet.minPct === 1 && limiet.maxPct === 50, `de x1-buy-config moet gekozen worden, was ${limiet.minPct}-${limiet.maxPct}`);
  console.assert(limiet.bewerkbaar, 'allowEditStopLoss true moet bewerkbaar zijn');

  console.assert(kiesLimiet({ symbol: 'BTC' }) === null, 'zonder leverageConfigs is er geen limiet');
  console.assert(kiesLimiet({ symbol: 'BTC', leverageConfigs: [{ leverageValues: [2] }] }) === null,
    'zonder x1-config gokken we niet met een hefboomlimiet');
  console.assert(kiesLimiet({ leverageConfigs: [{ leverageValues: [1] }] }) === null, 'zonder symbool is de limiet onbruikbaar');

  const nul = kiesLimiet({ symbol: 'ETH', leverageConfigs: [{ leverageValues: [1], minStopLossPercentage: 0 }] })!;
  console.assert(nul.minPct === null, 'een min van 0 betekent geen grens, geen stop op 0%');

  // Entry 100: stop op 99,5 is 0,5% onder de entry, dus onder eToro's minimum van 1%.
  const teDicht = bepaalStop(100, 99.5, limiet);
  console.assert(teDicht.soort === 'aangepast', `stop binnen de minimumafstand moet bijgesteld worden, was: ${teDicht.soort}`);
  console.assert(teDicht.soort === 'aangepast' && teDicht.stop === 99, `te dichtbij wordt naar exact het minimum geclamped, was ${JSON.stringify(teDicht)}`);
  console.assert(teDicht.soort === 'aangepast' && teDicht.uitleg.includes('minimaal 1,0%'), 'de grens moet in de uitleg staan');
  console.assert(teDicht.soort === 'aangepast' && teDicht.uitleg.includes('0,5%'), 'de eigen afstand moet in de uitleg staan');
  console.assert(teDicht.soort === 'aangepast' && teDicht.uitleg.includes('$99.00'), `de nieuwe prijs moet in de uitleg staan, was: ${JSON.stringify(teDicht)}`);

  // Stop op 40 is 60% onder de entry, boven het maximum van 50%.
  const teVer = bepaalStop(100, 40, limiet);
  console.assert(teVer.soort === 'aangepast' && teVer.stop === 50, `te ver wordt naar exact het maximum geclamped, was ${JSON.stringify(teVer)}`);
  console.assert(teVer.soort === 'aangepast' && teVer.uitleg.includes('maximaal 50,0%'), 'de grens moet in de uitleg staan');

  console.assert(bepaalStop(100, 90, limiet).soort === 'ok', '10% onder de entry valt netjes binnen 1-50%');
  console.assert(bepaalStop(100, 99, limiet).soort === 'ok', 'precies op het minimum is nog goed');
  console.assert(bepaalStop(100, 50, limiet).soort === 'ok', 'precies op het maximum is nog goed');

  // Een stop op of boven de entry: hier verzinnen we geen niveau, want geen van beide grenzen is
  // dan een zinnig antwoord. Het formulier blokkeert opslaan in dit geval.
  const boven = bepaalStop(100, 105, limiet);
  console.assert(boven.soort === 'waarschuwing', `een stop boven de entry wordt niet geclamped, was ${JSON.stringify(boven)}`);
  console.assert(bepaalStop(100, 100, limiet).soort === 'waarschuwing', 'een stop gelijk aan de entry is ook fout');

  // Een echte coinprijs in plaats van een ronde 100: de clamp landt een haartje binnen de grens.
  // Dat is de goede kant, eToro weigert alleen buiten de grens.
  const echt = bepaalStop(3.3333, 3.2, { symbool: 'XRP', richting: 'long' as const, bewerkbaar: true, minPct: 9, maxPct: 50 });
  console.assert(echt.soort === 'aangepast', `een stop van 4% moet naar het 9%-minimum bijgesteld worden, was ${echt.soort}`);
  if (echt.soort === 'aangepast') {
    const afstandNa = ((3.3333 - echt.stop) / 3.3333) * 100;
    console.assert(afstandNa <= 9 + 1e-9 && afstandNa > 8.999, `de geclampte stop moet op het minimum liggen, was ${afstandNa}%`);
  }

  // Een band waarin minimum en maximum samenvallen: alles behalve exact die afstand wordt bijgesteld.
  const strak = { symbool: 'ETH', richting: 'long' as const, bewerkbaar: true, minPct: 9, maxPct: 9 };
  console.assert(bepaalStop(100, 91, strak).soort === 'ok', 'precies op de enige toegestane afstand is goed');
  const strakTeDicht = bepaalStop(100, 95, strak);
  console.assert(strakTeDicht.soort === 'aangepast' && strakTeDicht.stop === 91, `een gelijke min en max laat maar één stop toe, was ${JSON.stringify(strakTeDicht)}`);

  // Het belangrijkste: zonder limiet (geen eToro-koppeling of een API-fout) waarschuwen we niet.
  console.assert(bepaalStop(100, 99.5, null).soort === 'ok', 'zonder limiet geen verzonnen waarschuwing');
  console.assert(bepaalStop(0, 99.5, limiet).soort === 'ok', 'een leeg entryveld mag niet waarschuwen');
  console.assert(bepaalStop(NaN, 99.5, limiet).soort === 'ok', 'een onparseerbare entry mag niet waarschuwen');
  console.assert(bepaalStop(100, NaN, limiet).soort === 'ok', 'een onbruikbare stop mag niet waarschuwen');
  console.assert(bepaalStop(100, -5, limiet).soort === 'ok', 'een negatieve stop mag niet waarschuwen');

  const vast = bepaalStop(100, 90, { symbool: 'DOGE', richting: 'long' as const, bewerkbaar: false, minPct: 1, maxPct: 50 });
  console.assert(vast.soort === 'vast' && vast.uitleg.includes('niet zelf instellen'), `een niet-bewerkbare stop moet vast zijn, was ${vast.soort}`);

  // ---------- Short ----------
  // De configs hieronder zijn letterlijk wat eToro op 26 aug 2026 teruggaf voor BTC (zie
  // docs/etoro-direct-handelen-plan.md paragraaf 10): long real/x1 met max 100%, short cfd/x1 met
  // max 50%. Het punt van deze test is dat kiesLimiet de JUISTE van de twee pakt.
  const gemeten: EtoroEligibility = {
    instrumentId: 100000, symbol: 'BTC',
    leverageConfigs: [
      { direction: 'long', settlementType: 'real', leverageValues: [1], allowEditStopLoss: true, minStopLossPercentage: 10, maxStopLossPercentage: 100 },
      { direction: 'short', settlementType: 'cfd', leverageValues: [1], allowEditStopLoss: true, minStopLossPercentage: 10, maxStopLossPercentage: 50 },
    ],
  };
  const lang = kiesLimiet(gemeten)!;
  const kort = kiesLimiet(gemeten, 'short')!;
  console.assert(lang.maxPct === 100 && lang.richting === 'long', `long moet de real-config pakken, was ${JSON.stringify(lang)}`);
  console.assert(kort.maxPct === 50 && kort.richting === 'short', `short moet de cfd-config pakken, was ${JSON.stringify(kort)}`);

  // Zonder config voor de gevraagde richting geen limiet, in plaats van terugvallen op de andere.
  const alleenLong: EtoroEligibility = { symbol: 'BTC', leverageConfigs: [gemeten.leverageConfigs![0]] };
  console.assert(kiesLimiet(alleenLong, 'short') === null,
    'zonder short-config liever geen grens dan de long-grens, die is twee keer zo ruim');

  // Een correcte short (stop BOVEN de entry) mag geen waarschuwing geven. Dit is precies wat er
  // misging toen bepaalStop nog long-only was: elke goed ingestelde short werd afgekeurd en dat
  // zette de bevestigknop in NiveausSheet uit.
  console.assert(bepaalStop(100, 120, kort).soort === 'ok', `20% boven de entry valt binnen 10-50%, was ${bepaalStop(100, 120, kort).soort}`);
  console.assert(bepaalStop(100, 80, kort).soort === 'waarschuwing', 'een stop ONDER de entry is bij een short fout');
  console.assert(bepaalStop(100, 100, kort).soort === 'waarschuwing', 'een stop op de entry is ook bij een short fout');

  // Clampen gebeurt naar boven in plaats van naar beneden.
  const kortTeDicht = bepaalStop(100, 105, kort);
  console.assert(kortTeDicht.soort === 'aangepast' && Math.abs(kortTeDicht.stop - 110) < 1e-9,
    `5% is onder het minimum van 10%, moet naar 110, was ${JSON.stringify(kortTeDicht)}`);
  const kortTeVer = bepaalStop(100, 200, kort);
  console.assert(kortTeVer.soort === 'aangepast' && Math.abs(kortTeVer.stop - 150) < 1e-9,
    `100% is boven het maximum van 50%, moet naar 150, was ${JSON.stringify(kortTeVer)}`);

  // Belangrijker dan het ronde getal: de geclampte stop mag bij een short nooit BUITEN het maximum
  // vallen, want dan weigert eToro precies de waarde die Kader zelf heeft voorgesteld. Met een
  // niet-ronde prijs is dat een echte kans op afrondingsdrift, dus dat testen we expliciet.
  const raar = bepaalStop(3.3333, 9.9, { symbool: 'XRP', richting: 'short' as const, bewerkbaar: true, minPct: 10, maxPct: 50 });
  console.assert(raar.soort === 'aangepast', `een stop van 197% moet bijgesteld worden, was ${raar.soort}`);
  if (raar.soort === 'aangepast') {
    const afstandNa = ((raar.stop - 3.3333) / 3.3333) * 100;
    console.assert(afstandNa <= 50 + 1e-9, `de geclampte short-stop mag niet boven het maximum uitkomen, was ${afstandNa}%`);
    console.assert(afstandNa > 49.999, `en hij moet wel op de grens landen, was ${afstandNa}%`);
  }
  console.assert(kortTeVer.soort === 'aangepast' && kortTeVer.uitleg.includes('boven'),
    'de uitleg moet bij een short over BOVEN de prijs gaan');

  // Dezelfde stop van 60% is bij een long wel toegestaan en bij een short niet. Dat verschil is de
  // hele reden dat kiesLimiet richting-bewust moest worden.
  console.assert(bepaalStop(100, 40, lang).soort === 'ok', '60% onder de entry mag bij een long, max is daar 100%');
  console.assert(bepaalStop(100, 160, kort).soort === 'aangepast', '60% boven de entry mag NIET bij een short, max is daar 50%');

  // ---------- etoroNiveaus ----------
  // De hele reden dat deze functie bestaat: entry 100, Kaders stop op 97 (3%), doel op 109. Op
  // papier is dat R/R 3,0. Bij eToro mag de stop niet dichter dan 10%, dus de stop wordt 90 en de
  // werkelijke R/R is 0,9. Dat verschil hoorde de gebruiker te zien vóór hij de trade doet.
  const btcLimiet = { symbool: 'BTC', richting: 'long' as const, bewerkbaar: true, minPct: 10, maxPct: 100 };
  const geklemd = etoroNiveaus(100, 97, 109, btcLimiet);
  console.assert(geklemd.aangepast, 'een stop van 3% moet bij een minimum van 10% aangepast worden');
  console.assert(Math.abs(geklemd.stop - 90) < 1e-9, `de stop moet naar 90, was ${geklemd.stop}`);
  console.assert(Math.abs(geklemd.rr - 0.9) < 1e-9, `de R/R hoort met de stop mee te bewegen, was ${geklemd.rr}`);
  console.assert(geklemd.uitleg !== '', 'een aangepaste stop hoort uitleg te dragen');

  // Past de eigen stop wel, dan blijft alles exact zoals Kader het berekende.
  const past = etoroNiveaus(100, 85, 130, btcLimiet);
  console.assert(!past.aangepast && past.stop === 85, 'een stop van 15% valt binnen 10-100% en blijft staan');
  console.assert(Math.abs(past.rr - 2) < 1e-9, `R/R van 30 op 15 is 2,0, was ${past.rr}`);

  // Zonder limiet (geen koppeling of een API-fout) veranderen we niets en beweren we niets.
  const geen = etoroNiveaus(100, 97, 109, null);
  console.assert(!geen.aangepast && geen.stop === 97 && geen.uitleg === '', 'zonder limiet blijft alles van Kader');
  console.assert(Math.abs(geen.rr - 3) < 1e-9, `zonder limiet is de R/R die van Kader, was ${geen.rr}`);

  // Een short is gespiegeld: stop boven de entry, doel eronder, en de R/R blijft positief.
  const shortLimiet = { symbool: 'BTC', richting: 'short' as const, bewerkbaar: true, minPct: 10, maxPct: 50 };
  const kortNiveaus = etoroNiveaus(100, 103, 91, shortLimiet);
  console.assert(Math.abs(kortNiveaus.stop - 110) < 1e-9, `een short-stop van 3% moet naar 110, was ${kortNiveaus.stop}`);
  console.assert(Math.abs(kortNiveaus.rr - 0.9) < 1e-9, `short-R/R van 9 op 10 is 0,9, was ${kortNiveaus.rr}`);

  // Laat eToro de stop niet zetten, dan blijft het niveau van Kader staan, maar wel met de melding.
  const vastNiveaus = etoroNiveaus(100, 97, 109, { symbool: 'DOGE', richting: 'long' as const, bewerkbaar: false, minPct: 10, maxPct: 100 });
  console.assert(vastNiveaus.vast && vastNiveaus.stop === 97 && !vastNiveaus.aangepast,
    'een vaste stop verschuift niet, hij krijgt alleen een melding');
  console.assert(vastNiveaus.uitleg !== '', 'een vaste stop hoort uitleg te dragen');

  // Een stop aan de verkeerde kant van de entry: liever Kaders eigen niveau tonen dan een verzonnen
  // correctie. Dit hoort uit de engine niet te komen, maar het scherm mag er niet op stuklopen.
  const fout = etoroNiveaus(100, 105, 109, btcLimiet);
  console.assert(!fout.aangepast && fout.stop === 105, 'een stop aan de verkeerde kant blijft ongemoeid');

  // Entry gelijk aan de stop geeft risico 0. Delen door nul moet geen Infinity op het scherm zetten.
  console.assert(etoroNiveaus(100, 100, 109, null).rr === 0, 'risico 0 geeft R/R 0, geen Infinity');

  console.log('etoroLimieten.ts self-check geslaagd');
}
