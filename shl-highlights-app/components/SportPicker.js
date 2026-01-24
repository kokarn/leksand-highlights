import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts';

const SPORTS = [
    { key: 'all', name: 'All', icon: 'grid-outline' },
    { key: 'shl', name: 'Hockey', icon: 'snow-outline' },
    { key: 'football', name: 'Football', icon: 'football-outline' },
    { key: 'biathlon', name: 'Biathlon', icon: 'locate-outline' }
];

export const SportPicker = ({ activeSport, onSportChange }) => {
    const { colors, isDark } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const currentSport = SPORTS.find(s => s.key === activeSport) || SPORTS[0];

    const handleSelect = (sportKey) => {
        onSportChange(sportKey);
        setIsOpen(false);
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => setIsOpen(true)}
                activeOpacity={0.7}
            >
                <Ionicons name={currentSport.icon} size={16} color={colors.accent} />
                <Text style={[styles.pickerText, { color: colors.text }]}>{currentSport.name}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </TouchableOpacity>

            <Modal
                visible={isOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsOpen(false)}
            >
                <Pressable style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]} onPress={() => setIsOpen(false)}>
                    <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.dropdownTitle, { color: colors.textMuted }]}>Select Sport</Text>
                        {SPORTS.map((sport) => (
                            <TouchableOpacity
                                key={sport.key}
                                style={[
                                    styles.option,
                                    activeSport === sport.key && { backgroundColor: colors.chipActive }
                                ]}
                                onPress={() => handleSelect(sport.key)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={sport.icon}
                                    size={18}
                                    color={activeSport === sport.key ? colors.accent : colors.textSecondary}
                                />
                                <Text style={[
                                    styles.optionText,
                                    { color: colors.text },
                                    activeSport === sport.key && { color: colors.accent }
                                ]}>
                                    {sport.name}
                                </Text>
                                {activeSport === sport.key && (
                                    <Ionicons name="checkmark" size={18} color={colors.accent} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    picker: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: '#1c1c1e',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333'
    },
    pickerText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        flex: 1
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24
    },
    dropdown: {
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        padding: 8,
        width: '100%',
        maxWidth: 320,
        borderWidth: 1,
        borderColor: '#333'
    },
    dropdownTitle: {
        color: '#666',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 4
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderRadius: 10
    },
    optionActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.1)'
    },
    optionText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        flex: 1
    },
    optionTextActive: {
        color: '#0A84FF',
        fontWeight: '600'
    }
});
