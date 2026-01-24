import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts';

/**
 * Season picker for standings views
 * Shows single season label, or dropdown for multiple seasons
 */
export const SeasonPicker = ({ seasons, selectedSeason, onSelect, variant = 'chips' }) => {
    const { colors, isDark } = useTheme();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (dropdownOpen) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: Platform.OS !== 'web'
            }).start();
        }
    }, [dropdownOpen, fadeAnim]);

    if (!Array.isArray(seasons) || seasons.length === 0) {
        return null;
    }

    if (seasons.length === 1) {
        return (
            <View style={styles.seasonSingle}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.seasonSingleText, { color: colors.textSecondary }]}>Season {seasons[0]}</Text>
            </View>
        );
    }

    // Dropdown variant (for football)
    if (variant === 'dropdown') {
        const handleClose = () => {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: Platform.OS !== 'web'
            }).start(() => setDropdownOpen(false));
        };

        const handleSelect = (season) => {
            onSelect?.(season);
            handleClose();
        };

        return (
            <View style={styles.dropdownContainer}>
                <TouchableOpacity
                    style={[styles.dropdownButton, { backgroundColor: colors.chip, borderColor: colors.chipBorder }]}
                    onPress={() => setDropdownOpen(true)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="calendar-outline" size={16} color={colors.accent} />
                    <Text style={[styles.dropdownButtonText, { color: colors.text }]}>
                        {selectedSeason || 'Select season'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                <Modal
                    visible={dropdownOpen}
                    transparent
                    animationType="none"
                    onRequestClose={handleClose}
                >
                    <TouchableOpacity
                        style={[styles.dropdownOverlay, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.5)' }]}
                        activeOpacity={1}
                        onPress={handleClose}
                    >
                        <Animated.View style={[styles.dropdownModal, { backgroundColor: colors.card, opacity: fadeAnim }]}>
                            <View style={[styles.dropdownHeader, { borderBottomColor: colors.cardBorder }]}>
                                <Text style={[styles.dropdownTitle, { color: colors.text }]}>Select Season</Text>
                                <TouchableOpacity onPress={handleClose} style={styles.dropdownCloseBtn}>
                                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            <FlatList
                                data={seasons}
                                keyExtractor={(item) => String(item)}
                                renderItem={({ item }) => {
                                    const isActive = item === selectedSeason;
                                    return (
                                        <TouchableOpacity
                                            style={[styles.dropdownItem, { borderBottomColor: colors.separator }, isActive && { backgroundColor: colors.chipActive }]}
                                            onPress={() => handleSelect(item)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.dropdownItemText, { color: colors.text }, isActive && { color: colors.accent }]}>
                                                {item}
                                            </Text>
                                            {isActive && (
                                                <Ionicons name="checkmark" size={20} color={colors.accent} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                                showsVerticalScrollIndicator={false}
                            />
                        </Animated.View>
                    </TouchableOpacity>
                </Modal>
            </View>
        );
    }

    // Chips variant (default, for SHL)
    return (
        <View style={styles.seasonPicker}>
            <Text style={[styles.seasonLabel, { color: colors.textSecondary }]}>Season</Text>
            <View style={styles.seasonChipRow}>
                {seasons.map(season => {
                    const isActive = season === selectedSeason;
                    return (
                        <TouchableOpacity
                            key={season}
                            style={[styles.seasonChip, { backgroundColor: colors.chip, borderColor: colors.chipBorder }, isActive && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                            onPress={() => onSelect?.(season)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.seasonChipText, { color: colors.textSecondary }, isActive && styles.seasonChipTextActive]}>
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
        backgroundColor: '#6C5CE7',
        borderColor: '#6C5CE7'
    },
    seasonChipText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600'
    },
    seasonChipTextActive: {
        color: '#fff'
    },
    // Dropdown styles
    dropdownContainer: {
        marginTop: 4
    },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#252525',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333'
    },
    dropdownButtonText: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    },
    dropdownOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24
    },
    dropdownModal: {
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
        width: '100%',
        maxWidth: 320,
        maxHeight: 400,
        overflow: 'hidden'
    },
    dropdownHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    dropdownTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700'
    },
    dropdownCloseBtn: {
        padding: 4
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2c2c2e'
    },
    dropdownItemActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.1)'
    },
    dropdownItemText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500'
    },
    dropdownItemTextActive: {
        color: '#6C5CE7',
        fontWeight: '600'
    }
});
