import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchOlympicsHockeyGames } from '../api/shl';

const AUTO_REFRESH_INTERVAL_MS = 20000;

/**
 * Hook for managing Olympics hockey data.
 * Designed to merge seamlessly with SHL data in the Hockey tab.
 * @param {string} activeSport - Currently active sport tab
 * @param {object} options - Additional options
 * @param {boolean} options.eagerLoad - Load data immediately on mount
 */
export function useOlympicsHockeyData(activeSport, options = {}) {
    const { eagerLoad = false } = options;

    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const hasLoadedOnce = useRef(false);

    // Selected game modal state
    const [selectedGame, setSelectedGame] = useState(null);
    const [gameDetails, setGameDetails] = useState(null);
    const [loadingModal, setLoadingModal] = useState(false);

    // Check if auto-refresh should be active
    const hasLiveGames = useMemo(() => {
        return games.some(game => game.state === 'live');
    }, [games]);

    const loadGames = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await fetchOlympicsHockeyGames();
            setGames(data);
        } catch (e) {
            console.error('Failed to load Olympics hockey games', e);
        } finally {
            if (!silent) setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        if (!hasLoadedOnce.current && (eagerLoad || activeSport === 'shl')) {
            hasLoadedOnce.current = true;
            loadGames();
        }
    }, [activeSport, loadGames, eagerLoad]);

    // Auto-refresh when live games exist
    useEffect(() => {
        if (activeSport !== 'shl' && activeSport !== 'all') return;
        if (!hasLiveGames) return;

        const intervalId = setInterval(() => {
            console.log('[Olympics Hockey] Auto-refreshing live games...');
            loadGames(true);
        }, AUTO_REFRESH_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [hasLiveGames, activeSport, loadGames]);

    const sortedGames = useMemo(() => {
        return [...games].sort((a, b) => {
            const timeA = new Date(a.startDateTime).getTime();
            const timeB = new Date(b.startDateTime).getTime();
            return timeA - timeB;
        });
    }, [games]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadGames();
    }, [loadGames]);

    const handleGamePress = useCallback(async (game) => {
        setSelectedGame(game);
        setLoadingModal(true);
        // Olympics games have limited details (no play-by-play)
        // Build details from the game data itself
        setGameDetails({
            info: {
                gameInfo: {
                    gameUuid: game.uuid,
                    startDateTime: game.startDateTime,
                    arenaName: game.venueInfo?.name || null,
                    state: game.state
                },
                homeTeam: game.homeTeamInfo,
                awayTeam: game.awayTeamInfo
            },
            teamStats: null,
            events: { goals: [], penalties: [], periods: [], all: [] }
        });
        setLoadingModal(false);
    }, []);

    const closeModal = useCallback(() => {
        setSelectedGame(null);
        setGameDetails(null);
    }, []);

    return {
        games: sortedGames,
        loading,
        refreshing,
        selectedGame,
        gameDetails,
        loadingModal,
        onRefresh,
        handleGamePress,
        closeModal
    };
}
