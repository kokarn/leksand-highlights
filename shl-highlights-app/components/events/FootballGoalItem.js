import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

// Helper to extract player name from event text
const extractNameFromText = (text) => {
    if (!text) {
        return null;
    }
    // Common patterns: "Goal! Player Name" or "Player Name scores"
    const patterns = [
        /Goal[!.]?\s*(.+?)(?:\s+scores|\s+mål|\s*$)/i,
        /^(.+?)\s+(?:scores|goal)/i,
        /Goal\s*-\s*(.+?)(?:\s*\(|$)/i
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return null;
};

// Format time display (e.g., "45'+2" or "23'")
const formatTime = (time) => {
    if (!time) {
        return '-';
    }
    const str = String(time);
    // If already formatted with apostrophe, return as is
    if (str.includes("'")) {
        return str;
    }
    // Otherwise add apostrophe for minute display
    return `${str}'`;
};

export const FootballGoalItem = ({ goal, homeTeamCode }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    const isHomeGoal = goal.isHome === true || goal.teamCode === homeTeamCode;
    
    // Try multiple sources for scorer name
    const scorerName = goal.scorer?.name 
        || goal.scorer?.displayName 
        || goal.player?.name 
        || goal.player?.displayName
        || extractNameFromText(goal.text)
        || goal.text
        || 'Goal';
    
    const assistName = goal.assist?.name || goal.assist?.displayName || null;
    
    // Use calculated score first (from modal), then fall back to API score
    const homeGoals = goal.calculatedScore?.home ?? goal.score?.home;
    const awayGoals = goal.calculatedScore?.away ?? goal.score?.away;
    const hasScore = homeGoals !== null && homeGoals !== undefined 
        && awayGoals !== null && awayGoals !== undefined;
    
    const goalType = goal.goalType || '';
    const clock = goal.clock || '';
    const periodLabel = goal.period === 1 ? '1st' : goal.period === 2 ? '2nd' : goal.periodDisplay || '';

    // Show team code if available
    const teamLabel = goal.teamCode || goal.teamName || '';

    return (
        <View style={[themedStyles.goalItem, isHomeGoal ? themedStyles.goalItemHome : themedStyles.goalItemAway]}>
            <View style={themedStyles.goalTime}>
                <Text style={themedStyles.goalPeriod}>{periodLabel}</Text>
                <Text style={themedStyles.goalTimeText}>{formatTime(clock)}</Text>
            </View>
            <View style={themedStyles.goalContent}>
                <View style={themedStyles.goalScorer}>
                    <Ionicons name="football" size={14} color={colors.accentGreen} style={{ marginRight: 6 }} />
                    <Text style={themedStyles.goalScorerText} numberOfLines={2}>{scorerName}</Text>
                </View>
                {goalType && goalType !== 'Goal' && goalType !== 'Goal Scored' && goalType.toLowerCase() !== 'goal' && (
                    <Text style={themedStyles.goalTypeTag}>{goalType}</Text>
                )}
                {assistName && (
                    <Text style={themedStyles.goalAssists}>Assist: {assistName}</Text>
                )}
                {teamLabel && (
                    <Text style={themedStyles.teamLabel}>{teamLabel}</Text>
                )}
            </View>
            {hasScore && (
                <View style={themedStyles.goalScoreContainer}>
                    <Text style={[themedStyles.goalScoreNum, isHomeGoal && themedStyles.goalScoreHighlight]}>{homeGoals}</Text>
                    <Text style={themedStyles.goalScoreDash}>-</Text>
                    <Text style={[themedStyles.goalScoreNum, !isHomeGoal && themedStyles.goalScoreHighlight]}>{awayGoals}</Text>
                </View>
            )}
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
        alignItems: 'flex-start'
    },
    goalScorerText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
        flex: 1
    },
    goalAssists: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 4
    },
    goalTypeTag: {
        color: colors.accentGreen,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4
    },
    teamLabel: {
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: 4
    },
    goalScoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12
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
    }
});
