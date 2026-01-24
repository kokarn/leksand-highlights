/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    // Base colors
    text: '#11181C',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    background: '#F5F5F7',
    backgroundSecondary: '#FFFFFF',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    
    // UI Elements
    card: '#FFFFFF',
    cardBorder: '#E5E5EA',
    cardHeader: '#F9FAFB',
    separator: '#E5E5EA',
    
    // Interactive elements
    switchTrackOff: '#E5E5EA',
    switchTrackOn: '#34C759',
    
    // Chips and buttons
    chip: '#F3F4F6',
    chipBorder: '#D1D5DB',
    chipActive: 'rgba(10, 132, 255, 0.15)',
    chipActiveBorder: '#0A84FF',
    chipText: '#6B7280',
    chipTextActive: '#0A84FF',
    
    // Accents
    accent: '#0A84FF',
    accentGreen: '#30D158',
    accentOrange: '#FF9F0A',
    accentRed: '#FF453A',
    accentPurple: '#5856D6',
    accentPink: '#D94A8C',
    
    // Gradient
    gradientStart: '#F5F5F7',
    gradientEnd: '#FFFFFF',
    
    // Status bar
    statusBarStyle: 'dark' as const,
  },
  dark: {
    // Base colors
    text: '#ECEDEE',
    textSecondary: '#8E8E93',
    textMuted: '#666666',
    background: '#000000',
    backgroundSecondary: '#121212',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    
    // UI Elements
    card: '#1c1c1e',
    cardBorder: '#333333',
    cardHeader: '#1c1c1e',
    separator: '#2c2c2e',
    
    // Interactive elements
    switchTrackOff: '#3a3a3c',
    switchTrackOn: '#34C759',
    
    // Chips and buttons
    chip: '#252525',
    chipBorder: '#333333',
    chipActive: 'rgba(10, 132, 255, 0.2)',
    chipActiveBorder: '#0A84FF',
    chipText: '#888888',
    chipTextActive: '#FFFFFF',
    
    // Accents
    accent: '#0A84FF',
    accentGreen: '#30D158',
    accentOrange: '#FF9F0A',
    accentRed: '#FF453A',
    accentPurple: '#5856D6',
    accentPink: '#D94A8C',
    
    // Gradient
    gradientStart: '#000000',
    gradientEnd: '#121212',
    
    // Status bar
    statusBarStyle: 'light' as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
