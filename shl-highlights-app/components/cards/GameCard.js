import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getTeamLogoUrl } from '../../api/shl';
import { extractScore, formatSwedishDate } from '../../utils';

export const GameCard = ({ game, onPress }) => {
    const formattedDate = formatSwedishDate(game.startDateTime);
    const isLive = game.state === 'live';
    const homeScore = extractScore(game.homeTeamResult, game.homeTeamInfo);
    const awayScore = extractScore(game.awayTeamResult, game.awayTeamInfo);

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <LinearGradient
                colors={['#1c1c1e', '#2c2c2e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gameCard}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.leagueText}>SHL</Text>
                    <Text style={[styles.gameDate, isLive && styles.liveTextAccented]}>
                        {isLive ? 'LIVE' : formattedDate}
                    </Text>
                </View>
                <View style={styles.matchupContainer}>
                    <View style={styles.teamContainer}>
                        <Image
                            source={{ uri: getTeamLogoUrl(game.homeTeamInfo.code) }}
                            style={styles.teamLogo}
                            resizeMode="contain"
                        />
                        <Text style={styles.teamName} numberOfLines={1}>
                            {game.homeTeamInfo.names.short}
                        </Text>
                    </View>
                    <View style={styles.scoreContainer}>
                        <Text style={styles.scoreText}>{homeScore} - {awayScore}</Text>
                        <Text style={styles.statusText}>
                            {game.state === 'post-game' ? 'Final' : game.state}
                        </Text>
                    </View>
                    <View style={styles.teamContainer}>
                        <Image
                            source={{ uri: getTeamLogoUrl(game.awayTeamInfo.code) }}
                            style={styles.teamLogo}
                            resizeMode="contain"
                        />
                        <Text style={styles.teamName} numberOfLines={1}>
                            {game.awayTeamInfo.names.short}
                        </Text>
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

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
        alignItems: 'center',
        flex: 1
    },
    teamLogo: {
        width: 60,
        height: 60,
        marginBottom: 8
    },
    teamName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center'
    },
    scoreContainer: {
        alignItems: 'center',
        paddingHorizontal: 10
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
