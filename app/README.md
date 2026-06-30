# Kader — React Native / Expo app

## Vereisten

| Tool | Versie | Opmerking |
|------|--------|-----------|
| Node.js | 18+ | 24 werkt |
| JDK | 17 of 21 | Android Studio's ingebouwde JBR (OpenJDK 21) volstaat |
| Android SDK | platform 35+ | via Android Studio |
| `JAVA_HOME` | → JBR-pad | bv. `C:\Program Files\Android\Android Studio\jbr` |
| `ANDROID_HOME` | → SDK-pad | bv. `C:\Users\<jou>\AppData\Local\Android\Sdk` |

> **Belangrijk:** het project moet op een **lokale schijf zonder spaties in het pad** staan
> (bv. `D:\dev\crypto-market`). Een netwerkshare (UNC-pad) breekt de Gradle-build.

## Eerste keer opzetten

```bat
cd D:\dev\crypto-market\app
npm install
npx expo prebuild --platform android --no-install
```

## APK bouwen

```bat
cd D:\dev\crypto-market\app\android

REM Debug-APK (verbindt met Metro, vereist draaiende bundler):
.\gradlew assembleDebug

REM Standalone APK (JS ingepakt, bruikbaar zonder bundler):
.\gradlew assembleRelease
```

Output: `app\build\outputs\apk\(debug|release)\app-(debug|release).apk`

De release-build gebruikt de debug-keystore — prima voor persoonlijk sideloaden.

## Installeren via ADB

```bat
REM Emulator:
adb -s emulator-5554 install -r app\build\outputs\apk\release\app-release.apk

REM Fysiek toestel (USB):
adb install -r app\build\outputs\apk\release\app-release.apk
```

## Ontwikkeling met Metro (live reload)

```bat
cd D:\dev\crypto-market\app
npx expo start
REM Scan de QR-code in de Expo Go-app, of druk op 'a' voor de emulator
```
