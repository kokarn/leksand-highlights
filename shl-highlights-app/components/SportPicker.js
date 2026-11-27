import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts';

// Hockey uses a MaterialCommunityIcons puck (Ionicons has no hockey glyph);
// everything else uses Ionicons.
//
// 'all' keeps its stored key so existing installs' saved sport preference still
// resolves — only the label and icon changed when the cross-sport tab became
// "Home" (your teams) rather than "All" (every match).
const SPORTS = [
    { key: 'all', name: 'Home', icon: 'home-outline' },
    { key: 'hockey', name: 'Hockey', icon: 'hockey-puck', iconSet: 'mci' },
    { key: 'football', name: 'Football', icon: 'football-outline' },
    { key: 'biathlon', name: 'Biathlon', icon: 'locate-outline' }
];

const SportIcon = ({ sport, size, color }) => {
    if (sport.iconSet === 'mci') {
        return <MaterialCommunityIcons name={sport.icon} size={size} color={color} />;
    }
    return <Ionicons name={sport.icon} size={size} color={color} />;
};

export const SportPicker = ({ activeSport, onSportChange }) => {
    const { colors } = useTheme();

    return (
        <View style={styles.container}>
            {SPORTS.map((sport) => {
                const active = activeSport === sport.key;
                return (
                    <TouchableOpacity
                        key={sport.key}
                        style={[
                            styles.button,
                            { backgroundColor: colors.card, borderColor: colors.cardBorder },
                            active && { backgroundColor: colors.chipActive, borderColor: colors.accent }
                        ]}
                        onPress={() => onSportChange(sport.key)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={sport.name}
                        accessibilityState={{ selected: active }}
                    >
                        <SportIcon
                            sport={sport}
                            size={20}
                            color={active ? colors.accent : colors.textMuted}
                        />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    button: {
        width: 44,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        borderWidth: 1
    }
});
