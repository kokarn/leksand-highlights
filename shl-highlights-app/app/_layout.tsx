import { useEffect } from 'react';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OneSignal, LogLevel } from 'react-native-onesignal';
import Constants from 'expo-constants';

export default function RootLayout() {
    useEffect(() => {
        // Initialize OneSignal
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
