// Wegwerpscript, fase 1 van docs/etoro-direct-handelen-plan.md. GEEN app-code: dit bestand wordt
// nooit door de app geïmporteerd en mag na fase 5 weg.
//
// Doel: met een echte eToro DEMO-sleutel de open vragen uit paragraaf 9 van het plan beantwoorden,
// zonder een rebuild en zonder de app aan te raken. Alles wat het script leert schrijf je terug in
// het plan, want de rest van de bouw hangt op die antwoorden.
//
// Draaien:
//   ETORO_DEMO_API_KEY=... ETORO_DEMO_USER_KEY=... npx tsx scripts/etoro-demo-order.ts
//
// Zonder vlaggen leest het script alleen. Een order plaatsen doet het pas met --order, en dan nog
// alleen op het demo-pad. Dit script kan met opzet niets naar een echt account sturen: er is geen
// codepad dat het echte order-endpoint aanroept.
//
// Vlaggen:
//   --order            plaats één demo-marktorder (het echte doel van fase 1)
//   --dubbel           stuur diezelfde order nog een keer met dezelfde x-request-id, om te zien of
//                      eToro erop ontdubbelt of hem alleen echoot (open vraag 6)
//   --symbool=ETH      standaard BTC
//   --bedrag=10        standaard 10, in de valuta die eToro accepteert (open vraag 3)
//   --settlement=real  standaard: eerst helemaal weglaten (zoals eToro's eigen BTC-voorbeeld doet),
//                      dan 'real', dan 'cfd' (vraag 1)
//   --leverage=1       standaard 1
//   --geen-sl          stuur geen stopLossRate/takeProfitRate mee, om te zien of de order zonder
//                      niveaus wel wordt geaccepteerd (isoleert vraag 1)
//   --patch            probeer na de order de stop-loss te wijzigen via PATCH op de positie. Dit is
//                      geen bevestigd endpoint: het staat niet in eToro's endpoint-index en de
//                      pagina over positie-informatie noemt zichzelf read-only. Fase 4 van het plan
//                      hangt hierop, dus dit moet uitgezocht worden voor die gebouwd wordt.

const BASIS = 'https://public-api.etoro.com/api';

const apiKey = process.env.ETORO_DEMO_API_KEY ?? '';
const userKey = process.env.ETORO_DEMO_USER_KEY ?? '';

const vlaggen = process.argv.slice(2);
const heeft = (naam: string) => vlaggen.includes(naam);
const waarde = (naam: string, standaard: string) => {
  const treffer = vlaggen.find(v => v.startsWith(`--${naam}=`));
  return treffer ? treffer.slice(naam.length + 3) : standaard;
};

const SYMBOOL = waarde('symbool', 'BTC').toUpperCase();
const BEDRAG = Number(waarde('bedrag', '10'));
const LEVERAGE = Number(waarde('leverage', '1'));
const SETTLEMENT = waarde('settlement', '');
const PLAATS_ORDER = heeft('--order');
const DUBBEL = heeft('--dubbel');
const GEEN_SL = heeft('--geen-sl');
const PROBEER_PATCH = heeft('--patch');

function guid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const streep = (titel: string) => console.log(`\n${'='.repeat(70)}\n${titel}\n${'='.repeat(70)}`);

interface Antwoord {
  status: number;
  data: unknown;
  ruw: string;
}

async function roep(
  pad: string,
  opties: { versie?: 'v1' | 'v2'; methode?: string; body?: unknown; verzoekId?: string } = {},
): Promise<Antwoord> {
  const { versie = 'v1', methode, body, verzoekId } = opties;
  const url = `${BASIS}/${versie}${pad}`;
  const gebruikteMethode = methode ?? (body === undefined ? 'GET' : 'POST');

  console.log(`\n-> ${gebruikteMethode} ${url}`);
  if (body !== undefined) console.log(`   body: ${JSON.stringify(body)}`);

  const res = await fetch(url, {
    method: gebruikteMethode,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      'x-api-key': apiKey,
      'x-user-key': userKey,
      'x-request-id': verzoekId ?? guid(),
      'Accept': 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
  });

  const ruw = await res.text();
  let data: unknown = null;
  try { data = JSON.parse(ruw); } catch { /* geen JSON, ruw is dan het enige wat we hebben */ }

  console.log(`<- ${res.status} ${res.statusText}`);
  console.log(ruw.length > 4000 ? ruw.slice(0, 4000) + '\n   ...(afgekapt)' : ruw);
  return { status: res.status, data, ruw };
}

