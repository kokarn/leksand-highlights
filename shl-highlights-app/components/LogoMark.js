import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const LogoMark = () => (
    <LinearGradient
        colors={['#0A84FF', '#5AC8FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.logoMark}
    >
        <View style={styles.logoBars}>
            <View style={[styles.logoBar, styles.logoBarShort]} />
            <View style={[styles.logoBar, styles.logoBarTall]} />
            <View style={[styles.logoBar, styles.logoBarMid]} />
        </View>
        <View style={styles.logoAccentDot} />
    </LinearGradient>
);

const styles = StyleSheet.create({
    logoMark: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    logoBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 4,
        height: 22
    },
    logoBar: {
        width: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.9)'
    },
    logoBarShort: { height: 8 },
    logoBarMid: { height: 14 },
    logoBarTall: { height: 20 },
    logoAccentDot: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#0b0d10',
        right: 10,
        top: 10
    },
});
