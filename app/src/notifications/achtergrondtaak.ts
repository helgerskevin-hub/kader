import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { checkOpenTrades } from './tradeChecks';

export const TRADE_CHECK_TAAK = 'kader-trade-check';

// Android staat minimaal 15 minuten toe en behandelt dit als een ondergrens, niet als een afspraak:
// het systeem kiest zelf een moment daarna. Vaker vragen dan dit heeft geen zin. Zolang de app open
// staat doet de prijs-poll in PortfolioProvider de check al sneller.
const INTERVAL_MINUTEN = 15;

// defineTask moet op module-niveau staan, niet in een component: als Android de app wakker maakt
// voor deze taak wordt alleen de JS-bundel geladen en moet de taak al gedefinieerd zijn. App.tsx
// importeert dit bestand daarom bovenaan.
TaskManager.defineTask(TRADE_CHECK_TAAK, async () => {
  try {
    await checkOpenTrades();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registreerAchtergrondtaak(): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return false;
    // Al geregistreerd (registratie overleeft een herstart): niet opnieuw, dat zou de wachttijd
    // steeds terugzetten naar nul en de taak dus nooit laten draaien.
    if (await TaskManager.isTaskRegisteredAsync(TRADE_CHECK_TAAK)) return true;
    await BackgroundTask.registerTaskAsync(TRADE_CHECK_TAAK, { minimumInterval: INTERVAL_MINUTEN });
    return true;
  } catch {
    return false;
  }
}

export async function stopAchtergrondtaak(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TRADE_CHECK_TAAK)) {
      await BackgroundTask.unregisterTaskAsync(TRADE_CHECK_TAAK);
    }
  } catch {
    // Niets aan te doen; bij de volgende start proberen we het gewoon opnieuw.
  }
}
