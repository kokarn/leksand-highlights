import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlayerName, getPenaltyMinutes, getPenaltyOffense, getPenaltyType } from '../../utils';
import { useTheme } from '../../contexts/ThemeContext';

export const PenaltyItem = ({ penalty, homeTeamCode }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    const rawPlayerName = getPlayerName(penalty.player);
    const penaltyMinutes = getPenaltyMinutes(penalty);
    const offence = getPenaltyOffense(penalty);
    const penaltyType = getPenaltyType(penalty.variant);

    const eventTeamCode = penalty.eventTeam?.teamCode
        || penalty.teamCode
        || penalty.team?.teamCode
        || penalty.team?.code
        || null;
    const eventPlace = penalty.eventTeam?.place || penalty.team?.place || penalty.place || null;
    const normalizedPlace = typeof eventPlace === 'string' ? eventPlace.toLowerCase() : null;
    const isHomePenalty = penalty.isHome === true
        || normalizedPlace === 'home'
        || (eventTeamCode && homeTeamCode && eventTeamCode === homeTeamCode);
    const isAwayPenalty = penalty.isHome === false
        || normalizedPlace === 'away'
        || (eventTeamCode && homeTeamCode && eventTeamCode !== homeTeamCode);
    const indicatorStyle = isAwayPenalty ? themedStyles.penaltyItemAway : themedStyles.penaltyItemHome;
    
    // For team penalties (bench minor, too many men, etc.), show team name instead of "Unknown"
    const teamCode = eventTeamCode;
    const isTeamPenalty = rawPlayerName === 'Unknown' && teamCode;
    const playerName = isTeamPenalty ? `${teamCode} (Team)` : rawPlayerName;

    return (
        <View style={[themedStyles.penaltyItem, indicatorStyle]}>
            <View style={themedStyles.goalTime}>
                <Text style={themedStyles.goalPeriod}>P{penalty.period}</Text>
                <Text style={themedStyles.goalTimeText}>{penalty.time}</Text>
            </View>
            <View style={themedStyles.goalContent}>
                <View style={themedStyles.goalScorer}>
                    <Ionicons name="alert-circle" size={14} color={colors.accentOrange} style={{ marginRight: 6 }} />
                    <Text style={themedStyles.penaltyPlayer}>{playerName}</Text>
                    <Text style={themedStyles.penaltyMinutesTag}>{penaltyMinutes} min</Text>
                    {penaltyType ? <Text style={themedStyles.penaltyTypeTag}>{penaltyType}</Text> : null}
                </View>
                <Text style={themedStyles.penaltyOffense}>{offence}</Text>
                <Text style={themedStyles.eventTypeLabel}>Penalty</Text>
            </View>
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    penaltyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.chip,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    penaltyItemHome: {
        borderLeftWidth: 3,
        borderLeftColor: colors.accentOrange
    },
    penaltyItemAway: {
        borderRightWidth: 3,
        borderRightColor: colors.accentOrange
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
    penaltyPlayer: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600'
    },
    penaltyMinutesTag: {
        backgroundColor: colors.cardBorder,
        color: colors.accentOrange,
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
        overflow: 'hidden'
    },
    penaltyTypeTag: {
        backgroundColor: 'rgba(255, 152, 0, 0.15)',
        color: colors.accentOrange,
        fontSize: 10,
        fontWeight: '600',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 6,
        overflow: 'hidden'
    },
    penaltyOffense: {
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
