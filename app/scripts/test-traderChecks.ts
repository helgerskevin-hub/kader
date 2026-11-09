// Speelt checkFavorieteTraders na (acht rondes) met nagebootste opslag, meldingen en eToro-antwoorden. Geen
// testframework, net als de self-checks elders. Draaien vanuit app/: npx tsx scripts/test-traderChecks.ts
const Module = require('module');
const path = require('path');
const APP = path.join(__dirname, '../src');

const opslag = new Map<string, string>();
const meldingen: { titel: string; tekst: string; data?: unknown }[] = [];
let scenario: Record<string, { positions: any[] }> = {};
// Draait midden in het ophalen, om een gelijktijdige schrijfactie van de gebruiker na te bootsen.
let tijdensOphalen: (() => void) | null = null;

const nep: Record<string, any> = {
  '@react-native-async-storage/async-storage': {
    __esModule: true,
    default: {
      getItem: async (k: string) => opslag.get(k) ?? null,
      setItem: async (k: string, v: string) => { opslag.set(k, v); },
      removeItem: async (k: string) => { opslag.delete(k); },
      multiRemove: async (ks: string[]) => ks.forEach(k => opslag.delete(k)),
    },
  },
  'expo-notifications': {
    setNotificationHandler: () => {},
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    setNotificationChannelAsync: async () => {},
    cancelAllScheduledNotificationsAsync: async () => {},
    scheduleNotificationAsync: async ({ content }: any) => { meldingen.push({ titel: content.title, tekst: content.body, data: content.data }); },
    AndroidImportance: { HIGH: 4, DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DAILY: 'daily' },
  },
  'react-native': new Proxy({ Platform: { OS: 'android', select: (o: any) => o.android ?? o.default } }, {
    get: (t: any, k) => (k in t ? t[k] : () => null),
  }),
};
const nepPaden: Record<string, any> = {
  [path.join(APP, 'state/etoroSleutels')]: { actieveSleutels: async () => ({ apiKey: 'a', userKey: 'b', omgeving: 'demo' }) },
  [path.join(APP, 'state/meldingVoorkeur')]: { meldingenAan: async () => true },
  [path.join(APP, 'engine/etoroTraders')]: {
    haalLivePortfolio: async (naam: string) => {
      if (tijdensOphalen) { const f = tijdensOphalen; tijdensOphalen = null; f(); }
      if (!scenario[naam]) throw new Error('onbereikbaar');
      return scenario[naam];
    },
    vulSymbolenAan: async (ids: number[], kaart: Record<string, string | null>) => {
      const v = { ...kaart };
      for (const id of ids) v[String(id)] = id === 100000 ? 'BTC' : id === 100001 ? 'ETH' : id === 100043 ? 'SHIB' : null;
      return v;
    },
  },
};
const origineel = Module._load;
Module._load = function (verzoek: string, ouder: any, ...rest: any[]) {
  if (verzoek in nep) return nep[verzoek];
  if (verzoek.startsWith('.') && ouder?.filename) {
    const vol = path.join(path.dirname(ouder.filename), verzoek);
    if (vol in nepPaden) return nepPaden[vol];
  }
  if (/^expo-|^@expo|^react-native-|^lucide/.test(verzoek)) return new Proxy({}, { get: () => () => null });
  return origineel.call(this, verzoek, ouder, ...rest);
};

let missers = 0;
const check = (ok: boolean, tekst: string) => { if (!ok) { missers++; console.error('MIS:', tekst); } else console.log('ok:', tekst); };

