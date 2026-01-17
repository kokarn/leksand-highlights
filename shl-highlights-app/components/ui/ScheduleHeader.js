import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Header component for schedule lists
 * Shows sport icon, title, and item count
 */
export const ScheduleHeader = ({ icon, title, count, countLabel = 'items' }) => (
    <View style={styles.scheduleHeader}>
        <Ionicons name={icon} size={20} color="#0A84FF" />
        <Text style={styles.scheduleHeaderText}>{title}</Text>
        <Text style={styles.scheduleCount}>{count} {countLabel}</Text>
    </View>
);

const styles = StyleSheet.create({
    scheduleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        paddingHorizontal: 4
    },
    scheduleHeaderText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        flex: 1
    },
    scheduleCount: {
        color: '#666',
        fontSize: 13,
        fontWeight: '600'
    }
});
