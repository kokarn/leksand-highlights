import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const TabButton = ({ title, isActive, onPress, icon }) => (
    <TouchableOpacity
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <Ionicons name={icon} size={18} color={isActive ? '#fff' : '#888'} />
        <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>{title}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 6
    },
    tabButtonActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#6C5CE7'
    },
    tabButtonText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600'
    },
    tabButtonTextActive: {
        color: '#fff'
    },
});
