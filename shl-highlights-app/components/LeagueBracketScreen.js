import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../contexts';
import { fetchBracket } from '../api/shl';

const COL_WIDTH = 240;
const CARD_HEIGHT = 78;
const CARD_GAP = 20;
const ROUND_HEADER_H = 40;

const legLine = (legs) => {
    if (!legs || legs.length === 0) {
        return '';
    }
    return legs
        .map((l) => {
            const played = l.homeScore != null && l.awayScore != null;
            if (!played) {
                return `Leg ${l.leg || '?'} · upcoming`;
            }
            return `${l.homeScore}–${l.awayScore}`;
        })
        .join('  ·  ');
};

/**
 * Knockout bracket view for a qualifying league. Rounds are columns you scroll
 * horizontally; winners connect rightward with green lines, and teams that were
 * seeded in show an amber side-tag. Tap any team to trace where it came from.
 *
 * Layout is deliberately data-honest: only real winner→next-round links draw a
 * connector; seeded entrants get the amber "seeded in" marker instead of a
 * fake line (UEFA qualifying grows each round, so a clean tree doesn't exist).
 */
export function LeagueBracketScreen({ sport, leagueLabel, highlightTeamCode }) {
    const router = useRouter();
    const { colors, isDark } = useTheme();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null); // { team, tie, roundTitle }

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const bracket = await fetchBracket(sport);
            if (!bracket.rounds || bracket.rounds.length === 0) {
                setError('Bracket not available yet.');
            }
            setData(bracket);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [sport]);

    useEffect(() => {
        load();
    }, [load]);

    // Index every tie by key so a tapped team can resolve its feeder tie.
    const tieIndex = useMemo(() => {
        const map = new Map();
        for (const round of data?.rounds || []) {
            for (const tie of round.ties) {
                map.set(tie.key, { tie, roundTitle: round.title });
            }
        }
        return map;
    }, [data]);

    const highlight = String(highlightTeamCode || '').toUpperCase();

    const openTeam = useCallback((team) => {
        if (!team?.code) {
            return;
        }
        router.push(`/team/football/${encodeURIComponent(team.code.toUpperCase())}`);
    }, [router]);

    const feederFor = useCallback((team) => {
        if (team?.origin !== 'advanced' || !team.fromTieKey) {
            return null;
        }
        return tieIndex.get(team.fromTieKey) || null;
    }, [tieIndex]);

    const renderTeamRow = (team, tie, roundTitle, top) => {
        const isHi = team.code && team.code.toUpperCase() === highlight;
        return (
            <Pressable
                key={team.id}
                onPress={() => setSelected({ team, tie, roundTitle })}
                style={[styles.teamRow, top && styles.teamRowTop, isHi && { backgroundColor: colors.chipActive }]}
            >
                {team.logo ? (
                    <Image source={{ uri: team.logo }} style={styles.logo} resizeMode="contain" />
                ) : (
                    <View style={[styles.logo, styles.logoPlaceholder, { backgroundColor: colors.separator }]} />
                )}
                <Text
                    numberOfLines={1}
                    style={[styles.teamName, { color: team.isWinner ? colors.text : colors.textSecondary }, team.isWinner && styles.winnerName]}
                >
                    {team.name}
                </Text>
                {team.origin === 'seeded' && (
                    <View style={[styles.seedTag, { backgroundColor: 'rgba(255,159,10,0.16)' }]}>
                        <Ionicons name="enter-outline" size={11} color={colors.accentOrange} />
                    </View>
                )}
                {team.origin === 'advanced' && (
                    <Ionicons name="arrow-up" size={12} color={colors.accent} style={styles.advIcon} />
                )}
                <Text style={[styles.agg, { color: team.isWinner ? colors.text : colors.textMuted }]}>
                    {team.aggregate != null ? team.aggregate : '–'}
                </Text>
            </Pressable>
        );
    };

    const renderTie = (tie, roundTitle) => {
        const [teamA, teamB] = tie.teams;
        const edgeColor = tie.completed ? colors.accentGreen : colors.accent;
        return (
            <View key={tie.key} style={[styles.tieCard, { backgroundColor: isDark ? '#1c1c1e' : colors.card, borderColor: colors.cardBorder }]}>
                <View style={[styles.tieEdge, { backgroundColor: edgeColor }]} />
                {teamA && renderTeamRow(teamA, tie, roundTitle, true)}
                {teamB && renderTeamRow(teamB, tie, roundTitle, false)}
                <Text style={[styles.legText, { color: colors.textMuted }]} numberOfLines={1}>{legLine(tie.legs)}</Text>
            </View>
        );
    };

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
                        {(data?.league || leagueLabel || 'Bracket')} · Bracket
                    </Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
            ) : error ? (
                <View style={styles.message}><Text style={{ color: colors.textMuted }}>{error}</Text></View>
            ) : (
                <>
                    <Text style={[styles.hint, { color: colors.textMuted }]}>Scroll sideways through the rounds · tap a team to trace its path</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                        {data.rounds.map((round) => (
                            <View key={round.title} style={[styles.column, { width: COL_WIDTH }]}>
                                <View style={styles.roundHeader}>
                                    <Text style={[styles.roundTitle, { color: colors.accent }]}>{round.title}</Text>
                                    <Text style={[styles.roundMeta, { color: colors.textMuted }]}>
                                        {round.ties.length} ties{round.seededCount ? ` · ${round.seededCount} seeded in` : ''}
                                    </Text>
                                </View>
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.vScroll}>
                                    {round.ties.map((tie) => renderTie(tie, round.title))}
                                </ScrollView>
                            </View>
                        ))}
                    </ScrollView>
                </>
            )}

            {/* Tap-to-trace popover */}
            {selected && (
                <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
                    <Pressable style={[styles.popover, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => {}}>
                        <View style={styles.popHeader}>
                            {selected.team.logo ? (
                                <Image source={{ uri: selected.team.logo }} style={styles.popLogo} resizeMode="contain" />
                            ) : (
                                <View style={[styles.popLogo, styles.logoPlaceholder, { backgroundColor: colors.separator }]} />
                            )}
                            <Text style={[styles.popName, { color: colors.text }]}>{selected.team.name}</Text>
                        </View>

                        {(() => {
                            const feeder = feederFor(selected.team);
                            if (selected.team.origin === 'advanced' && feeder) {
                                const beaten = feeder.tie.teams.find((t) => !t.isWinner);
                                return (
                                    <View>
                                        <Text style={[styles.popLine, { color: colors.textSecondary }]}>
                                            Advanced from the {feeder.roundTitle}
                                        </Text>
                                        {beaten && (
                                            <Text style={[styles.popSub, { color: colors.textMuted }]}>
                                                beat {beaten.name} · {legLine(feeder.tie.legs)}
                                            </Text>
                                        )}
                                    </View>
                                );
                            }
                            return (
                                <Text style={[styles.popLine, { color: colors.textSecondary }]}>
                                    Seeded into the {selected.roundTitle}
                                    <Text style={{ color: colors.textMuted }}>  (entered as a higher-ranked club)</Text>
                                </Text>
                            );
                        })()}

                        <TouchableOpacity
                            style={[styles.popBtn, { backgroundColor: colors.chipActive, borderColor: colors.chipActiveBorder }]}
                            onPress={() => { const t = selected.team; setSelected(null); openTeam(t); }}
                        >
                            <Ionicons name="person-outline" size={16} color={colors.accent} />
                            <Text style={[styles.popBtnText, { color: colors.chipTextActive }]}>View team page</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
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
    hint: { fontSize: 11, fontWeight: '500', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
    hScroll: { paddingHorizontal: 12, paddingBottom: 20 },
    column: { marginRight: 12 },
    roundHeader: { height: ROUND_HEADER_H, justifyContent: 'center' },
    roundTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
    roundMeta: { fontSize: 10, fontWeight: '600', marginTop: 2 },
    vScroll: { paddingBottom: 40 },
    tieCard: { borderRadius: 12, borderWidth: 1, marginBottom: CARD_GAP, overflow: 'hidden', paddingBottom: 6 },
    tieEdge: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
    teamRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, gap: 8 },
    teamRowTop: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
    logo: { width: 20, height: 20 },
    logoPlaceholder: { borderRadius: 10 },
    teamName: { flex: 1, fontSize: 13, fontWeight: '600' },
    winnerName: { fontWeight: '800' },
    seedTag: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    advIcon: { width: 16, textAlign: 'center' },
    agg: { width: 18, textAlign: 'right', fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
    legText: { fontSize: 10, paddingHorizontal: 12, paddingTop: 4 },
    loader: { marginTop: 70 },
    message: { alignItems: 'center', paddingVertical: 36 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
    popover: { width: '100%', maxWidth: 340, borderRadius: 16, borderWidth: 1, padding: 18 },
    popHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    popLogo: { width: 32, height: 32 },
    popName: { fontSize: 18, fontWeight: '800', flex: 1 },
    popLine: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
    popSub: { fontSize: 12, fontWeight: '500', marginTop: 4 },
    popBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, minHeight: 44, borderRadius: 10, borderWidth: 1 },
    popBtnText: { fontSize: 14, fontWeight: '700' }
});
