import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchGames, fetchStandings, fetchGameDetails, fetchVideosForGame } from '../api/shl';

const AUTO_REFRESH_INTERVAL_MS = 20000;
const STARTING_SOON_WINDOW_MINUTES = 30;
const RECENT_START_WINDOW_MINUTES = 90;

/**
 * Hook for managing SHL games data, standings, and auto-refresh
 * @param {string} activeSport - Currently active sport tab
 * @param {string[]} selectedTeams - Selected team filters
 * @param {object} options - Additional options
 * @param {boolean} options.eagerLoad - Load data immediately on mount regardless of activeSport
 */
export function useShlData(activeSport, selectedTeams, options = {}) {
    const { eagerLoad = false } = options;

    // Games state
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const hasLoadedOnce = useRef(false);

    // Standings state
    const [standings, setStandings] = useState(null);
    const [loadingStandings, setLoadingStandings] = useState(false);

    // View mode
    const [viewMode, setViewMode] = useState('schedule');

    // Selected game modal state
    const [selectedGame, setSelectedGame] = useState(null);
    const [gameDetails, setGameDetails] = useState(null);
    const [videos, setVideos] = useState([]);
    const [loadingModal, setLoadingModal] = useState(false);

    // List scroll ref
    const listRef = useRef(null);
    const lastFocusedGameRef = useRef(null);

    // Scroll position persistence
    const savedScrollOffset = useRef(null);
    const hasUserScrolled = useRef(false);

    // Check if auto-refresh should be enabled
    const shouldAutoRefreshGames = useCallback((gamesList) => {
        const now = Date.now();
        return gamesList.some(game => {
            if (game.state === 'live') return true;
            if (game.state === 'post-game') return false;
            const startTime = new Date(game.startDateTime).getTime();
            if (Number.isNaN(startTime)) return false;
            const minutesFromStart = (startTime - now) / (1000 * 60);
            return minutesFromStart <= STARTING_SOON_WINDOW_MINUTES
                && minutesFromStart >= -RECENT_START_WINDOW_MINUTES;
        });
    }, []);

    // Load games
    const loadGames = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await fetchGames();
            setGames(data);
        } catch (e) {
            console.error("Failed to load games", e);
        } finally {
            if (!silent) setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Load standings
    const loadStandings = useCallback(async (silent = false) => {
        if (!silent) setLoadingStandings(true);
        try {
            const data = await fetchStandings();
            setStandings(data);
        } catch (e) {
            console.error("Failed to load standings", e);
        } finally {
            if (!silent) setLoadingStandings(false);
            setRefreshing(false);
        }
    }, []);

    // Initial data load (eager load on mount if enabled, otherwise wait for active sport)
    useEffect(() => {
        // First load: load immediately if eagerLoad or if sport is active
        if (!hasLoadedOnce.current && (eagerLoad || activeSport === 'shl')) {
            hasLoadedOnce.current = true;
            loadGames();
        }
    }, [activeSport, loadGames, eagerLoad]);

    // Load standings when view mode changes
    useEffect(() => {
        if (activeSport !== 'shl') return;
        if (viewMode !== 'standings') return;
        loadStandings();
    }, [activeSport, viewMode, loadStandings]);

    // Auto-refresh for live games
    useEffect(() => {
        if (activeSport !== 'shl') return;
        const shouldAutoRefresh = shouldAutoRefreshGames(games);
        if (!shouldAutoRefresh) return;

        const intervalId = setInterval(() => {
            console.log('Auto-refreshing live or starting-soon games...');
            loadGames(true);
        }, AUTO_REFRESH_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [games, activeSport, shouldAutoRefreshGames, loadGames]);

    // Restore scroll position when switching back to SHL
    useEffect(() => {
        if (activeSport === 'shl' && hasUserScrolled.current && savedScrollOffset.current !== null) {
            // Small delay to ensure FlatList is mounted
            const timeoutId = setTimeout(() => {
                listRef.current?.scrollToOffset({
                    offset: savedScrollOffset.current,
                    animated: false
                });
            }, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [activeSport]);

    // Handle scroll event to save position
    const handleScroll = useCallback((event) => {
        const offset = event.nativeEvent.contentOffset.y;
        savedScrollOffset.current = offset;
        hasUserScrolled.current = true;
    }, []);

    // Derived teams list
    const teams = useMemo(() => {
        const teamCodes = new Set();
        games.forEach(g => {
            if (g.homeTeamInfo?.code) teamCodes.add(g.homeTeamInfo.code);
            if (g.awayTeamInfo?.code) teamCodes.add(g.awayTeamInfo.code);
        });
        return Array.from(teamCodes)
            .map(code => ({ code }))
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [games]);

    // Filtered and sorted games
    const filteredGames = useMemo(() => {
        return games.filter(game => {
            if (selectedTeams.length > 0) {
                const homeCode = game.homeTeamInfo?.code;
                const awayCode = game.awayTeamInfo?.code;
                if (!selectedTeams.includes(homeCode) && !selectedTeams.includes(awayCode)) {
                    return false;
                }
            }
            return true;
        });
    }, [games, selectedTeams]);

    const sortedGames = useMemo(() => {
        return [...filteredGames].sort((a, b) => {
            const timeA = new Date(a.startDateTime).getTime();
            const timeB = new Date(b.startDateTime).getTime();
            return timeA - timeB;
        });
    }, [filteredGames]);

    // Target game index for auto-scroll
    const targetGameIndex = useMemo(() => {
        if (!sortedGames.length) return 0;

        // Priority 1: Find live games
        const liveIndex = sortedGames.findIndex(game => game.state === 'live');
        if (liveIndex !== -1) return liveIndex;

        // Priority 2: Find next upcoming game (pre-game or not post-game)
        const upcomingIndex = sortedGames.findIndex(game => game.state !== 'post-game');
        if (upcomingIndex !== -1) return upcomingIndex;

        // Priority 3: All games finished - find the most recent one (last in sorted list)
        return sortedGames.length - 1;
    }, [sortedGames]);

    const targetGameId = useMemo(() => {
        return sortedGames[targetGameIndex]?.uuid || null;
    }, [sortedGames, targetGameIndex]);

    // View mode handler
    const handleViewChange = useCallback((nextView) => {
        if (nextView === viewMode) return;
        setViewMode(nextView);
    }, [viewMode]);

    // Refresh handler
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        if (viewMode === 'standings') {
            loadStandings();
        } else {
            loadGames();
        }
    }, [viewMode, loadGames, loadStandings]);

    // Game press handler
    const handleGamePress = useCallback(async (game) => {
        setSelectedGame(game);
        setLoadingModal(true);

        const [details, vids] = await Promise.all([
            fetchGameDetails(game.uuid),
            fetchVideosForGame(game.uuid)
        ]);

        setGameDetails(details);

        const sortedVids = vids.sort((a, b) => {
            const aHigh = a.tags && a.tags.includes('custom.highlights');
            const bHigh = b.tags && b.tags.includes('custom.highlights');
            if (aHigh && !bHigh) return -1;
            if (!aHigh && bHigh) return 1;
            return 0;
        });
        setVideos(sortedVids);
        setLoadingModal(false);
    }, []);

    // Close modal handler
    const closeModal = useCallback(() => {
        setSelectedGame(null);
        setGameDetails(null);
        setVideos([]);
    }, []);

    // Determine effective initial scroll index (skip if user has scrolled before)
    const effectiveInitialScrollIndex = hasUserScrolled.current ? undefined : (targetGameIndex > 0 ? targetGameIndex : undefined);

    return {
        // State
        games: sortedGames,
        loading,
        refreshing,
        standings,
        loadingStandings,
        viewMode,
        selectedGame,
        gameDetails,
        videos,
        loadingModal,
        teams,
        targetGameIndex,
        targetGameId,
        effectiveInitialScrollIndex,

        // Refs
        listRef,
        lastFocusedGameRef,

        // Handlers
        loadGames,
        loadStandings,
        handleViewChange,
        onRefresh,
        handleGamePress,
        handleScroll,
        closeModal
    };
}
