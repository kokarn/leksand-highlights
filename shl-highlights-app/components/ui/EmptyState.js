import { View, Text, StyleSheet } from 'react-native';

/**
 * Empty state component for lists
 */
export const EmptyState = ({ message = 'No items found.' }) => (
    <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{message}</Text>
    </View>
);

const styles = StyleSheet.create({
    emptyContainer: {
        alignItems: 'center',
        marginTop: 40
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
        padding: 20
    }
});
