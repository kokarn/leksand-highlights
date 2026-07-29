import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../contexts';
import { fetchBracket, resolveMediaUrl } from '../api/shl';

const COL_WIDTH = 240;
const CARD_HEIGHT = 94;
const CARD_GAP = 18;
const LANE_PADDING = 10;
const ROUND_HEADER_HEIGHT = 58;

const tieFeeders = (tie) => {
    const explicit = tie?.feederTieKeys || [];
    const resolved = (tie?.teams || []).map((team) => team.fromTieKey).filter(Boolean);
    return [...new Set([...explicit, ...resolved])];
};

export const buildTraditionalBracketLayout = (rounds) => {
    const positions = new Map();
    const slotByKey = new Map();
    const roundLayouts = [];
    const step = CARD_HEIGHT + CARD_GAP;

    // Row-align ties across rounds by their feeder link: a tie that a team
    // advanced FROM sits in the same row slot as the tie it feeds into, so e.g.
    // a club's first-round tie lines up horizontally with its second-round tie.
    // Ties fed by a previous round claim their feeder's slot (probing outward for
    // a free one on collision); seeded entrants fill the remaining lowest slots.
    for (let roundIndex = 0; roundIndex < (rounds || []).length; roundIndex += 1) {
        const round = rounds[roundIndex];
        const roundTies = round.ties || [];
        const used = new Set();
        const slotForTie = new Map();

        const fedTies = [];
        const seededTies = [];
        for (const tie of roundTies) {
            const feederSlots = tieFeeders(tie)
                .map((key) => slotByKey.get(key))
                .filter((value) => Number.isFinite(value));
            if (feederSlots.length > 0) {
                fedTies.push({ tie, feederSlots });
            } else {
                seededTies.push({ tie });
            }
        }

        for (const { tie, feederSlots } of fedTies) {
            const desired = Math.round(feederSlots.reduce((sum, value) => sum + value, 0) / feederSlots.length);
            let slot = desired;
            let offset = 0;
            while (used.has(slot)) {
                offset += 1;
                slot = used.has(desired + offset) ? desired - offset : desired + offset;
            }
            if (slot < 0) {
                slot = 0;
                while (used.has(slot)) {
                    slot += 1;
                }
            }
            used.add(slot);
            slotForTie.set(tie.key, slot);
        }

        let nextFree = 0;
        for (const { tie } of seededTies) {
            while (used.has(nextFree)) {
                nextFree += 1;
            }
            used.add(nextFree);
            slotForTie.set(tie.key, nextFree);
        }

        const ties = roundTies.map((tie) => {
            const slot = slotForTie.get(tie.key) || 0;
            const top = slot * step;
            const center = top + CARD_HEIGHT / 2;
            positions.set(tie.key, center);
            slotByKey.set(tie.key, slot);
            return { tie, top, center };
        });

        const maxSlot = used.size > 0 ? Math.max(...used) : 0;
        const height = Math.max((maxSlot + 1) * step, step);
        roundLayouts.push({ ...round, ties, height });
    }

    const height = Math.max(420, ...roundLayouts.map((round) => round.height));
    return { rounds: roundLayouts, positions, height };
};

const shortDate = (value) => {
    if (!value) {
        return null;
    }
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' }).format(new Date(value));
};

