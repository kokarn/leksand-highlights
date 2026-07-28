import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../contexts';
import { GameCard, FootballGameCard } from './cards';
import {
    dedupeGames,
    selectCompletedGames,
    selectUpcomingGames,
    computeForm
} from '../utils/teamGames';

const FORM_COLORS = (colors) => ({
    W: colors.accentGreen,
    L: colors.accentRed,
    D: colors.accentOrange,
    OT: colors.accentOrange
});

const VIEW_TABS = [
    { key: 'latest', label: 'Latest' },
    { key: 'upcoming', label: 'Upcoming' }
];

/**
 * Shared team page: latest + upcoming games for one team, across every league
 * in its family. Reused by both hockey and football (and any future similar
 * sport) by passing the matching TEAM_FAMILIES entry.
 *
 * Game cards route back to the main screen's deep-link handler so taps open the
 * existing match modal — we don't duplicate the modal here.
 */
export function TeamGamesScreen({ family, teamCode }) {
    const router = useRouter();
    const { colors, isDark } = useTheme();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [view, setView] = useState('latest');

    const normalizedCode = String(teamCode || '').toUpperCase();

    const loadGames = useCallback(async () => {
        if (!family) {
            setError('Unknown team');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const perLeague = await Promise.all(
                family.leagues.map(async (league) => {
                    const list = await league.fetchGames({ team: normalizedCode });
                    return (list || []).map((game) => ({
                        ...game,
                        sport: game.sport || league.slug,
                        leagueLabel: league.label
                    }));
                })
            );
            setGames(dedupeGames(perLeague.flat()));
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    }, [family, normalizedCode]);

    useEffect(() => {
        loadGames();
    }, [loadGames]);

    const getTeamCode = family?.getTeamCode;

    const completedGames = useMemo(
        () => (getTeamCode ? selectCompletedGames(games, normalizedCode, getTeamCode) : []),
        [games, normalizedCode, getTeamCode]
    );
    const upcomingGames = useMemo(
        () => (getTeamCode ? selectUpcomingGames(games, normalizedCode, getTeamCode) : []),
        [games, normalizedCode, getTeamCode]
    );
    const form = useMemo(
        () => (getTeamCode ? computeForm(completedGames, normalizedCode, getTeamCode, 5) : []),
        [completedGames, normalizedCode, getTeamCode]
    );

    // Identify this team's display info + logo from the first game we can find.
    const teamInfo = useMemo(() => {
        for (const game of games) {
            for (const side of ['homeTeamInfo', 'awayTeamInfo']) {
                const info = game?.[side];
                if (info && String(family.getTeamCode(info) || '').toUpperCase() === normalizedCode) {
                    return info;
                }
            }
        }
        return null;
    }, [games, normalizedCode, family]);

    const teamName = teamInfo ? family.getTeamName(teamInfo) : normalizedCode;
    const teamLogo = teamInfo ? family.getTeamLogo(teamInfo) : null;
    const leagueLabels = family.leagues.map((league) => league.label).join(' · ');

    // Open the match modal via the main screen's deep-link route.
    const openGame = useCallback((game) => {
        const sport = game.sport || family.leagues[0].slug;
        router.push({ pathname: '/', params: { sport, gameId: game.uuid || game.id } });
    }, [router, family]);

    const listData = view === 'latest' ? completedGames : upcomingGames;

    const renderCard = useCallback(({ item }) => {
        const onPress = () => openGame(item);
        if (family.cardType === 'football') {
            return <FootballGameCard game={item} onPress={onPress} leagueLabel={item.leagueLabel} />;
        }
        return <GameCard game={item} onPress={onPress} leagueLabel={item.leagueLabel} />;
    }, [family, openGame]);

    const header = (
        <View>
            <LinearGradient
                colors={isDark ? ['#1c1c1e', '#2c2c2e'] : [colors.card, colors.backgroundSecondary]}
                style={[styles.teamCard, { borderColor: colors.cardBorder }]}
            >
                {teamLogo ? (
                    <Image source={{ uri: teamLogo }} style={styles.teamLogo} resizeMode="contain" />
                ) : (
                    <View style={[styles.teamLogo, styles.teamLogoPlaceholder, { backgroundColor: colors.separator }]} />
                )}
                <View style={styles.teamIdentity}>
                    <Text style={[styles.league, { color: colors.accent }]} numberOfLines={1}>{leagueLabels}</Text>
                    <Text style={[styles.teamName, { color: colors.text }]} numberOfLines={2}>{teamName}</Text>
                    {form.length > 0 && (
                        <View style={styles.formRow}>
                            {form.map((result, index) => (
                                <View key={`${result}-${index}`} style={[styles.formBadge, { backgroundColor: FORM_COLORS(colors)[result] || colors.chip }]}>
                                    <Text style={styles.formBadgeText}>{result}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </LinearGradient>

            <View style={[styles.segmentedControl, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {VIEW_TABS.map((tab) => {
                    const active = view === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.segment, active && { backgroundColor: colors.chipActive, borderColor: colors.chipActiveBorder, borderWidth: 1 }]}
                            onPress={() => setView(tab.key)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.segmentText, { color: active ? colors.chipTextActive : colors.chipText }]}>{tab.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.sectionHeader}>
                <Ionicons name={view === 'latest' ? 'time-outline' : 'calendar-outline'} size={20} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{view === 'latest' ? 'Latest games' : 'Upcoming games'}</Text>
                <Text style={[styles.sectionCount, { color: colors.textMuted }]}>{listData.length}</Text>
            </View>
        </View>
    );

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
                    <Text style={[styles.topTitle, { color: colors.text }]} numberOfLines={1}>{teamName}</Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
            ) : error ? (
                <View style={styles.message}><Text style={{ color: colors.accentRed }}>{error}</Text></View>
            ) : (
                <FlatList
                    data={listData}
                    keyExtractor={(game, index) => String(game.uuid || game.id || index)}
                    renderItem={renderCard}
                    ListHeaderComponent={header}
                    ListEmptyComponent={(
                        <View style={styles.message}>
                            <Text style={{ color: colors.textMuted }}>
                                {view === 'latest' ? 'No completed games yet.' : 'No upcoming games scheduled.'}
                            </Text>
                        </View>
                    )}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                />
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
    content: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 32 },
    teamCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    teamLogo: { width: 72, height: 72, marginRight: 16 },
    teamLogoPlaceholder: { borderRadius: 36 },
    teamIdentity: { flex: 1, minWidth: 0 },
    league: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6 },
    teamName: { fontSize: 24, fontWeight: '800' },
    formRow: { flexDirection: 'row', gap: 4, marginTop: 10 },
    formBadge: { minWidth: 23, height: 23, paddingHorizontal: 5, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    formBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    segmentedControl: { flexDirection: 'row', padding: 4, borderRadius: 10, borderWidth: 1, marginBottom: 20, gap: 4 },
    segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderColor: 'transparent' },
    segmentText: { fontSize: 13, fontWeight: '700' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
    sectionCount: { fontSize: 13, fontWeight: '600' },
    loader: { marginTop: 70 },
    message: { alignItems: 'center', paddingVertical: 36 }
});
