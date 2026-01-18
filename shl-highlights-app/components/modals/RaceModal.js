import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getNationFlag } from '../../api/shl';
import { GENDER_COLORS } from '../../constants';
import { formatSwedishDate } from '../../utils';

export const RaceModal = ({ race, details, visible, onClose, loading }) => {
    if (!race) return null;

    const raceInfo = details?.info || race;
    const competition = details?.competition || null;
    const results = Array.isArray(details?.results) ? details.results : null;
    const startList = Array.isArray(details?.startList) ? details.startList : null;
    const hasResults = Boolean(results?.length);
    const hasStartList = Boolean(startList?.length);
    const resultRows = hasResults ? results : (hasStartList ? startList : []);
    const isLiveRace = raceInfo?.state === 'live' || raceInfo?.state === 'ongoing';
    const isStartingSoon = raceInfo?.state === 'starting-soon';
    const isUpcomingRace = raceInfo?.state === 'upcoming' || raceInfo?.state === 'pre-race';

    const getStatusLabel = () => {
        if (competition?.StatusText) {
            return competition.StatusText;
        }
        if (raceInfo?.statusText) {
            return raceInfo.statusText;
        }
        if (isLiveRace) {
            return 'Live';
        }
        if (isStartingSoon) {
            return 'Starting Soon';
        }
        if (isUpcomingRace) {
            return 'Upcoming';
        }
        return 'Completed';
    };
    const statusLabel = getStatusLabel();
    const resultTitle = hasResults ? 'Results' : (hasStartList ? 'Start list' : 'Results');

    let infoNoteText = 'Official results will appear here once published.';
    if (hasResults) {
        infoNoteText = 'Official results are available below.';
    } else if (hasStartList) {
        infoNoteText = 'Start list loaded for this race.';
    } else if (isLiveRace) {
        infoNoteText = 'Live results will appear here during the race.';
    } else if (isStartingSoon) {
        infoNoteText = 'Race is about to begin. Live results will appear shortly.';
    } else if (isUpcomingRace) {
        infoNoteText = 'Start lists and results will be available closer to race time.';
    }

    const getResultRank = (item, index) => {
        // ResultOrder of 10000 is IBU's placeholder for "no result yet"
        const resultOrder = item?.ResultOrder !== 10000 ? item?.ResultOrder : null;
        const rank = item?.Rank ?? resultOrder ?? item?.StartOrder;
        return rank ? String(rank) : String(index + 1);
    };

    const getResultName = (item) => {
        if (!item) return 'Unknown';
        if (item.Name) return item.Name;
        const givenName = item.GivenName || '';
        const familyName = item.FamilyName || '';
        const combined = `${givenName} ${familyName}`.trim();
        return combined || item.ShortName || 'Unknown';
    };

    const getResultNation = (item) => {
        const nation = item?.Nat || item?.Nation || item?.Country;
        return nation ? String(nation) : null;
    };

    const getResultValue = (item) => {
        if (!item) return '-';
        if (item.IRM) return item.IRM;
        if (hasResults) {
            return item.Result || item.TotalTime || item.RunTime || item.Behind || '-';
        }
        if (item.Bib) return `Bib ${item.Bib}`;
        return '-';
    };

    const getResultMeta = (item) => {
        if (!item) return null;
        if (hasResults) {
            const metaParts = [];
            const shooting = item.ShootingTotal || item.Shootings;
            if (shooting) {
                metaParts.push(`Shoot ${shooting}`);
            }
            if (item.Behind && item.Behind !== '0.0' && item.Behind !== '0') {
                metaParts.push(item.Behind);
            }
            return metaParts.length ? metaParts.join(' • ') : null;
        }
        return item.StartInfo || null;
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
                <>
                    <View style={styles.raceModalHeader}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.raceModalTitleContainer}>
                            <Text style={styles.raceModalEventName}>{raceInfo.eventName}</Text>
                            <Text style={styles.raceModalLocation}>
                                {getNationFlag(raceInfo.country)} {raceInfo.location}, {raceInfo.countryName}
                            </Text>
                        </View>
                    </View>

                    <ScrollView style={styles.raceModalContent}>
                        <View style={styles.raceDetailCard}>
                            <View style={styles.raceDetailHeader}>
                                <Text style={styles.raceDetailDiscipline}>{raceInfo.discipline}</Text>
                                <View style={[styles.genderBadgeLarge, {
                                    backgroundColor: GENDER_COLORS[raceInfo.gender] || '#666'
                                }]}>
                                    <Text style={styles.genderBadgeTextLarge}>{raceInfo.genderDisplay}</Text>
                                </View>
                            </View>

                            <View style={styles.raceDetailRow}>
                                <Ionicons name="calendar-outline" size={20} color="#888" />
                                <Text style={styles.raceDetailLabel}>Date</Text>
                                <Text style={styles.raceDetailValue}>
                                    {formatSwedishDate(raceInfo?.startDateTime, 'd MMMM yyyy')}
                                </Text>
                            </View>

                            <View style={styles.raceDetailRow}>
                                <Ionicons name="time-outline" size={20} color="#888" />
                                <Text style={styles.raceDetailLabel}>Start Time</Text>
                                <Text style={styles.raceDetailValue}>
                                    {formatSwedishDate(raceInfo?.startDateTime, 'HH:mm')} CET
                                </Text>
                            </View>

                            <View style={styles.raceDetailRow}>
                                <Ionicons name="trophy-outline" size={20} color="#888" />
                                <Text style={styles.raceDetailLabel}>Competition</Text>
                                <Text style={styles.raceDetailValue}>
                                    {raceInfo.eventType === 'olympics' ? 'Winter Olympics 2026' : 'IBU World Cup 2025/26'}
                                </Text>
                            </View>

                            <View style={styles.raceDetailRow}>
                                <Ionicons name="pulse-outline" size={20} color="#888" />
                                <Text style={styles.raceDetailLabel}>Status</Text>
                                <View style={[styles.statusBadge, {
                                    backgroundColor: isLiveRace ? '#FF453A' : isStartingSoon ? '#FF9500' : isUpcomingRace ? '#30D158' : '#666'
                                }]}>
                                    <Text style={styles.statusBadgeText}>
                                        {statusLabel}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.raceInfoNote}>
                            <Ionicons name="information-circle-outline" size={18} color="#666" />
                            <Text style={styles.raceInfoNoteText}>
                                {infoNoteText}
                            </Text>
                        </View>

                        <View style={styles.resultsCard}>
                            <View style={styles.resultsHeaderRow}>
                                <Text style={styles.resultsTitle}>{resultTitle}</Text>
                                {details?.lastUpdated && (
                                    <Text style={styles.resultsUpdated}>Updated {details.lastUpdated}</Text>
                                )}
                            </View>
                            {loading ? (
                                <View style={styles.resultsLoading}>
                                    <ActivityIndicator size="small" color="#0A84FF" />
                                    <Text style={styles.resultsLoadingText}>Loading results...</Text>
                                </View>
                            ) : resultRows.length > 0 ? (
                                resultRows.map((item, index) => {
                                    const nation = getResultNation(item);
                                    const meta = getResultMeta(item);
                                    const rowKey = item?.IBUId || item?.Name || item?.Bib || item?.StartOrder || index;
                                    return (
                                        <View key={String(rowKey)} style={styles.resultRow}>
                                            <Text style={styles.resultRank}>{getResultRank(item, index)}</Text>
                                            <View style={styles.resultMain}>
                                                <Text style={styles.resultName}>{getResultName(item)}</Text>
                                                {(nation || meta) && (
                                                    <View style={styles.resultMetaRow}>
                                                        {nation && (
                                                            <Text style={styles.resultNation}>
                                                                {getNationFlag(nation)} {nation}
                                                            </Text>
                                                        )}
                                                        {meta && (
                                                            <Text style={styles.resultMetaText}>{meta}</Text>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.resultValue}>{getResultValue(item)}</Text>
                                        </View>
                                    );
                                })
                            ) : (
                                <Text style={styles.emptyText}>Results are not available yet.</Text>
                            )}
                        </View>
                    </ScrollView>
                </>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a'
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 16,
        zIndex: 10,
        padding: 8
    },
    raceModalHeader: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingHorizontal: 16,
        backgroundColor: '#1c1c1e',
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    raceModalTitleContainer: {
        paddingTop: 10
    },
    raceModalEventName: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 6
    },
    raceModalLocation: {
        color: '#888',
        fontSize: 15
    },
    raceModalContent: {
        flex: 1,
        padding: 16
    },
    raceDetailCard: {
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: 20
    },
    raceDetailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24
    },
    raceDetailDiscipline: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '800'
    },
    genderBadgeLarge: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8
    },
    genderBadgeTextLarge: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700'
    },
    raceDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a2a'
    },
    raceDetailLabel: {
        color: '#888',
        fontSize: 14,
        flex: 1
    },
    raceDetailValue: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600'
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6
    },
    statusBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700'
    },
    raceInfoNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 20,
        padding: 16,
        backgroundColor: '#1a1a1a',
        borderRadius: 12
    },
    raceInfoNoteText: {
        color: '#666',
        fontSize: 13,
        flex: 1
    },
    resultsCard: {
        marginTop: 20,
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: 16
    },
    resultsHeaderRow: {
        marginBottom: 12
    },
    resultsTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700'
    },
    resultsUpdated: {
        color: '#666',
        fontSize: 12,
        marginTop: 4
    },
    resultsLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12
    },
    resultsLoadingText: {
        color: '#888',
        fontSize: 13
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a2a'
    },
    resultRank: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        width: 28,
        textAlign: 'center'
    },
    resultMain: {
        flex: 1
    },
    resultName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    },
    resultMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4
    },
    resultNation: {
        color: '#888',
        fontSize: 12
    },
    resultMetaText: {
        color: '#666',
        fontSize: 12
    },
    resultValue: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600'
    },
    emptyText: {
        color: '#666',
        fontSize: 13,
        paddingVertical: 8
    }
});
