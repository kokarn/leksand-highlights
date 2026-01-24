import { memo, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getNationFlag } from '../../api/shl';
import { formatRelativeDateEnglish, formatTime } from '../../utils';
import { DISCIPLINE_ICONS, GENDER_COLORS } from '../../constants';
import { useTheme } from '../../contexts';

const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

export const BiathlonRaceCard = memo(function BiathlonRaceCard({ race, onPress }) {
    const { colors, isDark } = useTheme();
    
    const rawDate = formatRelativeDateEnglish(race?.startDateTime);
    const time = formatTime(race?.startDateTime);
    const isLive = race?.state === 'live';
    const isStartingSoon = race?.state === 'starting-soon';
    const isFinished = race?.state === 'completed';
    const isFinishedToday = isFinished && rawDate === 'Today';

    const statusText = useMemo(() => {
        if (isLive) {
            return 'LIVE';
        }
        if (isStartingSoon) {
            return 'STARTING SOON';
        }
        if (isFinishedToday) {
            return 'Ended';
        }
        return rawDate;
    }, [isLive, isStartingSoon, isFinishedToday, rawDate]);

    const cardColors = useMemo(() => {
        if (isDark) {
            if (isLive) {
                return ['#2a1c1c', '#1c1c1e'];
            }
            if (isStartingSoon) {
                return ['#2a2a1c', '#1c1c1e'];
            }
            return ['#1c1c1e', '#2c2c2e'];
        }
        return [colors.card, colors.backgroundSecondary];
    }, [isLive, isStartingSoon, isDark, colors]);

    // Compact race info string: "10 km • 4×5 shots"
    const raceDetails = useMemo(() => {
        const parts = [];
        if (race?.km) {
            parts.push(`${race.km} km`);
        }
        if (race?.shootings) {
            parts.push(`${race.shootings}×5 shots`);
        }
        return parts.join(' • ');
    }, [race?.km, race?.shootings]);

    // Dynamic font size for discipline text - works on all platforms
    // Base size 26px for short text, scales down for longer text
    const disciplineFontSize = useMemo(() => {
        const text = race?.discipline || '';
        const length = text.length;

        // Shorter text (up to 8 chars): 26px
        if (length <= 8) {
            return 26;
        }
        // Medium text (9-12 chars): 22px
        if (length <= 12) {
            return 22;
        }
        // Longer text (13-18 chars): 18px
        if (length <= 18) {
            return 18;
        }
        // Very long text (19+ chars): 15px
        return 15;
    }, [race?.discipline]);

    const handlePress = useCallback(() => onPress(race), [onPress, race]);

    return (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
            <LinearGradient
                colors={cardColors}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={[styles.raceCard, { borderColor: colors.cardBorder }, isLive && styles.raceCardLive, isStartingSoon && styles.raceCardStartingSoon]}
            >
                {/* Header row */}
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <Text style={[styles.eventType, { color: colors.textMuted }]}>
                            {race.eventType === 'olympics' ? '🏅 Olympics' : 'World Cup'}
                        </Text>
                        <Text style={[styles.eventStage, { color: colors.textMuted }]}>{race.eventName}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={[styles.dateText, { color: colors.textSecondary }, isLive && styles.liveText, isStartingSoon && styles.startingSoonText]}>
                            {statusText}
                        </Text>
                        {!isFinishedToday && <Text style={[styles.timeText, { color: colors.textMuted }]}>{time}</Text>}
                    </View>
                </View>

                {/* Main content row - discipline centered */}
                <View style={styles.mainRow}>
                    <View style={styles.locationContainer}>
                        <Text style={styles.flag}>{getNationFlag(race.country)}</Text>
                    </View>

                    <View style={styles.disciplineContainer}>
                        <Text
                            style={[styles.disciplineText, { fontSize: disciplineFontSize, color: colors.text }]}
                            numberOfLines={2}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                        >
                            {race.discipline}
                        </Text>
                        <Text style={[styles.detailsText, { color: colors.textMuted }]}>{raceDetails}</Text>
                    </View>

                    <View style={styles.genderContainer}>
                        <View style={[styles.genderBadge, { backgroundColor: GENDER_COLORS[race.gender] || '#666' }]}>
                            <Text style={styles.genderText} numberOfLines={1}>{race.genderDisplay}</Text>
                        </View>
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
        flex: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0
    },
    flag: {
        fontSize: 28
    },
    disciplineContainer: {
        flex: 4,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        minWidth: 0
    },
    disciplineText: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
        textAlign: 'center'
    },
    detailsText: {
        color: '#666',
        fontSize: 12,
        marginTop: 4,
        textTransform: 'uppercase'
    },
    genderContainer: {
        flex: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0
    },
    genderBadge: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
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

