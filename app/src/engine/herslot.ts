// Wanneer de app weer op slot gaat en in welke stand hij start, puur: geen React, geen opslag, geen
// native klok. De provider levert de klokmetingen (KlokStand) en de gelezen kluis.
import {
  KlokStand,
  LeesUitkomst,
  PinRecord,
  SlotStatus,
  SlotTermijn,
  TERMIJN_MS,
} from '../state/vergrendelTypes';

export interface HervergrendelInvoer {
  termijn: SlotTermijn;
  // Klokmeting op het moment dat de app naar de achtergrond ging. null: onbekend (bijvoorbeeld de
  // AppState-gebeurtenis ging verloren); dan vergrendelen we, want falen moet de veilige kant op.
  achtergrondSinds: KlokStand | null;
  // Klokmeting nu, bij terugkomst.
  nu: KlokStand;
}

// Moet de app bij terugkomst op slot? 'direct' altijd. Anders als de tijd op de achtergrond de
// termijn haalt. Zijn beide metingen monotoon, dan beslist altijd het monotone verschil (een
// teruggezette wandklok verkort de wachttijd dan niet). Bij een onbekende teller (-1) kan een
// herstart onopgemerkt zijn: dan telt het grootste van het monotone en het wandverschil, en een
// teruggezette wandklok geldt als knoeien. Verschillende bekende tellers: opnieuw opgestart,
// vergrendelen. Zonder monotone bron telt de wandklok. Alles wat niet eindig of negatief is telt
// als "verstreken": liever een keer te veel een pincode dan te weinig. Een vooruitgezette wandklok
// kan alleen leiden tot vaker vergrendelen, nooit tot minder.
export function moetHervergrendelen({ termijn, achtergrondSinds, nu }: HervergrendelInvoer): boolean {
  const termijnMs = TERMIJN_MS[termijn];
  if (termijnMs === undefined) return true; // onbekende termijn: veilig
  if (termijnMs === 0) return true;
  if (!achtergrondSinds) return true;
  const metingen = [nu.monotoon, nu.wand, nu.bootTeller, achtergrondSinds.monotoon, achtergrondSinds.wand, achtergrondSinds.bootTeller];
  if (!metingen.every((n) => typeof n === 'number' && Number.isFinite(n))) return true;

  const wandVerschil = nu.wand - achtergrondSinds.wand;
  let verstreken: number;
  if (nu.bron === 'monotoon' && achtergrondSinds.bron === 'monotoon') {
    const monoVerschil = nu.monotoon - achtergrondSinds.monotoon;
    if (monoVerschil < 0) return true; // de monotone klok liep terug: opnieuw opgestart
    if (nu.bootTeller !== -1 && achtergrondSinds.bootTeller !== -1) {
      if (nu.bootTeller !== achtergrondSinds.bootTeller) return true; // opnieuw opgestart
      verstreken = monoVerschil;
    } else {
      if (wandVerschil < 0) return true;
      verstreken = Math.max(monoVerschil, wandVerschil);
    }
  } else {
    verstreken = wandVerschil;
  }
  if (!Number.isFinite(verstreken) || verstreken < 0) return true;
  return verstreken >= termijnMs;
}

export interface SlotStatusInvoer {
  // Uitkomst van het lezen van het pincode-record uit de kluis.
  pinRecord: LeesUitkomst<PinRecord>;
  etoroGekoppeld: boolean;
  // true bij het opstarten van de app (en bij "opnieuw proberen" na een kluisfout): een aanwezige
  // pincode betekent dan vergrendeld. false (bijvoorbeeld net na het instellen van een pincode of
  // een herbepaling terwijl de app al open was): dan blijft de app open.
  koudeStart: boolean;
  // De hint SLEUTELS.slotIngesteld (AsyncStorage): is er ooit een pincode ingesteld? Alleen nodig
  // om bij een kluisfout te beslissen; zonder pincode en zonder koppeling valt er niets te beschermen.
  hintIngesteld: boolean;
}

export interface SlotStatusUitkomst {
  status: SlotStatus;
  // Alleen true als de kluis niet leesbaar was; hoort bij status 'vergrendeld'.
  kluisfout: boolean;
}

