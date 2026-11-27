import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { MeldingDoel } from './meldingDoel';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Vaste identifier voor de dagelijkse herinnering, voor determinisme bij het inplannen.
const DAGELIJKSE_ID = 'dagelijkse-herinnering';

// Vaste identifier voor de trade-meldingen. Expo mapt de identifier op de Android-notificatietag,
// dus een nieuwe melding vervangt de vorige in de balk in plaats van erbovenop te stapelen. Zonder
// dit stond er na een nacht achtergrondtaken een stapel klaar bij het openen van de app. De melding
// verwijst voor details toch naar de app, dus een overschreven oudere kost geen informatie.
const TRADE_MELDING_ID = 'trade-melding';

// Wat het vergrendelscherm van een trade-melding laat zien: geen coin, koers, bedrag of trader. De
// melding zelf gaat met Android's VISIBILITY_PRIVATE uit en draagt deze tekst als publicVersion; na
// het ontgrendelen staat de volledige tekst in de meldingenbalk. expo-notifications kan dat niet per
// melding, dus de lokale module kader-meldingen (modules/kader-meldingen) hangt het er bij het tonen
// aan. Hij herkent de melding aan dit veld in de data. Staat Android op "Alle meldingsinhoud tonen"
// (de standaard), dan zou PRIVATE de inhoud toch laten zien; de module maakt de melding dan SECRET:
// niet op het vergrendelscherm, wel in de balk na het ontgrendelen. Zie docs/vergrendeling-ontwerp.md.
const VERGRENDELSCHERM = {
  titel: 'Kader',
  tekst: 'Nieuwe melding over je posities. Ontgrendel om hem te zien.',
};

// De kanalen zoals ze altijd waren. 0.5.0 maakte daarnaast 'trades-afgeschermd' en
// 'dagelijks-afgeschermd' aan voor als het slot aan stond; die worden niet meer gebruikt, maar blijven
// bij wie ze al heeft in de systeeminstellingen staan (Android wist een kanaal alleen op verzoek, en
// de gebruiker kan er instellingen op gezet hebben).
const KANAAL_DAGELIJKS = 'dagelijks';
const KANAAL_TRADES = 'trades';

// Kader rekent met openbare marktdata, eToro met een eigen koers plus spread. Daarom zegt de
// disclaimer waarom je moet kijken en niet alleen dat je moet kijken.
const DISCLAIMER = 'Geen financieel advies. De koers op eToro kan afwijken.';

async function zorgVoorPermissie(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Setten van een bestaand kanaal is onschuldig; Android werkt dan alleen de naam bij. De dagelijkse
// herinnering heeft een vaste tekst zonder posities of bedragen en heeft dus geen afscherming nodig.
async function zorgVoorDagelijksKanaal(): Promise<string> {
  await Notifications.setNotificationChannelAsync(KANAAL_DAGELIJKS, {
    name: 'Dagelijkse marktanalyse',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  return KANAAL_DAGELIJKS;
}

export async function stelDagelijkseMeldingIn(uur = 9, minuut = 0): Promise<boolean> {
  const kanaal = Platform.OS === 'android' ? await zorgVoorDagelijksKanaal() : null;

  // Wist ook een dagelijkse melding die een oudere app-versie ooit onder een andere identifier
  // insplande: die werd door cancelScheduledNotificationAsync(DAGELIJKSE_ID) nooit geraakt en bleef
  // elke ochtend naast de nieuwe afgaan. Trade-meldingen bezorgen direct (zie stuurTradeMelding) en
  // staan dus nooit in de wachtrij, dit raakt ze niet.
  // ponytail: cancelAll werkt zolang de dagelijkse herinnering de enige herhalende melding is; komt
  // er een tweede bij, dan enumereren via getAllScheduledNotificationsAsync en gericht filteren.
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!await zorgVoorPermissie()) return false;

  await Notifications.scheduleNotificationAsync({
    identifier: DAGELIJKSE_ID,
    content: {
      title: 'Het kader van vandaag staat klaar',
      body: `Open Kader voor de signalen van vandaag. ${DISCLAIMER}`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      // Zonder channelId belandt de melding op expo's fallback-kanaal en heeft het kanaal dat we
      // hierboven aanmaken geen enkel effect: de gebruiker kan 'm dan niet apart uitzetten.
      ...(kanaal ? { channelId: kanaal } : {}),
      hour: uur,
      minute: minuut,
    },
  });

  return true;
}

// Eigen kanaal voor trade-meldingen: die zijn tijdgevoelig (je doel komt in zicht, je momentum
// vlakt af) en mogen dus opvallender binnenkomen dan de dagelijkse herinnering.
async function zorgVoorTradeKanaal(): Promise<string> {
  await Notifications.setNotificationChannelAsync(KANAAL_TRADES, {
    name: 'Trades en posities',
    importance: Notifications.AndroidImportance.HIGH,
  });
  return KANAAL_TRADES;
}

// Stuurt een melding direct. De disclaimer wordt hier aangeplakt zodat geen enkele aanroeper 'm
// kan vergeten. Op het vergrendelscherm staat alleen VERGRENDELSCHERM (zie boven).
//
// De trigger bepaalt het kanaal, niet de content: een trigger met alleen een channelId is expo's
// ChannelAwareTriggerInput, die direct bezorgt én op het juiste kanaal landt. Met `trigger: null`
// kan dat niet en valt de melding terug op expo's fallback-kanaal.
//
// `doel` gaat mee in de data van de melding, zodat een tik erop in de app op de juiste plek uitkomt
// (zie NavigatieProvider in state/navigatie.tsx). Zonder doel opent een tik gewoon de app. Kader's
// eigen app-slot vraagt daarna nog steeds om de pincode.
export async function stuurTradeMelding(titel: string, tekst: string, doel?: MeldingDoel): Promise<boolean> {
  if (!await zorgVoorPermissie()) return false;
  const kanaal = Platform.OS === 'android' ? await zorgVoorTradeKanaal() : null;
  await Notifications.scheduleNotificationAsync({
    identifier: TRADE_MELDING_ID,
    content: {
      title: titel,
      body: `${tekst} ${DISCLAIMER}`,
      data: { vergrendelscherm: VERGRENDELSCHERM, ...(doel ? { doel } : {}) },
    },
    trigger: kanaal ? { channelId: kanaal } : null,
  });
  return true;
}

// Wist alles wat er bij Android in de wachtrij staat, vandaag alleen de dagelijkse herinnering.
// Nodig voor de meldingen-uit-schakelaar: die herinnering is al ingepland en gaat af zonder dat de
// app er nog aan te pas komt, dus een vlag zetten is niet genoeg.
export async function wisAlleGeplandeMeldingen(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
