import { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { useTheme } from '../../contexts';

// A day-section header row for the "All matches" schedule scope. Today is
// accented (purple pill + left stripe + "TODAY" label); other days render as a
// muted uppercase label. Rendered height (30 + marginBottom 12) MUST match
// DAY_HEADER_HEIGHT in utils/scheduleSections.js so scroll offsets stay exact.
export const DayHeader = memo(function DayHeader({ date }) {
    const { colors } = useTheme();

    let today = false;
    let label = '';
    try {
        const d = parseISO(date);
        if (!Number.isNaN(d.getTime())) {
            today = isToday(d);
            if (today) {
                label = `TODAY · ${format(d, 'EEE d MMM')}`;
            } else if (isTomorrow(d)) {
                label = `TOMORROW · ${format(d, 'EEE d MMM')}`;
            } else {
                label = format(d, 'EEE d MMM').toUpperCase();
            }
        }
    } catch (error) {
        label = '';
    }

    if (today) {
        return (
            <View style={[styles.todayContainer, { backgroundColor: colors.chipActive }]}>
                <View style={[styles.stripe, { backgroundColor: colors.accent }]} />
                <Text style={[styles.todayLabel, { color: colors.accent }]}>{label}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        height: 30,
        justifyContent: 'center',
        marginBottom: 12,
        paddingHorizontal: 2
    },
    todayContainer: {
        height: 30,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        borderRadius: 8,
        overflow: 'hidden'
    },
    stripe: {
        width: 4,
        height: '100%',
        marginRight: 10
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5
    },
    todayLabel: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.5
    }
});
