# 📱 Crypto Copy-Trading — Android-app (Capacitor — DEPRECATED)

> ⚠️ **Deze map is vervangen door `../app/` (React Native + Expo).**
> De Capacitor-aanpak wordt niet meer actief onderhouden.
> De `mobile/www/`-map (frontend + engine.js) is gitignored en hoeft niet
> meer gegenereerd te worden — gebruik de Expo-app in `../app/` in plaats hiervan.

---

Dit was de **telefoonversie** van het Crypto Copy-Trading-systeem: dezelfde app
(Marktanalyse, Traders kopiëren, Grote kansen, Mijn Trades, eToro-traders), maar
dan als een **echte Android-app (APK)** via een Capacitor-WebView.

De hele analyse draait **op het toestel zelf** — er is geen computer of server
meer nodig. Alleen verse marktdata wordt live opgehaald (Binance + CoinGecko),
net als bij de desktopversie. Je traders en trades worden lokaal op de telefoon
opgeslagen.

---

## 📥 De app installeren (sideloaden)

> Omdat dit een persoonlijke app is (niet uit de Play Store), moet je hem
> handmatig installeren. Dat heet *sideloaden* en duurt 1 minuut.

1. Kopieer **`app-debug.apk`** naar je telefoon (via USB, e-mail naar jezelf,
   Google Drive, WhatsApp-naar-jezelf, enz.).
2. Open op de telefoon je **Bestanden**-app en tik op het APK-bestand.
3. Android vraagt om **"installeren uit onbekende bron"** toe te staan → zet dat
   aan voor de app waarmee je het bestand opent (Bestanden/Chrome).
4. Tik op **Installeren**. Klaar — er staat nu een icoon
   **"Crypto Copy-Trading"** in je app-lijst.

De APK vind je na de build hier:
`mobile/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔁 De app opnieuw bouwen (na een wijziging)

Alle code van de app staat in **`mobile/www/`**:

| Bestand | Wat het doet |
|---------|--------------|
| `index.html` | De interface (knoppen, tabbladen, opmaak). |
| `engine.js`  | De volledige analyse-engine: marktdata ophalen, RSI/EMA/MACD/ATR, grote-kansen-scanner, eToro-auditor. (JavaScript-versie van de Python `src/`-modules.) |

Na een wijziging maak je een nieuwe APK met:

```bash
cd mobile
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME="$HOME/Library/Android/sdk"
npx cap sync android
cd android
./gradlew assembleDebug
```

De nieuwe APK staat weer in `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🛠️ Hoe het is gebouwd

- **[Capacitor](https://capacitorjs.com/)** verpakt de web-app (`www/`) in een
  native Android-schil met een WebView.
- **CapacitorHttp** is ingeschakeld (`capacitor.config.json`), zodat de
  marktdata-verzoeken via de native HTTP-laag gaan en er **geen CORS-problemen**
  zijn.
- De analyse is een 1-op-1 JavaScript-port van de Python-modules in `../src/`,
  zodat dezelfde signalen, scores en stop-loss/take-profit-logica gelden.

### Benodigdheden om te bouwen (eenmalig, al geïnstalleerd)
- **JDK 17** — `brew install openjdk@17`
- **Android SDK** (platform 34 + build-tools 34) — in `~/Library/Android/sdk`
- **Node.js** — voor Capacitor

---

## 🔐 Over "debug"-APK

`app-debug.apk` is met een standaard debug-sleutel ondertekend. Dat is prima voor
**persoonlijk gebruik** en sideloaden. Wil je hem in de Play Store zetten, dan is
een *release*-build met een eigen keystore nodig — dat is hier niet gedaan omdat
het puur voor jezelf is.

> ⚠️ Geen financieel advies. Net als de desktopversie geeft de app technische
> signalen ter ondersteuning van je eigen onderzoek. Controleer altijd de live
> koers op eToro voordat je een order plaatst.
