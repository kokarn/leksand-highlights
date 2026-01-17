import { View, Text, TouchableOpacity, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { getVideoDisplayTitle } from '../utils';

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
    if (!video) return null;

    const displayTitle = getVideoDisplayTitle(video);
    const hlsUrl = videoDetails?.streams?.hls;
    const embedUrl = videoDetails?.streams?.embed || video.renderedMedia?.videourl;

    return (
        <View style={styles.activePlayerContainer}>
            <View style={styles.activePlayer}>
                {loading ? (
                    <View style={styles.videoLoadingContainer}>
                        <ActivityIndicator size="large" color="#0A84FF" />
                        <Text style={styles.videoLoadingText}>Loading stream...</Text>
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
                        mediaPlaybackRequiresUserAction={false}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                    />
                ) : (
                    <View style={styles.videoLoadingContainer}>
                        <Text style={styles.videoLoadingText}>Video unavailable</Text>
                    </View>
                )}
            </View>
            <View style={styles.activePlayerInfo}>
                <Text style={styles.activePlayerTitle}>{displayTitle}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closePlayerButton}>
                    <Ionicons name="close-circle" size={28} color="#ff453a" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
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
        color: '#fff',
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
        color: '#888',
        fontSize: 12,
        marginTop: 8
    }
});