// Alles wat we onderweg leren, zodat het aan het eind in één blok staat om over te tikken in het plan.
const bevindingen: string[] = [];
const noteer = (regel: string) => { bevindingen.push(regel); };

async function main() {
  if (!apiKey || !userKey) {
    console.error('Zet ETORO_DEMO_API_KEY en ETORO_DEMO_USER_KEY in je omgeving. Dit script draait alleen tegen demo.');
    process.exit(1);
  }

  console.log('eToro demo-verkenning. Alle schrijfacties gaan naar het /demo/-pad, nooit naar een echt account.');
  console.log(`symbool=${SYMBOOL} bedrag=${BEDRAG} leverage=${LEVERAGE} order=${PLAATS_ORDER} dubbel=${DUBBEL} geenSL=${GEEN_SL}`);

  // ---------- 1. Wie ben ik en wat mag deze sleutel? (open vraag 9) ----------
  streep('1. GET /api/v1/me  -> scopes, demoCid, realCid');
  const mij = await roep('/me');
  if (mij.status === 200) {
    const scopes = (mij.data as any)?.scopes;
    noteer(`scopes uit /me: ${JSON.stringify(scopes)}`);
    noteer(`heeft deze sleutel zowel lees- als schrijfrecht? -> beoordeel de scopes hierboven (vraag 9)`);
  } else {
    noteer(`/me gaf ${mij.status}. Als dit 404 is bestaat het endpoint niet zoals aangenomen; dan moet magHandelenVolgensScopes anders.`);
  }

  // ---------- 2. Symbool naar instrumentId (open vraag 7) ----------
  streep(`2. GET /api/v1/market-data/search?internalSymbolFull=${SYMBOOL}  -> instrumentId`);
  const zoek = await roep(`/market-data/search?internalSymbolFull=${SYMBOOL}`);
  const items: any[] = Array.isArray((zoek.data as any)?.items) ? (zoek.data as any).items : [];
  noteer(`market-data/search gaf ${items.length} treffer(s) voor ${SYMBOOL}`);
  if (items.length > 1) {
    noteer(`MEERDUIDIG: ${items.map(i => `${i.internalSymbolFull}=${i.instrumentId}`).join(', ')} -- welk veld onderscheidt spot/CFD/aandeel? (vraag 7)`);
  }

  // Exacte treffer eerst; een gedeeltelijke treffer is niet goed genoeg om geld op te zetten.
  const exact = items.find(i => String(i.internalSymbolFull ?? '').toUpperCase() === SYMBOOL);
  const instrumentId: number | undefined = exact?.instrumentId ?? (items.length === 1 ? items[0]?.instrumentId : undefined);
  if (typeof instrumentId !== 'number') {
    console.error(`\nGeen eenduidig instrumentId voor ${SYMBOOL}. Stop hier: zonder zekere id gaat er geen order uit.`);
    toonBevindingen();
    return;
  }
  noteer(`instrumentId voor ${SYMBOOL} = ${instrumentId}`);

  // ---------- 3. Demo-portfolio: vrij saldo en het pad zelf (open vraag over het demo-pad) ----------
  streep('3. Demo-portfolio  -> credit (vrij saldo) en bevestiging van het demo-pad');
  let portfolioPad = '/trading/info/demo/portfolio';
  let portfolio = await roep(portfolioPad);
  if (portfolio.status === 404) {
    // Tweede gok: het /demo/-segment een niveau hoger.
    portfolioPad = '/trading/demo/info/portfolio';
    console.log('\n404 op het eerste demo-pad, tweede variant proberen.');
    portfolio = await roep(portfolioPad);
  }
  if (portfolio.status === 404) {
    portfolioPad = '/trading/info/portfolio';
    console.log('\nOok 404. Kale pad proberen: misschien bepaalt de sleutel de omgeving en niet het pad.');
    portfolio = await roep(portfolioPad);
  }
  noteer(`werkend demo-portfoliopad: ${portfolio.status === 200 ? portfolioPad : 'GEEN VAN DE DRIE, zie output hierboven'}`);

  const credit = (portfolio.data as any)?.clientPortfolio?.credit;
  noteer(`vrij saldo (clientPortfolio.credit) = ${credit}`);
  const posities: any[] = (portfolio.data as any)?.clientPortfolio?.positions ?? [];
  noteer(`open demo-posities voor de order: ${posities.length}`);

  // ---------- 3b. Eligibility: minimumbedrag en stop-loss-grenzen (open vraag 2) ----------
  // Volgens de documentatie zit het minimum per instrument in leverageConfigs[].minPositionAmount.
  // Dat veld leest etoroLimieten.ts vandaag niet uit; als het er staat, kan de koop-sheet een
  // ondoorzichtige 400 voorkomen met een echte minimumvalidatie.
  streep('3b. POST /api/v2/trading/info/demo/eligibility  -> minPositionAmount en stop-loss-grenzen');
  const eligibility = await roep('/trading/info/demo/eligibility', {
    versie: 'v2',
    body: { symbols: [SYMBOOL], currency: 'USD' },
  });
  const configs: any[] = (eligibility.data as any)?.eligibilities?.[0]?.leverageConfigs ?? [];
  const x1 = configs.find(c => /buy|long/i.test(c.direction ?? 'buy') && c.leverageValues?.includes(1));
  noteer(`demo-eligibility gaf ${eligibility.status}; ${configs.length} leverageConfig(s) voor ${SYMBOOL}`);
  if (x1) {
    noteer(`x1-long config: minPositionAmount=${x1.minPositionAmount} settlementType=${x1.settlementType} minSL%=${x1.minStopLossPercentage} maxSL%=${x1.maxStopLossPercentage} allowEditStopLoss=${x1.allowEditStopLoss}`);
    noteer(`-> settlementType uit eligibility is een sterke hint voor vraag 1, en minPositionAmount beantwoordt vraag 2`);
  } else {
    noteer('geen x1-long config gevonden in de eligibility-respons; vraag 2 blijft open');
  }

  if (!PLAATS_ORDER) {
    console.log('\nAlleen gelezen. Draai opnieuw met --order om daadwerkelijk een demo-order te plaatsen.');
    toonBevindingen();
    return;
  }

  // ---------- 4. De demo-order (open vragen 1, 2, 3, 4, 6) ----------
  streep('4. POST /api/v2/trading/execution/demo/orders  -> de eigenlijke test');

  // Een stop en een doel op een ruime afstand van de laatste koers, zodat ze niet direct raken.
  // De koers komt uit de zoekrespons als die hem meegaf, anders slaan we de niveaus over.
  const koers = Number(exact?.lastPrice ?? exact?.price ?? (items[0] as any)?.lastPrice ?? NaN);
  const metNiveaus = !GEEN_SL && isFinite(koers) && koers > 0;
  if (!GEEN_SL && !metNiveaus) {
    noteer('geen koers in de zoekrespons, dus de order gaat zonder stopLossRate/takeProfitRate. Vraag 1 blijft dan open.');
  }

  // Leeg = het veld helemaal weglaten. eToro's eigen BTC-voorbeeld in de guide doet dat ook, dus
  // dat is de eerste poging waard: dan kiest eToro zelf en zien we in het portfolio wat hij koos.
  const bouwBody = (settlementType: string) => ({
    action: 'open',
    transaction: 'buy',
    instrumentId,
    ...(settlementType ? { settlementType } : {}),
    orderType: 'mkt',
    leverage: LEVERAGE,
    amount: BEDRAG,
    orderCurrency: 'usd',
    ...(metNiveaus ? {
      stopLossRate: Math.round(koers * 0.8 * 100) / 100,
      takeProfitRate: Math.round(koers * 1.3 * 100) / 100,
      stopLossType: 'fixed',
    } : {}),
  });

  const verzoekId = guid();
  console.log(`\nx-request-id voor deze order: ${verzoekId}`);

  // settlementType is de grootste onbekende. Zonder expliciete keuze: 'real' proberen, en pas bij
  // een afwijzing 'cfd'. Wat werkt is het antwoord op vraag 1.
  const teProberen = SETTLEMENT ? [SETTLEMENT] : ['', 'real', 'cfd'];
  let order: Antwoord | null = null;
  let gebruikteSettlement = '';

  for (const settlement of teProberen) {
    console.log(`\n--- settlementType: ${settlement || '(weggelaten)'} ---`);
    order = await roep('/trading/execution/demo/orders', {
      versie: 'v2',
      body: bouwBody(settlement),
      verzoekId,
    });
    gebruikteSettlement = settlement;
    if (order.status >= 200 && order.status < 300) break;
    if (order.status >= 500) {
      // Onbekend: hier NIET nog een settlementType proberen, want de eerste kan alsnog gevuld zijn.
      noteer('5xx op de order: onbekend of hij is uitgevoerd. Controleer het portfolio handmatig voor je opnieuw draait.');
      break;
    }
    noteer(`settlementType '${settlement || '(weggelaten)'}' afgewezen met ${order.status}: ${order.ruw.slice(0, 300)}`);
  }

  const gelukt = order !== null && order.status >= 200 && order.status < 300;
  noteer(gelukt
    ? `ORDER GEACCEPTEERD met settlementType='${gebruikteSettlement || '(weggelaten)'}' (vraag 1 beantwoord)`
    : `order niet geaccepteerd; laatste status ${order?.status}`);
  if (gelukt) {
    noteer(`orderantwoord: ${JSON.stringify(order!.data)}`);
    noteer(`echoot referenceId de x-request-id? verstuurd=${verzoekId} terug=${(order!.data as any)?.referenceId}`);
    noteer(`bedrag ${BEDRAG} met orderCurrency 'usd' en leverage ${LEVERAGE} werd geaccepteerd (vragen 2, 3, 4)`);
    if (metNiveaus) noteer('stopLossRate en takeProfitRate zaten in de geaccepteerde body; controleer hieronder of ze ook echt zijn gezet.');
  }

  // ---------- 5. Ontdubbelt eToro op x-request-id? (open vraag 6) ----------
  if (DUBBEL && gelukt) {
    streep('5. Dezelfde order, dezelfde x-request-id  -> ontdubbelt eToro, of komen er twee posities?');
    const herhaling = await roep('/trading/execution/demo/orders', {
      versie: 'v2',
      body: bouwBody(gebruikteSettlement),
      verzoekId,
    });
    noteer(`herhaling met dezelfde x-request-id gaf ${herhaling.status}; tel hieronder de posities om te zien of het er één of twee zijn (vraag 6)`);
  }

  // ---------- 6. Portfolio opnieuw: is de order gevuld, en met welke niveaus? (vragen 1, 8) ----------
  streep('6. Demo-portfolio opnieuw  -> vultijd, units, openRate, stopLossRate, takeProfitRate');
  // Meteen kijken beantwoordt vraag 8: haalt een marktorder de ~2s-sync?
  const direct = await roep(portfolioPad);
  const naDirect: any[] = (direct.data as any)?.clientPortfolio?.positions ?? [];
  noteer(`posities direct na de order: ${naDirect.length} (was ${posities.length}) -> ${naDirect.length > posities.length ? 'binnen een seconde gevuld' : 'nog niet zichtbaar'} (vraag 8)`);

  await new Promise(r => setTimeout(r, 5000));
  const later = await roep(portfolioPad);
  const naLater: any[] = (later.data as any)?.clientPortfolio?.positions ?? [];
  noteer(`posities na ~5s: ${naLater.length}`);

  const nieuw = naLater.filter(p => !posities.some(o => o.positionID === p.positionID));
  for (const p of nieuw) {
    noteer(`nieuwe positie: positionID=${p.positionID} instrumentID=${p.instrumentID} units=${p.units} openRate=${p.openRate} amount=${p.amount} stopLossRate=${p.stopLossRate} takeProfitRate=${p.takeProfitRate}`);
    if (metNiveaus && (p.stopLossRate === undefined || p.stopLossRate === null || p.stopLossRate === 0)) {
      noteer('LET OP: stopLossRate is meegestuurd maar niet gezet. Dan is bepaalStop alleen adviserend en klopt het stop-loss-verhaal in het plan niet (vraag 1).');
    }
  }
  if (nieuw.length > 1) noteer('MEER DAN ÉÉN nieuwe positie: eToro ontdubbelt NIET op x-request-id (vraag 6).');
  if (DUBBEL && nieuw.length === 1) noteer('Precies één nieuwe positie na twee identieke verzoeken: eToro ontdubbelt wél op x-request-id (vraag 6).');

  // ---------- 7. Bestaat er een endpoint om SL/TP te wijzigen? (blokkeert fase 4) ----------
  // Het plan gaat uit van PATCH /api/v2/trading/positions/{id}, maar dat endpoint staat niet in
  // eToro's gecureerde endpoint-index en de pagina over positie-informatie noemt zichzelf
  // read-only. Als dit niet bestaat, kan SL/TP alleen bij het openen gezet worden en moet fase 4
  // anders (of vervallen).
  //
  // Veilig om te proberen: dit script draait per definitie met een demo-sleutel, en eToro weigert
  // een demo-sleutel op een echt pad. Er kan hier dus niets aan een echt account gebeuren.
  if (PROBEER_PATCH && nieuw.length > 0) {
    streep('7. Bestaat PATCH op een positie?  -> bepaalt of fase 4 gebouwd kan worden');
    const positionId = nieuw[0].positionID;
    const nieuweStop = Math.round(Number(nieuw[0].openRate) * 0.85 * 100) / 100;
    const patchBody = { stopLossRate: nieuweStop, stopLossType: 'fixed' };

    for (const pad of [
      `/trading/demo/positions/${positionId}`,
      `/trading/positions/demo/${positionId}`,
      `/trading/positions/${positionId}`,
    ]) {
      const poging = await roep(pad, { versie: 'v2', methode: 'PATCH', body: patchBody });
      noteer(`PATCH ${pad} -> ${poging.status}`);
      if (poging.status === 202 || (poging.status >= 200 && poging.status < 300)) {
        noteer(`WIJZIGEN KAN: ${pad} accepteerde de PATCH. Zet dit pad in DEMO_PADEN en bouw fase 4.`);
        break;
      }
    }
    noteer('Kreeg geen enkel PATCH-pad een 2xx? Dan bestaat het endpoint waarschijnlijk niet en moet fase 4 heroverwogen worden.');

    const naPatch = await roep(portfolioPad);
    const gewijzigd = ((naPatch.data as any)?.clientPortfolio?.positions ?? []).find((p: any) => p.positionID === positionId);
    noteer(`stopLossRate na de PATCH-pogingen: ${gewijzigd?.stopLossRate} (was ${nieuw[0].stopLossRate}, geprobeerd: ${nieuweStop})`);
  }

  toonBevindingen();
  console.log('\nRuim de demo-positie handmatig op in eToro, of gebruik fase 3 zodra sluitPositie bestaat.');
}

function toonBevindingen() {
  streep('BEVINDINGEN, over te nemen in docs/etoro-direct-handelen-plan.md paragraaf 9');
  bevindingen.forEach((r, i) => console.log(`${i + 1}. ${r}`));
}

main().catch(e => {
  console.error('\nScript gestopt:', e);
  toonBevindingen();
  process.exit(1);
});
