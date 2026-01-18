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

export const BiathlonRaceCard = memo(function BiathlonRaceCard({ race, onPress }) {
    const relativeDate = formatRelativeDate(race?.startDateTime);
    const time = formatSwedishDate(race?.startDateTime, 'HH:mm');
    const isLive = race?.state === 'live';
    const isStartingSoon = race?.state === 'starting-soon';

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

    // Compact race info string: "10 km • 4×5 🎯"
    const raceDetails = useMemo(() => {
        const parts = [];
        if (race?.km) {
            parts.push(`${race.km} km`);
        }
        if (race?.shootings) {
            parts.push(`${race.shootings}×5 🎯`);
        }
        return parts.join(' • ');
    }, [race?.km, race?.shootings]);

    const handlePress = useCallback(() => onPress(race), [onPress, race]);

    return (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
            <LinearGradient
                colors={cardColors}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={[styles.raceCard, isLive && styles.raceCardLive, isStartingSoon && styles.raceCardStartingSoon]}
            >
                {/* Header row */}
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.eventType}>
                            {race.eventType === 'olympics' ? '🏅 Olympics' : 'World Cup'}
                        </Text>
                        <Text style={styles.eventStage}>{race.eventName}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={[styles.dateText, isLive && styles.liveText, isStartingSoon && styles.startingSoonText]}>
                            {statusText}
                        </Text>
                        <Text style={styles.timeText}>{time}</Text>
                    </View>
                </View>

                {/* Main content row - discipline centered */}
                <View style={styles.mainRow}>
                    <View style={styles.locationContainer}>
                        <Text style={styles.flag}>{getNationFlag(race.country)}</Text>
                        <Text style={styles.location} numberOfLines={1}>{race.location}</Text>
                    </View>

                    <View style={styles.disciplineContainer}>
                        <Ionicons
                            name={DISCIPLINE_ICONS[race.discipline] || 'ellipse-outline'}
                            size={28}
                            color={GENDER_COLORS[race.gender] || '#fff'}
                        />
                        <Text style={styles.discipline}>{race.discipline}</Text>
                        {raceDetails ? <Text style={styles.raceDetails}>{raceDetails}</Text> : null}
                    </View>

                    <View style={[styles.genderBadge, { backgroundColor: GENDER_COLORS[race.gender] || '#666' }]}>
                        <Text style={styles.genderText}>{race.genderDisplay}</Text>
                    </View>
                </View>

                {/* Live indicator */}
                {isLive && (
                    <View style={styles.liveIndicator}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveIndicatorText}>Tap for live results</Text>
                    </View>
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
    // Header
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16
    },
    headerLeft: {
        flex: 1
    },
    eventType: {
        color: '#666',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    eventStage: {
        color: '#555',
        fontSize: 11,
        marginTop: 2
    },
    headerRight: {
        alignItems: 'flex-end'
    },
    dateText: {
        color: '#8e8e93',
        fontSize: 12,
        fontWeight: '600'
    },
    timeText: {
        color: '#666',
        fontSize: 11,
        marginTop: 2
    },
    liveText: {
        color: '#FF453A',
        fontWeight: '800'
    },
    startingSoonText: {
        color: '#FF9500',
        fontWeight: '800'
    },
    // Main row
    mainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    locationContainer: {
        flex: 1,
        alignItems: 'center'
    },
    flag: {
        fontSize: 28
    },
    location: {
        color: '#888',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
        textAlign: 'center'
    },
    disciplineContainer: {
        flex: 2,
        alignItems: 'center'
    },
    discipline: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 4
    },
    raceDetails: {
        color: '#666',
        fontSize: 11,
        marginTop: 2
    },
    genderBadge: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8
    },
    genderText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700'
    },
    // Live indicator
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 69, 58, 0.3)'
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FF453A'
    },
    liveIndicatorText: {
        color: '#FF453A',
        fontSize: 11,
        fontWeight: '600'
    }
});

