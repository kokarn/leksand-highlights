import { Image, StyleSheet } from 'react-native';

export const LogoMark = ({ size = 80 }) => (
    <Image
        source={require('../assets/images/icon.png')}
        style={[styles.logoMark, { width: size, height: size, borderRadius: size * 0.22 }]}
        resizeMode="cover"
    />
);

const styles = StyleSheet.create({
    logoMark: {
        width: 80,
        height: 80,
        borderRadius: 18
    }
});
