import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getNationFlag } from '../../api/shl';
import { GENDER_COLORS } from '../../constants';
import { formatSwedishDate } from '../../utils';

export const RaceModal = ({ race, visible, onClose }) => {
    const isLiveRace = race?.state === 'live' || race?.state === 'ongoing';
    const isUpcomingRace = race?.state === 'upcoming' || race?.state === 'pre-race';
    const infoNoteText = isLiveRace
        ? 'Live results will appear here during the race.'
        : isUpcomingRace
            ? 'Start lists and results will be available closer to race time.'
            : 'Official results will appear here once published.';

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
                {race && (
                    <>
                        <View style={styles.raceModalHeader}>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                            <View style={styles.raceModalTitleContainer}>
                                <Text style={styles.raceModalEventName}>{race.eventName}</Text>
                                <Text style={styles.raceModalLocation}>
                                    {getNationFlag(race.country)} {race.location}, {race.countryName}
                                </Text>
                            </View>
                        </View>

                        <ScrollView style={styles.raceModalContent}>
                            <View style={styles.raceDetailCard}>
                                <View style={styles.raceDetailHeader}>
                                    <Text style={styles.raceDetailDiscipline}>{race.discipline}</Text>
                                    <View style={[styles.genderBadgeLarge, {
                                        backgroundColor: GENDER_COLORS[race.gender] || '#666'
                                    }]}>
                                        <Text style={styles.genderBadgeTextLarge}>{race.genderDisplay}</Text>
                                    </View>
                                </View>

                                <View style={styles.raceDetailRow}>
                                    <Ionicons name="calendar-outline" size={20} color="#888" />
                                    <Text style={styles.raceDetailLabel}>Date</Text>
                                    <Text style={styles.raceDetailValue}>
                                        {formatSwedishDate(race?.startDateTime, 'd MMMM yyyy')}
                                    </Text>
                                </View>

                                <View style={styles.raceDetailRow}>
                                    <Ionicons name="time-outline" size={20} color="#888" />
                                    <Text style={styles.raceDetailLabel}>Start Time</Text>
                                    <Text style={styles.raceDetailValue}>
                                        {formatSwedishDate(race?.startDateTime, 'HH:mm')} CET
                                    </Text>
                                </View>

                                <View style={styles.raceDetailRow}>
                                    <Ionicons name="trophy-outline" size={20} color="#888" />
                                    <Text style={styles.raceDetailLabel}>Competition</Text>
                                    <Text style={styles.raceDetailValue}>
                                        {race.eventType === 'olympics' ? 'Winter Olympics 2026' : 'IBU World Cup 2025/26'}
                                    </Text>
                                </View>

                                <View style={styles.raceDetailRow}>
                                    <Ionicons name="pulse-outline" size={20} color="#888" />
                                    <Text style={styles.raceDetailLabel}>Status</Text>
                                    <View style={[styles.statusBadge, {
                                        backgroundColor: isLiveRace ? '#FF453A' : isUpcomingRace ? '#30D158' : '#666'
                                    }]}>
                                        <Text style={styles.statusBadgeText}>
                                            {isLiveRace ? 'LIVE' : isUpcomingRace ? 'Upcoming' : 'Completed'}
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
                        </ScrollView>
                    </>
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
});
