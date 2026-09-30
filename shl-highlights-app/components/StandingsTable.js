import { Fragment } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../contexts';
import { buildFavoriteTokens, standingsRowIsFavorite, getDividerPositions, getDividerLabel } from '../utils/standingsIdentity';
import { standingsColumnLayout } from '../utils/standingsPresentation';

/**
 * Format stat value for display
 */
const formatStatValue = (value) => {
    if (value === null || value === undefined) { return '-'; }
    return String(value);
};

/**
 * The stat columns to the right of the team name, in order.
 *
 * Returned as descriptors rather than written out as JSX twice, because the set
 * varies along two axes now — hockey shows OW/OL where football shows D, and a
 * wide viewport adds GF/GA — and a header that is built by a different branch
 * than the body is a header that eventually disagrees with it.
 *
 * @param {boolean} isHockey - column set: hockey (OW/OL) vs football (D)
 * @param {boolean} showGoals - whether the viewport has room for GF/GA
 * @returns {Array<{key: string, label: string, field: string, width: 'stat'|'goalDiff'|'points', emphasis?: boolean}>}
 */
const statColumns = (isHockey, showGoals) => [
    { key: 'gp', label: 'GP', field: 'gamesPlayed', width: 'stat', emphasis: true },
    { key: 'w', label: 'W', field: 'wins', width: 'stat' },
    ...(isHockey
        ? [
            { key: 'ow', label: 'OW', field: 'overtimeWins', width: 'stat' },
            { key: 'ol', label: 'OL', field: 'overtimeLosses', width: 'stat' }
        ]
        : [{ key: 'd', label: 'D', field: 'draws', width: 'stat' }]),
    { key: 'l', label: 'L', field: 'losses', width: 'stat' },
    // The feeds always return these; only the phone layout lacks the room.
    ...(showGoals
        ? [
            { key: 'gf', label: 'GF', field: 'goalsFor', width: 'stat' },
            { key: 'ga', label: 'GA', field: 'goalsAgainst', width: 'stat' }
        ]
        : []),
    { key: 'gd', label: '+/-', field: 'goalDiff', width: 'goalDiff' },
    { key: 'p', label: 'P', field: 'points', width: 'points', emphasis: true }
];

