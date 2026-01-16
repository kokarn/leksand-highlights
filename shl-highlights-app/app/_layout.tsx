import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
    return (
        <ThemeProvider value={DarkTheme}>
            <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="light" />
        </ThemeProvider>
    );
}
