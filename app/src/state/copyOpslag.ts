// Opslag van de Copy-tab: favorieten, instellingen, de Feed en de herkomst van gekopieerde
// posities. Los van de React-context, zodat de achtergrondtaak dezelfde functies gebruikt als de
// app op de voorgrond. Alles is AsyncStorage: er staat geen geheim in.
import { SLEUTELS, bewaarLijst, bewaarObject, laadLijst, laadObject } from '../storage/opslag';
import type { EtoroOmgeving } from '../engine/etoro';
import type { RanglijstRij, TrackrecordTrade } from '../engine/copyTrading';

// ---------- Favorieten ----------

export interface FavorieteTrader {
  username: string;
  // Nodig voor "Kopieer alles via eToro". 0 als hij nog niet bekend is.
  cid: number;
  // Meldingen over nieuwe trades van deze trader. Ontbreekt (oudere opslag) betekent aan.
  meldingen?: boolean;
  // Eigen bedrag per kopie van deze trader, in dollars. Ontbreekt = het standaardbedrag.
  bedragUsd?: number;
}

// Hooguit zoveel favorieten: elke favoriet kost per check een verzoek, en het quotum voor live
// portfolio's is 60 per minuut.
export const MAX_FAVORIETEN = 20;

export async function laadFavorieten(): Promise<FavorieteTrader[]> {
  const lijst = await laadLijst<FavorieteTrader>(SLEUTELS.favorieteTraders);
  return lijst.filter(f => f && typeof f.username === 'string' && f.username.length > 0);
}

export async function bewaarFavorieten(lijst: FavorieteTrader[]): Promise<void> {
  await bewaarLijst(SLEUTELS.favorieteTraders, lijst.slice(0, MAX_FAVORIETEN));
}

// ---------- Instellingen ----------

export interface CopyInstellingen {
  // In dollars: eToro rekent orders in dollars af.
  bedragUsd: number;
  meldingen: boolean;
  // Geen meldingen tussen 23:00 en 07:00.
  stilleUren: boolean;
  // Heeft de gebruiker het instellingenvenster al een keer gezien?
  ingesteld: boolean;
}

export const STANDAARD_INSTELLINGEN: CopyInstellingen = {
  bedragUsd: 50,
  meldingen: true,
  stilleUren: true,
  ingesteld: false,
};

export async function laadInstellingen(): Promise<CopyInstellingen> {
  const ruw = await laadObject<Partial<CopyInstellingen>>(SLEUTELS.copyInstellingen);
  const bedrag = typeof ruw?.bedragUsd === 'number' && ruw.bedragUsd >= 10 ? ruw.bedragUsd : STANDAARD_INSTELLINGEN.bedragUsd;
  return {
    bedragUsd: bedrag,
    meldingen: typeof ruw?.meldingen === 'boolean' ? ruw.meldingen : STANDAARD_INSTELLINGEN.meldingen,
    stilleUren: typeof ruw?.stilleUren === 'boolean' ? ruw.stilleUren : STANDAARD_INSTELLINGEN.stilleUren,
    ingesteld: ruw?.ingesteld === true,
  };
}

export async function bewaarInstellingen(inst: CopyInstellingen): Promise<void> {
  await bewaarObject(SLEUTELS.copyInstellingen, inst);
}

// 23:00 tot 07:00 lokale tijd.
export function inStilleUren(nu: Date = new Date()): boolean {
  const uur = nu.getHours();
  return uur >= 23 || uur < 7;
}

// ---------- Feed ----------

export interface FeedItem {
  // "username:positionId", uniek over alle beleggers heen.
  sleutel: string;
  username: string;
  positionId: number;
  instrumentId: number;
  // Kader-symbool, of null als de coin niet bij de 57 hoort.
  symbool: string | null;
  isBuy: boolean;
  leverage: number;
  // In eToro's eenheid; deel door koersFactor voor Kaders koers per coin.
  openRate: number;
  stopLossRate: number | null;
  takeProfitRate: number | null;
  // Wanneer de trader opende (epoch ms), als eToro dat meestuurde.
  openTijd: number | null;
  // Wanneer Kader hem voor het eerst zag.
  gezien: number;
  // De trader heeft deze positie inmiddels gesloten.
  gesloten: boolean;
  // Jij hebt hem gekopieerd.
  gekopieerd: boolean;
}

export const MAX_FEED = 50;
export const FEED_LEEFTIJD_MS = 7 * 24 * 60 * 60 * 1000;

export async function laadFeed(): Promise<FeedItem[]> {
  const lijst = await laadLijst<FeedItem>(SLEUTELS.traderFeed);
  const grens = Date.now() - FEED_LEEFTIJD_MS;
  return lijst.filter(i => i && typeof i.sleutel === 'string' && i.gezien >= grens);
}

export async function bewaarFeed(lijst: FeedItem[]): Promise<void> {
  const gesorteerd = [...lijst].sort((a, b) => (b.openTijd ?? b.gezien) - (a.openTijd ?? a.gezien));
  await bewaarLijst(SLEUTELS.traderFeed, gesorteerd.slice(0, MAX_FEED));
}

export async function markeerGekopieerd(sleutel: string): Promise<void> {
  const feed = await laadFeed();
  await bewaarFeed(feed.map(i => (i.sleutel === sleutel ? { ...i, gekopieerd: true } : i)));
}

// ---------- Bekende posities per belegger ----------

export type BekendePosities = Record<string, number[]>;

// Wanneer Kader voor het laatst minstens een favoriet bereikte, voor de volgstatus boven de Feed.
// Zowel de check op de voorgrond als de achtergrondtaak zet hem.
export async function laadLaatstGekeken(): Promise<number | null> {
  const t = await laadObject<{ tijd: number }>(SLEUTELS.traderLaatstGekeken);
  return typeof t?.tijd === 'number' ? t.tijd : null;
}

