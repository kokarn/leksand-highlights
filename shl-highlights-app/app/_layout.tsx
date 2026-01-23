import { useEffect } from 'react';
import { Platform } from 'react-native';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

// Only import OneSignal on native platforms
let OneSignal: any = null;
let LogLevel: any = null;
if (Platform.OS !== 'web') {
    const oneSignalModule = require('react-native-onesignal');
    OneSignal = oneSignalModule.OneSignal;
    LogLevel = oneSignalModule.LogLevel;
}

export default function RootLayout() {
    useEffect(() => {
        // Skip OneSignal on web - native module not available
        if (Platform.OS === 'web') {
            console.log('[OneSignal] Skipped - not supported on web');
            return;
        }

        // Initialize OneSignal (notification click handling is done in index.js)
        const appId = Constants.expoConfig?.extra?.oneSignalAppId;

        if (appId && appId !== 'YOUR_ONESIGNAL_APP_ID') {
            // Enable verbose logging during development
            if (__DEV__) {
                OneSignal.Debug.setLogLevel(LogLevel.Verbose);
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
