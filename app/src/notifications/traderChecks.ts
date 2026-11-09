// Kijkt of favoriete beleggers een nieuwe trade openden of er een sloten, werkt de Feed bij en
// stuurt de meldingen. Twee aanroepers, net als checkOpenTrades: de voorgrond-poll in CopyProvider
// en de achtergrondtaak. Deze check LEEST alleen en meldt. Hij plaatst nooit een order: kopiëren
// gebeurt uitsluitend na een bevestiging van de gebruiker in de koopsheet.
import { actieveSleutels } from '../state/etoroSleutels';
import { meldingenAan } from '../state/meldingVoorkeur';
import {
  BekendePosities, CopyHerkomst, FeedItem, bewaarBekendePosities, bewaarFeed, bewaarHerkomst,
  bewaarSymboolKaart, inStilleUren, laadBekendePosities, laadFavorieten, laadFeed, laadHerkomst,
  laadInstellingen, laadSymboolKaart, zaaiSymboolKaart,
} from '../state/copyOpslag';
import { directePosities, nieuwePosities, verdwenenPosities, TraderPositie } from '../engine/copyTrading';
import { haalLivePortfolio, vulSymbolenAan } from '../engine/etoroTraders';
import { koersFactor } from '../engine/etoroSymbolen';
import { fmtPrijs } from '../engine/format';
import { SLEUTELS, laadLijst } from '../storage/opslag';
import type { PortfolioTrade } from '../state/portfolioTypes';
import { stuurTradeMelding } from './meldingen';
import { Melding, loggeMeldingen } from './tradeChecks';

// Een positie die de trader al langer open had toen je hem favoriet maakte, is geen nieuws meer.
// Wat in het laatste etmaal opende komt wel in de Feed, zonder melding.
const RECENT_MS = 24 * 60 * 60 * 1000;

// Eén check tegelijk binnen dit JS-proces. Een tweede aanroep wacht niet, hij slaat over: de
// eerste doet hetzelfde werk al.
let bezig = false;

function tijdVan(p: TraderPositie): number | null {
  if (!p.openTimestamp) return null;
  const t = Date.parse(p.openTimestamp);
  return Number.isNaN(t) ? null : t;
}

function naarFeedItem(username: string, p: TraderPositie, symbool: string | null, nu: number): FeedItem {
  return {
    sleutel: `${username}:${p.positionId}`,
    username,
    positionId: p.positionId,
    instrumentId: p.instrumentId,
    symbool,
    isBuy: p.isBuy,
    leverage: typeof p.leverage === 'number' && p.leverage > 0 ? p.leverage : 1,
    openRate: p.openRate,
    stopLossRate: typeof p.stopLossRate === 'number' && p.stopLossRate > 0 ? p.stopLossRate : null,
    takeProfitRate: typeof p.takeProfitRate === 'number' && p.takeProfitRate > 0 ? p.takeProfitRate : null,
    openTijd: tijdVan(p),
    gezien: nu,
    gesloten: false,
    gekopieerd: false,
  };
}

// Kaders koers per coin uit eToro's eenheid (SHIB en PEPE staan bij eToro per miljoen munten).
export function kaderKoers(item: Pick<FeedItem, 'symbool' | 'openRate'>, waarde: number): number {
  return item.symbool ? waarde / koersFactor(item.symbool) : waarde;
}

export interface TraderCheckUitkomst {
  nieuw: number;
  gesloten: number;
  gemeld: number;
}

/**
 * @param opties.melden false = alleen de Feed bijwerken (bijvoorbeeld bij het openen van de tab
 *   terwijl de gebruiker toch al kijkt).
 */
