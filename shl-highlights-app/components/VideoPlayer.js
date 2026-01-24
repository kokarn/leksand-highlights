import { View, Text, TouchableOpacity, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { getVideoDisplayTitle } from '../utils';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Video player component with HLS/embed support
 * Handles both web and native platforms
 */
export const VideoPlayer = ({
    video,
    videoDetails,
    loading,
    onClose
}) => {
    const { colors } = useTheme();
    const themedStyles = createStyles(colors);
    
    if (!video) { return null; }

    const displayTitle = getVideoDisplayTitle(video);
    const hlsUrl = videoDetails?.streams?.hls;
    const embedUrl = videoDetails?.streams?.embed || video.renderedMedia?.videourl;

    return (
        <View style={themedStyles.activePlayerContainer}>
            <View style={themedStyles.activePlayer}>
                {loading ? (
                    <View style={themedStyles.videoLoadingContainer}>
                        <ActivityIndicator size="large" color={colors.accent} />
                        <Text style={themedStyles.videoLoadingText}>Loading stream...</Text>
                    </View>
                ) : hlsUrl && Platform.OS === 'web' ? (
                    <video
                        src={hlsUrl}
                        controls
                        autoPlay
                        style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
                    />
                ) : Platform.OS === 'web' ? (
                    <iframe
                        src={embedUrl}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        allow="autoplay; fullscreen"
                        allowFullScreen
                    />
                ) : hlsUrl || embedUrl ? (
                    <WebView
                        key={video.id}
                        source={{ uri: hlsUrl || embedUrl }}
                        style={{ flex: 1, backgroundColor: 'transparent' }}
                        allowsInlineMediaPlayback
                        allowsFullscreenVideo={true}
                        mediaPlaybackRequiresUserAction={false}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                    />
                ) : (
                    <View style={themedStyles.videoLoadingContainer}>
                        <Text style={themedStyles.videoLoadingText}>Video unavailable</Text>
                    </View>
                )}
            </View>
            <View style={themedStyles.activePlayerInfo}>
                <Text style={themedStyles.activePlayerTitle}>{displayTitle}</Text>
                <TouchableOpacity onPress={onClose} style={themedStyles.closePlayerButton}>
                    <Ionicons name="close-circle" size={28} color={colors.accentRed} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const createStyles = (colors) => StyleSheet.create({
    activePlayerContainer: {
        marginBottom: 20,
        paddingHorizontal: 16
    },
    activePlayer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
        borderRadius: 12,
        overflow: 'hidden'
    },
    activePlayerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingHorizontal: 4
    },
    activePlayerTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 12
    },
    closePlayerButton: {
        padding: 4
    },
    videoLoadingContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000'
    },
    videoLoadingText: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 8
    }
});
