# Kader: React Native / Expo app

## Vereisten

| Tool | Versie | Opmerking |
|------|--------|-----------|
| Node.js | 18+ | 24 werkt |
| JDK | 17 (precies) | Niet de JBR van Android Studio (nieuwer, daar compileert de build niet mee); bv. Temurin 17 |
| Android SDK | platform 36, NDK 27.1.12297006 | compileSdk/targetSdk 36 (React Native 0.85.3), via Android Studio of sdkmanager |
| `JAVA_HOME` | -> JDK 17-pad | bv. `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot` |
| `ANDROID_HOME` | -> SDK-pad | bv. `C:\Users\<jou>\AppData\Local\Android\Sdk` |

> **Belangrijk:** het project moet op een **lokale schijf zonder spaties in het pad** staan
> (bv. `D:\dev\Kader`). Een netwerkshare (UNC-pad) breekt de Gradle-build.

## Eerste keer opzetten

```bat
cd D:\dev\Kader\app
npm install
npx expo prebuild --platform android --no-install
```

## APK bouwen

```bat
cd D:\dev\Kader\app\android

REM Debug-APK (verbindt met Metro, vereist draaiende bundler):
.\gradlew assembleDebug

REM Standalone APK (JS ingepakt, bruikbaar zonder bundler):
.\gradlew assembleRelease
```

Output: `app\build\outputs\apk\(debug|release)\app-(debug|release).apk`

De release-build gebruikt de debug-keystore, prima voor persoonlijk sideloaden.

## Installeren via ADB

```bat
REM Emulator:
adb -s emulator-5554 install -r app\build\outputs\apk\release\app-release.apk

REM Fysiek toestel (USB):
adb install -r app\build\outputs\apk\release\app-release.apk
```

## Ontwikkeling met Metro (live reload)

```bat
cd D:\dev\Kader\app
npx expo start
REM Scan de QR-code in de Expo Go-app, of druk op 'a' voor de emulator
```
