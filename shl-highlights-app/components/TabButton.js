import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export const TabButton = ({ title, isActive, onPress, icon, compact = false, compactTitle }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    const displayTitle = compact && compactTitle ? compactTitle : title;

    return (
        <TouchableOpacity
            style={[
                themedStyles.tabButton,
                compact && themedStyles.tabButtonCompact,
                isActive && themedStyles.tabButtonActive
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {icon && !compact && (
                <Ionicons name={icon} size={18} color={isActive ? colors.text : colors.textSecondary} />
            )}
            <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[
                    themedStyles.tabButtonText,
                    compact && themedStyles.tabButtonTextCompact,
                    isActive && themedStyles.tabButtonTextActive
                ]}
            >
                {displayTitle}
            </Text>
        </TouchableOpacity>
    );
};

const createStyles = (colors) => StyleSheet.create({
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6
    },
    tabButtonCompact: {
        paddingVertical: 9,
        gap: 0
    },
    tabButtonActive: {
        borderBottomWidth: 2,
        borderBottomColor: colors.accent
    },
    tabButtonText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600'
    },
    tabButtonTextCompact: {
        fontSize: 12
    },
    tabButtonTextActive: {
        color: colors.text
    },
});
