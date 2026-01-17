import { View, Text, Modal, ScrollView, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { extractScore, formatSwedishDate } from '../../utils';

const getTeamName = (team, fallback) => {
    return team?.names?.short || team?.names?.long || team?.code || fallback;
};

const getTeamLogo = (team) => {
    return team?.icon || null;
};

export const FootballMatchModal = ({ match, details, visible, onClose, loading }) => {
    if (!match) return null;

    const info = details?.info || match;
    const homeTeam = info?.homeTeamInfo || match?.homeTeamInfo || {};
    const awayTeam = info?.awayTeamInfo || match?.awayTeamInfo || {};
    const homeScore = extractScore(null, homeTeam);
    const awayScore = extractScore(null, awayTeam);
    const isLive = info?.state === 'live';
    const stateLabel = info?.state === 'post-game'
        ? 'Final'
        : info?.state === 'pre-game'
            ? 'Pre-game'
            : info?.state || '-';
    const statusLabel = info?.statusText || match?.statusText || stateLabel;
    const startDateTime = info?.startDateTime || match?.startDateTime;
    const venueName = info?.venueInfo?.name
        || details?.venue?.fullName
        || details?.venue?.shortName
        || match?.venueInfo?.name
        || '-';

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Allsvenskan</Text>
                    <Text style={styles.headerSubtitle}>Football</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#0A84FF" style={{ marginTop: 40 }} />
                ) : (
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        <View style={styles.scoreCard}>
                            <View style={styles.teamColumn}>
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
                            <View style={styles.scoreColumn}>
                                <Text style={styles.scoreText}>{homeScore} - {awayScore}</Text>
                                <View style={[styles.statusBadge, isLive && styles.statusBadgeLive]}>
                                    <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                                </View>
                            </View>
                            <View style={styles.teamColumn}>
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

                        <View style={styles.detailCard}>
                            <View style={styles.detailRow}>
                                <Ionicons name="calendar-outline" size={18} color="#888" />
                                <Text style={styles.detailLabel}>Date</Text>
                                <Text style={styles.detailValue}>{formatSwedishDate(startDateTime, 'd MMMM yyyy')}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Ionicons name="time-outline" size={18} color="#888" />
                                <Text style={styles.detailLabel}>Kickoff</Text>
                                <Text style={styles.detailValue}>{formatSwedishDate(startDateTime, 'HH:mm')}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Ionicons name="location-outline" size={18} color="#888" />
                                <Text style={styles.detailLabel}>Venue</Text>
                                <Text style={styles.detailValue} numberOfLines={2}>{venueName}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Ionicons name="pulse-outline" size={18} color="#888" />
                                <Text style={styles.detailLabel}>Status</Text>
                                <Text style={styles.detailValue}>{statusLabel}</Text>
                            </View>
                        </View>
                    </ScrollView>
                )}
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a'
    },
    header: {
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
    headerTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        paddingTop: 10
    },
    headerSubtitle: {
        color: '#666',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    content: {
        flex: 1,
        padding: 16
    },
    scoreCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16
    },
    teamColumn: {
        alignItems: 'center',
        flex: 1
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
    scoreColumn: {
        alignItems: 'center',
        paddingHorizontal: 12
    },
    scoreText: {
        color: '#fff',
        fontSize: 30,
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
    detailCard: {
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: 16
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a2a'
    },
    detailLabel: {
        color: '#888',
        fontSize: 14,
        flex: 1
    },
    detailValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        textAlign: 'right'
    }
});
