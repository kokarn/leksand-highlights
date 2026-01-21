import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatSwedishDate } from '../../utils';

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
    const isLive = state === 'live';
    const stateLabel = state === 'post-game'
        ? 'Final'
        : state === 'pre-game'
            ? 'Pre-game'
            : state || '-';

    return (
        <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.scoreHeader}>
                <View style={styles.scoreTeam}>
                    {homeTeam.logo ? (
                        <Image
                            source={{ uri: homeTeam.logo }}
                            style={styles.scoreTeamLogo}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={styles.teamLogoPlaceholder} />
                    )}
                    <Text style={styles.scoreTeamName}>{homeTeam.name}</Text>
                </View>
                <View style={styles.scoreCenterBlock}>
                    <Text style={styles.scoreLarge}>{homeScore} - {awayScore}</Text>
                    <View style={[styles.statusBadge, isLive && styles.statusBadgeLive]}>
                        <Text style={styles.statusBadgeText}>{stateLabel}</Text>
                    </View>
                    {state === 'pre-game' && startDateTime && (
                        <Text style={styles.gameDateText}>
                            {formatSwedishDate(startDateTime, 'd MMMM HH:mm')}
                        </Text>
                    )}
                </View>
                <View style={styles.scoreTeam}>
                    {awayTeam.logo ? (
                        <Image
                            source={{ uri: awayTeam.logo }}
                            style={styles.scoreTeamLogo}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={styles.teamLogoPlaceholder} />
                    )}
                    <Text style={styles.scoreTeamName}>{awayTeam.name}</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    modalHeader: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
        backgroundColor: '#1c1c1e',
        borderBottomWidth: 1,
        borderBottomColor: '#333'
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
    scoreTeam: {
        alignItems: 'center',
        width: 80
    },
    scoreTeamLogo: {
        width: 50,
        height: 50,
        marginBottom: 4
    },
    teamLogoPlaceholder: {
        width: 50,
        height: 50,
        marginBottom: 4,
        borderRadius: 25,
        backgroundColor: '#2c2c2e'
    },
    scoreTeamName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center'
    },
    scoreCenterBlock: {
        alignItems: 'center',
        marginHorizontal: 20
    },
    scoreLarge: {
        color: '#fff',
        fontSize: 42,
        fontWeight: '800',
        fontVariant: ['tabular-nums']
    },
    statusBadge: {
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#444'
    },
    statusBadgeLive: {
        backgroundColor: '#FF453A'
    },
    statusBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    gameDateText: {
        color: '#aaa',
        fontSize: 13,
        marginTop: 8
    }
});
