import { View, Text, StyleSheet } from 'react-native';

export const StatBar = ({ label, homeValue, awayValue, homeColor, awayColor }) => {
    const total = (homeValue || 0) + (awayValue || 0);
    const homePerc = total > 0 ? ((homeValue || 0) / total) * 100 : 50;

    return (
        <View style={styles.statBarContainer}>
            <Text style={styles.statValue}>{homeValue ?? '-'}</Text>
            <View style={styles.statBarMiddle}>
                <Text style={styles.statLabel}>{label}</Text>
                <View style={styles.statBarTrack}>
                    <View style={[styles.statBarFill, { width: `${homePerc}%`, backgroundColor: homeColor }]} />
                    <View style={[styles.statBarFill, { width: `${100 - homePerc}%`, backgroundColor: awayColor }]} />
                </View>
            </View>
            <Text style={styles.statValue}>{awayValue ?? '-'}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    statBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16
    },
    statValue: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        width: 40,
        textAlign: 'center'
    },
    statBarMiddle: {
        flex: 1,
        marginHorizontal: 12
    },
    statLabel: {
        color: '#888',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 6
    },
    statBarTrack: {
        flexDirection: 'row',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: '#333'
    },
    statBarFill: {
        height: '100%'
    },
});
