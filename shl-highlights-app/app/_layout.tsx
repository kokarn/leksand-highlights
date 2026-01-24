import { useEffect } from 'react';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

// OneSignal - platform-specific import (null on web)
import { OneSignal } from '../utils/onesignal';

export default function RootLayout() {
    useEffect(() => {
        // Skip OneSignal on web or if not available
        if (!OneSignal) {
            console.log('[OneSignal] Skipped - not available on this platform');
            return;
        }


        // Initialize OneSignal (notification click handling is done in index.js)
        const appId = Constants.expoConfig?.extra?.oneSignalAppId;

        if (appId && appId !== 'YOUR_ONESIGNAL_APP_ID') {
            // Enable verbose logging during development
            if (__DEV__ && OneSignal.Debug?.setLogLevel) {
                OneSignal.Debug.setLogLevel(6); // 6 = Verbose
            }

            OneSignal.initialize(appId);
            console.log('[OneSignal] Initialized with App ID');
        } else {
            console.warn('[OneSignal] App ID not configured - push notifications disabled');
        }
    }, []);

    return (
        <SafeAreaProvider>
            <ThemeProvider value={DarkTheme}>
                <Stack>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                </Stack>
                <StatusBar style="light" backgroundColor="#000000" translucent={false} />
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
