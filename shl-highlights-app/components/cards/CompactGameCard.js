import { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { extractScore, formatTime } from '../../utils';
import { useTheme } from '../../contexts';
import { getTeamName as resolveTeamName, getTeamLogoUri } from '../../utils/teamIdentity';

const getTeamName = (team, fallback) => resolveTeamName(team, { fallback });

// Height of a single compact row incl. marginBottom. Must match the real
// rendered height so FlatList getItemLayout / scroll offsets land correctly.
export const COMPACT_CARD_HEIGHT = 56;

/**
 * A condensed single-row match card for the "All matches" schedule scope, where
 * the full day of fixtures is shown. Layout: home logo + name · centre
 * score/time · away name + logo, with a colored left stripe encoding state
 * (live=red, finished=green, upcoming=accent). Reuses the shared team-identity
 * resolvers so names/logos match the tall cards. Works for both hockey and
 * football via the `family` prop passed to getTeamLogoUri.
 */
export const CompactGameCard = memo(function CompactGameCard({ game, onPress, family = 'football' }) {
    const { colors, isDark } = useTheme();

    const homeTeam = game?.homeTeamInfo ?? {};
    const awayTeam = game?.awayTeamInfo ?? {};
    const isLive = game?.state === 'live';
    const isFinished = game?.state === 'post-game';
    const isUpcoming = !isLive && !isFinished;

    const homeLogo = getTeamLogoUri(homeTeam, family);
    const awayLogo = getTeamLogoUri(awayTeam, family);
    const homeScore = extractScore(null, homeTeam);
    const awayScore = extractScore(null, awayTeam);
    const formattedTime = formatTime(game?.startDateTime);

    const stripeColor = isLive ? '#FF453A' : (isFinished ? '#30D158' : colors.accent);
    const scoreColor = isLive ? '#FF453A' : colors.text;

    const cardColors = isDark
        ? (isLive ? '#2a1c1c' : colors.card)
        : colors.card;

    const renderLogo = (uri) => (
        uri ? (
            <Image source={{ uri }} style={styles.logo} resizeMode="contain" />
        ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: colors.separator }]} />
        )
    );

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <View style={[styles.row, { backgroundColor: cardColors, borderColor: isLive ? '#FF453A' : colors.cardBorder }]}>
                <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

                {/* Home */}
                <View style={styles.homeSide}>
                    {renderLogo(homeLogo)}
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.teamName, { color: colors.text }]}
                    >
                        {getTeamName(homeTeam, 'Home')}
                    </Text>
                </View>

                {/* Centre: score (live/finished) or kickoff time (upcoming) */}
                <View style={styles.centre}>
                    {isUpcoming ? (
                        <Text style={[styles.time, { color: colors.textMuted }]}>{formattedTime}</Text>
                    ) : (
                        <Text style={[styles.score, { color: scoreColor }]}>
                            {homeScore}–{awayScore}
                        </Text>
                    )}
                </View>

                {/* Away */}
                <View style={styles.awaySide}>
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.teamName, styles.teamNameRight, { color: colors.text }]}
                    >
                        {getTeamName(awayTeam, 'Away')}
                    </Text>
                    {renderLogo(awayLogo)}
                </View>
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
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
    homeSide: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0
    },
    awaySide: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        minWidth: 0
    },
    centre: {
        width: 66,
        alignItems: 'center',
        justifyContent: 'center'
    },
    logo: {
        width: 22,
        height: 22
    },
    logoPlaceholder: {
        width: 22,
        height: 22,
        borderRadius: 11
    },
    teamName: {
        fontSize: 13,
        fontWeight: '600',
        flexShrink: 1
    },
    teamNameRight: {
        textAlign: 'right'
    },
    score: {
        fontSize: 16,
        fontWeight: '800',
        fontVariant: ['tabular-nums']
    },
    time: {
        fontSize: 13,
        fontWeight: '700',
        fontVariant: ['tabular-nums']
    }
});
