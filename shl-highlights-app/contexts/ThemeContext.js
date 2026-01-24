import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/theme';
import { STORAGE_KEYS, THEME_MODES } from '../constants';

const ThemeContext = createContext(null);

/**
 * ThemeProvider component that wraps the app and provides theme context
 * Supports 'system', 'light', and 'dark' modes
 */
export function ThemeProvider({ children }) {
    // Get device color scheme
    const deviceColorScheme = useDeviceColorScheme();
    
    // Theme mode state: 'system' | 'light' | 'dark'
    const [themeMode, setThemeMode] = useState(THEME_MODES.SYSTEM);
    const [isLoaded, setIsLoaded] = useState(false);
    
    // Load saved theme preference on mount
    useEffect(() => {
        const loadThemePreference = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem(STORAGE_KEYS.THEME_MODE);
                if (savedTheme && Object.values(THEME_MODES).includes(savedTheme)) {
                    setThemeMode(savedTheme);
                }
            } catch (e) {
                console.error('Error loading theme preference:', e);
            } finally {
                setIsLoaded(true);
            }
        };
        
        loadThemePreference();
    }, []);
    
    // Save theme preference when it changes
    const saveThemeMode = useCallback(async (mode) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
            setThemeMode(mode);
        } catch (e) {
            console.error('Error saving theme preference:', e);
        }
    }, []);
    
    // Determine the actual color scheme based on mode and device preference
    const colorScheme = useMemo(() => {
        if (themeMode === THEME_MODES.SYSTEM) {
            return deviceColorScheme || 'dark';
        }
        return themeMode;
    }, [themeMode, deviceColorScheme]);
    
    // Get the colors for the current scheme
    const colors = useMemo(() => {
        return Colors[colorScheme] || Colors.dark;
    }, [colorScheme]);
    
    // Check if currently in dark mode
    const isDark = colorScheme === 'dark';
    
    const value = useMemo(() => ({
        // Current active color scheme ('light' or 'dark')
        colorScheme,
        // User's theme preference ('system', 'light', or 'dark')
        themeMode,
        // Current theme colors
        colors,
        // Helper to check if dark mode
        isDark,
        // Function to change theme mode
        setThemeMode: saveThemeMode,
        // Whether theme has loaded from storage
        isLoaded
    }), [colorScheme, themeMode, colors, isDark, saveThemeMode, isLoaded]);
    
    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

/**
 * Hook to access the theme context
 * @returns Theme context value with colors, colorScheme, themeMode, isDark, setThemeMode
 */
export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === null) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

export default ThemeContext;
