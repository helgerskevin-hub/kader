// TS-kant van de lokale Expo-module kader-beveiliging (Kotlin in android/). Getypeerd tegen het
// contract in src/state/vergrendelTypes.ts. requireNativeModule gooit als de module niet gelinkt
// is: dan is de build stuk, en een slot zonder hash-functie mag niet stil doorstarten.
import { requireNativeModule } from 'expo';

import type { KaderBeveiligingModule } from '../../src/state/vergrendelTypes';

export default requireNativeModule<KaderBeveiligingModule>('KaderBeveiliging');
