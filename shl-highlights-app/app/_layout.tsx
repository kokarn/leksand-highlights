import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../contexts';

function RootLayoutContent() {
    const { isDark, colors } = useTheme();
    
    // Create custom navigation theme based on our colors
    const navigationTheme = isDark ? {
        ...DarkTheme,
        colors: {
            ...DarkTheme.colors,
            background: colors.background,
            card: colors.card,
            text: colors.text,
            border: colors.cardBorder,
            primary: colors.accent,
        }
    } : {
        ...DefaultTheme,
        colors: {
            ...DefaultTheme.colors,
            background: colors.background,
            card: colors.card,
            text: colors.text,
            border: colors.cardBorder,
            primary: colors.accent,
        }
    };
    
    return (
        <NavigationThemeProvider value={navigationTheme}>
            <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
            <StatusBar 
                style={colors.statusBarStyle} 
                backgroundColor={colors.background} 
                translucent={false} 
            />
        </NavigationThemeProvider>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <RootLayoutContent />
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
