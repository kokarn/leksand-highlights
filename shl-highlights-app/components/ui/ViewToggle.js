import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts';

/**
 * Toggle between schedule and standings view modes
 * Styled to match SportTab for visual consistency
 */
export const ViewToggle = ({ mode, onChange }) => {
    const { colors } = useTheme();
    
    return (
        <View style={styles.viewToggle}>
            <TouchableOpacity
                style={[
                    styles.viewToggleButton, 
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    mode === 'schedule' && { backgroundColor: colors.chipActive, borderColor: colors.accent }
                ]}
                onPress={() => onChange('schedule')}
                activeOpacity={0.7}
            >
                <Ionicons name="calendar-outline" size={14} color={mode === 'schedule' ? colors.accent : colors.textMuted} />
                <Text style={[
                    styles.viewToggleText, 
                    { color: colors.textMuted },
                    mode === 'schedule' && { color: colors.accent }
                ]}>
                    Schedule
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.viewToggleButton, 
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    mode === 'standings' && { backgroundColor: colors.chipActive, borderColor: colors.accent }
                ]}
                onPress={() => onChange('standings')}
                activeOpacity={0.7}
            >
                <Ionicons name="stats-chart" size={14} color={mode === 'standings' ? colors.accent : colors.textMuted} />
                <Text style={[
                    styles.viewToggleText, 
                    { color: colors.textMuted },
                    mode === 'standings' && { color: colors.accent }
                ]}>
                    Standings
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    viewToggle: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center'
    },
    viewToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1
    },
    viewToggleText: {
        fontSize: 12,
        fontWeight: '600'
    }
});
