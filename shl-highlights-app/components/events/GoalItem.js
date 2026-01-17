import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlayerName, getAssistName, getGoalType } from '../../utils';

export const GoalItem = ({ goal, homeTeamCode, hasVideo, onVideoPress }) => {
    const isHomeGoal = goal.eventTeam?.place === 'home' || goal.eventTeam?.teamCode === homeTeamCode;
    const playerName = getPlayerName(goal.player);
    const assists = [];
    const a1 = getAssistName(goal.assist1);
    const a2 = getAssistName(goal.assist2);
    if (a1) assists.push(a1);
    if (a2) assists.push(a2);
    const homeGoals = goal.homeGoals ?? goal.homeScore ?? 0;
    const awayGoals = goal.awayGoals ?? goal.awayScore ?? 0;
    const goalType = getGoalType(goal);

    return (
        <View style={[styles.goalItem, isHomeGoal ? styles.goalItemHome : styles.goalItemAway]}>
            <View style={styles.goalTime}>
                <Text style={styles.goalPeriod}>P{goal.period}</Text>
                <Text style={styles.goalTimeText}>{goal.time}</Text>
            </View>
            <View style={styles.goalContent}>
                <View style={styles.goalScorer}>
                    <Ionicons name="radio-button-on" size={14} color="#4CAF50" style={{ marginRight: 6 }} />
                    <Text style={styles.goalScorerText}>{playerName}</Text>
                    {goalType && <Text style={styles.goalTypeTag}>{goalType}</Text>}
                </View>
                {assists.length > 0 && (
                    <Text style={styles.goalAssists}>Assists: {assists.join(', ')}</Text>
                )}
                <Text style={styles.eventTypeLabel}>Goal</Text>
            </View>
            <View style={styles.goalRightSection}>
                <View style={styles.goalScoreContainer}>
                    <Text style={[styles.goalScoreNum, isHomeGoal && styles.goalScoreHighlight]}>{homeGoals}</Text>
                    <Text style={styles.goalScoreDash}>-</Text>
                    <Text style={[styles.goalScoreNum, !isHomeGoal && styles.goalScoreHighlight]}>{awayGoals}</Text>
                </View>
                {hasVideo && (
                    <TouchableOpacity onPress={onVideoPress} style={styles.videoIconButton}>
                        <Ionicons name="videocam" size={16} color="#0A84FF" />
                    </TouchableOpacity>
                )}
            </View>
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
        alignItems: 'center'
    },
    goalScorerText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600'
    },
    goalAssists: {
        color: '#888',
        fontSize: 12,
        marginTop: 2
    },
    goalTypeTag: {
        backgroundColor: '#333',
        color: '#4CAF50',
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
        overflow: 'hidden'
    },
    eventTypeLabel: {
        color: '#666',
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
    },
    videoIconButton: {
        marginTop: 6,
        padding: 4
    },
});