const legLine = (legs) => {
    if (!legs || legs.length === 0) {
        return '';
    }
    return legs
        .map((l) => {
            const played = l.homeScore != null && l.awayScore != null;
            if (!played) {
                const date = shortDate(l.date);
                return `Leg ${l.leg || '?'} · ${date || 'upcoming'}`;
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

    const bracketLayout = useMemo(() => buildTraditionalBracketLayout(data?.rounds || []), [data]);

    const verticalScrollRef = useRef(null);
    const hasAutoScrolledRef = useRef(false);

    const highlight = String(highlightTeamCode || '').toUpperCase();

    const teamMatchesHighlight = useCallback((team) => Boolean(highlight) && (
        (team?.code && team.code.toUpperCase() === highlight)
        || String(team?.name || '').toUpperCase().includes(highlight)
    ), [highlight]);

    // Vertical offset of the first tie that involves the highlighted team, so we
    // can land on its match instead of empty canvas when arriving from a team page.
    const highlightOffset = useMemo(() => {
        if (!highlight) {
            return null;
        }
        for (const round of bracketLayout.rounds) {
            for (const { tie, top } of round.ties) {
                if (tie.teams.some(teamMatchesHighlight)) {
                    return top;
                }
            }
        }
        return null;
    }, [bracketLayout, highlight, teamMatchesHighlight]);

    useEffect(() => {
        if (loading || hasAutoScrolledRef.current || highlightOffset == null) {
            return;
        }
        const y = Math.max(0, highlightOffset - 40);
        const timer = setTimeout(() => {
            if (verticalScrollRef.current) {
                verticalScrollRef.current.scrollTo({ y, animated: true });
                hasAutoScrolledRef.current = true;
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [loading, highlightOffset]);

    const roundContainsHighlight = useCallback((round) => {
        return (round?.ties || []).some((entry) => (entry.tie || entry).teams.some(teamMatchesHighlight));
    }, [teamMatchesHighlight]);

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
        const isHi = teamMatchesHighlight(team);
        return (
            <Pressable
                key={team.id}
                onPress={() => setSelected({ team, tie, roundTitle })}
                style={[styles.teamRow, top && styles.teamRowTop, isHi && { backgroundColor: colors.chipActive }]}
            >
                {team.logo ? (
                    <Image source={{ uri: resolveMediaUrl(team.logo) }} style={styles.logo} resizeMode="contain" />
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
                {team.origin === 'pending' && (
                    <Ionicons name="git-merge-outline" size={12} color={colors.accentOrange} style={styles.advIcon} />
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
        const isOnHighlightedPath = tie.teams.some(teamMatchesHighlight);
        return (
            <View key={tie.key} style={[
                styles.tieCard,
                { backgroundColor: isDark ? '#1c1c1e' : colors.card, borderColor: colors.cardBorder },
                isOnHighlightedPath && { borderColor: colors.accent, borderWidth: 2 }
            ]}>
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
                    <Text style={[styles.hint, { color: colors.textMuted }]}>Scroll to explore the rounds · tap a team to trace its path</Text>
                    <ScrollView
                        ref={verticalScrollRef}
                        style={styles.vScroll}
                        contentContainerStyle={styles.vScrollContent}
                        showsVerticalScrollIndicator
                    >
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.hScroll}
                        style={{ height: bracketLayout.height + LANE_PADDING * 2 + ROUND_HEADER_HEIGHT }}
                    >
                        {bracketLayout.rounds.map((round, roundIndex) => {
                            const laneIsHighlighted = roundContainsHighlight(round);
                            const nextRound = bracketLayout.rounds[roundIndex + 1];
                            return (
                            <View
                                key={round.title}
                                style={[
                                    styles.column,
                                    styles.roundLane,
                                    {
                                        width: COL_WIDTH,
                                        backgroundColor: isDark ? 'rgba(28,28,30,0.72)' : colors.backgroundSecondary,
                                        borderColor: laneIsHighlighted ? colors.accent : colors.cardBorder
                                    }
                                ]}
                            >
                                <View style={[
                                    styles.roundHeader,
                                    { backgroundColor: laneIsHighlighted ? colors.chipActive : colors.card, borderBottomColor: laneIsHighlighted ? colors.accent : colors.cardBorder }
                                ]}>
                                    <View style={[styles.roundNumber, { backgroundColor: laneIsHighlighted ? colors.accent : colors.separator }]}>
                                        <Text style={[styles.roundNumberText, { color: laneIsHighlighted ? '#fff' : colors.textSecondary }]}>{roundIndex + 1}</Text>
                                    </View>
                                    <View style={styles.roundHeaderText}>
                                    <Text style={[styles.roundTitle, { color: laneIsHighlighted ? colors.accent : colors.text }]}>{round.title}</Text>
                                    <Text style={[styles.roundMeta, { color: colors.textMuted }]}>
                                        {round.ties.length > 0
                                            ? `${round.ties.length} ties${round.seededCount ? ` · ${round.seededCount} seeded in` : ''}`
                                            : round.status || 'Draw pending'}
                                    </Text>
                                    </View>
                                </View>
                                <View style={[styles.bracketCanvas, { height: bracketLayout.height + LANE_PADDING * 2 }]}>
                                    {round.ties.map(({ tie, top, center }) => (
                                        <View key={tie.key} style={[styles.positionedTie, { top: top + LANE_PADDING }]}>
                                            {renderTie(tie, round.title)}
                                            {nextRound && (
                                                <>
                                                    {nextRound.ties
                                                        .filter(({ tie: nextTie }) => tieFeeders(nextTie).includes(tie.key))
                                                        .map(({ tie: nextTie, center: nextCenter }) => {
                                                            const targetY = nextCenter + LANE_PADDING;
                                                            const sourceY = center + LANE_PADDING;
                                                            const delta = targetY - sourceY;
                                                            const isPath = tie.teams.some(teamMatchesHighlight) || nextTie.teams.some(teamMatchesHighlight);
                                                            const lineColor = isPath ? colors.accent : colors.cardBorder;
                                                            return (
                                                                <View key={`${tie.key}-${nextTie.key}`} style={styles.tieConnector} pointerEvents="none">
                                                                    <View style={[styles.tieConnectorHorizontal, { backgroundColor: lineColor }]} />
                                                                    <View style={[
                                                                        styles.tieConnectorVertical,
                                                                        { backgroundColor: lineColor, top: Math.min(0, delta), height: Math.max(3, Math.abs(delta)) }
                                                                    ]} />
                                                                    <View style={[styles.tieConnectorTarget, { backgroundColor: lineColor, top: delta }]} />
                                                                    <View style={[styles.tieConnectorArrow, { borderLeftColor: lineColor, top: delta - 5 }]} />
                                                                </View>
                                                            );
                                                        })}
                                                </>
                                            )}
                                        </View>
                                    ))}
                                    {round.ties.length === 0 && (
                                        <View style={[styles.futureCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                                            <Ionicons name="calendar-outline" size={22} color={colors.accent} />
                                            <Text style={[styles.futureTitle, { color: colors.text }]}>Draw not completed yet</Text>
                                            <Text style={[styles.futureDates, { color: colors.textMuted }]}>20 & 27 August 2026</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            );
                        })}
                    </ScrollView>
                    </ScrollView>
                </>
            )}

            {/* Tap-to-trace popover */}
            {selected && (
                <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
                    <Pressable style={[styles.popover, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => {}}>
                        <View style={styles.popHeader}>
                            {selected.team.logo ? (
                                <Image source={{ uri: resolveMediaUrl(selected.team.logo) }} style={styles.popLogo} resizeMode="contain" />
                            ) : (
                                <View style={[styles.popLogo, styles.logoPlaceholder, { backgroundColor: colors.separator }]} />
                            )}
                            <Text style={[styles.popName, { color: colors.text }]}>{selected.team.name}</Text>
                        </View>

                        {(() => {
                            if (selected.team.origin === 'pending') {
                                return (
                                    <Text style={[styles.popLine, { color: colors.textSecondary }]}>
                                        This third-round place is already drawn, but the team depends on the second-round winner.
                                    </Text>
                                );
                            }
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
                            disabled={!selected.team.code}
                        >
                            <Ionicons name="person-outline" size={16} color={colors.accent} />
                            <Text style={[styles.popBtnText, { color: colors.chipTextActive }]}>
                                {selected.team.code ? 'View team page' : 'Team decided after previous round'}
                            </Text>
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
    vScroll: { flex: 1 },
    vScrollContent: { paddingBottom: 32 },
    hScroll: { paddingHorizontal: 12, paddingBottom: 20, gap: 28, alignItems: 'stretch' },
    column: { position: 'relative' },
    roundLane: { borderRadius: 16, borderWidth: 1, overflow: 'visible', minHeight: 420 },
    roundHeader: { minHeight: 58, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopLeftRadius: 15, borderTopRightRadius: 15, borderBottomWidth: 1 },
    roundNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    roundNumberText: { fontSize: 12, fontWeight: '900' },
    roundHeaderText: { flex: 1, minWidth: 0 },
    roundTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
    roundMeta: { fontSize: 10, fontWeight: '600', marginTop: 2 },
    bracketCanvas: { position: 'relative', paddingHorizontal: LANE_PADDING, overflow: 'visible' },
    positionedTie: { position: 'absolute', left: LANE_PADDING, right: LANE_PADDING, height: CARD_HEIGHT, overflow: 'visible' },
    tieConnector: { position: 'absolute', right: -38, top: CARD_HEIGHT / 2, width: 38, height: 1, overflow: 'visible', zIndex: 10 },
    tieConnectorHorizontal: { position: 'absolute', left: 0, top: 0, width: 18, height: 3, borderRadius: 2 },
    tieConnectorVertical: { position: 'absolute', left: 17, width: 3, borderRadius: 2 },
    tieConnectorTarget: { position: 'absolute', left: 17, width: 17, height: 3, borderRadius: 2 },
    tieConnectorArrow: { position: 'absolute', right: 0, width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 8, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
    futureCard: { minHeight: 122, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 7 },
    futureTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
    futureDates: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
    tieCard: { height: CARD_HEIGHT, borderRadius: 12, borderWidth: 1, overflow: 'hidden', paddingBottom: 6 },
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
