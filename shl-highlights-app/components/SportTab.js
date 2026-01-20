import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SPORT_NAMES = {
    all: 'All',
    shl: 'Hockey',
    biathlon: 'Biathlon',
    football: 'Football'
};

export const SportTab = ({ sport, isActive, onPress }) => (
    <TouchableOpacity
        style={[styles.sportTab, isActive && styles.sportTabActive]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <Ionicons
            name={sport === 'all'
                ? 'grid-outline'
                : sport === 'biathlon'
                    ? 'locate-outline'
                    : sport === 'football'
                        ? 'football-outline'
                        : 'snow-outline'}
            size={14}
            color={isActive ? '#0A84FF' : '#666'}
        />
        <Text style={[styles.sportTabText, isActive && styles.sportTabTextActive]}>
            {SPORT_NAMES[sport] || sport}
        </Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    sportTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#1c1c1e',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333'
    },
    sportTabActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.15)',
        borderColor: '#0A84FF'
    },
    sportTabText: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600'
    },
    sportTabTextActive: {
        color: '#0A84FF'
    },
});