// De beginstatus. Een kluisfout is niet "geen pincode": dat zou het slot openzetten. De enige
// uitzondering is dat er nooit een pincode was (hint staat uit) en er ook geen eToro-koppeling is:
// dan is er niets te beschermen en wordt het 'open'. In elk ander geval van een kluisfout is het
// 'vergrendeld' met kluisfout = true, ook zonder koude start.
export function bepaalSlotStatus({
  pinRecord,
  etoroGekoppeld,
  koudeStart,
  hintIngesteld,
}: SlotStatusInvoer): SlotStatusUitkomst {
  if (pinRecord.soort === 'kluisfout') {
    if (!hintIngesteld && !etoroGekoppeld) return { status: 'open', kluisfout: false };
    return { status: 'vergrendeld', kluisfout: true };
  }
  if (pinRecord.soort === 'ja') {
    return { status: koudeStart ? 'vergrendeld' : 'open', kluisfout: false };
  }
  // Geen pincode: bij een eToro-koppeling is het slot verplicht (migratie), anders is er niets te slotten.
  return { status: etoroGekoppeld ? 'setupVerplicht' : 'open', kluisfout: false };
}

// Mag het slot uit? Niet zolang er een eToro-koppeling is.
export function magSlotUit(etoroGekoppeld: boolean): boolean {
  return !etoroGekoppeld;
}

