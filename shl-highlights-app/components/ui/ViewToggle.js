import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Toggle between schedule and standings view modes
 */
export const ViewToggle = ({ mode, onChange }) => (
    <View style={styles.viewToggle}>
        <TouchableOpacity
            style={[styles.viewToggleButton, mode === 'schedule' && styles.viewToggleButtonActive]}
            onPress={() => onChange('schedule')}
            activeOpacity={0.7}
        >
            <Ionicons name="calendar-outline" size={16} color={mode === 'schedule' ? '#0A84FF' : '#666'} />
            <Text style={[styles.viewToggleText, mode === 'schedule' && styles.viewToggleTextActive]}>
                Schedule
            </Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.viewToggleButton, mode === 'standings' && styles.viewToggleButtonActive]}
            onPress={() => onChange('standings')}
            activeOpacity={0.7}
        >
            <Ionicons name="stats-chart" size={16} color={mode === 'standings' ? '#0A84FF' : '#666'} />
            <Text style={[styles.viewToggleText, mode === 'standings' && styles.viewToggleTextActive]}>
                Standings
            </Text>
        </TouchableOpacity>
    </View>
);

const styles = StyleSheet.create({
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: '#1c1c1e',
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: '#333'
    },
    viewToggleButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10
    },
    viewToggleButtonActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.15)',
        borderWidth: 1,
        borderColor: '#0A84FF'
    },
    viewToggleText: {
        color: '#666',
        fontSize: 13,
        fontWeight: '600'
    },
    viewToggleTextActive: {
        color: '#0A84FF'
    }
});
