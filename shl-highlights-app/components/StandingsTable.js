import { Fragment } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts';
import { buildFavoriteTokens, standingsRowIsFavorite, getDividerPositions } from '../utils/standingsIdentity';

/**
 * Format stat value for display
 */
const formatStatValue = (value) => {
    if (value === null || value === undefined) { return '-'; }
    return String(value);
};

/**
 * Reusable standings table component
 * Supports both SHL (hockey) and Football standings formats
 * Full width layout that fits without horizontal scrolling
 */
export const StandingsTable = ({
    standings = [],
    selectedTeams = [],
    sport = 'shl', // column set: 'shl' (OW/OL) or 'football' (D)
    league, // league slug — picks the divider rule; falls back to `sport`
    teamRoster = [], // { key, name } list, so a favourite key resolves to its club name
    getTeamKey,
    getTeamLogo,
    onTeamPress
}) => {
    const { colors, isDark } = useTheme();
    
    if (standings.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No standings available.</Text>
            </View>
        );
    }

    const isHockey = sport === 'shl';
    const favoriteTokens = buildFavoriteTokens(selectedTeams, teamRoster);
    const dividerPositions = getDividerPositions(standings, league || sport);

    return (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* Header Row */}
            <View style={[styles.tableRow, styles.tableRowHeader, { backgroundColor: isDark ? '#2c2c2e' : colors.cardHeader, borderBottomColor: colors.cardBorder }]}>
                <Text style={[styles.tableHeaderText, styles.colRank, { color: colors.textSecondary }]}>#</Text>
                <View style={styles.colTeam}>
                    <Text style={[styles.tableHeaderText, styles.textLeft, { color: colors.textSecondary }]}>Team</Text>
                </View>
                <Text style={[styles.tableHeaderText, styles.colStat, { color: colors.textSecondary }]}>GP</Text>
                <Text style={[styles.tableHeaderText, styles.colStat, { color: colors.textSecondary }]}>W</Text>
                {isHockey ? (
                    <>
                        <Text style={[styles.tableHeaderText, styles.colStat, { color: colors.textSecondary }]}>OW</Text>
                        <Text style={[styles.tableHeaderText, styles.colStat, { color: colors.textSecondary }]}>OL</Text>
                    </>
                ) : (
                    <Text style={[styles.tableHeaderText, styles.colStat, { color: colors.textSecondary }]}>D</Text>
                )}
                <Text style={[styles.tableHeaderText, styles.colStat, { color: colors.textSecondary }]}>L</Text>
                <Text style={[styles.tableHeaderText, styles.colGoalDiff, { color: colors.textSecondary }]}>+/-</Text>
                <Text style={[styles.tableHeaderText, styles.colPoints, { color: colors.textSecondary }]}>P</Text>
            </View>

            {/* Data Rows */}
            {standings.map(team => {
                const teamKey = getTeamKey?.(team) || team.teamCode || team.teamShortName;
                // Matched on a normalized club name, not the raw key: the standings
                // feeds and the games feeds (which favourites come from) use
                // different id spaces. See utils/standingsIdentity.
                const isFavorite = standingsRowIsFavorite(team, favoriteTokens);
                const logoUrl = getTeamLogo?.(team);
                const position = Number(team.position);
                const showDivider = dividerPositions.includes(position);

                const RowContainer = onTeamPress ? TouchableOpacity : View;
                const rowProps = onTeamPress
                    ? { activeOpacity: 0.6, onPress: () => onTeamPress(team) }
                    : {};

                return (
                    <Fragment key={team.teamUuid || team.teamCode || team.teamName}>
                        <RowContainer {...rowProps} style={[styles.tableRow, { borderBottomColor: colors.separator }, isFavorite && { backgroundColor: colors.chipActive }]}>
                        <Text style={[styles.tableCell, styles.colRank, { color: colors.text }]}>
                            {formatStatValue(team.position)}
                        </Text>
                        <View style={[styles.colTeam, styles.teamCell]}>
                            {logoUrl ? (
                                <Image
                                    source={{ uri: logoUrl }}
                                    style={styles.teamLogo}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={[styles.teamLogoPlaceholder, { backgroundColor: colors.separator }]} />
                            )}
                            <Text style={[styles.teamName, { color: colors.text }]} numberOfLines={1}>
                                {team.teamShortName || team.teamName || teamKey}
                            </Text>
                        </View>
                        <Text style={[styles.tableCell, styles.colStat, { color: colors.text }]}>
                            {formatStatValue(team.gamesPlayed)}
                        </Text>
                        <Text style={[styles.tableCell, styles.colStat, { color: colors.textSecondary }]}>
                            {formatStatValue(team.wins)}
                        </Text>
                        {isHockey ? (
                            <>
                                <Text style={[styles.tableCell, styles.colStat, { color: colors.textSecondary }]}>
                                    {formatStatValue(team.overtimeWins)}
                                </Text>
                                <Text style={[styles.tableCell, styles.colStat, { color: colors.textSecondary }]}>
                                    {formatStatValue(team.overtimeLosses)}
                                </Text>
                            </>
                        ) : (
                            <Text style={[styles.tableCell, styles.colStat, { color: colors.textSecondary }]}>
                                {formatStatValue(team.draws)}
                            </Text>
                        )}
                        <Text style={[styles.tableCell, styles.colStat, { color: colors.textSecondary }]}>
                            {formatStatValue(team.losses)}
                        </Text>
                        <Text style={[styles.tableCell, styles.colGoalDiff, { color: colors.textSecondary }]}>
                            {formatStatValue(team.goalDiff)}
                        </Text>
                        <Text style={[styles.tableCell, styles.colPoints, { color: colors.text }]}>
                            {formatStatValue(team.points)}
                        </Text>
                        </RowContainer>
                        {showDivider && (
                            <View style={[styles.groupDivider, { backgroundColor: colors.cardBorder }]}>
                                {/* The feed labels its own boundaries ("Relegation playoff",
                                    "Champions League qualifying"); show it when present. */}
                                {team.note ? (
                                    <Text style={[styles.dividerLabel, { color: colors.textMuted, backgroundColor: colors.card }]} numberOfLines={1}>
                                        {team.note}
                                    </Text>
                                ) : null}
                            </View>
                        )}
                    </Fragment>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    tableCard: {
        backgroundColor: '#1c1c1e',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden',
        width: '100%'
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#2c2c2e'
    },
    tableRowHeader: {
        backgroundColor: '#2c2c2e',
        borderBottomColor: '#333',
        paddingVertical: 8
    },
    tableRowActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.08)'
    },
    groupDivider: {
        height: 2,
        backgroundColor: '#444',
        justifyContent: 'center'
    },
    dividerLabel: {
        position: 'absolute',
        right: 8,
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
        paddingHorizontal: 4
    },
    tableCell: {
        color: '#d1d1d6',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center'
    },
    tableHeaderText: {
        color: '#8e8e93',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        textAlign: 'center'
    },
    textLeft: {
        textAlign: 'left'
    },
    colRank: {
        width: 22,
        textAlign: 'center'
    },
    colTeam: {
        flex: 1,
        minWidth: 0
    },
    colStat: {
        width: 26,
        textAlign: 'center'
    },
    colPoints: {
        width: 28,
        textAlign: 'center',
        fontWeight: '700'
    },
    colGoalDiff: {
        width: 32,
        textAlign: 'center'
    },
    mutedCell: {
        color: '#8e8e93'
    },
    teamCell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    teamLogo: {
        width: 18,
        height: 18
    },
    teamLogoPlaceholder: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#2c2c2e'
    },
    teamName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        flex: 1
    },
    emptyContainer: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: '#666', fontSize: 16, textAlign: 'center', padding: 20 }
});