// ponytail: self-check ipv testframework, run met `npx tsx src/engine/herslot.ts` (vanuit app/)
if (require.main === module) {
  const assert: typeof import('node:assert/strict') = require('node:assert/strict');
  const { SLOT_TERMIJNEN } = require('../state/vergrendelTypes') as typeof import('../state/vergrendelTypes');

  const SEC = 1000;
  const klok = (monotoon: number, wand: number, bootTeller = 7): KlokStand =>
    ({ monotoon, bootTeller, wand, bron: 'monotoon' });
  const wandKlok = (wand: number): KlokStand => ({ monotoon: wand, bootTeller: -1, wand, bron: 'wand' });
  const W = 1_700_000_000_000;

  // ---------- Elke termijn, op de grens ----------
  const grenzen: Record<SlotTermijn, number> = { direct: 0, '30s': 30 * SEC, '1m': 60 * SEC, '5m': 300 * SEC, '15m': 900 * SEC };
  for (const termijn of SLOT_TERMIJNEN) {
    const g = grenzen[termijn];
    const bg = klok(1_000_000, W);
    const ruim = (ms: number) => moetHervergrendelen({ termijn, achtergrondSinds: bg, nu: klok(1_000_000 + ms, W + ms) });
    if (termijn === 'direct') {
      assert.ok(ruim(0), 'direct: meteen');
      assert.ok(ruim(5 * SEC), 'direct: altijd');
      continue;
    }
    assert.ok(!ruim(0), termijn + ': net weg, niet vergrendelen');
    assert.ok(!ruim(g - 1), termijn + ': een ms voor de grens');
    assert.ok(ruim(g), termijn + ': precies op de grens vergrendelt (>=)');
    assert.ok(ruim(g + 1), termijn + ': erna');
    assert.ok(ruim(g * 10), termijn + ': ruim erna');
  }
  assert.ok(moetHervergrendelen({ termijn: 'direct', achtergrondSinds: null, nu: klok(0, 0) }), 'direct zonder meting');
  assert.ok(moetHervergrendelen({ termijn: '5m', achtergrondSinds: null, nu: klok(0, 0) }), 'onbekende achtergrondtijd: vergrendelen');
  assert.ok(moetHervergrendelen({ termijn: 'weetniet' as SlotTermijn, achtergrondSinds: klok(0, 0), nu: klok(0, 0) }), 'onbekende termijn: vergrendelen');

  // ---------- Klok verzetten ----------
  const bg = klok(1_000_000, W);
  // Wandklok een dag vooruit, monotoon 5 s: monotoon beslist.
  assert.ok(!moetHervergrendelen({ termijn: '1m', achtergrondSinds: bg, nu: klok(1_005_000, W + 86_400_000) }), 'vooruitgezette wandklok vergrendelt niet vaker');
  // Wandklok een dag terug, monotoon 2 min: toch vergrendelen.
  assert.ok(moetHervergrendelen({ termijn: '1m', achtergrondSinds: bg, nu: klok(1_120_000, W - 86_400_000) }), 'teruggezette wandklok verlengt niets');
  // Zonder monotone klok: wandklok terug is "verstreken" (veilig), vooruit telt gewoon.
  assert.ok(moetHervergrendelen({ termijn: '1m', achtergrondSinds: wandKlok(W), nu: wandKlok(W - 5 * SEC) }), 'wand: teruggezet vergrendelt');
  assert.ok(!moetHervergrendelen({ termijn: '1m', achtergrondSinds: wandKlok(W), nu: wandKlok(W + 30 * SEC) }), 'wand: binnen de termijn');
  assert.ok(moetHervergrendelen({ termijn: '1m', achtergrondSinds: wandKlok(W), nu: wandKlok(W + 60 * SEC) }), 'wand: op de grens');
  // Een monotone meting en een wandmeting door elkaar: terugval op wand.
  assert.ok(!moetHervergrendelen({ termijn: '1m', achtergrondSinds: bg, nu: { ...wandKlok(W + 10 * SEC) } }), 'gemengd: wandverschil 10 s');
  assert.ok(moetHervergrendelen({ termijn: '1m', achtergrondSinds: bg, nu: wandKlok(W + 70 * SEC) }), 'gemengd: wandverschil 70 s');

  // ---------- Monotoon leidt, ook als de teller onbekend is ----------
  // Wandklok teruggezet zodat het wandverschil klein lijkt (10 min weg, wand maar 10 s verder): monotoon wint.
  assert.ok(moetHervergrendelen({ termijn: '1m', achtergrondSinds: bg, nu: klok(1_600_000, W + 10 * SEC) }), 'bekende teller: monotoon 10 min, wand 10 s: vergrendelen');
  assert.ok(moetHervergrendelen({ termijn: '1m', achtergrondSinds: klok(1_000_000, W, -1), nu: klok(1_600_000, W + 10 * SEC, -1) }), 'teller -1: monotoon 10 min, wand 10 s: vergrendelen');
  assert.ok(moetHervergrendelen({ termijn: '1m', achtergrondSinds: klok(1_000_000, W, -1), nu: klok(1_600_000, W + 10 * SEC, 7) }), 'teller deels bekend: idem');
  // En andersom: wand een uur vooruit, monotoon 5 s: bij een onbekende teller telt max, dus vergrendelen (fail-closed); bij bekende teller niet.
  assert.ok(moetHervergrendelen({ termijn: '1m', achtergrondSinds: klok(1_000_000, W, -1), nu: klok(1_005_000, W + 3_600_000, -1) }), 'teller -1, wand een uur vooruit: veilig vergrendelen');
  assert.ok(!moetHervergrendelen({ termijn: '1m', achtergrondSinds: bg, nu: klok(1_005_000, W + 3_600_000) }), 'bekende teller: monotoon beslist');
  assert.ok(!moetHervergrendelen({ termijn: '1m', achtergrondSinds: bg, nu: klok(1_005_000, W - 3_600_000) }), 'bekende teller, wand terug: monotoon beslist (5 s)');
  // Niet-eindige waarden: vergrendelen.
  assert.ok(moetHervergrendelen({ termijn: '1m', achtergrondSinds: bg, nu: klok(NaN, W) }), 'NaN monotoon');
  assert.ok(moetHervergrendelen({ termijn: '1m', achtergrondSinds: bg, nu: klok(1_001_000, Infinity) }), 'Infinity wand');
  assert.ok(moetHervergrendelen({ termijn: '1m', achtergrondSinds: { ...bg, bootTeller: NaN }, nu: klok(1_001_000, W) }), 'NaN teller');

  // ---------- Reboot ----------
  assert.ok(moetHervergrendelen({ termijn: '15m', achtergrondSinds: bg, nu: klok(5_000, W + 5_000, 8) }), 'andere bootTeller: vergrendelen');
  // Monotoon "teruggelopen" bij dezelfde teller kan niet: veilig vergrendelen.
  assert.ok(moetHervergrendelen({ termijn: '15m', achtergrondSinds: bg, nu: klok(5_000, W + 5_000, 7) }), 'negatieve monotone tijd');
  // Onbekende teller: wandklok.
  assert.ok(!moetHervergrendelen({ termijn: '5m', achtergrondSinds: klok(1_000, W, -1), nu: klok(9_000, W + 8 * SEC, -1) }), 'teller -1: via wandklok');
  assert.ok(moetHervergrendelen({ termijn: '5m', achtergrondSinds: klok(1_000, W, -1), nu: klok(2_000, W - 1, -1) }), 'teller -1 met teruggezette wand');

  // ---------- Slotstatus ----------
  const rec: PinRecord = { v: 1, alg: 'pbkdf2-sha256', it: 100_000, salt: 'aa', hash: 'bb' };
  const ja: LeesUitkomst<PinRecord> = { soort: 'ja', waarde: rec };
  const nee: LeesUitkomst<PinRecord> = { soort: 'nee' };
  const kf: LeesUitkomst<PinRecord> = { soort: 'kluisfout', bericht: 'kapot' };

  assert.deepEqual(bepaalSlotStatus({ pinRecord: ja, etoroGekoppeld: false, koudeStart: true, hintIngesteld: true }), { status: 'vergrendeld', kluisfout: false });
  assert.deepEqual(bepaalSlotStatus({ pinRecord: ja, etoroGekoppeld: true, koudeStart: true, hintIngesteld: true }), { status: 'vergrendeld', kluisfout: false });
  assert.deepEqual(bepaalSlotStatus({ pinRecord: ja, etoroGekoppeld: true, koudeStart: false, hintIngesteld: true }), { status: 'open', kluisfout: false });
  assert.deepEqual(bepaalSlotStatus({ pinRecord: nee, etoroGekoppeld: true, koudeStart: true, hintIngesteld: true }), { status: 'setupVerplicht', kluisfout: false });
  assert.deepEqual(bepaalSlotStatus({ pinRecord: nee, etoroGekoppeld: true, koudeStart: false, hintIngesteld: true }), { status: 'setupVerplicht', kluisfout: false });
  assert.deepEqual(bepaalSlotStatus({ pinRecord: nee, etoroGekoppeld: false, koudeStart: true, hintIngesteld: true }), { status: 'open', kluisfout: false });
  assert.deepEqual(bepaalSlotStatus({ pinRecord: nee, etoroGekoppeld: false, koudeStart: false, hintIngesteld: true }), { status: 'open', kluisfout: false });
  // Zonder pincode in de kluis maar met hint of koppeling blijft 'nee' gewoon 'nee' (hint telt alleen bij kluisfout).
  assert.deepEqual(bepaalSlotStatus({ pinRecord: nee, etoroGekoppeld: false, koudeStart: true, hintIngesteld: false }), { status: 'open', kluisfout: false });
  // Kluisfout is nooit 'geen pincode', behalve als er nooit een pincode was (hint uit) en geen koppeling.
  for (const etoroGekoppeld of [true, false]) {
    for (const koudeStart of [true, false]) {
      for (const hintIngesteld of [true, false]) {
        const verwacht = !hintIngesteld && !etoroGekoppeld
          ? { status: 'open', kluisfout: false }
          : { status: 'vergrendeld', kluisfout: true };
        assert.deepEqual(
          bepaalSlotStatus({ pinRecord: kf, etoroGekoppeld, koudeStart, hintIngesteld }),
          verwacht,
          'kluisfout (eToro ' + etoroGekoppeld + ', koud ' + koudeStart + ', hint ' + hintIngesteld + ')',
        );
      }
    }
  }

  // ---------- Slot uit ----------
  assert.equal(magSlotUit(false), true);
  assert.equal(magSlotUit(true), false, 'met eToro-koppeling kan het slot niet uit');

  console.log('herslot.ts self-check geslaagd');
}
