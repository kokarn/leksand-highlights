import { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { extractScore, formatSwedishDate } from '../../utils';

const getTeamName = (team, fallback) => {
    return team?.names?.short || team?.names?.long || team?.code || fallback;
};

const getTeamLogo = (team) => {
    return team?.icon || null;
};

export const FootballGameCard = memo(function FootballGameCard({ game, onPress }) {
    const homeTeam = game?.homeTeamInfo ?? {};
    const awayTeam = game?.awayTeamInfo ?? {};
    const isLive = game?.state === 'live';
    const formattedDate = formatSwedishDate(game?.startDateTime);
    const homeScore = extractScore(null, homeTeam);
    const awayScore = extractScore(null, awayTeam);
    const stateLabel = game?.state === 'post-game'
        ? 'Final'
        : game?.state === 'pre-game'
            ? 'Pre-game'
            : game?.state || '-';
    const statusLabel = game?.statusText || stateLabel;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <LinearGradient
                colors={isLive ? ['#2a1c1c', '#1c1c1e'] : ['#1c1c1e', '#2c2c2e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gameCard, isLive && styles.gameCardLive]}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.leagueText}>Allsvenskan</Text>
                    <Text style={[styles.gameDate, isLive && styles.liveTextAccented]}>
                        {isLive ? 'LIVE' : formattedDate}
                    </Text>
                </View>
                <View style={styles.matchupContainer}>
                    <View style={styles.teamContainer}>
                        {getTeamLogo(homeTeam) ? (
                            <Image
                                source={{ uri: getTeamLogo(homeTeam) }}
                                style={styles.teamLogo}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={styles.teamLogoPlaceholder} />
                        )}
                        <Text style={styles.teamName} numberOfLines={1}>
                            {getTeamName(homeTeam, 'Home')}
                        </Text>
                    </View>
                    <View style={styles.scoreContainer}>
                        <Text style={styles.scoreText}>{homeScore} - {awayScore}</Text>
                        <Text style={styles.statusText} numberOfLines={1}>
                            {statusLabel}
                        </Text>
                    </View>
                    <View style={styles.teamContainer}>
                        {getTeamLogo(awayTeam) ? (
                            <Image
                                source={{ uri: getTeamLogo(awayTeam) }}
                                style={styles.teamLogo}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={styles.teamLogoPlaceholder} />
                        )}
                        <Text style={styles.teamName} numberOfLines={1}>
                            {getTeamName(awayTeam, 'Away')}
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
    gameCardLive: {
        borderColor: '#FF453A'
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16
    },
    leagueText: {
        color: '#666',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    gameDate: {
        color: '#8e8e93',
        fontSize: 12,
        fontWeight: '600'
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
        flex: 1,
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
    }
});
