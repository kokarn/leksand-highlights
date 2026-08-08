import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts';

/**
 * Segmented control to switch the schedule between the user's followed teams
 * ('myteams') and every match of the day ('all'). Styled to match ViewToggle /
 * SportTab so it reads as part of the same selector family.
 */
export const ScopeToggle = ({ scope, onChange }) => {
    const { colors } = useTheme();

    const options = [
        { key: 'myteams', label: 'My teams', icon: 'star-outline' },
        { key: 'all', label: 'All matches', icon: 'grid-outline' }
    ];

    return (
        <View style={styles.scopeToggle}>
            {options.map((option) => {
                const active = scope === option.key;
                return (
                    <TouchableOpacity
                        key={option.key}
                        style={[
                            styles.scopeButton,
                            { backgroundColor: colors.card, borderColor: colors.cardBorder },
                            active && { backgroundColor: colors.chipActive, borderColor: colors.accent }
                        ]}
                        onPress={() => onChange(option.key)}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={option.icon}
                            size={14}
                            color={active ? colors.accent : colors.textMuted}
                        />
                        <Text style={[
                            styles.scopeText,
                            { color: colors.textMuted },
                            active && { color: colors.accent }
                        ]}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    scopeToggle: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center'
    },
    scopeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1
    },
    scopeText: {
        fontSize: 12,
        fontWeight: '600'
    }
});
