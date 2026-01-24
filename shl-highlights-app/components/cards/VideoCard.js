import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getVideoDisplayTitle } from '../../utils';

const { width } = Dimensions.get('window');

export const VideoCard = ({ video, isPlaying, onPress }) => {
    const title = getVideoDisplayTitle(video);

    return (
        <TouchableOpacity
            style={[styles.videoGridCard, isPlaying && styles.videoGridCardPlaying]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <View style={styles.videoGridThumbnailContainer}>
                <Image
                    source={{ uri: video.renderedMedia?.url || video.thumbnail }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                />
                {isPlaying ? (
                    <View style={styles.nowPlayingBadge}>
                        <Ionicons name="volume-high" size={14} color="#fff" />
                        <Text style={styles.nowPlayingBadgeText}>Playing</Text>
                    </View>
                ) : (
                    <View style={styles.miniPlayIconContainer}>
                        <Ionicons name="play" size={24} color="#fff" />
                    </View>
                )}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.thumbnailGradient} />
            </View>
            <View style={styles.videoGridInfo}>
                <Text style={[styles.videoGridTitle, isPlaying && styles.videoGridTitlePlaying]} numberOfLines={2}>
                    {title}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    videoGridCard: {
        flex: 1,
        marginBottom: 16,
        backgroundColor: '#1c1c1e',
        borderRadius: 8,
        overflow: 'hidden',
        marginHorizontal: 4,
        maxWidth: (width - 48) / 2
    },
    videoGridCardPlaying: {
        borderWidth: 2,
        borderColor: '#6C5CE7'
    },
    videoGridThumbnailContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        opacity: 0.8
    },
    thumbnailGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60%'
    },
    miniPlayIconContainer: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderColor: '#fff',
        borderWidth: 1.5
    },
    nowPlayingBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6C5CE7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 4
    },
    nowPlayingBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600'
    },
    videoGridInfo: {
        padding: 10
    },
    videoGridTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18
    },
    videoGridTitlePlaying: {
        color: '#6C5CE7'
    },
});
