import { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useTheme } from '../contexts';
import { StandingsTable } from './StandingsTable';
import { getLeagueBySlug } from '../constants/teamFamilies';
import { formatSwedishDate } from '../utils';
import { standingsRowTeamParam } from '../utils/standingsIdentity';
import { standingsColumnLayout, standingsRowKey, standingsRowLogo, standingsSections } from '../utils/standingsPresentation';

/**
 * One league's standings, chrome and all — the single standings surface.
 *
 * Four places in the app show standings: the sport tab's Standings scope, the
 * standalone /standings/<league> screen reached from a team page, and the
 * Standings tab of both match modals. Each used to wrap StandingsTable itself,
 * which meant nine call sites with nine prop sets, four card styles, three
 * different flat-vs-grouped predicates, and four copies of the navigation
 * handler. Two bugs lived in that gap:
 *
 *  - `teamRoster` is what bridges the three disjoint team-id spaces, and only
 *    the sport tab passed it, so favourite highlighting reached 10 of 20
 *    favourites on the other three surfaces instead of 20.
 *  - ShlGameModal navigated by raw standings code, which is exactly what
 *    standingsRowTeamParam exists to avoid.
 *
 * Callers keep their own scroll container and screen chrome; everything from the
 * card inwards belongs here.
 */
export const LeagueStandingsBlock = ({
    // A TEAM_FAMILIES league entry, or its slug — the slug is resolved so a
    // caller that only knows 'allsvenskan' still gets the right label, column
    // set and grouped/flat handling.
    league,
    // Team family ('hockey' | 'football') for the /team/<family>/... push.
    // Omit to render a non-interactive table.
    family,
    data,
    loading = false,
    favorites = [],
    // The games-derived { key, name } roster. Without it a favourite key from
    // one feed cannot reach a standings row from another; see standingsIdentity.
    teamRoster = [],
    title,
    // Modals must dismiss themselves before the router push, or the team page
    // opens behind them.
    onBeforeNavigate,
    style
}) => {
    const router = useRouter();
    const { colors } = useTheme();
    const { width: windowWidth } = useWindowDimensions();
    // This card is THE card: StandingsTable used to draw an identical one inside
    // it (same background, same 1px border, same radius 12), so on a 390px phone
    // the doubled chrome left the row 318px of 390. The table now draws only rows
    // and runs to this card's edges, which is why the horizontal padding here is
    // 0 and the header carries its own inset instead.
    const layout = standingsColumnLayout(windowWidth);

    const resolvedLeague = useMemo(
        () => (typeof league === 'string' ? getLeagueBySlug(league) : league) || null,
        [league]
    );

    const sections = useMemo(
        () => standingsSections(resolvedLeague, data),
        [resolvedLeague, data]
    );

    const navigateToTeam = useCallback((row) => {
        // Navigate by resolved identity, never the raw standings code: six
        // Allsvenskan standings codes (SIR, MAL, GOT, BRO, ÖRG, VAS) exist in no
        // games feed, so those rows used to open an empty team page.
        const param = standingsRowTeamParam(row, teamRoster);
        if (!param || !family) {
            return;
        }
        onBeforeNavigate?.();
        router.push(`/team/${family}/${encodeURIComponent(param)}`);
    }, [router, family, teamRoster, onBeforeNavigate]);

    const standingsSport = resolvedLeague?.standingsSport || 'football';
    const getTeamLogo = useCallback(
        (row) => standingsRowLogo(row, standingsSport),
        [standingsSport]
    );

    const header = (label, lastUpdated) => (
        <View style={[styles.header, { paddingHorizontal: layout.blockHeaderPaddingH, borderBottomColor: colors.cardBorder }]}>
            <Ionicons name="podium-outline" size={16} color={colors.accent} />
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{label}</Text>
            {lastUpdated ? (
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    Updated {formatSwedishDate(lastUpdated, 'd MMM HH:mm')}
                </Text>
            ) : null}
        </View>
    );

    const card = (key, children, extraStyle) => (
        <View
            key={key}
            style={[
                styles.block,
                {
                    paddingHorizontal: layout.blockPaddingH,
                    paddingTop: layout.blockPaddingTop,
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder
                },
                extraStyle,
                style
            ]}
        >
            {children}
        </View>
    );

    const leagueLabel = title || resolvedLeague?.label || 'Standings';

    // Nothing to show yet. Keep the block (and its header) so the surface does
    // not jump once rows arrive, and only spin when there is no data at all —
    // a refetch should leave the previous table on screen.
    if (!sections.length) {
        return card('empty', (
            <>
                {header(leagueLabel, data?.lastUpdated)}
                {loading ? (
                    <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
                ) : (
                    <Text style={[styles.empty, { paddingHorizontal: layout.blockHeaderPaddingH, paddingBottom: layout.blockPaddingTop, color: colors.textMuted }]}>No standings available.</Text>
                )}
            </>
        ));
    }

    return sections.map((section, index) => card(section.id, (
        <>
            {header(section.title || leagueLabel, section.lastUpdated)}
            <StandingsTable
                standings={section.rows}
                selectedTeams={favorites}
                teamRoster={teamRoster}
                sport={standingsSport}
                league={resolvedLeague?.slug}
                getTeamKey={standingsRowKey}
                getTeamLogo={getTeamLogo}
                onTeamPress={family ? navigateToTeam : undefined}
            />
        </>
    ), index > 0 && styles.blockSpaced));
};

const styles = StyleSheet.create({
    // Rounded on top only, and no bottom padding: the last table row IS the card's
    // bottom edge. A bottom radius left white wedges beside the final row's
    // corners, and bottom padding left an empty strip under the table.
    // overflow hidden still matters for the top corners, which the header meets.
    block: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderWidth: 1,
        overflow: 'hidden'
    },
    blockSpaced: { marginTop: 12 },
    // No marginBottom: the table's own header row sits directly below this, and a
    // gap between the two reads as a seam now that the table has no card of its
    // own to separate them.
    header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10, borderBottomWidth: 1 },
    title: { fontSize: 15, fontWeight: '700', flex: 1 },
    meta: { fontSize: 11, fontWeight: '600' },
    // Closes the card itself when there is no table under it yet.
    loader: { marginVertical: 12 },
    empty: { fontSize: 13, fontWeight: '500', textAlign: 'center', paddingVertical: 16 }
});