export async function checkFavorieteTraders(opties: { melden?: boolean } = {}): Promise<TraderCheckUitkomst> {
  const leeg = { nieuw: 0, gesloten: 0, gemeld: 0 };
  if (bezig) return leeg;
  bezig = true;
  try {
    const favorieten = await laadFavorieten();
    if (favorieten.length === 0) return leeg;
    const sleutels = await actieveSleutels();
    if (!sleutels) return leeg;

    const nu = Date.now();
    const [bekend, feed, herkomst, instellingen] = await Promise.all([
      laadBekendePosities(), laadFeed(), laadHerkomst(), laadInstellingen(),
    ]);
    let symbolen = await zaaiSymboolKaart(await laadSymboolKaart());

    const volgendeBekend: BekendePosities = { ...bekend };
    const feedPerSleutel = new Map(feed.map(i => [i.sleutel, i]));
    const nieuweTrades: FeedItem[] = [];
    const uitstappen: { item: FeedItem; herkomst: CopyHerkomst }[] = [];
    let gesloten = 0;

    for (const fav of favorieten) {
      let posities: TraderPositie[];
      try {
        posities = directePosities(await haalLivePortfolio(fav.username, sleutels));
      } catch {
        // Deze belegger even niet bereikbaar (of hij schermde zijn portfolio af). Niets aan zijn
        // bekende posities veranderen: anders lijkt alles wat hij open heeft straks nieuw.
        continue;
      }

      try {
        symbolen = await vulSymbolenAan(posities.map(p => p.instrumentId), symbolen, sleutels);
      } catch {
        // Zonder symbool blijft de regel als "buiten Kader" staan tot de volgende ronde.
      }
      const symboolVan = (id: number) => symbolen[String(id)] ?? null;

      const eerder = bekend[fav.username];
      if (!eerder) {
        // Eerste keer voor deze favoriet: alles wat er staat is bekend, en alleen wat in het
        // laatste etmaal opende komt in de Feed. Geen melding.
        for (const p of posities) {
          const t = tijdVan(p);
          if (t !== null && nu - t <= RECENT_MS) {
            const item = naarFeedItem(fav.username, p, symboolVan(p.instrumentId), nu);
            if (!feedPerSleutel.has(item.sleutel)) feedPerSleutel.set(item.sleutel, item);
          }
        }
        volgendeBekend[fav.username] = posities.map(p => p.positionId);
        continue;
      }

      for (const p of nieuwePosities(eerder, posities)) {
        const item = naarFeedItem(fav.username, p, symboolVan(p.instrumentId), nu);
        feedPerSleutel.set(item.sleutel, item);
        nieuweTrades.push(item);
      }

      for (const id of verdwenenPosities(eerder, posities)) {
        const sleutel = `${fav.username}:${id}`;
        const item = feedPerSleutel.get(sleutel);
        if (item && !item.gesloten) {
          feedPerSleutel.set(sleutel, { ...item, gesloten: true });
          gesloten++;
        }
        const h = herkomst.find(x => x.username === fav.username && x.bronPositieId === id && !x.uitstapGemeld);
        if (h && item) uitstappen.push({ item, herkomst: h });
      }

      volgendeBekend[fav.username] = posities.map(p => p.positionId);
    }

    // Wie geen favoriet meer is, verliest zijn bekende posities. Wordt hij later weer favoriet, dan
    // geldt het als een eerste keer (stil vastleggen) en komen niet al zijn tussentijdse trades
    // als nieuw binnen.
    for (const naam of Object.keys(volgendeBekend)) {
      if (!favorieten.some(f => f.username === naam)) delete volgendeBekend[naam];
    }

    // Tijdens het ophalen kan de gebruiker een trade gekopieerd hebben (markeerGekopieerd). Die
    // markering staat alleen in de verse opslag; zonder dit overschrijft de oude lezing hem en komt
    // de Kopieer-knop terug.
    for (const vers of await laadFeed()) {
      const item = feedPerSleutel.get(vers.sleutel);
      if (vers.gekopieerd && item && !item.gekopieerd) feedPerSleutel.set(vers.sleutel, { ...item, gekopieerd: true });
    }

    // Eerst vastleggen wat bekend is, dan pas melden: een tweede ronde (de achtergrondtaak naast de
    // voorgrond) ziet deze trades dan niet nog eens als nieuw.
    await Promise.all([
      bewaarBekendePosities(volgendeBekend),
      bewaarFeed([...feedPerSleutel.values()]),
      bewaarSymboolKaart(symbolen),
    ]);

    // Een uitstap telt alleen als jouw kopie nog open staat.
    const eigen = await laadLijst<PortfolioTrade>(SLEUTELS.portfolio);
    const openIds = new Set(
      eigen.filter(t => t.status === 'open' && typeof t.etoroPositionID === 'number').map(t => t.etoroPositionID as number),
    );
    const echteUitstappen = uitstappen.filter(u =>
      typeof u.herkomst.etoroPositionID === 'number' && openIds.has(u.herkomst.etoroPositionID));

    const mogen = opties.melden !== false
      && instellingen.meldingen
      && !(instellingen.stilleUren && inStilleUren())
      && await meldingenAan();

    const meldingen: Melding[] = [];
    // Alleen wat je ook echt kunt kopiëren: long, in een Kader-coin, en nog open.
    for (const item of nieuweTrades.filter(i => i.isBuy && i.symbool && !i.gesloten)) {
      const instap = fmtPrijs(kaderKoers(item, item.openRate));
      const stop = item.stopLossRate ? ` · stop ${fmtPrijs(kaderKoers(item, item.stopLossRate))}` : '';
      const doel = item.takeProfitRate ? ` · doel ${fmtPrijs(kaderKoers(item, item.takeProfitRate))}` : '';
      meldingen.push({
        sleutel: `copy:${item.sleutel}`,
        doel: { soort: 'copy', sleutel: item.sleutel },
        titel: `${item.username} kocht ${item.symbool}`,
        tekst: `Long op ${instap}${stop}${doel}. Tik om te kopiëren.`,
      });
    }
    for (const u of echteUitstappen) {
      meldingen.push({
        sleutel: `uitstap:${u.item.sleutel}`,
        doel: { soort: 'copy' },
        titel: `${u.item.username} is uit ${u.item.symbool ?? 'een positie'} gestapt`,
        tekst: 'Jij hebt deze trade ook. Tik om je positie te bekijken.',
      });
    }

    let gemeld = 0;
    if (mogen && meldingen.length > 0) {
      const titel = meldingen.length === 1 ? meldingen[0].titel : bundelTitel(meldingen);
      const tekst = meldingen.length === 1 ? meldingen[0].tekst : 'Open Copy voor de details.';
      // Eén melding: tikken opent de trade direct als het er één is, anders de Feed.
      const doel = meldingen.length === 1 ? meldingen[0].doel : { soort: 'copy' as const };
      if (await stuurTradeMelding(titel, tekst, doel)) {
        gemeld = meldingen.length;
        await loggeMeldingen(meldingen, nu);
      }
    }

    // De uitstap is ook gezien als er niet gemeld mocht worden (stille uren): anders komt hij om
    // 07:00 alsnog binnen, terwijl de positie dan al lang anders kan staan.
    if (echteUitstappen.length > 0) {
      const gezien = new Set(echteUitstappen.map(u => u.herkomst.verzoekId));
      // Vers lezen: een kopie die tijdens deze ronde startte staat niet in `herkomst` van daarnet.
      const vers = await laadHerkomst();
      await bewaarHerkomst(vers.map(h => (gezien.has(h.verzoekId) ? { ...h, uitstapGemeld: true } : h)));
    }

    return { nieuw: nieuweTrades.length, gesloten, gemeld };
  } finally {
    bezig = false;
  }
}

function bundelTitel(meldingen: Melding[]): string {
  const alleenKopen = meldingen.every(m => m.sleutel.startsWith('copy:'));
  const namen = [...new Set(meldingen.map(m => m.titel.split(' ')[0]))];
  if (alleenKopen && namen.length === 1) return `${namen[0]} opende ${meldingen.length} trades`;
  if (alleenKopen) return `${meldingen.length} nieuwe trades van je favorieten`;
  return `${meldingen.length} meldingen van je favorieten`;
}
