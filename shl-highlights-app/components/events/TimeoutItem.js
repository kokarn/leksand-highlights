import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

export const TimeoutItem = ({ event }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    const teamName = event.eventTeam?.teamName || event.eventTeam?.teamCode || 'Team';

    return (
        <View style={themedStyles.timeoutItem}>
            <View style={themedStyles.goalTime}>
                <Text style={themedStyles.goalPeriod}>P{event.period}</Text>
                <Text style={themedStyles.goalTimeText}>{event.time}</Text>
            </View>
            <View style={themedStyles.goalContent}>
                <View style={themedStyles.goalScorer}>
                    <Ionicons name="time-outline" size={14} color="#2196F3" style={{ marginRight: 6 }} />
                    <Text style={themedStyles.timeoutTeam}>{teamName}</Text>
                </View>
                <Text style={themedStyles.eventTypeLabel}>Timeout</Text>
            </View>
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    timeoutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.chip,
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
        color: colors.textSecondary,
        fontSize: 11
    },
    goalTimeText: {
        color: colors.text,
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
        color: colors.text,
        fontSize: 15,
        fontWeight: '600'
    },
    eventTypeLabel: {
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: 4
    },
});
