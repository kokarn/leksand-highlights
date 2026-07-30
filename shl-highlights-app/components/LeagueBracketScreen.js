import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../contexts';
import { fetchBracket, resolveMediaUrl } from '../api/shl';
import { getTeamName as resolveTeamName, getTeamLogoUri } from '../utils/teamIdentity';
import {
    CARD_HEIGHT as LAYOUT_CARD_HEIGHT,
    CARD_GAP as LAYOUT_CARD_GAP,
    tieFeeders,
    buildTraditionalBracketLayout
} from '../utils/bracketLayout';

const COL_WIDTH = 240;
const CARD_HEIGHT = LAYOUT_CARD_HEIGHT;
const CARD_GAP = LAYOUT_CARD_GAP;
const LANE_PADDING = 10;
const ROUND_HEADER_HEIGHT = 58;
const HSCROLL_GAP = 28; // gap between round lanes (hScroll contentContainer gap)

// Layout math (feeder reconstruction, barycenter reorder, spine-anchored feeder
// alignment) lives in utils/bracketLayout.js so it's unit-testable without RN.
export { buildTraditionalBracketLayout };

// Bracket teams now carry the canonical { names: { short, long } } shape from the
// provider (routed through the shared team-identity resolver), so a club reads
// identically here and in cards/pushes. Real ties use `names`; pending draw slots
// ("Winner: A / B") only have a raw `name` — fall back to that.
const bracketTeamName = (team) =>
    resolveTeamName(team, { fallback: team?.name || 'TBD' });

// One logo entry point: knockout leagues are football, so route through the
// football path (upstream icon via proxy). The provider already fills ESPN's
// blank crests from the fallback-badge map before this point.
const bracketTeamLogo = (team) => getTeamLogoUri(team, 'football') || resolveMediaUrl(team?.logo);


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

    // Precompute every feeder connector in ABSOLUTE canvas coordinates so they can
    // be drawn in a single overlay on top of all columns. Connectors nested inside
    // a round column get clipped/painted over by the next column's background, so
    // they can never reach the target card — the overlay avoids that entirely.
    // Column left edge X = roundIndex * (COL_WIDTH + HSCROLL_GAP) + hScroll left pad.
    const connectors = useMemo(() => {
        const rows = bracketLayout.rounds;
        const out = [];
        const cardTop = ROUND_HEADER_HEIGHT + LANE_PADDING;
        for (let ri = 0; ri < rows.length - 1; ri += 1) {
            const round = rows[ri];
            const nextRound = rows[ri + 1];
            const srcColLeft = ri * (COL_WIDTH + HSCROLL_GAP);
            const srcCardRight = srcColLeft + COL_WIDTH - 2 * LANE_PADDING; // tie card right edge
            const dstColLeft = (ri + 1) * (COL_WIDTH + HSCROLL_GAP);
            const dstCardLeft = dstColLeft + 2 * LANE_PADDING; // tie card left edge
            const midX = (srcCardRight + dstCardLeft) / 2; // single shared bend point

            // Ties are reordered (barycenter) + feeder-aligned, so connectors don't
            // cross — a single shared bend x is clean, and aligned feeders draw as
            // one straight horizontal line (no elbow).
            for (const { tie, uid, center } of round.ties) {
                const fed = nextRound.ties.filter(({ tie: nextTie }) => tieFeeders(nextTie).includes(tie.key));
                for (const { tie: nextTie, uid: nextUid, center: nextCenter } of fed) {
                    const isPath = tie.teams.some(teamMatchesHighlight) || nextTie.teams.some(teamMatchesHighlight);
                    out.push({
                        key: `${uid}->${nextUid}`,
                        srcX: srcCardRight,
                        dstX: dstCardLeft,
                        midX,
                        y1: cardTop + center,
                        y2: cardTop + nextCenter,
                        isPath
                    });
                }
            }
        }
        return out;
    }, [bracketLayout, teamMatchesHighlight]);

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
                {(() => { const logoUri = bracketTeamLogo(team); return logoUri ? (
                    <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="contain" />
                ) : (
                    <View style={[styles.logo, styles.logoPlaceholder, { backgroundColor: colors.separator }]} />
                ); })()}
                <Text
                    numberOfLines={1}
                    style={[styles.teamName, { color: team.isWinner ? colors.text : colors.textSecondary }, team.isWinner && styles.winnerName]}
                >
                    {bracketTeamName(team)}
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
                      <View style={styles.canvasWrap}>
                        {bracketLayout.rounds.map((round, roundIndex) => {
                            const laneIsHighlighted = roundContainsHighlight(round);
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
                                    {round.ties.map(({ tie, uid, top }) => (
                                        <View key={uid} style={[styles.positionedTie, { top: top + LANE_PADDING }]}>
                                            {renderTie(tie, round.title)}
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
                        <View style={styles.connectorOverlay} pointerEvents="none">
                            {connectors.map((c) => {
                                const color = c.isPath ? colors.accent : colors.cardBorder;
                                const t = c.isPath ? 3 : 2;
                                const topY = Math.min(c.y1, c.y2);
                                const vH = Math.max(t, Math.abs(c.y2 - c.y1));
                                return (
                                    <View key={c.key} pointerEvents="none">
                                        {/* source card → mid-gutter */}
                                        <View style={{ position: 'absolute', left: c.srcX, top: c.y1 - t / 2, width: c.midX - c.srcX, height: t, backgroundColor: color, borderRadius: 2 }} />
                                        {/* vertical run at mid-gutter */}
                                        <View style={{ position: 'absolute', left: c.midX - t / 2, top: topY - t / 2, width: t, height: vH + t, backgroundColor: color, borderRadius: 2 }} />
                                        {/* mid-gutter → target card */}
                                        <View style={{ position: 'absolute', left: c.midX - t / 2, top: c.y2 - t / 2, width: c.dstX - c.midX + t / 2, height: t, backgroundColor: color, borderRadius: 2 }} />
                                        {/* arrowhead at target card left edge */}
                                        <View style={{ position: 'absolute', left: c.dstX - 6, top: c.y2 - 5, width: 0, height: 0, borderTopWidth: 5, borderBottomWidth: 5, borderLeftWidth: 7, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color }} />
                                    </View>
                                );
                            })}
                        </View>
                      </View>
                    </ScrollView>
                    </ScrollView>
                </>
            )}

            {/* Tap-to-trace popover */}
            {selected && (
                <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
                    <Pressable style={[styles.popover, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => {}}>
                        <View style={styles.popHeader}>
                            {(() => { const logoUri = bracketTeamLogo(selected.team); return logoUri ? (
                                <Image source={{ uri: logoUri }} style={styles.popLogo} resizeMode="contain" />
                            ) : (
                                <View style={[styles.popLogo, styles.logoPlaceholder, { backgroundColor: colors.separator }]} />
                            ); })()}
                            <Text style={[styles.popName, { color: colors.text }]}>{bracketTeamName(selected.team)}</Text>
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
                                                beat {bracketTeamName(beaten)} · {legLine(feeder.tie.legs)}
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
    canvasWrap: { position: 'relative', flexDirection: 'row', gap: 28, alignItems: 'stretch' },
    connectorOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 5 },
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
