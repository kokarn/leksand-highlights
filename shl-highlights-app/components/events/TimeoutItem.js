import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const TimeoutItem = ({ event }) => {
    const teamName = event.eventTeam?.teamName || event.eventTeam?.teamCode || 'Team';

    return (
        <View style={styles.timeoutItem}>
            <View style={styles.goalTime}>
                <Text style={styles.goalPeriod}>P{event.period}</Text>
                <Text style={styles.goalTimeText}>{event.time}</Text>
            </View>
            <View style={styles.goalContent}>
                <View style={styles.goalScorer}>
                    <Ionicons name="time-outline" size={14} color="#2196F3" style={{ marginRight: 6 }} />
                    <Text style={styles.timeoutTeam}>{teamName}</Text>
                </View>
                <Text style={styles.eventTypeLabel}>Timeout</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    timeoutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#252525',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#2196F3'
    },
    goalTime: {
        width: 45,
        marginRight: 12
    },
    goalPeriod: {
        color: '#888',
        fontSize: 11
    },
    goalTimeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    },
    goalContent: {
        flex: 1
    },
    goalScorer: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    timeoutTeam: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600'
    },
    eventTypeLabel: {
        color: '#666',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: 4
    },
});
