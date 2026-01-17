import { useState, useCallback } from 'react';
import { fetchVideoDetails } from '../api/shl';
import { getStayLiveVideoId } from '../utils';

/**
 * Hook for managing video playback state
 */
export function useVideoPlayer() {
    const [playingVideoId, setPlayingVideoId] = useState(null);
    const [playingVideoDetails, setPlayingVideoDetails] = useState(null);
    const [loadingVideoDetails, setLoadingVideoDetails] = useState(false);

    const playVideo = useCallback(async (video) => {
        const stayLiveId = getStayLiveVideoId(video);
        if (!stayLiveId) {
            console.warn('Could not extract StayLive video ID');
            return;
        }

        setPlayingVideoId(video.id);
        setLoadingVideoDetails(true);
        setPlayingVideoDetails(null);

        try {
            const details = await fetchVideoDetails(stayLiveId);
            setPlayingVideoDetails(details);
        } catch (e) {
            console.error('Failed to fetch video details:', e);
        } finally {
            setLoadingVideoDetails(false);
        }
    }, []);

    const stopVideo = useCallback(() => {
        setPlayingVideoId(null);
        setPlayingVideoDetails(null);
        setLoadingVideoDetails(false);
    }, []);

    return {
        playingVideoId,
        playingVideoDetails,
        loadingVideoDetails,
        playVideo,
        stopVideo
    };
}
