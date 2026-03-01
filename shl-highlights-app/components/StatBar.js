import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const parseNumericStatValue = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value
        .trim()
        .replace('%', '')
        .replace(',', '.');

    if (!normalized) {
        return null;
    }

    const parsedValue = Number.parseFloat(normalized);
    if (Number.isNaN(parsedValue)) {
        return null;
    }

    return parsedValue;
};

export const StatBar = ({ label, homeValue, awayValue, homeColor, awayColor }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);

    const parsedHomeValue = parseNumericStatValue(homeValue);
    const parsedAwayValue = parseNumericStatValue(awayValue);
    const homeNumericValue = parsedHomeValue ?? 0;
    const awayNumericValue = parsedAwayValue ?? 0;
    const total = homeNumericValue + awayNumericValue;
    const computedHomePercentage = total > 0 ? (homeNumericValue / total) * 100 : 50;
    const homePercentage = Number.isFinite(computedHomePercentage)
        ? Math.min(100, Math.max(0, computedHomePercentage))
        : 50;
    const awayPercentage = 100 - homePercentage;

    return (
        <View style={themedStyles.statBarContainer}>
            <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={themedStyles.statValue}
            >
                {homeValue ?? '-'}
            </Text>
            <View style={themedStyles.statBarMiddle}>
                <Text style={themedStyles.statLabel}>{label}</Text>
                <View style={themedStyles.statBarTrack}>
                    <View style={[themedStyles.statBarFill, { width: `${homePercentage}%`, backgroundColor: homeColor }]} />
                    <View style={[themedStyles.statBarFill, { width: `${awayPercentage}%`, backgroundColor: awayColor }]} />
                </View>
            </View>
            <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={themedStyles.statValue}
            >
                {awayValue ?? '-'}
            </Text>
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
        fontSize: 15,
        fontWeight: '700',
        width: 58,
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
