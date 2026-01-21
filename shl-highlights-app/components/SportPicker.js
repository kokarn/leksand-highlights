import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SPORTS = [
    { key: 'all', name: 'All', icon: 'grid-outline' },
    { key: 'shl', name: 'Hockey', icon: 'snow-outline' },
    { key: 'football', name: 'Football', icon: 'football-outline' },
    { key: 'biathlon', name: 'Biathlon', icon: 'locate-outline' }
];

export const SportPicker = ({ activeSport, onSportChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const currentSport = SPORTS.find(s => s.key === activeSport) || SPORTS[0];

    const handleSelect = (sportKey) => {
        onSportChange(sportKey);
        setIsOpen(false);
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.picker}
                onPress={() => setIsOpen(true)}
                activeOpacity={0.7}
            >
                <Ionicons name={currentSport.icon} size={16} color="#0A84FF" />
                <Text style={styles.pickerText}>{currentSport.name}</Text>
                <Ionicons name="chevron-down" size={14} color="#666" />
            </TouchableOpacity>

            <Modal
                visible={isOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsOpen(false)}
            >
                <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
                    <View style={styles.dropdown}>
                        <Text style={styles.dropdownTitle}>Select Sport</Text>
                        {SPORTS.map((sport) => (
                            <TouchableOpacity
                                key={sport.key}
                                style={[
                                    styles.option,
                                    activeSport === sport.key && styles.optionActive
                                ]}
                                onPress={() => handleSelect(sport.key)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={sport.icon}
                                    size={18}
                                    color={activeSport === sport.key ? '#0A84FF' : '#888'}
                                />
                                <Text style={[
                                    styles.optionText,
                                    activeSport === sport.key && styles.optionTextActive
                                ]}>
                                    {sport.name}
                                </Text>
                                {activeSport === sport.key && (
                                    <Ionicons name="checkmark" size={18} color="#0A84FF" />
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
