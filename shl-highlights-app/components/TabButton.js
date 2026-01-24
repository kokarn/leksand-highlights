import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export const TabButton = ({ title, isActive, onPress, icon }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    return (
        <TouchableOpacity
            style={[themedStyles.tabButton, isActive && themedStyles.tabButtonActive]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Ionicons name={icon} size={18} color={isActive ? colors.text : colors.textSecondary} />
            <Text style={[themedStyles.tabButtonText, isActive && themedStyles.tabButtonTextActive]}>{title}</Text>
        </TouchableOpacity>
    );
};

const createStyles = (colors) => StyleSheet.create({
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 6
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
    tabButtonTextActive: {
        color: colors.text
    },
});
