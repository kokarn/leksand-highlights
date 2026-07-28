import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../contexts';
import { StandingsTable } from './StandingsTable';
import { getTeamLogoUrl, resolveMediaUrl } from '../api/shl';
import { formatSwedishDate } from '../utils';

const teamLogoFor = (league, team) => {
    // Hockey tables key logos off the local static PNG by code; football uses the
    // upstream icon URL. StandingsTable receives the resolved URL either way.
    if (league.standingsSport === 'shl') {
        const code = team?.teamCode || team?.teamShortName;
        return code ? getTeamLogoUrl(code) : resolveMediaUrl(team?.teamIcon);
    }
    return resolveMediaUrl(team?.teamIcon || team?.icon);
};

const teamKeyFor = (team) => team?.teamCode || team?.code || team?.key || team?.teamShortName;

/**
 * Standalone league standings screen, reachable from a team page's
 * "View standings" buttons. Reuses the same StandingsTable component the game
 * modals use, and the same per-league config in TEAM_FAMILIES — supporting both
 * flat tables (SHL, HockeyAllsvenskan, Allsvenskan) and grouped tables
 * (Svenska Cupen). Tapping a row navigates to that team's page.
 */
export function LeagueStandingsScreen({ league, family, highlightTeamCode }) {
    const router = useRouter();
    const { colors } = useTheme();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!league || !league.hasStandings) {
            setError('No standings available for this league.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            setData(await league.fetchStandings());
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, [league]);

    useEffect(() => {
        load();
    }, [load]);

    const navigateToTeam = useCallback((team) => {
        const code = teamKeyFor(team);
        if (!code || !family) {
            return;
        }
        router.push(`/team/${family.family}/${encodeURIComponent(String(code).toUpperCase())}`);
    }, [router, family]);

    const highlight = highlightTeamCode ? [String(highlightTeamCode).toUpperCase()] : [];
    const lastUpdated = data?.lastUpdated ? formatSwedishDate(data.lastUpdated, 'd MMM HH:mm') : null;
    const isGroups = league?.standingsFormat === 'groups';
    const groups = isGroups ? (data?.groups || []) : null;
    const rows = !isGroups && Array.isArray(data?.standings) ? data.standings : [];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
            <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={StyleSheet.absoluteFill} />
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                    onPress={() => router.back()}
                >
                    <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <View style={[styles.titleBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.topTitle, { color: colors.text }]} numberOfLines={1}>
                        {league ? `${league.label} Standings` : 'Standings'}
                    </Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
            ) : error ? (
                <View style={styles.message}><Text style={{ color: colors.textMuted }}>{error}</Text></View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {lastUpdated && (
                        <Text style={[styles.updated, { color: colors.textSecondary }]}>Updated {lastUpdated}</Text>
                    )}
                    {isGroups ? (
                        groups.length === 0 ? (
                            <View style={styles.message}><Text style={{ color: colors.textMuted }}>No standings available.</Text></View>
                        ) : (
                            groups.map((group) => (
                                <View key={group.id || group.name} style={styles.groupBlock}>
                                    <Text style={[styles.groupTitle, { color: colors.text }]}>{group.name}</Text>
                                    <StandingsTable
                                        standings={group.standings || []}
                                        selectedTeams={highlight}
                                        sport={league.standingsSport}
                                        getTeamKey={teamKeyFor}
                                        getTeamLogo={(team) => teamLogoFor(league, team)}
                                        onTeamPress={navigateToTeam}
                                    />
                                </View>
                            ))
                        )
                    ) : (
                        <StandingsTable
                            standings={rows}
                            selectedTeams={highlight}
                            sport={league.standingsSport}
                            getTeamKey={teamKeyFor}
                            getTeamLogo={(team) => teamLogoFor(league, team)}
                            onTeamPress={navigateToTeam}
                        />
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
    titleBox: { flex: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
    topTitle: { fontSize: 15, fontWeight: '600' },
    content: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 32 },
    updated: { fontSize: 12, fontWeight: '600', marginBottom: 12, paddingHorizontal: 4 },
    groupBlock: { marginBottom: 20 },
    groupTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, paddingHorizontal: 4 },
    loader: { marginTop: 70 },
    message: { alignItems: 'center', paddingVertical: 36 }
});
