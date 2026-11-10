// Het handelskapitaal zonder React: los te lezen door schermen die het alleen bij openen nodig
// hebben, en door de widget op de achtergrond. Uitleg over de bron staat in useHandelskapitaal.ts.
import { laadTekst, SLEUTELS } from '../storage/opslag';
import { haalOmgeving, heeftEnigeSleutel } from './etoroSleutels';
import { AutoKapitaal, laadAutoKapitaal } from './autoKapitaal';

export async function laadHandmatig(): Promise<number | null> {
  const tekst = await laadTekst(SLEUTELS.handelskapitaal, '');
  const waarde = Number(tekst);
  return tekst !== '' && Number.isFinite(waarde) && waarde > 0 ? waarde : null;
}

export const bruikbaar = (auto: AutoKapitaal | undefined): auto is AutoKapitaal => !!auto && auto.totaalUsd > 0;

// Los te lezen, voor schermen die het kapitaal alleen nodig hebben op het moment dat ze opengaan
// (de kooporder) en niet de hele hook willen.
export async function laadHandelskapitaal(): Promise<number | null> {
  const [gekoppeld, omgeving, auto] = await Promise.all([
    heeftEnigeSleutel().catch(() => false),
    haalOmgeving().catch(() => 'demo' as const),
    laadAutoKapitaal(),
  ]);
  const vanEtoro = auto[omgeving];
  if (gekoppeld && bruikbaar(vanEtoro)) return vanEtoro.totaalUsd;
  return laadHandmatig();
}
