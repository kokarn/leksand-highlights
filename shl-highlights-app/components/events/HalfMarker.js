import { View, Text, StyleSheet } from 'react-native';

export const HalfMarker = ({ half }) => {
    const label = half === 1 ? '1st Half' : half === 2 ? '2nd Half' : `Half ${half}`;

    return (
        <View style={styles.halfMarker}>
            <View style={styles.halfLine} />
            <Text style={styles.halfText}>{label}</Text>
            <View style={styles.halfLine} />
        </View>
    );
};

const styles = StyleSheet.create({
    halfMarker: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16
    },
    halfLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#333'
    },
    halfText: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600',
        marginHorizontal: 12
    }
});
