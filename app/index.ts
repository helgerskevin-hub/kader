import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { widgetTaak } from './src/widget/widgetTaak';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Op module-niveau, net als de achtergrondtaak: Android laadt voor de widget alleen deze bundel,
// zonder scherm, en dan moet de handler al bestaan.
registerWidgetTaskHandler(widgetTaak);
