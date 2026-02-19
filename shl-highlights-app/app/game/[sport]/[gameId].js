import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

const normalizeParam = (value) => {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
};

export default function GameDeepLinkRedirect() {
    const router = useRouter();
    const { sport, gameId, tab } = useLocalSearchParams();
    const sportParam = normalizeParam(sport);
    const gameIdParam = normalizeParam(gameId);
    const tabParam = normalizeParam(tab);

    useEffect(() => {
        if (!sportParam || !gameIdParam) {
            return;
        }

        const params = { sport: sportParam, gameId: gameIdParam };
        if (tabParam) {
            params.tab = tabParam;
        }

        router.replace({
            pathname: '/',
            params
        });
    }, [sportParam, gameIdParam, tabParam, router]);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#6C5CE7" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000'
    }
});
