import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { GameCard } from './GameCard';
import { FootballGameCard } from './FootballGameCard';
import { BiathlonRaceCard } from './BiathlonRaceCard';

/**
 * Sport indicator colors
 */
const SPORT_COLORS = {
    shl: '#6C5CE7',              // Purple (matches app icon)
    football: '#30D158',          // Green
    biathlon: '#FF9500'           // Orange
};

/**
 * Unified event card that renders the appropriate sport-specific card
 * with an optional sport indicator
 */
export const UnifiedEventCard = memo(function UnifiedEventCard({ event, onPress, showSportIndicator = true }) {
    const sport = event.sport;
    const sportColor = SPORT_COLORS[sport] || '#666';

    const renderCard = () => {
        if (sport === 'shl') {
            return <GameCard game={event} onPress={() => onPress(event)} />;
        }
        if (sport === 'football') {
            return <FootballGameCard game={event} onPress={() => onPress(event)} />;
        }
        if (sport === 'biathlon') {
            return <BiathlonRaceCard race={event} onPress={() => onPress(event)} />;
        }
        return null;
    };

    if (!showSportIndicator) {
        return renderCard();
    }

    return (
        <View style={styles.container}>
            <View style={[styles.sportIndicator, { backgroundColor: sportColor }]} />
            <View style={styles.cardContainer}>
                {renderCard()}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'stretch'
    },
    sportIndicator: {
        width: 4,
        borderRadius: 2,
        marginRight: 0,
        marginBottom: 16 // Match card marginBottom
    },
    cardContainer: {
        flex: 1
    }
});