/**
 * Reusable standings table component
 * Supports both SHL (hockey) and Football standings formats
 *
 * Fits its width without horizontal scrolling at every size, and actually fills
 * it: past a tablet width the columns FLEX (see standingsColumnLayout) rather
 * than sitting at phone-sized constants, so the row's surplus width is consumed
 * by the cells instead of pooling behind the club name or spreading into dead
 * gaps between columns.
 *
 * Draws no card of its own. It used to — background, 1px border and radius 12 —
 * which was invisible because LeagueStandingsBlock draws exactly the same card
 * one level out, a leftover from when each of the four surfaces wrapped this
 * table itself. On a 390px phone those doubled borders and paddings left the row
 * 318px of 390. The block owns the card; this owns the rows.
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
    const { width: windowWidth } = useWindowDimensions();

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

    const layout = standingsColumnLayout(windowWidth);
    const columns = statColumns(isHockey, layout.showGoals);

    // The feed's own note wins; a league whose feed sends none falls back to the
    // hardcoded boundary names, which is what gives the hockey tables their
    // labels. getDividerLabel needs the rows to tell the two cases apart.
    const dividerLabel = (row, position) =>
        row?.note || getDividerLabel(league || sport, position, standings);

    // Widths and type size come from the viewport, so they are inline rather than
    // in StyleSheet; the static entries below still carry the phone defaults.
    const rowLayout = {
        paddingHorizontal: layout.rowPaddingH,
        paddingVertical: layout.rowPaddingV
    };
    // A stat column is a fixed width on a phone and a flexing one above that.
    // `flexBasis` keeps the measured width as the starting point so the columns
    // hold their relative proportions (a rank column stays narrower than +/-),
    // while flexGrow spends the surplus on the cells. Without this the surplus
    // went into the gaps between columns — 365px of it at 1440px.
    const statStyle = (name) => (layout.fill
        ? { flexGrow: 1, flexShrink: 1, flexBasis: layout[name], maxWidth: layout.statMaxWidth }
        : { width: layout[name] });
    const colWidth = {
        stat: statStyle('stat'),
        goalDiff: statStyle('goalDiff'),
        points: statStyle('points')
    };
    // The name column takes whatever the capped stat columns leave, and keeps a
    // floor so a long club name is not crushed on a mid-width screen.
    const teamColStyle = [styles.colTeam, layout.teamMinWidth ? { minWidth: layout.teamMinWidth } : null];
    const cellText = { fontSize: layout.cellFontSize };
    const headerText = { fontSize: layout.headerFontSize };

    return (
        <View style={styles.table}>
            {/* Header Row */}
            <View style={[styles.tableRow, styles.tableRowHeader, rowLayout, { backgroundColor: isDark ? '#2c2c2e' : colors.cardHeader, borderBottomColor: colors.cardBorder }]}>
                <Text style={[styles.tableHeaderText, headerText, statStyle('rank'), { color: colors.textSecondary }]}>#</Text>
                <View style={teamColStyle}>
                    <Text style={[styles.tableHeaderText, headerText, styles.textLeft, { color: colors.textSecondary }]}>Team</Text>
                </View>
                {columns.map(column => (
                    <Text
                        key={column.key}
                        style={[styles.tableHeaderText, headerText, colWidth[column.width], { color: colors.textSecondary }]}
                    >
                        {column.label}
                    </Text>
                ))}
            </View>

            {/* Data Rows */}
            {standings.map((team, rowIndex) => {
                // The card's own edge closes the table, so the last row's border
                // would double it into a 2px line just inside the radius.
                const isLastRow = rowIndex === standings.length - 1;
                const teamKey = getTeamKey?.(team) || team.teamCode || team.teamShortName;
                // Matched on a normalized club name, not the raw key: the standings
                // feeds and the games feeds (which favourites come from) use
                // different id spaces. See utils/standingsIdentity.
                const isFavorite = standingsRowIsFavorite(team, favoriteTokens);
                const logoUrl = getTeamLogo?.(team);
                const position = Number(team.position);
                const showDivider = dividerPositions.includes(position);
                // Wide enough for the full club name ("Skellefteå AIK"), which the
                // phone layout has to abbreviate to teamShortName.
                const displayName = (layout.fullTeamName
                    ? (team.teamName || team.teamShortName)
                    : (team.teamShortName || team.teamName)) || teamKey;

                const RowContainer = onTeamPress ? TouchableOpacity : View;
                const rowProps = onTeamPress
                    ? { activeOpacity: 0.6, onPress: () => onTeamPress(team) }
                    : {};

                return (
                    <Fragment key={team.teamUuid || team.teamCode || team.teamName}>
                        <RowContainer {...rowProps} style={[styles.tableRow, rowLayout, { borderBottomColor: colors.separator }, isLastRow && styles.tableRowLast, isFavorite && { backgroundColor: colors.chipActive }]}>
                        <Text style={[styles.tableCell, cellText, statStyle('rank'), { color: colors.text }]}>
                            {formatStatValue(team.position)}
                        </Text>
                        <View style={[teamColStyle, styles.teamCell, { gap: layout.teamGap }]}>
                            {logoUrl ? (
                                <Image
                                    source={{ uri: logoUrl }}
                                    style={{ width: layout.logo, height: layout.logo }}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={[styles.teamLogoPlaceholder, { width: layout.logo, height: layout.logo, borderRadius: layout.logo / 2, backgroundColor: colors.separator }]} />
                            )}
                            <Text style={[styles.teamName, cellText, { color: colors.text }]} numberOfLines={1}>
                                {displayName}
                            </Text>
                        </View>
                        {columns.map(column => (
                            <Text
                                key={column.key}
                                style={[
                                    styles.tableCell,
                                    cellText,
                                    column.width === 'points' && styles.cellStrong,
                                    colWidth[column.width],
                                    { color: column.emphasis ? colors.text : colors.textSecondary }
                                ]}
                            >
                                {formatStatValue(team[column.field])}
                            </Text>
                        ))}
                        </RowContainer>
                        {showDivider && (
                            <View style={[styles.groupDivider, { backgroundColor: colors.cardBorder }]}>
                                {/* The feed's own label wins ("Relegation playoff",
                                    "Champions League qualifying") — it survives a
                                    format change. The hockey feeds send no note on
                                    any row, so their boundaries fall back to the
                                    league's own table and stop being bare lines. */}
                                {dividerLabel(team, position) ? (
                                    <Text style={[styles.dividerLabel, { color: colors.textMuted, backgroundColor: colors.card }]} numberOfLines={1}>
                                        {dividerLabel(team, position)}
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
    // No background, border or radius: the enclosing block card supplies all
    // three, and drawing them twice cost 2px of border and 14px of padding a
    // side for no visible difference.
    table: {
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
    tableRowLast: {
        borderBottomWidth: 0
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
    cellStrong: {
        fontWeight: '700'
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
    colTeam: {
        flex: 1,
        minWidth: 0
    },
    mutedCell: {
        color: '#8e8e93'
    },
    teamCell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
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
