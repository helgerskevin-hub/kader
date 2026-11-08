// eToro-client voor de Copy-tab: de ranglijst van beleggers, hun open posities en rendement, en
// eToro's eigen CopyTrader. Alles loopt via etoroFetch, dus dezelfde sleutel, dezelfde GUID in
// x-request-id en dezelfde demo-padtabel als de rest van de app.
//
// Paden en velden komen uit eToro's documentatie (api-portal.etoro.com, november 2026) en zijn nog
// niet tegen een echte respons gemeten. Zie docs/copy-trading-plan.md, fase 0.
import { EtoroSleutels, etoroFetch, haalInstrumenten, symboolVan, OrderUitkomst, voerOrderUit } from './etoro';
import { vanEtoroSymbool } from './etoroSymbolen';
import { STANDAARD_UNIVERSUM } from './analyzer';
import { RanglijstRij, TraderLivePortfolio } from './copyTrading';

const UNIVERSUM = new Set<string>(STANDAARD_UNIVERSUM);

// ---------- Ranglijst ----------

// Twaalf maanden terug. "OneYearAgo" is de periode die eToro's eigen voorbeeld gebruikt; of die
// precies de laatste 365 dagen dekt is nog te meten.
export const RANGLIJST_PERIODE = 'OneYearAgo';

interface RanglijstAntwoord {
  results?: RanglijstRij[];
  pagination?: { page?: number; pageSize?: number; hasNext?: boolean; totalItems?: number };
}

// Popular Investors met een risico tot 6, gesorteerd op aantal copiers: dat zijn beleggers die al
// een tijd meegaan. De Kader-score sorteert daarna opnieuw. Twee pagina's van 100 is ruim genoeg om
// er na het crypto-filter een bruikbare lijst uit te houden, en kost maar twee verzoeken.
export async function haalRanglijst(sleutels: EtoroSleutels, paginas = 2): Promise<RanglijstRij[]> {
  const rijen: RanglijstRij[] = [];
  for (let pagina = 1; pagina <= paginas; pagina++) {
    const query = new URLSearchParams({
      period: RANGLIJST_PERIODE,
      popularInvestor: 'true',
      riskScoreMax: '6',
      sort: '-copiers',
      page: String(pagina),
      pageSize: '100',
    });
    const data = await etoroFetch<RanglijstAntwoord>(`/portfolios/rankings?${query.toString()}`, sleutels, { versie: 'v2' });
    const lijst = Array.isArray(data?.results) ? data!.results! : [];
    for (const rij of lijst) {
      if (rij && typeof rij.cid === 'number' && typeof rij.username === 'string' && rij.username) rijen.push(rij);
    }
    if (!data?.pagination?.hasNext) break;
  }
  return rijen;
}

// Ranglijstregels voor bekende namen, bijvoorbeeld je favorieten die buiten de top vallen.
export async function haalRanglijstVoor(usernames: string[], sleutels: EtoroSleutels): Promise<RanglijstRij[]> {
  if (usernames.length === 0) return [];
  const data = await etoroFetch<{ results?: { username?: string; value?: Partial<RanglijstRij> }[] | RanglijstRij[] }>(
    `/portfolios/rankings/multiple?period=${RANGLIJST_PERIODE}`,
    sleutels,
    { versie: 'v2', body: { usernames: usernames.slice(0, 100) } },
  );
  const lijst = Array.isArray(data?.results) ? data!.results! : [];
  const uit: RanglijstRij[] = [];
  for (const item of lijst as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    // De docs tonen voor dit endpoint { username, value: { gain, riskScore, copiers } }; een volle
    // regel accepteren we ook, voor het geval eToro hetzelfde formaat als de gewone lijst stuurt.
    const vlak = item as RanglijstRij & { value?: Partial<RanglijstRij> };
    const rij = { ...(vlak.value ?? {}), ...vlak } as RanglijstRij;
    if (typeof rij.username === 'string' && rij.username) uit.push({ ...rij, cid: typeof rij.cid === 'number' ? rij.cid : 0 });
  }
  return uit;
}

// ---------- Één belegger ----------

