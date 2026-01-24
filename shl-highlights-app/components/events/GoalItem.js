import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlayerName, getAssistName, getGoalType } from '../../utils';
import { useTheme } from '../../contexts/ThemeContext';

export const GoalItem = ({ goal, homeTeamCode, hasVideo, onVideoPress }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    const isHomeGoal = goal.eventTeam?.place === 'home' || goal.eventTeam?.teamCode === homeTeamCode;
    const playerName = getPlayerName(goal.player);
    const assists = [];
    const a1 = getAssistName(goal.assist1);
    const a2 = getAssistName(goal.assist2);
    if (a1) { assists.push(a1); }
    if (a2) { assists.push(a2); }
    const homeGoals = goal.homeGoals ?? goal.homeScore ?? 0;
    const awayGoals = goal.awayGoals ?? goal.awayScore ?? 0;
    const goalType = getGoalType(goal);

    return (
        <View style={[themedStyles.goalItem, isHomeGoal ? themedStyles.goalItemHome : themedStyles.goalItemAway]}>
            <View style={themedStyles.goalTime}>
                <Text style={themedStyles.goalPeriod}>P{goal.period}</Text>
                <Text style={themedStyles.goalTimeText}>{goal.time}</Text>
            </View>
            <View style={themedStyles.goalContent}>
                <View style={themedStyles.goalScorer}>
                    <Ionicons name="radio-button-on" size={14} color={colors.accentGreen} style={{ marginRight: 6 }} />
                    <Text style={themedStyles.goalScorerText}>{playerName}</Text>
                    {goalType && <Text style={themedStyles.goalTypeTag}>{goalType}</Text>}
                </View>
                {assists.length > 0 && (
                    <Text style={themedStyles.goalAssists}>Assists: {assists.join(', ')}</Text>
                )}
                <Text style={themedStyles.eventTypeLabel}>Goal</Text>
            </View>
            <View style={themedStyles.goalRightSection}>
                <View style={themedStyles.goalScoreContainer}>
                    <Text style={[themedStyles.goalScoreNum, isHomeGoal && themedStyles.goalScoreHighlight]}>{homeGoals}</Text>
                    <Text style={themedStyles.goalScoreDash}>-</Text>
                    <Text style={[themedStyles.goalScoreNum, !isHomeGoal && themedStyles.goalScoreHighlight]}>{awayGoals}</Text>
                </View>
                {hasVideo && (
                    <TouchableOpacity onPress={onVideoPress} style={themedStyles.videoIconButton}>
                        <Ionicons name="videocam" size={16} color={colors.accent} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    goalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.chip,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8
    },
    goalItemHome: {
        borderLeftWidth: 3,
        borderLeftColor: colors.accentGreen
    },
    goalItemAway: {
        borderRightWidth: 3,
        borderRightColor: colors.accentGreen
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
    goalScorerText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600'
    },
    goalAssists: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 2
    },
    goalTypeTag: {
        backgroundColor: colors.cardBorder,
        color: colors.accentGreen,
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
        overflow: 'hidden'
    },
    eventTypeLabel: {
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: 4
    },
    goalRightSection: {
        alignItems: 'flex-end',
        marginLeft: 12
    },
    goalScoreContainer: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    goalScoreNum: {
        color: colors.textMuted,
        fontSize: 16,
        fontWeight: '700'
    },
    goalScoreDash: {
        color: colors.textMuted,
        fontSize: 16,
        fontWeight: '700',
        marginHorizontal: 2
    },
    goalScoreHighlight: {
        color: colors.text
    },
    videoIconButton: {
        marginTop: 6,
        padding: 4
    },
});
