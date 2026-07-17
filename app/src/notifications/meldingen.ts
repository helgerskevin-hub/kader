import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Vaste identifier voor de dagelijkse herinnering. Zonder deze zouden we 'm alleen kwijt kunnen
// via cancelAllScheduledNotificationsAsync, en dat wist ook alles wat de trade-meldingen plannen.
const DAGELIJKSE_ID = 'dagelijkse-herinnering';

// Vaste identifier voor de trade-meldingen. Expo mapt de identifier op de Android-notificatietag,
// dus een nieuwe melding vervangt de vorige in de balk in plaats van erbovenop te stapelen. Zonder
// dit stond er na een nacht achtergrondtaken een stapel klaar bij het openen van de app. De melding
// verwijst voor details toch naar de app, dus een overschreven oudere kost geen informatie.
const TRADE_MELDING_ID = 'trade-melding';

const KANAAL_DAGELIJKS = 'dagelijks';
const KANAAL_TRADES = 'trades';

const DISCLAIMER = 'Geen financieel advies, check altijd de live koers op eToro.';

async function zorgVoorPermissie(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function stelDagelijkseMeldingIn(uur = 9, minuut = 0): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(KANAAL_DAGELIJKS, {
      name: 'Dagelijkse marktanalyse',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  if (!await zorgVoorPermissie()) return false;

  await Notifications.cancelScheduledNotificationAsync(DAGELIJKSE_ID).catch(() => {
    // Nog niet ingepland bij een eerste start: geen fout, gewoon doorgaan.
  });
  await Notifications.scheduleNotificationAsync({
    identifier: DAGELIJKSE_ID,
    content: {
      title: 'Tijd voor je marktanalyse',
      body: `Open de app voor de signalen van vandaag. ${DISCLAIMER}`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      // Zonder channelId belandt de melding op expo's fallback-kanaal en heeft het kanaal dat we
      // hierboven aanmaken geen enkel effect: de gebruiker kan 'm dan niet apart uitzetten.
      ...(Platform.OS === 'android' ? { channelId: KANAAL_DAGELIJKS } : {}),
      hour: uur,
      minute: minuut,
    },
  });

  return true;
}

// Eigen kanaal voor trade-meldingen: die zijn tijdgevoelig (je doel komt in zicht, je momentum
// vlakt af) en mogen dus opvallender binnenkomen dan de dagelijkse herinnering.
export async function zorgVoorTradeKanaal(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(KANAAL_TRADES, {
    name: 'Trades en koopsignalen',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

// Stuurt een melding direct. De disclaimer wordt hier aangeplakt zodat geen enkele aanroeper 'm
// kan vergeten.
//
// De trigger bepaalt het kanaal, niet de content: een trigger met alleen een channelId is expo's
// ChannelAwareTriggerInput, die direct bezorgt én op het juiste kanaal landt. Met `trigger: null`
// kan dat niet en valt de melding terug op expo's fallback-kanaal.
export async function stuurTradeMelding(titel: string, tekst: string): Promise<boolean> {
  if (!await zorgVoorPermissie()) return false;
  await zorgVoorTradeKanaal();
  await Notifications.scheduleNotificationAsync({
    identifier: TRADE_MELDING_ID,
    content: {
      title: titel,
      body: `${tekst} ${DISCLAIMER}`,
    },
    trigger: Platform.OS === 'android' ? { channelId: KANAAL_TRADES } : null,
  });
  return true;
}
