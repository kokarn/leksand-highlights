import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';

/**
 * Format stat value for display
 */
const formatStatValue = (value) => {
    if (value === null || value === undefined) return '-';
    return String(value);
};

/**
 * Reusable standings table component
 * Supports both SHL (hockey) and Football standings formats
 */
export const StandingsTable = ({
    standings = [],
    selectedTeams = [],
    sport = 'shl', // 'shl' or 'football'
    getTeamKey,
    getTeamLogo
}) => {
    if (standings.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No standings available.</Text>
            </View>
        );
    }

    const isHockey = sport === 'shl';

    return (
        <View style={styles.tableCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                    {/* Header Row */}
                    <View style={[styles.tableRow, styles.tableRowHeader]}>
                        <Text style={[styles.tableHeaderText, styles.colRank]}>#</Text>
                        <Text style={[styles.tableHeaderText, styles.colTeamHeader]}>Team</Text>
                        <Text style={[styles.tableHeaderText, styles.colStat]}>GP</Text>
                        <Text style={[styles.tableHeaderText, styles.colStat]}>W</Text>
                        {isHockey ? (
                            <>
                                <Text style={[styles.tableHeaderText, styles.colStat]}>OTW</Text>
                                <Text style={[styles.tableHeaderText, styles.colStat]}>OTL</Text>
                            </>
                        ) : (
                            <Text style={[styles.tableHeaderText, styles.colStat]}>D</Text>
                        )}
                        <Text style={[styles.tableHeaderText, styles.colStat]}>L</Text>
                        <Text style={[styles.tableHeaderText, styles.colPoints]}>PTS</Text>
                        <Text style={[styles.tableHeaderText, styles.colGoalDiff]}>GD</Text>
                    </View>

                    {/* Data Rows */}
                    {standings.map(team => {
                        const teamKey = getTeamKey?.(team) || team.teamCode || team.teamShortName;
                        const isFavorite = teamKey && selectedTeams.includes(teamKey);
                        const goalDiffValue = Number(team.goalDiff);
                        const logoUrl = getTeamLogo?.(team);

                        return (
                            <View
                                key={team.teamUuid || team.teamCode || team.teamName}
                                style={[styles.tableRow, isFavorite && styles.tableRowActive]}
                            >
                                <Text style={[styles.tableCell, styles.colRank]}>
                                    {formatStatValue(team.position)}
                                </Text>
                                <View style={styles.teamCell}>
                                    {logoUrl ? (
                                        <Image
                                            source={{ uri: logoUrl }}
                                            style={styles.teamLogo}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <View style={styles.teamLogoPlaceholder} />
                                    )}
                                    <View style={styles.teamTextBlock}>
                                        <Text style={styles.teamName} numberOfLines={1}>
                                            {team.teamShortName || team.teamName || teamKey}
                                        </Text>
                                        {team.note ? (
                                            <Text style={styles.teamNote} numberOfLines={1}>
                                                {team.note}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                                <Text style={[styles.tableCell, styles.colStat]}>
                                    {formatStatValue(team.gamesPlayed)}
                                </Text>
                                <Text style={[styles.tableCell, styles.colStat]}>
                                    {formatStatValue(team.wins)}
                                </Text>
                                {isHockey ? (
                                    <>
                                        <Text style={[styles.tableCell, styles.colStat]}>
                                            {formatStatValue(team.overtimeWins)}
                                        </Text>
                                        <Text style={[styles.tableCell, styles.colStat]}>
                                            {formatStatValue(team.overtimeLosses)}
                                        </Text>
                                    </>
                                ) : (
                                    <Text style={[styles.tableCell, styles.colStat]}>
                                        {formatStatValue(team.draws)}
                                    </Text>
                                )}
                                <Text style={[styles.tableCell, styles.colStat]}>
                                    {formatStatValue(team.losses)}
                                </Text>
                                <Text style={[styles.tableCell, styles.colPoints]}>
                                    {formatStatValue(team.points)}
                                </Text>
                                <Text
                                    style={[
                                        styles.tableCell,
                                        styles.colGoalDiff,
                                        Number.isFinite(goalDiffValue) && goalDiffValue > 0 && styles.positiveValue,
                                        Number.isFinite(goalDiffValue) && goalDiffValue < 0 && styles.negativeValue
                                    ]}
                                >
                                    {formatStatValue(team.goalDiff)}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    tableCard: {
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden'
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2c2c2e'
    },
    tableRowHeader: {
        backgroundColor: '#2c2c2e',
        borderBottomColor: '#333'
    },
    tableRowActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.08)'
    },
    tableCell: {
        color: '#d1d1d6',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center'
    },
    tableHeaderText: {
        color: '#8e8e93',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        textAlign: 'center'
    },
    colRank: { width: 32 },
    colTeamHeader: { width: 170, textAlign: 'left' },
    colStat: { width: 42 },
    colPoints: { width: 50 },
    colGoalDiff: { width: 50 },
    teamCell: {
        width: 170,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    teamLogo: { width: 24, height: 24 },
    teamLogoPlaceholder: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#2c2c2e'
    },
    teamTextBlock: { flex: 1 },
    teamName: { color: '#fff', fontSize: 13, fontWeight: '600' },
    teamNote: { color: '#666', fontSize: 11, marginTop: 2 },
    positiveValue: { color: '#30D158' },
    negativeValue: { color: '#FF453A' },
    emptyContainer: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: '#666', fontSize: 16, textAlign: 'center', padding: 20 }
});
