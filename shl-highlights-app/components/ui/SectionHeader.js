import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts';

/**
 * Section header for grouping events in the unified view
 */
export const SectionHeader = memo(function SectionHeader({ title, icon, count, isLive = false }) {
    const { colors } = useTheme();
    
    return (
        <View style={[styles.container, { borderBottomColor: colors.separator }, isLive && styles.containerLive]}>
            <View style={styles.left}>
                <Ionicons
                    name={icon || 'calendar-outline'}
                    size={16}
                    color={isLive ? colors.accentRed : colors.accent}
                />
                <Text style={[styles.title, { color: colors.text }, isLive && styles.titleLive]}>{title}</Text>
            </View>
            {count !== undefined && (
                <Text style={[styles.count, { color: colors.textMuted }]}>{count} {count === 1 ? 'event' : 'events'}</Text>
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
        borderBottomWidth: 1
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
        fontSize: 15,
        fontWeight: '700'
    },
    titleLive: {
        color: '#FF453A'
    },
    count: {
        fontSize: 12,
        fontWeight: '600'
    }
});
