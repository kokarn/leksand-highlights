import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const PeriodMarker = ({ period }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    return (
        <View style={themedStyles.periodMarker}>
            <View style={themedStyles.periodLine} />
            <Text style={themedStyles.periodText}>Period {period}</Text>
            <View style={themedStyles.periodLine} />
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    periodMarker: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16
    },
    periodLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.cardBorder
    },
    periodText: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: '600',
        marginHorizontal: 12
    },
});
