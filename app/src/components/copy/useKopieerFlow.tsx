// Van "Kopieer" op een trade naar een vooringevulde koopsheet. Hergebruikt de bestaande
// KooporderSheet met al zijn veiligheden (saldo, stopcontrole bij eToro, verliesrem, demo/echt,
// onbekende uitkomsten). Er komt dus geen tweede orderpad bij.
//
// Vlak voor het openen kijkt Kader opnieuw: verse koers, de koersverschuivingscheck en de niveaus.
// Een trade die op de kaart nog kopieerbaar leek maar intussen is weggelopen, opent dus niet.
import React, { useCallback, useRef, useState } from 'react';
import { KooporderSheet } from '../KooporderSheet';
import { useCopy } from '../../state/CopyProvider';
import { useDialoog } from '../../state/DialoogProvider';
import { haalKaderNiveaus } from '../../state/kaderNiveaus';
import { useCopyPlafond } from '../../state/useCopyPlafond';
import type { FeedItem } from '../../state/copyOpslag';
import { beoordeelCopyTrade, copyNiveaus, TraderPositie } from '../../engine/copyTrading';
import { haalLaatstePrijs } from '../../engine/marketData';
import { koersFactor } from '../../engine/etoroSymbolen';
import { COIN_INFO } from '../../engine/coinInfo';
import { fmtPct } from '../../engine/format';

interface Open {
  item: FeedItem;
  entry: number;
  stop: number;
  doel: number;
}

export function useKopieerFlow(onVerlaatScherm?: () => void) {
  const { bedragVoor, noteerKopie, feed } = useCopy();
  // De nieuwste Feed, zodat de laatste controle ziet of de trader intussen uitstapte.
  const feedRef = useRef(feed);
  feedRef.current = feed;
  const { toonDialoog } = useDialoog();
  const { waarschuwing } = useCopyPlafond();
  const [open, setOpen] = useState<Open | null>(null);
  const [zichtbaar, setZichtbaar] = useState(false);
  const [bezigSleutel, setBezigSleutel] = useState<string | null>(null);
  const loopt = useRef(false);

  const melding = (titel: string, tekst: string) =>
    toonDialoog({ variant: 'informatie', titel, tekst, knoppen: [{ label: 'Oké' }] });

  async function start(item: FeedItem) {
    if (!item.symbool || loopt.current) return;
    loopt.current = true;
    setBezigSleutel(item.sleutel);
    try {
      const symbool = item.symbool;
      const factor = koersFactor(symbool);
      const kader = await haalKaderNiveaus(symbool);
      const koers = (await haalLaatstePrijs(symbool)) ?? kader?.koers ?? null;
      if (koers === null) {
        melding('Geen koers', `Kader kan de koers van ${symbool} nu niet ophalen. Probeer het zo opnieuw.`);
        return;
      }

      const positie = naarPositie(item, factor);
      const bezwaar = bezwaarTegen(item, positie, symbool, koers);
      if (bezwaar) {
        melding(bezwaar.titel, bezwaar.tekst);
        return;
      }

      // positie.openRate staat al in Kaders eenheid, dus factor 1 voor de niveaus van de trader die
      // hier nog in eToro's eenheid staan: die rekent copyNiveaus zelf om.
      const niveaus = copyNiveaus({
        positie: { ...positie, openRate: item.openRate },
        factor,
        koers,
        kaderStop: kader?.stop ?? null,
        kaderDoel: kader?.doel ?? null,
      });
      if (niveaus.stop === null || niveaus.doel === null) {
        melding('Geen kader', `Kader kan voor ${symbool} nu geen stop en doel bepalen. Zonder stop kopieert Kader niet.`);
        return;
      }

      setOpen({ item, entry: koers, stop: niveaus.stop, doel: niveaus.doel });
      setZichtbaar(true);
    } finally {
      loopt.current = false;
      setBezigSleutel(null);
    }
  }

  const sheet = open ? (
    <KooporderSheet
      zichtbaar={zichtbaar}
      onSluiten={() => setZichtbaar(false)}
      symbool={open.item.symbool as string}
      naam={COIN_INFO[open.item.symbool as string]?.naam ?? (open.item.symbool as string)}
      entry={open.entry}
      stop={open.stop}
      doel={open.doel}
      // Het eigen bedrag van deze trader als hij er een heeft; je bevestigt het in de sheet.
      startBedrag={bedragVoor(open.item.username)}
      geluktTitel={`Kopie van ${open.item.username} staat bij eToro`}
      onGelukt={({ verzoekId, omgeving }) => { noteerKopie(open.item, verzoekId, omgeving).catch(() => {}); }}
      onOnzeker={({ verzoekId, omgeving }) => { noteerKopie(open.item, verzoekId, omgeving).catch(() => {}); }}
      controleerVoorVersturen={() => controleerOpnieuw(open.item, feedRef.current)}
      waarschuwing={waarschuwing}
      onVerlaatScherm={onVerlaatScherm}
    />
  ) : null;

  // Stabiel: start zelf is elke render nieuw (hij leest de verse context), maar de kaarten in de
  // lijst zijn gememood en moeten bij een koers-poll niet allemaal opnieuw tekenen.
  const startRef = useRef(start);
  startRef.current = start;
  const startStabiel = useCallback((item: FeedItem) => { startRef.current(item).catch(() => {}); }, []);

  return { start: startStabiel, sheet, bezigSleutel };
}

