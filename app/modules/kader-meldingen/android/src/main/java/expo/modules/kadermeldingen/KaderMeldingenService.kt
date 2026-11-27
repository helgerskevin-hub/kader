package expo.modules.kadermeldingen

import android.app.Notification
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Log
import expo.modules.notifications.notifications.model.NotificationBehaviorRecord
import expo.modules.notifications.service.NotificationsService
import expo.modules.notifications.service.delegates.ExpoPresentationDelegate
import expo.modules.notifications.service.interfaces.PresentationDelegate
import expo.modules.notifications.notifications.model.Notification as ExpoNotification

// Trade-meldingen tonen hun bedragen niet op het vergrendelscherm. expo-notifications kan per melding
// geen zichtbaarheid of publicVersion meegeven, en de lockscreenVisibility van een kanaal dat de app
// aanmaakt overschrijft Android met de app-brede waarde (gemeten op Android 15 in 0.5.0). Daarom
// deze ontvanger: hij vervangt die van expo (zie AndroidManifest.xml) en doet alles hetzelfde, alleen
// het opbouwen van de melding krijgt er een stap bij. Posten, de tag, het vervangen van de vorige
// melding en de tik-afhandeling (de PendingIntent van expo) blijven dus van expo.
class KaderMeldingenService : NotificationsService() {
  override fun getPresentationDelegate(context: Context): PresentationDelegate =
    AfschermendePresentatie(context)
}

class AfschermendePresentatie(context: Context) : ExpoPresentationDelegate(context) {
  override suspend fun createNotification(
    notification: ExpoNotification,
    notificationBehavior: NotificationBehaviorRecord?,
  ): Notification {
    val melding = super.createNotification(notification, notificationBehavior)
    // Alleen meldingen die het zelf vragen: stuurTradeMelding zet { vergrendelscherm: { titel, tekst } }
    // in de data. De dagelijkse herinnering heeft geen bedragen en blijft zoals hij is.
    val scherm = notification.notificationRequest?.content?.body?.optJSONObject(DATA_SLEUTEL)
      ?: return melding
    // Gaat er iets mis bij het afschermen, dan liever geen melding op het vergrendelscherm dan een
    // crash of een lek: SECRET.
    try {
      val titel = scherm.optString("titel").ifEmpty { "Kader" }
      val tekst = scherm.optString("tekst")

      // minSdk is 24, dus de Builder zonder kanaal blijft nodig onder Android 8.
      val bouwer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && melding.channelId != null) {
        Notification.Builder(context, melding.channelId)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(context)
      }
      bouwer.setContentTitle(titel).setContentText(tekst).setColor(melding.color)
      // Alleen het icoon van de melding zelf, geen terugval op het launcher-icoon.
      melding.smallIcon?.let { bouwer.setSmallIcon(it) }
      melding.publicVersion = bouwer.build()

      // PRIVATE: op een beveiligd vergrendelscherm de publicVersion, na het ontgrendelen alles. Maar
      // Android redigeert PRIVATE alleen als de gebruiker "Gevoelige inhoud verbergen" koos; bij "Alle
      // meldingsinhoud tonen" (de standaard) staat de volledige tekst er toch. Dan SECRET: de melding
      // staat niet op het vergrendelscherm en na het ontgrendelen volledig in de balk. Bij twijfel
      // (instelling niet leesbaar) ook SECRET.
      melding.visibility = if (systeemRedigeert(context)) Notification.VISIBILITY_PRIVATE else Notification.VISIBILITY_SECRET
    } catch (e: Exception) {
      Log.w("KaderMeldingen", "Afschermen mislukt, melding op SECRET gezet", e)
      melding.visibility = Notification.VISIBILITY_SECRET
    }
    return melding
  }

  // true alleen als de instelling leesbaar is en op "gevoelige inhoud verbergen" staat (0).
  private fun systeemRedigeert(context: Context): Boolean =
    try {
      Settings.Secure.getInt(context.contentResolver, INSTELLING_PRIVE_INHOUD, 1) == 0
    } catch (e: Exception) {
      Log.w("KaderMeldingen", "Instelling voor meldingsinhoud niet leesbaar", e)
      false
    }

  private companion object {
    const val DATA_SLEUTEL = "vergrendelscherm"

    // Settings.Secure.LOCK_SCREEN_ALLOW_PRIVATE_NOTIFICATIONS, niet openbaar in de SDK.
    const val INSTELLING_PRIVE_INHOUD = "lock_screen_allow_private_notifications"
  }
}
