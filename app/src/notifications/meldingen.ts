import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { MeldingDoel } from './meldingDoel';
import { slotStaatAan } from '../state/slotOpslag';

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

// Twee kanalen per soort melding: het oude voor als het app-slot uit staat, een afgeschermd kanaal
// voor als het aan staat. Per melding kiest kanaalVoor op het moment van versturen (of inplannen).
//
// Waarom nieuwe kanalen: Android neemt een gewijzigde lockscreenVisibility van een bestaand kanaal
// niet over (na het aanmaken zijn alleen naam en beschrijving nog te wijzigen). De oude kanalen
// 'dagelijks' en 'trades' blijven daarom staan en houden hun functie voor slot uit; zo blijven ook
// de instellingen die de gebruiker er zelf op zette (geluid, belang, uit) gewoon gelden.
//
// Waarom SECRET en niet PRIVATE: bij VISIBILITY_PRIVATE toont Android op een beveiligd
// vergrendelscherm alsnog de volledige inhoud zolang de systeeminstelling "Alle meldingsinhoud
// tonen" aan staat, en dat is op de meeste toestellen de standaard. Alleen met "Gevoelige inhoud
// verbergen" verschijnt dan "Inhoud verborgen". Dat zou bij de standaardinstelling dus niets
// afschermen. VISIBILITY_SECRET laat de melding op een beveiligd vergrendelscherm helemaal weg;
// na het ontgrendelen van de telefoon staat hij gewoon in de meldingenbalk. Een pincode instellen
// kan alleen met een schermslot, dus het vergrendelscherm is altijd beveiligd als dit kanaal gekozen
// wordt.
const KANAAL_DAGELIJKS = 'dagelijks';
const KANAAL_TRADES = 'trades';
const KANAAL_DAGELIJKS_AFGESCHERMD = 'dagelijks-afgeschermd';
const KANAAL_TRADES_AFGESCHERMD = 'trades-afgeschermd';
const ZICHTBAAR_MET_SLOT = Notifications.AndroidNotificationVisibility.SECRET;

// Het afgeschermde kanaal als het slot aan staat, en ook bij twijfel: slotStaatAan geeft bij een
// kluisfout of leesfout true. Alleen 'geen pincode en hint uit' geeft het gewone kanaal.
async function slotAan(): Promise<boolean> {
  return slotStaatAan().catch(() => true);
}

// Kader rekent met openbare marktdata, eToro met een eigen koers plus spread. Daarom zegt de
// disclaimer waarom je moet kijken en niet alleen dat je moet kijken.
const DISCLAIMER = 'Geen financieel advies. De koers op eToro kan afwijken.';

async function zorgVoorPermissie(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Maakt het kanaal voor de dagelijkse herinnering aan en geeft zijn id: afgeschermd als het slot aan
// staat. Setten van een bestaand kanaal is onschuldig; Android werkt dan alleen de naam bij.
async function zorgVoorDagelijksKanaal(): Promise<string> {
  if (await slotAan()) {
    await Notifications.setNotificationChannelAsync(KANAAL_DAGELIJKS_AFGESCHERMD, {
      name: 'Dagelijkse marktanalyse (met slot)',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: ZICHTBAAR_MET_SLOT,
    });
    return KANAAL_DAGELIJKS_AFGESCHERMD;
  }
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
// vlakt af) en mogen dus opvallender binnenkomen dan de dagelijkse herinnering. Geeft de id van het
// kanaal dat nu geldt: afgeschermd als het slot aan staat (of bij twijfel), anders het gewone.
export async function zorgVoorTradeKanaal(): Promise<string> {
  if (await slotAan()) {
    await Notifications.setNotificationChannelAsync(KANAAL_TRADES_AFGESCHERMD, {
      name: 'Trades en posities (met slot)',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: ZICHTBAAR_MET_SLOT,
    });
    return KANAAL_TRADES_AFGESCHERMD;
  }
  await Notifications.setNotificationChannelAsync(KANAAL_TRADES, {
    name: 'Trades en posities',
    importance: Notifications.AndroidImportance.HIGH,
  });
  return KANAAL_TRADES;
}

// Stuurt een melding direct. De disclaimer wordt hier aangeplakt zodat geen enkele aanroeper 'm
// kan vergeten.
//
// De trigger bepaalt het kanaal, niet de content: een trigger met alleen een channelId is expo's
// ChannelAwareTriggerInput, die direct bezorgt én op het juiste kanaal landt. Met `trigger: null`
// kan dat niet en valt de melding terug op expo's fallback-kanaal.
//
// `doel` gaat mee in de data van de melding, zodat een tik erop in de app op de juiste plek uitkomt
// (zie NavigatieProvider in state/navigatie.tsx). Zonder doel opent een tik gewoon de app.
export async function stuurTradeMelding(titel: string, tekst: string, doel?: MeldingDoel): Promise<boolean> {
  if (!await zorgVoorPermissie()) return false;
  const kanaal = Platform.OS === 'android' ? await zorgVoorTradeKanaal() : null;
  await Notifications.scheduleNotificationAsync({
    identifier: TRADE_MELDING_ID,
    content: {
      title: titel,
      body: `${tekst} ${DISCLAIMER}`,
      ...(doel ? { data: { doel } } : {}),
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

// Na het aan- of uitzetten van het slot: de dagelijkse herinnering staat bij Android ingepland met
// het kanaal van toen. Staat hij in de wachtrij, dan opnieuw inplannen op het kanaal van nu. Zonder
// geplande herinnering (meldingen uit) gebeurt er niets; vraagt nooit om toestemming.
export async function herplanDagelijkseMelding(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const gepland = await Notifications.getAllScheduledNotificationsAsync();
    const dagelijks = gepland.find(m => m.identifier === DAGELIJKSE_ID);
    if (!dagelijks) return;
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    const trigger = dagelijks.trigger as { hour?: unknown; minute?: unknown } | null;
    const uur = typeof trigger?.hour === 'number' ? trigger.hour : 9;
    const minuut = typeof trigger?.minute === 'number' ? trigger.minute : 0;
    await stelDagelijkseMeldingIn(uur, minuut);
  } catch {
    // Lukt het niet, dan blijft de oude herinnering staan. Zijn tekst is vast en noemt geen
    // posities of bedragen.
  }
}
