import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlayerName, getPenaltyMinutes, getPenaltyOffense } from '../../utils';

export const PenaltyItem = ({ penalty }) => {
    const playerName = getPlayerName(penalty.player);
    const penaltyMinutes = getPenaltyMinutes(penalty);
    const offence = getPenaltyOffense(penalty);
    const penaltyType = penalty.variant?.shortName || '';

    return (
        <View style={styles.penaltyItem}>
            <View style={styles.goalTime}>
                <Text style={styles.goalPeriod}>P{penalty.period}</Text>
                <Text style={styles.goalTimeText}>{penalty.time}</Text>
            </View>
            <View style={styles.goalContent}>
                <View style={styles.goalScorer}>
                    <Ionicons name="alert-circle" size={14} color="#FF9800" style={{ marginRight: 6 }} />
                    <Text style={styles.penaltyPlayer}>{playerName}</Text>
                    <Text style={styles.penaltyMinutesTag}>{penaltyMinutes} min</Text>
                    {penaltyType ? <Text style={styles.penaltyTypeTag}>{penaltyType}</Text> : null}
                </View>
                <Text style={styles.penaltyOffense}>{offence}</Text>
                <Text style={styles.eventTypeLabel}>Penalty</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    penaltyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#252525',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#FF9800'
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
    penaltyPlayer: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600'
    },
    penaltyMinutesTag: {
        backgroundColor: '#333',
        color: '#FF9800',
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
        overflow: 'hidden'
    },
    penaltyTypeTag: {
        backgroundColor: '#442200',
        color: '#FF9800',
        fontSize: 10,
        fontWeight: '600',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 6,
        overflow: 'hidden'
    },
    penaltyOffense: {
        color: '#888',
        fontSize: 12,
        marginTop: 2
    },
    eventTypeLabel: {
        color: '#666',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: 4
    },
});
