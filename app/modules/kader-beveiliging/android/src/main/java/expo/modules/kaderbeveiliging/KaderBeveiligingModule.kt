package expo.modules.kaderbeveiliging

import android.annotation.TargetApi
import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.SecureRandom
import java.util.Arrays
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// Native hulp voor de app-vergrendeling (contract: KaderBeveiligingModule in
// src/state/vergrendelTypes.ts). expo-crypto heeft geen PBKDF2 en JS heeft geen monotone klok
// die een force-stop overleeft; daarom deze kleine module.
class KaderBeveiligingModule : Module() {
  private val willekeur = SecureRandom()

  // De lopende schermslot-bevestiging. Alleen op de main thread gelezen en geschreven (de functies
  // draaien op Queues.MAIN, de prompt-callbacks op de mainExecutor, onActivityResult op de main
  // thread), dus geen locking nodig.
  private var lopend: Promise? = null
  private var annuleerSignaal: CancellationSignal? = null

  override fun definition() = ModuleDefinition {
    Name("KaderBeveiliging")

    // PBKDF2-HMAC-SHA256 via de platformimplementatie (SecretKeyFactory), 32 bytes, als hex in
    // kleine letters. Bewust geen eigen PBKDF2-lus: eigen crypto is een onnodig risico. Draait op
    // Dispatchers.Default en niet op de gedeelde AsyncFunction-wachtrij van Expo: die ene thread
    // delen alle modules (ook expo-secure-store), en een hash van een paar honderd ms zou die
    // anders ophouden. Het aantal iteraties staat in PBKDF2_ITERATIES in het contract.
    AsyncFunction("pbkdf2Sha256Hex") Coroutine { pin: String, saltHex: String, iteraties: Int ->
      require(pin.length in 1..64) { "pin moet 1 tot 64 tekens lang zijn" }
      require(iteraties in 10_000..10_000_000) { "iteraties moet tussen 10.000 en 10.000.000 liggen" }
      require(saltHex.length in 16..256) { "saltHex moet 16 tot 256 tekens lang zijn" }
      val salt = hexNaarBytes(saltHex)
      withContext(Dispatchers.Default) {
        // PBEKeySpec neemt een char[]; de Android-implementatie maakt daar UTF-8 van, wat het
        // contract vraagt (op het toestel gecontroleerd tegen Node pbkdf2Sync).
        val tekens = pin.toCharArray()
        val spec = PBEKeySpec(tekens, salt, iteraties, 256)
        try {
          val sleutel = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            .generateSecret(spec)
            .encoded
          try {
            bytesNaarHex(sleutel)
          } finally {
            Arrays.fill(sleutel, 0)
          }
        } finally {
          spec.clearPassword()
          Arrays.fill(tekens, '\u0000')
        }
      }
    }

    // Monotoon in ms sinds het opstarten, loopt door in slaap, begint na een reboot bij 0.
    Function("monotoneTijd") {
      SystemClock.elapsedRealtime().toDouble()
    }

    // Hoeveelste keer het toestel is opgestart, -1 als het toestel hem niet geeft.
    Function("opstartTeller") {
      val resolver = appContext.reactContext?.contentResolver ?: return@Function -1
      try {
        Settings.Global.getInt(resolver, Settings.Global.BOOT_COUNT, -1)
      } catch (e: Exception) {
        -1
      }
    }

    Function("willekeurigeHex") { bytes: Int ->
      require(bytes in 1..1024) { "bytes moet tussen 1 en 1024 liggen" }
      val buffer = ByteArray(bytes)
      willekeur.nextBytes(buffer)
      bytesNaarHex(buffer)
    }

    // Afdekking in Recente apps. Bewust geen FLAG_SECURE: gewone screenshots blijven werken.
    // Onder API 33 bestaat setRecentsScreenshotEnabled niet en doet dit niets.
    Function("zetRecentsAfbeelding") { toestaan: Boolean ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val activiteit = appContext.currentActivity ?: return@Function
        activiteit.runOnUiThread {
          activiteit.setRecentsScreenshotEnabled(toestaan)
        }
      }
    }