export async function bewaarLaatstGekeken(tijd: number): Promise<void> {
  await bewaarObject(SLEUTELS.traderLaatstGekeken, { tijd });
}

// ---------- Trackrecord ----------
// Langer bewaard dan de Feed (90 dagen), want een trackrecord heeft maanden nodig om iets te zeggen.
export const TRACKRECORD_LEEFTIJD_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_TRACKRECORD = 1000;

export async function laadTrackrecord(): Promise<TrackrecordTrade[]> {
  return laadLijst<TrackrecordTrade>(SLEUTELS.traderTrackrecord);
}

export async function bewaarTrackrecord(lijst: TrackrecordTrade[]): Promise<void> {
  const grens = Date.now() - TRACKRECORD_LEEFTIJD_MS;
  // Open trades blijven altijd staan, ook als ze ouder zijn dan 90 dagen: anders krijgt een lang
  // lopende positie bij het sluiten nooit een resultaat. Alleen gesloten trades vallen weg.
  const open = lijst.filter(t => t.gesloten === null);
  const gesloten = lijst.filter(t => t.gesloten !== null && t.gesloten >= grens);
  await bewaarLijst(SLEUTELS.traderTrackrecord, [...open.slice(-MAX_TRACKRECORD), ...gesloten.slice(-MAX_TRACKRECORD)]);
}

export async function laadBekendePosities(): Promise<BekendePosities> {
  return (await laadObject<BekendePosities>(SLEUTELS.traderPosities)) ?? {};
}

export async function bewaarBekendePosities(kaart: BekendePosities): Promise<void> {
  await bewaarObject(SLEUTELS.traderPosities, kaart);
}

// ---------- Herkomst van gekopieerde posities ----------

export interface CopyHerkomst {
  verzoekId: string;
  username: string;
  // De positie van de trader die je kopieerde.
  bronPositieId: number;
  symbool: string;
  omgeving: EtoroOmgeving;
  tijd: number;
  // Jouw eToro-positie, zodra de sync hem heeft opgeleverd.
  etoroPositionID?: number;
  // De uitstapmelding is al verstuurd.
  uitstapGemeld?: boolean;
}

export async function laadHerkomst(): Promise<CopyHerkomst[]> {
  return laadLijst<CopyHerkomst>(SLEUTELS.copyHerkomst);
}

export async function bewaarHerkomst(lijst: CopyHerkomst[]): Promise<void> {
  // De laatste 200 is ruim: dit is een koppeltabel, geen historie.
  await bewaarLijst(SLEUTELS.copyHerkomst, lijst.slice(-200));
}

export async function noteerHerkomst(item: CopyHerkomst): Promise<void> {
  const lijst = await laadHerkomst();
  await bewaarHerkomst([...lijst.filter(h => h.verzoekId !== item.verzoekId), item]);
}

// ---------- Ranglijst-cache ----------

export interface RanglijstCache {
  tijd: number;
  rijen: RanglijstRij[];
}

export const RANGLIJST_TTL_MS = 6 * 60 * 60 * 1000;

export async function laadRanglijstCache(): Promise<RanglijstCache | null> {
  const c = await laadObject<RanglijstCache>(SLEUTELS.ranglijstCache);
  return c && typeof c.tijd === 'number' && Array.isArray(c.rijen) ? c : null;
}

export async function bewaarRanglijstCache(rijen: RanglijstRij[]): Promise<void> {
  await bewaarObject<RanglijstCache>(SLEUTELS.ranglijstCache, { tijd: Date.now(), rijen });
}

// ---------- Instrument naar symbool ----------

export async function laadSymboolKaart(): Promise<Record<string, string | null>> {
  return (await laadObject<Record<string, string | null>>(SLEUTELS.instrumentSymbolen)) ?? {};
}

export async function bewaarSymboolKaart(kaart: Record<string, string | null>): Promise<void> {
  await bewaarObject(SLEUTELS.instrumentSymbolen, kaart);
}

// Vult de kaart aan met wat Kader al weet uit de koopkant: symbool -> instrumentId.
export async function zaaiSymboolKaart(kaart: Record<string, string | null>): Promise<Record<string, string | null>> {
  const bekend = (await laadObject<Record<string, number>>(SLEUTELS.etoroInstrumentIds)) ?? {};
  const volgende = { ...kaart };
  for (const [symbool, id] of Object.entries(bekend)) {
    if (typeof id === 'number' && !(String(id) in volgende)) volgende[String(id)] = symbool;
  }
  return volgende;
}

// ---------- Kopieer alles via eToro ----------

export interface AllesCopy {
  referentie: string;
  verzoekId: string;
  username: string;
  cid: number;
  bedragUsd: number;
  // De Copy Stop Loss die de gebruiker koos, in procent. eToro's API kent dit veld niet; Kader
  // bewaakt hem zelf en meldt het als de copy die grens raakt.
  cslPct: number;
  omgeving: EtoroOmgeving;
  tijd: number;
  status: 'onderweg' | 'actief' | 'mislukt' | 'gestopt' | 'onbekend';
  mirrorId?: number;
  reden?: string;
  cslGemeld?: boolean;
}

export async function laadAllesCopies(): Promise<AllesCopy[]> {
  return laadLijst<AllesCopy>(SLEUTELS.allesCopies);
}

export async function bewaarAllesCopies(lijst: AllesCopy[]): Promise<void> {
  await bewaarLijst(SLEUTELS.allesCopies, lijst.slice(-50));
}
