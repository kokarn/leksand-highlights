import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getNationFlag } from '../../api/shl';
import { formatRelativeDate, formatSwedishDate } from '../../utils';
import { DISCIPLINE_ICONS, GENDER_COLORS } from '../../constants';

export const BiathlonRaceCard = memo(function BiathlonRaceCard({ race, onPress }) {
    const relativeDate = formatRelativeDate(race?.startDateTime);
    const time = formatSwedishDate(race?.startDateTime, 'HH:mm');
    const isLive = race?.state === 'live';

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <LinearGradient
                colors={isLive ? ['#2a1c1c', '#1c1c1e'] : ['#1c1c1e', '#2c2c2e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.raceCard, isLive && styles.raceCardLive]}
            >
                <View style={styles.raceCardHeader}>
                    <View style={styles.raceTypeContainer}>
                        <Text style={styles.raceEventType}>
                            {race.eventType === 'olympics' ? '🏅 Olympics' : 'World Cup'}
                        </Text>
                    </View>
                    <View style={styles.raceDateTimeContainer}>
                        <Text style={[styles.raceDate, isLive && styles.liveTextAccented]}>
                            {isLive ? 'LIVE' : relativeDate}
                        </Text>
                        <Text style={styles.raceTime}>{time}</Text>
                    </View>
                </View>

                <View style={styles.raceMainContent}>
                    <View style={styles.raceDisciplineRow}>
                        <Ionicons
                            name={DISCIPLINE_ICONS[race.discipline] || 'ellipse-outline'}
                            size={22}
                            color={GENDER_COLORS[race.gender] || '#fff'}
                        />
                        <Text style={styles.raceDiscipline}>{race.discipline}</Text>
                        <View style={[styles.genderBadge, { backgroundColor: GENDER_COLORS[race.gender] || '#666' }]}>
                            <Text style={styles.genderBadgeText}>{race.genderDisplay}</Text>
                        </View>
                    </View>
                    <View style={styles.raceLocationRow}>
                        <Text style={styles.raceFlag}>{getNationFlag(race.country)}</Text>
                        <Text style={styles.raceLocation}>{race.location}</Text>
                        <Text style={styles.raceCountry}>{race.countryName}</Text>
                    </View>
                </View>

                {race.eventName && (
                    <Text style={styles.raceEventName}>{race.eventName}</Text>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    raceCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#333'
    },
    raceCardLive: {
        borderColor: '#FF453A'
    },
    raceCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12
    },
    raceTypeContainer: {},
    raceEventType: {
        color: '#666',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    raceDateTimeContainer: {
        alignItems: 'flex-end'
    },
    raceDate: {
        color: '#8e8e93',
        fontSize: 13,
        fontWeight: '600'
    },
    raceTime: {
        color: '#666',
        fontSize: 12,
        marginTop: 2
    },
    liveTextAccented: {
        color: '#FF453A',
        fontWeight: '800'
    },
    raceMainContent: {
        gap: 10
    },
    raceDisciplineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    raceDiscipline: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        flex: 1
    },
    genderBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6
    },
    genderBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700'
    },
    raceLocationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    raceFlag: {
        fontSize: 20
    },
    raceLocation: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600'
    },
    raceCountry: {
        color: '#666',
        fontSize: 13
    },
    raceEventName: {
        color: '#555',
        fontSize: 12,
        marginTop: 10,
        fontWeight: '500'
    },
});
