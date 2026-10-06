import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getNationFlag } from '../../api/shl';
import { formatTime } from '../../utils';
import { GENDER_COLORS } from '../../constants';
import { useTheme } from '../../contexts';

/**
 * A condensed single-row biathlon race card, the race counterpart to
 * CompactGameCard. Geometry is deliberately identical (44px row + 12px margin =
 * COMPACT_CARD_HEIGHT, same 4px state stripe) so a mixed cross-sport list has
 * ONE uniform row height and a single layout constant covers every row.
 *
 * A race has no home/away sides, so the two-team geometry is reinterpreted:
 * nation flag + discipline on the left, time-or-status in the centre, gender
 * pill where the away logo would sit.
 *
 * State handling differs from the game card on purpose. Biathlon's raw states
 * are 'live' | 'starting-soon' | 'upcoming' | 'completed', and useUnifiedData's
 * normalizeEvent sets `normalizedState` but spreads the original event — so
 * `state` keeps the biathlon spelling. Testing `state === 'post-game'` the way
 * CompactGameCard does would render every finished race as upcoming, so both
 * spellings are accepted here. 'starting-soon' is a fourth state the game card
 * has no equivalent for, and it keeps the tall card's orange.
 */
export const CompactRaceCard = memo(function CompactRaceCard({ race, onPress }) {
    const { colors, isDark } = useTheme();

    const state = race?.state;
    const normalized = race?.normalizedState;
    const isLive = state === 'live';
    const isStartingSoon = state === 'starting-soon';
    const isFinished = state === 'completed' || normalized === 'post-game';

    const flag = getNationFlag(race?.country);
    const genderColor = GENDER_COLORS[race?.gender] || colors.textMuted;

    // "Sprint · 10 km" — the tall card's separate details line folded into the
    // one label this row has room for. Dropped when absent rather than faked.
    const discipline = race?.discipline || race?.eventName || 'Race';
    const label = race?.km ? `${discipline} · ${race.km} km` : discipline;

    const stripeColor = isLive
        ? '#FF453A'
        : (isStartingSoon ? '#FF9500' : (isFinished ? '#30D158' : colors.accent));

    const cardColors = isLive
        ? (isDark ? '#2a1c1c' : colors.card)
        : (isStartingSoon ? (isDark ? '#2a2a1c' : colors.card) : colors.card);

    const borderColor = isLive
        ? '#FF453A'
        : (isStartingSoon ? '#FF9500' : colors.cardBorder);

    return (
        <TouchableOpacity onPress={() => onPress?.(race)} activeOpacity={0.8}>
            <View style={[styles.row, { backgroundColor: cardColors, borderColor }]}>
                <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

                {/* Left: nation + discipline, where the home team sits */}
                <View style={styles.leftSide}>
                    <Text style={styles.flag}>{flag}</Text>
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.discipline, { color: colors.text }]}
                    >
                        {label}
                    </Text>
                </View>

                {/* Centre: start time, or a result-less race's status. A finished
                    race has no score equivalent — the tall card shows nothing
                    there either — so "Ended" is the honest filler. */}
                <View style={styles.centre}>
                    {isLive ? (
                        <Text style={styles.liveLabel}>LIVE</Text>
                    ) : isFinished ? (
                        <Text style={[styles.status, { color: colors.textMuted }]}>Ended</Text>
                    ) : (
                        <Text style={[styles.time, { color: colors.textMuted }]}>
                            {formatTime(race?.startDateTime)}
                        </Text>
                    )}
                </View>

                {/* Right: gender pill, the one tall-card element worth keeping */}
                <View style={styles.rightSide}>
                    {race?.genderDisplay ? (
                        <View style={[styles.genderPill, { backgroundColor: `${genderColor}22`, borderColor: genderColor }]}>
                            <Text style={[styles.genderText, { color: genderColor }]} numberOfLines={1}>
                                {race.genderDisplay}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    // Mirrors CompactGameCard.styles.row exactly: 44 + 12 = COMPACT_CARD_HEIGHT.
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        marginBottom: 12,
        borderRadius: 10,
        borderWidth: 1,
        overflow: 'hidden',
        paddingRight: 12
    },
    stripe: {
        width: 4,
        height: '100%',
        marginRight: 10
    },
    leftSide: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0
    },
    rightSide: {
        width: 72,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end'
    },
    centre: {
        width: 66,
        alignItems: 'center',
        justifyContent: 'center'
    },
    flag: {
        fontSize: 18
    },
    discipline: {
        fontSize: 13,
        fontWeight: '600',
        flexShrink: 1
    },
    time: {
        fontSize: 13,
        fontWeight: '700',
        fontVariant: ['tabular-nums']
    },
    status: {
        fontSize: 12,
        fontWeight: '700'
    },
    liveLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FF453A'
    },
    genderPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1
    },
    genderText: {
        fontSize: 10,
        fontWeight: '700'
    }
});
