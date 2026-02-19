import { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getTeamLogoUrl } from '../../api/shl';
import { extractScore, formatRelativeDateEnglish, formatTime } from '../../utils';
import { useTheme } from '../../contexts';

export const GameCard = memo(function GameCard({ game, onPress }) {
    const { colors, isDark } = useTheme();

    const homeTeam = game?.homeTeamInfo ?? {};
    const awayTeam = game?.awayTeamInfo ?? {};
    const homeCode = homeTeam.code;
    const awayCode = awayTeam.code;
    const homeName = homeTeam?.names?.short ?? homeCode ?? 'Home';
    const awayName = awayTeam?.names?.short ?? awayCode ?? 'Away';
    const homeLogo = getTeamLogoUrl(homeCode);
    const awayLogo = getTeamLogoUrl(awayCode);
    const leagueLabel = 'SHL';
    const isLive = game?.state === 'live';
    const isFinished = game?.state === 'post-game';
    const rawDate = formatRelativeDateEnglish(game?.startDateTime);
    const isFinishedToday = isFinished && rawDate === 'Today';
    const formattedDate = isFinishedToday ? 'Ended' : rawDate;
    const formattedTime = formatTime(game?.startDateTime);
    const homeScore = extractScore(game?.homeTeamResult, homeTeam);
    const awayScore = extractScore(game?.awayTeamResult, awayTeam);
    const gameState = game?.state ?? '-';
    
    const cardColors = isDark 
        ? ['#1c1c1e', '#2c2c2e'] 
        : [colors.card, colors.backgroundSecondary];

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <LinearGradient
                colors={cardColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gameCard, { borderColor: colors.cardBorder }]}
            >
                <View style={styles.cardHeader}>
                    <Text style={[styles.leagueText, { color: colors.textMuted }]}>{leagueLabel}</Text>
                    <View style={styles.headerRight}>
                        <Text style={[styles.gameDate, { color: colors.textSecondary }, isLive && styles.liveTextAccented]}>
                            {isLive ? 'LIVE' : formattedDate}
                        </Text>
                        {!isLive && !isFinishedToday && <Text style={[styles.gameTime, { color: colors.textMuted }]}>{formattedTime}</Text>}
                    </View>
                </View>
                <View style={styles.matchupContainer}>
                    <View style={styles.teamContainer}>
                        {homeLogo ? (
                            <Image
                                source={{ uri: homeLogo }}
                                style={styles.teamLogo}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={[styles.teamLogoPlaceholder, { backgroundColor: colors.separator }]} />
                        )}
                        <Text style={[styles.teamName, { color: colors.text }]}>
                            {homeName}
                        </Text>
                    </View>
                    <View style={styles.scoreContainer}>
                        <Text style={[styles.scoreText, { color: colors.text }]}>{homeScore} - {awayScore}</Text>
                        <Text style={[styles.statusText, { color: colors.textMuted }]}>
                            {gameState === 'post-game' ? 'Final' : gameState === 'pre-game' ? 'Pre-game' : gameState}
                        </Text>
                    </View>
                    <View style={styles.teamContainer}>
                        {awayLogo ? (
                            <Image
                                source={{ uri: awayLogo }}
                                style={styles.teamLogo}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={[styles.teamLogoPlaceholder, { backgroundColor: colors.separator }]} />
                        )}
                        <Text style={[styles.teamName, { color: colors.text }]}>
                            {awayName}
                        </Text>
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    gameCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#333'
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16
    },
    leagueText: {
        color: '#666',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    headerRight: {
        alignItems: 'flex-end'
    },
    gameDate: {
        color: '#8e8e93',
        fontSize: 12,
        fontWeight: '600'
    },
    gameTime: {
        color: '#666',
        fontSize: 11,
        marginTop: 2
    },
    liveTextAccented: {
        color: '#FF453A',
        fontWeight: '800'
    },
    matchupContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    teamContainer: {
        flex: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0
    },
    teamLogo: {
        width: 60,
        height: 60,
        marginBottom: 8
    },
    teamLogoPlaceholder: {
        width: 60,
        height: 60,
        marginBottom: 8,
        borderRadius: 30,
        backgroundColor: '#2c2c2e'
    },
    teamName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center'
    },
    scoreContainer: {
        flex: 4,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        minWidth: 0
    },
    scoreText: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
        fontVariant: ['tabular-nums']
    },
    statusText: {
        color: '#666',
        fontSize: 12,
        marginTop: 4,
        textTransform: 'uppercase'
    },
});
