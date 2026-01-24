import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlayerName } from '../../utils';
import { useTheme } from '../../contexts/ThemeContext';

export const GoalkeeperItem = ({ event }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    const playerName = getPlayerName(event.player);
    const jersey = event.player?.jerseyToday;
    const isEntering = event.isEntering;
    const teamCode = event.eventTeam?.teamCode || '';

    return (
        <View style={[themedStyles.goalkeeperItem, isEntering ? themedStyles.goalkeeperItemIn : themedStyles.goalkeeperItemOut]}>
            <View style={themedStyles.goalTime}>
                <Text style={themedStyles.goalPeriod}>P{event.period}</Text>
                <Text style={themedStyles.goalTimeText}>{event.time}</Text>
            </View>
            <View style={themedStyles.goalContent}>
                <View style={themedStyles.goalScorer}>
                    <Ionicons
                        name={isEntering ? "enter-outline" : "exit-outline"}
                        size={14}
                        color={isEntering ? colors.accentGreen : colors.textSecondary}
                        style={{ marginRight: 6 }}
                    />
                    <Text style={themedStyles.goalkeeperPlayer}>{playerName}</Text>
                    {jersey && <Text style={themedStyles.goalkeeperJersey}>#{jersey}</Text>}
                    <Text style={[themedStyles.goalkeeperTag, isEntering ? themedStyles.goalkeeperTagIn : themedStyles.goalkeeperTagOut]}>
                        {isEntering ? 'IN' : 'OUT'}
                    </Text>
                </View>
                <Text style={themedStyles.goalkeeperTeam}>{teamCode}</Text>
                <Text style={themedStyles.eventTypeLabel}>Goalkeeper</Text>
            </View>
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    goalkeeperItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.chip,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8
    },
    goalkeeperItemIn: {
        borderLeftWidth: 3,
        borderLeftColor: colors.accentGreen
    },
    goalkeeperItemOut: {
        borderLeftWidth: 3,
        borderLeftColor: colors.textSecondary
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
    goalkeeperPlayer: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600'
    },
    goalkeeperJersey: {
        color: colors.textSecondary,
        fontSize: 13,
        marginLeft: 6
    },
    goalkeeperTag: {
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
        overflow: 'hidden'
    },
    goalkeeperTagIn: {
        backgroundColor: 'rgba(48, 209, 88, 0.15)',
        color: colors.accentGreen
    },
    goalkeeperTagOut: {
        backgroundColor: colors.cardBorder,
        color: colors.textSecondary
    },
    goalkeeperTeam: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 2
    },
    eventTypeLabel: {
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: 4
    },
});
