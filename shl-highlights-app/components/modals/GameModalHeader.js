import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatSwedishDate } from '../../utils';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Shared header component for game modals (SHL, Football, etc.)
 *
 * @param {Object} props
 * @param {Object} props.homeTeam - { name: string, logo: string|null }
 * @param {Object} props.awayTeam - { name: string, logo: string|null }
 * @param {string|number} props.homeScore
 * @param {string|number} props.awayScore
 * @param {string} props.state - 'pre-game' | 'live' | 'post-game'
 * @param {string} props.startDateTime - ISO date string
 * @param {function} props.onClose
 */
export const GameModalHeader = ({
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    state,
    startDateTime,
    onClose
}) => {
    const { colors } = useTheme();
    const { width: windowWidth } = useWindowDimensions();
    const isLive = state === 'live';
    const isCompactHeader = windowWidth <= 430;
    const stateLabel = state === 'post-game'
        ? 'Final'
        : state === 'pre-game'
            ? 'Pre-game'
            : state || '-';

    const themedStyles = createStyles(colors);

    return (
        <View style={themedStyles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={themedStyles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={[themedStyles.scoreHeader, isCompactHeader && themedStyles.scoreHeaderCompact]}>
                <View style={[themedStyles.scoreTeam, isCompactHeader && themedStyles.scoreTeamCompact]}>
                    {homeTeam.logo ? (
                        <Image
                            source={{ uri: homeTeam.logo }}
                            style={[themedStyles.scoreTeamLogo, isCompactHeader && themedStyles.scoreTeamLogoCompact]}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={[themedStyles.teamLogoPlaceholder, isCompactHeader && themedStyles.scoreTeamLogoCompact]} />
                    )}
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                        style={[themedStyles.scoreTeamName, isCompactHeader && themedStyles.scoreTeamNameCompact]}
                    >
                        {homeTeam.name}
                    </Text>
                </View>
                <View style={[themedStyles.scoreCenterBlock, isCompactHeader && themedStyles.scoreCenterBlockCompact]}>
                    <Text style={[themedStyles.scoreLarge, isCompactHeader && themedStyles.scoreLargeCompact]}>
                        {homeScore} - {awayScore}
                    </Text>
                    <View style={[themedStyles.statusBadge, isLive && themedStyles.statusBadgeLive]}>
                        <Text style={themedStyles.statusBadgeText}>{stateLabel}</Text>
                    </View>
                    {state === 'pre-game' && startDateTime && (
                        <Text style={themedStyles.gameDateText}>
                            {formatSwedishDate(startDateTime, 'd MMMM HH:mm')}
                        </Text>
                    )}
                </View>
                <View style={[themedStyles.scoreTeam, isCompactHeader && themedStyles.scoreTeamCompact]}>
                    {awayTeam.logo ? (
                        <Image
                            source={{ uri: awayTeam.logo }}
                            style={[themedStyles.scoreTeamLogo, isCompactHeader && themedStyles.scoreTeamLogoCompact]}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={[themedStyles.teamLogoPlaceholder, isCompactHeader && themedStyles.scoreTeamLogoCompact]} />
                    )}
                    <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                        style={[themedStyles.scoreTeamName, isCompactHeader && themedStyles.scoreTeamNameCompact]}
                    >
                        {awayTeam.name}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    modalHeader: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBorder
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 16,
        zIndex: 10,
        padding: 8
    },
    scoreHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 20
    },
    scoreHeaderCompact: {
        paddingTop: 16
    },
    scoreTeam: {
        alignItems: 'center',
        width: 88
    },
    scoreTeamCompact: {
        width: 82
    },
    scoreTeamLogo: {
        width: 50,
        height: 50,
        marginBottom: 4
    },
    scoreTeamLogoCompact: {
        width: 46,
        height: 46
    },
    teamLogoPlaceholder: {
        width: 50,
        height: 50,
        marginBottom: 4,
        borderRadius: 25,
        backgroundColor: colors.separator
    },
    scoreTeamName: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        width: '100%'
    },
    scoreTeamNameCompact: {
        fontSize: 11
    },
    scoreCenterBlock: {
        alignItems: 'center',
        marginHorizontal: 16
    },
    scoreCenterBlockCompact: {
        marginHorizontal: 10
    },
    scoreLarge: {
        color: colors.text,
        fontSize: 40,
        fontWeight: '800',
        fontVariant: ['tabular-nums']
    },
    scoreLargeCompact: {
        fontSize: 34
    },
    statusBadge: {
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: colors.chip
    },
    statusBadgeLive: {
        backgroundColor: colors.accentRed
    },
    statusBadgeText: {
        color: colors.text,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    gameDateText: {
        color: colors.textSecondary,
        fontSize: 13,
        marginTop: 8
    }
});
