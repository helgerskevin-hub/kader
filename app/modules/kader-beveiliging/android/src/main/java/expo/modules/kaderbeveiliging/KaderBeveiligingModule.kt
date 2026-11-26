package expo.modules.kaderbeveiliging

import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.functions.Coroutine
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