(async () => {
  const { checkFavorieteTraders } = require(path.join(APP, 'notifications/traderChecks'));
  const { SLEUTELS } = require(path.join(APP, 'storage/opslag'));
  const zet = (k: string, v: unknown) => opslag.set(k, JSON.stringify(v));
  const lees = (k: string) => JSON.parse(opslag.get(k) ?? 'null');
  const uur = new Date().getHours();
  zet(SLEUTELS.copyInstellingen, { bedragUsd: 50, meldingen: true, stilleUren: false, ingesteld: true });
  zet(SLEUTELS.favorieteTraders, [{ username: 'jan', cid: 1 }, { username: 'piet', cid: 2 }]);

  const nu = new Date().toISOString();
  const oud = new Date(Date.now() - 3 * 24 * 3600e3).toISOString();
  scenario = {
    jan: { positions: [
      { positionId: 1, instrumentId: 100000, openRate: 60000, isBuy: true, openTimestamp: oud },
      { positionId: 2, instrumentId: 100001, openRate: 3000, isBuy: true, openTimestamp: nu },
    ] },
    piet: { positions: [] },
  };

  // Ronde 1: eerste kennismaking. Geen melding, alleen het recente in de feed.
  let u = await checkFavorieteTraders();
  check(u.gemeld === 0 && meldingen.length === 0, 'eerste ronde meldt niets');
  let feed = lees(SLEUTELS.traderFeed) ?? [];
  check(feed.length === 1 && feed[0].positionId === 2, 'alleen de positie van vandaag staat in de feed');

  // Ronde 2: jan opent BTC long met stop, een short, een aandeel en een copy van iemand anders.
  scenario.jan.positions.push(
    { positionId: 3, instrumentId: 100000, openRate: 61000, isBuy: true, stopLossRate: 58000, takeProfitRate: 70000, openTimestamp: nu },
    { positionId: 4, instrumentId: 100001, openRate: 3000, isBuy: false, openTimestamp: nu },
    { positionId: 5, instrumentId: 1001, openRate: 200, isBuy: true, openTimestamp: nu },
    { positionId: 6, instrumentId: 100000, openRate: 61000, isBuy: true, parentPositionId: 99, openTimestamp: nu },
  );
  u = await checkFavorieteTraders();
  check(u.nieuw === 3, `drie nieuwe directe posities (was ${u.nieuw})`);
  check(meldingen.length === 1, 'één melding voor de ene kopieerbare trade');
  check(meldingen[0]?.titel === 'jan kocht BTC', `titel klopt: ${meldingen[0]?.titel}`);
  check(/Long op \$61,000\.00 · stop \$58,000\.00 · doel \$70,000\.00\. Tik om te kopiëren\./.test(meldingen[0]?.tekst ?? ''), `tekst klopt: ${meldingen[0]?.tekst}`);
  check(/Geen financieel advies/.test(meldingen[0]?.tekst ?? ''), 'disclaimer staat erbij');
  check((meldingen[0]?.data as any)?.doel?.soort === 'copy' && (meldingen[0]?.data as any)?.doel?.sleutel === 'jan:3', 'tik opent de trade');
  feed = lees(SLEUTELS.traderFeed);
  check(feed.some((i: any) => i.positionId === 5 && i.symbool === null), 'het aandeel staat als buiten Kader');
  check(!feed.some((i: any) => i.positionId === 6), 'de copy van iemand anders telt niet');

  // Ronde 3: niets nieuw, geen nieuwe melding.
  u = await checkFavorieteTraders();
  check(u.nieuw === 0 && meldingen.length === 1, 'zonder nieuws geen melding');

  // Ronde 4: jij kopieerde positie 3, jouw positie 777 staat open; jan sluit 3.
  zet(SLEUTELS.copyHerkomst, [{ verzoekId: 'v1', username: 'jan', bronPositieId: 3, symbool: 'BTC', omgeving: 'demo', tijd: Date.now(), etoroPositionID: 777 }]);
  zet(SLEUTELS.portfolio, [{ id: 't1', symbool: 'BTC', status: 'open', etoroPositionID: 777, entryPrijs: 61000 }]);
  scenario.jan.positions = scenario.jan.positions.filter((p: any) => p.positionId !== 3);
  u = await checkFavorieteTraders();
  check(u.gesloten === 1, 'sluiting gezien');
  check(meldingen.length === 2 && meldingen[1].titel === 'jan is uit BTC gestapt', `uitstapmelding: ${meldingen[1]?.titel}`);
  check(lees(SLEUTELS.copyHerkomst)[0].uitstapGemeld === true, 'uitstap onthouden');
  feed = lees(SLEUTELS.traderFeed);
  check(feed.find((i: any) => i.positionId === 3)?.gesloten === true, 'feedregel staat op gesloten');

  // Ronde 5: piet onbereikbaar, jan opent twee trades tegelijk: één gebundelde melding.
  delete (scenario as any).piet;
  scenario.jan.positions.push(
    { positionId: 8, instrumentId: 100000, openRate: 62000, isBuy: true, openTimestamp: nu },
    { positionId: 9, instrumentId: 100043, openRate: 20, isBuy: true, openTimestamp: nu },
  );
  u = await checkFavorieteTraders();
  check(meldingen.length === 3 && meldingen[2].titel === 'jan opende 2 trades', `bundel: ${meldingen[2]?.titel}`);
  check(lees(SLEUTELS.traderPosities).piet !== undefined, 'onbereikbare piet behoudt zijn bekende posities');

  // Ronde 6: stille uren aan en het is nacht? Alleen te testen als het nu nacht is; anders meldingen uit.
  zet(SLEUTELS.copyInstellingen, { bedragUsd: 50, meldingen: false, stilleUren: false, ingesteld: true });
  scenario.jan.positions.push({ positionId: 10, instrumentId: 100000, openRate: 62000, isBuy: true, openTimestamp: nu });
  u = await checkFavorieteTraders();
  check(u.nieuw === 1 && meldingen.length === 3, 'meldingen uit: wel in de feed, geen melding');
  void uur;

  // Ronde 7: je kopieert positie 10 terwijl de check nog bezig is met ophalen. De markering moet
  // blijven staan, anders komt de Kopieer-knop terug.
  tijdensOphalen = () => {
    const f = lees(SLEUTELS.traderFeed);
    zet(SLEUTELS.traderFeed, f.map((i: any) => (i.sleutel === 'jan:10' ? { ...i, gekopieerd: true } : i)));
  };
  await checkFavorieteTraders();
  feed = lees(SLEUTELS.traderFeed);
  check(feed.find((i: any) => i.sleutel === 'jan:10')?.gekopieerd === true, 'kopie tijdens de check blijft gemarkeerd');

  // Ronde 8: jan is geen favoriet meer, opent intussen drie trades, en wordt weer favoriet.
  // Dat telt als een eerste kennismaking: geen melding voor wat hij tussendoor deed.
  zet(SLEUTELS.copyInstellingen, { bedragUsd: 50, meldingen: true, stilleUren: false, ingesteld: true });
  zet(SLEUTELS.favorieteTraders, [{ username: 'piet', cid: 2 }]);
  await checkFavorieteTraders();
  check(lees(SLEUTELS.traderPosities).jan === undefined, 'oud-favoriet jan is vergeten');
  scenario.jan.positions.push(
    { positionId: 11, instrumentId: 100000, openRate: 62000, isBuy: true, openTimestamp: oud },
    { positionId: 12, instrumentId: 100001, openRate: 3100, isBuy: true, openTimestamp: oud },
    { positionId: 13, instrumentId: 100000, openRate: 62500, isBuy: true, openTimestamp: oud },
  );
  zet(SLEUTELS.favorieteTraders, [{ username: 'jan', cid: 1 }]);
  const voor = meldingen.length;
  u = await checkFavorieteTraders();
  check(u.nieuw === 0 && meldingen.length === voor, `terug als favoriet: geen stortvloed (nieuw ${u.nieuw})`);

  if (missers > 0) { console.error(`\n${missers} controle(s) mislukt`); process.exit(1); }
  console.log('\ntraderChecks-test geslaagd');
})().catch(e => { console.error(e); process.exit(1); });
