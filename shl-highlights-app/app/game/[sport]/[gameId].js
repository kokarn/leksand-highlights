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
    const { sport, gameId } = useLocalSearchParams();
    const sportParam = normalizeParam(sport);
    const gameIdParam = normalizeParam(gameId);

    useEffect(() => {
        if (!sportParam || !gameIdParam) {
            return;
        }

        router.replace({
            pathname: '/',
            params: { sport: sportParam, gameId: gameIdParam }
        });
    }, [sportParam, gameIdParam, router]);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#0A84FF" />
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
