import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts';

/**
 * Header component for schedule lists
 * Shows sport icon, title, and item count
 */
export const ScheduleHeader = ({ icon, title, count, countLabel = 'items' }) => {
    const { colors } = useTheme();
    
    return (
        <View style={styles.scheduleHeader}>
            <Ionicons name={icon} size={20} color={colors.accent} />
            <Text style={[styles.scheduleHeaderText, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.scheduleCount, { color: colors.textMuted }]}>{count} {countLabel}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    scheduleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        paddingHorizontal: 4
    },
    scheduleHeaderText: {
        fontSize: 18,
        fontWeight: '700',
        flex: 1
    },
    scheduleCount: {
        fontSize: 13,
        fontWeight: '600'
    }
});
