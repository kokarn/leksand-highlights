import { memo, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getNationFlag } from '../../api/shl';
import { formatRelativeDate, formatSwedishDate } from '../../utils';
import { DISCIPLINE_ICONS, GENDER_COLORS } from '../../constants';

// Static color arrays to avoid re-creating on every render
const CARD_COLORS_LIVE = ['#2a1c1c', '#1c1c1e'];
const CARD_COLORS_STARTING = ['#2a2a1c', '#1c1c1e'];
const CARD_COLORS_DEFAULT = ['#1c1c1e', '#2c2c2e'];
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

/**
 * Get shooting stage description based on discipline
 */
function getShootingInfo(race) {
    const shootings = race?.shootings;
    if (!shootings) {
        return null;
    }

    // Format: "4 × 5 targets" for pursuit/individual, "2 × 5 targets" for sprint
    return `${shootings} × 5 🎯`;
}

/**
 * Get distance if available
 */
function getDistanceInfo(race) {
    const km = race?.km;
    if (!km) {
        return null;
    }
    return `${km} km`;
}

export const BiathlonRaceCard = memo(function BiathlonRaceCard({ race, onPress }) {
    const relativeDate = formatRelativeDate(race?.startDateTime);
    const time = formatSwedishDate(race?.startDateTime, 'HH:mm');
    const isLive = race?.state === 'live';
    const isStartingSoon = race?.state === 'starting-soon';

    const shootingInfo = getShootingInfo(race);
    const distanceInfo = getDistanceInfo(race);

    const statusText = useMemo(() => {
        if (isLive) {
            return 'LIVE';
        }
        if (isStartingSoon) {
            return 'STARTING SOON';
        }
        return relativeDate;
    }, [isLive, isStartingSoon, relativeDate]);

    const cardColors = useMemo(() => {
        if (isLive) {
            return CARD_COLORS_LIVE;
        }
        if (isStartingSoon) {
            return CARD_COLORS_STARTING;
        }
        return CARD_COLORS_DEFAULT;
    }, [isLive, isStartingSoon]);

    const handlePress = useCallback(() => onPress(race), [onPress, race]);

    return (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
            <LinearGradient
                colors={cardColors}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={[styles.raceCard, isLive && styles.raceCardLive, isStartingSoon && styles.raceCardStartingSoon]}
            >
                <View style={styles.raceCardHeader}>
                    <View style={styles.raceTypeContainer}>
                        <Text style={styles.raceEventType}>
                            {race.eventType === 'olympics' ? '🏅 Olympics' : 'World Cup'}
                        </Text>
                    </View>
                    <View style={styles.raceDateTimeContainer}>
                        <Text style={[styles.raceDate, isLive && styles.liveTextAccented, isStartingSoon && styles.startingSoonTextAccented]}>
                            {statusText}
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

                    {/* Race info row with distance and shooting */}
                    {(distanceInfo || shootingInfo) && (
                        <View style={styles.raceInfoRow}>
                            {distanceInfo && (
                                <View style={styles.infoChip}>
                                    <Ionicons name="trail-sign-outline" size={12} color="#888" />
                                    <Text style={styles.infoChipText}>{distanceInfo}</Text>
                                </View>
                            )}
                            {shootingInfo && (
                                <View style={styles.infoChip}>
                                    <Text style={styles.infoChipText}>{shootingInfo}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.raceLocationRow}>
                        <Text style={styles.raceFlag}>{getNationFlag(race.country)}</Text>
                        <Text style={styles.raceLocation}>{race.location}</Text>
                        <Text style={styles.raceCountry}>{race.countryName}</Text>
                    </View>
                </View>

                {/* Live indicator with pulsing animation hint */}
                {isLive && (
                    <View style={styles.liveIndicator}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>Race in progress - tap for live results</Text>
                    </View>
                )}

                {race.eventName && !isLive && (
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
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#333'
    },
    raceCardLive: {
        borderColor: '#FF453A'
    },
    raceCardStartingSoon: {
        borderColor: '#FF9500'
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
    startingSoonTextAccented: {
        color: '#FF9500',
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
    // New race info row
    raceInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 2
    },
    infoChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    infoChipText: {
        color: '#888',
        fontSize: 11,
        fontWeight: '600'
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
    // Live indicator
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 69, 58, 0.3)'
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF453A'
    },
    liveText: {
        color: '#FF453A',
        fontSize: 12,
        fontWeight: '600'
    },
    raceEventName: {
        color: '#555',
        fontSize: 12,
        marginTop: 10,
        fontWeight: '500'
    },
});