export async function haalLivePortfolio(username: string, sleutels: EtoroSleutels): Promise<TraderLivePortfolio> {
  const data = await etoroFetch<TraderLivePortfolio>(
    `/user-info/people/${encodeURIComponent(username)}/portfolio/live`,
    sleutels,
  );
  return data ?? {};
}

export interface MaandRendement {
  datum: string;
  // In procenten.
  pct: number;
}

// Maandrendementen van de laatste twaalf maanden, voor de grafiek en de handmatige auditor.
export async function haalMaandRendementen(username: string, sleutels: EtoroSleutels, aantal = 12): Promise<MaandRendement[]> {
  const data = await etoroFetch<{ gains?: { date?: string; gain?: number }[] }>(
    `/portfolios/${encodeURIComponent(username)}/gain/monthly?count=${aantal}`,
    sleutels,
    { versie: 'v2' },
  );
  const lijst = Array.isArray(data?.gains) ? data!.gains! : [];
  return lijst
    .filter(g => typeof g?.date === 'string' && typeof g?.gain === 'number' && Number.isFinite(g.gain))
    .map(g => ({ datum: g.date as string, pct: (g.gain as number) * 100 }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

// ---------- Instrument naar Kader-coin ----------

// eToro geeft bij een positie alleen een instrumentId. Kader vertaalt dat naar zijn eigen symbool
// en laat alles buiten de 57 coins vallen. Null = geen Kader-coin (een aandeel, een index, of een
// coin die Kader niet volgt). De kaart komt van buiten, zodat de aanroeper hem kan cachen.
export async function vulSymbolenAan(
  ids: number[],
  kaart: Record<string, string | null>,
  sleutels: EtoroSleutels,
): Promise<Record<string, string | null>> {
  const onbekend = [...new Set(ids)].filter(id => !(String(id) in kaart));
  if (onbekend.length === 0) return kaart;
  const volgende = { ...kaart };
  // In blokken van 100, net als de stop-loss-limieten.
  for (let i = 0; i < onbekend.length; i += 100) {
    const blok = onbekend.slice(i, i + 100);
    const instrumenten = await haalInstrumenten(blok, sleutels);
    for (const id of blok) {
      const instrument = instrumenten.get(id);
      // Zonder antwoord over dit id niets vastleggen: een tijdelijke storing mag geen coin
      // permanent als "geen Kader-coin" markeren.
      if (!instrument) continue;
      const symbool = vanEtoroSymbool(symboolVan(instrument));
      volgende[String(id)] = UNIVERSUM.has(symbool) ? symbool : null;
    }
  }
  return volgende;
}

// ---------- Kopieer alles via eToro (CopyTrader) ----------

export interface CopyToets {
  mag: boolean;
  reden: string | null;
}

// Droogtest: mag dit account deze belegger met dit bedrag kopiëren? Verandert niets.
export async function toetsCopy(parentCID: number, bedragUsd: number, sleutels: EtoroSleutels): Promise<CopyToets> {
  const data = await etoroFetch<{ isSuccess?: boolean; errorMessage?: string | null }>(
    '/trading/copy/eligibility',
    sleutels,
    { versie: 'v2', body: { parentCID, amount: bedragUsd } },
  );
  return { mag: data?.isSuccess === true, reden: typeof data?.errorMessage === 'string' ? data.errorMessage : null };
}

// Start een copy. eToro antwoordt alleen dat het verzoek is aangenomen; de uitkomst komt via
// haalCopyUitkomst. Net als bij een order: nooit automatisch herhalen.
export async function startCopy(
  parentCID: number,
  bedragUsd: number,
  referentie: string,
  sleutels: EtoroSleutels,
  verzoekId: string,
): Promise<OrderUitkomst> {
  return voerOrderUit(verzoekId, () =>
    etoroFetch<{ token?: string }>('/trading/copy', sleutels, {
      versie: 'v2',
      body: { parentCID, amount: Math.round(bedragUsd * 100) / 100, referenceID: referentie },
      verzoekId,
      schrijft: true,
    }),
  );
}

export type CopyUitkomst =
  | { soort: 'gelukt'; mirrorId: number | null }
  | { soort: 'mislukt'; reden: string }
  | { soort: 'nog-bezig' };

// 404 betekent volgens de docs: nog geen eindstand.
export async function haalCopyUitkomst(referentie: string, sleutels: EtoroSleutels): Promise<CopyUitkomst> {
  try {
    const data = await etoroFetch<{ isSuccess?: boolean; mirrorID?: number; failReason?: string }>(
      `/trading/copy/${encodeURIComponent(referentie)}`,
      sleutels,
      { versie: 'v2' },
    );
    if (data?.isSuccess === true) return { soort: 'gelukt', mirrorId: typeof data.mirrorID === 'number' ? data.mirrorID : null };
    return { soort: 'mislukt', reden: data?.failReason ?? 'eToro gaf geen reden.' };
  } catch (e) {
    if ((e as { status?: number })?.status === 404) return { soort: 'nog-bezig' };
    throw e;
  }
}

// Stopt een copy. 'Close' verkoopt de gekopieerde posities en zet het geld terug op je saldo.
export async function stopCopy(mirrorId: number, sleutels: EtoroSleutels, verzoekId: string): Promise<OrderUitkomst> {
  return voerOrderUit(verzoekId, () =>
    etoroFetch<{ token?: string }>('/trading/copy/close', sleutels, {
      versie: 'v2',
      body: { mirrorID: mirrorId, unregisterType: 'Close', clientRequestID: verzoekId },
      verzoekId,
      schrijft: true,
    }),
  );
}

// ---------- Je eigen copies (uit je eigen portfolio) ----------

// Een CopyTrader-relatie uit clientPortfolio.mirrors van je eigen portfolio. eToro's docs schrijven
// de velden in het schema als mirrorID/parentCID en in het voorbeeld als mirrorId/parentCid, dus
// beide schrijfwijzen. Niet gemeten.
export interface EigenMirror {
  mirrorId: number;
  parentCid: number | null;
  parentUsername: string;
  // Netto ingelegd: eerste inleg plus bijstortingen min opnames.
  inlegUsd: number;
  // eToro's Copy Stop Loss: in procent van de waarde bij de laatste wijziging, en als bedrag
  // waarop eToro de copy sluit.
  cslPct: number | null;
  cslBedragUsd: number | null;
  // 0 actief, 1 gepauzeerd, 2 wordt gesloten, 3 wordt uitgelijnd.
  status: number | null;
  aantalPosities: number;
  gestart: number | null;
}

function getal(...waarden: unknown[]): number | null {
  for (const w of waarden) if (typeof w === 'number' && Number.isFinite(w)) return w;
  return null;
}

export function leesMirrors(portfolio: unknown): EigenMirror[] {
  const cp = (portfolio as { clientPortfolio?: { mirrors?: unknown } } | null)?.clientPortfolio;
  const lijst = Array.isArray(cp?.mirrors) ? (cp!.mirrors as Record<string, unknown>[]) : [];
  const uit: EigenMirror[] = [];
  for (const m of lijst) {
    if (!m || typeof m !== 'object') continue;
    const mirrorId = getal(m.mirrorID, m.mirrorId);
    const naam = typeof m.parentUsername === 'string' ? m.parentUsername : '';
    if (mirrorId === null || !naam) continue;
    const inleg = (getal(m.initialInvestment) ?? 0) + (getal(m.depositSummary) ?? 0) - (getal(m.withdrawalSummary) ?? 0);
    const gestart = typeof m.startedCopyDate === 'string' ? Date.parse(m.startedCopyDate) : NaN;
    uit.push({
      mirrorId,
      parentCid: getal(m.parentCID, m.parentCid),
      parentUsername: naam,
      inlegUsd: Math.round(inleg * 100) / 100,
      cslPct: getal(m.stopLossPercentage),
      cslBedragUsd: getal(m.stopLossAmount),
      status: getal(m.mirrorStatusID, m.mirrorStatusId),
      aantalPosities: Array.isArray(m.positions) ? m.positions.length : 0,
      gestart: Number.isNaN(gestart) ? null : gestart,
    });
  }
  return uit;
}
