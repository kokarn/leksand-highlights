import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
        <View style={[styles.goalItem, isHomeGoal ? styles.goalItemHome : styles.goalItemAway]}>
            <View style={styles.goalTime}>
                <Text style={styles.goalPeriod}>{periodLabel}</Text>
                <Text style={styles.goalTimeText}>{formatTime(clock)}</Text>
            </View>
            <View style={styles.goalContent}>
                <View style={styles.goalScorer}>
                    <Ionicons name="football" size={14} color="#4CAF50" style={{ marginRight: 6 }} />
                    <Text style={styles.goalScorerText} numberOfLines={2}>{scorerName}</Text>
                </View>
                {goalType && goalType !== 'Goal' && goalType !== 'Goal Scored' && goalType.toLowerCase() !== 'goal' && (
                    <Text style={styles.goalTypeTag}>{goalType}</Text>
                )}
                {assistName && (
                    <Text style={styles.goalAssists}>Assist: {assistName}</Text>
                )}
                {teamLabel && (
                    <Text style={styles.teamLabel}>{teamLabel}</Text>
                )}
            </View>
            {hasScore && (
                <View style={styles.goalScoreContainer}>
                    <Text style={[styles.goalScoreNum, isHomeGoal && styles.goalScoreHighlight]}>{homeGoals}</Text>
                    <Text style={styles.goalScoreDash}>-</Text>
                    <Text style={[styles.goalScoreNum, !isHomeGoal && styles.goalScoreHighlight]}>{awayGoals}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    goalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#252525',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8
    },
    goalItemHome: {
        borderLeftWidth: 3,
        borderLeftColor: '#4CAF50'
    },
    goalItemAway: {
        borderRightWidth: 3,
        borderRightColor: '#4CAF50'
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
        alignItems: 'flex-start'
    },
    goalScorerText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        flex: 1
    },
    goalAssists: {
        color: '#888',
        fontSize: 12,
        marginTop: 4
    },
    goalTypeTag: {
        color: '#4CAF50',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4
    },
    teamLabel: {
        color: '#666',
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
        color: '#666',
        fontSize: 16,
        fontWeight: '700'
    },
    goalScoreDash: {
        color: '#666',
        fontSize: 16,
        fontWeight: '700',
        marginHorizontal: 2
    },
    goalScoreHighlight: {
        color: '#fff'
    }
});
