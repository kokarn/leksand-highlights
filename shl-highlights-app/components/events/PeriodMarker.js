import { View, Text, StyleSheet } from 'react-native';

export const PeriodMarker = ({ period }) => (
    <View style={styles.periodMarker}>
        <View style={styles.periodLine} />
        <Text style={styles.periodText}>Period {period}</Text>
        <View style={styles.periodLine} />
    </View>
);

const styles = StyleSheet.create({
    periodMarker: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16
    },
    periodLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#333'
    },
    periodText: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600',
        marginHorizontal: 12
    },
});
