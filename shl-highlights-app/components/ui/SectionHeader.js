import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Section header for grouping events in the unified view
 */
export const SectionHeader = memo(function SectionHeader({ title, icon, count, isLive = false }) {
    return (
        <View style={[styles.container, isLive && styles.containerLive]}>
            <View style={styles.left}>
                <Ionicons 
                    name={icon || 'calendar-outline'} 
                    size={16} 
                    color={isLive ? '#FF453A' : '#0A84FF'} 
                />
                <Text style={[styles.title, isLive && styles.titleLive]}>{title}</Text>
            </View>
            {count !== undefined && (
                <Text style={styles.count}>{count} {count === 1 ? 'event' : 'events'}</Text>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 4,
        marginTop: 8,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#2c2c2e'
    },
    containerLive: {
        borderBottomColor: 'rgba(255, 69, 58, 0.3)'
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    title: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700'
    },
    titleLive: {
        color: '#FF453A'
    },
    count: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600'
    }
});
