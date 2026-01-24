import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export const StatBar = ({ label, homeValue, awayValue, homeColor, awayColor }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    const total = (homeValue || 0) + (awayValue || 0);
    const homePerc = total > 0 ? ((homeValue || 0) / total) * 100 : 50;

    return (
        <View style={themedStyles.statBarContainer}>
            <Text style={themedStyles.statValue}>{homeValue ?? '-'}</Text>
            <View style={themedStyles.statBarMiddle}>
                <Text style={themedStyles.statLabel}>{label}</Text>
                <View style={themedStyles.statBarTrack}>
                    <View style={[themedStyles.statBarFill, { width: `${homePerc}%`, backgroundColor: homeColor }]} />
                    <View style={[themedStyles.statBarFill, { width: `${100 - homePerc}%`, backgroundColor: awayColor }]} />
                </View>
            </View>
            <Text style={themedStyles.statValue}>{awayValue ?? '-'}</Text>
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    statBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16
    },
    statValue: {
        color: colors.text,
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
        color: colors.textSecondary,
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 6
    },
    statBarTrack: {
        flexDirection: 'row',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: colors.cardBorder
    },
    statBarFill: {
        height: '100%'
    },
});
