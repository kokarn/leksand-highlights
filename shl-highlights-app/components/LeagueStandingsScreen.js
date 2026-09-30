import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../contexts';
import { LeagueStandingsBlock } from './LeagueStandingsBlock';
import { standingsColumnLayout } from '../utils/standingsPresentation';

/**
 * Standalone league standings screen, reachable from a team page's
 * "View standings" buttons.
 *
 * Owns only the screen chrome — safe area, gradient, back bar, load and error
 * states. The table itself, its card, header, timestamp, the flat-vs-grouped
 * branch and row navigation are LeagueStandingsBlock's, shared with the sport
 * tab and both match modals, so all four surfaces look and behave alike.
 *
 * It highlights the team we arrived from (`?team=` on the route) rather than the
 * user's favourites: `hooks/usePreferences.js` is a plain hook with a single
 * caller and no surrounding context, so reading favourites here would mean
 * adding a provider to app/_layout.tsx. Deliberately left out of scope.
 */
export function LeagueStandingsScreen({ league, family, highlightTeamCode, highlightTeamName }) {
    const router = useRouter();
    const { colors } = useTheme();
    const { width: windowWidth } = useWindowDimensions();
    // Outermost of the three paddings that inset the table; see the block and
    // standingsColumnLayout for why they shrink on a wide screen.
    const { screenPadding } = standingsColumnLayout(windowWidth);
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

    // The arrival team, as a single-entry favourites list plus its own one-entry
    // roster. The roster is what makes the highlight land: the code alone shares
    // no identity token with the standings feed's own label (arriving as DIF,
    // the Allsvenskan table says DJU/"Djurgården"), and the club name is the
    // bridge. The team page sends both, so this costs no extra fetch.
    const highlight = highlightTeamCode ? [String(highlightTeamCode).toUpperCase()] : [];
    const highlightRoster = highlightTeamCode && highlightTeamName
        ? [{ key: String(highlightTeamCode).toUpperCase(), name: String(highlightTeamName) }]
        : [];

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
                <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: screenPadding }]} showsVerticalScrollIndicator={false}>
                    <LeagueStandingsBlock
                        league={league}
                        family={family?.family}
                        data={data}
                        loading={loading}
                        favorites={highlight}
                        teamRoster={highlightRoster}
                    />
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
    loader: { marginTop: 70 },
    message: { alignItems: 'center', paddingVertical: 36 }
});
