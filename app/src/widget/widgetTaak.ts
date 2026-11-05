// Wat er gebeurt als Android zelf iets van de widget wil: hij is net neergezet, vergroot, of het is
// tijd voor de periodieke verversing (elk half uur, zie updatePeriodMillis in app.json). Android
// laadt daarvoor alleen de JS-bundel, zonder scherm; index.ts registreert deze handler daarom op
// module-niveau.
//
// Een tik hoeft hier niet langs: die opent via OPEN_URI meteen de app (zie KaderWidget).

import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { laadWidgetInhoud, ververWidgetMetVerseKoersen, widgetVoor } from './widgetVerversen';

export async function widgetTaak({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction !== 'WIDGET_ADDED' && widgetAction !== 'WIDGET_UPDATE' && widgetAction !== 'WIDGET_RESIZED') return;

  // Eerst meteen tekenen met wat er bewaard is, zodat de widget nooit leeg staat te wachten op het
  // netwerk.
  const { stand, bedragen } = await laadWidgetInhoud();
  renderWidget(widgetVoor(stand, bedragen, widgetInfo.width));

  // Bij vergroten veranderen de cijfers niet, alleen de opmaak.
  if (widgetAction === 'WIDGET_RESIZED') return;
  try {
    await ververWidgetMetVerseKoersen();
  } catch {
    // Geen netwerk: de bewaarde stand blijft staan, met zijn eigen tijd erbij.
  }
}
