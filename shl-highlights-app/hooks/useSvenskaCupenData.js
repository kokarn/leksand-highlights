import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchSvenskaCupenGames, fetchSvenskaCupenGameDetails } from '../api/shl';

const AUTO_REFRESH_INTERVAL_MS = 20000;
const STARTING_SOON_WINDOW_MINUTES = 30;
const RECENT_START_WINDOW_MINUTES = 90;

/**
 * Hook for managing Svenska Cupen data (schedule + match details only)
 * @param {string} activeSport - Currently active sport tab
 * @param {string[]} selectedFootballTeams - Selected team filters (shared with football)
 * @param {object} options - Additional options
 * @param {boolean} options.eagerLoad - Load data immediately on mount regardless of activeSport
 */
export function useSvenskaCupenData(activeSport, selectedFootballTeams, options = {}) {
    const { eagerLoad = false } = options;

    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const hasLoadedOnce = useRef(false);

    const [selectedGame, setSelectedGame] = useState(null);
    const [gameDetails, setGameDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [refreshingModal, setRefreshingModal] = useState(false);

    const listRef = useRef(null);
    const savedScrollOffset = useRef(null);
    const hasUserScrolled = useRef(false);

    const getTeamKey = useCallback((team) => {
        return team?.code || team?.uuid || team?.names?.short || team?.names?.long || null;
    }, []);

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

    const loadGames = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await fetchSvenskaCupenGames({ limit: 200 });
            setGames(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Failed to load Svenska Cupen games', e);
        } finally {
            if (!silent) setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!hasLoadedOnce.current && (eagerLoad || activeSport === 'football')) {
            hasLoadedOnce.current = true;
            loadGames();
        }
    }, [activeSport, loadGames, eagerLoad]);

    useEffect(() => {
        if (activeSport !== 'football') return;
        const shouldAutoRefresh = shouldAutoRefreshGames(games);
        if (!shouldAutoRefresh) return;
        const intervalId = setInterval(() => {
            loadGames(true);
        }, AUTO_REFRESH_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [games, activeSport, shouldAutoRefreshGames, loadGames]);

    useEffect(() => {
        if (activeSport === 'football' && hasUserScrolled.current && savedScrollOffset.current !== null) {
            const timeoutId = setTimeout(() => {
                listRef.current?.scrollToOffset({
                    offset: savedScrollOffset.current,
                    animated: false
                });
            }, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [activeSport]);

    const handleScroll = useCallback((event) => {
        savedScrollOffset.current = event.nativeEvent.contentOffset.y;
        hasUserScrolled.current = true;
    }, []);

    const teams = useMemo(() => {
        const teamMap = new Map();
        games.forEach(game => {
            [game.homeTeamInfo, game.awayTeamInfo].forEach(team => {
                const key = getTeamKey(team);
                if (!key || teamMap.has(key)) return;
                const name = team?.names?.short || team?.names?.long || team?.code || key;
                teamMap.set(key, { key, name, icon: team?.icon || null });
            });
        });
        return Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [games, getTeamKey]);

    const filteredGames = useMemo(() => {
        return games.filter(game => {
            if (selectedFootballTeams.length > 0) {
                const homeKey = getTeamKey(game.homeTeamInfo);
                const awayKey = getTeamKey(game.awayTeamInfo);
                if (!selectedFootballTeams.includes(homeKey) && !selectedFootballTeams.includes(awayKey)) {
                    return false;
                }
            }
            return true;
        });
    }, [games, selectedFootballTeams, getTeamKey]);

    const sortedGames = useMemo(() => {
        return [...filteredGames].sort((a, b) => {
            const timeA = new Date(a.startDateTime).getTime();
            const timeB = new Date(b.startDateTime).getTime();
            return timeA - timeB;
        });
    }, [filteredGames]);

    const targetGameIndex = useMemo(() => {
        if (!sortedGames.length) return 0;
        const liveIndex = sortedGames.findIndex(game => game.state === 'live');
        if (liveIndex !== -1) return liveIndex;
        const upcomingIndex = sortedGames.findIndex(game => game.state !== 'post-game');
        if (upcomingIndex !== -1) return upcomingIndex;
        return sortedGames.length - 1;
    }, [sortedGames]);

    const targetGameId = useMemo(() => sortedGames[targetGameIndex]?.uuid || null, [sortedGames, targetGameIndex]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadGames();
    }, [loadGames]);

    const handleGamePress = useCallback(async (game) => {
        setSelectedGame(game);
        setLoadingDetails(true);
        setGameDetails(null);
        try {
            const details = await fetchSvenskaCupenGameDetails(game.uuid);
            setGameDetails(details);
        } catch (error) {
            console.error('Failed to load Svenska Cupen match details', error);
        } finally {
            setLoadingDetails(false);
        }
    }, []);

    const closeModal = useCallback(() => {
        setSelectedGame(null);
        setGameDetails(null);
        setLoadingDetails(false);
    }, []);

    const refreshModalDetails = useCallback(async () => {
        if (!selectedGame) return;
        setRefreshingModal(true);
        try {
            const details = await fetchSvenskaCupenGameDetails(selectedGame.uuid);
            setGameDetails(details);
        } catch (error) {
            console.error('Failed to refresh Svenska Cupen match details', error);
        } finally {
            setRefreshingModal(false);
        }
    }, [selectedGame]);

    useEffect(() => {
        if (!selectedGame || selectedGame.state !== 'live') return;
        const refreshDetails = async () => {
            try {
                const details = await fetchSvenskaCupenGameDetails(selectedGame.uuid);
                setGameDetails(details);
            } catch (error) {
                console.error('Failed to refresh Svenska Cupen match details', error);
            }
        };
        const intervalId = setInterval(refreshDetails, 15000);
        return () => clearInterval(intervalId);
    }, [selectedGame]);

    const FOOTBALL_CARD_HEIGHT = 174;
    const hasInitialScrolled = useRef(false);
    const effectiveInitialScrollIndex = hasUserScrolled.current ? undefined : (targetGameIndex > 0 ? targetGameIndex : undefined);

    useEffect(() => {
        if (
            activeSport === 'football' &&
            !hasInitialScrolled.current &&
            !hasUserScrolled.current &&
            targetGameIndex > 0 &&
            sortedGames.length > 0
        ) {
            const timeoutId = setTimeout(() => {
                if (listRef.current && !hasInitialScrolled.current) {
                    hasInitialScrolled.current = true;
                    listRef.current.scrollToOffset({
                        offset: targetGameIndex * FOOTBALL_CARD_HEIGHT,
                        animated: false
                    });
                }
            }, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [activeSport, targetGameIndex, sortedGames.length]);

    return {
        games: sortedGames,
        loading,
        refreshing,
        selectedGame,
        gameDetails,
        loadingDetails,
        refreshingModal,
        teams,
        targetGameIndex,
        targetGameId,
        effectiveInitialScrollIndex,
        listRef,
        getTeamKey,
        onRefresh,
        handleGamePress,
        handleScroll,
        closeModal,
        refreshModalDetails
    };
}
