import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export const HalfMarker = ({ half }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    const label = half === 1 ? '1st Half' : half === 2 ? '2nd Half' : `Half ${half}`;

    return (
        <View style={themedStyles.halfMarker}>
            <View style={themedStyles.halfLine} />
            <Text style={themedStyles.halfText}>{label}</Text>
            <View style={themedStyles.halfLine} />
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    halfMarker: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16
    },
    halfLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.cardBorder
    },
    halfText: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: '600',
        marginHorizontal: 12
    }
});