    // "Pincode vergeten?": bevestigen met ALLEEN het schermslot van het toestel (pincode, patroon
    // of wachtwoord), nooit met biometrie. Een vingerafdruk of gezicht mag de pincode van Kader niet
    // vervangen: dan zou een zwakke gezichtsherkenning genoeg zijn om een nieuwe pincode te kiezen.
    // API 30 en hoger: de framework-BiometricPrompt met alleen DEVICE_CREDENTIAL. Daaronder bestaat
    // dat niet; dan de schermslot-activity van KeyguardManager (de app gaat dan naar de achtergrond).
    // Uitkomst: 'ok', 'geannuleerd', 'geenSchermslot' of 'fout'. Eén tegelijk: een tweede aanroep
    // terwijl er een loopt geeft meteen 'geannuleerd'.
    AsyncFunction("bevestigSchermslot") { titel: String, ondertitel: String?, promise: Promise ->
      if (lopend != null) {
        promise.resolve("geannuleerd")
        return@AsyncFunction
      }
      val activiteit = appContext.currentActivity
      if (activiteit == null) {
        promise.resolve("fout")
        return@AsyncFunction
      }
      val keyguard = activiteit.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
      if (keyguard == null) {
        promise.resolve("fout")
        return@AsyncFunction
      }
      if (!keyguard.isDeviceSecure) {
        promise.resolve("geenSchermslot")
        return@AsyncFunction
      }
      lopend = promise
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          vraagViaPrompt(activiteit, titel, ondertitel, promise)
        } else {
          vraagViaKeyguard(activiteit, keyguard, titel, ondertitel, promise)
        }
      } catch (e: Exception) {
        rondAf(promise, "fout")
      }
    }.runOnQueue(Queues.MAIN)

    // Noodklep (forceerPromptKlaar in JS): sluit een lopende schermslot-bevestiging af met
    // 'geannuleerd'. Zonder lopende bevestiging doet dit niets.
    AsyncFunction<Unit>("annuleerSchermslot") {
      val belofte = lopend ?: return@AsyncFunction
      val signaal = annuleerSignaal
      rondAf(belofte, "geannuleerd")
      signaal?.cancel()
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
        appContext.currentActivity?.finishActivity(VERZOEK_SCHERMSLOT)
      }
    }.runOnQueue(Queues.MAIN)

    // Uitslag van de schermslot-activity onder API 30.
    OnActivityResult { _, (verzoek, resultaat, _) ->
      if (verzoek != VERZOEK_SCHERMSLOT) return@OnActivityResult
      val belofte = lopend ?: return@OnActivityResult
      rondAf(belofte, if (resultaat == Activity.RESULT_OK) "ok" else "geannuleerd")
    }
  }

  // Lost de belofte precies één keer op, en alleen als hij nog de lopende is (een late callback na
  // annuleerSchermslot doet niets meer).
  private fun rondAf(belofte: Promise, uitkomst: String) {
    if (lopend !== belofte) return
    lopend = null
    annuleerSignaal = null
    belofte.resolve(uitkomst)
  }

  @TargetApi(Build.VERSION_CODES.R)
  private fun vraagViaPrompt(activiteit: Activity, titel: String, ondertitel: String?, belofte: Promise) {
    val signaal = CancellationSignal()
    annuleerSignaal = signaal
    // Geen setNegativeButton: met DEVICE_CREDENTIAL toont het systeem zelf een annuleerknop, en
    // de bouwer weigert de combinatie.
    val bouwer = BiometricPrompt.Builder(activiteit)
      .setTitle(titel)
      .setAllowedAuthenticators(BiometricManager.Authenticators.DEVICE_CREDENTIAL)
    if (!ondertitel.isNullOrEmpty()) bouwer.setSubtitle(ondertitel)
    bouwer.build().authenticate(
      signaal,
      activiteit.mainExecutor,
      object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult?) {
          rondAf(belofte, "ok")
        }

        override fun onAuthenticationError(code: Int, tekst: CharSequence?) {
          val uitkomst = when (code) {
            BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED,
            BiometricPrompt.BIOMETRIC_ERROR_CANCELED -> "geannuleerd"
            BiometricPrompt.BIOMETRIC_ERROR_NO_DEVICE_CREDENTIAL -> "geenSchermslot"
            else -> "fout"
          }
          rondAf(belofte, uitkomst)
        }
      },
    )
  }

  @Suppress("DEPRECATION")
  private fun vraagViaKeyguard(
    activiteit: Activity,
    keyguard: KeyguardManager,
    titel: String,
    ondertitel: String?,
    belofte: Promise,
  ) {
    // null betekent: geen beveiligd schermslot (isDeviceSecure zei net nog van wel, dus zeldzaam).
    val intent = keyguard.createConfirmDeviceCredentialIntent(titel, ondertitel)
    if (intent == null) {
      rondAf(belofte, "geenSchermslot")
      return
    }
    activiteit.startActivityForResult(intent, VERZOEK_SCHERMSLOT)
  }

  private companion object {
    // Past in de onderste 16 bits, want FragmentActivity weigert grotere verzoekcodes.
    const val VERZOEK_SCHERMSLOT = 0x4B42
  }

  private fun hexNaarBytes(hex: String): ByteArray {
    require(hex.length % 2 == 0) { "saltHex heeft een oneven lengte" }
    val uit = ByteArray(hex.length / 2)
    for (i in uit.indices) {
      val hoog = hexWaarde(hex[i * 2])
      val laag = hexWaarde(hex[i * 2 + 1])
      require(hoog >= 0 && laag >= 0) { "saltHex is geen geldige hex" }
      uit[i] = ((hoog shl 4) or laag).toByte()
    }
    return uit
  }

  // Alleen ASCII 0-9, a-f en A-F. Character.digit accepteert ook andere Unicode-cijfers.
  private fun hexWaarde(teken: Char): Int = when (teken) {
    in '0'..'9' -> teken - '0'
    in 'a'..'f' -> teken - 'a' + 10
    in 'A'..'F' -> teken - 'A' + 10
    else -> -1
  }

  private fun bytesNaarHex(bytes: ByteArray): String {
    val tekens = "0123456789abcdef"
    val uit = StringBuilder(bytes.size * 2)
    for (b in bytes) {
      val v = b.toInt() and 0xff
      uit.append(tekens[v ushr 4])
      uit.append(tekens[v and 0x0f])
    }
    return uit.toString()
  }
}
