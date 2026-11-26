// Alles wat de Android-widget bijwerkt. De app (PortfolioProvider), de achtergrondtaak en de
// widget-taak van Android komen allemaal hier uit: rekenen gebeurt in state/widgetStand.ts, de
// uitkomst wordt bewaard, en de widget tekent alleen wat er bewaard is.

import React from 'react';
import { getWidgetInfo, requestWidgetUpdate, type WidgetRepresentation } from 'react-native-android-widget';
import { KaderWidget } from './KaderWidget';
import { WidgetStand, berekenWidgetStand, hoortBijWidget } from '../state/widgetStand';
import type { PortfolioTrade } from '../state/portfolioTypes';
import type { EtoroOmgeving } from '../engine/etoro';
import { haalLaatstePrijzen } from '../engine/marketData';
import { haalOmgeving } from '../state/etoroSleutels';
import { laadLijst, laadObject, bewaarObject, SLEUTELS } from '../storage/opslag';
import { WidgetWeergave, laadWidgetWeergave } from '../state/widgetWeergave';
import { bruikbaar, laadHandmatig } from '../state/handelskapitaal';
import { laadAutoKapitaal } from '../state/autoKapitaal';
import { heeftEnigeSleutel } from '../state/etoroSleutels';
import { slotStaatAan } from '../state/slotOpslag';
import { berekenPortfolioWaarde } from '../state/statistieken';
import { lightTokens, darkTokens } from '../theme/tokens';

// Moet gelijk zijn aan de naam in de plugin-instelling in app.json.
export const WIDGET_NAAM = 'KaderPortfolio';

// Een tik op de widget opent deze link; NavigatieProvider stuurt hem naar het Portfolio-tabblad.
// Het schema staat als "scheme" in app.json.
export const WIDGET_URI = 'kader://portfolio';

// Wat de widget tekent. Staat het slot aan (slotStaatAan, fail-closed), dan komt de bewaarde stand
// er niet uit: vergrendeld is true en stand null, zodat geen enkele weergave hem kan tonen. De stand
// blijft wel bewaard; zodra het slot uit gaat tekent de widget hem weer.
export interface WidgetInhoud {
  stand: WidgetStand | null;
  weergave: WidgetWeergave;
  vergrendeld: boolean;
}

export async function laadWidgetInhoud(): Promise<WidgetInhoud> {
  const vergrendeld = await slotStaatAan();
  const [stand, weergave] = await Promise.all([
    vergrendeld ? Promise.resolve(null) : laadObject<WidgetStand>(SLEUTELS.widgetStand),
    laadWidgetWeergave(),
  ]);
  return { stand, weergave, vergrendeld };
}

// Licht en donker tegelijk: Android kiest zelf welke hij toont, naar het systeemthema.
export function widgetVoor({ stand, weergave, vergrendeld }: WidgetInhoud, breedte: number): WidgetRepresentation {
  const nu = Date.now();
  const gedeeld = { stand: vergrendeld ? null : stand, weergave, breedte, nu, uri: WIDGET_URI, vergrendeld };
  return {
    light: React.createElement(KaderWidget, { ...gedeeld, kleuren: lightTokens }),
    dark: React.createElement(KaderWidget, { ...gedeeld, kleuren: darkTokens }),
  };
}

// Tekent elke Kader-widget op het startscherm opnieuw met wat er bewaard is. Staat er geen, dan
// gebeurt er niets.
export async function tekenWidgets(): Promise<void> {
  try {
    const inhoud = await laadWidgetInhoud();
    await requestWidgetUpdate({
      widgetName: WIDGET_NAAM,
      renderWidget: info => widgetVoor(inhoud, info.width),
    });
  } catch {
    // Geen widget-module (bijvoorbeeld een oude dev-build): niets te tekenen.
  }
}

// Na het aan- of uitzetten van het slot (pincode ingesteld of gewist). Via de rij hieronder: een
// ronde van werkWidgetBij die de slotstatus nog van vóór de wijziging las, tekent eerst; deze
// tekening komt daarna en leest de nieuwe status. Zonder de rij kon zo'n late ronde na het aanzetten
// de posities nog over de vergrendelde widget heen zetten.
export function tekenWidgetsNaSlotWijziging(): Promise<void> {
  rij = rij.then(tekenWidgets).catch(() => {});
  return rij;
}

