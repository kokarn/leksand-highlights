import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Toggle between schedule and standings view modes
 * Styled to match SportTab for visual consistency
 */
export const ViewToggle = ({ mode, onChange }) => (
    <View style={styles.viewToggle}>
        <TouchableOpacity
            style={[styles.viewToggleButton, mode === 'schedule' && styles.viewToggleButtonActive]}
            onPress={() => onChange('schedule')}
            activeOpacity={0.7}
        >
            <Ionicons name="calendar-outline" size={14} color={mode === 'schedule' ? '#0A84FF' : '#666'} />
            <Text style={[styles.viewToggleText, mode === 'schedule' && styles.viewToggleTextActive]}>
                Schedule
            </Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.viewToggleButton, mode === 'standings' && styles.viewToggleButtonActive]}
            onPress={() => onChange('standings')}
            activeOpacity={0.7}
        >
            <Ionicons name="stats-chart" size={14} color={mode === 'standings' ? '#0A84FF' : '#666'} />
            <Text style={[styles.viewToggleText, mode === 'standings' && styles.viewToggleTextActive]}>
                Standings
            </Text>
        </TouchableOpacity>
    </View>
);

const styles = StyleSheet.create({
    viewToggle: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center'
    },
    viewToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#1c1c1e',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333'
    },
    viewToggleButtonActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.15)',
        borderColor: '#0A84FF'
    },
    viewToggleText: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600'
    },
    viewToggleTextActive: {
        color: '#0A84FF'
    }
});
