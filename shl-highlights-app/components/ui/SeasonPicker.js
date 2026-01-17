import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Season picker for standings views
 * Shows single season label or multiple season chips
 */
export const SeasonPicker = ({ seasons, selectedSeason, onSelect }) => {
    if (!Array.isArray(seasons) || seasons.length === 0) return null;

    if (seasons.length === 1) {
        return (
            <View style={styles.seasonSingle}>
                <Ionicons name="calendar-outline" size={14} color="#888" />
                <Text style={styles.seasonSingleText}>Season {seasons[0]}</Text>
            </View>
        );
    }

    return (
        <View style={styles.seasonPicker}>
            <Text style={styles.seasonLabel}>Season</Text>
            <View style={styles.seasonChipRow}>
                {seasons.map(season => {
                    const isActive = season === selectedSeason;
                    return (
                        <TouchableOpacity
                            key={season}
                            style={[styles.seasonChip, isActive && styles.seasonChipActive]}
                            onPress={() => onSelect?.(season)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.seasonChipText, isActive && styles.seasonChipTextActive]}>
                                {season}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    seasonSingle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6
    },
    seasonSingleText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600'
    },
    seasonPicker: {
        gap: 10
    },
    seasonLabel: {
        color: '#888',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    seasonChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    seasonChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: '#252525',
        borderWidth: 1,
        borderColor: '#333'
    },
    seasonChipActive: {
        backgroundColor: '#0A84FF',
        borderColor: '#0A84FF'
    },
    seasonChipText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600'
    },
    seasonChipTextActive: {
        color: '#fff'
    }
});