export async function heeftWidgets(): Promise<boolean> {
  try {
    return (await getWidgetInfo(WIDGET_NAAM)).length > 0;
  } catch {
    return false;
  }
}

// Het vermogen van nu, zoals de statuskaart op Portfolio het telt: vrij saldo (met wat er in
// wachtende orders vastzit) plus CopyTrader-geld plus je eToro-posities tegen de koers van nu.
// Niet het totaal uit de laatste sync: dat zet de posities op kostprijs met eToro's ongerealiseerde
// resultaat van dat moment, en loopt dus achter op wat de widget eronder als resultaat toont.
// Zonder eToro-koppeling het handmatig ingevulde kapitaal, dat is geen live getal.
async function vermogenNu(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
  omgeving: EtoroOmgeving,
): Promise<number | null> {
  const [gekoppeld, auto] = await Promise.all([heeftEnigeSleutel().catch(() => false), laadAutoKapitaal()]);
  const stand = auto[omgeving];
  if (!gekoppeld || !bruikbaar(stand)) return laadHandmatig();
  const posities = berekenPortfolioWaarde(trades, livePrijzen, { etoroOmgeving: omgeving }).huidigeWaardeUsd;
  return Math.max(0, stand.vrijUsd) + Math.max(0, stand.inCopiesUsd) + Math.max(0, posities);
}

async function berekenBewaarTeken(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
  omgeving: EtoroOmgeving,
): Promise<void> {
  // Het vermogen is extra: lukt het lezen niet, dan toont de widget het gewoon niet.
  const vermogen = await vermogenNu(trades, livePrijzen, omgeving).catch(() => null);
  const stand = berekenWidgetStand(trades, livePrijzen, omgeving, Date.now(), vermogen);
  if (stand.aantalOpen > 0 && stand.metKoers === 0) {
    // Nog geen enkele koers (net opgestart, of geen netwerk): dan is de vorige stand van deze
    // omgeving beter dan een lege. Die draagt zijn eigen tijd, dus de widget zegt hoe oud hij is.
    const oud = await laadObject<WidgetStand>(SLEUTELS.widgetStand);
    if (oud && oud.omgeving === omgeving) {
      await tekenWidgets();
      return;
    }
  }
  await bewaarObject(SLEUTELS.widgetStand, stand);
  await tekenWidgets();
}

// Eén tegelijk, in volgorde van aanroepen: anders kan een tragere oude ronde een nieuwere stand
// overschrijven.
let rij: Promise<void> = Promise.resolve();

export function werkWidgetBij(
  trades: PortfolioTrade[],
  livePrijzen: Record<string, number>,
  omgeving: EtoroOmgeving,
): Promise<void> {
  rij = rij.then(() => berekenBewaarTeken(trades, livePrijzen, omgeving)).catch(() => {});
  return rij;
}

// Voor buiten de app (achtergrondtaak, Android's eigen widget-verversing): verse koersen voor de
// open posities in de actieve omgeving en dan bijwerken. Zonder widget op het startscherm geen
// netwerkverkeer. Ook niet zolang het slot aan staat: de widget toont dan toch geen cijfers, alleen
// opnieuw de vergrendelde weergave.
export async function ververWidgetMetVerseKoersen(): Promise<void> {
  if (!(await heeftWidgets())) return;
  if (await slotStaatAan()) {
    await tekenWidgets();
    return;
  }
  const [trades, omgeving] = await Promise.all([laadLijst<PortfolioTrade>(SLEUTELS.portfolio), haalOmgeving()]);
  const symbolen = [...new Set(
    trades.filter(t => t.status === 'open' && hoortBijWidget(t, omgeving)).map(t => t.symbool),
  )];
  const koersen = symbolen.length > 0 ? await haalLaatstePrijzen(symbolen) : {};
  await werkWidgetBij(trades, koersen, omgeving);
}