function naarPositie(item: FeedItem, factor: number): TraderPositie {
  return {
    positionId: item.positionId,
    instrumentId: item.instrumentId,
    openRate: item.openRate / factor,
    isBuy: item.isBuy,
    stopLossRate: item.stopLossRate ?? undefined,
    takeProfitRate: item.takeProfitRate ?? undefined,
  };
}

// Waarom deze trade nu niet (meer) te kopiëren is, of null als het kan.
function bezwaarTegen(item: FeedItem, positie: TraderPositie, symbool: string, koers: number): { titel: string; tekst: string } | null {
  const factor = koersFactor(symbool);
  const traderStop = item.stopLossRate ? item.stopLossRate / factor : null;
  const stand = beoordeelCopyTrade({ positie, symbool, koers, stop: traderStop, gesloten: item.gesloten });
  if (stand.soort === 'kopieerbaar') return null;
  if (stand.soort === 'te-laat') {
    return {
      titel: 'Te laat',
      tekst: `De koers staat ${fmtPct(stand.verschuivingPct)} ten opzichte van de instap van ${item.username}. Kader kopieert deze trade niet meer.`,
    };
  }
  return {
    titel: 'Niet te kopiëren',
    tekst: stand.soort === 'onder-stop'
      ? 'De koers staat al onder de stop van de trader.'
      : stand.soort === 'gesloten' ? `${item.username} heeft deze positie al gesloten.`
      : 'Deze trade kan Kader niet kopiëren.',
  };
}

// Vlak voor het versturen nog een keer: de sheet kan minuten openstaan terwijl de koers wegloopt of
// de trader uitstapt. Zonder verse koers gaat er niets de deur uit; liever geen kopie dan een te late.
async function controleerOpnieuw(item: FeedItem, feed: FeedItem[]): Promise<string | null> {
  const symbool = item.symbool;
  if (!symbool) return 'Deze trade kan Kader niet kopiëren.';
  const actueel = feed.find(i => i.sleutel === item.sleutel) ?? item;
  let koers: number | null = null;
  try {
    koers = await haalLaatstePrijs(symbool);
  } catch {
    koers = null;
  }
  if (koers === null) return `Kader kan de koers van ${symbool} nu niet controleren. Probeer het zo opnieuw.`;
  const bezwaar = bezwaarTegen(actueel, naarPositie(actueel, koersFactor(symbool)), symbool, koers);
  return bezwaar ? bezwaar.tekst : null;
}
