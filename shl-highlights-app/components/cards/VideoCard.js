import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getVideoDisplayTitle } from '../../utils';
import { useTheme } from '../../contexts/ThemeContext';

const { width } = Dimensions.get('window');

export const VideoCard = ({ video, isPlaying, onPress }) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    const title = getVideoDisplayTitle(video);

    return (
        <TouchableOpacity
            style={[themedStyles.videoGridCard, isPlaying && themedStyles.videoGridCardPlaying]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <View style={themedStyles.videoGridThumbnailContainer}>
                <Image
                    source={{ uri: video.renderedMedia?.url || video.thumbnail }}
                    style={themedStyles.thumbnail}
                    resizeMode="cover"
                />
                {isPlaying ? (
                    <View style={themedStyles.nowPlayingBadge}>
                        <Ionicons name="volume-high" size={14} color="#fff" />
                        <Text style={themedStyles.nowPlayingBadgeText}>Playing</Text>
                    </View>
                ) : (
                    <View style={themedStyles.miniPlayIconContainer}>
                        <Ionicons name="play" size={24} color="#fff" />
                    </View>
                )}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={themedStyles.thumbnailGradient} />
            </View>
            <View style={themedStyles.videoGridInfo}>
                <Text style={[themedStyles.videoGridTitle, isPlaying && themedStyles.videoGridTitlePlaying]} numberOfLines={2}>
                    {title}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const createStyles = (colors) => StyleSheet.create({
    videoGridCard: {
        // 2 cards per row: screen width - tabContent padding (32) - sectionCard padding (32) - gap (12) = width - 76
        width: (width - 76) / 2,
        marginBottom: 4,
        backgroundColor: colors.card,
        borderRadius: 8,
        overflow: 'hidden'
    },
    videoGridCardPlaying: {
        borderWidth: 2,
        borderColor: colors.accent
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
        backgroundColor: colors.accent,
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
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18
    },
    videoGridTitlePlaying: {
        color: colors.accent
    },
});
