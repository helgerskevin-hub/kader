import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { Activity, Zap, Wallet, Users } from 'lucide-react-native';

import MarktScreen    from './src/screens/MarktScreen';
import KansenScreen   from './src/screens/KansenScreen';
import PortfolioScreen from './src/screens/PortfolioScreen';
import TradersScreen  from './src/screens/TradersScreen';
import { Colors } from './src/theme/colors';
import { Font } from './src/theme/typography';

const Tab = createBottomTabNavigator();

const ICON_SIZE = 22;
const ICON_STROKE = 1.75;

export default function App() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  if (!fontsLoaded) {
    return (
      <View style={s.splash}>
        <ActivityIndicator color={Colors.cta} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: Colors.card,
              borderTopColor: Colors.border,
              borderTopWidth: 1,
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
            tabBarActiveTintColor: Colors.cta,
            tabBarInactiveTintColor: Colors.dim,
            tabBarLabelStyle: {
              fontFamily: Font.sansMd,
              fontSize: 11,
            },
          }}
        >
          <Tab.Screen
            name="Markt"
            component={MarktScreen}
            options={{
              tabBarIcon: ({ color }) => <Activity size={ICON_SIZE} color={color} strokeWidth={ICON_STROKE} />,
            }}
          />
          <Tab.Screen
            name="Kansen"
            component={KansenScreen}
            options={{
              tabBarIcon: ({ color }) => <Zap size={ICON_SIZE} color={color} strokeWidth={ICON_STROKE} />,
            }}
          />
          <Tab.Screen
            name="Portfolio"
            component={PortfolioScreen}
            options={{
              tabBarIcon: ({ color }) => <Wallet size={ICON_SIZE} color={color} strokeWidth={ICON_STROKE} />,
            }}
          />
          <Tab.Screen
            name="Traders"
            component={TradersScreen}
            options={{
              tabBarIcon: ({ color }) => <Users size={ICON_SIZE} color={color} strokeWidth={ICON_STROKE} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
});
